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

// RENDER LOOP FIX: One-shot contamination warning cache to prevent spam
// Track media IDs that have already been cleaned to prevent duplicate warnings
const cleanedOnce = new Set<string>()

// PERFORMANCE OPTIMIZATION: Loading profiles for step-specific optimization
type LoadingProfile = 'visual-only' | 'all'

// PERFORMANCE OPTIMIZATION: Idle contamination cleanup to avoid blocking UI
const scheduleIdleCleanup = (id: string, cleanupFn: () => Promise<void>) => {
  if (cleanedOnce.has(id)) return
  cleanedOnce.add(id)
  
  const idleCallback = (window as any).requestIdleCallback || ((fn: () => void) => setTimeout(fn, 1500))
  idleCallback(cleanupFn)
}

export interface UnifiedMediaContextType {
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
  getValidMediaForPage: (pageId: string, opts?: { types?: Array<'image' | 'video' | 'youtube'>; verifyExistence?: boolean }) => Promise<MediaItem[]>  // Defensive version that validates existence
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
  
  // Performance optimization
  loadingProfile: LoadingProfile
  setLoadingProfile: (profile: LoadingProfile) => void
  
  // Cache management
  resetMediaCache: () => void
  populateFromCourseContent: (mediaItems: any[], pageId: string) => Promise<void>
  
  // Cleanup utilities
  cleanContaminatedMedia: () => Promise<{ cleaned: string[], errors: string[] }>
  
