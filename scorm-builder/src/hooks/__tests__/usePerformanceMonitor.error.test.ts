import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePerformanceMonitor } from '../usePerformanceMonitor'

describe('usePerformanceMonitor - parameter validation', () => {
  it('should throw TypeError when called without options parameter', () => {
    // This test reproduces the error we're seeing in SCORMPackageBuilder
    expect(() => {
      // @ts-expect-error - Testing runtime error when called without required parameter
      renderHook(() => usePerformanceMonitor())
    }).toThrow("Cannot destructure property 'componentName' of 'undefined'")
  })

  it('should work correctly when called with required options', () => {
    const { result } = renderHook(() => 
      usePerformanceMonitor({
        componentName: 'TestComponent'
      })
    )

    expect(result.current).toHaveProperty('measureAsync')
    expect(result.current).toHaveProperty('measureSync')
    expect(result.current).toHaveProperty('startTiming')
    expect(result.current).toHaveProperty('renderCount')
  })

  it('should work with all options provided', () => {
    const { result } = renderHook(() => 
      usePerformanceMonitor({
        componentName: 'TestComponent',
        trackRenders: true,
        trackMountTime: true,
        metadata: { testId: '123' }
      })
    )

    expect(result.current.measureAsync).toBeDefined()
    expect(typeof result.current.measureAsync).toBe('function')
  })
})