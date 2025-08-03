import { describe, it, expect, act, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDebounce } from '../useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500))
    expect(result.current).toBe('initial')
  })

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    expect(result.current).toBe('initial')

    // Change value
    rerender({ value: 'updated', delay: 500 })
    
    // Should still be initial value
    expect(result.current).toBe('initial')

    // Fast forward time
    act(() => {
      vi.advanceTimersByTime(500)
    })

    // Now should be updated
    expect(result.current).toBe('updated')
  })

  it('should cancel previous timeout on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'first', delay: 1000 } }
    )

    // Make multiple rapid changes
    rerender({ value: 'second', delay: 1000 })
    act(() => vi.advanceTimersByTime(500))
    
    rerender({ value: 'third', delay: 1000 })
    act(() => vi.advanceTimersByTime(500))
    
    rerender({ value: 'final', delay: 1000 })
    
    // Should still be initial after 1000ms total (but each change reset the timer)
    expect(result.current).toBe('first')

    // Complete the delay from last change
    act(() => vi.advanceTimersByTime(1000))
    
    // Should now be the final value
    expect(result.current).toBe('final')
  })

  it('should handle different data types', () => {
    // Test with object
    const { result: objectResult } = renderHook(() => 
      useDebounce({ name: 'test', value: 123 }, 100)
    )
    expect(objectResult.current).toEqual({ name: 'test', value: 123 })

    // Test with array
    const { result: arrayResult } = renderHook(() => 
      useDebounce([1, 2, 3], 100)
    )
    expect(arrayResult.current).toEqual([1, 2, 3])

    // Test with number
    const { result: numberResult } = renderHook(() => 
      useDebounce(42, 100)
    )
    expect(numberResult.current).toBe(42)
  })

  it('should handle delay changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 1000 } }
    )

    rerender({ value: 'updated', delay: 500 })
    
    // Advance by new delay
    act(() => vi.advanceTimersByTime(500))
    
    expect(result.current).toBe('updated')
  })

  it('should cleanup timeout on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
    
    const { unmount, rerender } = renderHook(
      ({ value }) => useDebounce(value, 1000),
      { initialProps: { value: 'test' } }
    )

    // Trigger a timeout
    rerender({ value: 'updated' })
    
    // Unmount should clear timeout
    unmount()
    
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })
})