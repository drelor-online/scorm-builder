import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { CourseContent, EnhancedCourseContent } from '../types/scorm'
import type { CourseSettings } from '../components/CourseSettingsWizard'
import { downloadIfExternal, isExternalUrl } from './externalImageDownloader'
import { debugLogger } from '../utils/ultraSimpleLogger'
import { z } from 'zod'

// ============================================================================
// REGRESSION DETECTION GUARDS
// ============================================================================

/**
 * Development guard to detect MediaService calls during content conversion
 * This prevents regressions where resolvers might bypass the preload cache
 */
let isInContentConversion = false
const mediaServiceCallDetector = {
  enterConversion() {
    isInContentConversion = true
  },
  exitConversion() {
    isInContentConversion = false
  },
  checkForRegressionCall(callerFunction: string) {
    if (process.env.NODE_ENV === 'development' && isInContentConversion) {
      throw new Error(`🚨 REGRESSION DETECTED: ${callerFunction} attempted MediaService call during conversion! All media should be pre-loaded in cache.`)
    }
  }
}

// ============================================================================
// STRICT MEDIA MODE CONFIGURATION
// ============================================================================

/**
 * Strict media mode configuration
 * When enabled, generation fails with clear error list if any media is missing after preload
 */
interface StrictMediaModeConfig {
  enabled: boolean
  maxMissingMedia: number // Allow up to N missing media items before failing
}

const strictMediaMode: StrictMediaModeConfig = {
  enabled: false, // Default: best-effort mode
  maxMissingMedia: 0 // Strict mode: fail on any missing media
}

/**
 * Media preload validation results
 */
interface MediaPreloadValidation {
  requestedCount: number
  cachedCount: number
  missingCount: number
  missingMediaIds: string[]
  isValid: boolean
}

/**
 * Validate media preload results against strict mode requirements
 */
function validateMediaPreload(requestedIds: string[], cachedCount: number): MediaPreloadValidation {
  const requestedCount = requestedIds.length
  const missingCount = requestedCount - cachedCount
  const isValid = !strictMediaMode.enabled || missingCount <= strictMediaMode.maxMissingMedia

  // For debugging, we'd need to check which specific IDs are missing
  // but that requires inspecting the cache, which we'll do in the actual validation
  return {
    requestedCount,
    cachedCount,
    missingCount,
    missingMediaIds: [], // Will be populated by caller if needed
    isValid
  }
}

/**
 * Enable strict media mode for the current generation
 * Call this before batch preloading to enforce strict validation
 */
export function enableStrictMediaMode(maxMissingMedia: number = 0) {
  strictMediaMode.enabled = true
  strictMediaMode.maxMissingMedia = maxMissingMedia
  console.log(`[STRICT MEDIA MODE] Enabled with maxMissingMedia: ${maxMissingMedia}`)
}

/**
 * Disable strict media mode (return to best-effort)
 */
export function disableStrictMediaMode() {
  strictMediaMode.enabled = false
  console.log(`[STRICT MEDIA MODE] Disabled, returning to best-effort mode`)
}

/**
 * Get current strict media mode status
 */
export function getStrictMediaModeStatus(): StrictMediaModeConfig {
  return { ...strictMediaMode }
}

// ============================================================================
// RUNTIME VALIDATION SCHEMAS WITH ZOD
// ============================================================================

/**
 * Schema for media items with comprehensive validation
 */
const MediaItemSchema = z.object({
  id: z.string().min(1, 'Media ID is required'),
  type: z.enum(['image', 'video', 'audio', 'youtube', 'pdf', 'document', 'caption']).optional(),
  url: z.string().optional(),
  file: z.any().optional(), // File object validation is complex
  filename: z.string().optional(),
  caption: z.string().optional(),
  altText: z.string().optional(),
  isYouTube: z.boolean().optional(),
  youTubeVideoId: z.string().optional(),
  startTime: z.number().min(0).optional(),
  endTime: z.number().min(0).optional(),
  width: z.number().min(1).max(4096).optional(),
  height: z.number().min(1).max(4096).optional(),
  size: z.number().min(0).max(1024 * 1024 * 1024).optional() // Max 1GB
}).refine(data => {
  // More lenient YouTube validation - video ID can be extracted from URL
  if (data.isYouTube && !data.youTubeVideoId && !data.url) {
    return false
  }
  return true
}, 'YouTube videos must have either a video ID or URL')

/**
 * Schema for knowledge check questions
 */
const QuestionSchema = z.object({
  question: z.string().min(1, 'Question text is required').max(2000, 'Question too long'),
  type: z.enum(['multiple-choice', 'true-false', 'short-answer', 'essay']).optional(),
  options: z.array(z.string().max(500, 'Option too long')).max(20, 'Too many options').optional(),
  correctAnswer: z.union([z.number(), z.boolean(), z.string()]).optional(),
  feedback: z.object({
    correct: z.string().max(1000).optional(),
    incorrect: z.string().max(1000).optional()
  }).optional()
}).transform(data => {
  // Infer question type if not provided
  if (!data.type) {
    if (typeof data.correctAnswer === 'boolean') {
      data.type = 'true-false'
    } else if (Array.isArray(data.options) && data.options.length > 0) {
      data.type = 'multiple-choice'
    } else {
      data.type = 'short-answer' // Default fallback
    }
  }
  return data
}).refine(data => {
  // Multiple choice must have options and valid correctAnswer index
  if (data.type === 'multiple-choice') {
    if (!data.options || data.options.length === 0) return false
    if (typeof data.correctAnswer !== 'number') return false
    if (data.correctAnswer < 0 || data.correctAnswer >= data.options.length) return false
  }
  // True/false validation is more lenient
  if (data.type === 'true-false') {
    // Allow various formats for correctAnswer and convert them
    if (data.correctAnswer !== undefined) {
      if (typeof data.correctAnswer === 'boolean') return true
      if (data.correctAnswer === 'true' || data.correctAnswer === 1 || data.correctAnswer === '1') return true
      if (data.correctAnswer === 'false' || data.correctAnswer === 0 || data.correctAnswer === '0') return true
    }
  }
  return true
}, 'Invalid question configuration for type')

/**
 * Schema for knowledge check
 */
const KnowledgeCheckSchema = z.object({
  enabled: z.boolean().default(false),
  questions: z.array(QuestionSchema).max(50, 'Too many questions').default([])
}).optional()

/**
 * Schema for page content (welcome, objectives, topics)
 */
const PageContentSchema = z.object({
  id: z.string().min(1, 'Page ID is required').max(100, 'Page ID too long').optional(),
  title: z.string().min(1, 'Page title is required').max(200, 'Title too long').optional(),
  heading: z.string().min(1, 'Page heading is required').max(200, 'Heading too long').optional(),
  content: z.string().max(100000, 'Content too long').optional(),
  media: z.array(MediaItemSchema).max(100, 'Too many media items').optional(),
  audioFile: z.string().optional(),
  captionFile: z.string().optional(),
  knowledgeCheck: KnowledgeCheckSchema.optional()
}).refine(data => {
  // At least title or heading must be present
  return data.title || data.heading
}, 'Page must have either title or heading').optional()

/**
 * Schema for topics
 */
const TopicSchema = z.object({
  id: z.string().min(1, 'Topic ID is required').max(100, 'Topic ID too long'),
  title: z.string().min(1, 'Topic title is required').max(200, 'Title too long').optional(),
  heading: z.string().min(1, 'Topic heading is required').max(200, 'Heading too long').optional(),
  content: z.string().max(100000, 'Topic content too long').optional(),
  media: z.array(MediaItemSchema).max(100, 'Too many media items').optional(),
  audioFile: z.string().optional(),
  captionFile: z.string().optional(),
  knowledgeCheck: KnowledgeCheckSchema.optional()
}).refine(data => {
  // At least title or heading must be present
  return data.title || data.heading
}, 'Topic must have either title or heading')

/**
 * Schema for assessment
 */
const AssessmentSchema = z.object({
  enabled: z.boolean().default(false),
  passingScore: z.number().min(0).max(100).default(80),
  questions: z.array(QuestionSchema).max(200, 'Too many assessment questions').default([])
}).optional()

/**
 * Schema for course settings with security constraints
 */
const CourseSettingsSchema = z.object({
  passMark: z.number().min(0).max(100).optional(),
  timeLimit: z.number().min(0).max(86400).optional(), // Max 24 hours
  sessionTimeout: z.number().min(5).max(7200).optional(), // 5 min to 2 hours
  minimumTimeSpent: z.number().min(0).max(7200).optional(),
  showProgress: z.boolean().optional(),
  showOutline: z.boolean().optional(),
  enableCsp: z.boolean().optional(),
  allowSkipping: z.boolean().optional(),
  randomizeQuestions: z.boolean().optional(),
  maxAttempts: z.number().min(1).max(10).optional()
}).optional()

/**
 * Schema for standard course content
 */
const CourseContentSchema = z.object({
  title: z.string().min(1, 'Course title is required').max(200, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  welcome: PageContentSchema,
  objectivesPage: PageContentSchema,
  topics: z.array(TopicSchema).max(1000, 'Too many topics'),
  assessment: AssessmentSchema
})

/**
 * Schema for enhanced course content
 */
const EnhancedCourseContentSchema = z.object({
  title: z.string().min(1, 'Course title is required').max(200, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  welcome: PageContentSchema,
  objectives: z.array(z.string().max(500, 'Objective too long')).max(50, 'Too many objectives').optional(),
  topics: z.array(TopicSchema).max(1000, 'Too many topics'),
  assessment: AssessmentSchema
})

/**
 * Validate course content with comprehensive Zod schemas
 */
function validateCourseContent(courseContent: any, projectId: string): void {
  try {
    // Determine if this is enhanced format
    const isEnhanced = courseContent && typeof courseContent === 'object' &&
                      'objectives' in courseContent && Array.isArray(courseContent.objectives)

    const schema = isEnhanced ? EnhancedCourseContentSchema : CourseContentSchema

    // Parse and validate
    const validationResult = schema.safeParse(courseContent)

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err =>
        `${err.path.join('.')}: ${err.message}`
      ).join('; ')

      debugLogger.error('SCORM_VALIDATION', 'Course content validation failed', {
        projectId,
        errors,
        contentType: isEnhanced ? 'enhanced' : 'standard'
      })

      throw new Error(`Course content validation failed: ${errors}`)
    }

    debugLogger.info('SCORM_VALIDATION', 'Course content validation passed', {
      projectId,
      contentType: isEnhanced ? 'enhanced' : 'standard',
      topicsCount: courseContent.topics?.length || 0,
      hasAssessment: !!courseContent.assessment?.enabled,
      hasWelcome: !!courseContent.welcome,
      hasObjectives: isEnhanced ? !!courseContent.objectives?.length : !!courseContent.objectivesPage
    })

  } catch (error) {
    debugLogger.error('SCORM_VALIDATION', 'Validation error occurred', {
      projectId,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

/**
 * Validate course settings with Zod schema
 */
function validateCourseSettings(courseSettings: any, projectId: string): void {
  if (!courseSettings) return // Settings are optional

  try {
    const validationResult = CourseSettingsSchema.safeParse(courseSettings)

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err =>
        `${err.path.join('.')}: ${err.message}`
      ).join('; ')

      debugLogger.error('SCORM_VALIDATION', 'Course settings validation failed', {
        projectId,
        errors
      })

      throw new Error(`Course settings validation failed: ${errors}`)
    }

    debugLogger.debug('SCORM_VALIDATION', 'Course settings validation passed', { projectId })

  } catch (error) {
    debugLogger.error('SCORM_VALIDATION', 'Settings validation error occurred', {
      projectId,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

// ============================================================================
// PROMISE REJECTION HANDLING AND SAFE ASYNC UTILITIES
// ============================================================================

/**
 * Safely execute an async operation with error handling and logging
 */
async function safeAsyncOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  projectId: string,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await operation()
  } catch (error) {
    debugLogger.error('ASYNC_OPERATION', `Failed to execute ${operationName}`, {
      projectId,
      error: error instanceof Error ? error.message : String(error)
    })

    if (fallback !== undefined) {
      debugLogger.debug('ASYNC_OPERATION', `Using fallback for ${operationName}`, { projectId })
      return fallback
    }

    return undefined
  }
}

/**
 * Safely execute Promise.all with individual error handling for each promise
 */
async function safePromiseAll<T>(
  promises: Promise<T>[],
  operationName: string,
  projectId: string,
  filterFailures: boolean = true
): Promise<T[]> {
  try {
    // Execute all promises with individual error handling
    const results = await Promise.allSettled(promises)

    const successful: T[] = []
    const failed: string[] = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value !== null && result.value !== undefined) {
          successful.push(result.value)
        }
      } else {
        const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason)
        failed.push(`Item ${index}: ${errorMsg}`)

        debugLogger.warn('PROMISE_ALL', `Individual promise failed in ${operationName}`, {
          projectId,
          index,
          error: errorMsg
        })
      }
    })

    if (failed.length > 0) {
      debugLogger.warn('PROMISE_ALL', `${operationName} completed with ${failed.length} failures`, {
        projectId,
        successCount: successful.length,
        failureCount: failed.length,
        failures: failed
      })
    } else {
      debugLogger.debug('PROMISE_ALL', `${operationName} completed successfully`, {
        projectId,
        successCount: successful.length
      })
    }

    return successful

  } catch (error) {
    debugLogger.error('PROMISE_ALL', `Critical failure in ${operationName}`, {
      projectId,
      error: error instanceof Error ? error.message : String(error)
    })

    // Return empty array as fallback
    return []
  }
}

/**
 * Safely execute media operations with retries and fallbacks
 */
async function safeMediaOperation<T>(
  operation: () => Promise<T>,
  mediaId: string,
  operationName: string,
  projectId: string,
  maxRetries: number = 2
): Promise<T | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      if (attempt < maxRetries) {
        debugLogger.warn('MEDIA_OPERATION', `Retrying ${operationName} for media ${mediaId} (attempt ${attempt + 1}/${maxRetries + 1})`, {
          projectId,
          mediaId,
          error: errorMsg
        })

        // Wait briefly before retry
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)))
      } else {
        debugLogger.error('MEDIA_OPERATION', `Failed ${operationName} for media ${mediaId} after ${maxRetries + 1} attempts`, {
          projectId,
          mediaId,
          error: errorMsg
        })
      }
    }
  }

  return null
}

/**
 * Safely process array of async operations with progress tracking
 */
async function safeAsyncArrayProcess<T, U>(
  items: T[],
  processor: (item: T, index: number) => Promise<U>,
  operationName: string,
  projectId: string,
  batchSize: number = 10
): Promise<U[]> {
  const results: U[] = []
  const total = items.length

  debugLogger.info('ASYNC_ARRAY', `Starting ${operationName} for ${total} items`, { projectId })

  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < total; i += batchSize) {
    const batch = items.slice(i, Math.min(i + batchSize, total))
    const batchPromises = batch.map((item, batchIndex) =>
      safeAsyncOperation(
        () => processor(item, i + batchIndex),
        `${operationName}[${i + batchIndex}]`,
        projectId
      )
    )

    const batchResults = await safePromiseAll(
      batchPromises,
      `${operationName} batch ${Math.floor(i / batchSize) + 1}`,
      projectId
    )

    // Filter out undefined results
    results.push(...batchResults.filter((result): result is U => result !== undefined))

    debugLogger.debug('ASYNC_ARRAY', `Completed batch ${Math.floor(i / batchSize) + 1}`, {
      projectId,
      processed: Math.min(i + batchSize, total),
      total,
      batchSuccessCount: batchResults.length
    })
  }

  debugLogger.info('ASYNC_ARRAY', `Completed ${operationName}`, {
    projectId,
    totalItems: total,
    successfulResults: results.length,
    failureCount: total - results.length
  })

  return results
}

// ============================================================================
// DEFENSIVE UTILITIES FOR EDGE CASE HANDLING
// ============================================================================

/**
 * Safely access array elements with bounds checking
 */
function safeArrayAccess<T>(arr: T[] | undefined | null, index: number, fallback?: T): T | undefined {
  if (!Array.isArray(arr) || index < 0 || index >= arr.length) {
    return fallback
  }
  return arr[index]
}

/**
 * Safely filter array, removing undefined/null elements
 */
function safeArrayFilter<T>(arr: (T | undefined | null)[] | undefined | null): T[] {
  if (!Array.isArray(arr)) return []
  return arr.filter((item): item is T => item != null)
}

/**
 * Safely map over array, filtering out undefined/null elements first
 */
function safeArrayMap<T, U>(
  arr: (T | undefined | null)[] | undefined | null,
  mapFn: (item: T, index: number) => U
): U[] {
  const filtered = safeArrayFilter(arr)
  return filtered.map(mapFn)
}

/**
 * Safely get nested property with path notation
 */
function safeGet(obj: any, path: string, fallback: any = undefined): any {
  if (!obj || typeof obj !== 'object') return fallback

  const keys = path.split('.')
  let result = obj

  for (const key of keys) {
    if (result == null || typeof result !== 'object' || !(key in result)) {
      return fallback
    }
    result = result[key]
  }

  return result
}

/**
 * Safely perform string operations on potentially undefined values
 */
function safeString(value: any, fallback: string = ''): string {
  if (value == null) return fallback
  return String(value)
}

/**
 * Safely split string, handling undefined/null values
 */
function safeStringSplit(str: any, delimiter: string, fallback: string[] = []): string[] {
  if (str == null) return fallback
  const safeStr = String(str)
  return safeStr.split(delimiter)
}

/**
 * Safely find array element, with type checking
 */
function safeFindInArray<T>(
  arr: any,
  predicate: (item: T) => boolean,
  fallback?: T
): T | undefined {
  if (!Array.isArray(arr)) return fallback
  return arr.find(predicate) || fallback
}

/**
 * Normalize and sanitize topic data
 */
function sanitizeTopic(topic: any): any {
  if (!topic || typeof topic !== 'object') return null

  return {
    id: sanitizeFilePath(safeString(topic.id, `topic-${Date.now()}`)),
    title: sanitizeHtml(safeString(topic.title, 'Untitled Topic')),
    content: sanitizeHtml(safeString(topic.content, '')),
    media: Array.isArray(topic.media) ? topic.media : [],
    knowledgeCheck: topic.knowledgeCheck || undefined
  }
}

/**
 * Sanitize knowledge check questions array
 */
function sanitizeQuestions(questions: any): any[] {
  if (!Array.isArray(questions)) return []
  return safeArrayFilter(questions).map(q => {
    if (!q || typeof q !== 'object') return null
    return {
      ...q,
      question: sanitizeHtml(safeString(q.question || q.text)),
      type: safeString(q.type || q.questionType, 'multiple-choice'),
      options: Array.isArray(q.options) ? q.options.map((opt: any) => sanitizeHtml(safeString(opt))) : [],
      correctAnswer: q.correctAnswer
    }
  }).filter(q => q != null)
}

/**
 * Safely parse JSON with fallback
 */
function safeJsonParse(jsonString: string, fallback: any = {}): any {
  try {
    return JSON.parse(jsonString)
  } catch (error) {
    console.warn('[SCORM] Failed to parse JSON:', error instanceof Error ? error.message : String(error))
    return fallback
  }
}

/**
 * Safely access regex match groups
 */
function safeRegexMatch(match: RegExpMatchArray | null, index: number, fallback: string = ''): string {
  if (!match || index >= match.length || !match[index]) {
    return fallback
  }
  return match[index]
}

/**
 * Safely parse integer with validation
 */
function safeParseInt(value: any, fallback: number = 0, min?: number, max?: number): number {
  if (value === null || value === undefined) return fallback
  const parsed = parseInt(String(value), 10)
  if (isNaN(parsed)) return fallback
  if (min !== undefined && parsed < min) return fallback
  if (max !== undefined && parsed > max) return fallback
  return parsed
}

/**
 * Basic HTML sanitization to prevent XSS
 */
function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return ''
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
    .trim()
}

/**
 * Sanitize file path to prevent path traversal
 */
function sanitizeFilePath(path: string): string {
  if (typeof path !== 'string') return 'untitled'
  return path
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove invalid filename characters
    .replace(/^\.*/, '') // Remove leading dots
    .replace(/\.\./g, '') // Remove parent directory references
    .substring(0, 255) // Limit length
    .trim() || 'untitled'
}

/**
 * Validate and constrain numeric values
 */
function constrainNumber(value: any, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num) || !isFinite(num)) return fallback
  return Math.min(Math.max(num, min), max)
}

/**
 * Check for maximum size limits to prevent memory issues
 */
function validateMaximumSizes(courseContent: any): void {
  const MAX_TOPICS = 1000
  const MAX_QUESTIONS_PER_TOPIC = 50
  const MAX_OPTIONS_PER_QUESTION = 20
  const MAX_MEDIA_ITEMS = 1000
  const MAX_CONTENT_LENGTH = 100000 // 100KB per content field

  if (Array.isArray(courseContent.topics) && courseContent.topics.length > MAX_TOPICS) {
    throw new Error(`Too many topics: ${courseContent.topics.length}. Maximum allowed: ${MAX_TOPICS}`)
  }

  if (Array.isArray(courseContent.topics)) {
    courseContent.topics.forEach((topic: any, topicIndex: number) => {
      if (topic?.knowledgeCheck?.questions && Array.isArray(topic.knowledgeCheck.questions)) {
        if (topic.knowledgeCheck.questions.length > MAX_QUESTIONS_PER_TOPIC) {
          throw new Error(`Topic ${topicIndex} has too many questions: ${topic.knowledgeCheck.questions.length}. Maximum allowed: ${MAX_QUESTIONS_PER_TOPIC}`)
        }

        topic.knowledgeCheck.questions.forEach((q: any, qIndex: number) => {
          if (Array.isArray(q?.options) && q.options.length > MAX_OPTIONS_PER_QUESTION) {
            throw new Error(`Topic ${topicIndex}, question ${qIndex} has too many options: ${q.options.length}. Maximum allowed: ${MAX_OPTIONS_PER_QUESTION}`)
          }
        })
      }

      if (Array.isArray(topic?.media) && topic.media.length > MAX_MEDIA_ITEMS) {
        throw new Error(`Topic ${topicIndex} has too many media items: ${topic.media.length}. Maximum allowed: ${MAX_MEDIA_ITEMS}`)
      }

      if (typeof topic?.content === 'string' && topic.content.length > MAX_CONTENT_LENGTH) {
        console.warn(`Topic ${topicIndex} content is very long (${topic.content.length} chars). Consider splitting into smaller sections.`)
      }
    })
  }
}

