/**
 * Enhanced Media Cleanup Service
 * 
 * AUDIT FIX: Consolidates all media cleanup operations behind a unified API
 * 
 * This service addresses the audit finding of "scattered cleanup utilities" by providing:
 * - Single entry point for all media cleanup operations
 * - Consistent error handling and logging
 * - Schema-aware cleanup with normalization
 * - Performance-optimized batch operations
 * - Comprehensive cleanup strategies
 */

import { debugLogger } from '../utils/ultraSimpleLogger'
import { normalizeMediaItem } from '../types/schema'
import type { MediaItem } from '../services/MediaService'
import type { CourseContent } from '../types/aiPrompt'

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type CleanupStrategy = 
  | 'orphaned'        // Remove references to non-existent media
  | 'contaminated'    // Remove corrupted/invalid media
  | 'duplicates'      // Remove duplicate media references
  | 'all-references'  // Remove all media references from content
  | 'cache-reset'     // Reset in-memory cache
  | 'comprehensive'   // All cleanup strategies combined

export interface MediaExistsChecker {
  (mediaId: string): Promise<boolean>
}

export interface CleanupOptions {
  strategy: CleanupStrategy
  dryRun?: boolean
  batchSize?: number
  includeCache?: boolean
  validateSchema?: boolean
}

export interface CleanupResult {
  strategy: CleanupStrategy
  success: boolean
  removedMediaIds: string[]
  cleanedContent?: CourseContent | null
  errors: string[]
  stats: {
    totalProcessed: number
    removed: number
    preserved: number
    duration: number
  }
}

export interface ComprehensiveCleanupResult {
  overall: {
    success: boolean
    duration: number
    totalRemoved: number
  }
  results: CleanupResult[]
  summary: string[]
}

// ============================================================================
// MEDIA CLEANUP SERVICE
// ============================================================================

export class MediaCleanupService {
  private mediaExistsChecker?: MediaExistsChecker
  private cacheResetCallback?: () => void
  
  constructor(
    mediaExistsChecker?: MediaExistsChecker,
    cacheResetCallback?: () => void
  ) {
    this.mediaExistsChecker = mediaExistsChecker
    this.cacheResetCallback = cacheResetCallback
  }

  /**
   * Main cleanup method - executes specified cleanup strategy
   */
  async cleanup(
    courseContent: CourseContent | null, 
    options: CleanupOptions
  ): Promise<CleanupResult | ComprehensiveCleanupResult> {
    const startTime = Date.now()
    
    debugLogger.info('MediaCleanup', `Starting ${options.strategy} cleanup`, {
      dryRun: options.dryRun,
      batchSize: options.batchSize,
      hasContent: !!courseContent
    })

    try {
      let result: CleanupResult

      switch (options.strategy) {
        case 'orphaned':
          result = await this.cleanupOrphanedReferences(courseContent, options)
          break
        case 'contaminated':
          result = await this.cleanupContaminatedMedia(courseContent, options)
          break
        case 'duplicates':
          result = await this.cleanupDuplicateReferences(courseContent, options)
          break
        case 'all-references':
          result = await this.cleanupAllReferences(courseContent, options)
          break
        case 'cache-reset':
          result = await this.resetCache(options)
          break
        case 'comprehensive':
          // Handle comprehensive cleanup separately - return will be ComprehensiveCleanupResult
          const comprehensiveResult = await this.comprehensiveCleanup(courseContent, options)
          return comprehensiveResult
        default:
          throw new Error(`Unknown cleanup strategy: ${options.strategy}`)
      }

      result.stats.duration = Date.now() - startTime
      
      debugLogger.info('MediaCleanup', `Completed ${options.strategy} cleanup`, result.stats)
      return result

    } catch (error) {
      const duration = Date.now() - startTime
      debugLogger.error('MediaCleanup', `Failed ${options.strategy} cleanup`, error)
      
      return {
        strategy: options.strategy,
        success: false,
        removedMediaIds: [],
        errors: [String(error)],
        stats: {
          totalProcessed: 0,
          removed: 0,
          preserved: 0,
          duration
        }
      }
    }
  }

