/**
 * Unified ID Generator
 * 
 * Single source of truth for all ID generation in the application.
 * Provides type-safe, collision-free ID generation for all entities.
 */

// Branded types for compile-time safety
export type ProjectId = string & { __brand: 'ProjectId' }
export type MediaId = string & { __brand: 'MediaId' }
export type ContentId = string & { __brand: 'ContentId' }
export type ActivityId = string & { __brand: 'ActivityId' }
export type NotificationId = string & { __brand: 'NotificationId' }
export type ScormPackageId = string & { __brand: 'ScormPackageId' }
export type KnowledgeCheckId = string & { __brand: 'KnowledgeCheckId' }
export type AssessmentId = string & { __brand: 'AssessmentId' }

export type MediaType = 'image' | 'video' | 'audio' | 'caption'
export type ContentType = 'welcome' | 'objectives' | 'topic'

// Page ID normalization map
const PAGE_ID_MAP: Record<string, string> = {
  'content-0': 'welcome',
  'content-1': 'objectives',
  'learning-objectives': 'objectives'
}

// Topic index mapping for unknown pages
const topicIndexMap = new Map<string, number>()
let nextTopicIndex = 0

/**
 * Generate a unique project ID using UUID
 */
export function generateProjectId(): ProjectId {
  return `project_${crypto.randomUUID()}` as ProjectId
}

/**
 * Generate a media ID following the established pattern
 * ALL media types now use page-based indexing for consistency
 * (welcome=0, objectives=1, topics=2+)
 */
export function generateMediaId(type: MediaType, pageId: string): MediaId {
  // Runtime validation
  const validTypes = ['audio', 'video', 'image', 'caption']
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid media type: ${type}`)
  }
  
  const normalizedPageId = PAGE_ID_MAP[pageId] || pageId
  
  // ALL media types now use page-based indexing
  let pageIndex: number
  
  if (normalizedPageId === 'welcome') {
    pageIndex = 0
  } else if (normalizedPageId === 'objectives') {
    pageIndex = 1
  } else if (normalizedPageId.startsWith('topic-')) {
    // Extract topic number and add 2 (welcome=0, objectives=1, topics start at 2)
    const topicNum = parseInt(normalizedPageId.replace('topic-', ''))
    pageIndex = 2 + topicNum
  } else {
    // Unknown page, use topic index map
    if (!topicIndexMap.has(normalizedPageId)) {
      topicIndexMap.set(normalizedPageId, nextTopicIndex++)
    }
    pageIndex = 2 + topicIndexMap.get(normalizedPageId)!
  }
  
  return `${type}-${pageIndex}` as MediaId
}

/**
 * Generate a content ID for course pages
 */
export function generateContentId(type: ContentType, index?: number): ContentId {
  switch (type) {
    case 'welcome':
      return 'content-0' as ContentId
    case 'objectives':
      return 'content-1' as ContentId
    case 'topic':
      if (index === undefined) {
        throw new Error('Topic content requires an index')
      }
      return `content-${2 + index}` as ContentId
    default:
      throw new Error(`Invalid content type: ${type}`)
  }
}

/**
 * Generate a unique activity ID using UUID
 */
export function generateActivityId(): ActivityId {
  return `activity_${crypto.randomUUID()}` as ActivityId
}

/**
 * Generate an audio recording filename with timestamp
 */
export function generateAudioRecordingId(): string {
  return `recorded-${Date.now()}.wav`
}

/**
 * Generate a notification ID with timestamp
 */
export function generateNotificationId(): NotificationId {
  return `notification-${Date.now()}` as NotificationId
}

/**
 * Generate a SCORM package identifier with timestamp
 */
export function generateScormPackageId(): ScormPackageId {
  return `course-${Date.now()}` as ScormPackageId
}

/**
 * Generate a unique knowledge check question ID using UUID
 */
export function generateKnowledgeCheckId(): KnowledgeCheckId {
  return `kc_${crypto.randomUUID()}` as KnowledgeCheckId
}

/**
 * Generate a unique assessment question ID using UUID
 */
export function generateAssessmentId(): AssessmentId {
  return `assessment_${crypto.randomUUID()}` as AssessmentId
}

/**
 * Parse a media ID to extract type and index
 */
export function parseMediaId(id: MediaId): { type: MediaType; index: number } | null {
  const match = id.match(/^(audio|video|image|caption)-(\d+)$/)
  if (!match) return null
  
  return {
    type: match[1] as MediaType,
    index: parseInt(match[2])
  }
}

/**
 * Validate if a string is a valid project ID
 */
export function isValidProjectId(id: string): boolean {
  return /^project_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
}

/**
 * Validate if a string is a valid media ID
 */
export function isValidMediaId(id: string): boolean {
  return /^(audio|video|image|caption)-\d+$/.test(id)
}

/**
 * Migrate old media ID formats to new format
 */
export function migrateOldMediaId(oldId: string, type: MediaType, pageId: string): MediaId {
  // If already in new format, return as-is
  if (isValidMediaId(oldId)) {
    return oldId as MediaId
  }
  
  // Generate new ID for old formats
  return generateMediaId(type, pageId)
}

/**
 * Reset all counters (for testing only)
 */
export function __resetCounters(): void {
  topicIndexMap.clear()
  nextTopicIndex = 0
}