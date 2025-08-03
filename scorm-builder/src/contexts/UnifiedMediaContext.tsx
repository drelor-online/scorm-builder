/**
 * UnifiedMediaContext - Simplified media context using the new MediaService
 * 
 * This context replaces the complex MediaContext + MediaRegistryContext system
 * with a single, unified context that provides all media functionality.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { MediaService, createMediaService, type MediaItem, type MediaMetadata, type ProgressCallback } from '../services/MediaService'
import { logger } from '../utils/logger'
import { blobUrlManager } from '../utils/blobUrlManager'
import type { MediaType } from '../utils/idGenerator'

interface UnifiedMediaContextType {
  // Core media operations
  storeMedia: (file: File | Blob, pageId: string, type: MediaType, metadata?: Partial<MediaMetadata>, progressCallback?: ProgressCallback) => Promise<MediaItem>
  getMedia: (mediaId: string) => Promise<{ data: Uint8Array; metadata: MediaMetadata } | null>
  deleteMedia: (mediaId: string) => Promise<boolean>
  
  // YouTube specific
  storeYouTubeVideo: (youtubeUrl: string, embedUrl: string, pageId: string, metadata?: Partial<MediaMetadata>) => Promise<MediaItem>
  
  // Query operations
  getMediaForPage: (pageId: string) => MediaItem[]
  getAllMedia: () => MediaItem[]
  getMediaById: (mediaId: string) => MediaItem | undefined
  
  // Blob URL management
  createBlobUrl: (mediaId: string) => Promise<string | null>
  revokeBlobUrl: (url: string) => void
  
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

export function UnifiedMediaProvider({ children, projectId }: UnifiedMediaProviderProps) {
  // Use a ref to track the media service to avoid re-creating it
  const mediaServiceRef = React.useRef<MediaService | null>(null)
  
  // Get or create the media service for this project
  if (!mediaServiceRef.current || mediaServiceRef.current !== createMediaService(projectId)) {
    mediaServiceRef.current = createMediaService(projectId)
  }
  
  const mediaService = mediaServiceRef.current
  const [mediaCache, setMediaCache] = useState<Map<string, MediaItem>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  // Load initial media list when projectId changes
  useEffect(() => {
    // Update service ref if project changed
    const newService = createMediaService(projectId)
    if (mediaServiceRef.current !== newService) {
      mediaServiceRef.current = newService
    }
    
    refreshMedia()
    
    // Cleanup project-specific blob URLs on unmount
    return () => {
      // Clean up any blob URLs created for this project
      logger.info('[UnifiedMediaContext] Cleaning up project-specific blob URLs')
    }
  }, [projectId])
  
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
      const success = await mediaService.deleteMedia(mediaId)
      
      if (success) {
        // Update cache
        setMediaCache(prev => {
          const updated = new Map(prev)
          updated.delete(mediaId)
          return updated
        })
        
        // Release blob URL if exists
        blobUrlManager.releaseUrl(mediaId)
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
      // Check if we already have a blob URL
      const existingUrl = blobUrlManager.getUrl(mediaId)
      if (existingUrl) {
        return existingUrl
      }
      
      // Get media data and create blob
      const media = await mediaService.getMedia(mediaId)
      if (!media) {
        return null
      }
      
      const blob = new Blob([media.data], { type: media.metadata.mimeType || 'application/octet-stream' })
      const url = blobUrlManager.getOrCreateUrl(mediaId, blob, { 
        projectId,
        ...media.metadata 
      })
      
      return url
    } catch (err) {
      logger.error('[UnifiedMediaContext] Failed to create blob URL:', mediaId, err)
      setError(err as Error)
      return null
    }
  }, [mediaService, projectId])
  
  const revokeBlobUrl = useCallback((url: string) => {
    // Find the media ID for this URL
    let mediaId: string | undefined
    
    // This is a bit inefficient but necessary for backward compatibility
    // In the future, we should pass mediaId directly
    for (const [key, value] of mediaCache.entries()) {
      if (blobUrlManager.getUrl(key) === url) {
        mediaId = key
        break
      }
    }
    
    if (mediaId) {
      blobUrlManager.releaseUrl(mediaId)
    } else {
      // Direct revoke if we can't find the key
      try {
        URL.revokeObjectURL(url)
      } catch (err) {
        logger.error('[UnifiedMediaContext] Failed to revoke blob URL:', url, err)
      }
    }
  }, [mediaCache])
  
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