  /**
   * Comprehensive cleanup - runs multiple strategies in sequence
   */
  async comprehensiveCleanup(
    courseContent: CourseContent | null,
    options: CleanupOptions
  ): Promise<ComprehensiveCleanupResult> {
    const startTime = Date.now()
    const results: CleanupResult[] = []
    const summary: string[] = []
    let totalRemoved = 0
    let currentContent = courseContent

    debugLogger.info('MediaCleanup', 'Starting comprehensive cleanup')

    // Strategy sequence for comprehensive cleanup
    const strategies: CleanupStrategy[] = [
      'contaminated',
      'orphaned', 
      'duplicates'
    ]

    if (options.includeCache) {
      strategies.push('cache-reset')
    }

    for (const strategy of strategies) {
      try {
        const result = await this.cleanup(currentContent, {
          ...options,
          strategy
        })
        
        // Type guard: comprehensive strategy should not be used in comprehensive cleanup
        if ('overall' in result && 'results' in result && 'summary' in result) {
          throw new Error('Comprehensive strategy should not be used within comprehensive cleanup')
        }
        
        const cleanupResult = result as CleanupResult
        results.push(cleanupResult)
        totalRemoved += cleanupResult.removedMediaIds.length
        
        if (cleanupResult.cleanedContent) {
          currentContent = cleanupResult.cleanedContent
        }

        if (cleanupResult.success) {
          summary.push(`✅ ${strategy}: removed ${cleanupResult.removedMediaIds.length} items`)
        } else {
          summary.push(`❌ ${strategy}: ${cleanupResult.errors.join(', ')}`)
        }

      } catch (error) {
        results.push({
          strategy,
          success: false,
          removedMediaIds: [],
          errors: [String(error)],
          stats: { totalProcessed: 0, removed: 0, preserved: 0, duration: 0 }
        })
        summary.push(`❌ ${strategy}: ${String(error)}`)
      }
    }

    const duration = Date.now() - startTime
    const success = results.every(r => r.success)

    debugLogger.info('MediaCleanup', 'Completed comprehensive cleanup', {
      success,
      totalRemoved,
      duration,
      strategies: strategies.length
    })

    return {
      overall: {
        success,
        duration,
        totalRemoved
      },
      results,
      summary
    }
  }

  /**
   * Remove references to non-existent media files
   */
  private async cleanupOrphanedReferences(
    courseContent: CourseContent | null,
    options: CleanupOptions
  ): Promise<CleanupResult> {
    const removedMediaIds: string[] = []
    let totalProcessed = 0
    let preserved = 0

    if (!courseContent || !this.mediaExistsChecker) {
      return {
        strategy: 'orphaned',
        success: true,
        removedMediaIds: [],
        cleanedContent: courseContent,
        errors: this.mediaExistsChecker ? [] : ['No media exists checker available'],
        stats: { totalProcessed: 0, removed: 0, preserved: 0, duration: 0 }
      }
    }

    const cleanedContent = JSON.parse(JSON.stringify(courseContent))

    // Process welcome page media
    if (cleanedContent.welcomePage?.media) {
      const { removed, processed, kept } = await this.cleanMediaArray(
        cleanedContent.welcomePage.media,
        'welcomePage',
        options
      )
      removedMediaIds.push(...removed)
      totalProcessed += processed
      preserved += kept
    }

    // Process objectives page media
    if (cleanedContent.learningObjectivesPage?.media) {
      const { removed, processed, kept } = await this.cleanMediaArray(
        cleanedContent.learningObjectivesPage.media,
        'learningObjectivesPage',
        options
      )
      removedMediaIds.push(...removed)
      totalProcessed += processed
      preserved += kept
    }

    // Process topics media
    if (cleanedContent.topics) {
      for (let i = 0; i < cleanedContent.topics.length; i++) {
        const topic = cleanedContent.topics[i]
        if (topic.media) {
          const { removed, processed, kept } = await this.cleanMediaArray(
            topic.media,
            `topics[${i}]`,
            options
          )
          removedMediaIds.push(...removed)
          totalProcessed += processed
          preserved += kept
        }
      }
    }

    return {
      strategy: 'orphaned',
      success: true,
      removedMediaIds,
      cleanedContent,
      errors: [],
      stats: {
        totalProcessed,
        removed: removedMediaIds.length,
        preserved,
        duration: 0 // Set by caller
      }
    }
  }

