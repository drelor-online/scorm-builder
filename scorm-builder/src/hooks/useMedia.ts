/**
 * Single Media Façade Hook
 * 
 * AUDIT FIX: Consolidates media state management behind a single, clean API
 * 
 * This hook addresses the audit finding of "state sprawl" by providing:
 * - Read-only selectors for media state
 * - Imperative actions for media operations  
 * - Consolidated error handling
 * - Performance optimizations with progressive loading
 * 
 * Replaces direct usage of UnifiedMediaContext + MediaService in components.
 */

import { useCallback, useMemo } from 'react'
import { useUnifiedMedia } from '../contexts/UnifiedMediaContext'
import type { MediaType } from '../utils/idGenerator'
import type { MediaItem, MediaMetadata, ProgressCallback } from '../services/MediaService'
import { MediaCleanupService, comprehensiveMediaCleanup } from '../services/MediaCleanupService'
import type { CleanupResult, ComprehensiveCleanupResult, CleanupOptions } from '../services/MediaCleanupService'
import type { CourseContent } from '../types/aiPrompt'

// ============================================================================
// READ-ONLY SELECTORS
// ============================================================================

export interface MediaSelectors {
  // Page-specific media queries
  getMediaForPage: (pageId: string) => MediaItem[]
  getValidMediaForPage: (pageId: string, opts?: { 
    types?: Array<'image' | 'video' | 'youtube'> 
    verifyExistence?: boolean 
  }) => Promise<MediaItem[]>
  
  // Individual media queries
  getMedia: (mediaId: string) => Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null>
  getMediaById: (mediaId: string) => MediaItem | undefined
  getAllMedia: () => MediaItem[]
  
  // Cache queries
  hasAudioCached: (mediaId: string) => boolean
  getCachedAudio: (mediaId: string) => { data: Uint8Array; metadata: MediaMetadata } | null
  
  // State queries
  isLoading: boolean
  error: Error | null
  loadingProfile: 'visual-only' | 'all'
}

// ============================================================================
// IMPERATIVE ACTIONS
// ============================================================================

export interface MediaActions {
  // Core operations
  storeMedia: (file: File | Blob, pageId: string, type: MediaType, metadata?: Partial<MediaMetadata>, progressCallback?: ProgressCallback) => Promise<MediaItem>
  updateMedia: (existingId: string, file: File | Blob, metadata?: Partial<MediaMetadata>, progressCallback?: ProgressCallback) => Promise<MediaItem>
  deleteMedia: (mediaId: string) => Promise<boolean>
  deleteAllMedia: (projectId: string) => Promise<void>
  
  // YouTube operations
  storeYouTubeVideo: (youtubeUrl: string, embedUrl: string, pageId: string, metadata?: Partial<MediaMetadata>) => Promise<MediaItem>
  updateYouTubeVideoMetadata: (mediaId: string, updates: Partial<Pick<MediaMetadata, 'clipStart' | 'clipEnd' | 'title' | 'embedUrl'>>) => Promise<MediaItem>
  
  // URL management
  createBlobUrl: (mediaId: string) => Promise<string | null>
  revokeBlobUrl: (url: string) => void
  
  // System operations
  refreshMedia: () => Promise<void>
  setLoadingProfile: (profile: 'visual-only' | 'all') => void
  clearError: () => void
  setBulkOperation: (isBulk: boolean) => void
  clearAudioFromCache: (mediaId: string) => void
  resetMediaCache: () => void
  
  // Advanced operations
  populateFromCourseContent: (mediaItems: any[], pageId: string) => Promise<void>
  setCriticalMediaLoadingCallback: (callback?: () => void) => void
  
  // AUDIT FIX: Integrated MediaCleanupService operations
  cleanupOrphanedMedia: (courseContent: CourseContent | null, options?: Partial<CleanupOptions>) => Promise<CleanupResult>
  cleanupContaminatedMedia: (courseContent: CourseContent | null, options?: Partial<CleanupOptions>) => Promise<CleanupResult>
  cleanupDuplicateMedia: (courseContent: CourseContent | null, options?: Partial<CleanupOptions>) => Promise<CleanupResult>
  comprehensiveCleanup: (courseContent: CourseContent | null, options?: Partial<CleanupOptions>) => Promise<ComprehensiveCleanupResult>
  
  // Legacy cleanup (maintained for backward compatibility)
  cleanContaminatedMediaLegacy: () => Promise<{ cleaned: string[], errors: string[] }>
}

// ============================================================================
// UNIFIED MEDIA HOOK
// ============================================================================

export interface UseMediaReturn {
  // Separated concerns for better API design
  selectors: MediaSelectors
  actions: MediaActions
  
  // Convenience: Direct access to most common operations
  getMediaForPage: MediaSelectors['getMediaForPage']
  storeMedia: MediaActions['storeMedia']
  createBlobUrl: MediaActions['createBlobUrl']
  isLoading: boolean
  error: Error | null
}