  // LOADING COORDINATION: Critical media loading completion callback
  onCriticalMediaLoaded?: () => void
  setCriticalMediaLoadingCallback: (callback?: () => void) => void
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

// 🚀 PROGRESSIVE LOADING: Load remaining media in prioritized batches after critical media
async function progressivelyLoadRemainingMedia(
  allMedia: MediaItem[],
  criticalMediaIds: string[],
  mediaService: MediaService,
  blobCache: BlobURLCache,
  profile: LoadingProfile = 'all'
) {
  console.log('[ProgressiveLoader] 🚀 Starting intelligent progressive media loading...')
  console.log(`[ProgressiveLoader] 🔍 PROFILE DEBUG: Received profile="${profile}"`)
  
  // Filter out already loaded critical media
  const baseRemainingMedia = allMedia.filter(item => !criticalMediaIds.includes(item.id))
  
  // EMERGENCY DEBUG: Log all items before filtering
  console.log(`[ProgressiveLoader] 📊 BEFORE FILTERING: ${baseRemainingMedia.length} items:`)
  baseRemainingMedia.forEach((item, i) => {
    if (i < 10) { // Limit logging to first 10 items
      console.log(`  - ${item.id} (${item.type})`)
    }
  })
  if (baseRemainingMedia.length > 10) {
    console.log(`  ... and ${baseRemainingMedia.length - 10} more items`)
  }
  
  // 🔧 FIX 4: FORCE PROGRESSIVE LOADER TO RESPECT VISUAL-ONLY PROFILE
  // Enhanced filtering with emergency circuit breaker
  const remainingMedia = profile === 'visual-only'
    ? baseRemainingMedia.filter(item => {
        const isVisual = item.type === 'image' || item.type === 'video' || item.type === 'youtube'
        
        // EMERGENCY CIRCUIT BREAKER: Block ALL audio/caption items
        const isBlockedType = item.type === 'audio' || item.type === 'caption'
        if (isBlockedType) {
          console.log(`[ProgressiveLoader] 🚫 FIX 4: EMERGENCY BLOCK - ${item.id} (${item.type}) blocked in visual-only mode`)
          return false
        }
        
        if (!isVisual) {
          console.log(`[ProgressiveLoader] 🚫 VISUAL-ONLY: Excluding ${item.id} (${item.type})`)
        }
        return isVisual
      })
    : baseRemainingMedia
    
  console.log(`[ProgressiveLoader] Profile: ${profile}, Filtering ${baseRemainingMedia.length} → ${remainingMedia.length} items`)
  
  // EMERGENCY DEBUG: Log what's still in the list after filtering
  console.log(`[ProgressiveLoader] 📊 AFTER FILTERING: ${remainingMedia.length} items to load:`)
  remainingMedia.forEach(item => {
    console.log(`  ✅ ${item.id} (${item.type})`)
  })
  
  if (remainingMedia.length === 0) {
    console.log('[ProgressiveLoader] ✅ No remaining media to load after profile filtering')
    return
  }
  
  console.log(`[ProgressiveLoader] 📋 ${remainingMedia.length} media items to progressively load`)
  
  // 🎯 INTELLIGENT PRIORITIZATION ALGORITHM
  const prioritizedBatches = prioritizeMediaForLoading(remainingMedia, profile)
  
  // Load each batch with delays between them
  for (let i = 0; i < prioritizedBatches.length; i++) {
    const batch = prioritizedBatches[i]
    const batchName = getBatchName(i)
    
    console.log(`[ProgressiveLoader] 🔄 Loading ${batchName} (${batch.length} items)...`)
    
    // 🔧 FIX 4: PROGRESSIVE LOADER TIMING FIX
    // Validate profile before each batch to prevent race conditions
    console.log(`[ProgressiveLoader] 🔧 FIX 4: Pre-batch profile validation - current: "${profile}"`)
    
    if (profile === 'visual-only') {
      // Double-check that this batch contains only visual items
      const nonVisualItems = batch.filter(item => !(item.type === 'image' || item.type === 'video' || item.type === 'youtube'))
      if (nonVisualItems.length > 0) {
        console.log(`[ProgressiveLoader] 🚨 FIX 4: ABORT - Found ${nonVisualItems.length} non-visual items in visual-only batch:`)
        nonVisualItems.forEach(item => console.log(`  - ${item.id} (${item.type})`))
        console.log('[ProgressiveLoader] 🚨 FIX 4: Skipping contaminated batch to prevent audio/caption loading')
        continue
      }
    }
    
    try {
      // Load batch in parallel
      const batchIds = batch.map(item => item.id)
      console.log(`[ProgressiveLoader] 🔧 FIX 4: Processing batch with items: ${batchIds.join(', ')}`)
      
      const preloadedUrls = await blobCache.preloadMedia(batchIds, async (id) => {
        // 🔧 FIX 4: Final safety check before individual item loading
        if (profile === 'visual-only' && (id.startsWith('audio-') || id.startsWith('caption-'))) {
          console.log(`[ProgressiveLoader] 🚫 FIX 4: Emergency block - refusing to load ${id} in visual-only mode`)
          return null
        }
        
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
      console.log(`[ProgressiveLoader] ✅ ${batchName} loaded: ${successCount}/${batch.length} items`)
      
    } catch (error) {
      console.warn(`[ProgressiveLoader] ⚠️ ${batchName} failed:`, error)
    }
    
    // Add delay between batches to not overwhelm the system
    if (i < prioritizedBatches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // 1s between batches
    }
  }
  
  console.log('[ProgressiveLoader] 🎉 Progressive loading completed!')
}

// 🎯 PRIORITIZATION ALGORITHM: Sort media by importance for user experience  
function prioritizeMediaForLoading(remainingMedia: MediaItem[], profile: LoadingProfile = 'all'): MediaItem[][] {
  const batches: MediaItem[][] = []
  
  // 🔧 FIX 4: Skip audio/caption batching in visual-only mode
  if (profile === 'visual-only') {
    console.log(`[ProgressiveLoader] 🔧 FIX 4: Visual-only mode - creating single batch of ${remainingMedia.length} visual items`)
    
    // In visual-only mode, just group all visual media into priority batches
    const visualMedia = remainingMedia.filter(item => 
      item.type === 'image' || item.type === 'video' || item.type === 'youtube'
    )
    
    if (visualMedia.length > 0) {
      // Split visual media into smaller batches for better UX
      const batchSize = 5
      for (let i = 0; i < visualMedia.length; i += batchSize) {
        const batch = visualMedia.slice(i, i + batchSize)
        batches.push(batch)
      }
    }
    
    return batches
  }
  
  // NOTE: Profile filtering now happens in progressivelyLoadRemainingMedia before this function is called
  
  // HIGH PRIORITY BATCH: Audio from welcome/objectives (immediate user needs)
  const highPriority = remainingMedia.filter(item => 
    item.type === 'audio' && 
    (item.pageId === 'welcome' || item.pageId === 'objectives')
  )
  if (highPriority.length > 0) batches.push(highPriority)
  
  // MEDIUM PRIORITY BATCH: Visual media from early topics (likely to be seen soon)
  const mediumPriority = remainingMedia.filter(item => 
    !highPriority.includes(item) &&
    (item.type === 'image' || item.type === 'video') &&
    item.pageId?.startsWith('topic-') &&
    getTopicNumber(item.pageId) <= 3 // First 3 topics
  )
  if (mediumPriority.length > 0) batches.push(mediumPriority)
  
  // AUDIO PRIORITY BATCH: Audio from early topics
  const audioPriority = remainingMedia.filter(item => 
    !highPriority.includes(item) &&
    item.type === 'audio' &&
    item.pageId?.startsWith('topic-') &&
    getTopicNumber(item.pageId) <= 5 // First 5 topics
  )
  if (audioPriority.length > 0) batches.push(audioPriority)
  
  // LOW PRIORITY BATCH: Everything else (later topics, captions, etc.)
  const lowPriority = remainingMedia.filter(item => 
    !highPriority.includes(item) &&
    !mediumPriority.includes(item) &&
    !audioPriority.includes(item)
  )
  if (lowPriority.length > 0) batches.push(lowPriority)
  
  return batches
}

// Helper functions
function getBatchName(batchIndex: number): string {
  const names = ['High Priority', 'Medium Priority', 'Audio Priority', 'Low Priority']
  return names[batchIndex] || `Batch ${batchIndex + 1}`
}

function getTopicNumber(pageId: string): number {
  const match = pageId.match(/topic-(\d+)/)
  return match ? parseInt(match[1], 10) : 999
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
  const [loadingProfile, setLoadingProfile] = useState<LoadingProfile>('all')
  
  // 🔧 FIX 5: ULTIMATE CIRCUIT BREAKER - Set global flag for MediaService blocking
  useEffect(() => {
    const isVisualOnly = loadingProfile === 'visual-only'
    globalThis._scormBuilderVisualOnlyMode = isVisualOnly
    console.log(`[UnifiedMediaContext] 🔧 FIX 5: Setting global visual-only flag: ${isVisualOnly}`)
  }, [loadingProfile])
  
  // Track media loads to prevent infinite reloading
  const hasLoadedRef = useRef<Set<string>>(new Set())
  
  // LOADING COORDINATION: Critical media loading callback
  const [criticalMediaLoadingCallback, setCriticalMediaLoadingCallback] = useState<(() => void) | undefined>()
  
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
    
    // 🔧 FIX 3: PREVENT MULTIPLE MEDIASERVICE INITIALIZATIONS
    // Only create a new MediaService if we don't have one or the project ID changed
    if (!mediaServiceRef.current || lastLoadedProjectIdRef.current !== actualProjectId) {
      console.log(`🔧 [UnifiedMediaContext] FIX 3: Creating MediaService for project ${actualProjectId} (previous: ${lastLoadedProjectIdRef.current})`)
      const newService = createMediaService(actualProjectId, storage.fileStorage)
      mediaServiceRef.current = newService
      console.log(`✅ [UnifiedMediaContext] FIX 3: MediaService created/reused for project ${actualProjectId}`)
    } else {
      console.log(`♻️  [UnifiedMediaContext] FIX 3: Reusing existing MediaService for project ${actualProjectId}`)
    }
    
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
      
      // 🚀 FIX 6: SMART BACKEND CALL PREVENTION (UPGRADED)
      // Pass excludeTypes directly to MediaService to prevent backend scanning unwanted files
      const isVisualOnly = loadingProfile === 'visual-only'
      const excludeTypes = isVisualOnly ? ['audio', 'caption'] : []
      
      console.log(`[UnifiedMediaContext] 🚀 FIX 6: Calling MediaService.listAllMedia() with smart filtering:`, {
        loadingProfile,
        isVisualOnly,
        excludeTypes
      })
      
      // Now get media with smart backend filtering - this prevents unwanted backend scanning
      const allMedia = await mediaService.listAllMedia({ excludeTypes })
      
      console.log(`[UnifiedMediaContext] 🚀 FIX 6: MediaService returned ${allMedia.length} items after smart backend filtering`)
      
      // Legacy filtering logic (now redundant but kept for safety)
      // The filtering should already be done by MediaService, but double-check
      const finalMedia = isVisualOnly 
        ? allMedia.filter(item => {
            const isVisual = item.type === 'image' || item.type === 'video' || item.type === 'youtube'
            if (!isVisual) {
              console.log(`[UnifiedMediaContext] 🚨 UNEXPECTED: Found non-visual item after MediaService filtering: ${item.id} (${item.type})`)
            }
            return isVisual
          })
        : allMedia
        
      if (isVisualOnly && finalMedia.length !== allMedia.length) {
        console.log(`[UnifiedMediaContext] 🚨 MediaService filtering may not be working - had to filter ${allMedia.length - finalMedia.length} additional items`)
      } else if (isVisualOnly) {
        console.log(`[UnifiedMediaContext] ✅ FIX 6: Perfect filtering - all ${allMedia.length} items were visual media`)
      }
      
      console.log(`🔍 [DEBUG] MediaService.listAllMedia() returned ${allMedia.length} items after backend filtering, final count: ${finalMedia.length}:`)
      finalMedia.forEach(item => {
        console.log(`🔍 [DEBUG] MediaService item: ${item.id} → pageId: '${item.pageId}', type: '${item.type}'`)
      })
      
      const newCache = new Map<string, MediaItem>()
      finalMedia.forEach(item => {
        newCache.set(item.id, item)
      })
      setMediaCache(newCache)
      console.log(`🔍 [DEBUG] Updated cache with ${finalMedia.length} items from MediaService`)
      logger.info('[UnifiedMediaContext] Loaded', finalMedia.length, 'media items')
      
      // 🚀 STARTUP PERFORMANCE FIX: Replace aggressive preloading with lazy loading
      if (finalMedia.length > 0) {
        logger.info('[UnifiedMediaContext] ✅ Media catalog loaded with', finalMedia.length, 'items (lazy loading enabled)')
        
        // 🚀 NEW APPROACH: Only preload critical media (images/videos for welcome page)
        const criticalMediaIds = finalMedia
          .filter(item => {
            // Only preload visual media for the welcome page (user sees first)
            const isCritical = item.pageId === 'welcome' && 
                              (item.type === 'image' || item.type === 'video') &&
                              item.id && item.id !== ''
            
            if (isCritical) {
              console.log(`[UnifiedMediaContext] 🎯 Marking as critical for preload: ${item.id} (${item.type})`)
            }
            
            return isCritical
          })
          .map(item => item.id)
        
        if (criticalMediaIds.length > 0) {
          logger.info('[UnifiedMediaContext] 🚀 Preloading', criticalMediaIds.length, 'critical media items...')
          
          // Preload only critical media in background
          setTimeout(async () => {
            try {
              const preloadedUrls = await blobCache.preloadMedia(criticalMediaIds, async (id) => {
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
              logger.info('[UnifiedMediaContext] ✅ Preloaded', successCount, 'critical media items')
              
              // LOADING COORDINATION: Notify that critical media loading is complete
              if (criticalMediaLoadingCallback) {
                logger.info('[UnifiedMediaContext] 🔔 Notifying that critical media loading is complete')
                criticalMediaLoadingCallback()
              }
              
            } catch (error) {
              logger.warn('[UnifiedMediaContext] Critical media preloading failed:', error)
              
              // Still notify callback even on error so loading doesn't hang
              if (criticalMediaLoadingCallback) {
                logger.info('[UnifiedMediaContext] 🔔 Notifying callback despite preload error')
                criticalMediaLoadingCallback()
              }
            }
          }, 100) // Small delay to not block UI
        } else {
          logger.info('[UnifiedMediaContext] 💡 No critical media found, full lazy loading mode')
          
          // LOADING COORDINATION: Still notify callback if no critical media to preload
          if (criticalMediaLoadingCallback) {
            logger.info('[UnifiedMediaContext] 🔔 Notifying callback (no critical media to load)')
            // Small delay to match the preload timing
            setTimeout(() => {
              criticalMediaLoadingCallback()
            }, 100)
          }
        }
        
        // 🔧 FIX 2: ENHANCED REFRESHMEDIA CIRCUIT BREAKER
        // Check loading profile before starting progressive loading
        setTimeout(async () => {
          try {
            console.log(`[UnifiedMediaContext] 🔧 FIX 2: RefreshMedia circuit breaker - current profile: "${loadingProfile}"`)
            
            if (loadingProfile === 'visual-only') {
              console.log('[UnifiedMediaContext] 🚫 FIX 2: Visual-only mode detected - filtering media before progressive loading')
              
              // Filter out audio/caption items before progressive loading
              const visualOnlyMedia = allMedia.filter(item => {
                const isVisual = item.type === 'image' || item.type === 'video' || item.type === 'youtube'
                if (!isVisual) {
                  console.log(`[UnifiedMediaContext] 🚫 FIX 2: Circuit breaker excluding ${item.id} (${item.type}) from progressive loading`)
                }
                return isVisual
              })
              
              console.log(`[UnifiedMediaContext] 🔧 FIX 2: Circuit breaker filtered ${allMedia.length} → ${visualOnlyMedia.length} items`)
              await progressivelyLoadRemainingMedia(visualOnlyMedia, criticalMediaIds, mediaService, blobCache, loadingProfile)
            } else {
              console.log('[UnifiedMediaContext] 🔧 FIX 2: Full loading mode - proceeding with all media types')
              await progressivelyLoadRemainingMedia(allMedia, criticalMediaIds, mediaService, blobCache, loadingProfile)
            }
          } catch (error) {
            logger.warn('[UnifiedMediaContext] Progressive loading failed:', error)
          }
        }, 2000) // 2 second delay to ensure UI is interactive
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
      // 🔧 FIX 5: EMERGENCY CIRCUIT BREAKER for audio/caption IDs in visual-only mode
      if (loadingProfile === 'visual-only') {
        // Check if this is an audio or caption ID by pattern
        const isAudioOrCaption = mediaId.startsWith('audio-') || mediaId.startsWith('caption-')
        if (isAudioOrCaption) {
          console.log(`🚫 [UnifiedMediaContext] FIX 5: EMERGENCY CIRCUIT BREAKER - Blocking getMedia(${mediaId}) in visual-only mode`)
          return null
        }
      }
      
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
  }, [loadingProfile])
  
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
  
  const getValidMediaForPage = useCallback(async (
    pageId: string, 
    opts?: { types?: Array<'image' | 'video' | 'youtube'>; verifyExistence?: boolean }
  ): Promise<MediaItem[]> => {
    // Apply page ID mapping for learning objectives (same logic as rustScormGenerator)
    const normalizedPageIds = [pageId]
    if (pageId === 'learning-objectives' || pageId === 'content-1') {
      normalizedPageIds.push('objectives') // Also match 'objectives' pageId
    } else if (pageId === 'objectives') {
      normalizedPageIds.push('learning-objectives', 'content-1') // Also match these variations
    }
    
    const allMediaForPage = Array.from(mediaCache.values()).filter(item => 
      normalizedPageIds.includes(item.pageId)
    )
    
    // PERFORMANCE OPTIMIZATION: Apply type filtering early to minimize processing
    let filteredMediaForPage = allMediaForPage
    
    // Filter by media types if specified - EARLY FILTERING for performance
    if (opts?.types && opts.types.length > 0) {
      filteredMediaForPage = allMediaForPage.filter(item => 
        opts.types!.includes(item.type as 'image' | 'video' | 'youtube')
      )
      console.log(`🔧 [UnifiedMediaContext] Visual-only filtering: ${allMediaForPage.length} → ${filteredMediaForPage.length} items (types: ${opts.types.join(', ')}) for page ${pageId}`)
    }
    
    // LIGHTWEIGHT MODE: Early return if no existence verification needed
    // This prevents expensive getMedia() calls for audio/caption files during Media step
    if (opts?.verifyExistence === false) {
      console.log(`🚀 [UnifiedMediaContext] Lightweight mode: Returning ${filteredMediaForPage.length} cached media items for page ${pageId}`)
      return filteredMediaForPage
    }
    
    // DEBUG logging (only when not in lightweight mode to reduce noise)
    console.log(`🔍 [UnifiedMediaContext] getValidMediaForPage('${pageId}') - Full verification mode:`)
    console.log(`   Items matching pageId '${pageId}': ${allMediaForPage.length}`)
    if (filteredMediaForPage.length > 0) {
      console.log(`   Filtered items:`, filteredMediaForPage.map(item => ({
        id: item.id,
        type: item.type,
        pageId: item.pageId
      })))
    }
    
    // 🚨 FIX 2: DISABLE CONTAMINATION DETECTION ON MEDIA STEP
    // Only run contamination detection if NOT in visual-only mode (when types filter is present)
    const isVisualOnlyMode = opts?.types && opts.types.length > 0 && 
                             opts.types.every(type => ['image', 'video', 'youtube'].includes(type))
    
    if (!isVisualOnlyMode) {
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
          
          // PERFORMANCE OPTIMIZATION: Schedule cleanup during idle time to avoid blocking UI
          scheduleIdleCleanup(item.id, async () => {
            console.warn(`🚨 [UnifiedMediaContext] CONTAMINATED MEDIA IN CACHE! (Deferred)`)
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
          })
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
    } else {
      console.log(`🔕 [UnifiedMediaContext] FIX 2: Skipping contamination detection - visual-only mode detected for page ${pageId}`)
    }
    
    // 🔧 FIX INFINITE LOOP: Return all cached media without async existence checks
    // The expensive async existence checks were causing infinite re-renders by:
    // 1. Making async calls to getMedia() for every item on every render
    // 2. Modifying mediaCache during iteration (cache.delete) 
    // 3. Triggering useCallback dependency changes → PageThumbnailGrid re-render loop
    // Components should handle non-existent media gracefully instead
    logger.log(`[UnifiedMediaContext] Returning ${filteredMediaForPage.length} cached media items for page ${pageId}`)
    
    return filteredMediaForPage
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
    cleanContaminatedMedia,
    setCriticalMediaLoadingCallback: setCriticalMediaLoadingCallback,
    loadingProfile,
    setLoadingProfile
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
    cleanContaminatedMedia,
    setCriticalMediaLoadingCallback,
    setLoadingProfile
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

