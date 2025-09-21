/**
 * Production-aware logging utilities
 *
 * This module provides logging functions that are automatically gated
 * in production builds for better performance and cleaner output.
 */

/**
 * Development-only console.log
 * In production builds, this becomes a no-op for better performance
 */
export const devLog = (...args: any[]): void => {
  if (import.meta.env.DEV) {
    console.log(...args)
  }
}

/**
 * Development-only console.warn
 * In production builds, this becomes a no-op for better performance
 */
export const devWarn = (...args: any[]): void => {
  if (import.meta.env.DEV) {
    console.warn(...args)
  }
}

/**
 * Development-only console.error
 * Errors are always logged, but additional context only in dev
 */
export const devError = (message: string, ...devDetails: any[]): void => {
  if (import.meta.env.DEV) {
    console.error(message, ...devDetails)
  } else {
    console.error(message)
  }
}

/**
 * Production-aware list printer
 * Caps output to avoid log spam in production while keeping full detail in dev
 */
export const printLimitedList = (
  label: string,
  items: string[],
  maxItems = 10
): void => {
  const limit = import.meta.env.DEV ? items.length : Math.min(maxItems, items.length)

  console.log(`${label}: ${items.length} items`)

  // Print limited items
  items.slice(0, limit).forEach((item, index) => {
    console.log(`  ${index + 1}. ${item}`)
  })

  // Show "+N more" summary if truncated
  if (!import.meta.env.DEV && items.length > maxItems) {
    console.log(`  ... +${items.length - maxItems} more (use dev build for full list)`)
  }
}

/**
 * Performance timing logger that only shows in development
 */
export const devTime = (label: string): () => void => {
  if (!import.meta.env.DEV) {
    return () => {} // No-op in production
  }

  const start = performance.now()
  console.log(`[PERF] Starting: ${label}`)

  return () => {
    const duration = performance.now() - start
    console.log(`[PERF] Completed: ${label} (${duration.toFixed(2)}ms)`)
  }
}

/**
 * Batch operation logger for development
 */
export const devBatchLog = (
  operation: string,
  processed: number,
  total: number,
  details?: Record<string, any>
): void => {
  if (import.meta.env.DEV) {
    const percentage = Math.round((processed / total) * 100)
    console.log(`[BATCH] ${operation}: ${processed}/${total} (${percentage}%)`, details || '')
  }
}

/**
 * Memory usage logger (development only)
 */
export const devMemoryLog = (context: string): void => {
  if (!import.meta.env.DEV || typeof window === 'undefined' || !('performance' in window)) {
    return
  }

  // @ts-ignore - performance.memory is non-standard but widely supported
  const memory = (window.performance as any).memory
  if (memory) {
    const used = Math.round(memory.usedJSHeapSize / 1048576) // MB
    const total = Math.round(memory.totalJSHeapSize / 1048576) // MB
    console.log(`[MEMORY] ${context}: ${used}MB used / ${total}MB total`)
  }
}

/**
 * Always-on logger for critical information
 * Use sparingly for truly important information that should appear in production
 */
export const criticalLog = (...args: any[]): void => {
  console.log(...args)
}

/**
 * Always-on warning for production issues
 */
export const criticalWarn = (...args: any[]): void => {
  console.warn(...args)
}

/**
 * Always-on error logging
 */
export const criticalError = (...args: any[]): void => {
  console.error(...args)
}