/**
 * Main media façade hook
 * 
 * Usage examples:
 * ```tsx
 * const media = useMedia()
 * 
 * // Read-only queries (encouraged)
 * const pageMedia = media.selectors.getMediaForPage('welcome')
 * const isLoading = media.selectors.isLoading
 * 
 * // Imperative actions
 * await media.actions.storeMedia(file, pageId, 'image')
 * await media.actions.refreshMedia()
 * 
 * // Convenience shortcuts for common operations
 * const url = await media.createBlobUrl(mediaId)
 * ```
 */
export function useMedia(): UseMediaReturn {
  const context = useUnifiedMedia()
  
  if (!context) {
    throw new Error('useMedia must be used within UnifiedMediaProvider')
  }
  
  // ============================================================================
  // MEMOIZED SELECTORS (prevent unnecessary re-renders)
  // ============================================================================
  
  const selectors: MediaSelectors = useMemo(() => ({
    getMediaForPage: context.getMediaForPage,
    getValidMediaForPage: context.getValidMediaForPage,
    getMedia: context.getMedia,
    getMediaById: context.getMediaById,
    getAllMedia: context.getAllMedia,
    hasAudioCached: context.hasAudioCached,
    getCachedAudio: context.getCachedAudio,
    isLoading: context.isLoading,
    error: context.error,
    loadingProfile: context.loadingProfile,
  }), [
    context.getMediaForPage,
    context.getValidMediaForPage,
    context.getMedia,
    context.getMediaById,
    context.getAllMedia,
    context.hasAudioCached,
    context.getCachedAudio,
    context.isLoading,
    context.error,
    context.loadingProfile,
  ])
  
  // ============================================================================
  // MEMOIZED ACTIONS (prevent unnecessary re-renders)
  // ============================================================================
  
  // ============================================================================
  // MEDIA CLEANUP SERVICE INTEGRATION
  // ============================================================================
  
  const createMediaExistsChecker = useCallback(async (mediaId: string): Promise<boolean> => {
    try {
      const media = context.getMediaById(mediaId)
      return !!media
    } catch (error) {
      return false
    }
  }, [context.getMediaById])
  
  const cleanupServiceActions = useMemo(() => ({
    cleanupOrphanedMedia: async (courseContent: CourseContent | null, options: Partial<CleanupOptions> = {}): Promise<CleanupResult> => {
      const cleanupService = new MediaCleanupService(createMediaExistsChecker, context.resetMediaCache)
      const result = await cleanupService.cleanup(courseContent, { strategy: 'orphaned', ...options })
      
      // Refresh media after cleanup
      await context.refreshMedia()
      
      // Type guard
      if ('overall' in result && 'results' in result && 'summary' in result) {
        throw new Error('Unexpected comprehensive result for orphaned cleanup')
      }
      return result as CleanupResult
    },
    
    cleanupContaminatedMedia: async (courseContent: CourseContent | null, options: Partial<CleanupOptions> = {}): Promise<CleanupResult> => {
      const cleanupService = new MediaCleanupService(createMediaExistsChecker, context.resetMediaCache)
      const result = await cleanupService.cleanup(courseContent, { 
        strategy: 'contaminated', 
        validateSchema: true,
        ...options 
      })
      
      // Refresh media after cleanup
      await context.refreshMedia()
      
      // Type guard
      if ('overall' in result && 'results' in result && 'summary' in result) {
        throw new Error('Unexpected comprehensive result for contaminated cleanup')
      }
      return result as CleanupResult
    },
    
    cleanupDuplicateMedia: async (courseContent: CourseContent | null, options: Partial<CleanupOptions> = {}): Promise<CleanupResult> => {
      const cleanupService = new MediaCleanupService(createMediaExistsChecker, context.resetMediaCache)
      const result = await cleanupService.cleanup(courseContent, { strategy: 'duplicates', ...options })
      
      // Refresh media after cleanup
      await context.refreshMedia()
      
      // Type guard
      if ('overall' in result && 'results' in result && 'summary' in result) {
        throw new Error('Unexpected comprehensive result for duplicate cleanup')
      }
      return result as CleanupResult
    },
    
    comprehensiveCleanup: async (courseContent: CourseContent | null, options: Partial<CleanupOptions> = {}): Promise<ComprehensiveCleanupResult> => {
      const result = await comprehensiveMediaCleanup(
        courseContent,
        createMediaExistsChecker,
        context.resetMediaCache,
        { includeCache: true, validateSchema: true, ...options }
      )
      
      // Refresh media after cleanup
      await context.refreshMedia()
      
      return result
    }
  }), [createMediaExistsChecker, context.resetMediaCache, context.refreshMedia])

  const actions: MediaActions = useMemo(() => ({
    // Core operations with schema normalization
    storeMedia: context.storeMedia,
    updateMedia: context.updateMedia,
    deleteMedia: context.deleteMedia,
    deleteAllMedia: context.deleteAllMedia,
    
    // YouTube operations
    storeYouTubeVideo: context.storeYouTubeVideo,
    updateYouTubeVideoMetadata: context.updateYouTubeVideoMetadata,
    
    // URL management
    createBlobUrl: context.createBlobUrl,
    revokeBlobUrl: context.revokeBlobUrl,
    
    // System operations
    refreshMedia: context.refreshMedia,
    setLoadingProfile: context.setLoadingProfile,
    clearError: context.clearError,
    setBulkOperation: context.setBulkOperation,
    clearAudioFromCache: context.clearAudioFromCache,
    resetMediaCache: context.resetMediaCache,
    
    // Advanced operations
    populateFromCourseContent: context.populateFromCourseContent,
    setCriticalMediaLoadingCallback: context.setCriticalMediaLoadingCallback,
    
    // AUDIT FIX: Integrated MediaCleanupService operations
    ...cleanupServiceActions,
    
    // Legacy cleanup (maintained for backward compatibility)
    cleanContaminatedMediaLegacy: context.cleanContaminatedMedia,
  }), [
    context.storeMedia,
    context.updateMedia,
    context.deleteMedia,
    context.deleteAllMedia,
    context.storeYouTubeVideo,
    context.updateYouTubeVideoMetadata,
    context.createBlobUrl,
    context.revokeBlobUrl,
    context.refreshMedia,
    context.setLoadingProfile,
    context.clearError,
    context.setBulkOperation,
    context.clearAudioFromCache,
    context.resetMediaCache,
    context.populateFromCourseContent,
    context.setCriticalMediaLoadingCallback,
    context.cleanContaminatedMedia,
    cleanupServiceActions,
  ])
  
  // ============================================================================
  // CONVENIENCE SHORTCUTS (most common operations)
  // ============================================================================
  
  const getMediaForPage = useCallback((pageId: string) => {
    return context.getMediaForPage(pageId)
  }, [context.getMediaForPage])
  
  const storeMediaWithNormalization = useCallback(async (
    file: File | Blob, 
    pageId: string, 
    type: MediaType, 
    metadata?: Partial<MediaMetadata>, 
    progressCallback?: ProgressCallback
  ): Promise<MediaItem> => {
    return await context.storeMedia(file, pageId, type, metadata, progressCallback)
  }, [context.storeMedia])
  
  const createBlobUrlSafe = useCallback(async (mediaId: string): Promise<string | null> => {
    try {
      return await context.createBlobUrl(mediaId)
    } catch (error) {
      console.error('[useMedia] Failed to create blob URL:', error)
      return null
    }
  }, [context.createBlobUrl])
  
  // ============================================================================
  // RETURN INTERFACE
  // ============================================================================
  
  return {
    selectors,
    actions,
    
    // Convenience shortcuts with normalization
    getMediaForPage,
    storeMedia: storeMediaWithNormalization,
    createBlobUrl: createBlobUrlSafe,
    
    // Direct state access for common usage
    isLoading: context.isLoading,
    error: context.error,
  }
}

