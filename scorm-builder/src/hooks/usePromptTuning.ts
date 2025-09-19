/**
 * Custom hook for managing AI Prompt Tuning settings
 *
 * Handles:
 * - Loading settings from localStorage
 * - Updating settings with validation
 * - Persisting settings to localStorage
 * - Providing utility functions for settings management
 * - Detecting when settings differ from defaults
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  PromptTuningSettings,
  DEFAULT_PROMPT_TUNING_SETTINGS,
  UsePromptTuningReturn,
  PromptTuningStorage,
  STORAGE_KEY,
  CURRENT_STORAGE_VERSION,
  ValidationResult,
  SETTING_CONSTRAINTS
} from '../types/promptTuning'

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates prompt tuning settings
 */
function validateSettings(settings: PromptTuningSettings): ValidationResult {
  const errors: string[] = []

  // Validate numeric constraints
  const constraints = SETTING_CONSTRAINTS

  if (settings.imageKeywordsCount < constraints.imageKeywordsCount.min ||
      settings.imageKeywordsCount > constraints.imageKeywordsCount.max) {
    errors.push(`Image keywords count must be between ${constraints.imageKeywordsCount.min} and ${constraints.imageKeywordsCount.max}`)
  }

  if (settings.videoSearchTermsCount < constraints.videoSearchTermsCount.min ||
      settings.videoSearchTermsCount > constraints.videoSearchTermsCount.max) {
    errors.push(`Video search terms count must be between ${constraints.videoSearchTermsCount.min} and ${constraints.videoSearchTermsCount.max}`)
  }

  if (settings.knowledgeCheckQuestions < constraints.knowledgeCheckQuestions.min ||
      settings.knowledgeCheckQuestions > constraints.knowledgeCheckQuestions.max) {
    errors.push(`Knowledge check questions must be between ${constraints.knowledgeCheckQuestions.min} and ${constraints.knowledgeCheckQuestions.max}`)
  }

  if (settings.assessmentQuestions < constraints.assessmentQuestions.min ||
      settings.assessmentQuestions > constraints.assessmentQuestions.max) {
    errors.push(`Assessment questions must be between ${constraints.assessmentQuestions.min} and ${constraints.assessmentQuestions.max}`)
  }

  if (settings.passMark < constraints.passMark.min ||
      settings.passMark > constraints.passMark.max) {
    errors.push(`Pass mark must be between ${constraints.passMark.min}% and ${constraints.passMark.max}%`)
  }

  // Validate word counts
  if (settings.welcomeWordCount < constraints.welcomeWordCount.min ||
      settings.welcomeWordCount > constraints.welcomeWordCount.max) {
    errors.push(`Welcome word count must be between ${constraints.welcomeWordCount.min}-${constraints.welcomeWordCount.max} words`)
  }

  if (settings.objectivesWordCount < constraints.objectivesWordCount.min ||
      settings.objectivesWordCount > constraints.objectivesWordCount.max) {
    errors.push(`Objectives word count must be between ${constraints.objectivesWordCount.min}-${constraints.objectivesWordCount.max} words`)
  }

  if (settings.topicWordCount < constraints.topicWordCount.min ||
      settings.topicWordCount > constraints.topicWordCount.max) {
    errors.push(`Topic word count must be between ${constraints.topicWordCount.min}-${constraints.topicWordCount.max} words`)
  }

  // Validate character limit if enforced
  if (settings.enforceCharacterLimit &&
      (settings.characterLimit < constraints.characterLimit.min ||
       settings.characterLimit > constraints.characterLimit.max)) {
    errors.push(`Character limit must be between ${constraints.characterLimit.min}-${constraints.characterLimit.max} characters`)
  }

  // Validate pass mark step
  if (settings.passMark % constraints.passMark.step !== 0) {
    errors.push(`Pass mark must be in increments of ${constraints.passMark.step}%`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Sanitizes and cleans up settings from potentially corrupted storage
 */
function sanitizeSettings(settings: Partial<PromptTuningSettings>): PromptTuningSettings {
  const sanitized = { ...DEFAULT_PROMPT_TUNING_SETTINGS }

  // Safely copy valid properties
  Object.keys(sanitized).forEach(key => {
    const settingKey = key as keyof PromptTuningSettings
    const value = settings[settingKey]

    if (value !== undefined && value !== null) {
      // Type-safe assignment with fallback to defaults
      try {
        (sanitized as any)[settingKey] = value
      } catch {
        // Keep default value if assignment fails
      }
    }
  })

  // Validate the sanitized settings
  const validation = validateSettings(sanitized)
  if (!validation.isValid) {
    console.warn('[usePromptTuning] Settings validation failed, using defaults:', validation.errors)
    return { ...DEFAULT_PROMPT_TUNING_SETTINGS }
  }

  return sanitized
}

// ============================================================================
// Storage Functions
// ============================================================================

/**
 * Loads settings from localStorage with error handling
 */
function loadSettingsFromStorage(): PromptTuningSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return { ...DEFAULT_PROMPT_TUNING_SETTINGS }
    }

    const parsed: PromptTuningStorage = JSON.parse(stored)

    // Handle version migrations if needed
    if (parsed.version !== CURRENT_STORAGE_VERSION) {
      console.warn('[usePromptTuning] Settings version mismatch, using defaults')
      return { ...DEFAULT_PROMPT_TUNING_SETTINGS }
    }

    return sanitizeSettings(parsed.settings)
  } catch (error) {
    console.warn('[usePromptTuning] Failed to load settings from localStorage:', error)
    return { ...DEFAULT_PROMPT_TUNING_SETTINGS }
  }
}

