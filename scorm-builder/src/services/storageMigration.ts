/**
 * Storage Migration Service
 *
 * Handles one-time migration of legacy Learning Objectives naming
 * to ensure consistent naming throughout the application.
 */

import {
  PAGE_LEARNING_OBJECTIVES,
  CONTENT_LEARNING_OBJECTIVES,
  LEGACY_OBJECTIVES_PAGE_IDS,
  LEGACY_OBJECTIVES_CONTENT_PROPS,
  type LegacyObjectivesPageId,
  type LegacyObjectivesContentProp
} from '../constants/media'

export interface MediaItem {
  id: string
  pageId?: string
  metadata?: {
    page_id?: string
    [key: string]: any
  }
  [key: string]: any
}

export interface ProjectData {
  allStorageMedia: MediaItem[]
  courseContent: any
}

/**
 * Normalize Learning Objectives naming across storage and content
 *
 * This function should be called immediately after loading a project
 * and before any media analysis or SCORM generation.
 */
export function normalizeLearningObjectives(project: ProjectData): boolean {
  let migrationPerformed = false

  // Phase 1: Normalize storage metadata
  console.log('[MEDIA_MIGRATION] Starting Learning Objectives normalization')

  for (const mediaItem of project.allStorageMedia) {
    // Check main pageId property
    if (mediaItem.pageId && LEGACY_OBJECTIVES_PAGE_IDS.includes(mediaItem.pageId as LegacyObjectivesPageId)) {
      console.log(`[MEDIA_MIGRATION] Normalizing pageId '${mediaItem.pageId}' → '${PAGE_LEARNING_OBJECTIVES}' for media ${mediaItem.id}`)
      mediaItem.pageId = PAGE_LEARNING_OBJECTIVES
      migrationPerformed = true
    }

    // Check metadata.page_id property
    if (mediaItem.metadata?.page_id && LEGACY_OBJECTIVES_PAGE_IDS.includes(mediaItem.metadata.page_id as LegacyObjectivesPageId)) {
      console.log(`[MEDIA_MIGRATION] Normalizing metadata.page_id '${mediaItem.metadata.page_id}' → '${PAGE_LEARNING_OBJECTIVES}' for media ${mediaItem.id}`)
      mediaItem.metadata.page_id = PAGE_LEARNING_OBJECTIVES
      migrationPerformed = true
    }
  }

  // Phase 2: Normalize content structure
  const courseContent = project.courseContent

  // Collapse legacy objectivesPage into learningObjectivesPage
  for (const legacyProp of LEGACY_OBJECTIVES_CONTENT_PROPS) {
    if (courseContent[legacyProp] && !courseContent[CONTENT_LEARNING_OBJECTIVES]) {
      console.log(`[MEDIA_MIGRATION] Migrating content.${legacyProp} → content.${CONTENT_LEARNING_OBJECTIVES}`)
      courseContent[CONTENT_LEARNING_OBJECTIVES] = courseContent[legacyProp]
      delete courseContent[legacyProp]
      migrationPerformed = true
    }
  }

  if (migrationPerformed) {
    console.log('[MEDIA_MIGRATION] Learning Objectives normalization completed')
  } else {
    console.log('[MEDIA_MIGRATION] No Learning Objectives migration needed')
  }

  return migrationPerformed
}

/**
 * Validate that Learning Objectives naming is consistent
 */
export function validateLearningObjectivesNaming(project: ProjectData): {
  isValid: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check for legacy pageIds in storage
  for (const mediaItem of project.allStorageMedia) {
    if (mediaItem.pageId && LEGACY_OBJECTIVES_PAGE_IDS.includes(mediaItem.pageId as LegacyObjectivesPageId)) {
      issues.push(`Media ${mediaItem.id} still has legacy pageId: ${mediaItem.pageId}`)
    }

    if (mediaItem.metadata?.page_id && LEGACY_OBJECTIVES_PAGE_IDS.includes(mediaItem.metadata.page_id as LegacyObjectivesPageId)) {
      issues.push(`Media ${mediaItem.id} still has legacy metadata.page_id: ${mediaItem.metadata.page_id}`)
    }
  }

  // Check for legacy content properties
  const courseContent = project.courseContent
  for (const legacyProp of LEGACY_OBJECTIVES_CONTENT_PROPS) {
    if (courseContent[legacyProp]) {
      issues.push(`Content still has legacy property: ${legacyProp}`)
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  }
}

/**
 * Get all Learning Objectives media from storage using canonical naming
 */
export function getLearningObjectivesMedia(allStorageMedia: MediaItem[]): MediaItem[] {
  return allStorageMedia.filter(item =>
    item.pageId === PAGE_LEARNING_OBJECTIVES ||
    item.metadata?.page_id === PAGE_LEARNING_OBJECTIVES
  )
}

/**
 * Check if Learning Objectives audio/caption exists in storage
 */
export function getLearningObjectivesAudioCaption(allStorageMedia: MediaItem[]): {
  audio?: MediaItem
  caption?: MediaItem
} {
  const loMedia = getLearningObjectivesMedia(allStorageMedia)

  return {
    audio: loMedia.find(item => item.type === 'audio'),
    caption: loMedia.find(item => item.type === 'caption')
  }
}