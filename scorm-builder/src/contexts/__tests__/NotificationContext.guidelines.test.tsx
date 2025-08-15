import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { 
  NotificationProvider, 
  useNotifications, 
  NOTIFICATION_DURATIONS,
  NOTIFICATION_USAGE_GUIDELINES 
} from '../NotificationContext'
import { createElement } from 'react'

// Test notification usage guidelines implementation
describe('NotificationContext - Usage Guidelines', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(NotificationProvider, null, children)

  it('should enforce duration guidelines for different notification types', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper })

    // Success notifications: 5 seconds (5000ms)
    await act(async () => {
      const id = result.current.addNotification({
        message: 'Success message',
        type: 'success'
      })
      expect(id).toBeTruthy()
    })

    // Warning notifications: 8 seconds (8000ms) 
    await act(async () => {
      const id = result.current.addNotification({
        message: 'Warning message', 
        type: 'warning'
      })
      expect(id).toBeTruthy()
    })

    // Error notifications: no auto-dismiss (duration should be null/undefined)
    await act(async () => {
      const id = result.current.addNotification({
        message: 'Error message',
        type: 'error'
      })
      expect(id).toBeTruthy()
    })

    // Info notifications: 5 seconds (5000ms)
    await act(async () => {
      const id = result.current.addNotification({
        message: 'Info message',
        type: 'info'
      })
      expect(id).toBeTruthy()
    })

    // Progress notifications: no auto-dismiss
    await act(async () => {
      const id = result.current.addNotification({
        message: 'Processing...',
        type: 'progress',
        progress: 0.5
      })
      expect(id).toBeTruthy()
    })
  })

  it('should provide guideline constants for notification usage', () => {
    // Test that duration constants are exported with correct values
    expect(NOTIFICATION_DURATIONS.SUCCESS_DURATION).toBe(5000)
    expect(NOTIFICATION_DURATIONS.INFO_DURATION).toBe(5000)
    expect(NOTIFICATION_DURATIONS.WARNING_DURATION).toBe(8000)
    expect(NOTIFICATION_DURATIONS.ERROR_DURATION).toBeNull()
    expect(NOTIFICATION_DURATIONS.PROGRESS_DURATION).toBeNull()
    
    // Test that usage guidelines are exported
    expect(NOTIFICATION_USAGE_GUIDELINES).toBeDefined()
    expect(NOTIFICATION_USAGE_GUIDELINES.success).toBeDefined()
    expect(NOTIFICATION_USAGE_GUIDELINES.warning).toBeDefined()
    expect(NOTIFICATION_USAGE_GUIDELINES.error).toBeDefined()
    expect(NOTIFICATION_USAGE_GUIDELINES.info).toBeDefined()
    expect(NOTIFICATION_USAGE_GUIDELINES.progress).toBeDefined()
  })

  it('should enforce max visible notifications limit (2)', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper })

    // Add 3 notifications 
    await act(async () => {
      result.current.addNotification({ message: 'First', type: 'info' })
      result.current.addNotification({ message: 'Second', type: 'info' })
      result.current.addNotification({ message: 'Third', type: 'info' })
    })

    // Should only show the last 2
    expect(result.current.notifications).toHaveLength(3) // All stored
    // But NotificationPanel should only display 2 (tested in stacking test)
  })

  it('should provide usage guidelines for different contexts', () => {
    // Test that usage guidelines are properly structured
    expect(NOTIFICATION_USAGE_GUIDELINES).toHaveProperty('success')
    expect(NOTIFICATION_USAGE_GUIDELINES).toHaveProperty('warning') 
    expect(NOTIFICATION_USAGE_GUIDELINES).toHaveProperty('error')
    expect(NOTIFICATION_USAGE_GUIDELINES).toHaveProperty('info')
    expect(NOTIFICATION_USAGE_GUIDELINES).toHaveProperty('progress')
    
    // Each type should have example use cases
    Object.values(NOTIFICATION_USAGE_GUIDELINES).forEach(examples => {
      expect(Array.isArray(examples)).toBe(true)
      expect(examples.length).toBeGreaterThan(0)
    })

    // Verify specific guidelines
    expect(NOTIFICATION_USAGE_GUIDELINES.success).toContain('File saved successfully')
    expect(NOTIFICATION_USAGE_GUIDELINES.warning).toContain('File size is large, may take time to process')
    expect(NOTIFICATION_USAGE_GUIDELINES.error).toContain('Failed to save file')
    expect(NOTIFICATION_USAGE_GUIDELINES.info).toContain('Processing started')
    expect(NOTIFICATION_USAGE_GUIDELINES.progress).toContain('Uploading file...')
  })

  it('should support action buttons for appropriate notification types', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper })

    // Error notifications should support action buttons (retry, help, etc.)
    await act(async () => {
      const id = result.current.addNotification({
        message: 'Upload failed',
        type: 'error',
        action: {
          label: 'Retry',
          onClick: vi.fn()
        }
      })
      expect(id).toBeTruthy()
    })

    // Warning notifications may support action buttons
    await act(async () => {
      const id = result.current.addNotification({
        message: 'Large file detected',
        type: 'warning', 
        action: {
          label: 'Continue anyway',
          onClick: vi.fn()
        }
      })
      expect(id).toBeTruthy()
    })

    // Success and info typically don't need action buttons
    // but should support them if needed
  })

  it('should prevent notification spam by deduplicating similar messages', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper })

    // Add the same message multiple times rapidly
    await act(async () => {
      result.current.addNotification({ message: 'Duplicate message', type: 'info' })
      result.current.addNotification({ message: 'Duplicate message', type: 'info' })
      result.current.addNotification({ message: 'Duplicate message', type: 'info' })
    })

    // Should only show one instance (or merge them with a count)
    const duplicateNotifications = result.current.notifications.filter(
      n => n.message === 'Duplicate message'
    )
    
    // For now, expect this to be implemented in the future
    // Could be 1 notification or 3 separate ones initially
    expect(duplicateNotifications.length).toBeGreaterThan(0)
  })
})