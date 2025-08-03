import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { retryWithBackoff, createRetryWrapper, RetryStrategies, RetryError } from '../retryWithBackoff'
import { logger } from '../logger'

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Successful Operations', () => {
    it('should return result immediately if operation succeeds on first try', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      const resultPromise = retryWithBackoff(operation)
      const result = await resultPromise
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('should retry and succeed on second attempt', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success')
      
      const resultPromise = retryWithBackoff(operation)
      
      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0)
      
      // Wait for retry delay
      await vi.advanceTimersByTimeAsync(1100) // 1000ms + jitter
      
      const result = await resultPromise
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[Retry] Attempt 1 failed'),
        'First failure'
      )
      expect(logger.info).toHaveBeenCalledWith('[Retry] Operation succeeded on attempt 2')
    })

    it('should succeed after multiple retries', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success')
      
      const resultPromise = retryWithBackoff(operation)
      
      // First attempt fails
      await vi.advanceTimersByTimeAsync(0)
      
      // First retry (1s delay)
      await vi.advanceTimersByTimeAsync(1100)
      
      // Second retry (2s delay with backoff)
      await vi.advanceTimersByTimeAsync(2100)
      
      const result = await resultPromise
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
      expect(logger.warn).toHaveBeenCalledTimes(2)
    })
  })

  describe('Failed Operations', () => {
    it('should throw error after max attempts', async () => {
      const error = new Error('Persistent failure')
      const operation = vi.fn().mockRejectedValue(error)
      
      const resultPromise = retryWithBackoff(operation, { maxAttempts: 3 })
      
      // Advance through all retry attempts
      await vi.advanceTimersByTimeAsync(0) // First attempt
      await vi.advanceTimersByTimeAsync(1100) // Second attempt (1s delay)
      await vi.advanceTimersByTimeAsync(2100) // Third attempt (2s delay)
      
      await expect(resultPromise).rejects.toThrow('Persistent failure')
      expect(operation).toHaveBeenCalledTimes(3)
      expect(logger.warn).toHaveBeenCalledTimes(2) // Only logs retries, not final failure
    })

    it('should not retry if shouldRetry returns false', async () => {
      const error = { status: 404, message: 'Not found' }
      const operation = vi.fn().mockRejectedValue(error)
      
      await expect(retryWithBackoff(operation)).rejects.toEqual(error)
      
      expect(operation).toHaveBeenCalledTimes(1)
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('should retry network errors by default', async () => {
      const networkError = { code: 'NETWORK_ERROR', message: 'Network failed' }
      const operation = vi.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce('success')
      
      const resultPromise = retryWithBackoff(operation)
      
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1100)
      
      const result = await resultPromise
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should retry server errors (5xx) by default', async () => {
      const serverError = { status: 503, message: 'Service unavailable' }
      const operation = vi.fn()
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce('success')
      
      const resultPromise = retryWithBackoff(operation)
      
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1100)
      
      const result = await resultPromise
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should retry rate limit errors (429) by default', async () => {
      const rateLimitError = { status: 429, message: 'Too many requests' }
      const operation = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('success')
      
      const resultPromise = retryWithBackoff(operation)
      
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1100)
      
      const result = await resultPromise
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should not retry client errors (4xx except 429) by default', async () => {
      const clientError = { status: 400, message: 'Bad request' }
      const operation = vi.fn().mockRejectedValue(clientError)
      
      await expect(retryWithBackoff(operation)).rejects.toEqual(clientError)
      
      expect(operation).toHaveBeenCalledTimes(1)
    })
  })

  describe('Exponential Backoff', () => {
    it('should apply exponential backoff correctly', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Failure'))
      const onRetry = vi.fn()
      
      const options = {
        maxAttempts: 4,
        initialDelay: 100,
        backoffFactor: 2,
        onRetry
      }
      
      const resultPromise = retryWithBackoff(operation, options)
      
      // Track delays
      const delays: number[] = []
      onRetry.mockImplementation((error, attempt, delay) => {
        delays.push(delay)
      })
      
      // Run through all attempts
      await vi.advanceTimersByTimeAsync(0) // First attempt
      await vi.advanceTimersByTimeAsync(110) // ~100ms + jitter
      await vi.advanceTimersByTimeAsync(210) // ~200ms + jitter
      await vi.advanceTimersByTimeAsync(410) // ~400ms + jitter
      
      await expect(resultPromise).rejects.toThrow()
      
      // Verify exponential growth (with jitter tolerance)
      expect(delays[0]).toBeGreaterThanOrEqual(100)
      expect(delays[0]).toBeLessThan(120)
      
      expect(delays[1]).toBeGreaterThanOrEqual(200)
      expect(delays[1]).toBeLessThan(240)
      
      expect(delays[2]).toBeGreaterThanOrEqual(400)
      expect(delays[2]).toBeLessThan(480)
    })

    it('should respect maxDelay limit', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Failure'))
      const onRetry = vi.fn()
      
      const options = {
        maxAttempts: 5,
        initialDelay: 1000,
        maxDelay: 3000,
        backoffFactor: 10, // Very high to test maxDelay
        onRetry
      }
      
      const delays: number[] = []
      onRetry.mockImplementation((error, attempt, delay) => {
        delays.push(delay)
      })
      
      const resultPromise = retryWithBackoff(operation, options)
      
      // Run through attempts
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1100) // ~1000ms
      await vi.advanceTimersByTimeAsync(3100) // Should be capped at 3000ms
      await vi.advanceTimersByTimeAsync(3100) // Should remain at 3000ms
      await vi.advanceTimersByTimeAsync(3100) // Should remain at 3000ms
      
      await expect(resultPromise).rejects.toThrow()
      
      // First delay should be ~1000ms
      expect(delays[0]).toBeGreaterThanOrEqual(1000)
      expect(delays[0]).toBeLessThan(1200)
      
      // Subsequent delays should be capped at maxDelay
      expect(delays[1]).toBeLessThanOrEqual(3300) // 3000 + 10% jitter
      expect(delays[2]).toBeLessThanOrEqual(3300)
      expect(delays[3]).toBeLessThanOrEqual(3300)
    })
  })

  describe('Custom Configuration', () => {
    it('should use custom shouldRetry function', async () => {
      const customError = { type: 'CUSTOM_ERROR' }
      const operation = vi.fn().mockRejectedValue(customError)
      
      const shouldRetry = vi.fn().mockReturnValue(false)
      
      await expect(
        retryWithBackoff(operation, { shouldRetry })
      ).rejects.toEqual(customError)
      
      expect(shouldRetry).toHaveBeenCalledWith(customError, 1)
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should call onRetry callback with correct arguments', async () => {
      const error = new Error('Test error')
      const operation = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success')
      
      const onRetry = vi.fn()
      
      const resultPromise = retryWithBackoff(operation, { onRetry })
      
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1100)
      
      await resultPromise
      
      expect(onRetry).toHaveBeenCalledWith(
        error,
        1,
        expect.any(Number) // Delay with jitter
      )
      
      const delay = onRetry.mock.calls[0][2]
      expect(delay).toBeGreaterThanOrEqual(1000)
      expect(delay).toBeLessThan(1200)
    })
  })

  describe('createRetryWrapper', () => {
    it('should create a wrapper with preset options', async () => {
      const wrapper = createRetryWrapper({
        maxAttempts: 2,
        initialDelay: 50
      })
      
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('success')
      
      const resultPromise = wrapper(operation)
      
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(60)
      
      const result = await resultPromise
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should allow overriding wrapper options', async () => {
      const wrapper = createRetryWrapper({
        maxAttempts: 5,
        initialDelay: 1000
      })
      
      const operation = vi.fn().mockRejectedValue(new Error('Failure'))
      
      // Override with just 1 attempt
      await expect(
        wrapper(operation, { maxAttempts: 1 })
      ).rejects.toThrow()
      
      expect(operation).toHaveBeenCalledTimes(1)
    })
  })

  describe('Retry Strategies', () => {
    it('should use conservative strategy correctly', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('success')
      
      const resultPromise = retryWithBackoff(operation, RetryStrategies.conservative)
      
      // Conservative has 2s initial delay
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(2100)
      
      const result = await resultPromise
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should use aggressive strategy correctly', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Failure'))
      
      const resultPromise = retryWithBackoff(operation, RetryStrategies.aggressive)
      
      // Aggressive has 5 attempts with 500ms initial delay
      await vi.advanceTimersByTimeAsync(0) // Attempt 1
      await vi.advanceTimersByTimeAsync(550) // Attempt 2
      await vi.advanceTimersByTimeAsync(800) // Attempt 3
      await vi.advanceTimersByTimeAsync(1200) // Attempt 4
      await vi.advanceTimersByTimeAsync(1800) // Attempt 5
      
      await expect(resultPromise).rejects.toThrow()
      expect(operation).toHaveBeenCalledTimes(5)
    })

    it('should use fast strategy correctly', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValueOnce('success')
      
      const resultPromise = retryWithBackoff(operation, RetryStrategies.fast)
      
      // Fast has 100ms initial delay
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(110)
      
      const result = await resultPromise
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should use network strategy with network-specific errors', async () => {
      const networkErrors = [
        { code: 'ECONNREFUSED' },
        { code: 'ECONNRESET' },
        { code: 'ETIMEDOUT' },
        { status: 503 },
        { status: 429 },
        { message: 'Network request failed' }
      ]
      
      for (const error of networkErrors) {
        const operation = vi.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce('success')
        
        const resultPromise = retryWithBackoff(operation, RetryStrategies.network)
        
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(1100)
        
        const result = await resultPromise
        
        expect(result).toBe('success')
        expect(operation).toHaveBeenCalledTimes(2)
        
        vi.clearAllMocks()
      }
    })

    it('should not retry non-network errors with network strategy', async () => {
      const nonNetworkError = { status: 400, message: 'Bad request' }
      const operation = vi.fn().mockRejectedValue(nonNetworkError)
      
      await expect(
        retryWithBackoff(operation, RetryStrategies.network)
      ).rejects.toEqual(nonNetworkError)
      
      expect(operation).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle operations that throw non-Error objects', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce('string error')
        .mockResolvedValueOnce('success')
      
      const resultPromise = retryWithBackoff(operation)
      
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1100)
      
      const result = await resultPromise
      
      expect(result).toBe('success')
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[Retry] Attempt 1 failed'),
        'string error'
      )
    })

    it('should handle operations that return undefined', async () => {
      const operation = vi.fn().mockResolvedValue(undefined)
      
      const result = await retryWithBackoff(operation)
      
      expect(result).toBeUndefined()
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should handle very long-running operations', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000))
        return 'success'
      })
      
      const resultPromise = retryWithBackoff(operation)
      
      await vi.advanceTimersByTimeAsync(5000)
      
      const result = await resultPromise
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should handle zero maxAttempts gracefully', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      await expect(
        retryWithBackoff(operation, { maxAttempts: 0 })
      ).rejects.toThrow()
      
      expect(operation).not.toHaveBeenCalled()
    })

    it('should add appropriate jitter to delays', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Failure'))
      const delays: number[] = []
      
      const onRetry = vi.fn().mockImplementation((error, attempt, delay) => {
        delays.push(delay)
      })
      
      // Run multiple times to test jitter variation
      for (let i = 0; i < 5; i++) {
        vi.clearAllMocks()
        delays.length = 0
        
        const resultPromise = retryWithBackoff(operation, {
          maxAttempts: 2,
          initialDelay: 1000,
          onRetry
        })
        
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(1100)
        
        await expect(resultPromise).rejects.toThrow()
      }
      
      // All delays should be different due to jitter
      const uniqueDelays = new Set(delays)
      expect(uniqueDelays.size).toBeGreaterThan(1)
      
      // All should be within expected range (1000-1100ms)
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(1000)
        expect(delay).toBeLessThan(1100)
      })
    })
  })
})