/**
 * Converts YouTube watch URLs to embed URLs
 * @param url - YouTube URL (watch or embed format)
 * @param clipStart - Start time in seconds (optional)
 * @param clipEnd - End time in seconds (optional)
 * @returns Properly formatted YouTube embed URL
 */
export function normalizeYouTubeURL(url: string, clipStart?: number, clipEnd?: number): string {
  if (!url) return ''
  
  // If already an embed URL, just add clip timing if needed
  if (url.includes('/embed/')) {
    const baseUrl = url.split('?')[0] // Remove existing parameters
    const videoId = baseUrl.split('/embed/')[1]
    
    const params = new URLSearchParams()
    params.set('rel', '0')
    params.set('modestbranding', '1')
    
    if (clipStart !== undefined && clipStart > 0) {
      params.set('start', clipStart.toString())
    }
    if (clipEnd !== undefined && clipEnd > 0) {
      params.set('end', clipEnd.toString())
    }
    
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
  }
  
  // Extract video ID from various YouTube URL formats
  let videoId = ''
  
  try {
    const urlObj = new URL(url)
    
    if (urlObj.hostname.includes('youtube.com')) {
      if (urlObj.pathname === '/watch') {
        videoId = urlObj.searchParams.get('v') || ''
      } else if (urlObj.pathname.startsWith('/embed/')) {
        videoId = urlObj.pathname.split('/embed/')[1]
      }
    } else if (urlObj.hostname.includes('youtu.be')) {
      videoId = urlObj.pathname.substring(1) // Remove leading /
    }
  } catch (e) {
    // If URL parsing fails, try regex extraction
    const watchMatch = url.match(/[?&]v=([^&]+)/)
    const embedMatch = url.match(/\/embed\/([^?&]+)/)
    const shortMatch = url.match(/youtu\.be\/([^?&]+)/)
    
    videoId = (watchMatch?.[1] || embedMatch?.[1] || shortMatch?.[1] || '').split('&')[0]
  }
  
  if (!videoId) {
    console.warn('[YouTube URL] Could not extract video ID from:', url)
    return url // Return original if we can't parse it
  }
  
  // Build proper embed URL with parameters
  const params = new URLSearchParams()
  params.set('rel', '0')
  params.set('modestbranding', '1')
  
  if (clipStart !== undefined && clipStart > 0) {
    params.set('start', clipStart.toString())
  }
  if (clipEnd !== undefined && clipEnd > 0) {
    params.set('end', clipEnd.toString())
  }
  
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}
import { generateYouTubeClipReport, logYouTubeClipReport, diagnoseYouTubeVideo } from '../utils/youTubeClippingDiagnostics'

interface MediaFile {
  filename: string
  content: Uint8Array
}

// Media cache to prevent duplicate loads during SCORM generation
const mediaCache = new Map<string, { data: Uint8Array, mimeType: string }>()

// Authoritative extension map - built once and used throughout generation
let authoritativeExtensionMap = new Map<string, string>()

// Performance monitoring (module-level for access in helper functions)
let performanceTrace: { cacheHits: number; cacheMisses: number; batchedLoads: number; startTime: number } | null = null

/**
 * Ensure the project is properly loaded in FileStorage before accessing media
 * This is critical for MediaService to work correctly
 */
async function ensureProjectLoaded(projectId: string): Promise<void> {
  try {
    console.log(`[Rust SCORM] Ensuring project ${projectId} is loaded...`)
    
    // CRITICAL FIX: Extract numeric ID from any format to prevent double path construction
    let numericProjectId = projectId
    
    // If projectId is a full path, extract just the numeric ID
    if (projectId.includes('\\') || projectId.includes('/') || projectId.includes('.scormproj')) {
      console.log(`[Rust SCORM] Extracting numeric ID from full path: ${projectId}`)
      
      // Try to extract from path like "Complex_Projects_-_1_-_49_CFR_192_1756944000180.scormproj"
      const fileNameMatch = projectId.match(/_(\d+)\.scormproj$/i)
      if (fileNameMatch) {
        numericProjectId = fileNameMatch[1]
        console.log(`[Rust SCORM] Extracted numeric ID from filename: ${numericProjectId}`)
      } else {
        // Try to extract from directory path like "C:\...\1756944000180"
        const pathParts = projectId.split(/[\\/]/)
        for (let i = pathParts.length - 1; i >= 0; i--) {
          const part = pathParts[i].replace('.scormproj', '')
          if (/^\d+$/.test(part)) {
            numericProjectId = part
            console.log(`[Rust SCORM] Extracted numeric ID from path: ${numericProjectId}`)
            break
          }
        }
      }
    }
    
    console.log(`[Rust SCORM] Final numeric project ID: ${numericProjectId}`)
    
    // Import FileStorage and check if project is already loaded
    const { FileStorage } = await import('./FileStorage')
    const fileStorage = FileStorage.getInstance()
    
    // Check if project is already loaded (compare with numeric ID only)
    const currentProjectId = (fileStorage as any)._currentProjectId
    if (currentProjectId === numericProjectId) {
      console.log(`[Rust SCORM] Project ${numericProjectId} is already loaded`)
      return
    }
    
    // Construct possible paths based on the numeric ID
    console.log(`[Rust SCORM] Project not loaded, attempting to open project with ID: ${numericProjectId}`)
    const projectsPath = `C:\\Users\\sierr\\Documents\\SCORM Projects`
    const possiblePaths = [
      `${projectsPath}\\${numericProjectId}.scormproj`,
      `${projectsPath}\\Complex_Projects_-_1_-_49_CFR_192_${numericProjectId}.scormproj`,
      // Add more patterns if needed based on user's project naming
    ]
    
    let projectOpened = false
    for (const projectPath of possiblePaths) {
      try {
        console.log(`[Rust SCORM] Trying to open: ${projectPath}`)
        await fileStorage.openProject(projectPath)
        
        // Verify project was actually opened
        const newProjectId = (fileStorage as any)._currentProjectId
        if (newProjectId) {
          console.log(`[Rust SCORM] ✅ Successfully opened project: ${projectPath}`)
          projectOpened = true
          break
        }
      } catch (error) {
        console.log(`[Rust SCORM] Could not open ${projectPath}:`, error instanceof Error ? error.message : String(error))
        continue
      }
    }
    
    if (!projectOpened) {
      console.warn(`[Rust SCORM] ⚠️ Could not open project ${numericProjectId}. Media may not be accessible.`)
      console.warn(`[Rust SCORM] This may cause MediaService to return empty results.`)
    }
    
  } catch (error) {
    console.error(`[Rust SCORM] Error ensuring project is loaded:`, error)
    // Don't throw - let the function continue and fail gracefully if needed
  }
}

/**
 * Clear the media cache (should be called after SCORM generation)
 */
export function clearMediaCache(): void {
  mediaCache.clear()
  debugLogger.debug('SCORM_MEDIA', 'Media cache cleared', { cacheSize: mediaCache.size })
  // Only log cache operations in development
  if (import.meta.env.DEV) {
    console.log('[Rust SCORM] Media cache cleared')
  }
}

/**
 * Extract objectives from HTML content (for CourseContent format)
 */
function extractObjectivesFromContent(content: string): string[] {
  // Simple extraction - look for list items in the content
  const listItemRegex = /<li[^>]*>(.*?)<\/li>/gi
  const objectives: string[] = []
  let match
  
  while ((match = listItemRegex.exec(content)) !== null) {
    // Remove HTML tags and trim
    const objective = safeRegexMatch(match, 1).replace(/<[^>]*>/g, '').trim()
    if (objective) {
      objectives.push(objective)
    }
  }
  
  // If no list items found, split by line breaks and filter
  if (objectives.length === 0) {
    const lines = content.split(/\n|<br\s*\/?>/).map(line => 
      line.replace(/<[^>]*>/g, '').trim()
    ).filter(line => line.length > 0)
    objectives.push(...lines)
  }
  
  return objectives
}

/**
 * Generate YouTube embed URL with clip timing parameters if available
 */
function generateYouTubeEmbedUrl(videoId: string, clipStart?: number, clipEnd?: number): string {
  const baseUrl = `https://www.youtube.com/embed/${videoId}`
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1'
  })
  
  console.log(`[SCORM DEBUG] generateYouTubeEmbedUrl called:`, {
    videoId,
    clipStart,
    clipEnd,
    clipStartType: typeof clipStart,
    clipEndType: typeof clipEnd,
    clipStartUndefined: clipStart === undefined,
    clipEndUndefined: clipEnd === undefined
  })
  
  // Add clip timing parameters if provided
  if (clipStart !== undefined && clipStart >= 0) {
    params.set('start', Math.floor(clipStart).toString())
    // Only log URL parameter details in development
    if (import.meta.env.DEV) {
      console.log(`[SCORM DEBUG] Added start parameter: ${Math.floor(clipStart)}`)
    }
  }
  
  if (clipEnd !== undefined && clipEnd > 0) {
    params.set('end', Math.floor(clipEnd).toString())
    console.log(`[SCORM DEBUG] Added end parameter: ${Math.floor(clipEnd)}`)
  }
  
  const finalUrl = `${baseUrl}?${params.toString()}`
  console.log(`[SCORM DEBUG] Final YouTube embed URL: ${finalUrl}`)
  return finalUrl
}

/**
 * Pre-load media into the cache from a Map of blobs
 * This allows SCORMPackageBuilder to pass already-loaded media
 */
export async function preloadMediaCache(mediaMap: Map<string, Blob>): Promise<void> {
  // Only log verbose cache operations in development
  if (import.meta.env.DEV) {
    console.log(`[Rust SCORM] Pre-loading ${mediaMap.size} media files into cache (filename-keyed)`)
  }

  // Convert to array for parallel processing
  const entries = Array.from(mediaMap.entries())
  const CONCURRENCY = 8 // Process 8 blobs in parallel to avoid RAM spikes

  let currentIndex = 0
  const processBlob = async () => {
    while (currentIndex < entries.length) {
      const entryIndex = currentIndex++
      if (entryIndex >= entries.length) break

      const [filename, blob] = entries[entryIndex]
      try {
        // Extract the media ID from the filename (e.g., 'image-0.jpg' -> 'image-0')
        const mediaId = filename.replace(/\.(jpg|jpeg|png|gif|mp3|mp4|vtt|bin)$/i, '')

        // Convert blob to Uint8Array
        const arrayBuffer = await blob.arrayBuffer()
        const data = new Uint8Array(arrayBuffer)
        const mimeType = blob.type || 'application/octet-stream'

        // Store in cache
        mediaCache.set(mediaId, { data, mimeType })
        // Only log individual cache operations in development
        if (import.meta.env.DEV) {
          console.log(`[Rust SCORM] Cached ${mediaId} (${mimeType}, ${data.length} bytes)`)
        }
      } catch (error) {
        console.error(`[Rust SCORM] Failed to pre-load ${filename}:`, error)
      }
    }
  }

  // Process blobs in parallel with controlled concurrency
  await Promise.all(
    Array.from({ length: CONCURRENCY }, () => processBlob())
  )

  if (import.meta.env.DEV) {
    console.log(`[Rust SCORM] Pre-loading complete. Cache size: ${mediaCache.size}`)
  }
}

/**
 * Hydrate mediaCache with ID-keyed preloaded data (optimal format)
 * This prevents backend calls during generation by providing direct mediaId → data mapping
 */
export function hydrateMediaCacheById(preloadedById: Map<string, { data: Uint8Array; mimeType: string }>): void {
  console.log(`[SCORM Media Debug] Hydrating cache with ${preloadedById.size} preloaded items`)

  for (const [mediaId, mediaData] of preloadedById) {
    mediaCache.set(mediaId, mediaData)
    if (import.meta.env.DEV) {
      console.log(`[SCORM Media Debug] Cached ${mediaId} (${mediaData.mimeType}, ${mediaData.data.length} bytes)`)
    }
  }

  console.log(`[SCORM Media Debug] Cache hydration complete - ${mediaCache.size} total items in cache`)
}

/**
 * Normalize ID-like strings by stripping known extensions
 * This ensures we always work with bare IDs, not URLs with extensions
 */
function normalizeIdLike(s: string): string {
  return s.replace(/\.(jpg|jpeg|png|gif|webp|svg|mp3|mp4|webm|vtt)$/i, '');
}

/**
 * Collect all media IDs from course content for batch pre-loading
 * This scans the entire course structure to extract every media reference
 */
function collectAllMediaIds(courseContent: any): string[] {
  const mediaIds = new Set<string>()

  console.log(`[SCORM Media Pre-Collection] Scanning course content for all media references`)

  // Helper to safely add media ID if it exists and looks valid
  const addMediaId = (id: string | undefined, context: string) => {
    if (id && typeof id === 'string' && id.trim()) {
      // Only add if it looks like a media ID (contains -, numbers, or file extension)
      if (id.includes('-') || /\d/.test(id) || id.includes('.')) {
        // Normalize to bare ID by stripping extensions
        const normalizedId = normalizeIdLike(id.trim())
        mediaIds.add(normalizedId)
        console.log(`[SCORM Media Pre-Collection] Found ${id} → normalized to ${normalizedId} in ${context}`)
      }
    }
  }

  // Scan welcome page
  if (courseContent.welcome || courseContent.welcomePage || courseContent.welcomeMedia) {
    const welcome = courseContent.welcome || courseContent.welcomePage || courseContent.welcomeMedia
    addMediaId(welcome.audioId, 'welcome.audioId')
    addMediaId(welcome.audioFile, 'welcome.audioFile')
    addMediaId(welcome.captionId, 'welcome.captionId')
    addMediaId(welcome.captionFile, 'welcome.captionFile')
    addMediaId(welcome.imageUrl, 'welcome.imageUrl')

    // Scan welcome media array
    if (Array.isArray(welcome.media)) {
      welcome.media.forEach((m: any, i: number) => {
        addMediaId(m?.id, `welcome.media[${i}].id`)
        addMediaId(m?.url, `welcome.media[${i}].url`)
      })
    }
  }

  // Scan objectives/learning objectives page
  const objectives = courseContent.objectivesPage || courseContent.learningObjectivesPage
  if (objectives) {
    addMediaId(objectives.audioId, 'objectives.audioId')
    addMediaId(objectives.audioFile, 'objectives.audioFile')
    addMediaId(objectives.captionId, 'objectives.captionId')
    addMediaId(objectives.captionFile, 'objectives.captionFile')
    addMediaId(objectives.imageUrl, 'objectives.imageUrl')

    // Scan objectives media array
    if (Array.isArray(objectives.media)) {
      objectives.media.forEach((m: any, i: number) => {
        addMediaId(m?.id, `objectives.media[${i}].id`)
        addMediaId(m?.url, `objectives.media[${i}].url`)
      })
    }
  }

  // Scan all topics
  const topics = courseContent.topics || []
  topics.forEach((topic: any, topicIndex: number) => {
    if (!topic) return

    addMediaId(topic.audioId, `topic[${topicIndex}].audioId`)
    addMediaId(topic.audioFile, `topic[${topicIndex}].audioFile`)
    addMediaId(topic.captionId, `topic[${topicIndex}].captionId`)
    addMediaId(topic.captionFile, `topic[${topicIndex}].captionFile`)
    addMediaId(topic.imageUrl, `topic[${topicIndex}].imageUrl`)

    // Scan topic media array
    if (Array.isArray(topic.media)) {
      topic.media.forEach((m: any, mediaIndex: number) => {
        addMediaId(m?.id, `topic[${topicIndex}].media[${mediaIndex}].id`)
        addMediaId(m?.url, `topic[${topicIndex}].media[${mediaIndex}].url`)
      })
    }

    // Scan knowledge check media if present
    if (topic.knowledgeCheck && Array.isArray(topic.knowledgeCheck.questions)) {
      topic.knowledgeCheck.questions.forEach((q: any, qIndex: number) => {
        if (Array.isArray(q.media)) {
          q.media.forEach((m: any, mIndex: number) => {
            addMediaId(m?.id, `topic[${topicIndex}].knowledgeCheck.questions[${qIndex}].media[${mIndex}].id`)
            addMediaId(m?.url, `topic[${topicIndex}].knowledgeCheck.questions[${qIndex}].media[${mIndex}].url`)
          })
        }
      })
    }
  })

  const result = Array.from(mediaIds)
  console.log(`[SCORM Media Pre-Collection] Collected ${result.length} unique media IDs:`, result)
  return result
}

/**
 * Batch pre-load all media IDs into cache before content conversion
 * This eliminates individual media requests during content processing
 */
async function batchPreloadMedia(mediaIds: string[], projectId: string): Promise<void> {
  if (mediaIds.length === 0) {
    console.log(`[SCORM Batch Pre-Load] No media IDs to pre-load`)
    return
  }

  console.log(`[SCORM Batch Pre-Load] ⚡ Pre-loading ${mediaIds.length} media items in single batch`)
  const startTime = Date.now()

  try {
    const { createMediaService } = await import('./MediaService')
    const mediaService = createMediaService(projectId, undefined, true) // Enable generation mode

    // Use direct batch API to load all media at once
    const batchResults = await mediaService.getMediaBatchDirect(mediaIds)

    // Populate cache with results
    let cacheHits = 0
    let cacheMisses = 0

    for (const [mediaId, mediaData] of batchResults) {
      if (mediaData && mediaData.data) {
        // Successfully loaded - add to cache
        mediaCache.set(mediaId, {
          data: mediaData.data,
          mimeType: mediaData.metadata?.mimeType || mediaData.metadata?.mime_type || 'application/octet-stream'
        })
        cacheHits++
        console.log(`[SCORM Batch Pre-Load] ✅ Cached ${mediaId} (${mediaData.data.length} bytes)`)
      } else {
        // Media not found - log but don't fail
        cacheMisses++
        console.log(`[SCORM Batch Pre-Load] ❌ Missing ${mediaId}`)
      }
    }

    const duration = Date.now() - startTime
    console.log(`[SCORM Batch Pre-Load] 🚀 COMPLETED in ${duration}ms: ${cacheHits} cached, ${cacheMisses} missing`)
    console.log(`[SCORM Batch Pre-Load] Cache now contains ${mediaCache.size} total items`)

    // 🚨 STRICT MEDIA MODE: Validate preload results
    if (strictMediaMode.enabled) {
      const validation = validateMediaPreload(mediaIds, cacheHits)
      validation.missingMediaIds = mediaIds.filter(id => !mediaCache.has(id))

      if (!validation.isValid) {
        const errorMessage = [
          `🚨 STRICT MEDIA MODE VIOLATION: Generation failed due to missing media`,
          `📊 Requested: ${validation.requestedCount}, Cached: ${validation.cachedCount}, Missing: ${validation.missingCount}`,
          `🚫 Maximum allowed missing media: ${strictMediaMode.maxMissingMedia}`,
          `❌ Missing media IDs:`,
          ...validation.missingMediaIds.map(id => `   - ${id}`)
        ].join('\n')

        debugLogger.error('STRICT_MEDIA_MODE', 'Generation failed due to missing media', {
          projectId,
          requestedCount: validation.requestedCount,
          cachedCount: validation.cachedCount,
          missingCount: validation.missingCount,
          maxAllowed: strictMediaMode.maxMissingMedia,
          missingMediaIds: validation.missingMediaIds
        })

        throw new Error(errorMessage)
      } else {
        console.log(`[STRICT MEDIA MODE] ✅ Validation passed: ${validation.missingCount}/${strictMediaMode.maxMissingMedia} missing media allowed`)
      }
    }

    // Track performance for monitoring
    if (performanceTrace) {
      performanceTrace.batchedLoads += 1
      performanceTrace.cacheHits += cacheHits
      performanceTrace.cacheMisses += cacheMisses
    }

  } catch (error) {
    console.error(`[SCORM Batch Pre-Load] ❌ FAILED:`, error)

    // Re-throw strict mode violations
    if (error instanceof Error && error.message.includes('STRICT MEDIA MODE VIOLATION')) {
      throw error
    }

    // For other errors, don't throw - let content conversion proceed with individual requests as fallback
  }
}

/**
 * Validate that image URLs have correct extensions matching actual files
 */