  /**
   * Remove contaminated/corrupted media references
   */
  private async cleanupContaminatedMedia(
    courseContent: CourseContent | null,
    options: CleanupOptions
  ): Promise<CleanupResult> {
    const removedMediaIds: string[] = []
    let totalProcessed = 0
    let preserved = 0

    if (!courseContent) {
      return {
        strategy: 'contaminated',
        success: true,
        removedMediaIds: [],
        cleanedContent: courseContent,
        errors: [],
        stats: { totalProcessed: 0, removed: 0, preserved: 0, duration: 0 }
      }
    }

    const cleanedContent = JSON.parse(JSON.stringify(courseContent))

    // Clean contaminated media by validating schema if requested
    const cleanArray = (mediaArray: any[], location: string) => {
      const validMedia: any[] = []
      
      for (const item of mediaArray) {
        totalProcessed++
        
        try {
          // Validate by attempting normalization
          if (options.validateSchema) {
            const normalized = normalizeMediaItem(item)
            validMedia.push(normalized)
            preserved++
          } else {
            // Basic validation - check required fields
            if (item && item.id && item.type) {
              validMedia.push(item)
              preserved++
            } else {
              debugLogger.warn('MediaCleanup', `Removing contaminated media in ${location}`, item)
              removedMediaIds.push(item?.id || 'unknown')
            }
          }
        } catch (error) {
          debugLogger.warn('MediaCleanup', `Removing invalid media in ${location}`, { item, error })
          removedMediaIds.push(item?.id || 'unknown')
        }
      }
      
      return validMedia
    }

    // Process all media arrays
    if (cleanedContent.welcomePage?.media) {
      cleanedContent.welcomePage.media = cleanArray(cleanedContent.welcomePage.media, 'welcomePage')
    }

    if (cleanedContent.learningObjectivesPage?.media) {
      cleanedContent.learningObjectivesPage.media = cleanArray(cleanedContent.learningObjectivesPage.media, 'learningObjectivesPage')
    }

    if (cleanedContent.topics) {
      for (let i = 0; i < cleanedContent.topics.length; i++) {
        if (cleanedContent.topics[i].media) {
          cleanedContent.topics[i].media = cleanArray(cleanedContent.topics[i].media, `topics[${i}]`)
        }
      }
    }

    return {
      strategy: 'contaminated',
      success: true,
      removedMediaIds,
      cleanedContent,
      errors: [],
      stats: {
        totalProcessed,
        removed: removedMediaIds.length,
        preserved,
        duration: 0
      }
    }
  }

  /**
   * Remove duplicate media references
   */
  private async cleanupDuplicateReferences(
    courseContent: CourseContent | null,
    options: CleanupOptions
  ): Promise<CleanupResult> {
    const removedMediaIds: string[] = []
    let totalProcessed = 0
    let preserved = 0

    if (!courseContent) {
      return {
        strategy: 'duplicates',
        success: true,
        removedMediaIds: [],
        cleanedContent: courseContent,
        errors: [],
        stats: { totalProcessed: 0, removed: 0, preserved: 0, duration: 0 }
      }
    }

    const cleanedContent = JSON.parse(JSON.stringify(courseContent))

    const dedupeArray = (mediaArray: any[], location: string) => {
      const seen = new Set<string>()
      const uniqueMedia: any[] = []
      
      for (const item of mediaArray) {
        totalProcessed++
        
        if (item && item.id && !seen.has(item.id)) {
          seen.add(item.id)
          uniqueMedia.push(item)
          preserved++
        } else {
          debugLogger.info('MediaCleanup', `Removing duplicate media in ${location}`, { id: item?.id })
          removedMediaIds.push(item?.id || 'unknown')
        }
      }
      
      return uniqueMedia
    }

    // Process all media arrays
    if (cleanedContent.welcomePage?.media) {
      cleanedContent.welcomePage.media = dedupeArray(cleanedContent.welcomePage.media, 'welcomePage')
    }

    if (cleanedContent.learningObjectivesPage?.media) {
      cleanedContent.learningObjectivesPage.media = dedupeArray(cleanedContent.learningObjectivesPage.media, 'learningObjectivesPage')
    }

    if (cleanedContent.topics) {
      for (let i = 0; i < cleanedContent.topics.length; i++) {
        if (cleanedContent.topics[i].media) {
          cleanedContent.topics[i].media = dedupeArray(cleanedContent.topics[i].media, `topics[${i}]`)
        }
      }
    }

    return {
      strategy: 'duplicates',
      success: true,
      removedMediaIds,
      cleanedContent,
      errors: [],
      stats: {
        totalProcessed,
        removed: removedMediaIds.length,
        preserved,
        duration: 0
      }
    }
  }

