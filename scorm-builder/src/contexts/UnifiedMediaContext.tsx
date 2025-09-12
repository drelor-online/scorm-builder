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
  updateMedia: (existingId: string, file: File | Blob, metadata?: Partial<MediaMetadata>, progressCallback?: ProgressCallback) => Promise<MediaItem>
  getMedia: (mediaId: string) => Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null>
  deleteMedia: (mediaId: string) => Promise<boolean>
  deleteAllMedia: (projectId: string) => Promise<void>
  
  // YouTube specific
  storeYouTubeVideo: (youtubeUrl: string, embedUrl: string, pageId: string, metadata?: Partial<MediaMetadata>) => Promise<MediaItem>
  updateYouTubeVideoMetadata: (mediaId: string, updates: Partial<Pick<MediaMetadata, 'clipStart' | 'clipEnd' | 'title' | 'embedUrl'>>) => Promise<MediaItem>
  
  // Query operations
  getMediaForPage: (pageId: string) => MediaItem[]
  getValidMediaForPage: (pageId: string) => Promise<MediaItem[]>  // Defensive version that validates existence
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
  
  // Cache management
  resetMediaCache: () => void
  populateFromCourseContent: (mediaItems: any[], pageId: string) => Promise<void>
  
  // Cleanup utilities
  cleanContaminatedMedia: () => Promise<{ cleaned: string[], errors: string[] }>
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
  
  // Track media loads to prevent infinite reloading
  const hasLoadedRef = useRef<Set<string>>(new Set())
  
  // Load initial media list when projectId changes
  useEffect(() => {
    // EMERGENCY DEBUG: Track media context loads
    console.log('[DEBUG] UnifiedMediaContext useEffect triggered for project:', actualProjectId)
    
    // Stronger guard against reloads
    if (hasLoadedRef.current.has(actualProjectId)) {
      console.log('[UnifiedMediaContext] Already loaded this project, SKIPPING:', actualProjectId)
      return
    }
    
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
    
    // Mark this project as being loaded
    hasLoadedRef.current.add(actualProjectId)
    
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
      
      // Clean up ALL blob URLs when switching projects to prevent stale references
      logger.info('[UnifiedMediaContext] Clearing ALL blob URLs to prevent stale references')
      blobCache.clearAll()
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
      console.log(`🔍 [DEBUG] MediaService.listAllMedia() returned ${allMedia.length} items:`)
      allMedia.forEach(item => {
        console.log(`🔍 [DEBUG] MediaService item: ${item.id} → pageId: '${item.pageId}', type: '${item.type}'`)
      })
      
      const newCache = new Map<string, MediaItem>()
      allMedia.forEach(item => {
        newCache.set(item.id, item)
      })
      setMediaCache(newCache)
      console.log(`🔍 [DEBUG] Updated cache with ${allMedia.length} items from MediaService`)
      logger.info('[UnifiedMediaContext] Loaded', allMedia.length, 'media items')
      
      // PERFORMANCE OPTIMIZATION: Preload all media blob URLs
      if (allMedia.length > 0) {
        logger.info('[UnifiedMediaContext] Preloading blob URLs for', allMedia.length, 'media items...')
        const mediaIds = allMedia
          .filter(item => {
            // Guard against undefined/null/empty IDs
            if (!item.id || item.id === '') return false
            
            // Skip invalid placeholder IDs that don't correspond to actual media files
            if (item.id === 'learning-objectives' || 
                item.id === 'welcome' || 
                item.id === 'objectives') {
              logger.warn('[UnifiedMediaContext] Skipping placeholder media ID:', item.id)
              return false
            }
            
            // Skip YouTube videos without proper URLs (they don't need blob preloading)
            if ((item.metadata?.type as string) === 'youtube') {
              const hasYouTubeUrl = item.metadata?.url || 
                                   item.metadata?.embedUrl || 
                                   item.metadata?.embed_url ||
                                   item.metadata?.youtubeUrl ||
                                   item.metadata?.youtube_url
              if (!hasYouTubeUrl) {
                logger.warn('[UnifiedMediaContext] Skipping YouTube item without URL:', item.id, {
                  availableKeys: Object.keys(item.metadata || {}),
                  metadataType: item.metadata?.type
                })
                return false
              }
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
  
  const deleteAllMedia = useCallback(async (projectId: string): Promise<void> => {
    try {
      const mediaService = mediaServiceRef.current
      if (!mediaService) {
        throw new Error('Media service not initialized')
      }
      
      logger.info('[UnifiedMediaContext] Deleting all media for project:', projectId)
      
      // Call MediaService to delete all media
      await mediaService.deleteAllMedia(projectId)
      
      // CRITICAL: Reset the entire media cache and load tracking
      // This ensures that UnifiedMediaContext will reload media on next access
      resetMediaCache()
      
      logger.info('[UnifiedMediaContext] Successfully deleted all media for project:', projectId)
    } catch (err) {
      logger.error('[UnifiedMediaContext] Failed to delete all media:', projectId, err)
      setError(err as Error)
      throw err
    }
  }, [blobCache])

  const resetMediaCache = useCallback(() => {
    logger.info('[UnifiedMediaContext] Resetting media cache and load tracking refs')
    
    // Clear the media cache completely
    setMediaCache(new Map())
    
    // CRITICAL FIX: Reset the refs that track what projects have been loaded
    // This was the root cause of the persistent media reference bug
    hasLoadedRef.current.clear()
    lastLoadedProjectIdRef.current = null
    
    // Reset loading state
    isLoadingRef.current = false
    setIsLoading(false)
    setError(null)
    
    // Clear all blob URL cache to prevent stale references
    blobCache.clearAll()
    
    // ADDITIONAL FIX: Clear the audio cache from the MediaService if it exists
    if (mediaServiceRef.current && typeof (mediaServiceRef.current as any).clearAudioCache === 'function') {
      logger.info('[UnifiedMediaContext] Clearing MediaService audio cache during reset')
      ;(mediaServiceRef.current as any).clearAudioCache()
    }
    
    logger.info('[UnifiedMediaContext] Media cache and refs completely reset')
  }, [blobCache])

  const populateFromCourseContent = useCallback(async (mediaItems: any[], pageId: string) => {
    // 🔧 SAFEGUARD: Check if we've already populated this page to prevent infinite loops
    const cacheKey = `${pageId}-${mediaItems.length}-${mediaItems.map(i => i.id).join(',')}`
    const alreadyPopulated = hasLoadedRef.current.has(cacheKey)
    
    if (alreadyPopulated) {
      logger.debug(`[UnifiedMediaContext] Skipping duplicate population for page: ${pageId}`)
      return
    }
    
    logger.info(`[UnifiedMediaContext] Populating media cache from course content for page: ${pageId}`, {
      itemCount: mediaItems.length,
      items: mediaItems.map(item => ({ id: item.id, type: item.type, title: item.title }))
    })
    
    try {
      // Convert course content media items to MediaItem format and add to cache
      const convertedItems: MediaItem[] = mediaItems
        .filter(item => item.type === 'image' || item.type === 'video' || item.type === 'youtube') // Only include image/video/youtube
        .map(item => {
          // Extract metadata safely
          const metadata = (item as any).metadata || {}
          const itemAny = item as any
          
          // 🔧 CRITICAL FIX: Only add YouTube-related fields for actual YouTube videos
          // This prevents contamination false positives that cause infinite loops
          
          const isActualYouTubeVideo = !!(
            itemAny.isYouTube || 
            metadata.isYouTube || 
            itemAny.url?.includes('youtube.com') || 
            itemAny.url?.includes('youtu.be') ||
            metadata.youtubeUrl ||
            itemAny.youtubeUrl
          )
          
          // Base metadata that all items get
          const baseMetadata = {
            type: item.type,
            title: metadata.title || itemAny.title || item.title || 'Untitled',
            pageId: pageId,
            uploadedAt: metadata.uploadedAt || itemAny.uploadedAt || new Date().toISOString()
          }
          
          // YouTube-specific metadata (only for actual YouTube videos)
          // 🔧 CRITICAL FIX: Don't extract clip timing from course content - it doesn't exist there
          // Clip timing data is stored separately in FileStorage and loaded by MediaService
          const youtubeMetadata = isActualYouTubeVideo ? {
            source: 'youtube',
            isYouTube: true,
            youtubeUrl: metadata.youtubeUrl || itemAny.youtubeUrl || itemAny.url,
            embedUrl: metadata.embedUrl || itemAny.embedUrl,
            thumbnail: metadata.thumbnail || itemAny.thumbnail,
            // clipStart/clipEnd intentionally omitted - will be loaded by MediaService from FileStorage
          } : {}
          
          // Non-YouTube metadata (for images and regular videos)
          const regularMetadata = !isActualYouTubeVideo ? {
            // Only add fields that are NOT YouTube-related to avoid contamination detection
            thumbnail: metadata.thumbnail || itemAny.thumbnail
          } : {}
          
          return {
            id: item.id,
            type: item.type as MediaType,
            pageId: pageId,
            fileName: metadata.title || itemAny.title || item.fileName || 'untitled',
            mimeType: metadata.mimeType || itemAny.mimeType || (item.type === 'image' ? 'image/jpeg' : 'video/mp4'),
            metadata: {
              ...baseMetadata,
              ...youtubeMetadata,
              ...regularMetadata
            }
          } as MediaItem
        })
      
      // Add items to the media cache
      setMediaCache(prev => {
        const updated = new Map(prev)
        convertedItems.forEach(item => {
          updated.set(item.id, item)
          logger.debug(`[UnifiedMediaContext] Added to cache from course content: ${item.id} (${item.type}) - clip timing will be loaded by MediaService`)
          console.log(`🔍 [DEBUG] Cache ADD: ${item.id} → pageId: '${item.pageId}', type: '${item.type}'`)
        })
        return updated
      })
      
      // Mark this page as populated to prevent duplicate calls
      hasLoadedRef.current.add(cacheKey)
      
      logger.info(`[UnifiedMediaContext] Successfully populated cache with ${convertedItems.length} items for page ${pageId}`)
    } catch (error) {
      logger.error('[UnifiedMediaContext] Failed to populate from course content:', error)
      throw error
    }
  }, [])

  const cleanContaminatedMedia = useCallback(async (): Promise<{ cleaned: string[], errors: string[] }> => {
    try {
      const mediaService = mediaServiceRef.current
      if (!mediaService) {
        throw new Error('Media service not initialized')
      }
      
      logger.info('[UnifiedMediaContext] Starting contaminated media cleanup...')
      
      // Check if the MediaService has the cleanup method
      if (typeof (mediaService as any).cleanContaminatedMedia === 'function') {
        const result = await (mediaService as any).cleanContaminatedMedia()
        
        // Refresh media cache after cleanup
        await refreshMedia()
        
        logger.info('[UnifiedMediaContext] Contaminated media cleanup complete:', result)
        return result
      } else {
        const errorMsg = 'MediaService cleanup method not available'
        logger.error('[UnifiedMediaContext]', errorMsg)
        return { cleaned: [], errors: [errorMsg] }
      }
    } catch (err) {
      logger.error('[UnifiedMediaContext] Failed to clean contaminated media:', err)
      setError(err as Error)
      return { cleaned: [], errors: [String(err)] }
    }
  }, [refreshMedia])
  
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

  const updateYouTubeVideoMetadata = useCallback(async (
    mediaId: string,
    updates: Partial<Pick<MediaMetadata, 'clipStart' | 'clipEnd' | 'title' | 'embedUrl'>>
  ): Promise<MediaItem> => {
    try {
      const mediaService = mediaServiceRef.current
      if (!mediaService) {
        throw new Error('Media service not initialized')
      }
      const item = await mediaService.updateYouTubeVideoMetadata(mediaId, updates)
      
      // Update cache
      setMediaCache(prev => {
        const updated = new Map(prev)
        updated.set(item.id, item)
        return updated
      })
      
      logger.info('[UnifiedMediaContext] Updated YouTube video metadata:', { mediaId, updates })
      return item
    } catch (err) {
      logger.error('[UnifiedMediaContext] Failed to update YouTube video metadata:', err)
      setError(err as Error)
      throw err
    }
  }, [])
  
  const getMediaForPage = useCallback((pageId: string): MediaItem[] => {
    return Array.from(mediaCache.values()).filter(item => item.pageId === pageId)
  }, [mediaCache])
  
  const getValidMediaForPage = useCallback(async (pageId: string): Promise<MediaItem[]> => {
    // 🔍 DEBUG: Log all cache contents for debugging page association issues
    const allCachedItems = Array.from(mediaCache.values())
    console.log(`🔍 [UnifiedMediaContext] getValidMediaForPage('${pageId}') - DEBUG INFO:`)
    console.log(`   Total cached items: ${allCachedItems.length}`)
    console.log(`   All cached item IDs and pages:`, allCachedItems.map(item => ({
      id: item.id,
      type: item.type,
      pageId: item.pageId,
      fileName: item.fileName,
      hasMetadata: !!item.metadata,
      metadataPageId: item.metadata?.pageId,
      metadataKeys: item.metadata ? Object.keys(item.metadata) : []
    })))
    
    // Apply page ID mapping for learning objectives (same logic as rustScormGenerator)
    const normalizedPageIds = [pageId]
    if (pageId === 'learning-objectives' || pageId === 'content-1') {
      normalizedPageIds.push('objectives') // Also match 'objectives' pageId
      console.log(`🔧 [UnifiedMediaContext] Applied page ID mapping: '${pageId}' → also searching for 'objectives'`)
    } else if (pageId === 'objectives') {
      normalizedPageIds.push('learning-objectives', 'content-1') // Also match these variations
      console.log(`🔧 [UnifiedMediaContext] Applied page ID mapping: '${pageId}' → also searching for 'learning-objectives', 'content-1'`)
    }
    
    const allMediaForPage = Array.from(mediaCache.values()).filter(item => 
      normalizedPageIds.includes(item.pageId)
    )
    console.log(`   Items matching pageId '${pageId}': ${allMediaForPage.length}`)
    if (allMediaForPage.length > 0) {
      console.log(`   Matching items:`, allMediaForPage.map(item => ({
        id: item.id,
        type: item.type,
        pageId: item.pageId
      })))
    }
    
    // 🚨 CONTAMINATION DETECTION: Check for metadata contamination in cached media items
    let contaminatedCount = 0
    for (const item of allMediaForPage) {
      // 🔧 CRITICAL FIX: Skip contamination detection for legitimate YouTube videos
      // YouTube videos are SUPPOSED to have these fields - they're not contamination!
      const isLegitimateYouTubeVideo = item.type === 'video' || item.type === 'youtube'
      if (isLegitimateYouTubeVideo) {
        continue
      }
      
      // 🔧 CONTAMINATION FIX: Only flag actual YouTube-specific metadata
      // clipStart/clipEnd are legitimate for any media type (presentations, etc.)
      const hasYouTubeMetadata = !!(
        item.metadata?.source === 'youtube' ||
        item.metadata?.youtubeUrl ||
        item.metadata?.embedUrl ||
        (item.metadata?.isYouTube === true) // Only flag TRUE values, not false
      )
      
      if (hasYouTubeMetadata) {
        contaminatedCount++
        console.warn(`🚨 [UnifiedMediaContext] CONTAMINATED MEDIA IN CACHE!`)
        console.warn(`   Media ID: ${item.id}`)
        console.warn(`   Type: ${item.type} (should NOT have YouTube metadata)`)
        console.warn(`   Page: ${pageId}`)
        console.warn(`   Contaminated fields:`, {
          source: item.metadata?.source,
          isYouTube: item.metadata?.isYouTube,
          hasYouTubeUrl: !!item.metadata?.youtubeUrl,
          hasEmbedUrl: !!item.metadata?.embedUrl,
          hasClipTiming: !!(item.metadata?.clipStart || item.metadata?.clipEnd)
        })
        console.warn('   🔧 This contaminated data will cause UI issues!')
      }
    }
    
    if (contaminatedCount > 0) {
      console.warn(`🚨 [UnifiedMediaContext] Found ${contaminatedCount} contaminated items for page ${pageId}`)
      console.warn('   📊 Page media summary:')
      const typeCounts: Record<string, number> = {}
      allMediaForPage.forEach(item => {
        typeCounts[item.type] = (typeCounts[item.type] || 0) + 1
      })
      console.warn(`   Types: ${JSON.stringify(typeCounts)}`)
    }
    
    // 🔧 FIX INFINITE LOOP: Return all cached media without async existence checks
    // The expensive async existence checks were causing infinite re-renders by:
    // 1. Making async calls to getMedia() for every item on every render
    // 2. Modifying mediaCache during iteration (cache.delete) 
    // 3. Triggering useCallback dependency changes → PageThumbnailGrid re-render loop
    // Components should handle non-existent media gracefully instead
    logger.log(`[UnifiedMediaContext] Returning ${allMediaForPage.length} cached media items for page ${pageId}`)
    
    return allMediaForPage
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

  const updateMedia = useCallback(async (
    existingId: string,
    file: File | Blob,
    metadata?: Partial<MediaMetadata>,
    progressCallback?: ProgressCallback
  ): Promise<MediaItem> => {
    try {
      const mediaService = mediaServiceRef.current
      if (!mediaService) {
        throw new Error('Media service not initialized')
      }
      
      const updatedItem = await mediaService.updateMedia(existingId, file, metadata, progressCallback)
      
      // Update cache with the updated media item (same ID, new content)
      setMediaCache(prev => {
        const updated = new Map(prev)
        updated.set(updatedItem.id, updatedItem)
        return updated
      })
      
      // Clear any existing blob URL for this media since the content changed
      blobCache.revoke(existingId)
      
      return updatedItem
    } catch (err) {
      logger.error('[UnifiedMediaContext] Failed to update media:', existingId, err)
      setError(err as Error)
      throw err
    }
  }, [blobCache])
  
  const value = useMemo<UnifiedMediaContextType>(() => ({
    storeMedia,
    updateMedia,
    getMedia,
    deleteMedia,
    deleteAllMedia,
    storeYouTubeVideo,
    updateYouTubeVideoMetadata,
    getMediaForPage,
    getValidMediaForPage,
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
    refreshMedia,
    resetMediaCache,
    populateFromCourseContent,
    cleanContaminatedMedia
  }), [
    storeMedia,
    updateMedia,
    getMedia,
    deleteMedia,
    deleteAllMedia,
    storeYouTubeVideo,
    updateYouTubeVideoMetadata,
    getMediaForPage,
    getValidMediaForPage,
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
    refreshMedia,
    resetMediaCache,
    populateFromCourseContent,
    cleanContaminatedMedia
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

