import { describe, it, expect } from 'vitest'
import { DURATIONS, DurationKey } from '../durations'

describe('DURATIONS constants', () => {
  describe('Duration values', () => {
    it('should have correct toast duration', () => {
      expect(DURATIONS.toastDuration).toBe(5000)
      expect(DURATIONS.toastDuration).toEqual(5 * 1000) // 5 seconds
    })

    it('should have correct autosave interval', () => {
      expect(DURATIONS.autosaveInterval).toBe(30000)
      expect(DURATIONS.autosaveInterval).toEqual(30 * 1000) // 30 seconds
    })

    it('should have correct animation durations', () => {
      expect(DURATIONS.fadeIn).toBe(300)
      expect(DURATIONS.fadeOut).toBe(200)
      expect(DURATIONS.slideIn).toBe(300)
      
      // Fade out should be faster than fade in
      expect(DURATIONS.fadeOut).toBeLessThan(DURATIONS.fadeIn)
    })

    it('should have correct debounce delays', () => {
      expect(DURATIONS.searchDebounce).toBe(500)
      expect(DURATIONS.inputDebounce).toBe(300)
      
      // Search debounce should be longer than input debounce
      expect(DURATIONS.searchDebounce).toBeGreaterThan(DURATIONS.inputDebounce)
    })

    it('should have correct loading time', () => {
      expect(DURATIONS.minimumLoadingTime).toBe(500)
    })

    it('should have correct timeout values', () => {
      expect(DURATIONS.apiTimeout).toBe(30000)
      expect(DURATIONS.fileUploadTimeout).toBe(60000)
      
      // File upload should have longer timeout than regular API calls
      expect(DURATIONS.fileUploadTimeout).toBeGreaterThan(DURATIONS.apiTimeout)
    })
  })

  describe('Type safety', () => {
    it('should export correct type definition', () => {
      // Type checking - this should compile without errors
      const durationKey: DurationKey = 'toastDuration'
      expect(DURATIONS[durationKey]).toBeDefined()
    })

    it('should have all expected keys', () => {
      const expectedKeys: DurationKey[] = [
        'toastDuration',
        'autosaveInterval',
        'fadeIn',
        'fadeOut',
        'slideIn',
        'searchDebounce',
        'inputDebounce',
        'minimumLoadingTime',
        'apiTimeout',
        'fileUploadTimeout'
      ]
      
      const actualKeys = Object.keys(DURATIONS)
      expect(actualKeys).toHaveLength(expectedKeys.length)
      expectedKeys.forEach(key => {
        expect(actualKeys).toContain(key)
      })
    })
  })

  describe('Value validation', () => {
    it('should have all positive values', () => {
      Object.values(DURATIONS).forEach(duration => {
        expect(duration).toBeGreaterThan(0)
      })
    })

    it('should have reasonable animation durations', () => {
      // Animations should be between 100ms and 1000ms
      expect(DURATIONS.fadeIn).toBeGreaterThanOrEqual(100)
      expect(DURATIONS.fadeIn).toBeLessThanOrEqual(1000)
      
      expect(DURATIONS.fadeOut).toBeGreaterThanOrEqual(100)
      expect(DURATIONS.fadeOut).toBeLessThanOrEqual(1000)
      
      expect(DURATIONS.slideIn).toBeGreaterThanOrEqual(100)
      expect(DURATIONS.slideIn).toBeLessThanOrEqual(1000)
    })

    it('should have reasonable debounce delays', () => {
      // Debounce should be between 100ms and 1000ms
      expect(DURATIONS.searchDebounce).toBeGreaterThanOrEqual(100)
      expect(DURATIONS.searchDebounce).toBeLessThanOrEqual(1000)
      
      expect(DURATIONS.inputDebounce).toBeGreaterThanOrEqual(100)
      expect(DURATIONS.inputDebounce).toBeLessThanOrEqual(1000)
    })

    it('should have reasonable timeout values', () => {
      // Timeouts should be at least 10 seconds
      expect(DURATIONS.apiTimeout).toBeGreaterThanOrEqual(10000)
      expect(DURATIONS.fileUploadTimeout).toBeGreaterThanOrEqual(10000)
    })
  })

  describe('Usage patterns', () => {
    it('should provide millisecond values', () => {
      // All values should be in milliseconds for setTimeout/setInterval
      Object.entries(DURATIONS).forEach(([key, value]) => {
        expect(value).toBeTypeOf('number')
        expect(Number.isInteger(value)).toBe(true)
      })
    })

    it('should be suitable for setTimeout usage', () => {
      // Simulate usage with setTimeout (just checking the values are valid)
      const timeoutId = setTimeout(() => {}, DURATIONS.toastDuration)
      expect(timeoutId).toBeDefined()
      clearTimeout(timeoutId)
    })

    it('should be suitable for CSS transitions', () => {
      // CSS animation values should be convertible to string
      const cssTransition = `opacity ${DURATIONS.fadeIn}ms ease-in-out`
      expect(cssTransition).toBe('opacity 300ms ease-in-out')
    })
  })

  describe('Business logic validation', () => {
    it('should have toast duration long enough to read', () => {
      // Toast should be visible for at least 3 seconds
      expect(DURATIONS.toastDuration).toBe(5000) // 5 seconds as defined
    })

    it('should have autosave interval that balances performance and data safety', () => {
      // Autosave should be between 10 seconds and 5 minutes
      expect(DURATIONS.autosaveInterval).toBeGreaterThanOrEqual(10000)
      expect(DURATIONS.autosaveInterval).toBeLessThanOrEqual(300000)
    })

    it('should have minimum loading time to prevent flashing', () => {
      // Minimum loading should be at least 200ms to prevent flashing
      expect(DURATIONS.minimumLoadingTime).toBeGreaterThanOrEqual(200)
    })
  })
})