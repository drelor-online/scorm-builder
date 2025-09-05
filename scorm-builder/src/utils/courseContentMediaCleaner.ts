/**
 * Course Content Media Reference Cleaner
 * 
 * Removes all media references from course content structure.
 * This is used during JSON clearing to ensure no stale media references
 * remain in the course content that could cause UI components to try
 * loading non-existent media files.
 */

import { debugLogger } from './ultraSimpleLogger'

/**
 * Deep scan any object for media arrays - for debugging purposes
 */
function deepScanForMediaReferences(obj: any, path: string = 'root'): string[] {
  const found: string[] = []
  
  if (!obj || typeof obj !== 'object') return found
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = `${path}.${key}`
    
    if (key === 'media' && Array.isArray(value) && value.length > 0) {
      found.push(`${currentPath} (${value.length} items)`)
    } else if (typeof value === 'object' && value !== null) {
      found.push(...deepScanForMediaReferences(value, currentPath))
    }
  }
  
  return found
}

export interface CourseContentWithMedia {
  welcomePage?: {
    media?: any[]
    [key: string]: any
  }
  learningObjectivesPage?: {
    media?: any[]
    [key: string]: any
  }
  // Also support the alternative naming pattern that might be used
  objectivesPage?: {
    media?: any[]
    [key: string]: any
  }
  topics?: Array<{
    media?: any[]
    [key: string]: any
  }>
  [key: string]: any
}

/**
 * Removes all media references from course content structure using immutable patterns
 * CRITICAL: Uses deep cloning to avoid React state mutation issues
 */
