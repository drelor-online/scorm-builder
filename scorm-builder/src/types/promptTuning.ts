/**
 * Type definitions for AI Prompt Tuning Feature
 *
 * This file defines all types, interfaces, and constants related to the prompt tuning system.
 * Default values are designed to maintain the current prompt behavior exactly.
 */

// ============================================================================
// Core Types
// ============================================================================

export type NarrationLength = 'short' | 'medium' | 'long'
export type ContentDetail = 'brief' | 'standard' | 'comprehensive' | 'extensive'
export type HtmlComplexity = 'simple' | 'standard' | 'rich'
export type ImagePromptDetail = 'simple' | 'standard' | 'detailed' | 'artistic'
export type ImageSearchSpecificity = 'broad' | 'specific' | 'very-specific'
export type VideoSearchSpecificity = 'broad' | 'specific' | 'very-specific'
export type QuestionTypeMix = 'multiple-choice' | 'true-false-heavy' | 'balanced'

// Removed WordCountRange - now using single number values for average word count

// ============================================================================
// Main Settings Interface
// ============================================================================

export interface PromptTuningSettings {
  // Content Generation
  narrationLength: NarrationLength
  contentDetail: ContentDetail
  htmlComplexity: HtmlComplexity

  // Media Settings
  imageKeywordsCount: number // 1-5
  imagePromptDetail: ImagePromptDetail
  imageSearchSpecificity: ImageSearchSpecificity
  videoSearchTermsCount: number // 1-4
  videoSearchSpecificity: VideoSearchSpecificity

  // Assessment Settings
  knowledgeCheckQuestions: number // 0-3
  assessmentQuestions: number // 5-20
  passMark: number // 60-100
  questionTypeMix: QuestionTypeMix

  // Content Length Settings (replaces page duration)
  welcomeWordCount: number // Average words for welcome page (50-300 range)
  objectivesWordCount: number // Average words for objectives page (100-500 range)
  topicWordCount: number // Average words for topic pages (150-800 range)
  characterLimit: number // Maximum characters (default 1000 for Murf.ai)
  enforceCharacterLimit: boolean // Whether to enforce character limit
}

// ============================================================================
// Default Settings (maintains current behavior exactly)
// ============================================================================

export const DEFAULT_PROMPT_TUNING_SETTINGS: PromptTuningSettings = {
  // Content Generation - matches current defaults
  narrationLength: 'medium', // "150-300 words, max 1000 chars"
  contentDetail: 'comprehensive', // matches current detailed approach
  htmlComplexity: 'rich', // "headings, paragraphs, lists, tables, etc."

  // Media Settings - matches current defaults
  imageKeywordsCount: 2, // current: ["keyword1", "keyword2"]
  imagePromptDetail: 'standard', // current: "AI image generation prompt"
  imageSearchSpecificity: 'specific', // matches current approach for images
  videoSearchTermsCount: 2, // current: ["search term 1", "search term 2"]
  videoSearchSpecificity: 'specific', // matches current approach

  // Assessment Settings - matches current defaults
  knowledgeCheckQuestions: 1, // current: single question per topic
  assessmentQuestions: 10, // current: "at least 10 questions"
  passMark: 80, // current: "passMark": 80
  questionTypeMix: 'balanced', // current: mixed types

  // Content Length Settings - replacing duration-based timing
  welcomeWordCount: 125, // Average words for welcome pages
  objectivesWordCount: 200, // Average words for objectives pages
  topicWordCount: 300, // Average words for topic content
  characterLimit: 1000, // Murf.ai standard limit
  enforceCharacterLimit: true // Enable by default for voice generation compatibility
}

// ============================================================================
// Setting Options and Constraints
// ============================================================================

