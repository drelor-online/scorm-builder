import { useEffect, useRef, useCallback } from 'react'
import { performanceMonitor } from '../utils/performanceMonitor'

interface UsePerformanceMonitorOptions {
  componentName: string
  trackRenders?: boolean
  trackMountTime?: boolean
  metadata?: Record<string, any>
}

export function usePerformanceMonitor({
  componentName,
  trackRenders = true,
  trackMountTime = true,
  metadata = {}
}: UsePerformanceMonitorOptions) {
  const renderCount = useRef(0)
  const isMounted = useRef(false)

  // Track component mount time
  useEffect(() => {
    if (trackMountTime && !isMounted.current) {
      const start = performance.now()
      isMounted.current = true
      
      return () => {
        const duration = performance.now() - start
        performanceMonitor.recordMetric({
          name: `${componentName}.mount`,
          duration,
          memoryDelta: 0,
          timestamp: new Date().toISOString(),
          metadata: {
            ...metadata,
            type: 'component-mount'
          }
        })
      }
    }
  }, [componentName, trackMountTime, metadata])

  // Track renders
  useEffect(() => {
    if (trackRenders) {
      renderCount.current++
      
      // Skip the first render (mount)
      if (renderCount.current > 1) {
        performanceMonitor.recordMetric({
          name: `${componentName}.render`,
          duration: 0, // Render tracking doesn't measure duration
          memoryDelta: 0,
          timestamp: new Date().toISOString(),
          metadata: {
            ...metadata,
            renderCount: renderCount.current,
            type: 'component-render'
          }
        })
      }
    }
  }, [trackRenders, componentName, metadata])

  // Measure async operations
  const measureAsync = useCallback(
    async <T,>(operationName: string, operation: () => Promise<T>): Promise<T> => {
      return performanceMonitor.measureOperation(
        `${componentName}.${operationName}`,
        operation,
        metadata
      )
    },
    [componentName, metadata]
  )

  // Measure sync operations
  const measureSync = useCallback(
    <T,>(operationName: string, operation: () => T): T => {
      return performanceMonitor.measureSync(
        `${componentName}.${operationName}`,
        operation,
        metadata
      )
    },
    [componentName, metadata]
  )

  // Start a manual timing
  const startTiming = useCallback(
    (operationName: string) => {
      return performanceMonitor.startTiming(`${componentName}.${operationName}`)
    },
    [componentName]
  )

  return {
    measureAsync,
    measureSync,
    startTiming,
    renderCount: renderCount.current
  }
}

// Hook to get performance metrics
export function usePerformanceMetrics() {
  const getMetrics = useCallback(() => {
    return performanceMonitor.getMetrics()
  }, [])

  const getSummary = useCallback(() => {
    return performanceMonitor.getSummary()
  }, [])

  const getSlowOperations = useCallback((threshold?: number) => {
    return performanceMonitor.getSlowOperations(threshold)
  }, [])

  const generateReport = useCallback(() => {
    return performanceMonitor.generateReport()
  }, [])

  const clearMetrics = useCallback(() => {
    performanceMonitor.clearMetrics()
  }, [])

  return {
    getMetrics,
    getSummary,
    getSlowOperations,
    generateReport,
    clearMetrics
  }
}