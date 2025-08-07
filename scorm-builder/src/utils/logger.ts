/**
 * Simple logger utility that can be disabled in production
 * Production-safe: handles missing console methods
 */

const isDevelopment = () => process.env.NODE_ENV === 'development'
const isDebugEnabled = () => isDevelopment() || localStorage.getItem('debugMode') === 'true'

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
      safeConsole.log(...args)
    }
  },
  
  error: (...args: any[]) => {
    // Always log errors, even in production
    safeConsole.error(...args)
  },
  
  warn: (...args: any[]) => {
    if (isDebugEnabled()) {
      safeConsole.warn(...args)
    }
  },
  
  debug: (...args: any[]) => {
    if (isDebugEnabled()) {
      safeConsole.debug(...args)
    }
  },
  
  info: (...args: any[]) => {
    if (isDebugEnabled()) {
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