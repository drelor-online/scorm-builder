/**
 * Utility for cleaning up orphaned media references from course content
 * 
 * This addresses the issue where:
 * 1. User clears course content (media files get deleted)
 * 2. User imports JSON with same media IDs  
 * 3. Course content has references to deleted media files
 * 4. Components fail trying to load non-existent media
 */

// Conditional import for logging to avoid test environment issues
let debugLogger: any
try {
  debugLogger = require('../utils/ultraSimpleLogger').debugLogger
} catch {
  // Fallback logger for test environments
  debugLogger = { log: () => {} }
}

export interface MediaExistsChecker {
  (mediaId: string): Promise<boolean>
}

export interface MediaCleanupResult {
  cleanedContent: any
  removedMediaIds: string[]
}

/**
 * Recursively traverses course content and removes media references 
 * that point to non-existent files
 */
export async function cleanupOrphanedMediaReferences(
  courseContent: any,
  mediaExistsChecker: MediaExistsChecker
): Promise<MediaCleanupResult> {
  const removedMediaIds = new Set<string>()
  
  debugLogger.log('[OrphanedMediaCleaner] Starting cleanup of orphaned media references')
  
  /**
   * Recursively clean media arrays in objects
   */
  async function cleanMediaArray(mediaArray: any[]): Promise<any[]> {
    if (!Array.isArray(mediaArray)) return mediaArray
    
    const cleanedMedia = []
    
    for (const mediaItem of mediaArray) {
      if (mediaItem && typeof mediaItem === 'object' && mediaItem.id) {
        const exists = await mediaExistsChecker(mediaItem.id)
        
        if (exists) {
          cleanedMedia.push(mediaItem)
          debugLogger.log(`[OrphanedMediaCleaner] Media ${mediaItem.id} exists, keeping reference`)
        } else {
          removedMediaIds.add(mediaItem.id)
          debugLogger.log(`[OrphanedMediaCleaner] Media ${mediaItem.id} orphaned, removing reference`)
        }
      } else {
        // Keep non-media items or items without IDs
        cleanedMedia.push(mediaItem)
      }
    }
    
    return cleanedMedia
  }
  
  /**
   * Recursively traverse and clean all objects
   */
  async function cleanObject(obj: any): Promise<any> {
    if (!obj || typeof obj !== 'object') return obj
    
    if (Array.isArray(obj)) {
      // Handle arrays
      const cleanedArray = []
      for (const item of obj) {
        cleanedArray.push(await cleanObject(item))
      }
      return cleanedArray
    }
    
    // Handle objects
    const cleanedObj: any = {}
    
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'media' && Array.isArray(value)) {
        // Clean media arrays specifically
        cleanedObj[key] = await cleanMediaArray(value)
      } else if (value && typeof value === 'object') {
        // Recursively clean nested objects/arrays
        cleanedObj[key] = await cleanObject(value)
      } else {
        // Keep primitive values as-is
        cleanedObj[key] = value
      }
    }
    
    return cleanedObj
  }
  
  // Clean the entire course content structure
  const cleanedContent = await cleanObject(courseContent)
  const removedMediaIdArray = Array.from(removedMediaIds)
  
  if (removedMediaIdArray.length > 0) {
    debugLogger.log(`[OrphanedMediaCleaner] Cleanup complete: removed ${removedMediaIdArray.length} orphaned media references`, {
      removedMediaIds: removedMediaIdArray
    })
  } else {
    debugLogger.log('[OrphanedMediaCleaner] Cleanup complete: no orphaned media references found')
  }
  
  return {
    cleanedContent,
    removedMediaIds: removedMediaIdArray
  }
}