function validateImageExtensions(mediaFiles: MediaFile[], expectedUrls: string[]): void {
  const diagnostics: string[] = []

  for (const expectedUrl of expectedUrls) {
    if (!expectedUrl || !expectedUrl.startsWith('media/')) continue

    const expectedFilename = expectedUrl.replace('media/', '')
    const actualFile = mediaFiles.find(f => f.filename === expectedFilename)

    if (!actualFile) {
      diagnostics.push(`❌ HTML expects "${expectedFilename}" but file not found in mediaFiles`)
    } else {
      console.log(`✅ Extension match: HTML expects "${expectedFilename}" → File exists`)
    }
  }

  if (diagnostics.length > 0) {
    console.warn(`[EXTENSION MISMATCH] Found ${diagnostics.length} extension mismatches:`)
    diagnostics.forEach(d => console.warn(`  ${d}`))
  } else {
    console.log(`[EXTENSION VALIDATION] ✅ All ${expectedUrls.length} image extensions validated successfully`)
  }
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  // Return empty string for invalid MIME types to allow fallback patterns to work
  if (!mimeType || !mimeType.trim()) return ''
  
  const mimeToExt: Record<string, string> = {
    // Images
    'image/svg+xml': 'svg',
    'image/png': 'png', 
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    // Audio
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/aac': 'aac',
    'audio/m4a': 'm4a',
    // Video  
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/avi': 'avi',
    'video/mov': 'mov',
    'video/quicktime': 'mov',
    // Captions
    'text/vtt': 'vtt',
    'text/srt': 'srt',
    // JSON for YouTube metadata
    'application/json': 'json',
    'text/plain': 'txt'
  }
  
  const ext = mimeToExt[mimeType.toLowerCase()]
  if (ext) {
    console.log(`[rustScormGenerator] MIME type "${mimeType}" mapped to extension "${ext}"`)
    return ext
  }
  
  console.log(`[rustScormGenerator] Unknown MIME type "${mimeType}", returning empty for fallback`)
  return '' // Return empty to allow fallback pattern to work
}

/**
 * Get extension from media ID (fallback when no MIME type)
 * This should avoid .bin for known media types
 */
export function getExtensionFromMediaId(mediaId: string): string {
  if (mediaId.startsWith('audio-')) return 'mp3'
  if (mediaId.startsWith('caption-')) return 'vtt'
  if (mediaId.startsWith('image-')) return 'jpg' // Default to jpg for images
  if (mediaId.startsWith('video-')) {
    // Video IDs should not generate files - they should be YouTube embeds
    console.warn(`[rustScormGenerator] Video ID "${mediaId}" should be handled as YouTube embed, not file`)
    return 'json' // If it must be a file, store as JSON metadata
  }
  if (mediaId.startsWith('youtube-')) return 'json' // YouTube metadata
  
  console.warn(`[rustScormGenerator] Unknown media ID pattern "${mediaId}", defaulting to .bin`)
  return 'bin'
}

/**
 * Resolve audio/caption file and add to media files
 */
async function resolveAudioCaptionFile(
  fileId: string | undefined,
  projectId: string,
  mediaFiles: MediaFile[],
  blob?: Blob
): Promise<string | undefined> {
  console.log(`[Rust SCORM] resolveAudioCaptionFile called with fileId: ${fileId}`)
  if (!fileId && !blob) return undefined
  
  // Defensive check: Don't try to fetch media with invalid high indices
  // We have 11 topics (0-10), so valid audio/caption IDs are 0-12 (welcome=0, objectives=1, topics=2-12)
  // But if topic-10 has no audio, we shouldn't have audio-12 or caption-12
  if (fileId && fileId.match(/^(audio|caption)-(\d+)$/)) {
    const match = fileId.match(/^(audio|caption)-(\d+)$/)
    if (match) {
      const index = safeParseInt(safeRegexMatch(match, 2), 0, 0, 20)
      // If index is suspiciously high (> 20), it's likely an error
      if (index > 20) {
        console.warn(`[Rust SCORM] Skipping suspicious media ID with high index: ${fileId}`)
        return undefined
      }
    }
  }
  
  // If we have a blob, use it directly
  if (blob && fileId) {
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const mimeType = blob.type || 'application/octet-stream'
      const cleanFileId = fileId.endsWith('.bin') ? fileId.replace('.bin', '') : fileId
      const ext = getExtensionFromMimeType(mimeType) || getExtensionFromMediaId(cleanFileId)
      const filename = `${cleanFileId}.${ext}`
      
      mediaFiles.push({
        filename,
        content: uint8Array,
      })
      
      return `media/${filename}`
    } catch (error) {
      console.error(`[Rust SCORM] Failed to process blob:`, error)
    }
  }
  
  if (!fileId) return undefined
  
  // Strip .bin extension if present
  const cleanFileId = fileId.endsWith('.bin') ? fileId.replace('.bin', '') : fileId
  
  // If it's already a path (media/...), return as-is
  if (cleanFileId.startsWith('media/')) {
    return cleanFileId
  }
  
  // Check if this file was already processed
  const existingFile = mediaFiles.find(f => f.filename === cleanFileId || f.filename.startsWith(cleanFileId + '.'))
  if (existingFile) {
    return `media/${existingFile.filename}`
  }
  
  // If it's a media ID, load from MediaService
  if (cleanFileId.match(/^(audio|caption)-[\w-]+$/)) {
    // Check cache first
    const cached = mediaCache.get(cleanFileId)
    if (cached) {
      console.log(`[SCORM Media Debug] Cache HIT for ${cleanFileId}`)
      if (performanceTrace) performanceTrace.cacheHits++
      const ext = getExtensionFromMimeType(cached.mimeType) || getExtensionFromMediaId(cleanFileId)
      const filename = `${cleanFileId}.${ext}`
      
      // Add to mediaFiles if not already there
      if (!mediaFiles.find(f => f.filename === filename)) {
        mediaFiles.push({
          filename,
          content: cached.data,
        })
      }
      
      return `media/${filename}`
    }
    
    // Media should be pre-loaded in cache - if not found, it doesn't exist
    mediaServiceCallDetector.checkForRegressionCall('resolveAudioCaptionFile')
    console.log(`[SCORM Media Debug] Cache MISS for ${cleanFileId} - media should be pre-loaded, skipping`)
    if (performanceTrace) performanceTrace.cacheMisses++
    debugLogger.warn('SCORM_MEDIA', 'Media file not found in pre-loaded cache', {
      projectId,
      fileId: cleanFileId,
      originalFileId: fileId
    })
    console.warn(`[Rust SCORM] Media not found in pre-loaded cache: ${cleanFileId}, skipping`)
    return undefined
  }
  
  // Otherwise, return as-is (might be a direct filename)
  return fileId
}

// 🔧 FIX: Media ID to filename mapping tracker for consistent naming
const mediaIdToFilename = new Map<string, string>()

/**
 * Resolve a single image URL/ID and add to media files
 */
async function resolveImageUrl(
  imageUrl: string | undefined,
  projectId: string,
  mediaFiles: MediaFile[],
  mediaCounter: { [type: string]: number }
): Promise<string | undefined> {
  // Only log when we have a valid imageUrl to avoid cluttering logs with undefined values
  if (!imageUrl) {
    return undefined;
  }
  
  console.log(`[Rust SCORM] resolveImageUrl called with:`, imageUrl)
  
  // If it's an external URL, try to download it
  if (isExternalUrl(imageUrl)) {
    console.log(`[Rust SCORM] Processing external image:`, imageUrl)

    // 🔧 FIX: Check if we already processed this external URL
    const existingFilename = mediaIdToFilename.get(imageUrl)
    if (existingFilename) {
      console.log(`[Rust SCORM] Using existing filename for external URL ${imageUrl}: ${existingFilename}`)
      return `media/${existingFilename}`
    }

    try {
      const blob = await downloadIfExternal(imageUrl)
      if (blob) {
        // Convert to media file
        const arrayBuffer = await blob.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const mimeType = blob.type || 'image/jpeg'
        const ext = getExtensionFromMimeType(mimeType) || 'jpg' // External images default to jpg

        if (!mediaCounter.image) mediaCounter.image = 0
        mediaCounter.image++
        const filename = `image-${mediaCounter.image}.${ext}`

        // 🔧 FIX: Track external URL mapping
        mediaIdToFilename.set(imageUrl, filename)
        console.log(`[EXTENSION DEBUG] External URL ${imageUrl} → filename: ${filename}, mimeType: ${mimeType}, extension: ${ext}`)

        mediaFiles.push({
          filename,
          content: uint8Array,
        })

        return `media/${filename}`
      }
    } catch (error) {
      console.warn(`[Rust SCORM] Could not download external image: ${imageUrl}`, error instanceof Error ? error.message : error)
      // Continue with fallback handling - external image failures should not block SCORM generation
    }
    // If download fails, keep the original external URL
    return imageUrl
  }
  
  // If it's a media ID (like "image-abc123"), load it from MediaService
  if (imageUrl.match(/^(image|video|audio)-[\w-]+$/)) {
    console.log(`[Rust SCORM] Loading media from MediaService:`, imageUrl)
    
    // Check cache first
    const cached = mediaCache.get(imageUrl)
    if (cached) {
      console.log(`[SCORM Media Debug] Cache HIT for ${imageUrl}`)
      console.log(`[Rust SCORM] Using cached media:`, imageUrl)
      
      // Check if this is a video metadata JSON file
      if (imageUrl.startsWith('video-') && (cached.mimeType === 'application/json' || cached.mimeType === 'text/plain')) {
        try {
          const jsonText = new TextDecoder().decode(cached.data)
          const metadata = safeJsonParse(jsonText, {})
          if (metadata.url && (metadata.url.includes('youtube.com') || metadata.url.includes('youtu.be'))) {
            console.log(`[Rust SCORM] Found YouTube URL in cached metadata:`, metadata.url)
            return metadata.url
          }
          if (metadata.embed_url && (metadata.embed_url.includes('youtube.com') || metadata.embed_url.includes('youtu.be'))) {
            console.log(`[Rust SCORM] Found YouTube embed URL in cached metadata:`, metadata.embed_url)
            return metadata.embed_url
          }
        } catch (error) {
          console.error(`[Rust SCORM] Failed to parse cached video metadata:`, error)
        }
      }
      
      // 🔧 FIX: Use consistent counter-based naming for all images
      // Check if we already have a filename for this media ID
      const existingFilename = mediaIdToFilename.get(imageUrl)
      if (existingFilename) {
        console.log(`[Rust SCORM] Using existing counter-based filename for ${imageUrl}: ${existingFilename}`)
        return `media/${existingFilename}`
      }

      // Generate new counter-based filename
      if (!mediaCounter.image) mediaCounter.image = 0
      mediaCounter.image++

      // Use authoritative extension map first, fallback to cache MIME, no more image→jpg fallback
      let ext = authoritativeExtensionMap.get(imageUrl)?.substring(1) // Remove the dot
      if (!ext) {
        ext = getExtensionFromMimeType(cached.mimeType)
      }
      if (!ext) {
        console.warn(`[Extension Map] No extension found for ${imageUrl}, using 'bin' as last resort`)
        ext = 'bin'
      }

      const filename = `image-${mediaCounter.image}.${ext}`

      // Track the mapping
      mediaIdToFilename.set(imageUrl, filename)
      console.log(`[EXTENSION DEBUG] Cached media ${imageUrl} → filename: ${filename}, mimeType: ${cached.mimeType}, extension: ${ext}`)

      // Add to mediaFiles if not already there
      if (!mediaFiles.find(f => f.filename === filename)) {
        console.log(`[Rust SCORM] Adding cached image to mediaFiles with counter-based name:`, {
          imageUrl,
          filename,
          mimeType: cached.mimeType,
          dataSize: cached.data.length
        })

        mediaFiles.push({
          filename,
          content: cached.data,
        })
      }

      return `media/${filename}`
    } else {
      console.log(`[SCORM Media Debug] Cache MISS for ${imageUrl}`)
    }

    // Media should be pre-loaded in cache - if not found, it doesn't exist
    mediaServiceCallDetector.checkForRegressionCall('resolveImageUrl')
    console.log(`[Rust SCORM] Media not found in pre-loaded cache: ${imageUrl}, skipping`)
    debugLogger.warn('SCORM_MEDIA', 'Media not found in pre-loaded cache', {
      projectId,
      imageUrl
    })
    return undefined
  }
  
  // Otherwise, assume it's already a package-relative path
  console.log(`[Rust SCORM] Using URL as-is:`, imageUrl)
  return imageUrl
}

/**
 * 🚀 PHASE 1: Prefetch all media from MediaService in parallel
 * This eliminates the sequential request issue and enables proper batching
 */
async function prefetchAllMedia(
  mediaIdSet: Set<string>,
  projectId: string,
  mediaCache: Map<string, { data: Uint8Array, mimeType: string }>
): Promise<void> {
  const mediaIds = Array.from(mediaIdSet)
  if (mediaIds.length === 0) return

  console.log(`[SCORM Prefetch] 🚀 Starting parallel prefetch of ${mediaIds.length} media items`)
  debugLogger.info('SCORM_PREFETCH', 'Starting media prefetch', {
    projectId,
    mediaCount: mediaIds.length,
    mediaIds: mediaIds.slice(0, 5) // Log first 5 for debugging
  })

  try {
    const { createMediaService } = await import('./MediaService')
    const mediaService = createMediaService(projectId, undefined, true) // 🚀 Enable generation mode

    // 🚀 Use direct batch API for prefetch
    const startTime = Date.now()
    const batchResults = await mediaService.getMediaBatchDirect(mediaIds)

    const fetchTime = Date.now() - startTime
    console.log(`[SCORM Prefetch] ✅ Completed prefetch batch in ${fetchTime}ms`)

    // Convert batch results to expected format
    const mediaResults = mediaIds.map(mediaId => ({
      mediaId,
      fileData: batchResults.get(mediaId)
    }))

    // Cache the results
    let successCount = 0
    let failureCount = 0

    for (const { mediaId, fileData } of mediaResults) {
      if (fileData && fileData.data) {
        const uint8Data = new Uint8Array(fileData.data)
        const mimeType = fileData.metadata?.mimeType || 'application/octet-stream'
        mediaCache.set(mediaId, { data: uint8Data, mimeType })
        successCount++
      } else {
        failureCount++
      }
    }

    console.log(`[SCORM Prefetch] 📊 Results: ${successCount} successful, ${failureCount} failed`)
    debugLogger.info('SCORM_PREFETCH', 'Prefetch completed', {
      projectId,
      totalTime: fetchTime,
      successCount,
      failureCount,
      cacheSize: mediaCache.size
    })

  } catch (error) {
    console.error(`[SCORM Prefetch] ❌ Prefetch failed:`, error)
    debugLogger.error('SCORM_PREFETCH', 'Prefetch failed', { projectId, error })
  }
}

/**
 * 🚀 PHASE 1: Extract all media IDs from course content
 * This collects all media that will be needed during generation
 */
function extractAllMediaIds(courseContent: CourseContent | EnhancedCourseContent): Set<string> {
  const mediaIds = new Set<string>()

  // Helper function to add media from any object
  const addMediaFromArray = (media: any[] | undefined) => {
    if (!media) return
    for (const item of media) {
      if (item?.id && typeof item.id === 'string') {
        mediaIds.add(item.id)
      }
    }
  }

  // Helper function to add audio/caption IDs
  const addAudioCaptionIds = (audioId?: string, audioFile?: string, captionId?: string, captionFile?: string) => {
    if (audioId) mediaIds.add(audioId)
    if (audioFile && audioFile.match(/^(audio|caption)-[\w-]+$/)) mediaIds.add(audioFile)
    if (captionId) mediaIds.add(captionId)
    if (captionFile && captionFile.match(/^(audio|caption)-[\w-]+$/)) mediaIds.add(captionFile)
  }

  // Welcome page media (safe property access)
  const welcome = (courseContent as any).welcome || (courseContent as any).welcomePage
  if (welcome) {
    addMediaFromArray(welcome.media)
    addAudioCaptionIds(
      welcome.audioId,
      welcome.audioFile,
      welcome.captionId,
      welcome.captionFile
    )
  }

  // Objectives page media (safe property access)
  const objectivesPage = (courseContent as any).objectivesPage || (courseContent as any).learningObjectivesPage
  if (objectivesPage) {
    addMediaFromArray(objectivesPage.media)
    addAudioCaptionIds(
      objectivesPage.audioId,
      objectivesPage.audioFile,
      objectivesPage.captionId,
      objectivesPage.captionFile
    )
  }

  // Legacy learningObjectivesPage support
  const legacyObjectives = (courseContent as any).learningObjectivesPage
  if (legacyObjectives) {
    addMediaFromArray(legacyObjectives.media)
    addAudioCaptionIds(
      legacyObjectives.audioId,
      legacyObjectives.audioFile,
      legacyObjectives.captionId,
      legacyObjectives.captionFile
    )
  }

  // Topics media (safe property access)
  const topics = (courseContent as any).topics
  if (topics && Array.isArray(topics)) {
    for (const topic of topics) {
      addMediaFromArray(topic.media)
      addAudioCaptionIds(
        topic.audioId,
        topic.audioFile,
        topic.captionId,
        topic.captionFile
      )

      // Media from knowledge check questions
      if (topic.knowledgeCheck?.questions) {
        for (const question of topic.knowledgeCheck.questions) {
          addMediaFromArray((question as any).media)
        }
      }
    }
  }

  console.log(`[SCORM Extract] Found ${mediaIds.size} unique media IDs:`, Array.from(mediaIds).slice(0, 10))
  return mediaIds
}

/**
 * Resolve media items and collect media files
 */
