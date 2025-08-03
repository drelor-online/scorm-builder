import { renderHook } from '../../test/testProviders'
import { describe, it, expect, act, vi, beforeEach, afterEach } from 'vitest'
import { useNetworkStatus } from './useNetworkStatus'

describe('useNetworkStatus', () => {
  let mockNavigatorOnLine: boolean
  const originalNavigator = window.navigator

  beforeEach(() => {
    mockNavigatorOnLine = true
    
    // Mock navigator.onLine
    Object.defineProperty(window, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        ...originalNavigator,
        get onLine() {
          return mockNavigatorOnLine
        }
      }
    })
  })

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(window, 'navigator', {
      configurable: true,
      writable: true,
      value: originalNavigator
    })
    vi.restoreAllMocks()
  })

  it('should return initial online status', () => {
    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current.isOnline).toBe(true)
  })

  it('should return initial offline status', () => {
    mockNavigatorOnLine = false
    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current.isOnline).toBe(false)
  })

  it('should update status when going offline', () => {
    const { result } = renderHook(() => useNetworkStatus())
    
    expect(result.current.isOnline).toBe(true)

    // Simulate going offline
    act(() => {
      mockNavigatorOnLine = false
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.isOnline).toBe(false)
  })

  it('should update status when going online', () => {
    mockNavigatorOnLine = false
    const { result } = renderHook(() => useNetworkStatus())
    
    expect(result.current.isOnline).toBe(false)

    // Simulate going online
    act(() => {
      mockNavigatorOnLine = true
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current.isOnline).toBe(true)
  })

  it('should return last online time when going offline', () => {
    vi.useFakeTimers()
    const mockDate = new Date('2024-01-01T12:00:00Z')
    vi.setSystemTime(mockDate)

    const { result } = renderHook(() => useNetworkStatus())
    
    // Initially online, no lastOnline time
    expect(result.current.lastOnline).toBeNull()

    // Go offline
    act(() => {
      mockNavigatorOnLine = false
      window.dispatchEvent(new Event('offline'))
    })

    // Should have lastOnline time
    expect(result.current.lastOnline).toEqual(mockDate)

    vi.useRealTimers()
  })

  it('should clear lastOnline when going back online', () => {
    vi.useFakeTimers()
    const mockDate = new Date('2024-01-01T12:00:00Z')
    vi.setSystemTime(mockDate)

    mockNavigatorOnLine = false
    const { result } = renderHook(() => useNetworkStatus())

    // Initially offline
    expect(result.current.isOnline).toBe(false)

    // Go online
    act(() => {
      mockNavigatorOnLine = true
      window.dispatchEvent(new Event('online'))
    })

    // Should clear lastOnline
    expect(result.current.lastOnline).toBeNull()

    vi.useRealTimers()
  })

  it('should clean up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    
    const { unmount } = renderHook(() => useNetworkStatus())
    
    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
  })
})