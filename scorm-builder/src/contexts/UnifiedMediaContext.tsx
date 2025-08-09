/**
 * UnifiedMediaContext - Simplified media context using the new MediaService
 * 
 * This context replaces the complex MediaContext + MediaRegistryContext system
 * with a single, unified context that provides all media functionality.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { MediaService, createMediaService, type MediaItem, type MediaMetadata, type ProgressCallback } from '../services/MediaService'
import { logger } from '../utils/logger'
// Removed blobUrlManager - now using asset URLs from MediaService
import type { MediaType } from '../utils/idGenerator'
import { useStorage } from './PersistentStorageContext'

interface UnifiedMediaContextType {
  // Core media operations
  storeMedia: (file: File | Blob, pageId: string, type: MediaType, metadata?: Partial<MediaMetadata>, progressCallback?: ProgressCallback) => Promise<MediaItem>
  getMedia: (mediaId: string) => Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null>
  deleteMedia: (mediaId: string) => Promise<boolean>
  
  // YouTube specific
  storeYouTubeVideo: (youtubeUrl: string, embedUrl: string, pageId: string, metadata?: Partial<MediaMetadata>) => Promise<MediaItem>
  
  // Query operations
  getMediaForPage: (pageId: string) => MediaItem[]
  getAllMedia: () => MediaItem[]
  getMediaById: (mediaId: string) => MediaItem | undefined
  
  // URL management (now using asset URLs)
  createBlobUrl: (mediaId: string) => Promise<string | null>  // Returns asset URL
  revokeBlobUrl: (url: string) => void  // No-op for asset URLs
  
  // Utility
  isLoading: boolean
  error: Error | null
  clearError: () => void
  refreshMedia: () => Promise<void>
}

const UnifiedMediaContext = createContext<UnifiedMediaContextType | null>(null)

interface UnifiedMediaProviderProps {
  children: React.ReactNode
  projectId: string
}

// Global reference for TauriAudioPlayer
let globalMediaContext: UnifiedMediaContextType | null = null

export function getMediaFromContext() {
  return globalMediaContext
}

export function UnifiedMediaProvider({ children, projectId }: UnifiedMediaProviderProps) {
  // Get the shared FileStorage instance from PersistentStorageContext
  const storage = useStorage()
  
  // Extract actual project ID from path if needed
  // ProjectId might be a full path like "C:\...\project.scormproj" or just an ID like "1234567890"
  const extractProjectId = (id: string): string => {
    if (!id) return ''
    
    // If it's a path, extract the project ID from the filename
    if (id.includes('.scormproj')) {
      // Extract from path like "...\ProjectName_1234567890.scormproj"
      const filename = id.split('\\').pop() || id.split('/').pop() || id
      const match = filename.match(/_(\d+)\.scormproj$/)
      if (match) {
        return match[1]
      }
      // Fallback: try to get ID from the beginning if no underscore pattern
      const idMatch = filename.match(/^(\d+)/)
      if (idMatch) {
        return idMatch[1]
      }
    }
    
    // If it looks like just an ID (all digits), return as is
    if (/^\d+$/.test(id)) {
      return id
    }
    
    // Otherwise return as is and hope for the best
    return id
  }
  
  const actualProjectId = extractProjectId(projectId)
  
  // Use a ref to track the media service to avoid re-creating it
  const mediaServiceRef = React.useRef<MediaService | null>(null)
  
  // Get or create the media service for this project with shared FileStorage
  // Use the extracted project ID instead of the raw projectId prop
  if (!mediaServiceRef.current || mediaServiceRef.current !== createMediaService(actualProjectId, storage.fileStorage)) {
    mediaServiceRef.current = createMediaService(actualProjectId, storage.fileStorage)
  }
  
  const mediaService = mediaServiceRef.current
  const [mediaCache, setMediaCache] = useState<Map<string, MediaItem>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  // Load initial media list when projectId changes
  useEffect(() => {
    // Update service ref if project changed
    // Use the extracted project ID instead of the raw projectId prop
    const newService = createMediaService(actualProjectId, storage.fileStorage)
    if (mediaServiceRef.current !== newService) {
      mediaServiceRef.current = newService
    }
    
    refreshMedia()
    
    // Cleanup project-specific blob URLs on unmount
    return () => {
      // Clean up any blob URLs created for this project
      logger.info('[UnifiedMediaContext] Cleaning up project-specific blob URLs')
    }
  }, [actualProjectId, storage.fileStorage])
  
  const refreshMedia = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // First, try to load media from saved project data
      logger.info('[UnifiedMediaContext] Attempting to load media from project data')
      
      // Get saved media data from storage
      const audioNarrationData = await storage.getContent('audioNarration')
      const mediaEnhancementsData = await storage.getContent('media-enhancements')
      const mediaRegistryData = await storage.getContent('media')
      
      logger.info('[UnifiedMediaContext] Retrieved media data from storage:', {
        hasAudioNarration: !!audioNarrationData,
        hasMediaEnhancements: !!mediaEnhancementsData,
        hasMediaRegistry: !!mediaRegistryData
      })
      
      // Load media into MediaService cache
      if (audioNarrationData || mediaEnhancementsData || mediaRegistryData) {
        await mediaService.loadMediaFromProject(audioNarrationData, mediaEnhancementsData, mediaRegistryData)
      }
      
      // Now get all media from the service (which should now include loaded items)
      const allMedia = await mediaService.listAllMedia()
      const newCache = new Map<string, MediaItem>()
      allMedia.forEach(item => {
        newCache.set(item.id, item)
      })
      setMediaCache(newCache)
      logger.info('[UnifiedMediaContext] Loaded', allMedia.length, 'media items')
    } catch (err) {
      logger.error('[UnifiedMediaContext] Failed to load media:', err)
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [mediaService, storage])
  
  const storeMedia = useCallback(async (
    file: File | Blob,
    pageId: string,
    type: MediaType,
    metadata?: Partial<MediaMetadata>,
    progressCallback?: ProgressCallback
  ): Promise<MediaItem> => {
    try {
      const item = await mediaService.storeMedia(file, pageId, type, metadata, progressCallback)
      
      // Update cache
      setMediaCache(prev => {
        const updated = new Map(prev)
        updated.set(item.id, item)
        return updated
      })
      
      return item
    } catch (err) {
      logger.error('[UnifiedMediaContext] Failed to store media:', err)
      setError(err as Error)
      throw err
    }
  }, [mediaService])
  
  const getMedia = useCallback(async (mediaId: string) => {
    try {
      return await mediaService.getMedia(mediaId)
    } catch (err) {
      logger.error('[UnifiedMediaContext] Failed to get media:', mediaId, err)
      setError(err as Error)
      return null
    }
  }, [mediaService])
  
  const deleteMedia = useCallback(async (mediaId: string): Promise<boolean> => {
    try {
      const success = await mediaService.deleteMedia(mediaService.projectId, mediaId)
      
      if (success) {
        // Update cache
        setMediaCache(prev => {
          const updated = new Map(prev)
          updated.delete(mediaId)
          return updated
        })
        
        // No need to release asset URLs - they are persistent
      }
      
      return success
    } catch (err) {
      logger.error('[UnifiedMediaContext] Failed to delete media:', mediaId, err)
      setError(err as Error)
      return false
    }
  }, [mediaService])
  
  const storeYouTubeVideo = useCallback(async (
    youtubeUrl: string,
    embedUrl: string,
    pageId: string,
    metadata?: Partial<MediaMetadata>
  ): Promise<MediaItem> => {
    try {
      const item = await mediaService.storeYouTubeVideo(youtubeUrl, embedUrl, pageId, metadata)
      
      // Update cache
      setMediaCache(prev => {
        const updated = new Map(prev)
        updated.set(item.id, item)
        return updated
      })
      
      return item
    } catch (err) {
      logger.error('[UnifiedMediaContext] Failed to store YouTube video:', err)
      setError(err as Error)
      throw err
    }
  }, [mediaService])
  
  const getMediaForPage = useCallback((pageId: string): MediaItem[] => {
    return Array.from(mediaCache.values()).filter(item => item.pageId === pageId)
  }, [mediaCache])
  
  const getAllMedia = useCallback((): MediaItem[] => {
    return Array.from(mediaCache.values())
  }, [mediaCache])
  
  const getMediaById = useCallback((mediaId: string): MediaItem | undefined => {
    return mediaCache.get(mediaId)
  }, [mediaCache])
  
  const createBlobUrl = useCallback(async (mediaId: string): Promise<string | null> => {
    try {
      console.log('[UnifiedMediaContext v2.0.7] createBlobUrl called for:', mediaId, 'projectId:', actualProjectId)
      
      // Get media with data from MediaService
      const media = await mediaService.getMedia(mediaId)
      console.log('[UnifiedMediaContext v2.0.7] Media data retrieved:', {
        found: !!media,
        hasUrl: !!(media?.url),
        hasData: !!(media?.data),
        dataSize: media?.data?.length || 0,
        url: media?.url,
        urlType: media?.url ? (media.url.startsWith('asset://') ? 'asset' : media.url.startsWith('blob:') ? 'blob' : 'other') : 'none',
        metadata: media?.metadata,
        metadataKeys: media?.metadata ? Object.keys(media.metadata) : []
      })
      
      if (!media) {
        console.error('[UnifiedMediaContext v2.0.7] No media found for ID:', mediaId)
        return null
      }
      
      // Check if it's a YouTube or external URL
      if (media.url && (media.url.startsWith('http') || media.url.startsWith('data:'))) {
        console.log('[UnifiedMediaContext v2.0.7] Using external/data URL directly:', media.url)
        return media.url
      }
      
      // Check if we already have a blob URL
      if (media.url && media.url.startsWith('blob:')) {
        console.log('[UnifiedMediaContext v2.0.7] Using existing blob URL:', media.url)
        return media.url
      }
      
      // CRITICAL FIX: Create real blob URL from data instead of using asset://
      // Since asset:// protocol is not registered, we need to use blob URLs
      if (media.data && media.data.length > 0) {
        console.log('[UnifiedMediaContext v2.0.7] Creating blob URL from data:', {
          mediaId,
          dataSize: media.data.length,
          mimeType: media.metadata?.mimeType || media.metadata?.mime_type
        })
        
        // Determine MIME type
        let mimeType = media.metadata?.mimeType || media.metadata?.mime_type || 'application/octet-stream'
        
        // Fix common MIME type issues
        if (media.metadata?.type === 'image' && !mimeType.startsWith('image/')) {
          mimeType = 'image/jpeg' // Default for images
        } else if (media.metadata?.type === 'audio' && !mimeType.startsWith('audio/')) {
          mimeType = 'audio/mpeg' // Default for audio (mp3)
        } else if (media.metadata?.type === 'video' && !mimeType.startsWith('video/')) {
          mimeType = 'video/mp4' // Default for video
        } else if (media.metadata?.type === 'caption') {
          mimeType = 'text/vtt' // For captions
        }
        
        // Create blob from Uint8Array data
        const blob = new Blob([media.data], { type: mimeType })
        const blobUrl = URL.createObjectURL(blob)
        
        console.log('[UnifiedMediaContext v2.0.7] Created blob URL:', {
          mediaId,
          blobUrl,
          blobSize: blob.size,
          mimeType: blob.type
        })
        
        // Track this blob URL for cleanup
        // Store in a map or manager if needed
        
        return blobUrl
      }
      
      // If no data but we have an asset URL, warn about the issue
      if (media.url && media.url.startsWith('asset://')) {
        console.error('[UnifiedMediaContext v2.0.7] Asset URL without data - asset protocol not working:', media.url)
        console.log('[UnifiedMediaContext v2.0.7] Attempting to fetch media data directly...')
        
        // Try to get the data if we don't have it
        const assetUrl = await mediaService.createBlobUrl(mediaId)
        if (assetUrl) {
          console.log('[UnifiedMediaContext v2.0.7] Got URL from createBlobUrl:', assetUrl)
          return assetUrl
        }
      }
      
      // No URL or data available
      console.error('[UnifiedMediaContext v2.0.7] FAILED - No URL or data for media:', mediaId)
      return null
    } catch (err) {
      logger.error('[UnifiedMediaContext v2.0.7] Failed to create blob URL:', mediaId, err)
      setError(err as Error)
      return null
    }
  }, [mediaService, actualProjectId])
  
  const revokeBlobUrl = useCallback((url: string) => {
    // Asset URLs don't need to be revoked - they are persistent
    // Only revoke if this is a legacy blob URL
    if (url && url.startsWith('blob:')) {
      console.log('[UnifiedMediaContext] Revoking legacy blob URL:', url)
      try {
        URL.revokeObjectURL(url)
      } catch (err) {
        logger.error('[UnifiedMediaContext] Failed to revoke blob URL:', url, err)
      }
    }
  }, [])
  
  const clearError = useCallback(() => {
    setError(null)
  }, [])
  
  const value = useMemo<UnifiedMediaContextType>(() => ({
    storeMedia,
    getMedia,
    deleteMedia,
    storeYouTubeVideo,
    getMediaForPage,
    getAllMedia,
    getMediaById,
    createBlobUrl,
    revokeBlobUrl,
    isLoading,
    error,
    clearError,
    refreshMedia
  }), [
    storeMedia,
    getMedia,
    deleteMedia,
    storeYouTubeVideo,
    getMediaForPage,
    getAllMedia,
    getMediaById,
    createBlobUrl,
    revokeBlobUrl,
    isLoading,
    error,
    clearError,
    refreshMedia
  ])
  
  // Set global context for TauriAudioPlayer
  useEffect(() => {
    globalMediaContext = value
    return () => {
      globalMediaContext = null
    }
  }, [value])
  
  return (
    <UnifiedMediaContext.Provider value={value}>
      {children}
    </UnifiedMediaContext.Provider>
  )
}

export function useUnifiedMedia() {
  const context = useContext(UnifiedMediaContext)
  if (!context) {
    throw new Error('useUnifiedMedia must be used within a UnifiedMediaProvider')
  }
  return context
}

