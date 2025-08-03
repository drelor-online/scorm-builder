/**
 * Retry utility with exponential backoff
 * 
 * Provides a generic retry mechanism for async operations with configurable
 * backoff strategy to handle temporary failures gracefully.
 */

import { logger } from './logger'

export interface RetryOptions {
  maxAttempts?: number
  initialDelay?: number // in milliseconds
  maxDelay?: number // in milliseconds
  backoffFactor?: number
  shouldRetry?: (error: any, attempt: number) => boolean
  onRetry?: (error: any, attempt: number, nextDelay: number) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  shouldRetry: (error) => {
    // Default: retry on network errors and specific status codes
    if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNREFUSED') {
      return true
    }
    
    // Retry on specific HTTP status codes
    if (error.status >= 500 || error.status === 429) {
      return true
    }
    
    // Don't retry on client errors (4xx except 429)
    if (error.status >= 400 && error.status < 500) {
      return false
    }
    
    // Retry on timeout errors
    if (error.message?.toLowerCase().includes('timeout')) {
      return true
    }
    
    // Default to retrying unknown errors
    return true
  },
  onRetry: (error, attempt, nextDelay) => {
    logger.warn(`[Retry] Attempt ${attempt} failed, retrying in ${nextDelay}ms:`, error.message || error)
  }
}

/**
 * Execute an async operation with exponential backoff retry
 * 
 * @param operation - The async operation to execute
 * @param options - Retry configuration options
 * @returns The result of the operation
 * @throws The last error if all retry attempts fail
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options }
  let lastError: any
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      // Try the operation
      const result = await operation()
      
      // Success - log if this was a retry
      if (attempt > 1) {
        logger.info(`[Retry] Operation succeeded on attempt ${attempt}`)
      }
      
      return result
    } catch (error) {
      lastError = error
      
      // Check if we should retry
      if (attempt === config.maxAttempts || !config.shouldRetry(error, attempt)) {
        // No more retries or shouldn't retry this error
        throw error
      }
      
      // Calculate delay with exponential backoff
      const baseDelay = config.initialDelay * Math.pow(config.backoffFactor, attempt - 1)
      const delay = Math.min(baseDelay, config.maxDelay)
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay // Up to 10% jitter
      const actualDelay = Math.floor(delay + jitter)
      
      // Notify about retry
      config.onRetry(error, attempt, actualDelay)
      
      // Wait before retrying
      await sleep(actualDelay)
    }
  }
  
  // Should never reach here, but TypeScript needs this
  throw lastError
}

/**
 * Sleep for a specified duration
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create a retry wrapper with preset options
 * Useful for creating service-specific retry functions
 */
export function createRetryWrapper(defaultOptions: RetryOptions) {
  return <T>(operation: () => Promise<T>, overrides?: RetryOptions): Promise<T> => {
    return retryWithBackoff(operation, { ...defaultOptions, ...overrides })
  }
}

/**
 * Predefined retry strategies
 */
export const RetryStrategies = {
  /**
   * Conservative strategy - fewer attempts, longer delays
   * Good for operations that are expensive or have rate limits
   */
  conservative: {
    maxAttempts: 3,
    initialDelay: 2000,
    maxDelay: 60000,
    backoffFactor: 3
  } as RetryOptions,
  
  /**
   * Aggressive strategy - more attempts, shorter delays
   * Good for critical operations that need to succeed
   */
  aggressive: {
    maxAttempts: 5,
    initialDelay: 500,
    maxDelay: 10000,
    backoffFactor: 1.5
  } as RetryOptions,
  
  /**
   * Fast strategy - quick retries for transient failures
   * Good for operations expected to recover quickly
   */
  fast: {
    maxAttempts: 4,
    initialDelay: 100,
    maxDelay: 2000,
    backoffFactor: 2
  } as RetryOptions,
  
  /**
   * Network strategy - optimized for network requests
   * Handles timeouts and connection errors
   */
  network: {
    maxAttempts: 4,
    initialDelay: 1000,
    maxDelay: 15000,
    backoffFactor: 2,
    shouldRetry: (error) => {
      // Network-specific error checking
      const networkErrors = [
        'NETWORK_ERROR',
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'EHOSTUNREACH'
      ]
      
      if (error.code && networkErrors.includes(error.code)) {
        return true
      }
      
      if (error.status >= 500 || error.status === 429 || error.status === 408) {
        return true
      }
      
      if (error.message?.toLowerCase().includes('network')) {
        return true
      }
      
      return false
    }
  } as RetryOptions
}

/**
 * Error class for retry-specific errors
 */
export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: any
  ) {
    super(message)
    this.name = 'RetryError'
  }
}