// ============================================================================
// SPECIALIZED HOOKS FOR SPECIFIC USE CASES
// ============================================================================

/**
 * Hook for components that only need to read media data
 */
export function useMediaSelectors(): MediaSelectors {
  const { selectors } = useMedia()
  return selectors
}

/**
 * Hook for components that only need to perform media actions
 */
export function useMediaActions(): MediaActions {
  const { actions } = useMedia()
  return actions
}

/**
 * Hook for page-specific media operations
 */
export function usePageMedia(pageId: string) {
  const media = useMedia()
  
  const pageMedia = useMemo(() => 
    media.selectors.getMediaForPage(pageId), 
    [media.selectors.getMediaForPage, pageId]
  )
  
  const getValidMedia = useCallback((opts?: { 
    types?: Array<'image' | 'video' | 'youtube'> 
    verifyExistence?: boolean 
  }) => {
    return media.selectors.getValidMediaForPage(pageId, opts)
  }, [media.selectors.getValidMediaForPage, pageId])
  
  const storeMediaForPage = useCallback((
    file: File | Blob, 
    type: MediaType, 
    metadata?: Partial<MediaMetadata>, 
    progressCallback?: ProgressCallback
  ) => {
    return media.actions.storeMedia(file, pageId, type, metadata, progressCallback)
  }, [media.actions.storeMedia, pageId])
  
  return {
    pageMedia,
    getValidMedia,
    storeMediaForPage,
    isLoading: media.selectors.isLoading,
    error: media.selectors.error,
  }
}

// ============================================================================
// NOTE: All types are already exported inline above
// ============================================================================