export const SETTING_OPTIONS = {
  narrationLength: {
    short: {
      label: 'Short',
      description: '100-150 words (1-1.5 min)',
      words: '100-150',
      chars: 800
    },
    medium: {
      label: 'Medium',
      description: '150-300 words (1-2 min)',
      words: '150-300',
      chars: 1000
    },
    long: {
      label: 'Long',
      description: '300-500 words (2-3 min)',
      words: '300-500',
      chars: 1500
    }
  },

  contentDetail: {
    brief: {
      label: 'Brief',
      description: 'Concise, essential information only'
    },
    standard: {
      label: 'Standard',
      description: 'Balanced detail level'
    },
    comprehensive: {
      label: 'Comprehensive',
      description: 'Detailed explanations and examples'
    },
    extensive: {
      label: 'Extensive',
      description: 'In-depth coverage with additional context'
    }
  },

  htmlComplexity: {
    simple: {
      label: 'Simple',
      description: 'Paragraphs only (<p>)',
      tags: ['p']
    },
    standard: {
      label: 'Standard',
      description: 'Paragraphs and lists (<p>, <ul>, <ol>)',
      tags: ['p', 'ul', 'ol', 'li']
    },
    rich: {
      label: 'Rich',
      description: 'All elements (<h2>, <h3>, <p>, <ul>, <ol>, <table>)',
      tags: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th']
    }
  },

  imagePromptDetail: {
    simple: {
      label: 'Simple',
      description: 'Basic descriptive prompts'
    },
    standard: {
      label: 'Standard',
      description: 'Detailed prompts with context'
    },
    detailed: {
      label: 'Detailed',
      description: 'Rich prompts with style guidance'
    },
    artistic: {
      label: 'Artistic',
      description: 'Creative prompts with aesthetic direction'
    }
  },

  imageSearchSpecificity: {
    broad: {
      label: 'Broad',
      description: 'General image terms'
    },
    specific: {
      label: 'Specific',
      description: 'Focused image search'
    },
    'very-specific': {
      label: 'Very Specific',
      description: 'Highly targeted images'
    }
  },

  videoSearchSpecificity: {
    broad: {
      label: 'Broad',
      description: 'General topic terms'
    },
    specific: {
      label: 'Specific',
      description: 'Focused search terms'
    },
    'very-specific': {
      label: 'Very Specific',
      description: 'Highly targeted technical terms'
    }
  },

  questionTypeMix: {
    'multiple-choice': {
      label: 'Multiple Choice Only',
      description: 'Primarily multiple choice questions'
    },
    'true-false-heavy': {
      label: 'True/False Heavy',
      description: 'More true/false questions'
    },
    balanced: {
      label: 'Balanced Mix',
      description: 'Equal mix of all question types'
    }
  }
} as const

export const SETTING_CONSTRAINTS = {
  imageKeywordsCount: { min: 1, max: 5, default: 2 },
  videoSearchTermsCount: { min: 1, max: 4, default: 2 },
  knowledgeCheckQuestions: { min: 0, max: 3, default: 1 },
  assessmentQuestions: { min: 5, max: 20, default: 10 },
  passMark: { min: 60, max: 100, step: 5, default: 80 },
  // Word count constraints for content length
  welcomeWordCount: { min: 50, max: 300, default: 125 },
  objectivesWordCount: { min: 100, max: 500, default: 200 },
  topicWordCount: { min: 150, max: 800, default: 300 },
  characterLimit: { min: 500, max: 2000, default: 1000 }
} as const

// ============================================================================
// Helper Types for UI Components
// ============================================================================

export interface SettingTabConfig {
  id: string
  label: string
  description: string
  icon?: string
}

export interface SettingControlConfig {
  id: keyof PromptTuningSettings
  label: string
  description: string
  helpText?: string
  type: 'buttonGroup' | 'slider' | 'number'
  options?: Record<string, { label: string; description: string }>
  constraints?: { min: number; max: number; step?: number }
}

// Tab configuration for the modal
export const SETTING_TABS: SettingTabConfig[] = [
  {
    id: 'content',
    label: 'Content',
    description: 'Text generation and narration settings'
  },
  {
    id: 'media',
    label: 'Media',
    description: 'Image and video search settings'
  },
  {
    id: 'assessment',
    label: 'Assessment',
    description: 'Knowledge checks and final assessment'
  },
  {
    id: 'timing',
    label: 'Timing',
    description: 'Page duration settings'
  }
]

// ============================================================================
// Validation and Utility Types
// ============================================================================

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export interface PromptGenerationContext {
  settings: PromptTuningSettings
  courseSeedData: {
    courseTitle?: string
    difficulty?: number
    template?: string
    customTopics?: string[]
  }
}

// ============================================================================
// Storage and Persistence
// ============================================================================

export const STORAGE_KEY = 'promptTuningSettings' as const

export interface PromptTuningStorage {
  version: number
  settings: PromptTuningSettings
  lastModified: string
}

export const CURRENT_STORAGE_VERSION = 1

// ============================================================================
// Hook Interface
// ============================================================================

export interface UsePromptTuningReturn {
  settings: PromptTuningSettings
  updateSettings: (newSettings: Partial<PromptTuningSettings>) => void
  resetToDefaults: () => void
  isDefault: boolean
  isDirty: boolean
  save: () => void
}

// ============================================================================
// Modal Component Props
// ============================================================================

export interface PromptTuningModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (settings: PromptTuningSettings) => void
  initialSettings?: Partial<PromptTuningSettings>
}

// ============================================================================
// Utility Functions Types
// ============================================================================

export type SettingsValidator = (settings: PromptTuningSettings) => ValidationResult
export type SettingsTransformer = (settings: PromptTuningSettings) => PromptTuningSettings
export type PromptBuilder = (context: PromptGenerationContext) => string