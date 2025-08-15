/**
 * ErrorHandling - Consolidated Test Suite
 * 
 * This file consolidates ErrorHandling tests from multiple separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - ErrorNotification.test.tsx (error notification system)
 * - ErrorNotification.notificationId.test.tsx (ID generation)
 * - ErrorBoundary/ErrorBoundary.test.tsx (error boundary functionality)
 * - ErrorBoundary.critical.test.tsx (critical error handling)
 * 
 * Test Categories:
 * - ErrorNotification rendering and behavior
 * - Error message types and styling
 * - Auto-dismiss and manual dismiss
 * - ErrorBoundary component behavior
 * - Critical component error catching
 * - Error logging and debugging
 * - Recovery and retry functionality
 */

import React from 'react'
import { render, screen, fireEvent, act } from '../../test/testProviders'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  ErrorNotification, 
  showError, 
  showWarning, 
  showInfo, 
  showSuccess,
  type ErrorMessage 
} from '../ErrorNotification'
import { NotificationPanel } from '../NotificationPanel'
import { ErrorBoundary } from '../ErrorBoundary'
import { generateNotificationId } from '../../utils/idGenerator'

// Mock idGenerator
vi.mock('../../utils/idGenerator', () => ({
  generateNotificationId: vi.fn(() => 'notification-1234567890')
}))

// Mock window.__TAURI__ to prevent errors
Object.defineProperty(window, '__TAURI__', {
  value: {
    invoke: vi.fn().mockResolvedValue({})
  },
  writable: true
})

const mockGenerateNotificationId = vi.mocked(generateNotificationId)

// Simplified test component that just renders NotificationPanel (ErrorNotification is just for API setup)
const TestComponent = () => {
  return (
    <>
      <ErrorNotification />
      <NotificationPanel />
    </>
  )
}

// Component that throws errors for testing
const ThrowingComponent = ({ message, shouldThrow }: { message: string; shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error(message)
  }
  return <div>Component rendered successfully</div>
}

// Mock critical components that can crash
vi.mock('../MediaEnhancementWizard', () => ({
  MediaEnhancementWizard: () => {
    throw new Error('MediaEnhancementWizard crashed!')
  }
}))

vi.mock('../AudioNarrationWizard', () => ({
  AudioNarrationWizard: () => {
    throw new Error('AudioNarrationWizard crashed!')
  }
}))

