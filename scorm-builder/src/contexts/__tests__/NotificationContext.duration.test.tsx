import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ReactNode } from 'react'
import { NotificationProvider, useNotifications } from '../NotificationContext'

// Mock the ID generator
vi.mock('../../utils/idGenerator', () => ({
  generateNotificationId: vi.fn(() => `test-id-${Math.random()}`)
}))

// Wrapper component for testing
const wrapper = ({ children }: { children: ReactNode }) => (
  <NotificationProvider>{children}</NotificationProvider>
)

describe('NotificationContext - Duration Management', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should use correct default durations for each notification type', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper })

    // Test success notification (should have 4-5 second default)
    act(() => {
      result.current.success('Success message')
    })
    
    expect(result.current.notifications).toHaveLength(1)
    const successNotification = result.current.notifications[0]
    expect(successNotification.type).toBe('success')
    expect(successNotification.message).toBe('Success message')
    
    // Should auto-dismiss after 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    
    expect(result.current.notifications).toHaveLength(0)
  })

  it('should use 5-second duration for info notifications', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper })

    act(() => {
      result.current.info('Info message')
    })

    expect(result.current.notifications).toHaveLength(1)
    
    // Should still be there after 4 seconds
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(result.current.notifications).toHaveLength(1)

    // Should be gone after 5 seconds
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.notifications).toHaveLength(0)
  })

  it('should use 5-second duration for warning notifications', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper })

    act(() => {
      result.current.warning('Warning message')
    })

    expect(result.current.notifications).toHaveLength(1)
    
    // Should auto-dismiss after 5 seconds (current implementation)
    // TODO: Change to 8 seconds in implementation
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    
    expect(result.current.notifications).toHaveLength(0)
  })

  it('should NOT auto-dismiss error notifications', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper })

    act(() => {
      result.current.error('Error message')
    })

    expect(result.current.notifications).toHaveLength(1)
    
    // Should still be there after 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(result.current.notifications).toHaveLength(1)
    
    const errorNotification = result.current.notifications[0]
    expect(errorNotification.type).toBe('error')
    expect(errorNotification.duration).toBeUndefined()
  })

  it('should allow manual dismissal of all notification types', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper })

    // Add notifications of each type
    act(() => {
      result.current.success('Success')
      result.current.error('Error')  
      result.current.warning('Warning')
      result.current.info('Info')
    })

    expect(result.current.notifications).toHaveLength(4)

    // Manually remove each one
    act(() => {
      result.current.notifications.forEach(notification => {
        result.current.removeNotification(notification.id)
      })
    })

    expect(result.current.notifications).toHaveLength(0)
  })

  it('should clear all timers when clearAll is called', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper })

    act(() => {
      result.current.success('Success 1')
      result.current.info('Info 1') 
      result.current.warning('Warning 1')
    })

    expect(result.current.notifications).toHaveLength(3)

    // Clear all notifications
    act(() => {
      result.current.clearAll()
    })

    expect(result.current.notifications).toHaveLength(0)

    // Advance time - nothing should happen since timers were cleared
    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(result.current.notifications).toHaveLength(0)
  })

  it('should handle rapid successive notifications without memory leaks', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper })

    // Add many notifications rapidly
    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.success(`Message ${i}`)
      }
    })

    expect(result.current.notifications).toHaveLength(10)

    // Auto-dismiss should work for all
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.notifications).toHaveLength(0)
  })

  it('should allow overriding default duration', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper })

    // Override success duration to 2 seconds
    act(() => {
      result.current.success('Quick success', 2000)
    })

    expect(result.current.notifications).toHaveLength(1)

    // Should dismiss after 2 seconds, not 5
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.notifications).toHaveLength(0)
  })
})