import { vi, Mock } from 'vitest'
import { ReactNode } from 'react'
import { createElement } from 'react'

export interface MockNotificationContext {
  notifications: Array<{
    id: string
    message: string
    type: 'success' | 'error' | 'warning' | 'info' | 'progress'
    duration?: number
    action?: { label: string; onClick: () => void }
    timestamp: number
  }>
  addNotification: Mock
  removeNotification: Mock
  clearAll: Mock
  success: Mock
  error: Mock
  warning: Mock
  info: Mock
  progress: Mock
}

export function createMockNotificationContext(
  initialNotifications: any[] = []
): MockNotificationContext {
  return {
    notifications: initialNotifications,
    addNotification: vi.fn().mockReturnValue('mock-id'),
    removeNotification: vi.fn(),
    clearAll: vi.fn(),
    success: vi.fn(),
    error: vi.fn(), 
    warning: vi.fn(),
    info: vi.fn(),
    progress: vi.fn().mockReturnValue('progress-id')
  }
}

export function createTestNotification(
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
  message: string = 'Test notification',
  duration?: number
) {
  return {
    id: `test-${Math.random().toString(36).substr(2, 9)}`,
    message,
    type,
    duration,
    timestamp: Date.now()
  }
}

export function expectNotificationToHaveDuration(
  notificationCall: any,
  expectedDuration: number
) {
  expect(notificationCall).toHaveBeenCalledWith(
    expect.any(String),
    expectedDuration
  )
}

export function expectMaxNotifications(
  notifications: any[],
  maxCount: number
) {
  expect(notifications.length).toBeLessThanOrEqual(maxCount)
}

// Mock NotificationProvider for tests
export const MockNotificationProvider = ({ 
  children, 
  mockContext 
}: { 
  children: ReactNode
  mockContext: MockNotificationContext 
}) => {
  // In real implementation, this would use React.createContext
  // For tests, we just render children and make context available
  return createElement('div', { 'data-testid': 'mock-notification-provider' }, children)
}

// Helper to simulate notification lifecycle
export function simulateNotificationLifecycle(
  mockContext: MockNotificationContext,
  type: 'success' | 'error' | 'warning' | 'info',
  message: string,
  shouldAutoDismiss: boolean = true
) {
  const notification = createTestNotification(type, message)
  
  // Simulate adding notification
  mockContext.notifications.push(notification)
  mockContext[type](message)
  
  // Simulate auto-dismiss for appropriate types
  if (shouldAutoDismiss && type !== 'error') {
    setTimeout(() => {
      const index = mockContext.notifications.findIndex(n => n.id === notification.id)
      if (index > -1) {
        mockContext.notifications.splice(index, 1)
        mockContext.removeNotification(notification.id)
      }
    }, notification.duration || 5000)
  }
  
  return notification
}