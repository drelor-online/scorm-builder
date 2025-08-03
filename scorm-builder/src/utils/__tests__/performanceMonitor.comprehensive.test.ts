import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PerformanceMonitor, performanceMonitor } from '../performanceMonitor'

describe('PerformanceMonitor Comprehensive Tests', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    // Mock performance.now() for consistent timing
    let mockTime = 0
    vi.spyOn(performance, 'now').mockImplementation(() => {
      return mockTime++
    })
    
    // Mock Date for consistent timestamps
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Async Operation Measurement', () => {
    it('should measure successful async operations', async () => {
      const result = await monitor.measureOperation(
        'test-operation',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return 'success'
        },
        { customData: 'test' }
      )

      expect(result).toBe('success')
      
      const metrics = monitor.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: 'test-operation',
        duration: expect.any(Number),
        timestamp: '2025-01-01T00:00:00.000Z',
        metadata: { customData: 'test' }
      })
    })

    it('should measure failed async operations', async () => {
      const testError = new Error('Operation failed')
      
      await expect(
        monitor.measureOperation('failing-operation', async () => {
          throw testError
        })
      ).rejects.toThrow('Operation failed')

      const metrics = monitor.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: 'failing-operation (failed)',
        duration: expect.any(Number),
        metadata: { error: true }
      })
    })

    it('should track slow operations', async () => {
      // Mock performance.now to simulate slow operation
      let mockTime = 0
      vi.spyOn(performance, 'now').mockImplementation(() => {
        const time = mockTime
        mockTime += mockTime === 0 ? 0 : 1500 // Make operation take 1500ms
        return time
      })

      await monitor.measureOperation('slow-operation', async () => {
        return 'done'
      })

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Slow operation detected: slow-operation took 1500.00ms')
      )
    })
  })

  describe('Sync Operation Measurement', () => {
    it('should measure successful sync operations', () => {
      const result = monitor.measureSync(
        'sync-operation',
        () => {
          return 42
        },
        { type: 'calculation' }
      )

      expect(result).toBe(42)
      
      const metrics = monitor.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: 'sync-operation',
        duration: expect.any(Number),
        metadata: { type: 'calculation' }
      })
    })

    it('should measure failed sync operations', () => {
      expect(() => {
        monitor.measureSync('failing-sync', () => {
          throw new Error('Sync failed')
        })
      }).toThrow('Sync failed')

      const metrics = monitor.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: 'failing-sync (failed)',
        metadata: { error: true }
      })
    })
  })

  describe('Manual Timing', () => {
    it('should support manual timing measurements', () => {
      const endTimer = monitor.startTiming('manual-operation')
      
      // Simulate some work
      vi.advanceTimersByTime(500)
      
      endTimer()

      const metrics = monitor.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: 'manual-operation',
        duration: expect.any(Number)
      })
    })
  })

  describe('Memory Tracking', () => {
    it('should track memory usage when available', async () => {
      // Mock performance.memory
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 1000000
        },
        configurable: true
      })

      await monitor.measureOperation('memory-test', async () => {
        // Mock memory increase during operation
        Object.defineProperty(performance, 'memory', {
          value: {
            usedJSHeapSize: 1500000
          },
          configurable: true
        })
        return 'done'
      })

      const metrics = monitor.getMetrics()
      expect(metrics[0].memoryDelta).toBe(500000)
    })

    it('should handle missing memory API gracefully', async () => {
      // Remove memory property
      delete (performance as any).memory

      await monitor.measureOperation('no-memory-test', async () => 'done')

      const metrics = monitor.getMetrics()
      expect(metrics[0].memoryDelta).toBe(0)
    })
  })

  describe('Metrics Management', () => {
    it('should limit stored metrics to maxMetrics', () => {
      // Add more than maxMetrics (1000)
      for (let i = 0; i < 1100; i++) {
        monitor.recordMetric({
          name: `operation-${i}`,
          duration: i,
          memoryDelta: 0,
          timestamp: new Date().toISOString()
        })
      }

      const metrics = monitor.getMetrics()
      expect(metrics).toHaveLength(1000)
      expect(metrics[0].name).toBe('operation-100') // First 100 should be removed
    })

    it('should filter metrics by operation name', async () => {
      await monitor.measureOperation('op-type-1', async () => 'result1')
      await monitor.measureOperation('op-type-2', async () => 'result2')
      await monitor.measureOperation('op-type-1', async () => 'result3')

      const type1Metrics = monitor.getMetricsForOperation('op-type-1')
      expect(type1Metrics).toHaveLength(2)
      expect(type1Metrics.every(m => m.name === 'op-type-1')).toBe(true)
    })

    it('should clear all metrics', () => {
      monitor.recordMetric({
        name: 'test-1',
        duration: 100,
        memoryDelta: 0,
        timestamp: new Date().toISOString()
      })
      monitor.recordMetric({
        name: 'test-2',
        duration: 200,
        memoryDelta: 0,
        timestamp: new Date().toISOString()
      })

      expect(monitor.getMetrics()).toHaveLength(2)
      
      monitor.clearMetrics()
      
      expect(monitor.getMetrics()).toHaveLength(0)
    })
  })

  describe('Summary Statistics', () => {
    it('should calculate correct summary statistics', async () => {
      // Add multiple metrics for the same operation
      for (let i = 0; i < 5; i++) {
        await monitor.measureOperation('repeated-op', async () => {
          return `result-${i}`
        })
      }

      const summary = monitor.getSummary()
      expect(summary).toHaveLength(1)
      expect(summary[0]).toMatchObject({
        operationName: 'repeated-op',
        count: 5,
        avgDuration: expect.any(Number),
        minDuration: expect.any(Number),
        maxDuration: expect.any(Number),
        avgMemoryDelta: 0
      })
    })

    it('should sort summary by slowest operations first', async () => {
      // Mock different durations
      let mockTime = 0
      vi.spyOn(performance, 'now').mockImplementation(() => {
        const current = mockTime
        mockTime += current % 3 === 0 ? 100 : current % 3 === 1 ? 50 : 10
        return current
      })

      await monitor.measureOperation('slow-op', async () => 'slow')
      await monitor.measureOperation('medium-op', async () => 'medium')
      await monitor.measureOperation('fast-op', async () => 'fast')

      const summary = monitor.getSummary()
      expect(summary[0].operationName).toBe('slow-op')
      expect(summary[1].operationName).toBe('medium-op')
      expect(summary[2].operationName).toBe('fast-op')
    })

    it('should identify consistently slow operations', async () => {
      // Create operations with different speeds
      vi.spyOn(performance, 'now').mockImplementation(() => Date.now())

      // Fast operations
      for (let i = 0; i < 3; i++) {
        await monitor.measureOperation('fast-op', async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return 'fast'
        })
      }

      // Slow operations
      for (let i = 0; i < 3; i++) {
        await monitor.measureOperation('slow-op', async () => {
          await new Promise(resolve => setTimeout(resolve, 1100))
          return 'slow'
        })
      }

      vi.advanceTimersByTime(2000)

      const slowOps = monitor.getSlowOperations(1000)
      expect(slowOps).toHaveLength(1)
      expect(slowOps[0].operationName).toBe('slow-op')
    })
  })

  describe('Performance Report', () => {
    it('should generate comprehensive performance report', async () => {
      // Add various metrics
      await monitor.measureOperation('api-call', async () => 'response')
      await monitor.measureOperation('db-query', async () => 'results')
      
      // Add a slow operation
      vi.spyOn(performance, 'now').mockImplementationOnce(() => 0).mockImplementationOnce(() => 1500)
      await monitor.measureOperation('slow-process', async () => 'done')

      const report = monitor.generateReport()
      
      expect(report).toMatchObject({
        summary: expect.any(Array),
        slowOperations: expect.any(Array),
        totalOperations: 3,
        timeRange: {
          start: expect.any(String),
          end: expect.any(String)
        }
      })

      expect(report.summary).toHaveLength(3)
      expect(report.slowOperations.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle empty metrics in report', () => {
      const report = monitor.generateReport()
      
      expect(report).toMatchObject({
        summary: [],
        slowOperations: [],
        totalOperations: 0,
        timeRange: null
      })
    })
  })

  describe('Global Instance', () => {
    it('should export a global performanceMonitor instance', () => {
      expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor)
      
      // Should be able to use the global instance
      performanceMonitor.measureSync('global-test', () => 'result')
      
      const metrics = performanceMonitor.getMetrics()
      expect(metrics.some(m => m.name === 'global-test')).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle operations that return undefined', async () => {
      const result = await monitor.measureOperation('void-op', async () => {
        // Returns undefined
      })

      expect(result).toBeUndefined()
      expect(monitor.getMetrics()).toHaveLength(1)
    })

    it('should handle very long operation names', () => {
      const longName = 'a'.repeat(1000)
      monitor.measureSync(longName, () => 'result')

      const metrics = monitor.getMetrics()
      expect(metrics[0].name).toBe(longName)
    })

    it('should handle concurrent measurements of the same operation', async () => {
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          monitor.measureOperation('concurrent-op', async () => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100))
            return i
          })
        )
      }

      const results = await Promise.all(promises)
      expect(results).toHaveLength(10)
      
      const metrics = monitor.getMetricsForOperation('concurrent-op')
      expect(metrics).toHaveLength(10)
    })

    it('should handle operations with complex metadata', async () => {
      const complexMetadata = {
        nested: {
          data: {
            array: [1, 2, 3],
            object: { key: 'value' }
          }
        },
        timestamp: Date.now(),
        nullValue: null,
        undefinedValue: undefined
      }

      await monitor.measureOperation('complex-metadata', async () => 'done', complexMetadata)

      const metrics = monitor.getMetrics()
      expect(metrics[0].metadata).toEqual({
        nested: {
          data: {
            array: [1, 2, 3],
            object: { key: 'value' }
          }
        },
        timestamp: expect.any(Number),
        nullValue: null,
        undefinedValue: undefined
      })
    })
  })
})