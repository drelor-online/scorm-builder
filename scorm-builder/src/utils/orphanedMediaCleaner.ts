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
  
  try {
    debugLogger.log('[OrphanedMediaCleaner] Starting cleanup of orphaned media references')
    
    // Input validation
    if (!courseContent) {
      debugLogger.log('[OrphanedMediaCleaner] No course content provided - returning empty result')
      return { cleanedContent: courseContent, removedMediaIds: [] }
    }
    
    if (typeof mediaExistsChecker !== 'function') {
      debugLogger.log('[OrphanedMediaCleaner] ERROR: Invalid media exists checker provided')
      throw new Error('Invalid media exists checker function provided')
    }
    
    /**
     * Recursively clean media arrays in objects
     */
    async function cleanMediaArray(mediaArray: any[]): Promise<any[]> {
      if (!Array.isArray(mediaArray)) {
        debugLogger.log('[OrphanedMediaCleaner] WARN: Expected array but got:', typeof mediaArray)
        return mediaArray
      }
      
      const cleanedMedia = []
      
      for (let i = 0; i < mediaArray.length; i++) {
        const mediaItem = mediaArray[i]
        
        try {
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
            if (!mediaItem?.id) {
              debugLogger.log(`[OrphanedMediaCleaner] WARN: Media item at index ${i} has no ID, keeping as-is:`, mediaItem)
            }
          }
        } catch (error) {
          debugLogger.log(`[OrphanedMediaCleaner] ERROR: Failed to check media item ${i}:`, {
            error: error instanceof Error ? error.message : String(error),
            mediaItem: mediaItem
          })
          // Keep the item if we can't check it to avoid data loss
          cleanedMedia.push(mediaItem)
        }
      }
      
      return cleanedMedia
    }
  
    /**
     * Recursively traverse and clean all objects
     */
    async function cleanObject(obj: any, path: string = 'root'): Promise<any> {
      if (!obj || typeof obj !== 'object') return obj
      
      try {
        if (Array.isArray(obj)) {
          // Handle arrays
          const cleanedArray = []
          for (let i = 0; i < obj.length; i++) {
            try {
              cleanedArray.push(await cleanObject(obj[i], `${path}[${i}]`))
            } catch (error) {
              debugLogger.log(`[OrphanedMediaCleaner] ERROR: Failed to clean array item at ${path}[${i}]:`, {
                error: error instanceof Error ? error.message : String(error)
              })
              // Keep the item if we can't clean it to avoid data loss
              cleanedArray.push(obj[i])
            }
          }
          return cleanedArray
        }
        
        // Handle objects
        const cleanedObj: any = {}
        
        for (const [key, value] of Object.entries(obj)) {
          try {
            if (key === 'media' && Array.isArray(value)) {
              // Clean media arrays specifically
              debugLogger.log(`[OrphanedMediaCleaner] Processing media array at ${path}.${key} with ${value.length} items`)
              cleanedObj[key] = await cleanMediaArray(value)
            } else if (value && typeof value === 'object') {
              // Recursively clean nested objects/arrays
              cleanedObj[key] = await cleanObject(value, `${path}.${key}`)
            } else {
              // Keep primitive values as-is
              cleanedObj[key] = value
            }
          } catch (error) {
            debugLogger.log(`[OrphanedMediaCleaner] ERROR: Failed to clean property ${path}.${key}:`, {
              error: error instanceof Error ? error.message : String(error)
            })
            // Keep the property if we can't clean it to avoid data loss
            cleanedObj[key] = value
          }
        }
        
        return cleanedObj
      } catch (error) {
        debugLogger.log(`[OrphanedMediaCleaner] ERROR: Failed to clean object at ${path}:`, {
          error: error instanceof Error ? error.message : String(error)
        })
        // Return original object if we can't clean it
        return obj
      }
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
    
  } catch (error) {
    debugLogger.log('[OrphanedMediaCleaner] CRITICAL ERROR: Failed to complete orphaned media cleanup:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    
    // Return original data with empty removed list to prevent data loss
    return {
      cleanedContent: courseContent,
      removedMediaIds: []
    }
  }
}