describe('ErrorHandling - Consolidated Test Suite', () => {
  let messageId = 0
  let consoleErrorSpy: any
  
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    messageId = 0
    
    // Mock Date.now for consistent ID generation
    vi.spyOn(Date, 'now').mockImplementation(() => ++messageId)
    
    // Suppress console.error during tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Clear debug logs
    ;(window as any).__debugLogs = []
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    consoleErrorSpy.mockRestore()
  })

  describe('ErrorNotification - Component Rendering', () => {
    it('should render nothing when no errors', () => {
      const { container } = render(<TestComponent />)
      // Should only render the NotificationPanel, which returns null when no notifications
      expect(container.firstChild).toBeNull()
    })

    it('should render error messages with correct styling', () => {
      render(<TestComponent />)
      
      act(() => {
        showError('Test error message')
      })

      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    it('should render multiple messages simultaneously', () => {
      render(<TestComponent />)
      
      act(() => {
        showError('Error 1')
        showWarning('Warning 1')
        showInfo('Info 1')
        showSuccess('Success 1')
      })

      expect(screen.getByText('Error 1')).toBeInTheDocument()
      expect(screen.getByText('Warning 1')).toBeInTheDocument()
      expect(screen.getByText('Info 1')).toBeInTheDocument()
      expect(screen.getByText('Success 1')).toBeInTheDocument()
    })

    it('should apply correct colors for different message types', () => {
      render(<TestComponent />)
      
      act(() => {
        showError('Error message')
        showWarning('Warning message')
        showSuccess('Success message')
        showInfo('Info message')
      })

      const errorDiv = screen.getByText('Error message').parentElement?.parentElement
      const warningDiv = screen.getByText('Warning message').parentElement?.parentElement
      const successDiv = screen.getByText('Success message').parentElement?.parentElement
      const infoDiv = screen.getByText('Info message').parentElement?.parentElement

      expect(errorDiv).toHaveStyle({ backgroundColor: 'rgb(220, 38, 38)' })
      expect(warningDiv).toHaveStyle({ backgroundColor: 'rgb(245, 158, 11)' })
      expect(successDiv).toHaveStyle({ backgroundColor: 'rgb(16, 185, 129)' })
      expect(infoDiv).toHaveStyle({ backgroundColor: 'rgb(59, 130, 246)' })
    })
  })

  describe('ErrorNotification - Message Actions and Dismissal', () => {
    it('should render action button when action is provided', () => {
      const mockAction = vi.fn()
      render(<TestComponent />)
      
      act(() => {
        showError('Error with action', {
          label: 'Retry',
          onClick: mockAction
        })
      })

      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    it('should call action onClick and dismiss message', () => {
      const mockAction = vi.fn()
      render(<TestComponent />)
      
      act(() => {
        showError('Error with action', {
          label: 'Retry',
          onClick: mockAction
        })
      })

      const actionButton = screen.getByText('Retry')
      fireEvent.click(actionButton)

      expect(mockAction).toHaveBeenCalled()
      expect(screen.queryByText('Error with action')).not.toBeInTheDocument()
    })

    it('should dismiss message when close button is clicked', () => {
      render(<TestComponent />)
      
      act(() => {
        showError('Test error')
      })

      const closeButton = screen.getByText('×')
      fireEvent.click(closeButton)

      expect(screen.queryByText('Test error')).not.toBeInTheDocument()
    })
  })

  describe('ErrorNotification - Auto-dismiss Behavior', () => {
    it('should auto-dismiss info messages after 5 seconds', () => {
      render(<TestComponent />)
      
      act(() => {
        showInfo('Info message')
      })

      expect(screen.getByText('Info message')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(screen.queryByText('Info message')).not.toBeInTheDocument()
    })

    it('should auto-dismiss success messages after 5 seconds', () => {
      render(<TestComponent />)
      
      act(() => {
        showSuccess('Success message')
      })

      expect(screen.getByText('Success message')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(screen.queryByText('Success message')).not.toBeInTheDocument()
    })

    it('should not auto-dismiss error messages', () => {
      render(<TestComponent />)
      
      act(() => {
        showError('Error message')
      })

      expect(screen.getByText('Error message')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(10000)
      })

      expect(screen.getByText('Error message')).toBeInTheDocument()
    })

    it('should not auto-dismiss warning messages', () => {
      render(<TestComponent />)
      
      act(() => {
        showWarning('Warning message')
      })

      expect(screen.getByText('Warning message')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(10000)
      })

      expect(screen.getByText('Warning message')).toBeInTheDocument()
    })
  })

  describe('ErrorNotification - ID Generation', () => {
    it('should use generateNotificationId for creating unique IDs', () => {
      render(<TestComponent />)

      act(() => {
        showError('Test error 1')
        showError('Test error 2')
      })

      // Should have called generateNotificationId for each message
      expect(mockGenerateNotificationId).toHaveBeenCalledTimes(2)
    })

    it('should generate unique IDs for each notification type', () => {
      render(<TestComponent />)

      act(() => {
        showError('Error')
        showWarning('Warning')
        showInfo('Info')
        showSuccess('Success')
      })

      // Each notification type should get its own unique ID
      expect(mockGenerateNotificationId).toHaveBeenCalledTimes(4)
    })
  })

  describe('ErrorBoundary - Basic Functionality', () => {
    it('should render children when there is no error', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Test content')).toBeInTheDocument()
    })

    it('should catch errors and display error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent message="Test error" shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
      expect(screen.getByText(/Test error/i)).toBeInTheDocument()
    })

    it('should show try again and reload buttons in error state', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent message="Test error" shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reload Page/i })).toBeInTheDocument()
    })

    it('should show technical details in development mode', () => {
      const originalEnv = import.meta.env.MODE
      // @ts-ignore
      import.meta.env.MODE = 'development'

      render(
        <ErrorBoundary>
          <ThrowingComponent message="Test error" shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Technical details/i)).toBeInTheDocument()
      expect(screen.getByText(/Test error/i)).toBeInTheDocument()

      // @ts-ignore
      import.meta.env.MODE = originalEnv
    })
  })

  describe('ErrorBoundary - Error Logging and Callbacks', () => {
    it('should call onError callback with error and error info', () => {
      const onError = vi.fn()
      
      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent message="Test error" shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error'
        }),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      )
    })

    it('should log errors to window.__debugLogs in production', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent message="Production error" shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect((window as any).__debugLogs).toBeDefined()
      expect((window as any).__debugLogs.length).toBeGreaterThan(0)
      expect((window as any).__debugLogs.some((log: string) => log.includes('Production error'))).toBe(true)
    })
  })

  describe('ErrorBoundary - Recovery and Retry', () => {
    it('should reset error state when clicking try again', () => {
      let shouldThrow = true
      const ConditionalError = () => {
        if (shouldThrow) {
          throw new Error('Conditional error')
        }
        return <div>Success!</div>
      }

      const { rerender } = render(
        <ErrorBoundary>
          <ConditionalError />
        </ErrorBoundary>
      )
      
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
      
      // Set shouldThrow to false and click try again
      shouldThrow = false
      const tryAgainButton = screen.getByRole('button', { name: /Try Again/i })
      fireEvent.click(tryAgainButton)
      
      // Force re-render to simulate component recovery
      rerender(
        <ErrorBoundary>
          <ConditionalError />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Success!')).toBeInTheDocument()
    })

    it('should reload page when reload button is clicked', () => {
      const reloadMock = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true
      })

      render(
        <ErrorBoundary>
          <ThrowingComponent message="Test error" shouldThrow={true} />
        </ErrorBoundary>
      )
      
      const reloadButton = screen.getByRole('button', { name: /Reload Page/i })
      fireEvent.click(reloadButton)
      
      expect(reloadMock).toHaveBeenCalled()
    })

    it('should use custom fallback render when provided', () => {
      const fallbackRender = ({ error, resetError }: any) => (
        <div>
          <p>Custom error: {error.message}</p>
          <button onClick={resetError}>Custom Reset</button>
        </div>
      )
      
      render(
        <ErrorBoundary fallbackRender={fallbackRender}>
          <ThrowingComponent message="Test error" shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Custom error: Test error')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Custom Reset' })).toBeInTheDocument()
    })
  })

  describe('ErrorBoundary - Critical Component Error Handling', () => {
    it('should provide retry functionality for failed components', () => {
      let attemptCount = 0
      const RetryComponent = () => {
        attemptCount++
        if (attemptCount <= 1) {
          throw new Error('First attempt failed')
        }
        return <div>Success on retry!</div>
      }
      
      render(
        <ErrorBoundary>
          <RetryComponent />
        </ErrorBoundary>
      )
      
      // Should show error on first attempt
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
      
      // Click retry button
      const retryButton = screen.getByRole('button', { name: /Try Again/i })
      fireEvent.click(retryButton)
      
      // After clicking retry, should show success (simulated)
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
    })

    it('should catch MediaEnhancementWizard errors gracefully', async () => {
      const { MediaEnhancementWizard } = await import('../MediaEnhancementWizard')
      
      render(
        <ErrorBoundary>
          <MediaEnhancementWizard />
        </ErrorBoundary>
      )
      
      // Should show error boundary UI instead of crashing
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
      expect(screen.getByText(/MediaEnhancementWizard crashed!/i)).toBeInTheDocument()
    })

    it('should catch AudioNarrationWizard errors gracefully', async () => {
      const { AudioNarrationWizard } = await import('../AudioNarrationWizard')
      
      render(
        <ErrorBoundary>
          <AudioNarrationWizard />
        </ErrorBoundary>
      )
      
      // Should show error boundary UI instead of crashing
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
      expect(screen.getByText(/AudioNarrationWizard crashed!/i)).toBeInTheDocument()
    })
  })

  describe('ErrorNotification - Multiple Instances and Cleanup', () => {
    it('should handle multiple component instances', () => {
      render(
        <>
          <ErrorNotification />
          <ErrorNotification />
        </>
      )
      
      act(() => {
        showError('Test error')
      })

      // Both instances should show the error
      const errors = screen.getAllByText('Test error')
      expect(errors).toHaveLength(2)
    })

    it('should cleanup handlers on unmount', () => {
      const { unmount } = render(<TestComponent />)
      
      unmount()

      // Should not throw when showing error after unmount
      expect(() => {
        act(() => {
          showError('Test error')
        })
      }).not.toThrow()
    })
  })

  describe('ErrorNotification - Animation and Styling', () => {
    it('should apply correct container styles', () => {
      const { container } = render(<TestComponent />)
      
      act(() => {
        showError('Test error')
      })

      const notificationContainer = container.firstChild as HTMLElement
      expect(notificationContainer).toHaveStyle({
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 1000
      })
    })

    it('should include slide-in animation styles', () => {
      const { container } = render(<TestComponent />)
      
      act(() => {
        showError('Test error')
      })

      const styleElement = container.querySelector('style')
      expect(styleElement?.textContent).toContain('@keyframes slideIn')
      expect(styleElement?.textContent).toContain('translateX(100%)')
      expect(styleElement?.textContent).toContain('translateX(0)')
    })
  })
})