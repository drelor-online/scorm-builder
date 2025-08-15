/**
 * BlobURLCache Memory Management Tests
 * 
 * Tests for LRU cache with size limits and automatic eviction to prevent memory leaks
 * in long-running sessions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BlobURLCache } from '../BlobURLCache'

describe('BlobURLCache Memory Management', () => {
  let cache: BlobURLCache
  let mockFetcher: vi.MockedFunction<() => Promise<{ data: Uint8Array; mimeType: string } | null>>

  beforeEach(() => {
    // Reset the singleton instance for clean tests
    ;(BlobURLCache as any).instance = null
    cache = BlobURLCache.getInstance()
    
    mockFetcher = vi.fn().mockResolvedValue({
      data: new Uint8Array([1, 2, 3, 4]),
      mimeType: 'image/jpeg'
    })
  })

  describe('LRU Cache Behavior', () => {
    it('should enforce maximum cache size limit', async () => {
      // This test should fail initially because LRU is not implemented
      const maxSize = 3
      cache.setMaxSize(maxSize)

      // Add more items than the limit
      await cache.getOrCreate('item1', mockFetcher)
      await cache.getOrCreate('item2', mockFetcher)
      await cache.getOrCreate('item3', mockFetcher)
      await cache.getOrCreate('item4', mockFetcher) // Should evict item1

      expect(cache.size()).toBe(maxSize)
      expect(cache.get('item1')).toBeNull() // Should be evicted
      expect(cache.get('item2')).not.toBeNull()
      expect(cache.get('item3')).not.toBeNull()
      expect(cache.get('item4')).not.toBeNull()
    })

    it('should update access time when item is retrieved', async () => {
      const maxSize = 2
      cache.setMaxSize(maxSize)

      await cache.getOrCreate('item1', mockFetcher)
      await cache.getOrCreate('item2', mockFetcher)
      
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Access item1 to make it recently used
      cache.get('item1')
      
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Add new item - should evict item2, not item1
      await cache.getOrCreate('item3', mockFetcher)

      expect(cache.get('item1')).not.toBeNull() // Should still be cached
      expect(cache.get('item2')).toBeNull() // Should be evicted
      expect(cache.get('item3')).not.toBeNull()
    })

    it('should track memory usage accurately', async () => {
      const mockLargeData = new Uint8Array(1024 * 1024) // 1MB
      const largeFetcher = vi.fn().mockResolvedValue({
        data: mockLargeData,
        mimeType: 'video/mp4'
      })

      await cache.getOrCreate('large-item', largeFetcher)
      
      const memoryUsage = cache.getMemoryUsage()
      expect(memoryUsage.totalBytes).toBeGreaterThanOrEqual(1024 * 1024)
      expect(memoryUsage.itemCount).toBe(1)
    })

    it('should auto-evict when memory threshold is exceeded', async () => {
      // Set a small memory threshold for testing
      cache.setMemoryThreshold(2 * 1024 * 1024) // 2MB

      const mockLargeData = new Uint8Array(1024 * 1024) // 1MB each
      const largeFetcher = vi.fn().mockResolvedValue({
        data: mockLargeData,
        mimeType: 'video/mp4'
      })

      // Add items that exceed threshold
      await cache.getOrCreate('item1', largeFetcher)
      await cache.getOrCreate('item2', largeFetcher)
      await cache.getOrCreate('item3', largeFetcher) // Should trigger auto-eviction

      const memoryUsage = cache.getMemoryUsage()
      expect(memoryUsage.totalBytes).toBeLessThanOrEqual(2 * 1024 * 1024)
      expect(cache.get('item1')).toBeNull() // Oldest should be evicted
    })
  })

  describe('Memory Statistics', () => {
    it('should provide detailed memory statistics', async () => {
      await cache.getOrCreate('item1', mockFetcher)
      await cache.getOrCreate('item2', mockFetcher)

      const stats = cache.getMemoryStats()
      expect(stats).toEqual({
        itemCount: 2,
        totalBytes: expect.any(Number),
        maxSize: expect.any(Number),
        memoryThreshold: expect.any(Number),
        averageItemSize: expect.any(Number),
        oldestItemAge: expect.any(Number),
        newestItemAge: expect.any(Number)
      })
    })

    it('should track cache hit ratio for performance monitoring', async () => {
      // Create a fresh cache instance to avoid interference
      ;(BlobURLCache as any).instance = null
      const freshCache = BlobURLCache.getInstance()
      
      await freshCache.getOrCreate('item1', mockFetcher)
      
      // Hit
      freshCache.get('item1')
      freshCache.get('item1')
      
      // Miss
      freshCache.get('nonexistent')

      const stats = freshCache.getPerformanceStats()
      expect(stats.hitRatio).toBeGreaterThan(0)
      expect(stats.totalRequests).toBe(4) // 1 getOrCreate + 3 get calls
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(2) // 1 miss in getOrCreate + 1 miss for nonexistent
    })
  })

  describe('Cleanup Operations', () => {
    it('should clean up expired items based on age', async () => {
      cache.setMaxAge(100) // 100ms max age

      await cache.getOrCreate('item1', mockFetcher)
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150))
      
      cache.cleanupExpired()
      
      expect(cache.get('item1')).toBeNull()
    })

    it('should provide manual cleanup method for oldest items', async () => {
      await cache.getOrCreate('item1', mockFetcher)
      await cache.getOrCreate('item2', mockFetcher)
      await cache.getOrCreate('item3', mockFetcher)

      cache.cleanupOldest(2) // Remove 2 oldest items

      expect(cache.size()).toBe(1)
      expect(cache.get('item3')).not.toBeNull() // Newest should remain
    })
  })
})