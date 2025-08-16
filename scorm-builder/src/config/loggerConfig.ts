/**
 * Logger configuration to control which log categories are disabled
 * This helps reduce console noise from verbose components
 * 
 * DEBUG USAGE:
 * - Set VITE_DEBUG_LOGS=true for full logging in production builds
 * - Set VITE_DEBUG_SAVE_LOAD=true to specifically enable save/load debugging
 * - Use localStorage.setItem('loggerDisabledCategories', 'category1,category2') for runtime control
 * 
 * COMMON DEBUG SCENARIOS:
 * - Save/Load Issues: Set VITE_DEBUG_SAVE_LOAD=true or enable 'FileStorage.*' categories
 * - State Management: Enable 'App.*' categories 
 * - Performance: Enable 'performanceMonitor.*' categories
 */

import { disableCategory } from '../utils/logger'

// Categories that are disabled by default to reduce console noise
const DEFAULT_DISABLED_CATEGORIES = [
  'FileStorage.saveContent',  // Auto-save messages that flood the console
  'FileStorage.autoSave',     // Additional auto-save related messages
]

// Categories that are specifically useful for save/load debugging
const SAVE_LOAD_DEBUG_CATEGORIES = [
  'FileStorage.saveContent',
  'FileStorage.autoSave', 
  'FileStorage.saveCourseContent',
  'FileStorage.getCourseContent',
  'FileStorage.saveCourseSeedData',
  'FileStorage.getCourseSeedData',
  'App.handleSave',
  'App.handleAutosave',
  'App.loadProject'
]

// Initialize disabled categories
export function initializeLoggerConfig() {
  // Check various debug flags
  const isDebugMode = import.meta.env.VITE_DEBUG_LOGS === 'true';
  const isSaveLoadDebug = import.meta.env.VITE_DEBUG_SAVE_LOAD === 'true';
  
  if (isDebugMode) {
    console.log('[LoggerConfig] Full debug mode enabled - all log categories active')
    return
  }
  
  if (isSaveLoadDebug) {
    console.log('[LoggerConfig] Save/Load debug mode enabled - enabling save/load categories')
    // Don't disable save/load related categories, but disable others
    const categoriesToDisable = DEFAULT_DISABLED_CATEGORIES.filter(
      category => !SAVE_LOAD_DEBUG_CATEGORIES.includes(category)
    )
    categoriesToDisable.forEach(category => {
      disableCategory(category)
    })
    console.log('[LoggerConfig] Disabled categories:', categoriesToDisable)
    console.log('[LoggerConfig] Enabled save/load categories:', SAVE_LOAD_DEBUG_CATEGORIES)
    return
  }
  
  // Normal mode - disable noisy categories
  DEFAULT_DISABLED_CATEGORIES.forEach(category => {
    disableCategory(category)
  })
  console.log('[LoggerConfig] Disabled noisy log categories:', DEFAULT_DISABLED_CATEGORIES)
  console.log('[LoggerConfig] To debug save/load issues, set VITE_DEBUG_SAVE_LOAD=true')
}

// Allow runtime configuration via localStorage
export function configureLoggerFromLocalStorage() {
  try {
    const customDisabled = localStorage.getItem('loggerDisabledCategories')
    if (customDisabled) {
      const categories = customDisabled.split(',').map(c => c.trim())
      categories.forEach(category => {
        if (category) {
          disableCategory(category)
        }
      })
      console.log('[LoggerConfig] Applied custom disabled categories:', categories)
    }
  } catch (e) {
    // Ignore localStorage errors
  }
}

/**
 * Enable specific save/load debug categories at runtime
 * Useful for debugging without rebuilding
 */
export function enableSaveLoadDebugging() {
  console.log('[LoggerConfig] Enabling save/load debugging categories at runtime')
  // Note: We can't "enable" categories that are already disabled,
  // but we can clear the localStorage override to reset to defaults
  localStorage.removeItem('loggerDisabledCategories')
  console.log('[LoggerConfig] Cleared localStorage overrides. Reload page to see save/load logs.')
  console.log('[LoggerConfig] Or set VITE_DEBUG_SAVE_LOAD=true and rebuild for persistent debugging.')
}