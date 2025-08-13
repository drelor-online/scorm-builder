/**
 * UnifiedMediaContext - Simplified media context using the new MediaService
 * 
 * This context replaces the complex MediaContext + MediaRegistryContext system
 * with a single, unified context that provides all media functionality.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { MediaService, createMediaService, type MediaItem, type MediaMetadata, type ProgressCallback } from '../services/MediaService'
import { logger } from '../utils/logger'
import { BlobURLCache } from '../services/BlobURLCache'
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
  
  // Cache operations (for performance optimization)
  hasAudioCached: (mediaId: string) => boolean
  getCachedAudio: (mediaId: string) => { data: Uint8Array; metadata: MediaMetadata } | null
  clearAudioFromCache: (mediaId: string) => void
  
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
  
  // Get the global BlobURLCache instance
  const blobCache = useMemo(() => BlobURLCache.getInstance(), [])
  
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
  
  // Use refs to track the media service and last loaded project ID
  const mediaServiceRef = React.useRef<MediaService | null>(null)
  const lastLoadedProjectIdRef = React.useRef<string | null>(null)
  const isLoadingRef = React.useRef<boolean>(false)
  
  const [mediaCache, setMediaCache] = useState<Map<string, MediaItem>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  // Load initial media list when projectId changes
  useEffect(() => {
    // Only proceed if project ID has actually changed
    if (lastLoadedProjectIdRef.current === actualProjectId) {
      logger.info('[UnifiedMediaContext] Project ID unchanged, skipping media reload:', actualProjectId)
      return
    }
    
    // Prevent concurrent loads
    if (isLoadingRef.current) {
      logger.info('[UnifiedMediaContext] Already loading media, skipping duplicate load')
      return
    }
    
    // Clear the audio cache from the previous project's MediaService
    if (mediaServiceRef.current && typeof (mediaServiceRef.current as any).clearAudioCache === 'function') {
      logger.info('[UnifiedMediaContext] Clearing audio cache from previous project')
      ;(mediaServiceRef.current as any).clearAudioCache()
    }
    
    // Update the media service if needed
    const newService = createMediaService(actualProjectId, storage.fileStorage)
    mediaServiceRef.current = newService
    
    // Update the last loaded project ID
    lastLoadedProjectIdRef.current = actualProjectId
    
    // Load media for the new project
    logger.info('[UnifiedMediaContext] Loading media for new project:', actualProjectId)
    refreshMedia()
    
    // Cleanup project-specific blob URLs on unmount
    return () => {
      // Clear audio cache when unmounting
      if (mediaServiceRef.current && typeof (mediaServiceRef.current as any).clearAudioCache === 'function') {
        logger.info('[UnifiedMediaContext] Clearing audio cache on unmount')
        ;(mediaServiceRef.current as any).clearAudioCache()
      }
      
      // Clean up blob URLs for this project using BlobURLCache
      logger.info('[UnifiedMediaContext] Cleaning up project-specific blob URLs')
      blobCache.clearProject(actualProjectId)
    }
  }, [actualProjectId, storage.fileStorage, blobCache])
  
  const refreshMedia = useCallback(async () => {
    // Prevent concurrent loads
    if (isLoadingRef.current) {
      logger.info('[UnifiedMediaContext] Already loading, skipping refresh')
      return
    }
    
    isLoadingRef.current = true
    setIsLoading(true)
    setError(null)
    
    try {
      // Get the current media service from ref
      const mediaService = mediaServiceRef.current
      if (!mediaService) {
        logger.warn('[UnifiedMediaContext] No media service available')
        return
      }
      
      // CRITICAL FIX: Load media from disk first to handle session restart
      // This ensures blob URLs are regenerated for media stored in previous sessions
      logger.info('[UnifiedMediaContext v2.1.1] Loading media from disk for session restart handling')
      
      // Check if MediaService has loadMediaFromDisk method
      if (typeof (mediaService as any).loadMediaFromDisk === 'function') {
        try {
          await (mediaService as any).loadMediaFromDisk()
          logger.info('[UnifiedMediaContext v2.1.1] Successfully loaded media from disk')
        } catch (diskLoadError) {
          logger.warn('[UnifiedMediaContext v2.1.1] Failed to load media from disk, continuing with project data:', diskLoadError)
        }
      }
      
      // Then try to load media from saved project data
      logger.info('[UnifiedMediaContext] Attempting to load media from project data')
      
      // Get saved media data from storage
      const audioNarrationData = await storage.getContent('audioNarration')
      const mediaEnhancementsData = await storage.getContent('media-enhancements')
      const mediaRegistryData = await storage.getContent('media')
      const courseContent = await storage.getContent('course-content')
      
      logger.info('[UnifiedMediaContext] Retrieved media data from storage:', {
        hasAudioNarration: !!audioNarrationData,
        hasMediaEnhancements: !!mediaEnhancementsData,
        hasMediaRegistry: !!mediaRegistryData,
        hasCourseContent: !!courseContent
      })
      
      // Load media into MediaService cache
      if (audioNarrationData || mediaEnhancementsData || mediaRegistryData) {
        await mediaService.loadMediaFromProject(audioNarrationData, mediaEnhancementsData, mediaRegistryData)
      }
      
      // Also load media from course content (where media is stored in page arrays)
      if (courseContent) {
        await mediaService.loadMediaFromCourseContent(courseContent)
      }
      
      // Now get all media from the service (which will also scan file system)
      // This will include both cached items and file system discovery
      const allMedia = await mediaService.listAllMedia()
      const newCache = new Map<string, MediaItem>()
      allMedia.forEach(item => {
        newCache.set(item.id, item)
      })
      setMediaCache(newCache)
      logger.info('[UnifiedMediaContext] Loaded', allMedia.length, 'media items')
      
      // PERFORMANCE OPTIMIZATION: Preload all media blob URLs
      if (allMedia.length > 0) {
        logger.info('[UnifiedMediaContext] Preloading blob URLs for', allMedia.length, 'media items...')
        const mediaIds = allMedia
          .filter(item => {
            // Guard against undefined/null/empty IDs
            if (!item.id || item.id === '') return false
            
            // Skip YouTube videos without proper URLs (they don't need blob preloading)
            if (item.metadata?.type === 'youtube' && !item.metadata?.url) {
              logger.warn('[UnifiedMediaContext] Skipping YouTube item without URL:', item.id)
              return false
            }
            
            return true
          })
          .map(item => item.id)
        
        // Skip if no valid media IDs
        if (mediaIds.length === 0) {
          logger.info('[UnifiedMediaContext] No valid media IDs found, skipping preload')
          return
        }
        
        // Use BlobURLCache to preload all media
        const preloadedUrls = await blobCache.preloadMedia(mediaIds, async (id) => {
          const media = await mediaService.getMedia(id)
          if (!media || !media.data) return null
          
          // Determine MIME type
          let mimeType = media.metadata?.mimeType || media.metadata?.mime_type || 'application/octet-stream'
          
          // Fix common MIME type issues
          if (media.metadata?.type === 'image' && !mimeType.startsWith('image/')) {
            mimeType = 'image/jpeg'
          } else if (media.metadata?.type === 'audio' && !mimeType.startsWith('audio/')) {
            mimeType = 'audio/mpeg'
          } else if (media.metadata?.type === 'video' && !mimeType.startsWith('video/')) {
            mimeType = 'video/mp4'
          } else if (media.metadata?.type === 'caption') {
            mimeType = 'text/vtt'
          }
          
          return { data: media.data, mimeType }
        })
        
        const successCount = preloadedUrls.filter(url => url !== null).length
        logger.info('[UnifiedMediaContext] Preloaded', successCount, 'of', allMedia.length, 'blob URLs')
      }
    } catch (err) {
      logger.error('[UnifiedMediaContext] Failed to load media:', err)
      setError(err as Error)
    } finally {
      setIsLoading(false)
      isLoadingRef.current = false
    }
  }, [storage, blobCache])
  
  const storeMedia = useCallback(async (
    file: File | Blob,
    pageId: string,
    type: MediaType,
    metadata?: Partial<MediaMetadata>,
    progressCallback?: ProgressCallback
  ): Promise<MediaItem> => {
    try {
      const mediaService = mediaServiceRef.current
      if (!mediaService) {
        throw new Error('Media service not initialized')
      }
      const item = await mediaService.storeMedia(file, pageId, type, metadata, progressCallback)
      
      // Clear any existing blob URL for this media ID to force regeneration
      blobCache.revoke(item.id)
      console.log('[UnifiedMediaContext] Cleared blob URL cache for replaced media:', item.id)
      
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
  }, [blobCache])
  
  const getMedia = useCallback(async (mediaId: string) => {
    try {
      const mediaService = mediaServiceRef.current
      if (!mediaService) {
        throw new Error('Media service not initialized')
      }
      return await mediaService.getMedia(mediaId)
    } catch (err) {
      logger.error('[UnifiedMediaContext] Failed to get media:', mediaId, err)
      setError(err as Error)
      return null
    }
  }, [])
  
  const deleteMedia = useCallback(async (mediaId: string): Promise<boolean> => {
    try {
      const mediaService = mediaServiceRef.current
      if (!mediaService) {
        throw new Error('Media service not initialized')
      }
      const success = await mediaService.deleteMedia(mediaService.projectId, mediaId)
      
      if (success) {
        // Update cache
        setMediaCache(prev => {
          const updated = new Map(prev)
          updated.delete(mediaId)
          return updated
        })
        
        // Clear blob URL cache for this media
        blobCache.revoke(mediaId)
        console.log('[UnifiedMediaContext] Cleared blob URL cache for deleted media:', mediaId)
      }
      
      return success
    } catch (err) {
      logger.error('[UnifiedMediaContext] Failed to delete media:', mediaId, err)
      setError(err as Error)
      return false
    }
  }, [blobCache])
  
  const storeYouTubeVideo = useCallback(async (
    youtubeUrl: string,
    embedUrl: string,
    pageId: string,
    metadata?: Partial<MediaMetadata>
  ): Promise<MediaItem> => {
    try {
      const mediaService = mediaServiceRef.current
      if (!mediaService) {
        throw new Error('Media service not initialized')
      }
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
  }, [])
  
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
      // Reduced logging to prevent console lock-up
      // console.log('[UnifiedMediaContext v3.0.0] createBlobUrl called for:', mediaId, 'projectId:', actualProjectId)
      
      // Use BlobURLCache for efficient caching
      return await blobCache.getOrCreate(mediaId, async () => {
      
        // Get media with data from MediaService
        const mediaService = mediaServiceRef.current
        if (!mediaService) {
          logger.error('[UnifiedMediaContext] No media service available for createBlobUrl')
          return null
        }
        const media = await mediaService.getMedia(mediaId)
        // Simplified logging to prevent console lock-up
        if (media) {
          console.log('[UnifiedMediaContext v3.0.0] Media found, size:', media?.data?.length || 0)
        }
        
        if (!media) {
          console.error('[UnifiedMediaContext v3.0.0] No media found for ID:', mediaId)
          return null
        }
        
        // Check if it's a YouTube or external URL - don't cache these
        if (media.url && (media.url.startsWith('http') || media.url.startsWith('data:'))) {
          console.log('[UnifiedMediaContext v3.0.0] External/data URL, returning directly:', media.url)
          // Don't cache external URLs in BlobURLCache
          throw new Error('External URL - skip caching')
        }
        
        // Return data for BlobURLCache to create blob URL
        if (media.data && media.data.length > 0) {
          console.log('[UnifiedMediaContext v3.0.0] Returning data for BlobURLCache:', {
            mediaId,
            dataSize: media.data.length,
            mimeType: media.metadata?.mimeType || media.metadata?.mime_type
          })
          
          // Determine MIME type
          let mimeType = media.metadata?.mimeType || media.metadata?.mime_type || 'application/octet-stream'
          
          // Check if this is an SVG file by examining the content
          if (media.data && media.data.length > 0) {
            const firstBytes = media.data.slice(0, 100)
            const text = new TextDecoder('utf-8', { fatal: false }).decode(firstBytes)
            if (text.includes('<svg') || text.includes('<?xml')) {
              mimeType = 'image/svg+xml'
              console.log('[UnifiedMediaContext] Detected SVG content for:', mediaId)
            }
          }
          
          // Fix common MIME type issues
          if (media.metadata?.type === 'image' && !mimeType.startsWith('image/')) {
            // Check for SVG first by looking at the data
            if (media.data && media.data.length > 0) {
              const firstBytes = media.data.slice(0, 4)
              if (firstBytes[0] === 60) { // '<' character, likely XML/SVG
                mimeType = 'image/svg+xml'
              } else {
                mimeType = 'image/jpeg' // Default for images
              }
            } else {
              mimeType = 'image/jpeg' // Default for images
            }
          } else if (media.metadata?.type === 'audio' && !mimeType.startsWith('audio/')) {
            mimeType = 'audio/mpeg' // Default for audio (mp3)
          } else if (media.metadata?.type === 'video' && !mimeType.startsWith('video/')) {
            mimeType = 'video/mp4' // Default for video
          } else if (media.metadata?.type === 'caption') {
            mimeType = 'text/vtt' // For captions
          }
          
          return { data: media.data, mimeType }
        }
        
        // No data available
        console.error('[UnifiedMediaContext v3.0.0] No data available for media:', mediaId)
        return null
      })
    } catch (err) {
      // Check if it's an external URL that we should return directly
      if (err instanceof Error && err.message === 'External URL - skip caching') {
        // Get the media again to return the external URL
        const mediaService = mediaServiceRef.current
        if (mediaService) {
          const media = await mediaService.getMedia(mediaId)
          if (media?.url && (media.url.startsWith('http') || media.url.startsWith('data:'))) {
            return media.url
          }
        }
      }
      logger.error('[UnifiedMediaContext v3.0.0] Failed to create blob URL:', mediaId, err)
      setError(err as Error)
      return null
    }
  }, [actualProjectId, blobCache])
  
  const revokeBlobUrl = useCallback((url: string) => {
    // BlobURLCache handles revocation - this is now a no-op
    // Kept for backward compatibility
    console.log('[UnifiedMediaContext] revokeBlobUrl called (handled by BlobURLCache):', url)
  }, [])
  
  const clearError = useCallback(() => {
    setError(null)
  }, [])
  
  const hasAudioCached = useCallback((mediaId: string): boolean => {
    const mediaService = mediaServiceRef.current
    if (!mediaService) return false
    
    // Check if MediaService has the hasAudioCached method
    if (typeof (mediaService as any).hasAudioCached === 'function') {
      return (mediaService as any).hasAudioCached(mediaId)
    }
    return false
  }, [])
  
  const getCachedAudio = useCallback((mediaId: string): { data: Uint8Array; metadata: MediaMetadata } | null => {
    const mediaService = mediaServiceRef.current
    if (!mediaService) return null
    
    // Check if MediaService has the getCachedAudio method
    if (typeof (mediaService as any).getCachedAudio === 'function') {
      return (mediaService as any).getCachedAudio(mediaId)
    }
    return null
  }, [])

  const clearAudioFromCache = useCallback((mediaId: string): void => {
    const mediaService = mediaServiceRef.current
    if (!mediaService) return
    
    // Check if MediaService has the clearAudioFromCache method
    if (typeof (mediaService as any).clearAudioFromCache === 'function') {
      (mediaService as any).clearAudioFromCache(mediaId)
    }
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
    hasAudioCached,
    getCachedAudio,
    clearAudioFromCache,
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
    hasAudioCached,
    getCachedAudio,
    clearAudioFromCache,
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

