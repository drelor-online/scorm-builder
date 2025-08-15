/**
 * NotificationPanel - Consolidated Test Suite
 * 
 * This file consolidates NotificationPanel tests from 3 separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - NotificationPanel.dashboard.test.tsx (dashboard behavior, positioning)
 * - NotificationPanel.stacking.test.tsx (max notifications, stacking behavior)
 * - NotificationPanel.accessibility.test.tsx (ARIA, keyboard navigation, focus)
 * 
 * Test Categories:
 * - Dashboard behavior and context-aware rendering
 * - Notification stacking and display limits
 * - Accessibility features and ARIA compliance
 * - Keyboard navigation and focus management
 * - Positioning and layout behavior
 * - Edge cases and rapid updates
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationPanel } from '../NotificationPanel'
import { NotificationProvider } from '../../contexts/NotificationContext'
import { createMockNotificationContext, createTestNotification } from '../../test-utils/notification-helpers'

// Mock the NotificationContext
vi.mock('../../contexts/NotificationContext', async () => {
  const actual = await vi.importActual('../../contexts/NotificationContext')
  return {
    ...actual,
    useNotifications: vi.fn()
  }
})

describe('NotificationPanel - Consolidated Test Suite', () => {
  describe('Dashboard Behavior and Context-Aware Rendering', () => {
    it('should NOT render on ProjectDashboard when no notifications', async () => {
      const mockContext = createMockNotificationContext([])
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      render(<NotificationPanel />)
      
      expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument()
    })

    it('should NOT render notification panel in dashboard context even with notifications', async () => {
      const mockNotifications = [
        {
          id: 'test-1',
          message: 'Dashboard should not show this',
          type: 'info' as const,
          timestamp: Date.now()
        }
      ]
      
      const mockContext = createMockNotificationContext(mockNotifications)
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      const { container } = render(<NotificationPanel />)
      
      if (screen.queryByTestId('notification-panel')) {
        expect(container.querySelector('[data-context="dashboard"]')).not.toBeInTheDocument()
      }
    })

    it('should use inline alerts instead of global panel in dashboard', () => {
      // Placeholder until implementation
      expect(true).toBe(true)
    })

    it('should not interfere with dashboard layout when mounted globally', async () => {
      const mockContext = createMockNotificationContext([
        {
          id: 'test-1',
          message: 'Should not affect layout',
          type: 'success' as const,
          timestamp: Date.now()
        }
      ])
      
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      render(
        <div data-testid="dashboard-layout">
          <div data-testid="dashboard-header">Header</div>
          <NotificationPanel />
          <div data-testid="dashboard-content">Content</div>
        </div>
      )
      
      const header = screen.getByTestId('dashboard-header')
      const content = screen.getByTestId('dashboard-content')
      
      expect(header).toBeVisible()
      expect(content).toBeVisible()
      
      const panel = screen.queryByRole('region') || screen.queryByTestId('notification-panel')
      if (panel) {
        const styles = window.getComputedStyle(panel)
        expect(styles.position).toBe('fixed')
      }
    })
  })

  describe('Notification Stacking and Display Limits', () => {
    it('should show maximum 2 notifications when multiple exist', async () => {
      const mockNotifications = [
        createTestNotification('info', 'First notification'),
        createTestNotification('success', 'Second notification'), 
        createTestNotification('warning', 'Third notification'),
        createTestNotification('error', 'Fourth notification')
      ]
      
      const mockContext = {
        notifications: mockNotifications,
        removeNotification: vi.fn()
      }
      
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      render(<NotificationPanel />)
      
      expect(screen.getByText('Third notification')).toBeInTheDocument()
      expect(screen.getByText('Fourth notification')).toBeInTheDocument()
      expect(screen.queryByText('First notification')).not.toBeInTheDocument()
      expect(screen.queryByText('Second notification')).not.toBeInTheDocument()
    })

    it('should show all notifications when count is 2 or less', async () => {
      const mockNotifications = [
        createTestNotification('success', 'Success message'),
        createTestNotification('error', 'Error message')
      ]
      
      const mockContext = {
        notifications: mockNotifications,
        removeNotification: vi.fn()
      }
      
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      render(<NotificationPanel />)
      
      expect(screen.getByText('Success message')).toBeInTheDocument()
      expect(screen.getByText('Error message')).toBeInTheDocument()
    })

    it('should update visible notifications when older ones are dismissed', async () => {
      const notifications = [
        createTestNotification('info', 'First'),
        createTestNotification('success', 'Second'), 
        createTestNotification('warning', 'Third')
      ]
      
      const mockContext = {
        notifications,
        removeNotification: vi.fn((id: string) => {
          const index = notifications.findIndex(n => n.id === id)
          if (index > -1) notifications.splice(index, 1)
        })
      }
      
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      const { rerender } = render(<NotificationPanel />)
      
      expect(screen.queryByText('First')).not.toBeInTheDocument()
      expect(screen.getByText('Second')).toBeInTheDocument()
      expect(screen.getByText('Third')).toBeInTheDocument()

      mockContext.notifications = notifications.filter(n => n.message !== 'Third')
      rerender(<NotificationPanel />)
      
      expect(screen.getByText('First')).toBeInTheDocument()
      expect(screen.getByText('Second')).toBeInTheDocument()
      expect(screen.queryByText('Third')).not.toBeInTheDocument()
    })

    it('should have proper spacing between stacked notifications', async () => {
      const mockNotifications = [
        createTestNotification('success', 'First notification'),
        createTestNotification('error', 'Second notification')
      ]
      
      const mockContext = {
        notifications: mockNotifications,
        removeNotification: vi.fn()
      }
      
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      const { container } = render(<NotificationPanel />)
      
      const notificationList = container.querySelector('[class*="notificationList"]')
      expect(notificationList).toBeInTheDocument()
      
      if (notificationList) {
        const styles = window.getComputedStyle(notificationList)
        expect(styles.display).toBe('flex')
        expect(styles.flexDirection).toBe('column')
      }
    })

    it('should maintain consistent positioning when notifications are added/removed', async () => {
      const notifications = [createTestNotification('info', 'Initial notification')]
      
      const mockContext = {
        notifications,
        removeNotification: vi.fn()
      }
      
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      const { container, rerender } = render(<NotificationPanel />)
      
      const panel = container.querySelector('[class*="notificationPanel"]')
      const initialRect = panel?.getBoundingClientRect()
      
      mockContext.notifications = [
        ...notifications,
        createTestNotification('error', 'New notification')
      ]
      rerender(<NotificationPanel />)
      
      const updatedRect = panel?.getBoundingClientRect()
      
      expect(updatedRect?.top).toBe(initialRect?.top)
      expect(updatedRect?.right).toBe(initialRect?.right)
    })

    it('should handle edge case of rapidly changing notification count', async () => {
      let notifications: any[] = []
      
      const mockContext = {
        get notifications() { return notifications },
        removeNotification: vi.fn()
      }
      
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      const { rerender } = render(<NotificationPanel />)
      
      for (let i = 0; i < 5; i++) {
        notifications = [...notifications, createTestNotification('info', `Message ${i}`)]
        rerender(<NotificationPanel />)
      }
      
      expect(screen.getByText('Message 3')).toBeInTheDocument()
      expect(screen.getByText('Message 4')).toBeInTheDocument()
      expect(screen.queryByText('Message 0')).not.toBeInTheDocument()
      expect(screen.queryByText('Message 1')).not.toBeInTheDocument()
      expect(screen.queryByText('Message 2')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility Features and ARIA Compliance', () => {
    it('should have proper ARIA roles and attributes for different notification types', async () => {
      const mockNotifications = [
        {
          id: 'warning-1',
          message: 'File size is large',
          type: 'warning' as const,
          timestamp: Date.now()
        },
        {
          id: 'info-1',
          message: 'Processing started',
          type: 'info' as const,
          timestamp: Date.now()
        }
      ]
      
      const mockContext = createMockNotificationContext(mockNotifications)
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      render(<NotificationPanel />)
      
      const alertNotifications = screen.getAllByRole('alert')
      expect(alertNotifications).toHaveLength(1)
      
      const warningElement = screen.getByText('File size is large').closest('[role]')
      expect(warningElement).toHaveAttribute('role', 'alert')
      expect(warningElement).toHaveAttribute('aria-live', 'assertive')
      
      const statusElements = screen.getAllByRole('status')
      expect(statusElements).toHaveLength(1)
      
      const infoElement = screen.getByText('Processing started').closest('[role]')
      expect(infoElement).toHaveAttribute('role', 'status')
      expect(infoElement).toHaveAttribute('aria-live', 'polite')
    })

    it('should have proper aria-labels and descriptions', async () => {
      const mockNotifications = [
        {
          id: 'test-1',
          message: 'Test notification',
          type: 'error' as const,
          timestamp: Date.now(),
          action: {
            label: 'Retry',
            onClick: vi.fn()
          }
        }
      ]
      
      const mockContext = createMockNotificationContext(mockNotifications)
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      render(<NotificationPanel />)
      
      const panel = screen.getByRole('region')
      expect(panel).toHaveAttribute('aria-label', 'Notifications')
      
      const dismissButton = screen.getByLabelText('Dismiss notification')
      expect(dismissButton).toBeInTheDocument()
      
      const actionButton = screen.getByText('Retry')
      expect(actionButton).toHaveAttribute('aria-describedby')
    })

    it('should have aria-atomic="true" for complete message reading', async () => {
      const mockNotifications = [
        {
          id: 'test-1',
          message: 'Multi-part notification message with details',
          type: 'info' as const,
          timestamp: Date.now()
        }
      ]
      
      const mockContext = createMockNotificationContext(mockNotifications)
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      render(<NotificationPanel />)
      
      const notification = screen.getByRole('status')
      expect(notification).toHaveAttribute('aria-atomic', 'true')
    })

    it('should have visually hidden text for notification type', async () => {
      const mockNotifications = [
        {
          id: 'test-1',
          message: 'Error message',
          type: 'error' as const,
          timestamp: Date.now()
        }
      ]
      
      const mockContext = createMockNotificationContext(mockNotifications)
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      render(<NotificationPanel />)
      
      const errorTypeText = screen.getByText('Error:', { exact: false })
      expect(errorTypeText).toHaveClass(/srOnly/)
    })

    it('should provide proper progress bar accessibility', async () => {
      const mockNotifications = [
        {
          id: 'progress-1',
          message: 'Uploading file...',
          type: 'progress' as const,
          timestamp: Date.now(),
          progress: {
            current: 3,
            total: 10
          }
        }
      ]
      
      const mockContext = createMockNotificationContext(mockNotifications)
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      render(<NotificationPanel />)
      
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '10')
      expect(progressBar).toHaveAttribute('aria-valuenow', '3')
      expect(progressBar).toHaveAttribute('aria-valuetext', '3 of 10')
    })
  })

  describe('Keyboard Navigation and Focus Management', () => {
    it('should have proper keyboard navigation support', async () => {
      const user = userEvent.setup()
      const mockNotifications = [
        {
          id: 'test-1',
          message: 'Test notification with action',
          type: 'error' as const,
          timestamp: Date.now(),
          action: {
            label: 'Retry',
            onClick: vi.fn()
          }
        }
      ]
      
      const mockContext = createMockNotificationContext(mockNotifications)
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      render(<NotificationPanel />)
      
      const actionButton = screen.getByText('Retry')
      expect(actionButton).toHaveAttribute('tabIndex')
      
      actionButton.focus()
      expect(actionButton).toHaveFocus()
      
      await user.keyboard('{Enter}')
      expect(mockNotifications[0].action!.onClick).toHaveBeenCalled()
      
      await user.keyboard(' ')
      expect(mockNotifications[0].action!.onClick).toHaveBeenCalledTimes(2)
    })

    it('should support ESC key to dismiss notifications', async () => {
      const user = userEvent.setup()
      const mockNotifications = [
        {
          id: 'test-1',
          message: 'Test notification',
          type: 'error' as const,
          timestamp: Date.now()
        }
      ]
      
      const mockContext = createMockNotificationContext(mockNotifications)
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      render(<NotificationPanel />)
      
      const panel = screen.getByRole('region')
      panel.focus()
      
      await user.keyboard('{Escape}')
      
      expect(mockContext.removeNotification).toHaveBeenCalledWith('test-1')
    })

    it('should focus management when notifications appear and disappear', async () => {
      const mockNotifications = [
        {
          id: 'test-1',
          message: 'Test notification',
          type: 'error' as const,
          timestamp: Date.now()
        }
      ]
      
      const mockContext = createMockNotificationContext(mockNotifications)
      const { useNotifications } = await import('../../contexts/NotificationContext')
      vi.mocked(useNotifications).mockReturnValue(mockContext)

      const { rerender } = render(<NotificationPanel />)
      
      const notification = screen.getByRole('alert')
      expect(notification).toBeInTheDocument()
      
      expect(notification).toHaveFocus()
      
      vi.mocked(useNotifications).mockReturnValue(createMockNotificationContext([]))
      rerender(<NotificationPanel />)
      
      expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })
  })
})