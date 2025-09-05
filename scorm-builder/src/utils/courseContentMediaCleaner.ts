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
 * Removes all media references from course content structure
 */
export function cleanMediaReferencesFromCourseContent(
  courseContent: CourseContentWithMedia | null
): CourseContentWithMedia | null {
  if (!courseContent) {
    debugLogger.info('courseContentMediaCleaner', 'No course content to clean')
    return null
  }

  // First, do a deep scan to see what we're dealing with
  const foundMediaPaths = deepScanForMediaReferences(courseContent)
  debugLogger.info('courseContentMediaCleaner', 'Starting course content media cleanup', {
    hasWelcome: !!courseContent.welcomePage,
    hasObjectives: !!courseContent.learningObjectivesPage,
    topicsCount: courseContent.topics?.length || 0,
    deepScanResults: foundMediaPaths
  })

  const cleaned = { ...courseContent }
  let totalCleaned = 0

  // Clean welcome page media references
  if (cleaned.welcomePage?.media) {
    const mediaCount = cleaned.welcomePage.media.length
    debugLogger.debug('courseContentMediaCleaner', `Removing ${mediaCount} media references from welcome page`)
    delete cleaned.welcomePage.media
    totalCleaned += mediaCount
  }

  // Clean learning objectives page media references (multiple possible names)
  if (cleaned.learningObjectivesPage?.media) {
    const mediaCount = cleaned.learningObjectivesPage.media.length
    debugLogger.debug('courseContentMediaCleaner', `Removing ${mediaCount} media references from learningObjectivesPage`)
    delete cleaned.learningObjectivesPage.media
    totalCleaned += mediaCount
  }
  
  // Also check for alternative objectives page naming
  if (cleaned.objectivesPage?.media) {
    const mediaCount = cleaned.objectivesPage.media.length
    debugLogger.debug('courseContentMediaCleaner', `Removing ${mediaCount} media references from objectivesPage`)
    delete cleaned.objectivesPage.media
    totalCleaned += mediaCount
  }

  // Clean topics media references
  if (cleaned.topics && Array.isArray(cleaned.topics)) {
    cleaned.topics = cleaned.topics.map((topic, index) => {
      if (topic.media) {
        const mediaCount = topic.media.length
        debugLogger.debug('courseContentMediaCleaner', `Removing ${mediaCount} media references from topic ${index}`)
        const cleanedTopic = { ...topic }
        delete cleanedTopic.media
        totalCleaned += mediaCount
        return cleanedTopic
      }
      return topic
    })
  }

  // Aggressive cleanup: Remove ALL media arrays found by deep scan
  function deepCleanMediaReferences(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj
    
    if (Array.isArray(obj)) {
      return obj.map(item => deepCleanMediaReferences(item))
    }
    
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'media' && Array.isArray(value)) {
        // Skip media arrays entirely
        debugLogger.debug('courseContentMediaCleaner', `Aggressively removing media array at ${key}`)
        totalCleaned += value.length
        continue
      } else if (typeof value === 'object' && value !== null) {
        result[key] = deepCleanMediaReferences(value)
      } else {
        result[key] = value
      }
    }
    return result
  }

  // Apply aggressive cleaning
  const aggressivelyCleaned = deepCleanMediaReferences(cleaned)

  // Verify cleanup worked
  const remainingMediaPaths = deepScanForMediaReferences(aggressivelyCleaned)
  
  debugLogger.info('courseContentMediaCleaner', 'Course content media cleanup completed', {
    totalReferencesRemoved: totalCleaned,
    hasWelcome: !!aggressivelyCleaned.welcomePage,
    hasObjectives: !!aggressivelyCleaned.learningObjectivesPage,
    topicsCount: aggressivelyCleaned.topics?.length || 0,
    remainingMediaPaths: remainingMediaPaths
  })

  return aggressivelyCleaned
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