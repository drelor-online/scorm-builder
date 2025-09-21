/**
 * Page identifier constants for SCORM Builder
 *
 * Centralized page IDs to prevent inconsistencies and regressions
 * across storage, migration, and validation systems.
 */

/**
 * Learning Objectives page identifier
 *
 * This constant ensures consistent handling across:
 * - Storage grouping and retrieval
 * - Migration and normalization functions
 * - Media ensure-LO helper functions
 * - Pre-zip validation rules
 * - Caption-1 fallback logic
 *
 * Historical note: Previously inconsistent between 'objectives' (old format)
 * and 'learning-objectives' (new format). This normalizes to the new format.
 */
export const PAGE_LEARNING_OBJECTIVES = 'learning-objectives' as const

/**
 * Welcome page identifier
 */
export const PAGE_WELCOME = 'welcome' as const

/**
 * Assessment page identifier
 */
export const PAGE_ASSESSMENT = 'assessment' as const

/**
 * Topic page identifier prefix
 * Individual topics use: `topic-${index}` or `topic-${id}`
 */
export const PAGE_TOPIC_PREFIX = 'topic' as const

/**
 * All valid page types
 */
export const PAGE_TYPES = [
  PAGE_WELCOME,
  PAGE_LEARNING_OBJECTIVES,
  PAGE_TOPIC_PREFIX,
  PAGE_ASSESSMENT,
] as const

/**
 * Type for valid page identifiers
 */
export type PageType = typeof PAGE_TYPES[number]

/**
 * Standard media indexing for pages
 *
 * These constants define the expected media ID patterns:
 * - Welcome page: audio-0, caption-0
 * - Learning Objectives: audio-1, caption-1
 * - Topics: audio-2+, caption-2+
 */
export const MEDIA_INDEX = {
  WELCOME_AUDIO: 'audio-0',
  WELCOME_CAPTION: 'caption-0',
  LEARNING_OBJECTIVES_AUDIO: 'audio-1',
  LEARNING_OBJECTIVES_CAPTION: 'caption-1',
  TOPICS_AUDIO_START: 2, // Topics start at audio-2
  TOPICS_CAPTION_START: 2, // Topics start at caption-2
} as const

/**
 * Helper function to get topic audio ID
 */
export const getTopicAudioId = (topicIndex: number): string => {
  return `audio-${MEDIA_INDEX.TOPICS_AUDIO_START + topicIndex}`
}

/**
 * Helper function to get topic caption ID
 */
export const getTopicCaptionId = (topicIndex: number): string => {
  return `caption-${MEDIA_INDEX.TOPICS_CAPTION_START + topicIndex}`
}

/**
 * Helper function to check if a page ID is a topic
 */
export const isTopicPage = (pageId: string): boolean => {
  return pageId.startsWith(PAGE_TOPIC_PREFIX)
}

/**
 * Helper function to normalize page IDs for consistency
 */
export const normalizePageId = (pageId: string): string => {
  // Handle legacy naming inconsistencies
  if (pageId === 'objectives' || pageId === 'learningObjectives') {
    return PAGE_LEARNING_OBJECTIVES
  }

  return pageId
}