async function resolveMedia(
  mediaItems: any[] | undefined,
  projectId: string,
  mediaFiles: MediaFile[],
  mediaCounter: { [type: string]: number }
): Promise<any[] | undefined> {
  if (!mediaItems || mediaItems.length === 0) return mediaItems
  
  debugLogger.debug('SCORM_MEDIA', 'Starting media resolution', {
    projectId,
    mediaItemsCount: mediaItems.length,
    currentMediaFilesCount: mediaFiles.length,
    mediaItems: mediaItems.map(m => ({ id: m.id, type: m.type, hasUrl: !!m.url, url: m.url }))
  })
  
  console.log(`[SCORM Media Debug] Starting resolution for ${mediaItems.length} media items:`)
  mediaItems.forEach((item, idx) => {
    console.log(`  ${idx + 1}. ID: ${item.id}, Type: ${item.type}, URL: ${item.url || 'none'}, Title: ${item.title || 'none'}`)
  })
  
  const resolvedMedia = []
  const mediaLoadingErrors: string[] = []
  
  for (let i = 0; i < mediaItems.length; i++) {
    const media = mediaItems[i]
    console.log(`[SCORM Media Debug] Processing media ${i + 1}/${mediaItems.length}: ${media.id}`)
    if (!media.url) {
      // If no URL but we have an ID, try to load from MediaService
      if (media.id && media.id.match(/^(image|video|audio|caption)-[\w-]+$/)) {
        console.log(`[Rust SCORM] No URL provided, loading from MediaService using ID: ${media.id}`)
        
        try {
          // Check cache first
          const cached = mediaCache.get(media.id)
          if (cached) {
            console.log(`[SCORM Media Debug] Cache HIT for ${media.id}`)
            console.log(`[Rust SCORM] Using cached media:`, media.id)
            const ext = getExtensionFromMimeType(cached.mimeType) || getExtensionFromMediaId(media.id)
            const filename = `${media.id}.${ext}`
            
            // Add to mediaFiles if not already there
            if (!mediaFiles.find(f => f.filename === filename)) {
              mediaFiles.push({
                filename,
                content: cached.data,
              })
            }
            
            resolvedMedia.push({
              ...media,
              url: `media/${filename}`,
              resolved_path: `media/${filename}`
            })
            continue
          } else {
            console.log(`[SCORM Media Debug] Cache MISS for ${media.id}`)
          }

          // Media should be pre-loaded in cache - if not found, it doesn't exist
          console.log(`[SCORM Media Debug] Media not found in pre-loaded cache: ${media.id}, skipping`)
          debugLogger.warn('SCORM_MEDIA', 'Media not found in pre-loaded cache', {
            projectId,
            mediaId: media.id
          })
          const errorMsg = `Media not found in pre-loaded cache: ${media.id}`
          mediaLoadingErrors.push(errorMsg)
          // Don't add to resolvedMedia - skip this item
          continue
        } catch (error) {
          const errorMsg = `Failed to load media ${media.id}: ${error instanceof Error ? error.message : String(error)}`
          debugLogger.error('SCORM_MEDIA', 'Media loading exception during resolution', {
            projectId,
            mediaId: media.id,
            mediaType: media.type,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          })
          console.warn(`[Rust SCORM] ${errorMsg}`)
          mediaLoadingErrors.push(errorMsg)
          // Don't add to resolvedMedia - skip this item
          continue
        }
      }
      
      // If we couldn't load it, push as-is
      resolvedMedia.push(media)
      continue
    }
    
    // Handle different types of media URLs
    let resolvedUrl: string | undefined = undefined
    
    // Check if URL is an asset.localhost URL that needs to be resolved
    if (media.url && media.url.includes('asset.localhost')) {
      // Extract the media ID from the URL
      // Format: http://asset.localhost/...%5Cmedia%5Cvideo-0.bin
      const match = media.url.match(/media%5C([\w-]+)\.bin/)
      if (match) {
        const mediaId = safeRegexMatch(match, 1)
        console.log(`[Rust SCORM] Detected asset.localhost URL for media ID:`, mediaId)
        
        // Try to load and check if it's YouTube metadata
        if (mediaId.startsWith('video-')) {
          // Check cache first
          const cached = mediaCache.get(mediaId)
          if (cached && cached.mimeType === 'application/json') {
            console.log(`[SCORM Media Debug] Cache HIT for ${mediaId}`)
            try {
              const jsonText = new TextDecoder().decode(cached.data)
              const metadata = safeJsonParse(jsonText, {})
              if (metadata.url && (metadata.url.includes('youtube.com') || metadata.url.includes('youtu.be'))) {
                console.log(`[Rust SCORM] Resolved asset.localhost to YouTube URL from cache:`, metadata.url)
                media.url = metadata.url
              }
            } catch (error) {
              console.error(`[Rust SCORM] Failed to parse cached asset.localhost metadata:`, error)
            }
          } else {
            console.log(`[SCORM Media Debug] Cache MISS for ${mediaId}`)
            // Media should be pre-loaded in cache - if not found, skip asset.localhost resolution
            mediaServiceCallDetector.checkForRegressionCall('resolveMedia asset.localhost')
            console.log(`[SCORM Media Debug] asset.localhost media not found in pre-loaded cache: ${mediaId}, skipping resolution`)
            debugLogger.warn('SCORM_MEDIA', 'asset.localhost media not found in pre-loaded cache', {
              projectId,
              mediaId,
              originalUrl: media.url
            })
          }
        }
      }
    }
    
    // Check if it's a YouTube video - extract the video ID
    if ((media.type === 'video' || media.type === 'youtube') && media.url && (media.url.includes('youtube.com') || media.url.includes('youtu.be'))) {
      let videoId = ''
      
      // Extract YouTube video ID
      if (media.url.includes('youtube.com/watch?v=')) {
        const match = media.url.match(/[?&]v=([^&]+)/)
        if (match) videoId = safeRegexMatch(match, 1)
      } else if (media.url.includes('youtu.be/')) {
        const match = media.url.match(/youtu\.be\/([^?]+)/)
        if (match) videoId = safeRegexMatch(match, 1)
      }
      
      console.log(`[SCORM DEBUG] Processing YouTube media for SCORM:`, {
        mediaId: media.id,
        videoId: videoId,
        clipStart: media.clip_start || media.clipStart,  // Support both property formats
        clipEnd: media.clip_end || media.clipEnd,        // Support both property formats
        originalUrl: media.url,
        isYouTube: media.isYouTube,
        embedUrl: media.embedUrl
      })
      
      const embedUrl = generateYouTubeEmbedUrl(
        videoId, 
        media.clip_start || media.clipStart,  // Support both property formats
        media.clip_end || media.clipEnd       // Support both property formats
      )
      console.log(`[SCORM DEBUG] Generated YouTube embed URL:`, {
        videoId,
        clipStart: media.clip_start || media.clipStart,  // Support both property formats
        clipEnd: media.clip_end || media.clipEnd,        // Support both property formats
        generatedEmbedUrl: embedUrl
      })
      
      // Enhanced diagnostic logging for YouTube clipping
      const diagnosis = diagnoseYouTubeVideo(media.url, media.clip_start || media.clipStart, media.clip_end || media.clipEnd, embedUrl)
      if (!diagnosis.isProcessedCorrectly || diagnosis.errors.length > 0) {
        console.warn(`[YOUTUBE DIAGNOSTICS] Issues detected with video ${videoId}:`, diagnosis)
        debugLogger.warn('YOUTUBE_CLIPPING', 'YouTube video processing issues detected', {
          projectId,
          videoId,
          originalUrl: media.url,
          clipStart: media.clip_start || media.clipStart,
          clipEnd: media.clip_end || media.clipEnd,
          expectedEmbedUrl: diagnosis.expectedEmbedUrl,
          actualEmbedUrl: embedUrl,
          errors: diagnosis.errors,
          warnings: diagnosis.warnings
        })
      } else if (diagnosis.warnings.length > 0) {
        console.log(`[YOUTUBE DIAGNOSTICS] Warnings for video ${videoId}:`, diagnosis.warnings)
      } else {
        console.log(`[YOUTUBE DIAGNOSTICS] ✅ Video ${videoId} clipping processed correctly`)
      }
      
      resolvedMedia.push({
        ...media,
        url: media.url,
        is_youtube: true,
        youtube_id: videoId,
        embed_url: embedUrl
      })
      continue
    }
    // 🔧 ADDITIONAL FIX: Catch any YouTube URLs that weren't caught by main detection
    else if (media.url && (media.url.includes('youtube.com') || media.url.includes('youtu.be'))) {
      console.warn(`[Rust SCORM] ⚠️  YouTube URL not caught by main detection, processing as fallback:`)
      console.warn(`  URL: ${media.url}`)
      console.warn(`  Type: ${media.type}`)
      
      // Try to extract video ID and process as YouTube video
      let videoId = ''
      if (media.url.includes('youtube.com/watch?v=')) {
        const match = media.url.match(/[?&]v=([^&]+)/)
        if (match) videoId = safeRegexMatch(match, 1)
      } else if (media.url.includes('youtu.be/')) {
        const match = media.url.match(/youtu\.be\/([^?]+)/)
        if (match) videoId = safeRegexMatch(match, 1)
      } else if (media.url.includes('youtube.com/embed/')) {
        const match = media.url.match(/embed\/([^?]+)/)
        if (match) videoId = safeRegexMatch(match, 1)
      }
      
      if (videoId) {
        const embedUrl = generateYouTubeEmbedUrl(videoId, media.clip_start || media.clipStart, media.clip_end || media.clipEnd)
        console.log(`[Rust SCORM] ✅ Successfully processed fallback YouTube video: ${videoId}`)
        
        resolvedMedia.push({
          ...media,
          url: media.url,
          is_youtube: true,
          youtube_id: videoId,
          embed_url: embedUrl
        })
        continue
      } else {
        console.error(`[Rust SCORM] ❌ Failed to extract video ID from YouTube URL: ${media.url}`)
      }
    }
    // 🔧 FIX: If it's an external URL (non-YouTube), download it
    // CRITICAL: Exclude YouTube URLs from external download attempts
    else if (isExternalUrl(media.url) && !media.url.includes('youtube.com') && !media.url.includes('youtu.be')) {
      try {
        console.log(`[Rust SCORM] Downloading external media: ${media.url}`)
        
        // 🔧 ADDITIONAL SAFETY: Double-check for YouTube URLs that shouldn't be downloaded
        if (media.url.includes('youtube.com') || media.url.includes('youtu.be')) {
          console.error(`[Rust SCORM] 🚨 CRITICAL ERROR: Attempted to download YouTube URL as external media!`)
          console.error(`  URL: ${media.url}`)
          console.error(`  This YouTube URL should have been processed as embedded content, not downloaded.`)
          console.error(`  Skipping download to prevent error.`)
          continue
        }
        
        const blob = await downloadIfExternal(media.url)
        
        if (blob) {
          const arrayBuffer = await blob.arrayBuffer()
          const uint8Array = new Uint8Array(arrayBuffer)
          const mimeType = blob.type || 'image/jpeg'
          const ext = getExtensionFromMimeType(mimeType) || 'jpg' // External media default to jpg
          
          const type = media.type || 'image'
          if (!mediaCounter[type]) mediaCounter[type] = 0
          mediaCounter[type]++
          const filename = `${type}-${mediaCounter[type]}.${ext}`
          
          mediaFiles.push({
            filename,
            content: uint8Array,
          })
          
          resolvedUrl = `media/${filename}`
        }
      } catch (error) {
        console.warn(`[Rust SCORM] Could not download external media: ${media.url}`, error instanceof Error ? error.message : error)
        // Continue with processing - external media failures should not block SCORM generation
        // The media will simply be excluded from the package
      }
    }
    // If it's a media ID, load from MediaService
    else if (media.url.match(/^(image|video|audio)-[\w-]+$/)) {
      // Check cache first
      const cached = mediaCache.get(media.url)
      if (cached) {
        console.log(`[SCORM Media Debug] Cache HIT for ${media.url}`)
        console.log(`[Rust SCORM] Using cached media in resolveMedia:`, media.url)
        
        // Check if this is a video metadata JSON file
        if (media.type === 'video' && cached.mimeType === 'application/json') {
          try {
            const jsonText = new TextDecoder().decode(cached.data)
            const metadata = safeJsonParse(jsonText, {})
            if (metadata.url && (metadata.url.includes('youtube.com') || metadata.url.includes('youtu.be'))) {
              console.log(`[Rust SCORM] Found YouTube URL in cached video metadata:`, metadata.url)
              resolvedUrl = metadata.url
            }
          } catch (error) {
            console.error(`[Rust SCORM] Failed to parse cached video metadata:`, error)
          }
        }
        
        // If not YouTube metadata, process as regular file
        if (!resolvedUrl) {
          const ext = getExtensionFromMimeType(cached.mimeType) || getExtensionFromMediaId(media.url)
          const filename = `${media.url}.${ext}`
          
          // Add to mediaFiles if not already there
          if (!mediaFiles.find(f => f.filename === filename)) {
            mediaFiles.push({
              filename,
              content: cached.data,
            })
          }
          
          resolvedUrl = `media/${filename}`
        }
      } else {
        console.log(`[SCORM Media Debug] Cache MISS for ${media.url}`)
        // Media should be pre-loaded in cache - if not found, it doesn't exist
        mediaServiceCallDetector.checkForRegressionCall('resolveMedia media.url')
        console.log(`[SCORM Media Debug] Media not found in pre-loaded cache: ${media.url}, skipping`)
        debugLogger.warn('SCORM_MEDIA', 'Media not found in pre-loaded cache', {
          projectId,
          mediaUrl: media.url,
          mediaType: media.type
        })
        resolvedUrl = undefined
      }
    }
    // If URL already starts with "media/", use it directly
    else if (media.url.startsWith('media/')) {
      console.log(`[SCORM Media Debug] Media URL already starts with 'media/', using directly: ${media.url}`)
      resolvedUrl = media.url
    }
    // If it has a storageId, use that instead
    else if ((media as any).storageId) {
      const storageId = (media as any).storageId

      // Check cache first
      const cached = mediaCache.get(storageId)
      if (cached) {
        console.log(`[SCORM Media Debug] Cache HIT for ${storageId}`)
        console.log(`[Rust SCORM] Using cached media for storageId:`, storageId)
        const ext = getExtensionFromMimeType(cached.mimeType) || getExtensionFromMediaId(storageId)
        const filename = `${storageId}.${ext}`

        // Add to mediaFiles if not already there
        if (!mediaFiles.find(f => f.filename === filename)) {
          mediaFiles.push({
            filename,
            content: cached.data,
          })
        }

        resolvedUrl = `media/${filename}`
      } else {
        console.log(`[SCORM Media Debug] Cache MISS for ${storageId}`)
        // Media should be pre-loaded in cache - if not found, it doesn't exist
        mediaServiceCallDetector.checkForRegressionCall('resolveMedia storageId')
        console.log(`[SCORM Media Debug] Storage media not found in pre-loaded cache: ${storageId}, skipping`)
        debugLogger.warn('SCORM_MEDIA', 'Storage media not found in pre-loaded cache', {
          projectId,
          storageId,
          mediaType: media.type
        })
        resolvedUrl = undefined
      }
    }
    // Handle blob URLs by immediately falling back to MediaService
    else if (media.url && media.url.startsWith('blob:')) {
      // Skip blob URL fetch attempt - logs show they consistently fail with ERR_FILE_NOT_FOUND
      // Go directly to MediaService using media.id if available
      if (media.id && media.id.match(/^(image|video|audio)-[\w-]+$/)) {
        console.log(`[Rust SCORM] Skipping blob URL, loading directly from MediaService: ${media.id}`)
        
        // Check cache first
        const cached = mediaCache.get(media.id)
        if (cached) {
          console.log(`[SCORM Media Debug] Cache HIT for ${media.id}`)
          console.log(`[Rust SCORM] Using cached media for blob URL fallback:`, media.id)
          const ext = getExtensionFromMimeType(cached.mimeType) || getExtensionFromMediaId(media.id)
          const filename = `${media.id}.${ext}`
          
          // Add to mediaFiles if not already there
          if (!mediaFiles.find(f => f.filename === filename)) {
            mediaFiles.push({
              filename,
              content: cached.data,
            })
          }
          
          resolvedUrl = `media/${filename}`
        } else {
          console.log(`[SCORM Media Debug] Cache MISS for ${media.id}`)
          // Media should be pre-loaded in cache - if not found, skip blob URL recovery
          mediaServiceCallDetector.checkForRegressionCall('resolveMedia blob URL fallback')
          console.log(`[SCORM Media Debug] Blob URL media not found in pre-loaded cache: ${media.id}, skipping`)
          debugLogger.warn('SCORM_MEDIA', 'Blob URL media not found in pre-loaded cache', {
            projectId,
            mediaId: media.id,
            blobUrl: media.url
          })
          resolvedUrl = undefined
        }
      } else {
        // Skip this media item if we can't recover it
        resolvedUrl = undefined
      }
    }
    // Otherwise, assume it's already a package-relative path
    else {
      resolvedUrl = media.url
    }
    
    // Check if this is a YouTube video
    if (media.type === 'video' && media.url && (media.url.includes('youtube.com') || media.url.includes('youtu.be'))) {
      let videoId = ''
      
      // Extract YouTube video ID
      if (media.url.includes('youtube.com/watch?v=')) {
        const match = media.url.match(/[?&]v=([^&]+)/)
        if (match) videoId = safeRegexMatch(match, 1)
      } else if (media.url.includes('youtu.be/')) {
        const match = media.url.match(/youtu\.be\/([^?]+)/)
        if (match) videoId = safeRegexMatch(match, 1)
      } else if (media.url.includes('youtube.com/embed/')) {
        const match = media.url.match(/embed\/([^?]+)/)
        if (match) videoId = safeRegexMatch(match, 1)
      }
      
      resolvedMedia.push({
        ...media,
        url: media.url, // Keep original URL
        is_youtube: true,
        youtube_id: videoId,
        embed_url: videoId ? generateYouTubeEmbedUrl(
          videoId, 
          media.clip_start || media.clipStart,  // Support both property name formats
          media.clip_end || media.clipEnd       // Support both property name formats
        ) : ''
      })
    } else if (resolvedUrl) {
      // For non-YouTube media, only add if we have a valid resolved URL
      const resolvedMediaItem = { ...media, url: resolvedUrl }
      console.log(`[TypeScript Media Debug] Adding resolved media to array:`, {
        originalId: media.id,
        originalUrl: media.url,
        resolvedUrl: resolvedUrl,
        type: media.type,
        finalMediaItem: resolvedMediaItem
      })
      resolvedMedia.push(resolvedMediaItem)
    }
    // If resolvedUrl is undefined, skip this media item entirely
  }
  
  // Check for critical media loading failures
  debugLogger.debug('SCORM_MEDIA', 'Media resolution completed', {
    projectId,
    inputMediaCount: mediaItems.length,
    resolvedMediaCount: resolvedMedia.length,
    errorCount: mediaLoadingErrors.length,
    finalMediaFilesCount: mediaFiles.length
  })
  
  console.log(`[SCORM Media Debug] Resolution Summary:`)
  console.log(`  📊 Input media items: ${mediaItems.length}`)
  console.log(`  ✅ Successfully resolved: ${resolvedMedia.length}`)
  console.log(`  📦 Binary files added: ${mediaFiles.length}`)
  console.log(`  ❌ Failed to resolve: ${mediaLoadingErrors.length}`)
  
  if (mediaLoadingErrors.length > 0) {
    const errorSummary = `${mediaLoadingErrors.length} media loading error${mediaLoadingErrors.length > 1 ? 's' : ''}:\n${mediaLoadingErrors.map(err => `  • ${err}`).join('\n')}`
    
    // Log to ultraSimpleLogger for persistence and troubleshooting  
    debugLogger.warn('SCORM_MEDIA', 'Media loading failures detected - continuing with available media', {
      projectId,
      failedMediaCount: mediaLoadingErrors.length,
      successfulMediaCount: mediaFiles.length,
      errors: mediaLoadingErrors,
      errorSummary
    })
    
    // Log warnings but continue generation instead of throwing error
    console.warn(`[Rust SCORM] Media loading failures detected:`)
    console.warn(errorSummary)
    console.warn(`[Rust SCORM] Continuing SCORM generation with ${mediaFiles.length} available media files`)
    
    // CHANGED: Don't throw error - allow graceful degradation
    // Users can still get a working SCORM package with available media
    // throw new Error(`Critical media loading failures:\n${errorSummary}`)
  } else {
    console.log(`[SCORM Media Debug] ✅ All media resolved successfully!`)
  }
  
  // Filter out media items with empty URLs
  const filteredMedia = resolvedMedia.filter(item => item.url && item.url.trim() !== '')
  
  // Generate YouTube clipping diagnostic report for all YouTube videos
  const youtubeVideos = filteredMedia.filter(item => item.is_youtube && item.url)
  if (youtubeVideos.length > 0) {
    const youtubeReport = generateYouTubeClipReport(
      projectId,
      youtubeVideos.map(video => ({
        url: video.url,
        clipStart: video.clip_start || video.clipStart,  // Support both snake_case and camelCase
        clipEnd: video.clip_end || video.clipEnd,        // Support both snake_case and camelCase
        actualEmbedUrl: video.embed_url
      }))
    )
    
    // Log the comprehensive report
    logYouTubeClipReport(youtubeReport)
    
    // If there are any issues, also log to debugLogger for persistence
    if (!youtubeReport.summary.allClippingWorking) {
      debugLogger.warn('YOUTUBE_DIAGNOSTICS', 'YouTube clipping issues detected in media resolution', {
        projectId,
        totalVideos: youtubeReport.totalVideos,
        clippedVideos: youtubeReport.clippedVideos,
        successfullyProcessed: youtubeReport.successfullyProcessed,
        issues: youtubeReport.summary.issues,
        recommendations: youtubeReport.summary.recommendations
      })
    } else {
      debugLogger.info('YOUTUBE_DIAGNOSTICS', 'All YouTube videos processed successfully', {
        projectId,
        totalVideos: youtubeReport.totalVideos,
        clippedVideos: youtubeReport.clippedVideos
      })
    }
  }
  
  // Return undefined if no valid media items remain (so the template's {{or}} helper works correctly)
  return filteredMedia.length > 0 ? filteredMedia : undefined
}

/**
 * Convert TypeScript course content to Rust-compatible format
 */
