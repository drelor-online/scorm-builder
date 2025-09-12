/**
 * Structured logging utility for SCORM Builder
 * 
 * Provides consistent error categories and structured logging patterns
 * for better debugging and production troubleshooting.
 */

import { debugLogger } from './ultraSimpleLogger'

// Standardized error categories for better organization
export type LogCategory = 
  | 'STARTUP'        // App initialization, window setup
  | 'PROJECT'        // Project loading, saving, switching
  | 'SCORM'          // SCORM generation (general)
  | 'SCORM_MEDIA'    // Media loading failures for SCORM
  | 'SCORM_GENERATION' // SCORM package creation process
  | 'SCORM_PACKAGE'  // SCORM package UI operations
  | 'SCORM_SAVE'     // SCORM file saving to disk
  | 'MEDIA'          // Media operations (loading, processing)
  | 'STORAGE'        // File system operations
  | 'API'            // External API calls, key management
  | 'CORS'           // Cross-origin request issues
  | 'PERFORMANCE'    // Performance monitoring

interface LogContext {
  [key: string]: any
}

interface ErrorLogContext extends LogContext {
  error?: string
  errorStack?: string
  timestamp?: string
  projectId?: string
}

/**
 * Structured logger that ensures consistent error categorization
 * and includes common context automatically
 */
class StructuredLogger {
  private addCommonContext(context: LogContext = {}): LogContext {
    return {
      ...context,
      timestamp: new Date().toISOString(),
      buildVersion: '1.0.4', // TODO: Get this from package.json dynamically
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    }
  }

  /**
   * Log critical errors that require troubleshooting
   */
  error(category: LogCategory, message: string, context: ErrorLogContext = {}) {
    const enhancedContext = this.addCommonContext(context)
    debugLogger.error(category, message, enhancedContext)
    
    // Also log to console in development for immediate visibility
    if (import.meta.env.DEV) {
      console.error(`[${category}] ${message}`, enhancedContext)
    }
  }

  /**
   * Log warnings that may indicate issues but don't block functionality
   */
  warn(category: LogCategory, message: string, context: LogContext = {}) {
    const enhancedContext = this.addCommonContext(context)
    debugLogger.warn(category, message, enhancedContext)
    
    if (import.meta.env.DEV) {
      console.warn(`[${category}] ${message}`, enhancedContext)
    }
  }

  /**
   * Log informational messages about important operations
   */
  info(category: LogCategory, message: string, context: LogContext = {}) {
    const enhancedContext = this.addCommonContext(context)
    debugLogger.info(category, message, enhancedContext)
    
    if (import.meta.env.DEV) {
      console.info(`[${category}] ${message}`, enhancedContext)
    }
  }

  /**
   * Log debug information (only in development)
   */
  debug(category: LogCategory, message: string, context: LogContext = {}) {
    if (import.meta.env.DEV) {
      const enhancedContext = this.addCommonContext(context)
      debugLogger.debug(category, message, enhancedContext)
      console.debug(`[${category}] ${message}`, enhancedContext)
    }
  }
}

// Export singleton instance
export const structuredLogger = new StructuredLogger()

// Convenience functions for common error patterns
export const logScormError = {
  mediaLoadingFailed: (mediaIds: string[], projectId?: string, additionalContext?: LogContext) =>
    structuredLogger.error('SCORM_MEDIA', 'Critical media loading failures prevented SCORM generation', {
      failedMediaCount: mediaIds.length,
      failedMediaIds: mediaIds,
      projectId,
      ...additionalContext
    }),

  generationFailed: (error: Error | string, mediaCount: number, additionalContext?: LogContext) =>
    structuredLogger.error('SCORM_GENERATION', 'SCORM package generation failed', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      mediaFileCount: mediaCount,
      ...additionalContext
    }),

  packageSaveFailed: (error: Error | unknown, additionalContext?: LogContext) =>
    structuredLogger.error('SCORM_SAVE', 'Failed to save SCORM package to file system', {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : undefined,
      errorStack: error instanceof Error ? error.stack : undefined,
      ...additionalContext
    })
}

export const logProjectError = {
  loadingFailed: (projectId: string, error: Error | string, additionalContext?: LogContext) =>
    structuredLogger.error('PROJECT', 'Project loading failed', {
      projectId,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      ...additionalContext
    }),

  savingFailed: (projectId: string, error: Error | string, additionalContext?: LogContext) =>
    structuredLogger.error('PROJECT', 'Project saving failed', {
      projectId,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      ...additionalContext
    })
}

export const logMediaError = {
  loadingFailed: (mediaId: string, error: Error | string, additionalContext?: LogContext) =>
    structuredLogger.error('MEDIA', 'Media loading failed', {
      mediaId,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      ...additionalContext
    }),

  processingFailed: (mediaId: string, operation: string, error: Error | string, additionalContext?: LogContext) =>
    structuredLogger.error('MEDIA', `Media ${operation} failed`, {
      mediaId,
      operation,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      ...additionalContext
    })
}

export const logApiError = {
  keyLoadingFailed: (error: Error | string, additionalContext?: LogContext) =>
    structuredLogger.error('API', 'API key loading failed', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      ...additionalContext
    }),

  externalServiceFailed: (service: string, error: Error | string, additionalContext?: LogContext) =>
    structuredLogger.error('API', `External service call failed: ${service}`, {
      service,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      ...additionalContext
    })
}