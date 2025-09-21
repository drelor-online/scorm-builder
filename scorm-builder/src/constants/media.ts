/**
 * Media Constants - Canonical names for Learning Objectives
 *
 * This file defines the single source of truth for Learning Objectives naming
 * to prevent inconsistencies between storage pageId and content properties.
 */

// Canonical page ID for Learning Objectives in storage
export const PAGE_LEARNING_OBJECTIVES = 'learning-objectives' as const

// Canonical content property name for Learning Objectives
export const CONTENT_LEARNING_OBJECTIVES = 'learningObjectivesPage' as const

// Legacy page IDs that should be migrated to the canonical name
export const LEGACY_OBJECTIVES_PAGE_IDS = [
  'objectives',
  'objectives-page',
  'learningObjectives',
  'learningObjectivesPage'
] as const

// Legacy content property names that should be migrated
export const LEGACY_OBJECTIVES_CONTENT_PROPS = [
  'objectivesPage'
] as const

export type LegacyObjectivesPageId = typeof LEGACY_OBJECTIVES_PAGE_IDS[number]
export type LegacyObjectivesContentProp = typeof LEGACY_OBJECTIVES_CONTENT_PROPS[number]