  /**
   * Remove all media references from course content
   */
  private async cleanupAllReferences(
    courseContent: CourseContent | null,
    options: CleanupOptions
  ): Promise<CleanupResult> {
    const removedMediaIds: string[] = []
    let totalProcessed = 0

    if (!courseContent) {
      return {
        strategy: 'all-references',
        success: true,
        removedMediaIds: [],
        cleanedContent: courseContent,
        errors: [],
        stats: { totalProcessed: 0, removed: 0, preserved: 0, duration: 0 }
      }
    }

    const cleanedContent = JSON.parse(JSON.stringify(courseContent))

    // Count and collect media IDs before removal
    const collectMediaIds = (mediaArray: any[]) => {
      for (const item of mediaArray) {
        totalProcessed++
        if (item?.id) {
          removedMediaIds.push(item.id)
        }
      }
    }

    // Process all media arrays
    if (cleanedContent.welcomePage?.media) {
      collectMediaIds(cleanedContent.welcomePage.media)
      cleanedContent.welcomePage.media = []
    }

    if (cleanedContent.learningObjectivesPage?.media) {
      collectMediaIds(cleanedContent.learningObjectivesPage.media)
      cleanedContent.learningObjectivesPage.media = []
    }

    if (cleanedContent.topics) {
      for (const topic of cleanedContent.topics) {
        if (topic.media) {
          collectMediaIds(topic.media)
          topic.media = []
        }
      }
    }

    return {
      strategy: 'all-references',
      success: true,
      removedMediaIds,
      cleanedContent,
      errors: [],
      stats: {
        totalProcessed,
        removed: removedMediaIds.length,
        preserved: 0,
        duration: 0
      }
    }
  }

  /**
   * Reset media cache
   */
  private async resetCache(options: CleanupOptions): Promise<CleanupResult> {
    try {
      if (this.cacheResetCallback && !options.dryRun) {
        this.cacheResetCallback()
      }

      return {
        strategy: 'cache-reset',
        success: true,
        removedMediaIds: [],
        errors: [],
        stats: {
          totalProcessed: 0,
          removed: 0,
          preserved: 0,
          duration: 0
        }
      }
    } catch (error) {
      return {
        strategy: 'cache-reset',
        success: false,
        removedMediaIds: [],
        errors: [String(error)],
        stats: {
          totalProcessed: 0,
          removed: 0,
          preserved: 0,
          duration: 0
        }
      }
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Clean a media array using the exists checker
   */
  private async cleanMediaArray(
    mediaArray: any[], 
    location: string,
    options: CleanupOptions
  ): Promise<{ removed: string[], processed: number, kept: number }> {
    const removed: string[] = []
    let processed = 0
    let kept = 0
    
    if (!this.mediaExistsChecker) {
      return { removed, processed, kept }
    }

    const validMedia: any[] = []
    
    for (const item of mediaArray) {
      processed++
      
      if (!item || !item.id) {
        debugLogger.warn('MediaCleanup', `Removing invalid media item in ${location}`, item)
        removed.push('invalid')
        continue
      }

      try {
        const exists = await this.mediaExistsChecker(item.id)
        
        if (exists) {
          // Apply schema normalization if requested
          if (options.validateSchema) {
            const normalized = normalizeMediaItem(item)
            validMedia.push(normalized)
          } else {
            validMedia.push(item)
          }
          kept++
        } else {
          debugLogger.info('MediaCleanup', `Removing orphaned media reference in ${location}`, { id: item.id })
          removed.push(item.id)
        }
      } catch (error) {
        debugLogger.error('MediaCleanup', `Error checking media existence in ${location}`, { id: item.id, error })
        removed.push(item.id)
      }
    }

    // Update the array in place (mutating the reference)
    if (!options.dryRun) {
      mediaArray.length = 0
      mediaArray.push(...validMedia)
    }

    return { removed, processed, kept }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick orphaned media cleanup
 */
export async function cleanupOrphanedMedia(
  courseContent: CourseContent | null,
  mediaExistsChecker: MediaExistsChecker,
  options: Partial<CleanupOptions> = {}
): Promise<CleanupResult> {
  const service = new MediaCleanupService(mediaExistsChecker)
  const result = await service.cleanup(courseContent, {
    strategy: 'orphaned',
    ...options
  })
  
  // Type guard to ensure we get a regular CleanupResult
  if ('overall' in result && 'results' in result && 'summary' in result) {
    throw new Error('Unexpected comprehensive result for orphaned cleanup')
  } else {
    return result as CleanupResult
  }
}

/**
 * Quick comprehensive cleanup
 */
export async function comprehensiveMediaCleanup(
  courseContent: CourseContent | null,
  mediaExistsChecker: MediaExistsChecker,
  cacheResetCallback?: () => void,
  options: Partial<CleanupOptions> = {}
): Promise<ComprehensiveCleanupResult> {
  const service = new MediaCleanupService(mediaExistsChecker, cacheResetCallback)
  const result = await service.cleanup(courseContent, {
    strategy: 'comprehensive',
    includeCache: true,
    validateSchema: true,
    ...options
  })
  
  // Type guard to ensure we have the comprehensive result
  if ('overall' in result && 'results' in result && 'summary' in result) {
    return result as ComprehensiveCleanupResult
  } else {
    throw new Error('Expected comprehensive cleanup result but got regular cleanup result')
  }
}

/**
 * Export service for direct usage
 */
export { MediaCleanupService as default }