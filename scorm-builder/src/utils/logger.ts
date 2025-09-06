/**
 * Simple logger utility that can be disabled in production
 * Production-safe: handles missing console methods
 * Supports category filtering to reduce noise from specific components
 */

const isDevelopment = () => import.meta.env.DEV
const isDebugEnabled = () => {
  try {
    return isDevelopment() || localStorage.getItem('debugMode') === 'true'
  } catch {
    return isDevelopment()
  }
}

// Category filtering support
const disabledCategories = new Set<string>()
const wildcardPatterns: string[] = []

export function disableCategory(category: string) {
  if (category.includes('*')) {
    // Handle wildcard patterns
    const pattern = category.replace(/\*/g, '.*')
    wildcardPatterns.push(pattern)
  } else {
    disabledCategories.add(category)
  }
  
  // Persist to storage with tracking prevention fallback
  void saveDisabledCategoriesToStorage()
}

export function enableCategory(category: string) {
  disabledCategories.delete(category)
  // Remove from wildcard patterns if it matches
  const pattern = category.replace(/\*/g, '.*')
  const index = wildcardPatterns.indexOf(pattern)
  if (index > -1) {
    wildcardPatterns.splice(index, 1)
  }
  
  // Persist to storage with tracking prevention fallback
  void saveDisabledCategoriesToStorage()
}

export function getDisabledCategories(): string[] {
  return Array.from(disabledCategories).concat(wildcardPatterns.map(p => p.replace(/\.\*/g, '*')))
}

export function clearDisabledCategories() {
  disabledCategories.clear()
  wildcardPatterns.length = 0
  
  // Persist to storage with tracking prevention fallback
  void saveDisabledCategoriesToStorage()
}

// Helper function to save disabled categories using tracking prevention fallback
async function saveDisabledCategoriesToStorage(): Promise<void> {
  try {
    const { trackingPreventionFallback } = await import('./trackingPreventionFallback')
    const categories = getDisabledCategories()
    await trackingPreventionFallback.saveDisabledCategories(categories)
  } catch (e) {
    // Ignore errors during save
  }
}

function isCategoryDisabled(message: string): boolean {
  // Extract category from message if it follows [Category] pattern
  const categoryMatch = message.match(/^\[([^\]]+)\]/)
  if (!categoryMatch) {
    return false // No category tag, don't filter
  }
  
  const category = categoryMatch[1]
  
  // Check exact match
  if (disabledCategories.has(category)) {
    return true
  }
  
  // Check wildcard patterns
  for (const pattern of wildcardPatterns) {
    const regex = new RegExp(`^${pattern}$`)
    if (regex.test(category)) {
      return true
    }
  }
  
  return false
}

// Fallback logging to window object for production debugging
const fallbackLog = (level: string, args: any[]) => {
  try {
    // Store logs in window object for debugging
    if (typeof window !== 'undefined') {
      if (!window.__debugLogs) {
        window.__debugLogs = []
      }
      const logEntry = `[${new Date().toISOString()}] [${level}] ${args.map(a => 
        typeof a === 'object' ? JSON.stringify(a) : String(a)
      ).join(' ')}`
      window.__debugLogs.push(logEntry)
      
      // Keep only last 1000 entries
      if (window.__debugLogs.length > 1000) {
        window.__debugLogs.shift()
      }
    }
  } catch (e) {
    // Silently fail - we tried our best
  }
}

// Safe console wrapper that handles missing console methods
const safeConsole = {
  log: (...args: any[]) => {
    if (typeof console !== 'undefined' && console.log) {
      console.log(...args)
    } else {
      fallbackLog('LOG', args)
    }
  },
  error: (...args: any[]) => {
    if (typeof console !== 'undefined' && console.error) {
      console.error(...args)
    } else {
      fallbackLog('ERROR', args)
    }
  },
  warn: (...args: any[]) => {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(...args)
    } else {
      fallbackLog('WARN', args)
    }
  },
  debug: (...args: any[]) => {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug(...args)
    } else {
      fallbackLog('DEBUG', args)
    }
  },
  info: (...args: any[]) => {
    if (typeof console !== 'undefined' && console.info) {
      console.info(...args)
    } else {
      fallbackLog('INFO', args)
    }
  }
}

export const logger = {
  log: (...args: any[]) => {
    if (isDebugEnabled()) {
      // Check if first argument contains a category to filter
      const firstArg = args[0]
      if (typeof firstArg === 'string' && isCategoryDisabled(firstArg)) {
        return // Skip this log
      }
      safeConsole.log(...args)
    }
  },
  
  error: (...args: any[]) => {
    // Check category filtering for errors too
    const firstArg = args[0]
    if (typeof firstArg === 'string' && isCategoryDisabled(firstArg)) {
      return // Skip this log
    }
    // Always log errors that pass filter, even in production
    safeConsole.error(...args)
  },
  
  warn: (...args: any[]) => {
    if (isDebugEnabled()) {
      const firstArg = args[0]
      if (typeof firstArg === 'string' && isCategoryDisabled(firstArg)) {
        return // Skip this log
      }
      safeConsole.warn(...args)
    }
  },
  
  debug: (...args: any[]) => {
    if (isDebugEnabled()) {
      const firstArg = args[0]
      if (typeof firstArg === 'string' && isCategoryDisabled(firstArg)) {
        return // Skip this log
      }
      safeConsole.debug(...args)
    }
  },
  
  info: (...args: any[]) => {
    if (isDebugEnabled()) {
      const firstArg = args[0]
      if (typeof firstArg === 'string' && isCategoryDisabled(firstArg)) {
        return // Skip this log
      }
      safeConsole.info(...args)
    }
  }
}

// Type declaration for window.__debugLogs
declare global {
  interface Window {
    __debugLogs?: string[]
  }
}

// Initialize disabled categories from environment or localStorage with tracking prevention fallback
if (typeof process !== 'undefined' && process.env?.LOGGER_DISABLED_CATEGORIES) {
  const categories = process.env.LOGGER_DISABLED_CATEGORIES.split(',')
  categories.forEach(cat => disableCategory(cat.trim()))
} else {
  // Use dynamic import to avoid circular dependency
  void (async () => {
    try {
      const { trackingPreventionFallback } = await import('./trackingPreventionFallback')
      const categories = await trackingPreventionFallback.loadDisabledCategories()
      categories.forEach(cat => disableCategory(cat.trim()))
    } catch (e) {
      // Ignore errors during initialization
    }
  })()
}