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
  }, [mediaService])
  
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
      console.log('[UnifiedMediaContext] Getting media for asset URL:', mediaId)
      
      // Get media with asset URL from MediaService
      const media = await mediaService.getMedia(mediaId)
      console.log('[UnifiedMediaContext] Media data retrieved:', {
        found: !!media,
        hasUrl: !!(media?.url),
        url: media?.url,
        metadata: media?.metadata
      })
      
      if (!media) {
        console.error('[UnifiedMediaContext] No media found for ID:', mediaId)
        return null
      }
      
      // Always use asset URL from MediaService (no blob URLs!)
      // MediaService already handles asset:// protocol correctly
      if (media.url) {
        console.log('[UnifiedMediaContext] Using asset URL from MediaService:', {
          mediaId,
          url: media.url,
          isAssetUrl: media.url.startsWith('asset://'),
          isDataUrl: media.url.startsWith('data:'),
          isYouTubeUrl: media.url.startsWith('http')
        })
        return media.url
      }
      
      // If no URL, try to get one from MediaService
      const assetUrl = await mediaService.createBlobUrl(mediaId)
      if (assetUrl) {
        console.log('[UnifiedMediaContext] Created asset URL via MediaService:', {
          mediaId,
          url: assetUrl
        })
        return assetUrl
      }
      
      // No URL available
      console.warn('[UnifiedMediaContext] Media has no URL:', mediaId)
      return null
    } catch (err) {
      logger.error('[UnifiedMediaContext] Failed to create blob URL:', mediaId, err)
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

