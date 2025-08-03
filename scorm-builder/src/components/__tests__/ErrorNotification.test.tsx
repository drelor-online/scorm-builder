// Removed unused React import
import { describe, it, expect, act, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent , waitFor } from '../../test/testProviders'
import { 
  ErrorNotification, 
  showError, 
  showWarning, 
  showInfo, 
  showSuccess,
  type ErrorMessage 
} from '../ErrorNotification'

describe('ErrorNotification', () => {
  let messageId = 0
  
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    messageId = 0
    // Mock Date.now to return incrementing values
    vi.spyOn(Date, 'now').mockImplementation(() => ++messageId)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Component rendering', () => {
    it('should render nothing when no errors', () => {
      render(<ErrorNotification />)
      expect(container.firstChild).toBeNull()
    })

    it('should render error messages', () => {
      render(<ErrorNotification />)
      
      act(() => {
        showError('Test error message')
      })

      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    it('should render multiple messages', () => {
      render(<ErrorNotification />)
      
      act(() => {
        showError('Error 1')
        showWarning('Warning 1')
        showInfo('Info 1')
      })

      expect(screen.getByText('Error 1')).toBeInTheDocument()
      expect(screen.getByText('Warning 1')).toBeInTheDocument()
      expect(screen.getByText('Info 1')).toBeInTheDocument()
    })

    it('should render with correct colors for different types', () => {
      render(<ErrorNotification />)
      
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

  describe('Message actions', () => {
    it('should render action button when action is provided', () => {
      const mockAction = vi.fn()
      render(<ErrorNotification />)
      
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
      render(<ErrorNotification />)
      
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
      render(<ErrorNotification />)
      
      act(() => {
        showError('Test error')
      })

      const closeButton = screen.getByText('×')
      fireEvent.click(closeButton)

      expect(screen.queryByText('Test error')).not.toBeInTheDocument()
    })
  })

  describe('Auto-dismiss behavior', () => {
    it('should auto-dismiss info messages after 5 seconds', () => {
      render(<ErrorNotification />)
      
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
      render(<ErrorNotification />)
      
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
      render(<ErrorNotification />)
      
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
      render(<ErrorNotification />)
      
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

  describe('Multiple instances', () => {
    it('should handle multiple component instances', () => {
      const { rerender } = render(
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
      const { unmount } = render(<ErrorNotification />)
      
      unmount()

      // Should not throw when showing error after unmount
      expect(() => {
        act(() => {
          showError('Test error')
        })
      }).not.toThrow()
    })
  })

  describe('Message helpers', () => {
    it('should generate unique IDs for messages', () => {
      const messages: ErrorMessage[] = []
      const TestComponent = () => {
        const [errors, setErrors] = React.useState<ErrorMessage[]>([])
        
        React.useEffect(() => {
          const handler = (error: ErrorMessage) => {
            messages.push(error)
            setErrors(prev => [...prev, error])
          }
          
          // Access the errorHandlers Set through the module
          (window as any).__errorHandler = handler
          return () => {
            delete (window as any).__errorHandler
          }
        }, [])
        
        return null
      }

      render(<TestComponent />)
      render(<ErrorNotification />)

      act(() => {
        showError('Error 1')
        showError('Error 2')
      })

      // Wait for messages to be processed
      waitFor(() => {
        expect(messages.length).toBeGreaterThanOrEqual(2)
        const ids = messages.map(m => m.id)
        const uniqueIds = new Set(ids)
        expect(uniqueIds.size).toBe(ids.length)
      })
    })

    it('should set correct message types', () => {
      render(<ErrorNotification />)

      act(() => {
        showError('Error')
        showWarning('Warning')
        showInfo('Info')
        showSuccess('Success')
      })

      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Warning')).toBeInTheDocument()
      expect(screen.getByText('Info')).toBeInTheDocument()
      expect(screen.getByText('Success')).toBeInTheDocument()
    })
  })

  describe('Animation and styling', () => {
    it('should include animation styles', () => {
      render(<ErrorNotification />)
      
      act(() => {
        showError('Test error')
      })

      const styleElement = container.querySelector('style')
      expect(styleElement?.textContent).toContain('@keyframes slideIn')
      expect(styleElement?.textContent).toContain('translateX(100%)')
      expect(styleElement?.textContent).toContain('translateX(0)')
    })

    it('should apply correct container styles', () => {
      render(<ErrorNotification />)
      
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
  })
})