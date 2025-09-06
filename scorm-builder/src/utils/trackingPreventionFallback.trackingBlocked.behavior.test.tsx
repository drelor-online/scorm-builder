/**
 * Behavior Test: Tracking Prevention Compatibility
 * 
 * Tests handling of browser tracking prevention that blocks storage access
 * and provides fallback mechanisms for graceful degradation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { trackingPreventionFallback } from './trackingPreventionFallback'

describe('Tracking Prevention Fallback', () => {
  let originalLocalStorage: Storage
  let originalConsole: Console

  beforeEach(() => {
    originalLocalStorage = global.localStorage
    originalConsole = global.console
    // Mock console to capture tracking prevention messages
    global.console = {
      ...console,
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn()
    }
  })

  afterEach(() => {
    global.localStorage = originalLocalStorage
    global.console = originalConsole
  })

  describe('when browser tracking prevention blocks localStorage access', () => {
    beforeEach(() => {
      // Reset the singleton state for each test
      const fallback = trackingPreventionFallback as any
      fallback.trackingBlocked = false
      fallback.hasWarnedAboutTracking = false
      fallback.memoryStorage.clear()
      
      // Mock localStorage to throw tracking prevention error
      global.localStorage = {
        getItem: vi.fn().mockImplementation(() => {
          throw new Error('Tracking Prevention blocked access to storage')
        }),
        setItem: vi.fn().mockImplementation(() => {
          throw new Error('Tracking Prevention blocked access to storage')
        }),
        removeItem: vi.fn().mockImplementation(() => {
          throw new Error('Tracking Prevention blocked access to storage')
        }),
        clear: vi.fn().mockImplementation(() => {
          throw new Error('Tracking Prevention blocked access to storage')
        }),
        key: vi.fn().mockImplementation(() => {
          throw new Error('Tracking Prevention blocked access to storage')
        }),
        length: 0
      } as Storage
    })

    it('should detect tracking prevention block and use memory fallback', async () => {
      const result = await trackingPreventionFallback.safeGetItem('testKey')
      
      expect(result).toBeNull() // No stored value in memory fallback
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[TrackingPreventionFallback] localStorage blocked, using memory fallback')
      )
    })

    it('should store values in memory when localStorage is blocked', async () => {
      await trackingPreventionFallback.safeSetItem('testKey', 'testValue')
      const result = await trackingPreventionFallback.safeGetItem('testKey')
      
      expect(result).toBe('testValue')
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[TrackingPreventionFallback] localStorage blocked, using memory fallback')
      )
    })

    it('should handle removal from memory fallback', async () => {
      await trackingPreventionFallback.safeSetItem('testKey', 'testValue')
      await trackingPreventionFallback.safeRemoveItem('testKey')
      const result = await trackingPreventionFallback.safeGetItem('testKey')
      
      expect(result).toBeNull()
    })

    it('should provide fallback for disabled log categories persistence', async () => {
      const categories = ['MediaService', 'YouTubeClipEditModal']
      
      await trackingPreventionFallback.saveDisabledCategories(categories)
      const result = await trackingPreventionFallback.loadDisabledCategories()
      
      expect(result).toEqual(categories)
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[TrackingPreventionFallback] localStorage blocked, using memory fallback')
      )
    })

    it('should gracefully handle repeated tracking prevention errors', async () => {
      // Multiple operations should not spam console
      await trackingPreventionFallback.safeSetItem('key1', 'value1')
      await trackingPreventionFallback.safeSetItem('key2', 'value2')
      await trackingPreventionFallback.safeGetItem('key1')
      
      // Should only warn once per session about tracking prevention
      const warnCalls = (console.warn as any).mock.calls.filter((call: any[]) => 
        call[0]?.includes?.('localStorage blocked')
      )
      expect(warnCalls.length).toBe(1)
    })
  })

  describe('when localStorage is available', () => {
    it('should use localStorage normally', async () => {
      const mockGetItem = vi.fn().mockReturnValue('testValue')
      const mockSetItem = vi.fn()
      
      global.localStorage = {
        ...originalLocalStorage,
        getItem: mockGetItem,
        setItem: mockSetItem
      } as Storage

      const result = await trackingPreventionFallback.safeGetItem('testKey')
      expect(result).toBe('testValue')
      expect(mockGetItem).toHaveBeenCalledWith('testKey')
      
      await trackingPreventionFallback.safeSetItem('testKey', 'newValue')
      expect(mockSetItem).toHaveBeenCalledWith('testKey', 'newValue')
    })
  })

  describe('graceful degradation features', () => {
    beforeEach(() => {
      // Reset the singleton state for each test
      const fallback = trackingPreventionFallback as any
      fallback.trackingBlocked = false
      fallback.hasWarnedAboutTracking = false
      fallback.memoryStorage.clear()
      
      // Mock localStorage to throw tracking prevention error
      global.localStorage = {
        getItem: vi.fn().mockImplementation(() => {
          throw new Error('Tracking Prevention blocked access to storage')
        }),
        setItem: vi.fn().mockImplementation(() => {
          throw new Error('Tracking Prevention blocked access to storage')
        }),
        clear: vi.fn().mockImplementation(() => {
          throw new Error('Tracking Prevention blocked access to storage')
        }),
        removeItem: vi.fn().mockImplementation(() => {
          throw new Error('Tracking Prevention blocked access to storage')
        }),
        key: vi.fn(),
        length: 0
      } as Storage
    })

    it('should provide user notification when tracking prevention is detected', async () => {
      // Trigger tracking prevention detection first
      await trackingPreventionFallback.safeGetItem('testKey')
      
      const notification = await trackingPreventionFallback.getTrackingPreventionNotification()
      
      expect(notification).toEqual({
        type: 'info',
        title: 'Privacy Settings Detected',
        message: 'Your browser\'s privacy settings are limiting some storage features. The application will continue to work with reduced functionality.',
        actions: [
          { label: 'Learn More', action: 'showPrivacyHelp' },
          { label: 'Continue', action: 'dismiss' }
        ]
      })
    })

    it('should maintain session-only data when localStorage is blocked', async () => {
      // Store multiple items
      await trackingPreventionFallback.safeSetItem('setting1', 'value1')
      await trackingPreventionFallback.safeSetItem('setting2', 'value2')
      
      // Should maintain all values in memory
      expect(await trackingPreventionFallback.safeGetItem('setting1')).toBe('value1')
      expect(await trackingPreventionFallback.safeGetItem('setting2')).toBe('value2')
      
      // Clear should work
      await trackingPreventionFallback.safeClear()
      expect(await trackingPreventionFallback.safeGetItem('setting1')).toBeNull()
      expect(await trackingPreventionFallback.safeGetItem('setting2')).toBeNull()
    })
  })
})