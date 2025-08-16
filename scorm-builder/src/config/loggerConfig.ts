/**
 * Logger configuration to control which log categories are disabled
 * This helps reduce console noise from verbose components
 */

import { disableCategory } from '../utils/logger'

// Categories that are disabled by default to reduce console noise
const DEFAULT_DISABLED_CATEGORIES = [
  'FileStorage.saveContent',  // Auto-save messages that flood the console
  'FileStorage.autoSave',     // Additional auto-save related messages
]

// Initialize disabled categories
export function initializeLoggerConfig() {
  // Only disable categories if not in debug mode
  const isDebugMode = import.meta.env.VITE_DEBUG_LOGS === 'true';
  
  if (!isDebugMode) {
    DEFAULT_DISABLED_CATEGORIES.forEach(category => {
      disableCategory(category)
    })
    console.log('[LoggerConfig] Disabled noisy log categories:', DEFAULT_DISABLED_CATEGORIES)
  } else {
    console.log('[LoggerConfig] Debug mode enabled - all log categories active')
  }
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