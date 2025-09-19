/**
 * Production-safe logging utility
 * Replaces console.log with environment-aware logging that respects production settings
 */

import { envConfig } from '../config/environment'

export interface LogLevel {
  ERROR: number
  WARN: number
  INFO: number
  DEBUG: number
}

export const LOG_LEVELS: LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
}

class ProductionLogger {
  private currentLevel: number

  constructor() {
    // Set log level based on environment
    if (envConfig.isProduction) {
      this.currentLevel = LOG_LEVELS.WARN // Only errors and warnings in production
    } else if (envConfig.isTest) {
      this.currentLevel = LOG_LEVELS.ERROR // Minimal logging in tests
    } else {
      this.currentLevel = LOG_LEVELS.DEBUG // Full logging in development
    }
  }

  private shouldLog(level: number): boolean {
    return level <= this.currentLevel
  }

  private formatMessage(category: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const baseMsg = `[${timestamp}] [${category}] ${message}`

    if (data && typeof data === 'object') {
      return `${baseMsg} ${JSON.stringify(data)}`
    } else if (data) {
      return `${baseMsg} ${data}`
    }

    return baseMsg
  }

  error(category: string, message: string, data?: any): void {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      console.error(this.formatMessage(category, message, data))
    }
  }

  warn(category: string, message: string, data?: any): void {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      console.warn(this.formatMessage(category, message, data))
    }
  }

  info(category: string, message: string, data?: any): void {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      console.info(this.formatMessage(category, message, data))
    }
  }

  debug(category: string, message: string, data?: any): void {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(this.formatMessage(category, message, data))
    }
  }

  // Legacy console.log replacement for gradual migration
  log(category: string, message: string, data?: any): void {
    if (envConfig.isDevelopment) {
      console.log(this.formatMessage(category, message, data))
    }
    // Silent in production - no accidental logging
  }
}

// Export singleton instance
export const productionLogger = new ProductionLogger()

// Convenience function to replace console.log in existing code
export function safeLog(category: string, message: string, data?: any): void {
  productionLogger.log(category, message, data)
}