export async function convertToRustFormat(courseContent: CourseContent | EnhancedCourseContent, projectId: string, courseSettings?: CourseSettings) {
  // Runtime validation with Zod schemas - first line of defense
  validateCourseContent(courseContent, projectId)
  validateCourseSettings(courseSettings, projectId)

  // Validate maximum sizes to prevent memory issues
  validateMaximumSizes(courseContent)

  debugLogger.info('SCORM_CONVERSION', 'Starting course content conversion to Rust format', {
    projectId,
    hasCourseSettings: !!courseSettings,
    contentType: 'objectives' in courseContent ? 'enhanced' : 'standard'
  })
  
  // Run diagnostic scan of MediaService before processing
  console.log(`[SCORM Media Debug] 🔍 Running MediaService diagnostic for project: ${projectId}`)
  try {
    const { diagnoseMedieServiceForProject } = await import('../utils/mediaServiceDiagnostics')
    const diagnostic = await diagnoseMedieServiceForProject(projectId)
    
    console.log(`[SCORM Media Debug] 📊 MediaService contains ${diagnostic.totalMediaCount} total media items`)
    if (diagnostic.mediaDetails.length > 0) {
      console.log(`[SCORM Media Debug] 📋 Available media:`)
      diagnostic.mediaDetails.forEach((media, idx) => {
        console.log(`  ${idx + 1}. ${media.id} (${media.type}, ${media.size} bytes, ${media.mimeType || 'unknown type'})`)
      })
    }
    
    if (diagnostic.errors.length > 0) {
      console.warn(`[SCORM Media Debug] ⚠️  MediaService diagnostic found ${diagnostic.errors.length} errors:`)
      diagnostic.errors.forEach(error => console.warn(`  • ${error}`))
    }
  } catch (error) {
    console.warn(`[SCORM Media Debug] ⚠️  Failed to run MediaService diagnostic: ${error}`)
  }
  
  // Validate required fields
  if (!courseContent) {
    debugLogger.error('SCORM_CONVERSION', 'Course content validation failed', { projectId, error: 'Course content is required' })
    throw new Error('Course content is required')
  }
  
  // 📊 PERFORMANCE TIMING: Start overall conversion tracking
  const overallStartTime = Date.now()
  console.log(`[PERFORMANCE] 🚀 Starting SCORM generation for project: ${projectId}`)

  // Check if this is enhanced format
  const isEnhanced = 'objectives' in courseContent && Array.isArray(courseContent.objectives)

  if (isEnhanced) {
    debugLogger.debug('SCORM_CONVERSION', 'Using enhanced content conversion path', { projectId })
    const enhancedStartTime = Date.now()
    const result = await convertEnhancedToRustFormat(courseContent as EnhancedCourseContent, projectId, courseSettings)
    const enhancedDuration = Date.now() - enhancedStartTime
    console.log(`[PERFORMANCE] ✅ Enhanced format conversion completed in ${enhancedDuration}ms`)
    console.log(`[PERFORMANCE] 🏁 Total generation time: ${Date.now() - overallStartTime}ms`)
    return result
  }

  const cc = courseContent as any
  
  // 📊 PERFORMANCE TIMING: Batch media pre-loading
  console.log(`[Rust SCORM] Starting batch pre-loading of all media`)
  const batchStartTime = Date.now()
  const allMediaIds = collectAllMediaIds(cc)
  await batchPreloadMedia(allMediaIds, projectId)
  const batchDuration = Date.now() - batchStartTime
  console.log(`[PERFORMANCE] ✅ Batch pre-loading completed in ${batchDuration}ms (${allMediaIds.length} media items)`)

  // 📊 PERFORMANCE OPTIMIZATION: Single listAllMedia() call for all auto-population functions
  console.log(`[Rust SCORM] Loading all stored media items once for consolidated operations`)
  const consolidatedListStartTime = Date.now()
  await ensureProjectLoaded(projectId)
  const { createMediaService } = await import('./MediaService')
  const mediaService = createMediaService(projectId, undefined, true)
  const allStoredMediaItems = await mediaService.listAllMedia()
  const consolidatedListDuration = Date.now() - consolidatedListStartTime
  console.log(`[PERFORMANCE] ✅ Consolidated listAllMedia() completed in ${consolidatedListDuration}ms - found ${allStoredMediaItems?.length || 0} stored items`)

  // 📊 PERFORMANCE TIMING: YouTube recovery (moved after media loading for consolidation)
  console.log(`[Rust SCORM] Starting YouTube recovery for standard format`)
  const youtubeStartTime = Date.now()
  await autoPopulateYouTubeFromStorage(cc, projectId, allStoredMediaItems)
  const youtubeDuration = Date.now() - youtubeStartTime
  console.log(`[PERFORMANCE] ✅ YouTube recovery completed in ${youtubeDuration}ms`)

  // 🚨 Enable regression detection for content conversion phase
  mediaServiceCallDetector.enterConversion()

  // Media resolution tracking
  const mediaFiles: MediaFile[] = []
  const mediaCounter: { [type: string]: number } = {}
  
  const result = {
    course_title: sanitizeHtml(safeString(cc.courseTitle || cc.title || cc.courseName, 'Untitled Course')),
    course_description: sanitizeHtml(safeString(cc.courseDescription || cc.description)),
    pass_mark: constrainNumber(courseSettings?.passMark || cc.passMark, 0, 100, 80),
    navigation_mode: courseSettings?.navigationMode || cc.navigationMode || 'linear',
    allow_retake: courseSettings?.allowRetake ?? (cc.allowRetake !== false ? true : false),
    require_audio_completion: courseSettings?.requireAudioCompletion || false,
    // New comprehensive course settings
    auto_advance: courseSettings?.autoAdvance || false,
    allow_previous_review: courseSettings?.allowPreviousReview ?? true,
    retake_delay: courseSettings?.retakeDelay || 0,
    completion_criteria: courseSettings?.completionCriteria || 'view_and_pass',
    show_progress: courseSettings?.showProgress ?? true,
    show_outline: courseSettings?.showOutline ?? true,
    confirm_exit: courseSettings?.confirmExit ?? true,
    font_size: courseSettings?.fontSize || 'medium',
    time_limit: constrainNumber(courseSettings?.timeLimit, 0, 86400, 0), // Max 24 hours
    session_timeout: constrainNumber(courseSettings?.sessionTimeout, 5, 1440, 30), // 5 min to 24 hours
    minimum_time_spent: constrainNumber(courseSettings?.minimumTimeSpent, 0, 7200, 0), // Max 2 hours
    keyboard_navigation: courseSettings?.keyboardNavigation ?? true,
    printable: courseSettings?.printable || false,
    
    welcome_page: cc.welcome || cc.welcomePage || cc.welcomeMedia ? {
      title: sanitizeHtml(safeString(cc.welcome?.title || cc.welcomePage?.title, 'Welcome')),
      content: sanitizeHtml(safeString(cc.welcome?.content || cc.welcomePage?.content)),
      start_button_text: sanitizeHtml(safeString(cc.welcome?.startButtonText || cc.welcomePage?.startButtonText, 'Start Course')),
      audio_file: await resolveAudioCaptionFile(cc.welcome?.audioId || cc.welcome?.audioFile || cc.welcomePage?.audioId || cc.welcomePage?.audioFile, projectId, mediaFiles),
      caption_file: await resolveAudioCaptionFile(cc.welcome?.captionId || cc.welcome?.captionFile || cc.welcomePage?.captionId || cc.welcomePage?.captionFile, projectId, mediaFiles),
      image_url: await resolveImageUrl(
        cc.welcome?.imageUrl ||
        cc.welcomePage?.imageUrl ||
        // Check welcome media array for images (same as topics)
        safeFindInArray(cc.welcome?.media, (m: any) => m?.type === 'image')?.url ||
        safeFindInArray(cc.welcome?.media, (m: any) => m?.type === 'image')?.id ||
        safeFindInArray(cc.welcomePage?.media, (m: any) => m?.type === 'image')?.url ||
        safeFindInArray(cc.welcomePage?.media, (m: any) => m?.type === 'image')?.id,
        projectId,
        mediaFiles,
        mediaCounter
      ),
      // Filter out regular images (but keep SVGs) since images are handled by image_url
      media: await resolveMedia(
        safeArrayFilter(cc.welcome?.media || cc.welcomePage?.media || [])
          .filter((m: any) => {
            // Keep SVG files regardless of their type classification
            if (m?.id?.includes('svg') || m?.url?.includes('.svg') || m?.type === 'svg') {
              return true
            }
            // Filter out regular images
            return m?.type !== 'image'
          })
          .map((m: any) => ({
            id: m.id,
            type: m.type,
            url: m.url || '',
            title: m.title || '',
            clipStart: m.clip_start || m.clipStart,
            clipEnd: m.clip_end || m.clipEnd
          })),
        projectId,
        mediaFiles,
        mediaCounter
      ),
    } : undefined,
    
    learning_objectives_page: cc.learningObjectivesPage ? {
      // For CourseContent format, extract objectives from content; for other formats, use objectives property
      objectives: cc.learningObjectivesPage.objectives || 
                  (cc.learningObjectivesPage.content ? extractObjectivesFromContent(cc.learningObjectivesPage.content) : []),
      audio_file: await resolveAudioCaptionFile(cc.learningObjectivesPage.audioFile, projectId, mediaFiles),
      caption_file: await resolveAudioCaptionFile(cc.learningObjectivesPage.captionFile, projectId, mediaFiles),
      // Extract image from imageUrl property or media array (consistent with topics)
      image_url: await resolveImageUrl(
        cc.learningObjectivesPage.imageUrl ||
        cc.learningObjectivesPage.media?.find((m: any) => m.type === 'image')?.url ||
        cc.learningObjectivesPage.media?.find((m: any) => m.type === 'image')?.id,
        projectId,
        mediaFiles,
        mediaCounter
      ),
      // Filter out regular images (but keep SVGs) from media array since images are handled by image_url
      media: await resolveMedia(
        Array.isArray(cc.learningObjectivesPage.media) ?
          cc.learningObjectivesPage.media.filter((m: any) => {
            // Keep SVG files regardless of their type classification
            if (m?.id?.includes('svg') || m?.url?.includes('.svg') || m?.type === 'svg') {
              return true
            }
            // Filter out regular images
            return m?.type !== 'image'
          }) :
          cc.learningObjectivesPage.media && (
            cc.learningObjectivesPage.media.type !== 'image' ||
            cc.learningObjectivesPage.media?.id?.includes('svg') ||
            cc.learningObjectivesPage.media?.url?.includes('.svg') ||
            cc.learningObjectivesPage.media?.type === 'svg'
          ) ?
            [cc.learningObjectivesPage.media] :
            undefined,
        projectId, 
        mediaFiles, 
        mediaCounter
      ),
    } : undefined,
    
    topics: await safePromiseAll(
      safeArrayMap(cc.topics, async (topic: any) => {
        // Sanitize topic data first
        const sanitizedTopic = sanitizeTopic(topic)
        if (!sanitizedTopic) return null

        // Handle both knowledgeCheck (singular) and knowledgeChecks (plural array)
        const kcData = sanitizedTopic.knowledgeCheck || (sanitizedTopic.knowledgeChecks && sanitizedTopic.knowledgeChecks.length > 0 ? { questions: sanitizedTopic.knowledgeChecks } : null)
      
      return {
        id: sanitizedTopic.id,
        title: sanitizedTopic.title,
        content: sanitizedTopic.content,
        knowledge_check: kcData ? {
          enabled: kcData.enabled !== false,
          questions: sanitizeQuestions(kcData.questions || (kcData.question ? [{
            type: kcData.type || kcData.questionType,
            question: kcData.question,
            options: kcData.options,
            correctAnswer: kcData.correctAnswer,
            feedback: kcData.feedback,
            explanation: kcData.explanation
        }] : [])).map((q: any) => {
          // Provide defaults for missing fields
          const questionType = q.type || q.questionType || 'multiple-choice'
          const questionText = q.question || q.text || 'Question text missing'
          const correctAnswer = q.correctAnswer !== undefined ? q.correctAnswer : 0

          // For true-false questions, ensure options array exists
          let options = Array.isArray(q.options) ? q.options : []
          
          if (questionType === 'true-false' && !options) {
            options = ['True', 'False']
          }
          
          return {
            type: questionType,
            text: q.question || q.text, // Fixed: Support both 'question' and 'text' fields
            options: options,
            correct_answer: questionType === 'true-false' ?
              (correctAnswer === 0 || correctAnswer === 'true' || correctAnswer === true ? 'true' : 'false') :
              (typeof correctAnswer === 'number' && options ? safeArrayAccess(options, correctAnswer, String(correctAnswer)) : String(correctAnswer)),
            explanation: q.explanation || q.feedback?.incorrect || q.feedback?.correct || '',
            correct_feedback: q.feedback?.correct || 'Correct!',
            incorrect_feedback: q.feedback?.incorrect || 'Not quite. Try again!',
          }
        }) || []
      } : undefined,
        audio_file: await resolveAudioCaptionFile(sanitizedTopic.audioFile || sanitizedTopic.audioId, projectId, mediaFiles),
        caption_file: await resolveAudioCaptionFile(sanitizedTopic.captionFile || sanitizedTopic.captionId, projectId, mediaFiles),
        // Extract image from media array or use imageUrl field
        image_url: await resolveImageUrl(
          sanitizedTopic.imageUrl ||
          safeFindInArray(sanitizedTopic.media, (m: any) => m?.type === 'image')?.url ||
          safeFindInArray(sanitizedTopic.media, (m: any) => m?.type === 'image')?.id,
          projectId,
          mediaFiles,
          mediaCounter
        ),
        // Filter out regular images (but keep SVGs) since images are handled by image_url
        media: await resolveMedia(
          safeArrayFilter(sanitizedTopic.media).filter((m: any) => {
            // Keep SVG files regardless of their type classification
            if (m?.id?.includes('svg') || m?.url?.includes('.svg') || m?.type === 'svg') {
              return true
            }
            // Filter out regular images
            return m?.type !== 'image'
          }).map((m: any) => ({
            id: m.id,
            type: m.type,
            url: m.url || '',
            title: m.title || '',
            clipStart: m.clip_start || m.clipStart,
            clipEnd: m.clip_end || m.clipEnd
          })),
          projectId,
          mediaFiles,
          mediaCounter
        )
      }
    }),
    'topics processing',
    projectId
  ),
    
    assessment: cc.assessment ? {
      questions: (cc.assessment.questions || []).map((q: any) => {
        // Validate assessment question has required fields and infer type if missing
        const qAny = q as any

        // Infer question type if not provided (same logic as Zod schema)
        if (!qAny.type) {
          if (typeof qAny.correctAnswer === 'boolean') {
            qAny.type = 'true-false'
          } else if (Array.isArray(qAny.options) && qAny.options.length > 0) {
            qAny.type = 'multiple-choice'
          } else {
            qAny.type = 'short-answer' // Default fallback
          }
        }
        if (!qAny.question && !qAny.text) {
          console.error('[Rust SCORM] Assessment question missing text/question field:', q)
          throw new Error('Assessment question missing text field')
        }
        if (qAny.correctAnswer === undefined || qAny.correctAnswer === null) {
          console.error('[Rust SCORM] Assessment question missing correctAnswer:', q)
          throw new Error('Assessment question missing correctAnswer')
        }
        
        // Handle different feedback formats
        let explanation = ''
        let correct_feedback = ''
        let incorrect_feedback = ''
        
        if (typeof qAny.feedback === 'string') {
          // String format: use as explanation
          explanation = qAny.feedback
        } else if (qAny.feedback && typeof qAny.feedback === 'object') {
          // Object format: {correct: '...', incorrect: '...'}
          correct_feedback = qAny.feedback.correct || ''
          incorrect_feedback = qAny.feedback.incorrect || ''
          explanation = qAny.feedback.incorrect || qAny.feedback.correct || ''
        }
        
        // Direct fields override feedback object
        if (qAny.correctFeedback) {
          correct_feedback = qAny.correctFeedback
        }
        if (qAny.incorrectFeedback) {
          incorrect_feedback = qAny.incorrectFeedback
        }
        if (qAny.explanation) {
          explanation = qAny.explanation
        }
        
        return {
          type: qAny.type || 'multiple-choice', // Default to multiple-choice for assessment
          text: qAny.question || qAny.text, // Fixed: Support both 'question' and 'text' fields
          options: qAny.options,
          correct_answer: qAny.correctAnswer,
          explanation,
          correct_feedback,
          incorrect_feedback
        }
      })
    } : undefined,
  }
  
  // 📊 PERFORMANCE TIMING: Auto-populate missing media from storage
  console.log(`[Rust SCORM] Before auto-population: mediaFiles.length = ${mediaFiles.length}`)
  const autoPopulateStartTime = Date.now()
  await autoPopulateMediaFromStorage(projectId, mediaFiles, mediaCounter, allStoredMediaItems)
  const autoPopulateDuration = Date.now() - autoPopulateStartTime
  console.log(`[PERFORMANCE] ✅ Auto-population completed in ${autoPopulateDuration}ms: mediaFiles.length = ${mediaFiles.length}`)

  // 📊 PERFORMANCE TIMING: Inject orphaned media into course content structure
  console.log(`[Rust SCORM] Injecting orphaned media into course content...`)
  const injectStartTime = Date.now()
  await injectOrphanedMediaIntoCourseContent(projectId, result, allStoredMediaItems)
  const injectDuration = Date.now() - injectStartTime
  console.log(`[PERFORMANCE] ✅ Media injection completed in ${injectDuration}ms`)

  // 🚨 Disable regression detection after content conversion
  mediaServiceCallDetector.exitConversion()

  // 📊 PERFORMANCE TIMING: Overall format completion
  const overallDuration = Date.now() - overallStartTime
  console.log(`[PERFORMANCE] 🏁 Format generation completed in ${overallDuration}ms`)

  // 🔍 DEBUG: Log the final media structure being sent to Rust
  console.log(`[TypeScript→Rust Debug] Final course data structure for Rust:`)
  if (result.welcome_page?.media) {
    console.log(`  Welcome page media (${result.welcome_page.media.length} items):`)
    result.welcome_page.media.forEach((media, i) => {
      console.log(`    [${i}] id: ${media.id}, type: ${media.type}, url: ${media.url}`)
    })
  }
  if (result.learning_objectives_page?.media) {
    console.log(`  Objectives page media (${result.learning_objectives_page.media.length} items):`)
    result.learning_objectives_page.media.forEach((media, i) => {
      console.log(`    [${i}] id: ${media.id}, type: ${media.type}, url: ${media.url}`)
    })
  }
  if (result.topics) {
    result.topics.forEach((topic, topicIndex) => {
      if (topic?.media && topic.media.length > 0) {
        console.log(`  Topic ${topicIndex} media (${topic.media.length} items):`)
        topic.media.forEach((media, i) => {
          console.log(`    [${i}] id: ${media.id}, type: ${media.type}, url: ${media.url}`)
        })
      }
    })
  }

  return { courseData: result, mediaFiles }
}

/**
 * Auto-populate missing media from MediaService
 * This ensures that media stored in MediaService but not referenced in course content gets included
 */
async function autoPopulateMediaFromStorage(projectId: string, mediaFiles: MediaFile[], mediaCounter: { [type: string]: number }, allMediaItems: any[]) {
  console.log(`[Rust SCORM] Auto-population called for project: ${projectId}`)
  try {
    // 📊 PERFORMANCE OPTIMIZATION: Using pre-loaded media items (no more listAllMedia() call)
    if (!allMediaItems || allMediaItems.length === 0) {
      console.log(`[Rust SCORM] Auto-population: no media items provided`)
      return
    }
    console.log(`[Rust SCORM] Auto-populating media: using ${allMediaItems.length} pre-loaded media items`)

    // 📊 REDUNDANCY ANALYSIS: Track how much work this function actually does
    const beforeCount = mediaFiles.length
    console.log(`[PERFORMANCE] 🔍 Auto-population starting: mediaFiles.length = ${beforeCount}`)

    // Still need MediaService for batch operations
    await ensureProjectLoaded(projectId)
    const { createMediaService } = await import('./MediaService')
    const mediaService = createMediaService(projectId, undefined, true)

    // 🚀 CRITICAL FIX: Replace sequential loop with parallel batch loading
    // Filter out media items that are already processed
    const unprocessedItems = allMediaItems.filter(mediaItem => {
      const expectedExtension = getExtensionFromMimeType(mediaItem.metadata?.mimeType || '') || getExtensionFromMediaId(mediaItem.id)
      const existingFile = mediaFiles.find(f =>
        f.filename.startsWith(mediaItem.id) ||
        f.filename === `${mediaItem.id}.${expectedExtension}`
      )

      if (existingFile) {
        console.log(`[Rust SCORM] Media ${mediaItem.id} already processed, skipping`)
        return false
      }
      return true
    })

    console.log(`[Rust SCORM] Auto-population: Processing ${unprocessedItems.length} unprocessed items in parallel`)

    // 🚀 DIRECT BATCH LOADING: Use batch API to eliminate timer coalescing issues
    console.log(`[SCORM BATCH] autoPopulateMediaFromStorage: Loading ${unprocessedItems.length} items in single batch`)
    const startTime = Date.now()

    // Extract IDs and use direct batch loading
    const mediaIds = unprocessedItems.map(item => item.id)
    const batchResults = await mediaService.getMediaBatchDirect(mediaIds)

    const duration = Date.now() - startTime
    console.log(`[SCORM BATCH] autoPopulateMediaFromStorage: Completed batch load of ${unprocessedItems.length} items in ${duration}ms`)

    // Convert batch results to the expected format
    const mediaResults = unprocessedItems.map(mediaItem => ({
      mediaItem,
      fileData: batchResults.get(mediaItem.id)
    }))

    // Process the results sequentially (fast, no I/O) with safety checks
    let processedCount = 0
    const totalCount = mediaResults.length
    console.log(`[Rust SCORM] Processing ${totalCount} media results in auto-populate`)

    for (const { mediaItem, fileData } of mediaResults) {
      processedCount++
      console.log(`[Rust SCORM] Auto-populate processing ${processedCount}/${totalCount}: ${mediaItem.id}`)

      // Safety check: ensure mediaItem is valid
      if (!mediaItem || !mediaItem.id) {
        console.warn(`[Rust SCORM] Skipping invalid media item at index ${processedCount}`)
        continue
      }
      if (fileData && fileData.data) {
        const mimeType = fileData.metadata?.mimeType || 'application/octet-stream'
        const uint8Data = new Uint8Array(fileData.data)

        // For YouTube videos stored as JSON, skip adding to mediaFiles (they're handled as URLs)
        if (mediaItem.id.startsWith('video-') && (mimeType === 'application/json' || mimeType === 'text/plain')) {
          console.log(`[Rust SCORM] Skipping YouTube video metadata: ${mediaItem.id}`)
          continue
        }

        // 🔧 FIX: Check if this media was already processed by resolveImageUrl
        // Look for any mapping where this mediaItem.id was mapped to a counter-based filename
        let filename: string | undefined = undefined

        // Search through the mediaIdToFilename Map to find if this media ID was already processed
        // Safety check: limit search iterations to prevent infinite loops
        let searchCount = 0
        const maxSearchIterations = 1000 // Safety limit

        for (const [key, mappedFilename] of mediaIdToFilename.entries()) {
          searchCount++
          if (searchCount > maxSearchIterations) {
            console.warn(`[Rust SCORM] Safety limit reached while searching mediaIdToFilename Map for ${mediaItem.id}`)
            break
          }

          if (key === mediaItem.id || key.includes(mediaItem.id)) {
            filename = mappedFilename
            console.log(`[Rust SCORM] Found existing mapping for ${mediaItem.id}: ${filename}`)
            break
          }
        }

        if (!filename) {
          // Generate ID-based filename as fallback (for media not processed by resolveImageUrl)
          const ext = getExtensionFromMimeType(mimeType) || getExtensionFromMediaId(mediaItem.id)
          filename = `${mediaItem.id}.${ext}`
          console.log(`[Rust SCORM] Generated ID-based filename for ${mediaItem.id}: ${filename}`)
        }

        // Safety check: ensure filename is valid before adding to mediaFiles
        if (filename && typeof filename === 'string' && filename.length > 0) {
          mediaFiles.push({
            filename,
            content: uint8Data,
          })
          console.log(`[Rust SCORM] ✅ Successfully auto-populated media: ${mediaItem.id} → ${filename} (${mimeType}, ${uint8Data.length} bytes)`)
        } else {
          console.error(`[Rust SCORM] ❌ Invalid filename generated for ${mediaItem.id}: ${filename}`)
        }

      }
    }

    // 📊 REDUNDANCY ANALYSIS: Measure actual impact
    const afterCount = mediaFiles.length
    const addedCount = afterCount - beforeCount
    console.log(`[PERFORMANCE] 📊 Auto-population impact: added ${addedCount} media files (${beforeCount} → ${afterCount})`)

    if (addedCount === 0) {
      console.log(`[PERFORMANCE] ⚠️ Auto-population found no new media - may be redundant with content collection`)
    } else {
      console.log(`[PERFORMANCE] ✅ Auto-population recovered ${addedCount} orphaned media items`)
    }

    console.log(`[Rust SCORM] Auto-population complete: ${mediaFiles.length} total media files`)
  } catch (error) {
    console.warn(`[Rust SCORM] Failed to auto-populate media from storage:`, error)
  }
}

/**
 * Auto-populate missing YouTube videos from MediaService storage
 * This ensures that YouTube videos stored in MediaService get included in course content
 */
