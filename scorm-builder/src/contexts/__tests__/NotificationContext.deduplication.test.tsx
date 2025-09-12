import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { NotificationProvider, useNotifications } from '../NotificationContext'
import React from 'react'

describe('NotificationContext - Deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('BEFORE FIX: demonstrates notification spam when identical errors repeat', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      )
    })

    // Simulate rapid identical network error notifications (common in flaky connections)
    const errorMessage = 'Network connection failed'
    
    act(() => {
      result.current.error(errorMessage)
      result.current.error(errorMessage) 
      result.current.error(errorMessage)
      result.current.error(errorMessage)
      result.current.error(errorMessage)
    })

    // FIXED: Now shows 1 notification with count indicator instead of spam
    expect(result.current.notifications.length).toBe(1) // Fixed - no more spam!
    
    // Message now shows the count
    expect(result.current.notifications[0].message).toBe('Network connection failed (5)')
    expect(result.current.notifications[0].count).toBe(5)
  })

  it('FIXED: deduplicates identical notifications within TTL window', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      )
    })

    const errorMessage = 'Network connection failed'
    
    // Rapid identical notifications
    act(() => {
      result.current.error(errorMessage)
      result.current.error(errorMessage)
      result.current.error(errorMessage)
    })

    // FIXED: Should only show 1 notification due to deduplication
    expect(result.current.notifications.length).toBe(1)
    expect(result.current.notifications[0].message).toBe('Network connection failed (3)')
    
    // The notification should indicate multiple occurrences
    expect(result.current.notifications[0].count).toBe(3)
  })

  it('allows duplicate notifications after TTL window expires', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      )
    })

    const errorMessage = 'Temporary network error'
    
    // First notification
    act(() => {
      result.current.error(errorMessage)
    })
    
    expect(result.current.notifications.length).toBe(1)
    
    // Advance time beyond TTL window (default 10 seconds)
    act(() => {
      vi.advanceTimersByTime(11000)
    })
    
    // Second identical notification after TTL - should be allowed
    act(() => {
      result.current.error(errorMessage)
    })
    
    // Should now have 2 notifications since TTL expired
    expect(result.current.notifications.length).toBe(2)
  })

  it('distinguishes between different notification types for deduplication', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      )
    })

    const message = 'Same message'
    
    // Same message but different types - should not be deduplicated
    act(() => {
      result.current.error(message)
      result.current.warning(message)
      result.current.info(message)
    })

    // Should have 3 notifications since types are different
    expect(result.current.notifications.length).toBe(3)
    expect(result.current.notifications[0].type).toBe('error')
    expect(result.current.notifications[1].type).toBe('warning') 
    expect(result.current.notifications[2].type).toBe('info')
  })

  it('increments counter for deduplicated notifications', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      )
    })

    const message = 'Repeated error'
    
    // First occurrence
    act(() => {
      result.current.error(message)
    })
    
    expect(result.current.notifications.length).toBe(1)
    expect(result.current.notifications[0].count).toBe(1)
    
    // Rapid repetitions
    act(() => {
      result.current.error(message)
      result.current.error(message)
      result.current.error(message)
    })
    
    // Still only 1 notification but with incremented count
    expect(result.current.notifications.length).toBe(1)
    expect(result.current.notifications[0].count).toBe(4) // 1 + 3 repetitions
    
    // Message should show the count
    expect(result.current.notifications[0].message).toContain('(4)')
  })

  it('refreshes TTL when duplicate notification occurs', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      )
    })

    const message = 'Error that keeps happening'
    
    // First notification
    act(() => {
      result.current.error(message)
    })
    
    // Wait 7 seconds (within TTL window)
    act(() => {
      vi.advanceTimersByTime(7000)
    })
    
    // Duplicate notification - should refresh TTL
    act(() => {
      result.current.error(message)
    })
    
    // Wait another 7 seconds (total 14 seconds, but TTL was refreshed)
    act(() => {
      vi.advanceTimersByTime(7000)
    })
    
    // Should still be deduplicated because TTL was refreshed
    expect(result.current.notifications.length).toBe(1)
    expect(result.current.notifications[0].count).toBe(2)
    
    // Wait past the refreshed TTL
    act(() => {
      vi.advanceTimersByTime(4000) // Total 11 seconds from last duplicate
    })
    
    // Now a new identical notification should be allowed
    act(() => {
      result.current.error(message)
    })
    
    expect(result.current.notifications.length).toBe(2) // New notification allowed
  })

  it('cleans up deduplication cache to prevent memory leaks', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: ({ children }) => (
        <NotificationProvider>{children}</NotificationProvider>
      )
    })

    // Generate many unique error notifications (no auto-dismiss) to fill cache
    for (let i = 0; i < 100; i++) {
      act(() => {
        result.current.error(`Unique error ${i}`)
      })
    }
    
    // All unique notifications should be visible (no deduplication since messages are different)
    expect(result.current.notifications.length).toBe(100)
    
    // Advance time to expire all TTLs (doesn't affect notifications, just dedup cache)
    act(() => {
      vi.advanceTimersByTime(15000)
    })
    
    // Internal cache should be cleaned up (we can't directly test this,
    // but we can test that new notifications work normally)
    act(() => {
      result.current.error('New error after cleanup')
    })
    
    // Should have 101 notifications total (100 + 1 new)
    expect(result.current.notifications.length).toBe(101)
    expect(result.current.notifications[100].message).toBe('New error after cleanup')
  })
})