export function cleanMediaReferencesFromCourseContent(
  courseContent: CourseContentWithMedia | null
): CourseContentWithMedia | null {
  if (!courseContent) {
    debugLogger.info('courseContentMediaCleaner', 'No course content to clean')
    return null
  }

  try {
    // First, do a deep scan to see what we're dealing with
    const foundMediaPaths = deepScanForMediaReferences(courseContent)
    debugLogger.info('courseContentMediaCleaner', 'Starting course content media cleanup', {
      hasWelcome: !!courseContent.welcomePage,
      hasObjectives: !!courseContent.learningObjectivesPage,
      topicsCount: courseContent.topics?.length || 0,
      deepScanResults: foundMediaPaths
    })

    // CRITICAL FIX: Deep clone to avoid React state mutation issues
    let deepCloned: CourseContentWithMedia
    try {
      deepCloned = JSON.parse(JSON.stringify(courseContent))
      debugLogger.debug('courseContentMediaCleaner', 'Successfully deep cloned course content for safe manipulation')
    } catch (cloneError) {
      debugLogger.error('courseContentMediaCleaner', 'Failed to deep clone course content', { 
        error: cloneError instanceof Error ? cloneError.message : String(cloneError),
        contentType: typeof courseContent,
        hasWelcome: !!courseContent.welcomePage,
        hasObjectives: !!courseContent.learningObjectivesPage
      })
      throw new Error(`Deep clone failed: ${cloneError instanceof Error ? cloneError.message : String(cloneError)}`)
    }

    let totalCleaned = 0

    // IMMUTABLE APPROACH: Create new objects without media properties instead of deleting
    
    // Clean welcome page media references
    if (deepCloned.welcomePage?.media) {
      const mediaCount = deepCloned.welcomePage.media.length
      debugLogger.debug('courseContentMediaCleaner', `Removing ${mediaCount} media references from welcome page`)
      const { media: _, ...welcomeWithoutMedia } = deepCloned.welcomePage
      deepCloned.welcomePage = welcomeWithoutMedia
      totalCleaned += mediaCount
    }

    // Clean learning objectives page media references (multiple possible names)
    if (deepCloned.learningObjectivesPage?.media) {
      const mediaCount = deepCloned.learningObjectivesPage.media.length
      debugLogger.debug('courseContentMediaCleaner', `Removing ${mediaCount} media references from learningObjectivesPage`)
      const { media: _, ...objectivesWithoutMedia } = deepCloned.learningObjectivesPage
      deepCloned.learningObjectivesPage = objectivesWithoutMedia
      totalCleaned += mediaCount
    }
    
    // Also check for alternative objectives page naming
    if (deepCloned.objectivesPage?.media) {
      const mediaCount = deepCloned.objectivesPage.media.length
      debugLogger.debug('courseContentMediaCleaner', `Removing ${mediaCount} media references from objectivesPage`)
      const { media: _, ...altObjectivesWithoutMedia } = deepCloned.objectivesPage
      deepCloned.objectivesPage = altObjectivesWithoutMedia
      totalCleaned += mediaCount
    }

    // Clean topics media references using immutable patterns
    if (deepCloned.topics && Array.isArray(deepCloned.topics)) {
      deepCloned.topics = deepCloned.topics.map((topic, index) => {
        if (topic.media) {
          const mediaCount = topic.media.length
          debugLogger.debug('courseContentMediaCleaner', `Removing ${mediaCount} media references from topic ${index}`)
          totalCleaned += mediaCount
          // Use destructuring to create new object without media property
          const { media: _, ...topicWithoutMedia } = topic
          return topicWithoutMedia
        }
        return topic
      })
    }

    // Enhanced aggressive cleanup with better error handling
    function deepCleanMediaReferences(obj: any, path: string = 'root'): any {
      try {
        if (!obj || typeof obj !== 'object') return obj
        
        if (Array.isArray(obj)) {
          return obj.map((item, index) => deepCleanMediaReferences(item, `${path}[${index}]`))
        }
        
        const result: any = {}
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = `${path}.${key}`
          
          if (key === 'media' && Array.isArray(value)) {
            // Skip media arrays entirely - this is the whole point
            debugLogger.debug('courseContentMediaCleaner', `Aggressively removing media array at ${currentPath} (${value.length} items)`)
            totalCleaned += value.length
            continue // Don't add media property to result
          } else if (typeof value === 'object' && value !== null) {
            result[key] = deepCleanMediaReferences(value, currentPath)
          } else {
            result[key] = value
          }
        }
        return result
      } catch (error) {
        debugLogger.error('courseContentMediaCleaner', `Failed to clean path ${path}`, {
          error: error instanceof Error ? error.message : String(error),
          pathType: typeof obj,
          isArray: Array.isArray(obj)
        })
        // Return original object if cleaning fails to prevent data loss
        return obj
      }
    }

    // Apply aggressive cleaning
    const aggressivelyCleaned = deepCleanMediaReferences(deepCloned)

    // Verify cleanup worked
    const remainingMediaPaths = deepScanForMediaReferences(aggressivelyCleaned)
    
    if (remainingMediaPaths.length > 0) {
      debugLogger.warn('courseContentMediaCleaner', 'Some media references may remain after cleanup', {
        remainingPaths: remainingMediaPaths
      })
    }
    
    debugLogger.info('courseContentMediaCleaner', 'Course content media cleanup completed successfully', {
      totalReferencesRemoved: totalCleaned,
      hasWelcome: !!aggressivelyCleaned.welcomePage,
      hasObjectives: !!aggressivelyCleaned.learningObjectivesPage,
      topicsCount: aggressivelyCleaned.topics?.length || 0,
      remainingMediaPaths: remainingMediaPaths,
      cleanupSuccessful: remainingMediaPaths.length === 0
    })

    return aggressivelyCleaned

  } catch (error) {
    debugLogger.error('courseContentMediaCleaner', 'CRITICAL: Course content media cleanup failed completely', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      contentType: typeof courseContent,
      hasWelcome: !!courseContent.welcomePage,
      hasObjectives: !!courseContent.learningObjectivesPage,
      topicsCount: courseContent.topics?.length || 0
    })
    
    // Re-throw with more context for handleClearCourseContent to catch
    throw new Error(`Media cleaning failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Checks if course content contains any media references
 */
export function hasMediaReferences(courseContent: CourseContentWithMedia | null): boolean {
  if (!courseContent) return false

  // Use deep scan for comprehensive detection
  const foundMediaPaths = deepScanForMediaReferences(courseContent)
  
  debugLogger.debug('courseContentMediaCleaner', 'hasMediaReferences check', {
    foundPaths: foundMediaPaths,
    hasReferences: foundMediaPaths.length > 0
  })

  return foundMediaPaths.length > 0
}

/**
 * Counts total media references in course content
 */
export function countMediaReferences(courseContent: CourseContentWithMedia | null): number {
  if (!courseContent) return 0

  // Use deep scan for comprehensive counting
  function deepCountMediaReferences(obj: any): number {
    let count = 0
    
    if (!obj || typeof obj !== 'object') return count
    
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'media' && Array.isArray(value)) {
        count += value.length
      } else if (typeof value === 'object' && value !== null) {
        count += deepCountMediaReferences(value)
      }
    }
    
    return count
  }

  const totalCount = deepCountMediaReferences(courseContent)
  
  debugLogger.debug('courseContentMediaCleaner', 'countMediaReferences result', {
    totalCount: totalCount
  })

  return totalCount
}