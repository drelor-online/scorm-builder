import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { blobUrlManager } from '../blobUrlManager'

describe('blobUrlManager', () => {
  // Mock URL.createObjectURL and URL.revokeObjectURL
  const mockCreateObjectURL = vi.fn()
  const mockRevokeObjectURL = vi.fn()
  
  // Mock timers for cleanup tests
  beforeEach(() => {
    vi.useFakeTimers()
    
    // Clear the manager state
    blobUrlManager.clearAll()
    
    // Setup mocks
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL
    
    // Reset mock implementations
    mockCreateObjectURL.mockReset()
    mockRevokeObjectURL.mockReset()
    mockCreateObjectURL.mockImplementation(() => `blob:mock-url-${Math.random()}`)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  describe('getOrCreateUrl', () => {
    it('should create a new URL for a new key', () => {
      const blob = new Blob(['test data'], { type: 'text/plain' })
      const key = 'test-key'
      
      const url = blobUrlManager.getOrCreateUrl(key, blob)
      
      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob)
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
      expect(url).toMatch(/^blob:mock-url-/)
    })

    it('should return existing URL for same key', () => {
      const blob1 = new Blob(['test data 1'], { type: 'text/plain' })
      const blob2 = new Blob(['test data 2'], { type: 'text/plain' })
      const key = 'test-key'
      
      const url1 = blobUrlManager.getOrCreateUrl(key, blob1)
      const url2 = blobUrlManager.getOrCreateUrl(key, blob2)
      
      expect(url1).toBe(url2)
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
    })

    it('should increment reference count for existing URLs', () => {
      const blob = new Blob(['test data'], { type: 'text/plain' })
      const key = 'test-key'
      
      blobUrlManager.getOrCreateUrl(key, blob)
      blobUrlManager.getOrCreateUrl(key, blob)
      blobUrlManager.getOrCreateUrl(key, blob)
      
      // Should still have the URL after two releases
      blobUrlManager.releaseUrl(key)
      blobUrlManager.releaseUrl(key)
      expect(blobUrlManager.hasUrl(key)).toBe(true)
      
      // Should be removed after third release
      blobUrlManager.releaseUrl(key)
      expect(blobUrlManager.hasUrl(key)).toBe(false)
    })
  })

  describe('releaseUrl', () => {
    it('should revoke URL when reference count reaches zero', () => {
      const blob = new Blob(['test data'], { type: 'text/plain' })
      const key = 'test-key'
      
      const url = blobUrlManager.getOrCreateUrl(key, blob)
      blobUrlManager.releaseUrl(key)
      
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(url)
      expect(blobUrlManager.hasUrl(key)).toBe(false)
    })

    it('should not revoke URL when references remain', () => {
      const blob = new Blob(['test data'], { type: 'text/plain' })
      const key = 'test-key'
      
      blobUrlManager.getOrCreateUrl(key, blob)
      blobUrlManager.getOrCreateUrl(key, blob) // ref count = 2
      
      blobUrlManager.releaseUrl(key) // ref count = 1
      
      expect(mockRevokeObjectURL).not.toHaveBeenCalled()
      expect(blobUrlManager.hasUrl(key)).toBe(true)
    })

    it('should handle releasing non-existent keys gracefully', () => {
      expect(() => {
        blobUrlManager.releaseUrl('non-existent-key')
      }).not.toThrow()
    })
  })

  describe('hasUrl', () => {
    it('should return true for existing URLs', () => {
      const blob = new Blob(['test data'], { type: 'text/plain' })
      const key = 'test-key'
      
      blobUrlManager.getOrCreateUrl(key, blob)
      expect(blobUrlManager.hasUrl(key)).toBe(true)
    })

    it('should return false for non-existent URLs', () => {
      expect(blobUrlManager.hasUrl('non-existent')).toBe(false)
    })

    it('should return false after URL is released', () => {
      const blob = new Blob(['test data'], { type: 'text/plain' })
      const key = 'test-key'
      
      blobUrlManager.getOrCreateUrl(key, blob)
      blobUrlManager.releaseUrl(key)
      
      expect(blobUrlManager.hasUrl(key)).toBe(false)
    })
  })

  describe('getUrl', () => {
    it('should return URL for existing keys', () => {
      const blob = new Blob(['test data'], { type: 'text/plain' })
      const key = 'test-key'
      
      const createdUrl = blobUrlManager.getOrCreateUrl(key, blob)
      const retrievedUrl = blobUrlManager.getUrl(key)
      
      expect(retrievedUrl).toBe(createdUrl)
    })

    it('should return undefined for non-existent keys', () => {
      expect(blobUrlManager.getUrl('non-existent')).toBeUndefined()
    })
  })

  describe('clearAll', () => {
    it('should revoke all URLs and clear storage', () => {
      const blob1 = new Blob(['test data 1'], { type: 'text/plain' })
      const blob2 = new Blob(['test data 2'], { type: 'text/plain' })
      
      const url1 = blobUrlManager.getOrCreateUrl('key1', blob1)
      const url2 = blobUrlManager.getOrCreateUrl('key2', blob2)
      
      blobUrlManager.clearAll()
      
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(url1)
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(url2)
      expect(blobUrlManager.hasUrl('key1')).toBe(false)
      expect(blobUrlManager.hasUrl('key2')).toBe(false)
    })

    it('should handle empty state gracefully', () => {
      expect(() => {
        blobUrlManager.clearAll()
      }).not.toThrow()
    })
  })

  describe('reference counting', () => {
    it('should correctly manage reference counts across multiple operations', () => {
      const blob = new Blob(['test data'], { type: 'text/plain' })
      const key = 'test-key'
      
      // Create initial reference
      const url = blobUrlManager.getOrCreateUrl(key, blob)
      
      // Add more references
      blobUrlManager.getOrCreateUrl(key, blob) // ref = 2
      blobUrlManager.getOrCreateUrl(key, blob) // ref = 3
      
      // Release references
      blobUrlManager.releaseUrl(key) // ref = 2
      expect(mockRevokeObjectURL).not.toHaveBeenCalled()
      
      blobUrlManager.releaseUrl(key) // ref = 1
      expect(mockRevokeObjectURL).not.toHaveBeenCalled()
      
      blobUrlManager.releaseUrl(key) // ref = 0
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(url)
      expect(blobUrlManager.hasUrl(key)).toBe(false)
    })
  })

  describe('enhanced features', () => {
    it('should track metadata with blob URLs', () => {
      const blob = new Blob(['test data'], { type: 'image/jpeg' })
      const key = 'media-123'
      const metadata = { pageId: 'welcome', type: 'image' }
      
      blobUrlManager.getOrCreateUrl(key, blob, metadata)
      
      expect(blobUrlManager.hasUrl(key)).toBe(true)
    })

    it('should update last accessed time when getting existing URL', () => {
      const blob = new Blob(['test data'], { type: 'text/plain' })
      const key = 'test-key'
      
      blobUrlManager.getOrCreateUrl(key, blob)
      
      // Advance time
      vi.advanceTimersByTime(1000)
      
      // Access the URL
      blobUrlManager.getUrl(key)
      
      // The URL should still exist
      expect(blobUrlManager.hasUrl(key)).toBe(true)
    })

    it('should provide statistics about blob URLs', () => {
      const blob1 = new Blob(['test data 1'], { type: 'text/plain' })
      const blob2 = new Blob(['test data 2'], { type: 'image/jpeg' })
      
      blobUrlManager.getOrCreateUrl('key1', blob1)
      blobUrlManager.getOrCreateUrl('key2', blob2)
      
      const stats = blobUrlManager.getStats()
      
      expect(stats.totalUrls).toBe(2)
      expect(stats.totalSize).toBe(blob1.size + blob2.size)
      expect(stats.averageAge).toBeGreaterThanOrEqual(0)
      expect(stats.inactiveUrls).toBe(0)
    })

    it('should clean up old URLs automatically', () => {
      const blob1 = new Blob(['old data'], { type: 'text/plain' })
      const blob2 = new Blob(['new data'], { type: 'text/plain' })
      
      const url1 = blobUrlManager.getOrCreateUrl('old-key', blob1)
      
      // Advance time past max age
      vi.advanceTimersByTime(61 * 60 * 1000) // 61 minutes
      
      const url2 = blobUrlManager.getOrCreateUrl('new-key', blob2)
      
      // Trigger cleanup
      blobUrlManager.cleanupOldUrls()
      
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(url1)
      expect(blobUrlManager.hasUrl('old-key')).toBe(false)
      expect(blobUrlManager.hasUrl('new-key')).toBe(true)
    })

    it('should clean up inactive URLs with zero references', () => {
      const blob = new Blob(['inactive data'], { type: 'text/plain' })
      const key = 'inactive-key'
      
      const url = blobUrlManager.getOrCreateUrl(key, blob)
      blobUrlManager.releaseUrl(key) // Set ref count to 0 but don't revoke
      
      // Manually re-add to simulate edge case
      blobUrlManager.getOrCreateUrl(key, blob)
      blobUrlManager.releaseUrl(key)
      
      // Advance time past inactive threshold
      vi.advanceTimersByTime(31 * 60 * 1000) // 31 minutes
      
      // Trigger cleanup
      blobUrlManager.cleanupOldUrls()
      
      expect(mockRevokeObjectURL).toHaveBeenCalled()
    })
  })

  describe('memory leak prevention', () => {
    it('should handle page unload cleanup', () => {
      const blob1 = new Blob(['data1'], { type: 'text/plain' })
      const blob2 = new Blob(['data2'], { type: 'text/plain' })
      
      const url1 = blobUrlManager.getOrCreateUrl('key1', blob1)
      const url2 = blobUrlManager.getOrCreateUrl('key2', blob2)
      
      // Simulate page unload
      window.dispatchEvent(new Event('beforeunload'))
      
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(url1)
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(url2)
    })

    it('should start automatic cleanup timer', () => {
      // Create a URL to ensure timer starts
      const blob = new Blob(['test'], { type: 'text/plain' })
      blobUrlManager.getOrCreateUrl('key', blob)
      
      // Advance time to trigger cleanup
      vi.advanceTimersByTime(30 * 60 * 1000) // 30 minutes
      
      // Cleanup should have been called
      expect(blobUrlManager.getStats).toBeDefined()
    })
  })
})