async function autoPopulateYouTubeFromStorage(
  courseData: any,
  projectId: string,
  allMediaItems: any[]
): Promise<void> {
  console.log(`[Rust SCORM] YouTube auto-population called for project: ${projectId}`)
  try {
    // 📊 PERFORMANCE OPTIMIZATION: Using pre-loaded media items (no more listAllMedia() call)
    if (!allMediaItems || allMediaItems.length === 0) {
      console.log(`[Rust SCORM] YouTube auto-population: no media items provided`)
      return
    }
    console.log(`[Rust SCORM] YouTube auto-population: using ${allMediaItems.length} pre-loaded media items`)

    // 📊 REDUNDANCY ANALYSIS: Track how many YouTube videos are actually recovered
    let youtubeVideosAdded = 0
    console.log(`[PERFORMANCE] 🔍 YouTube recovery starting...`)

    // Filter for video items (potential YouTube videos)
    const videoItems = allMediaItems.filter(item => item.id.startsWith('video-'))
    if (videoItems.length === 0) {
      console.log(`[Rust SCORM] YouTube auto-population: no video items found in storage`)
      return
    }
    
    console.log(`[Rust SCORM] YouTube auto-population: found ${videoItems.length} video items`)
    
    // 🚀 DIRECT BATCH LOADING: Use batch API for YouTube video items
    console.log(`[SCORM BATCH] autoPopulateYouTubeFromStorage: Loading ${videoItems.length} video items in single batch`)
    const startTime = Date.now()

    // Still need MediaService for batch operations
    await ensureProjectLoaded(projectId)
    const { createMediaService } = await import('./MediaService')
    const mediaService = createMediaService(projectId, undefined, true)

    // Extract IDs and use direct batch loading
    const videoIds = videoItems.map(item => item.id)
    const batchResults = await mediaService.getMediaBatchDirect(videoIds)

    const duration = Date.now() - startTime
    console.log(`[SCORM BATCH] autoPopulateYouTubeFromStorage: Completed batch load of ${videoItems.length} video items in ${duration}ms`)

    // Convert batch results to the expected format
    const videoResults = videoItems.map(videoItem => ({
      videoItem,
      fileData: batchResults.get(videoItem.id)
    }))

    // Process results sequentially (fast, no I/O)
    for (const { videoItem, fileData } of videoResults) {
      try {
        if (!fileData) {
          console.warn(`[Rust SCORM] No data found for video: ${videoItem.id}`)
          continue
        }
        
        // FIXED: YouTube videos don't have binary data, only metadata
        // Check if this is a YouTube video by looking at metadata first
        const isLikelyYouTube = fileData.metadata?.isYouTube || 
                               fileData.metadata?.source === 'youtube' ||
                               fileData.metadata?.embedUrl?.includes('youtube.com') ||
                               fileData.metadata?.youtubeUrl?.includes('youtube.com')
        
        if (isLikelyYouTube) {
          console.log(`[Rust SCORM] Found YouTube video ${videoItem.id} in metadata (no binary data expected)`)
          
          // Process YouTube video directly from metadata
          // FIXED: Ensure URL is never undefined to prevent Rust deserialization errors
          const embedUrl = fileData.metadata.embedUrl
          const youtubeUrl = fileData.metadata.youtubeUrl
          const fallbackUrl = `https://www.youtube.com/embed/${videoItem.id.replace('video-', '')}`
          const safeUrl = embedUrl || youtubeUrl || fallbackUrl
          
          // Debug logging for URL fallback usage
          if (!embedUrl && !youtubeUrl) {
            console.log(`[Rust SCORM] 🔄 Using URL fallback for YouTube video ${videoItem.id}:`, {
              embedUrl,
              youtubeUrl,
              fallbackUrl,
              safeUrl
            })
          }
          
          // Generate safe youtubeUrl from embedUrl if needed
          let safeYoutubeUrl = youtubeUrl
          if (!safeYoutubeUrl && embedUrl) {
            try {
              const url = new URL(embedUrl)
              const pathMatch = url.pathname.match(/\/embed\/([^\/\?]+)/)
              if (pathMatch && pathMatch[1]) {
                const videoId = pathMatch[1]
                safeYoutubeUrl = `https://www.youtube.com/watch?v=${videoId}`
              } else {
                safeYoutubeUrl = embedUrl.replace('/embed/', '/watch?v=')
              }
            } catch (error) {
              safeYoutubeUrl = embedUrl.replace('/embed/', '/watch?v=')
            }
          }
          if (!safeYoutubeUrl) {
            safeYoutubeUrl = safeUrl.replace('/embed/', '/watch?v=')
          }
          
          const youtubeMedia = {
            id: videoItem.id,
            type: 'youtube',  // FIXED: Use 'youtube' type instead of 'video'
            title: fileData.metadata.title || 'YouTube Video',
            url: safeUrl, // FIXED: Never undefined, always has fallback
            embedUrl: embedUrl || safeUrl,
            youtubeUrl: safeYoutubeUrl,
            isYouTube: true,
            mimeType: 'video/mp4',
            clipStart: fileData.metadata.clipStart,
            clipEnd: fileData.metadata.clipEnd
          }
          
          console.log(`[Rust SCORM] Processed YouTube video from metadata:`, {
            id: youtubeMedia.id,
            title: youtubeMedia.title,
            embedUrl: youtubeMedia.embedUrl,
            clipStart: youtubeMedia.clipStart,
            clipEnd: youtubeMedia.clipEnd,
            pageId: fileData.metadata.pageId
          })
          
          // Add video to the appropriate page based on pageId
          const pageId = fileData.metadata.pageId
          if (pageId === 'learning-objectives') {
            // Handle both enhanced format (objectivesPage) and standard format (objectives_page)
            const objectivesPage = courseData.objectivesPage || courseData.objectives_page
            if (objectivesPage) {
              if (!objectivesPage.media) {
                objectivesPage.media = []
              }
              // Check if video is already present
              const exists = objectivesPage.media.some((m: any) => m.id === youtubeMedia.id)
              if (!exists) {
                objectivesPage.media.push(youtubeMedia)
                youtubeVideosAdded++
                console.log(`[Rust SCORM] Added YouTube video ${youtubeMedia.id} to objectives page`)
              } else {
                console.log(`[Rust SCORM] YouTube video ${youtubeMedia.id} already exists in objectives page`)
              }
            }
          } else if (pageId && pageId.startsWith('topic-')) {
            // Find the matching topic
            const topicIndex = parseInt(pageId.replace('topic-', '')) - 1
            if (courseData.topics && courseData.topics[topicIndex]) {
              const topic = courseData.topics[topicIndex]
              if (!topic.media) {
                topic.media = []
              }
              // Check if video is already present
              const exists = topic.media.some((m: any) => m.id === youtubeMedia.id)
              if (!exists) {
                topic.media.push(youtubeMedia)
                youtubeVideosAdded++
                console.log(`[Rust SCORM] Added YouTube video ${youtubeMedia.id} to topic ${topicIndex + 1}`)
              } else {
                console.log(`[Rust SCORM] YouTube video ${youtubeMedia.id} already exists in topic ${topicIndex + 1}`)
              }
            }
          }
          
          continue // Skip the rest of the processing for YouTube videos
        }
        
        // For non-YouTube videos, we still expect binary data
        if (!fileData.data) {
          console.warn(`[Rust SCORM] No binary data found for non-YouTube video: ${videoItem.id}`)
          continue
        }
        
        console.log(`[Rust SCORM] Processing non-YouTube video with binary data: ${videoItem.id}`)
        
        // Handle regular video files (non-YouTube) that have binary data
        const mimeType = fileData.metadata?.mimeType || 'application/octet-stream'
        console.log(`[Rust SCORM] Regular video MIME type: ${mimeType}`)
        
        // This would be for regular video files, but for now we're focusing on the YouTube fix
        // Add additional processing here if needed for regular video files
        
      } catch (error) {
        console.error(`[Rust SCORM] Failed to process video metadata for ${videoItem.id}:`, error)
      }
    }

    // 📊 REDUNDANCY ANALYSIS: Measure actual impact
    console.log(`[PERFORMANCE] 📊 YouTube recovery impact: added ${youtubeVideosAdded} YouTube videos to course content`)

    if (youtubeVideosAdded === 0) {
      console.log(`[PERFORMANCE] ⚠️ YouTube recovery found no new videos - may be redundant with content collection`)
    } else {
      console.log(`[PERFORMANCE] ✅ YouTube recovery restored ${youtubeVideosAdded} stored YouTube videos`)
    }

    console.log(`[Rust SCORM] YouTube auto-population complete`)
  } catch (error) {
    console.warn(`[Rust SCORM] Failed to auto-populate YouTube videos from storage:`, error)
  }
}

/**
 * Validates media page associations and fixes any inconsistencies
 * This prevents the kind of cross-contamination where video-5 appears on topic-1
 */
export async function validateMediaPageAssociations(allMediaItems: any[]): Promise<any[]> {
  console.log(`[Rust SCORM] 🔍 Validating page associations for ${allMediaItems.length} media items`)
  
  const validatedItems = []
  const inconsistencies = []
  
  for (const mediaItem of allMediaItems) {
    const rootPageId = mediaItem.pageId
    const metadataPageId = mediaItem.metadata?.pageId || mediaItem.metadata?.page_id
    
    // Check for inconsistencies between root pageId and metadata pageId
    if (rootPageId && metadataPageId && rootPageId !== metadataPageId) {
      inconsistencies.push({
        mediaId: mediaItem.id,
        rootPageId,
        metadataPageId,
        conflict: 'pageId mismatch'
      })
      
      // Use metadata pageId as authoritative (it's closer to the source)
      console.log(`[Rust SCORM] 🔧 Fixing pageId inconsistency for ${mediaItem.id}: root='${rootPageId}' → metadata='${metadataPageId}'`)
      validatedItems.push({
        ...mediaItem,
        pageId: metadataPageId
      })
    } else {
      // No inconsistency, use as-is
      validatedItems.push(mediaItem)
    }
  }
  
  if (inconsistencies.length > 0) {
    console.log(`[Rust SCORM] ⚠️ Found ${inconsistencies.length} page association inconsistencies:`, inconsistencies)
  } else {
    console.log(`[Rust SCORM] ✅ All page associations are consistent`)
  }
  
  return validatedItems
}

/**
 * Inject orphaned media into course content structure based on pageId metadata
 * This ensures that media files included via auto-population are also referenced in HTML
 */
async function injectOrphanedMediaIntoCourseContent(projectId: string, courseData: any, allMediaItems: any[]): Promise<void> {
  console.log(`[Rust SCORM] Media injection called for project: ${projectId}`)
  try {
    // 📊 PERFORMANCE OPTIMIZATION: Using pre-loaded media items (no more listAllMedia() call)
    if (!allMediaItems || allMediaItems.length === 0) {
      console.log(`[Rust SCORM] Media injection: no media items provided`)
      return
    }
    console.log(`[Rust SCORM] Media injection: using ${allMediaItems.length} pre-loaded media items`)

    // 📊 REDUNDANCY ANALYSIS: Track how many orphaned media items are actually injected
    let orphanedMediaInjected = 0
    console.log(`[PERFORMANCE] 🔍 Orphaned media injection starting...`)

    // Filter to only image/video media that should be displayed in topics
    const rawVisualItems = allMediaItems.filter(item => 
      item.id.startsWith('image-') || (item.id.startsWith('video-') && item.metadata?.mimeType !== 'application/json')
    )
    
    console.log(`[Rust SCORM] Raw visual media items: ${rawVisualItems.length}`)
    
    // ✅ CRITICAL: Validate and fix page associations before injection
    const visualMediaItems = await validateMediaPageAssociations(rawVisualItems)
    
    console.log(`[Rust SCORM] Validated visual media items for injection: ${visualMediaItems.length}`)
    
    for (const mediaItem of visualMediaItems) {
      // Enhanced debugging for page ID extraction
      const pageIdFromRoot = mediaItem.pageId
      const pageIdFromMetadata = mediaItem.metadata?.pageId || mediaItem.metadata?.page_id
      const finalPageId = pageIdFromRoot || pageIdFromMetadata
      
      console.log(`[Rust SCORM] 🔍 Media ${mediaItem.id} page ID extraction:`, {
        pageIdFromRoot,
        pageIdFromMetadata,
        finalPageId,
        mediaItemStructure: {
          id: mediaItem.id,
          type: mediaItem.type,
          fileName: mediaItem.fileName,
          hasMetadata: !!mediaItem.metadata,
          metadataKeys: mediaItem.metadata ? Object.keys(mediaItem.metadata) : []
        }
      })
      
      if (!finalPageId) {
        console.log(`[Rust SCORM] Skipping media ${mediaItem.id} - no pageId found`)
        continue
      }
      
      console.log(`[Rust SCORM] Processing media ${mediaItem.id} for page ${finalPageId}`)
      
      // Find the target page in course content
      let targetPage = null
      if (finalPageId === 'welcome') {
        targetPage = courseData.welcome_page
      } else if (finalPageId === 'objectives' || finalPageId === 'learning-objectives' || finalPageId === 'content-1') {
        // Handle multiple possible names for learning objectives page
        targetPage = courseData.learning_objectives_page || courseData.objectives_page
        if (targetPage) {
          console.log(`[Rust SCORM] ✅ Found learning objectives page for pageId '${finalPageId}'`)
        }
      } else if (finalPageId && typeof finalPageId === 'string' && finalPageId.startsWith('topic-')) {
        // Extract topic index from pageId like 'topic-0' → index 0, 'topic-1' → index 1
        const topicIndex = parseInt(finalPageId.replace('topic-', ''))
        console.log(`[Rust SCORM] 🔍 Topic mapping for ${mediaItem.id}: pageId='${finalPageId}' → topicIndex=${topicIndex}`)
        if (courseData.topics && courseData.topics[topicIndex]) {
          targetPage = courseData.topics[topicIndex]
          console.log(`[Rust SCORM] ✅ Found topic page at index ${topicIndex} for media ${mediaItem.id}`)
        } else {
          console.log(`[Rust SCORM] ❌ Topic index ${topicIndex} not found in courseData.topics (length: ${courseData.topics?.length || 0})`)
        }
      }
      
      if (!targetPage) {
        console.log(`[Rust SCORM] Could not find target page for ${finalPageId}, skipping media ${mediaItem.id}`)
        continue
      }
      
      // Initialize media array if it doesn't exist
      if (!targetPage.media) {
        targetPage.media = []
      }
      
      // Check if media is already referenced
      const alreadyExists = targetPage.media.some((m: any) => 
        m.id === mediaItem.id || m.url === mediaItem.id || (m.url && m.url.includes(mediaItem.id))
      )
      
      if (alreadyExists) {
        console.log(`[Rust SCORM] Media ${mediaItem.id} already referenced in ${finalPageId}, skipping`)
        continue
      }
      
      // Detect YouTube videos - they should be handled as embeds with metadata
      const isYouTubeVideo = mediaItem.type === 'youtube' || 
                            (mediaItem.metadata?.isYouTube === true) ||
                            (mediaItem.metadata?.type === 'youtube') ||
                            (mediaItem.metadata?.embed_url && 
                             typeof mediaItem.metadata.embed_url === 'string' && (
                               mediaItem.metadata.embed_url.includes('youtube.com') || 
                               mediaItem.metadata.embed_url.includes('youtu.be')
                             ))
      
      let mediaReference
      if (isYouTubeVideo) {
        // Inject YouTube videos with embed metadata for iframe display
        console.log(`[Rust SCORM] Injecting YouTube video ${mediaItem.id} with embed metadata`)
        
        // Get various URL formats from metadata
        const embedUrl = mediaItem.metadata?.embed_url || mediaItem.metadata?.embedUrl
        const youtubeUrl = mediaItem.metadata?.youtubeUrl
        const originalUrl = embedUrl || youtubeUrl
        const clipStart = (mediaItem.metadata?.clipStart || mediaItem.metadata?.clip_start) as number | undefined
        const clipEnd = (mediaItem.metadata?.clipEnd || mediaItem.metadata?.clip_end) as number | undefined
        
        // Always normalize to proper embed URL with clip timing
        const normalizedEmbedUrl = originalUrl && typeof originalUrl === 'string'
          ? normalizeYouTubeURL(originalUrl, clipStart, clipEnd)
          : `https://www.youtube.com/embed/${mediaItem.id.replace('video-', '')}`
        
        // Debug logging for URL processing
        console.log(`[Rust SCORM] 🔄 YouTube URL processing for ${mediaItem.id}:`, {
          originalEmbedUrl: embedUrl,
          originalYoutubeUrl: youtubeUrl,
          clipStart,
          clipEnd,
          normalizedEmbedUrl
        })
        
        mediaReference = {
          id: mediaItem.id,
          type: 'video',
          is_youtube: true,
          url: normalizedEmbedUrl, // Always use normalized embed URL
          embed_url: normalizedEmbedUrl, // Ensure consistency
          title: mediaItem.metadata?.title || `YouTube Video ${mediaItem.id}`,
          alt: mediaItem.metadata?.alt || mediaItem.metadata?.title || `YouTube Video ${mediaItem.id}`,
          // Include YouTube-specific properties (keep original youtubeUrl for reference)
          youtubeUrl: youtubeUrl,
          clipStart: clipStart,
          clipEnd: clipEnd
        }
      } else {
        // Create media reference for regular media (images, local videos)
        // Fix: Use getExtensionFromMediaId instead of getExtensionFromMimeType
        // to ensure consistency between HTML template URLs and actual ZIP file names
        const extension = getExtensionFromMediaId(mediaItem.id)
        mediaReference = {
          id: mediaItem.id,
          type: mediaItem.id.startsWith('image-') ? 'image' : 'video',
          url: `media/${mediaItem.id}.${extension}`,
          title: mediaItem.metadata?.title || `Media ${mediaItem.id}`,
          alt: mediaItem.metadata?.alt || mediaItem.metadata?.title || `Media ${mediaItem.id}`,
          // For regular videos, mark as non-YouTube
          ...(mediaItem.id.startsWith('video-') && {
            is_youtube: false
          })
        }
      }
      
      // Add media reference to the page
      targetPage.media.push(mediaReference)
      orphanedMediaInjected++

      // ✅ FINAL VALIDATION: Check for cross-contamination after injection
      const mediaCount = targetPage.media.length
      const uniqueMediaIds = new Set(targetPage.media.map((m: any) => m.id))
      if (mediaCount !== uniqueMediaIds.size) {
        console.log(`[Rust SCORM] ⚠️ Duplicate media detected in ${finalPageId} after injection: ${mediaCount} items, ${uniqueMediaIds.size} unique IDs`)
      }
      
      console.log(`[Rust SCORM] ✅ Successfully injected media ${mediaItem.id} into page '${finalPageId}':`, {
        mediaId: mediaReference.id,
        mediaType: mediaReference.type,
        isYouTube: mediaReference.is_youtube,
        url: mediaReference.url,
        targetPageType: (finalPageId && typeof finalPageId === 'string' && finalPageId.startsWith('topic-')) 
          ? `topic-${parseInt(finalPageId.replace('topic-', ''))}` 
          : finalPageId,
        totalMediaOnPage: mediaCount,
        uniqueMediaOnPage: uniqueMediaIds.size
      })
    }

    // 📊 REDUNDANCY ANALYSIS: Measure actual impact
    console.log(`[PERFORMANCE] 📊 Orphaned media injection impact: injected ${orphanedMediaInjected} orphaned media items into course content`)

    if (orphanedMediaInjected === 0) {
      console.log(`[PERFORMANCE] ⚠️ Orphaned media injection found no items to inject - may be redundant with content collection`)
    } else {
      console.log(`[PERFORMANCE] ✅ Orphaned media injection recovered ${orphanedMediaInjected} media items with pageId metadata`)
    }

    console.log(`[Rust SCORM] Media injection complete`)
  } catch (error) {
    console.warn(`[Rust SCORM] Failed to inject orphaned media into course content:`, error)
  }
}

/**
 * Extract media from course content and store in MediaService for injection system
 * This bridges the gap between MediaEnhancementWizard and SCORM generation
 */