/**
 * Saves settings to localStorage with error handling
 */
function saveSettingsToStorage(settings: PromptTuningSettings): boolean {
  try {
    const storageData: PromptTuningStorage = {
      version: CURRENT_STORAGE_VERSION,
      settings,
      lastModified: new Date().toISOString()
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData))
    return true
  } catch (error) {
    console.error('[usePromptTuning] Failed to save settings to localStorage:', error)
    return false
  }
}

/**
 * Deep comparison to check if settings are equal to defaults
 */
function areSettingsDefault(settings: PromptTuningSettings): boolean {
  return JSON.stringify(settings) === JSON.stringify(DEFAULT_PROMPT_TUNING_SETTINGS)
}

// ============================================================================
// Main Hook
// ============================================================================

export function usePromptTuning(): UsePromptTuningReturn {
  const [settings, setSettings] = useState<PromptTuningSettings>(() =>
    loadSettingsFromStorage()
  )
  const [isDirty, setIsDirty] = useState(false)

  // Check if current settings are default
  const isDefault = useMemo(() => areSettingsDefault(settings), [settings])

  // Load settings on mount (handles edge cases where localStorage changes externally)
  useEffect(() => {
    const loadedSettings = loadSettingsFromStorage()
    setSettings(loadedSettings)
    setIsDirty(false)
  }, [])

  /**
   * Updates settings with validation and marks as dirty
   */
  const updateSettings = useCallback((newSettings: Partial<PromptTuningSettings>) => {
    setSettings(prevSettings => {
      const updated = { ...prevSettings, ...newSettings }
      const validation = validateSettings(updated)

      if (!validation.isValid) {
        console.warn('[usePromptTuning] Invalid settings update:', validation.errors)
        return prevSettings // Don't update if validation fails
      }

      setIsDirty(true)
      return updated
    })
  }, [])

  /**
   * Resets all settings to defaults
   */
  const resetToDefaults = useCallback(() => {
    setSettings({ ...DEFAULT_PROMPT_TUNING_SETTINGS })
    setIsDirty(true)
  }, [])

  /**
   * Saves current settings to localStorage
   */
  const save = useCallback(() => {
    const success = saveSettingsToStorage(settings)
    if (success) {
      setIsDirty(false)
    }
    return success
  }, [settings])

  // Auto-save when settings change (debounced)
  useEffect(() => {
    if (!isDirty) return

    const timeoutId = setTimeout(() => {
      save()
    }, 1000) // 1 second debounce

    return () => clearTimeout(timeoutId)
  }, [settings, isDirty, save])

  return {
    settings,
    updateSettings,
    resetToDefaults,
    isDefault,
    isDirty,
    save
  }
}

// ============================================================================
// Utility Hook for Settings-based Prompt Generation
// ============================================================================

/**
 * Hook that provides helper functions for generating prompts with current settings
 */
export function usePromptBuilder() {
  const { settings } = usePromptTuning()

  const getNarrationSpec = useCallback((pageType: 'welcome' | 'objectives' | 'topic' = 'topic') => {
    const lengthSpec = {
      short: { words: '100-150', chars: 800, duration: '1-1.5 minutes' },
      medium: { words: '150-300', chars: 1000, duration: '1-2 minutes' },
      long: { words: '300-500', chars: 1500, duration: '2-3 minutes' }
    }[settings.narrationLength]

    const wordCount = pageType === 'welcome' ? settings.welcomeWordCount :
                     pageType === 'objectives' ? settings.objectivesWordCount :
                     settings.topicWordCount

    return {
      ...lengthSpec,
      actualWordCount: `${wordCount} words`,
      specification: `approximately ${wordCount} words, guided by ${lengthSpec.words} words, maximum ${lengthSpec.chars} characters`
    }
  }, [settings])

  const getContentComplexity = useCallback(() => {
    const complexityMap = {
      brief: 'Provide concise, essential information with minimal elaboration',
      standard: 'Include balanced detail with clear explanations',
      comprehensive: 'Provide detailed explanations with examples and context',
      extensive: 'Include in-depth coverage with additional context, examples, and comprehensive explanations'
    }
    return complexityMap[settings.contentDetail]
  }, [settings.contentDetail])

  const getHtmlElements = useCallback(() => {
    const elementMap = {
      simple: 'Use only paragraph tags (<p>)',
      standard: 'Use paragraphs, unordered lists, and ordered lists (<p>, <ul>, <ol>, <li>)',
      rich: 'Use all HTML elements including headings, paragraphs, lists, and tables (<h2>, <h3>, <p>, <ul>, <ol>, <li>, <table>, <tr>, <td>, <th>)'
    }
    return elementMap[settings.htmlComplexity]
  }, [settings.htmlComplexity])

  const getImageKeywordsCount = useCallback(() => settings.imageKeywordsCount, [settings.imageKeywordsCount])

  const getVideoSearchTermsCount = useCallback(() => settings.videoSearchTermsCount, [settings.videoSearchTermsCount])

  const getAssessmentSpec = useCallback(() => ({
    knowledgeCheckQuestions: settings.knowledgeCheckQuestions,
    assessmentQuestions: settings.assessmentQuestions,
    passMark: settings.passMark,
    questionTypeMix: settings.questionTypeMix
  }), [settings])

  return {
    settings,
    getNarrationSpec,
    getContentComplexity,
    getHtmlElements,
    getImageKeywordsCount,
    getVideoSearchTermsCount,
    getAssessmentSpec
  }
}