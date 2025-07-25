/**
 * Simple logger utility that can be disabled in production
 */

const isDevelopment = process.env.NODE_ENV === 'development'
const isDebugEnabled = isDevelopment || localStorage.getItem('debugMode') === 'true'

export const logger = {
  log: (...args: any[]) => {
    if (isDebugEnabled) {
      console.log(...args)
    }
  },
  
  error: (...args: any[]) => {
    // Always log errors
    console.error(...args)
  },
  
  warn: (...args: any[]) => {
    if (isDebugEnabled) {
      console.warn(...args)
    }
  },
  
  debug: (...args: any[]) => {
    if (isDebugEnabled) {
      console.debug(...args)
    }
  },
  
  info: (...args: any[]) => {
    if (isDebugEnabled) {
      console.info(...args)
    }
  }
}