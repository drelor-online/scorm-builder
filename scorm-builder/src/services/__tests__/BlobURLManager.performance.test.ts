import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BlobURLManager } from '../BlobURLManager'
import { performanceMonitor } from '@/utils/performanceMonitor'

describe('BlobURLManager Performance Tests', () => {
  let manager: BlobURLManager
  let revokeObjectURLSpy: any

  beforeEach(() => {
    manager = new BlobURLManager()
    // Mock URL methods
    global.URL.createObjectURL = vi.fn((blob) => `blob:mock-url-${Math.random()}`)
    revokeObjectURLSpy = vi.spyOn(global.URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  describe('Performance Benchmarks', () => {
    it('should handle rapid blob URL creation efficiently', async () => {
      const startTime = performance.now()
      const blobs: Blob[] = []
      const urls: string[] = []

      // Create 1000 blob URLs rapidly
      for (let i = 0; i < 1000; i++) {
        const blob = new Blob([`test data ${i}`], { type: 'text/plain' })
        blobs.push(blob)
        const url = manager.createObjectURL(blob, `page-${i % 10}`)
        urls.push(url)
      }

      const creationTime = performance.now() - startTime
      console.log(`Created 1000 blob URLs in ${creationTime.toFixed(2)}ms`)

      // Should complete within reasonable time (< 100ms)
      expect(creationTime).toBeLessThan(100)

      // Verify all URLs were tracked
      expect(manager.getActiveUrlCount()).toBe(1000)

      // Cleanup should also be efficient
      const cleanupStart = performance.now()
      manager.cleanup()
      const cleanupTime = performance.now() - cleanupStart
      console.log(`Cleaned up 1000 blob URLs in ${cleanupTime.toFixed(2)}ms`)

      expect(cleanupTime).toBeLessThan(50)
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1000)
    })

    it('should efficiently handle concurrent operations', async () => {
      const operations = 100
      const concurrency = 10

      const startTime = performance.now()

      // Simulate concurrent blob operations
      const promises = []
      for (let i = 0; i < operations; i += concurrency) {
        const batch = []
        for (let j = 0; j < concurrency && i + j < operations; j++) {
          batch.push(
            new Promise<void>((resolve) => {
              const blob = new Blob([`data ${i + j}`], { type: 'application/octet-stream' })
              const url = manager.createObjectURL(blob, 'concurrent-test')
              // Simulate some processing
              setTimeout(() => {
                manager.incrementRefCount(url)
                manager.decrementRefCount(url)
                resolve()
              }, Math.random() * 10)
            })
          )
        }
        promises.push(...batch)
      }

      await Promise.all(promises)

      const totalTime = performance.now() - startTime
      console.log(`Completed ${operations} concurrent operations in ${totalTime.toFixed(2)}ms`)

      // Should handle concurrent operations efficiently
      expect(totalTime).toBeLessThan(500)
    })

    it('should maintain performance with mixed page IDs', () => {
      const pageIds = ['welcome', 'objectives', 'topic-1', 'topic-2', 'topic-3']
      const startTime = performance.now()

      // Create URLs for different pages
      for (let i = 0; i < 500; i++) {
        const pageId = pageIds[i % pageIds.length]
        const blob = new Blob([`content for ${pageId}`], { type: 'text/plain' })
        manager.createObjectURL(blob, pageId)
      }

      // Test page-specific cleanup performance
      const cleanupStart = performance.now()
      manager.cleanupByPage('topic-1')
      const cleanupTime = performance.now() - cleanupStart

      console.log(`Page-specific cleanup completed in ${cleanupTime.toFixed(2)}ms`)
      expect(cleanupTime).toBeLessThan(10)

      // Should have cleaned up only topic-1 URLs (100 URLs)
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(100)
    })

    it('should efficiently handle reference counting', () => {
      const blob = new Blob(['shared data'], { type: 'text/plain' })
      const url = manager.createObjectURL(blob, 'shared')

      const startTime = performance.now()

      // Simulate heavy reference counting
      for (let i = 0; i < 10000; i++) {
        manager.incrementRefCount(url)
      }

      for (let i = 0; i < 9999; i++) {
        manager.decrementRefCount(url)
      }

      const refCountTime = performance.now() - startTime
      console.log(`10000 ref count operations completed in ${refCountTime.toFixed(2)}ms`)

      // Should handle ref counting efficiently
      expect(refCountTime).toBeLessThan(50)

      // URL should still exist (ref count = 1)
      expect(revokeObjectURLSpy).not.toHaveBeenCalled()

      // Final decrement should trigger cleanup
      manager.decrementRefCount(url)
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(url)
    })

    it('should maintain performance during automatic cleanup cycles', async () => {
      vi.useFakeTimers()

      // Create URLs that will expire at different times
      const startTime = performance.now()
      
      for (let i = 0; i < 100; i++) {
        const blob = new Blob([`data ${i}`], { type: 'text/plain' })
        manager.createObjectURL(blob, 'auto-cleanup-test')
        
        // Advance time slightly between creations
        vi.advanceTimersByTime(100)
      }

      // Trigger cleanup by advancing past 30 minutes
      const cleanupStart = performance.now()
      vi.advanceTimersByTime(30 * 60 * 1000)
      
      // Wait for cleanup to complete
      await vi.runAllTimersAsync()
      
      const cleanupTime = performance.now() - cleanupStart
      console.log(`Automatic cleanup cycle completed in ${cleanupTime.toFixed(2)}ms`)

      // Cleanup should be efficient even with staggered expiration times
      expect(cleanupTime).toBeLessThan(100)

      vi.useRealTimers()
    })

    it('should handle memory pressure gracefully', () => {
      const urls: string[] = []
      const blobs: Blob[] = []

      // Create large blobs to simulate memory pressure
      for (let i = 0; i < 50; i++) {
        // Create 1MB blobs
        const largeData = new Uint8Array(1024 * 1024)
        const blob = new Blob([largeData], { type: 'application/octet-stream' })
        blobs.push(blob)
        urls.push(manager.createObjectURL(blob, 'memory-test'))
      }

      // Measure cleanup performance under memory pressure
      const cleanupStart = performance.now()
      manager.cleanup()
      const cleanupTime = performance.now() - cleanupStart

      console.log(`Cleanup of 50 large blobs completed in ${cleanupTime.toFixed(2)}ms`)
      expect(cleanupTime).toBeLessThan(100)

      // All URLs should be revoked
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(50)
    })

    it('should maintain lookup performance with large URL sets', () => {
      // Create a large number of URLs
      const urlMap = new Map<string, string>()
      
      for (let i = 0; i < 5000; i++) {
        const blob = new Blob([`data ${i}`], { type: 'text/plain' })
        const url = manager.createObjectURL(blob, `page-${i % 50}`)
        urlMap.set(`key-${i}`, url)
      }

      // Test lookup performance
      const lookupStart = performance.now()
      let found = 0

      // Perform random lookups
      for (let i = 0; i < 1000; i++) {
        const key = `key-${Math.floor(Math.random() * 5000)}`
        const url = urlMap.get(key)
        if (url && manager.hasUrl(url)) {
          found++
        }
      }

      const lookupTime = performance.now() - lookupStart
      console.log(`1000 lookups in 5000 URLs completed in ${lookupTime.toFixed(2)}ms`)

      // Lookups should be fast
      expect(lookupTime).toBeLessThan(10)
      expect(found).toBeGreaterThan(900) // Most should be found
    })

    it('should integrate with PerformanceMonitor efficiently', async () => {
      // Test that performance monitoring doesn't add significant overhead
      const createWithMonitoring = async () => {
        return performanceMonitor.measureOperation(
          'BlobURLManager.createObjectURL',
          async () => {
            const blob = new Blob(['monitored data'], { type: 'text/plain' })
            return manager.createObjectURL(blob, 'monitored')
          },
          { operation: 'create' }
        )
      }

      const startTime = performance.now()
      const promises = []

      // Create 100 URLs with performance monitoring
      for (let i = 0; i < 100; i++) {
        promises.push(createWithMonitoring())
      }

      await Promise.all(promises)
      const totalTime = performance.now() - startTime

      console.log(`100 monitored operations completed in ${totalTime.toFixed(2)}ms`)
      
      // Performance monitoring should add minimal overhead
      expect(totalTime).toBeLessThan(200)

      // Check recorded metrics
      const metrics = performanceMonitor.getMetricsForOperation('BlobURLManager.createObjectURL')
      expect(metrics).toHaveLength(100)
      
      const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length
      console.log(`Average operation duration: ${avgDuration.toFixed(2)}ms`)
      expect(avgDuration).toBeLessThan(2) // Each operation should be very fast
    })
  })

  describe('Memory Leak Prevention', () => {
    it('should prevent memory leaks with proper cleanup', () => {
      const tracker = new Set<string>()
      
      // Override createObjectURL to track URLs
      global.URL.createObjectURL = vi.fn((blob) => {
        const url = `blob:test-${Math.random()}`
        tracker.add(url)
        return url
      })

      // Override revokeObjectURL to track cleanup
      global.URL.revokeObjectURL = vi.fn((url) => {
        tracker.delete(url)
      })

      // Simulate typical usage pattern
      for (let cycle = 0; cycle < 10; cycle++) {
        // Create URLs
        for (let i = 0; i < 100; i++) {
          const blob = new Blob([`cycle ${cycle} data ${i}`])
          manager.createObjectURL(blob, `cycle-${cycle}`)
        }

        // Clean up old cycles
        if (cycle > 0) {
          manager.cleanupByPage(`cycle-${cycle - 1}`)
        }
      }

      // Final cleanup
      manager.cleanup()

      // All URLs should be cleaned up
      expect(tracker.size).toBe(0)
      console.log('Memory leak test passed: all URLs properly cleaned up')
    })

    it('should handle error cases without performance degradation', () => {
      // Mock revokeObjectURL to occasionally throw
      let errorCount = 0
      global.URL.revokeObjectURL = vi.fn((url) => {
        if (Math.random() < 0.1) { // 10% error rate
          errorCount++
          throw new Error('Failed to revoke URL')
        }
      })

      // Create many URLs
      for (let i = 0; i < 1000; i++) {
        const blob = new Blob([`data ${i}`])
        manager.createObjectURL(blob, 'error-test')
      }

      // Cleanup should complete despite errors
      const cleanupStart = performance.now()
      manager.cleanup()
      const cleanupTime = performance.now() - cleanupStart

      console.log(`Cleanup with ${errorCount} errors completed in ${cleanupTime.toFixed(2)}ms`)
      
      // Should still be performant despite errors
      expect(cleanupTime).toBeLessThan(100)
    })
  })
})