async function extractCourseContentMedia(courseContent: EnhancedCourseContent, projectId: string) {
  try {
    console.log(`[Course Media Bridge] 🚀 STARTING media extraction for project: ${projectId}`)
    console.log(`[Course Media Bridge] Course content structure:`)
    console.log(`  - Title: ${courseContent.title || 'No title'}`)
    console.log(`  - Topics count: ${courseContent.topics?.length || 0}`)
    console.log(`  - Welcome page: ${!!courseContent.welcome}`)
    console.log(`  - Objectives page: ${!!courseContent.objectivesPage}`)
    
    const { createMediaService } = await import('./MediaService')
    const mediaService = createMediaService(projectId, undefined, true)
    console.log(`[Course Media Bridge] ✅ MediaService created successfully`)
    
    let extractedCount = 0
    
    // Helper function to extract media from a page
    const extractMediaFromPage = async (page: any, pageId: string, pageName: string) => {
      console.log(`[Course Media Bridge] 🔍 Checking ${pageName} for media...`)
      
      if (!page) {
        console.log(`[Course Media Bridge]   - Page is null/undefined`)
        return
      }
      
      if (!page.media) {
        console.log(`[Course Media Bridge]   - Page has no media property`)
        return
      }
      
      if (!Array.isArray(page.media)) {
        console.log(`[Course Media Bridge]   - Page media is not an array: ${typeof page.media}`)
        return
      }
      
      if (page.media.length === 0) {
        console.log(`[Course Media Bridge]   - Page media array is empty`)
        return
      }
      
      console.log(`[Course Media Bridge] 📊 Found ${page.media.length} media items in ${pageName}:`)
      page.media.forEach((item: any, index: number) => {
        console.log(`  [${index}] ${item.id || 'no-id'} (${item.type || 'no-type'}) - isYouTube: ${item.isYouTube}, embedUrl: ${item.embedUrl || 'none'}`)
      })
      
      for (const mediaItem of page.media) {
        try {
          console.log(`[Course Media Bridge] 🎬 Processing ${mediaItem.id || 'unknown-id'}...`)
          
          if (mediaItem.isYouTube || mediaItem.type === 'youtube') {
            console.log(`[Course Media Bridge] 🎯 Found YouTube video!`)
            console.log(`  - ID: ${mediaItem.id}`)
            console.log(`  - Title: ${mediaItem.title}`)
            console.log(`  - isYouTube: ${mediaItem.isYouTube}`)
            console.log(`  - type: ${mediaItem.type}`)
            
            // Store YouTube videos with proper metadata
            const embedUrl = mediaItem.embedUrl || mediaItem.embed_url
            
            // FIXED: Proper URL conversion that handles parameters correctly
            let youtubeUrl = mediaItem.youtubeUrl || mediaItem.url
            if (!youtubeUrl && embedUrl) {
              try {
                // Extract video ID from embed URL and create clean watch URL
                const url = new URL(embedUrl)
                const pathMatch = url.pathname.match(/\/embed\/([^\/\?]+)/)
                if (pathMatch && pathMatch[1]) {
                  const videoId = pathMatch[1]
                  youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
                } else {
                  // Fallback to simple replacement if regex fails
                  youtubeUrl = embedUrl.replace('/embed/', '/watch?v=')
                }
              } catch (error) {
                // If URL parsing fails, use simple replacement as fallback
                youtubeUrl = embedUrl.replace('/embed/', '/watch?v=')
              }
            }
            
            console.log(`  - embedUrl: ${embedUrl}`)
            console.log(`  - youtubeUrl: ${youtubeUrl}`)
            console.log(`  - clipStart: ${mediaItem.clipStart}`)
            console.log(`  - clipEnd: ${mediaItem.clipEnd}`)
            
            if (embedUrl) {
              console.log(`[Course Media Bridge] 📤 Calling mediaService.storeYouTubeVideo...`)
              
              const storedItem = await mediaService.storeYouTubeVideo(
                youtubeUrl || embedUrl,
                embedUrl,
                pageId,
                {
                  title: mediaItem.title,
                  clipStart: mediaItem.clipStart,
                  clipEnd: mediaItem.clipEnd,
                  thumbnail: mediaItem.thumbnail
                }
              )
              
              console.log(`[Course Media Bridge] ✅ Successfully stored YouTube video:`)
              console.log(`  - Stored ID: ${storedItem.id}`)
              console.log(`  - Page ID: ${pageId}`)
              console.log(`  - Type: ${storedItem.type}`)
              console.log(`  - Metadata embedUrl: ${storedItem.metadata?.embedUrl}`)
              console.log(`  - Metadata isYouTube: ${storedItem.metadata?.isYouTube}`)
              
              extractedCount++
            } else {
              console.warn(`[Course Media Bridge] ⚠️ No embedUrl found for YouTube video ${mediaItem.id}`)
            }
          } else if (mediaItem.type === 'image' && mediaItem.url) {
            // For images, create a reference without blob (they're already stored)
            console.log(`[Course Media Bridge] ✅ Noted image reference: ${mediaItem.id} for ${pageId}`)
            extractedCount++
          } else if (mediaItem.type === 'video' && !mediaItem.isYouTube) {
            // For regular videos, create a reference without blob (they're already stored)
            console.log(`[Course Media Bridge] ✅ Noted video reference: ${mediaItem.id} for ${pageId}`)
            extractedCount++
          }
        } catch (error) {
          console.warn(`[Course Media Bridge] Failed to extract ${mediaItem.id}:`, error)
        }
      }
    }
    
    // Extract from welcome page
    if (courseContent.welcome) {
      await extractMediaFromPage(courseContent.welcome, 'welcome', 'welcome page')
    }
    
    // Extract from objectives page
    if (courseContent.objectivesPage) {
      await extractMediaFromPage(courseContent.objectivesPage, 'objectives', 'objectives page')
    }
    
    // Extract from topics
    for (const topic of courseContent.topics) {
      await extractMediaFromPage(topic, topic.id, `topic "${topic.title}"`)
    }
    
    console.log('')
    console.log(`[Course Media Bridge] 🎉 EXTRACTION COMPLETED:`)
    console.log(`  - Total media items processed: ${extractedCount}`)
    console.log(`  - Project ID: ${projectId}`)
    console.log(`  - Course title: ${courseContent.title || 'Untitled'}`)
    console.log('')
    
    if (extractedCount === 0) {
      console.warn(`[Course Media Bridge] ⚠️  WARNING: No media items were extracted!`)
      console.warn(`  This could mean:`)
      console.warn(`    1. Course content has no media arrays`)
      console.warn(`    2. Media arrays are empty`)
      console.warn(`    3. No YouTube videos were found in course content`)
      console.warn(`    4. MediaEnhancementWizard data is not being stored in course content`)
    }
    
  } catch (error) {
    console.error('[Course Media Bridge] ❌ FAILED to extract course content media:')
    console.error('  Error details:', error)
    console.error('  Stack:', error instanceof Error ? error.stack : 'No stack trace')
    // Don't throw - this should not break SCORM generation if it fails
  }
}

/**
 * Convert enhanced format to Rust-compatible format
 */
async function convertEnhancedToRustFormat(courseContent: EnhancedCourseContent, projectId: string, courseSettings?: CourseSettings) {
  // 📊 PERFORMANCE TIMING: Start enhanced format timing
  const overallStartTime = Date.now()
  console.log('[Rust SCORM] Converting enhanced format, topics:', courseContent.topics.length)
  
  // Debug: Log audio IDs being extracted
  console.log('[Rust SCORM] Welcome audio:', 
    (courseContent.welcome as any)?.audioId || 
    courseContent.welcome?.audioFile || 
    courseContent.welcome?.media?.find((m: any) => m.type === 'audio')?.id
  )
  console.log('[Rust SCORM] Objectives audio:', 
    (courseContent.objectivesPage as any)?.audioId || 
    courseContent.objectivesPage?.audioFile || 
    courseContent.objectivesPage?.media?.find((m: any) => m.type === 'audio')?.id
  )
  courseContent.topics.forEach((topic, i) => {
    console.log(`[Rust SCORM] Topic ${i+1} (${topic.id}) audio:`, 
      (topic as any).audioId || 
      topic.audioFile || 
      topic.media?.find((m: any) => m.type === 'audio')?.id
    )
  })
  
  // Check if we have knowledge checks
  const topicsWithKC = courseContent.topics.filter(t => t.knowledgeCheck).length
  console.log('[Rust SCORM] Topics with knowledge checks:', topicsWithKC)
  
  // CRITICAL FIX: Extract media from course content and store in MediaService
  // This bridges the gap between MediaEnhancementWizard and media injection system
  console.log(`[Rust SCORM] Extracting course content media for injection system`)
  await extractCourseContentMedia(courseContent, projectId)
  console.log(`[Rust SCORM] Course content media extraction completed`)

  // 🚀 CRITICAL PERFORMANCE FIX: Pre-load ALL media before content conversion
  console.log(`[Rust SCORM] Starting batch pre-loading of all media`)
  const allMediaIds = collectAllMediaIds(courseContent)
  await batchPreloadMedia(allMediaIds, projectId)
  console.log(`[Rust SCORM] Batch pre-loading completed`)

  // 🗺️ BUILD AUTHORITATIVE EXTENSION MAP: Create single source of truth for all extensions
  console.log(`[Rust SCORM] Building authoritative id→extension map from cache`)
  authoritativeExtensionMap.clear() // Clear any previous map

  for (const id of allMediaIds) {
    const cached = mediaCache.get(id)
    if (cached?.mimeType) {
      const ext = getExtensionFromMimeType(cached.mimeType)
      if (ext) {
        authoritativeExtensionMap.set(id, '.' + ext)
        console.log(`[Extension Map] ${id} → .${ext} (from MIME: ${cached.mimeType})`)
      } else {
        console.log(`[Extension Map] ${id} → no extension mapping for MIME: ${cached.mimeType}`)
      }
    } else {
      console.log(`[Extension Map] ${id} → no cached MIME type available`)
    }
  }

  console.log(`[Extension Map] Built authoritative map with ${authoritativeExtensionMap.size} entries`)

  // 📊 PERFORMANCE OPTIMIZATION: Single listAllMedia() call for all auto-population functions
  console.log(`[Rust SCORM] Loading all stored media items once for consolidated operations (enhanced format)`)
  const consolidatedListStartTime = Date.now()
  await ensureProjectLoaded(projectId)
  const { createMediaService } = await import('./MediaService')
  const mediaService = createMediaService(projectId, undefined, true)
  const allStoredMediaItems = await mediaService.listAllMedia()
  const consolidatedListDuration = Date.now() - consolidatedListStartTime
  console.log(`[PERFORMANCE] ✅ Consolidated listAllMedia() completed in ${consolidatedListDuration}ms - found ${allStoredMediaItems?.length || 0} stored items`)

  // 📊 PERFORMANCE TIMING: YouTube recovery (moved after media loading for consolidation)
  console.log(`[Rust SCORM] Starting YouTube recovery for enhanced format`)
  const youtubeStartTime = Date.now()
  await autoPopulateYouTubeFromStorage(courseContent, projectId, allStoredMediaItems)
  const youtubeDuration = Date.now() - youtubeStartTime
  console.log(`[PERFORMANCE] ✅ YouTube recovery completed in ${youtubeDuration}ms`)

  // 🚨 Enable regression detection for content conversion phase
  mediaServiceCallDetector.enterConversion()

  // Media resolution tracking
  const mediaFiles: MediaFile[] = []
  const mediaCounter: { [type: string]: number } = {}
  
  const result = {
    course_title: courseContent.title || 'Untitled Course',
    course_description: undefined, // Enhanced format doesn't have description
    pass_mark: courseSettings?.passMark || courseContent.passMark || 80,
    navigation_mode: courseSettings?.navigationMode || courseContent.navigationMode || 'linear',
    allow_retake: courseSettings?.allowRetake ?? (courseContent.allowRetake !== false ? true : false),
    require_audio_completion: courseSettings?.requireAudioCompletion || false,
    // New comprehensive course settings
    auto_advance: courseSettings?.autoAdvance || false,
    allow_previous_review: courseSettings?.allowPreviousReview ?? true,
    retake_delay: courseSettings?.retakeDelay || 0,
    completion_criteria: courseSettings?.completionCriteria || 'view_and_pass',
    show_progress: courseSettings?.showProgress ?? true,
    show_outline: courseSettings?.showOutline ?? true,
    confirm_exit: courseSettings?.confirmExit ?? true,
    font_size: courseSettings?.fontSize || 'medium',
    time_limit: constrainNumber(courseSettings?.timeLimit, 0, 86400, 0), // Max 24 hours
    session_timeout: constrainNumber(courseSettings?.sessionTimeout, 5, 1440, 30), // 5 min to 24 hours
    minimum_time_spent: constrainNumber(courseSettings?.minimumTimeSpent, 0, 7200, 0), // Max 2 hours
    keyboard_navigation: courseSettings?.keyboardNavigation ?? true,
    printable: courseSettings?.printable || false,
    
    welcome_page: courseContent.welcome ? {
      title: courseContent.welcome.title || 'Welcome',
      content: courseContent.welcome.content || '',
      start_button_text: courseContent.welcome.startButtonText || 'Start Course',
      audio_file: await resolveAudioCaptionFile(
        courseContent.welcome.audioId ||
        courseContent.welcome.audioFile ||
        safeFindInArray(courseContent.welcome.media, (m: any) => m?.type === 'audio')?.id,
        projectId,
        mediaFiles,
        courseContent.welcome.audioBlob
      ),
      caption_file: await resolveAudioCaptionFile(
        courseContent.welcome.captionId ||
        courseContent.welcome.captionFile ||
        safeFindInArray(courseContent.welcome.media, (m: any) => m?.type === 'caption')?.id,
        projectId,
        mediaFiles,
        courseContent.welcome.captionBlob
      ),
      image_url: await resolveImageUrl(
        courseContent.welcome.imageUrl ||
        // Check welcome media array for images (consistent with topics)
        safeFindInArray(courseContent.welcome.media, (m: any) => m?.type === 'image')?.url ||
        safeFindInArray(courseContent.welcome.media, (m: any) => m?.type === 'image')?.id,
        projectId,
        mediaFiles,
        mediaCounter
      ),
      // Filter out audio/caption from media array since they're handled separately
      media: await resolveMedia(safeArrayFilter(courseContent.welcome.media).filter((m: any) => {
        // Keep SVG files regardless of their type classification
        if (m?.id?.includes('svg') || m?.url?.includes('.svg') || m?.type === 'svg') {
          return true
        }
        // Filter out audio and caption types
        return m?.type !== 'audio' && m?.type !== 'caption'
      }), projectId, mediaFiles, mediaCounter),
    } : undefined,
    
    learning_objectives_page: courseContent.objectives ? {
      objectives: courseContent.objectives,
      audio_file: await resolveAudioCaptionFile(
        courseContent.objectivesPage?.audioId ||
        courseContent.objectivesPage?.audioFile ||
        safeFindInArray(courseContent.objectivesPage?.media, (m: any) => m?.type === 'audio')?.id ||
        // Fallback to learningObjectivesPage for backward compatibility
        (courseContent as any).learningObjectivesPage?.audioFile ||
        safeFindInArray((courseContent as any).learningObjectivesPage?.media, (m: any) => m?.type === 'audio')?.id,
        projectId,
        mediaFiles,
        courseContent.objectivesPage?.audioBlob || (courseContent as any).learningObjectivesPage?.audioBlob
      ),
      caption_file: await resolveAudioCaptionFile(
        courseContent.objectivesPage?.captionId ||
        courseContent.objectivesPage?.captionFile ||
        safeFindInArray(courseContent.objectivesPage?.media, (m: any) => m?.type === 'caption')?.id ||
        // Fallback to learningObjectivesPage for backward compatibility
        (courseContent as any).learningObjectivesPage?.captionFile ||
        safeFindInArray((courseContent as any).learningObjectivesPage?.media, (m: any) => m?.type === 'caption')?.id,
        projectId,
        mediaFiles,
        courseContent.objectivesPage?.captionBlob || (courseContent as any).learningObjectivesPage?.captionBlob
      ),
      image_url: await resolveImageUrl(
        courseContent.objectivesPage?.imageUrl ||
        (courseContent as any).learningObjectivesPage?.imageUrl ||
        // Check media arrays for images (consistent with topics)
        safeFindInArray(courseContent.objectivesPage?.media, (m: any) => m?.type === 'image')?.url ||
        safeFindInArray(courseContent.objectivesPage?.media, (m: any) => m?.type === 'image')?.id ||
        safeFindInArray((courseContent as any).learningObjectivesPage?.media, (m: any) => m?.type === 'image')?.url ||
        safeFindInArray((courseContent as any).learningObjectivesPage?.media, (m: any) => m?.type === 'image')?.id,
        projectId,
        mediaFiles,
        mediaCounter
      ),
      // Filter out audio/caption from media array since they're handled separately
      // Support both objectivesPage and learningObjectivesPage for backward compatibility
      media: await resolveMedia(
        (courseContent.objectivesPage?.media || (courseContent as any).learningObjectivesPage?.media)?.filter((m: any) => {
          // Keep SVG files regardless of their type classification
          if (m?.id?.includes('svg') || m?.url?.includes('.svg') || m?.type === 'svg') {
            return true
          }
          // Filter out audio and caption types
          return m.type !== 'audio' && m.type !== 'caption'
        }),
        projectId,
        mediaFiles,
        mediaCounter
      ),
    } : undefined,
    
    topics: await safePromiseAll(
      safeArrayMap(courseContent.topics, async topic => {
      console.log(`[Rust SCORM] Processing topic ${topic.id}, has KC:`, !!topic.knowledgeCheck)
      
      const convertedTopic = {
        id: topic.id,
        title: topic.title,
        content: topic.content || '',
        knowledge_check: undefined as any,
        audio_file: await resolveAudioCaptionFile(
          topic.audioId ||
          topic.audioFile ||
          safeFindInArray(topic.media, (m: any) => m?.type === 'audio')?.id,
          projectId,
          mediaFiles,
          topic.audioBlob
        ),
        caption_file: await resolveAudioCaptionFile(
          topic.captionId ||
          topic.captionFile ||
          safeFindInArray(topic.media, (m: any) => m?.type === 'caption')?.id,
          projectId,
          mediaFiles,
          topic.captionBlob
        ),
        image_url: await resolveImageUrl(topic.imageUrl, projectId, mediaFiles, mediaCounter),
        // Filter out audio/caption from media array since they're handled separately
        media: await resolveMedia(safeArrayFilter(topic.media).filter((m: any) => {
          // Keep SVG files regardless of their type classification
          if (m?.id?.includes('svg') || m?.url?.includes('.svg') || m?.type === 'svg') {
            return true
          }
          // Filter out audio and caption types
          return m?.type !== 'audio' && m?.type !== 'caption'
        }).map(m => ({
          id: m.id,
          type: m.type,
          url: m.url || '',
          title: m.title || '',
          clipStart: (m as any).clip_start || m.clipStart,
          clipEnd: (m as any).clip_end || m.clipEnd
        })), projectId, mediaFiles, mediaCounter)
      }
      
      // Debug log to see audio/caption files
      console.log(`[Rust SCORM] Topic ${topic.id} resolved audio_file:`, convertedTopic.audio_file)
      console.log(`[Rust SCORM] Topic ${topic.id} resolved caption_file:`, convertedTopic.caption_file)
      console.log(`[Rust SCORM] Topic ${topic.id} original media:`, topic.media)
      console.log(`[Rust SCORM] Topic ${topic.id} filtered media:`, convertedTopic.media)
      
      // Handle single knowledge check question (not array)
      if (topic.knowledgeCheck && !topic.knowledgeCheck.questions) {
        console.log(`[Rust SCORM] Topic ${topic.id} has single KC question`)
        const kc = topic.knowledgeCheck as any
        
        // Debug logging for fill-in-blank
        if (kc.type === 'fill-in-the-blank') {
          console.log(`[Rust SCORM] Fill-in-blank question data:`, {
            type: kc.type,
            question: kc.question,
            text: kc.text,
            blank: kc.blank,
            correctAnswer: kc.correctAnswer,
            correctFeedback: kc.correctFeedback,
            incorrectFeedback: kc.incorrectFeedback,
            feedback: kc.feedback
          })
        }
        
        // Handle true-false questions specially
        if (kc.type === 'true-false') {
          convertedTopic.knowledge_check = {
            enabled: true,
            questions: [{
              type: kc.type,
              text: kc.question || kc.text || 'True or False?',
              options: ['True', 'False'],
              correct_answer: (kc.correctAnswer === 0 || kc.correctAnswer === 'true' || kc.correctAnswer === true ? 'true' : 'false'),
              explanation: kc.explanation || (kc.feedback && kc.feedback.incorrect) || (kc.feedback && kc.feedback.correct) || '',
            correct_feedback: kc.correctFeedback || (kc.feedback && kc.feedback.correct) || 'Correct!',
            incorrect_feedback: kc.incorrectFeedback || (kc.feedback && kc.feedback.incorrect) || 'Not quite. Try again!',
            }]
          }
        } else {
          convertedTopic.knowledge_check = {
            enabled: true,
            questions: [{
              type: kc.type || 'multiple-choice',
              text: (() => {
                // Use the appropriate property based on question type
                if (kc.type === 'fill-in-the-blank') {
                  // For fill-in-the-blank, use blank property
                  return kc.blank || kc.question || kc.text || 'The answer is _____';
                } else {
                  // For other types, use question property
                  return kc.question || kc.text || 'Question text missing';
                }
              })(),
              options: kc.options,
              correct_answer: (() => {
                // Handle multiple choice questions with options
                if (kc.options && kc.options.length > 0) {
                  // If correctAnswer is a number, use it as an index
                  if (typeof kc.correctAnswer === 'number') {
                    return kc.options[kc.correctAnswer] || kc.options[0]
                  }
                  // If correctAnswer is a string that's a number, parse and use as index
                  if (typeof kc.correctAnswer === 'string' && !isNaN(parseInt(kc.correctAnswer))) {
                    const index = parseInt(kc.correctAnswer)
                    if (index >= 0 && index < kc.options.length) {
                      return kc.options[index]
                    }
                  }
                  // If correctAnswer is already the actual answer text
                  if (typeof kc.correctAnswer === 'string' && kc.options.includes(kc.correctAnswer)) {
                    return kc.correctAnswer
                  }
                  // Fallback to first option
                  return kc.options[0]
                }
                // For non-multiple choice, return as string
                return String(kc.correctAnswer || '')
              })(),
              explanation: kc.explanation || (kc.feedback && kc.feedback.incorrect) || (kc.feedback && kc.feedback.correct) || '',
            correct_feedback: kc.correctFeedback || (kc.feedback && kc.feedback.correct) || 'Correct!',
            incorrect_feedback: kc.incorrectFeedback || (kc.feedback && kc.feedback.incorrect) || 'Not quite. Try again!',
            }]
          }
        }
      } else if (topic.knowledgeCheck?.questions) {
        console.log(`[Rust SCORM] Topic ${topic.id} has ${topic.knowledgeCheck.questions.length} KC questions`)
        convertedTopic.knowledge_check = {
          enabled: true,
          questions: (topic.knowledgeCheck.questions || []).map(q => {
            // Validate question has required fields
            if (!q.type && !(q as any).questionType) {
              console.error(`[Rust SCORM] Enhanced question missing type in topic ${topic.id}:`, q)
              throw new Error(`Question missing type in topic ${topic.id}`)
            }
            if (!q.question && !(q as any).text && !(q as any).blank) {
              console.error(`[Rust SCORM] Enhanced question missing question/text/blank field in topic ${topic.id}:`, q)
              throw new Error(`Question missing question/text/blank field in topic ${topic.id}`)
            }
            if (q.correctAnswer === undefined || q.correctAnswer === null) {
              console.error(`[Rust SCORM] Enhanced question missing correctAnswer in topic ${topic.id}:`, q)
              throw new Error(`Question missing correctAnswer in topic ${topic.id}`)
            }
            
            // Debug logging for fill-in-the-blank questions
            if (q.type === 'fill-in-the-blank') {
              console.log(`[Rust SCORM] Fill-in-blank question in array:`, {
                type: q.type,
                question: q.question,
                text: (q as any).text,
                blank: (q as any).blank,
                correctAnswer: q.correctAnswer,
                feedback: (q as any).feedback,
                correctFeedback: (q as any).correctFeedback,
                incorrectFeedback: (q as any).incorrectFeedback,
                hasFeedback: !!(q as any).feedback,
                hasFeedbackCorrect: !!((q as any).feedback && (q as any).feedback.correct),
                hasFeedbackIncorrect: !!((q as any).feedback && (q as any).feedback.incorrect),
                feedbackCorrectValue: (q as any).feedback?.correct,
                feedbackIncorrectValue: (q as any).feedback?.incorrect
              })
            }
            
            const result = {
              type: q.type || (q as any).questionType,
              text: (() => {
                // Use the appropriate property based on question type
                if (q.type === 'fill-in-the-blank') {
                  return (q as any).blank || q.question || (q as any).text || 'The answer is _____';
                } else {
                  return q.question || (q as any).text || 'Question text missing';
                }
              })(),
              options: q.options,
              correct_answer: (() => {
                // Handle multiple choice questions with options
                if (q.options && q.options.length > 0) {
                  // If correctAnswer is a number, use it as an index
                  if (typeof q.correctAnswer === 'number') {
                    return q.options[q.correctAnswer] || q.options[0]
                  }
                  // If correctAnswer is a string that's a number, parse and use as index
                  if (typeof q.correctAnswer === 'string' && !isNaN(parseInt(q.correctAnswer))) {
                    const index = parseInt(q.correctAnswer)
                    if (index >= 0 && index < q.options.length) {
                      return q.options[index]
                    }
                  }
                  // If correctAnswer is already the actual answer text
                  if (typeof q.correctAnswer === 'string' && q.options.includes(q.correctAnswer)) {
                    return q.correctAnswer
                  }
                  // Fallback to first option
                  return q.options[0]
                }
                // For non-multiple choice, return as string
                return String(q.correctAnswer || '')
              })(),
              explanation: q.explanation || ((q as any).feedback && (q as any).feedback.incorrect) || ((q as any).feedback && (q as any).feedback.correct) || '',
              correct_feedback: (q as any).correctFeedback || ((q as any).feedback && (q as any).feedback.correct) || 'Correct!',
              incorrect_feedback: (q as any).incorrectFeedback || ((q as any).feedback && (q as any).feedback.incorrect) || 'Not quite. Try again!',
            }
            
            if (q.type === 'fill-in-the-blank') {
              console.log(`[Rust SCORM] Returning question object:`, {
                type: result.type,
                correct_feedback: result.correct_feedback,
                incorrect_feedback: result.incorrect_feedback,
                explanation: result.explanation
              })
            }
            
            return result
          })
        }
      }
      
      return convertedTopic
    }),
    'enhanced topics processing',
    projectId
  ),
    
    assessment: courseContent.assessment ? {
      questions: (courseContent.assessment.questions || []).map(q => {
        // Validate assessment question has required fields
        if (!q.question) {
          console.error('[Rust SCORM] Enhanced assessment question missing question field:', q)
          throw new Error('Assessment question missing question field')
        }
        if (!q.options) {
          console.error('[Rust SCORM] Enhanced assessment question missing options:', q)
          throw new Error('Assessment question missing options')
        }
        if (q.correctAnswer === undefined || q.correctAnswer === null) {
          console.error('[Rust SCORM] Enhanced assessment question missing correctAnswer:', q)
          throw new Error('Assessment question missing correctAnswer')
        }
        
        return {
          type: (q as any).type || 'multiple-choice', // Use actual question type, not always multiple-choice
          text: q.question, // Enhanced format uses 'question'
          options: q.options,
          correct_answer: (() => {
            // Handle different question types properly
            if ((q as any).type === 'fill-in-the-blank') {
              // For fill-in-blank, correctAnswer is already the string answer
              return String(q.correctAnswer);
            } else if (typeof q.correctAnswer === 'number') {
              // For MC/TF with numeric index, use it to look up the option
              return q.options[q.correctAnswer] || String(q.correctAnswer);
            } else {
              // Fallback for string correctAnswer (shouldn't happen for MC/TF but handle gracefully)
              return String(q.correctAnswer);
            }
          })(),
          explanation: '', // Enhanced format doesn't have explanations for assessment
          correct_feedback: (q as any).correct_feedback || (q as any).correctFeedback || 'Correct!',
          incorrect_feedback: (q as any).incorrect_feedback || (q as any).incorrectFeedback || 'Not quite. Try again!',
        }
      })
    } : undefined,
  }
  
  // 📊 PERFORMANCE TIMING: Auto-populate missing media from storage
  console.log(`[Rust SCORM] Before auto-population: mediaFiles.length = ${mediaFiles.length}`)
  const autoPopulateStartTime = Date.now()
  await autoPopulateMediaFromStorage(projectId, mediaFiles, mediaCounter, allStoredMediaItems)
  const autoPopulateDuration = Date.now() - autoPopulateStartTime
  console.log(`[PERFORMANCE] ✅ Auto-population completed in ${autoPopulateDuration}ms: mediaFiles.length = ${mediaFiles.length}`)

  // 📊 PERFORMANCE TIMING: Inject orphaned media into course content structure
  console.log(`[Rust SCORM] Injecting orphaned media into course content...`)
  const injectStartTime = Date.now()
  await injectOrphanedMediaIntoCourseContent(projectId, result, allStoredMediaItems)
  const injectDuration = Date.now() - injectStartTime
  console.log(`[PERFORMANCE] ✅ Media injection completed in ${injectDuration}ms`)

  // 🚨 Disable regression detection after content conversion
  mediaServiceCallDetector.exitConversion()

  // 📊 PERFORMANCE TIMING: Overall format completion
  const overallDuration = Date.now() - overallStartTime
  console.log(`[PERFORMANCE] 🏁 Format generation completed in ${overallDuration}ms`)

  return { courseData: result, mediaFiles }
}

/**
 * Generate SCORM package using Rust backend with templates
 */
export async function generateRustSCORM(
  courseContent: CourseContent | EnhancedCourseContent,
  projectId: string,
  onProgress?: (message: string, progress: number) => void,
  preloadedMedia?: Map<string, Blob> | Map<string, { data: Uint8Array; mimeType: string }>,
  courseSettings?: CourseSettings
): Promise<Uint8Array> {
  debugLogger.info('SCORM_GENERATION', 'Starting SCORM generation process', {
    projectId,
    hasPreloadedMedia: !!preloadedMedia,
    preloadedMediaCount: preloadedMedia?.size || 0,
    hasCourseSettings: !!courseSettings,
    contentType: 'objectives' in courseContent ? 'enhanced' : 'standard'
  })

  // 🔧 FIX: Reset media ID to filename mapping for new generation
  mediaIdToFilename.clear()
  console.log('[Rust SCORM] Reset media ID to filename mapping for new generation')

  // Initialize performance monitoring for cache effectiveness
  performanceTrace = {
    cacheHits: 0,
    cacheMisses: 0,
    batchedLoads: 0,
    startTime: Date.now()
  }
  // Pre-load media cache if provided
  if (preloadedMedia && preloadedMedia.size > 0) {
    // Check if this is an ID-keyed map with Uint8Array data (optimal format)
    const firstEntry = preloadedMedia.entries().next().value
    if (firstEntry && firstEntry[1] && typeof firstEntry[1] === 'object' && 'data' in firstEntry[1] && 'mimeType' in firstEntry[1]) {
      // ID-keyed format: Map<string, {data: Uint8Array, mimeType: string}>
      console.log(`[SCORM Media Debug] Using ID-keyed preloaded cache for ${preloadedMedia.size} items`)
      hydrateMediaCacheById(preloadedMedia as Map<string, { data: Uint8Array; mimeType: string }>)
    } else {
      // Filename-keyed format: Map<string, Blob>
      console.log(`[SCORM Media Debug] Using filename-keyed preloaded cache for ${preloadedMedia.size} items`)
      await preloadMediaCache(preloadedMedia as Map<string, Blob>)
    }
  }
  
  // Lock all blob URLs during SCORM generation to prevent cleanup
  const { blobUrlManager } = await import('../utils/blobUrlManager')
  blobUrlManager.lockAll()
  
  // Set up progress event listener
  let unlisten: (() => void) | undefined
  if (onProgress && typeof onProgress === 'function') {
    listen<{ message: string; progress: number }>('scorm-generation-progress', (event) => {
      console.log('[Rust SCORM] Progress event:', event.payload)
      onProgress(event.payload.message, event.payload.progress)
    }).then(unlistenFn => {
      unlisten = unlistenFn
    })
  }
  
  // Declare mediaFiles outside try block so it's accessible in catch block
  let mediaFiles: MediaFile[] = []
  
  try {
    // 🚀 PHASE 1: Prefetch all media in parallel before processing
    console.log('[Rust SCORM] 🚀 Starting media prefetch phase...')
    if (onProgress && typeof onProgress === 'function') {
      onProgress('Prefetching all media...', 5)
    }

    const allMediaIds = extractAllMediaIds(courseContent)
    console.log(`[Rust SCORM] Found ${allMediaIds.size} media items to prefetch`)

    // Clear existing cache to ensure fresh data
    mediaCache.clear()

    await prefetchAllMedia(allMediaIds, projectId, mediaCache)
    console.log(`[Rust SCORM] ✅ Prefetch completed, cached ${mediaCache.size} items`)

    debugLogger.info('SCORM_GENERATION', 'Converting course content to Rust format', { projectId })
    console.log('[Rust SCORM] Converting course content to Rust format')
    if (onProgress && typeof onProgress === 'function') {
      onProgress('Converting course content...', 10)
    }
    const { courseData: rustCourseData, mediaFiles: convertedMediaFiles } = await convertToRustFormat(courseContent, projectId, courseSettings)
    mediaFiles = convertedMediaFiles
    
    debugLogger.info('SCORM_GENERATION', 'Course content conversion completed', {
      projectId,
      mediaFilesCount: mediaFiles.length,
      hasCourseData: !!rustCourseData
    })
    
    // Debug: Log the converted data to see what's being sent
    console.log('[Rust SCORM] Converted data:', JSON.stringify(rustCourseData, null, 2))
    console.log('[Rust SCORM] Media files count:', mediaFiles.length)
    
    // Debug: Check welcome and objectives pages media
    if (rustCourseData.welcome_page) {
      console.log('[Rust SCORM] Welcome page media:', {
        image_url: rustCourseData.welcome_page.image_url,
        media: rustCourseData.welcome_page.media,
        hasMedia: !!rustCourseData.welcome_page.media,
        mediaLength: rustCourseData.welcome_page.media?.length
      })
    }
    if (rustCourseData.learning_objectives_page) {
      console.log('[Rust SCORM] Objectives page media:', {
        image_url: (rustCourseData.learning_objectives_page as any).image_url,
        media: rustCourseData.learning_objectives_page.media,
        hasMedia: !!rustCourseData.learning_objectives_page.media,
        mediaLength: rustCourseData.learning_objectives_page.media?.length
      })
    }

    // 🔧 VALIDATION: Check image extension consistency
    const expectedImageUrls: string[] = []
    if (rustCourseData.welcome_page?.image_url) {
      expectedImageUrls.push(rustCourseData.welcome_page.image_url)
    }
    if (rustCourseData.learning_objectives_page?.image_url) {
      expectedImageUrls.push((rustCourseData.learning_objectives_page as any).image_url)
    }
    if (rustCourseData.topics) {
      rustCourseData.topics.forEach((topic: any) => {
        if (topic.image_url) {
          expectedImageUrls.push(topic.image_url)
        }
      })
    }
    validateImageExtensions(mediaFiles, expectedImageUrls)

    // Check if any questions are missing the text field
    if (rustCourseData.topics) {
      rustCourseData.topics.forEach((topic: any, i: number) => {
        if (topic.knowledge_check?.questions) {
          topic.knowledge_check.questions.forEach((q: any, j: number) => {
            if (!q.text) {
              console.error(`[Rust SCORM] Topic ${i} question ${j} missing 'text' field:`, q)
            }
          })
        }
      })
    }
    
    console.log('[Rust SCORM] Invoking Rust generator')
    console.log('[Rust SCORM] Sample topic data being sent:', JSON.stringify(rustCourseData.topics[0], null, 2))
    
    if (onProgress && typeof onProgress === 'function') {
      onProgress('Processing media files...', 30)
    }
    
    // Calculate dynamic timeout based on media files
    const baseTimeout = 180000 // 3 minutes base (increased from 2 minutes)
    const perFileTimeout = 8000 // 8 seconds per media file (increased from 4 seconds)
    const maxTimeout = 600000 // 10 minutes max
    const calculatedTimeout = Math.min(baseTimeout + (mediaFiles.length * perFileTimeout), maxTimeout)
    
    console.log(`[Rust SCORM] Dynamic timeout calculated: ${calculatedTimeout}ms (${Math.round(calculatedTimeout / 1000)}s) for ${mediaFiles.length} media files`)
    
    if (onProgress && typeof onProgress === 'function') {
      // Create more descriptive progress message
      let mediaDescription = 'no media files'
      
      if (mediaFiles.length > 0) {
        // 📊 PERFORMANCE OPTIMIZATION: Use simple count for progress description (avoids scoping issues)
        try {
          // For progress display, just show binary file count - embedded videos will be counted separately
          mediaDescription = `${mediaFiles.length} binary files`
          console.log(`[PERFORMANCE] ✅ Using simple progress description: ${mediaDescription}`)
        } catch (error) {
          // Fallback to basic count if MediaService access fails
          mediaDescription = `${mediaFiles.length} binary files`
        }
      }
      
      onProgress(`Generating SCORM package (${mediaDescription})...`, 50)
    }
    
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const timeoutSeconds = Math.round(calculatedTimeout / 1000)
        reject(new Error(
          `SCORM generation timed out after ${timeoutSeconds} seconds. ` +
          `The package contains ${mediaFiles.length} media files which may require more processing time. ` +
          `Consider optimizing images or reducing the number of media files if generation continues to fail.`
        ))
      }, calculatedTimeout)
    })
    
    // VALIDATION: Check for undefined URLs before sending to Rust
    console.log('[Rust SCORM] 🔍 Validating media URLs before Rust generation...')
    const validationErrors: string[] = []
    
    // Helper function to validate media array
    const validateMediaArray = (mediaArray: any[], context: string) => {
      if (!mediaArray) return
      mediaArray.forEach((media, index) => {
        if (!media.url || media.url === undefined) {
          validationErrors.push(`${context}[${index}]: Media '${media.id}' has undefined URL`)
          console.log(`❌ [URL VALIDATION] ${context}[${index}]: Media '${media.id}' has undefined URL:`, {
            id: media.id,
            type: media.type,
            url: media.url,
            embedUrl: media.embedUrl,
            youtubeUrl: media.youtubeUrl
          })
        } else {
          console.log(`✅ [URL VALIDATION] ${context}[${index}]: Media '${media.id}' URL is valid: ${media.url}`)
        }
      })
    }
    
    // Validate welcome page media
    if (rustCourseData.welcome_page?.media) {
      validateMediaArray(rustCourseData.welcome_page.media, 'welcome_page.media')
    }
    
    // Validate objectives page media
    if (rustCourseData.learning_objectives_page?.media) {
      validateMediaArray(rustCourseData.learning_objectives_page.media, 'learning_objectives_page.media')
    }
    
    // Validate topics media
    if (rustCourseData.topics) {
      rustCourseData.topics.forEach((topic: any, topicIndex: number) => {
        if (topic.media) {
          validateMediaArray(topic.media, `topics[${topicIndex}].media`)
        }
      })
    }
    
    // If validation errors found, reject immediately
    if (validationErrors.length > 0) {
      const errorMessage = `URL validation failed before Rust generation:\n${validationErrors.join('\n')}`
      console.log(`❌ [URL VALIDATION] ${validationErrors.length} validation errors found:`)
      validationErrors.forEach(error => console.log(`   - ${error}`))
      throw new Error(`Failed to generate SCORM package. Media URL validation failed: ${validationErrors.length} media items have undefined URLs. This would cause "missing field 'url'" errors in Rust deserialization.`)
    }
    
    console.log('✅ [URL VALIDATION] All media URLs are valid, proceeding with Rust generation')
    
    // Race between the actual invoke and the timeout
    debugLogger.info('SCORM_GENERATION', 'Invoking Rust SCORM generator', {
      projectId,
      mediaFilesCount: mediaFiles.length,
      timeoutSeconds: Math.round(calculatedTimeout / 1000)
    })
    
    // Enhanced logging for media files being passed to Rust
    console.log(`[SCORM Media Debug] 🚀 Invoking Rust backend with:`)
    console.log(`  📁 Project ID: ${projectId}`)
    console.log(`  📦 Media files count: ${mediaFiles.length}`)
    if (mediaFiles.length > 0) {
      console.log(`  📋 Media files being included:`)
      mediaFiles.forEach((file, idx) => {
        console.log(`    ${idx + 1}. ${file.filename} (${file.content.length} bytes)`)
      })
    } else {
      console.log(`  ⚠️  No media files to include (empty array - this will prevent disk fallback)`)
    }
    
    // Convert extension map to plain object for Rust
    const extensionMapObject = Object.fromEntries(authoritativeExtensionMap)
    console.log(`[Extension Map] Passing ${Object.keys(extensionMapObject).length} extension mappings to Rust:`, extensionMapObject)

    const result = await Promise.race([
      invoke<number[]>('generate_scorm_enhanced', {
        courseData: rustCourseData,
        projectId: projectId,
        mediaFiles: mediaFiles, // Always pass array, even if empty - prevents fallback to disk loading
        extensionMap: extensionMapObject, // Pass complete authoritative extension map
      }),
      timeoutPromise
    ])
    
    // Convert number array to Uint8Array
    const buffer = new Uint8Array(result)
    
    debugLogger.info('SCORM_GENERATION', 'SCORM package generated successfully', {
      projectId,
      packageSize: buffer.length,
      mediaFilesIncluded: mediaFiles.length
    })
    
    console.log('[Rust SCORM] Generated package size:', buffer.length)

    // Log performance trace statistics
    if (performanceTrace) {
      const generationTime = Date.now() - performanceTrace.startTime
      console.log('[SCORM Trace]', {
        cacheHits: performanceTrace.cacheHits,
        cacheMisses: performanceTrace.cacheMisses,
        batchedLoads: performanceTrace.batchedLoads,
        generationTimeMs: generationTime,
        cacheEfficiency: performanceTrace.cacheHits + performanceTrace.cacheMisses > 0
          ? `${Math.round(performanceTrace.cacheHits / (performanceTrace.cacheHits + performanceTrace.cacheMisses) * 100)}%`
          : 'N/A'
      })
      // Reset trace for next generation
      performanceTrace = null
    }

    // Unlock blob URLs after successful generation
    blobUrlManager.unlockAll()

    if (onProgress && typeof onProgress === 'function') {
      onProgress('SCORM package generated successfully!', 100)
    }

    return buffer
  } catch (error) {
    // Always unlock blob URLs, even on error
    blobUrlManager.unlockAll()

    // Reset performance trace on error
    if (performanceTrace) {
      performanceTrace = null
    }

    // Log critical SCORM error to ultraSimpleLogger for persistence
    debugLogger.error('SCORM_GENERATION', 'SCORM generation process failed', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      mediaFilesCount: mediaFiles.length,
      timestamp: new Date().toISOString()
    })
    
    console.error('[Rust SCORM] Generation failed:', error)
    console.error('[Rust SCORM] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: error?.constructor?.name || typeof error
    })
    
    // Add more context to error message
    if (error instanceof Error && error.message.includes('timeout')) {
      throw error // Re-throw timeout errors as-is
    } else if (error instanceof Error && error.message.includes('template')) {
      throw new Error(`SCORM template error: ${error.message}. This may be due to incompatible Handlebars syntax.`)
    } else if (error instanceof Error && error.message.includes('memory')) {
      throw new Error(
        `Out of memory while processing ${mediaFiles.length} media files. ` +
        `Try reducing image sizes or processing fewer files at once. ` +
        `Original error: ${error.message}`
      )
    } else {
      // Log critical SCORM generation failure to ultraSimpleLogger
      debugLogger.error('SCORM_GENERATION', 'SCORM package generation failed', {
        mediaFileCount: mediaFiles.length,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      })
      
      throw new Error(
        `Failed to generate SCORM package with ${mediaFiles.length} media files. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}. ` +
        `If this persists, try optimizing your media files.`
      )
    }
  } finally {
    // Clean up event listener
    if (unlisten) {
      unlisten()
    }
    
    // Clear media cache after generation
    clearMediaCache()
  }
}

/**
 * Test if Rust SCORM generation is available
 */
export async function isRustScormAvailable(): Promise<boolean> {
  try {
    // Try to invoke with empty data to check if command exists
    await invoke('generate_scorm_enhanced', {
      courseData: {},
      projectId: 'test',
    })
    return true
  } catch (error) {
    // Check if error is because of invalid data (command exists) or missing command
    const errorMessage = String(error)
    return !errorMessage.includes('not found') && !errorMessage.includes('unknown')
  }
}