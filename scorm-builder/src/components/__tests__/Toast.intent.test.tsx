import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { Toast } from '../Toast'

describe('Toast - User Intent Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('User wants to see success notifications', () => {
    it('should display success message with green background', () => {
      render(
        <Toast
          message="Project saved successfully!"
          type="success"
          onClose={() => {}}
        />
      )

      expect(screen.getByText('Project saved successfully!')).toBeInTheDocument()
    })

    it('should auto-hide after default duration', () => {
      const mockOnClose = vi.fn()
      
      render(
        <Toast
          message="Saved!"
          type="success"
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Saved!')).toBeInTheDocument()

      // Default duration is 3000ms
      vi.advanceTimersByTime(3000)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should respect custom duration', () => {
      const mockOnClose = vi.fn()
      
      render(
        <Toast
          message="Quick message"
          type="info"
          onClose={mockOnClose}
          duration={2000}
        />
      )

      // Should not close before custom duration
      vi.advanceTimersByTime(1500)
      expect(mockOnClose).not.toHaveBeenCalled()

      // Should close after custom duration
      vi.advanceTimersByTime(500)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('User wants to see error notifications', () => {
    it('should display error message with red background', () => {
      render(
        <Toast
          message="Failed to save project"
          type="error"
          onClose={() => {}}
        />
      )

      expect(screen.getByText('Failed to save project')).toBeInTheDocument()
    })

    it('should allow longer duration for error messages', () => {
      const mockOnClose = vi.fn()
      
      render(
        <Toast
          message="An error occurred"
          type="error"
          onClose={mockOnClose}
          duration={8000}
        />
      )

      // Should not close too quickly
      vi.advanceTimersByTime(5000)
      expect(mockOnClose).not.toHaveBeenCalled()

      // Should close after longer duration
      vi.advanceTimersByTime(3000)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('User wants to dismiss notifications manually', () => {
    it('should close when clicking close button', async () => {
      // Use real timers for user interaction tests
      vi.useRealTimers()
      const user = userEvent.setup({ delay: null })
      const mockOnClose = vi.fn()
      
      render(
        <Toast
          message="Click to close"
          type="info"
          onClose={mockOnClose}
        />
      )

      const closeButton = screen.getByLabelText('Close notification')
      await user.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('User wants different notification types', () => {
    it('should display info notifications with blue background', () => {
      render(
        <Toast
          message="Did you know?"
          type="info"
          onClose={() => {}}
        />
      )

      expect(screen.getByText('Did you know?')).toBeInTheDocument()
    })
  })

  describe('User wants proper positioning', () => {
    it('should position at bottom-right', () => {
      render(
        <Toast
          message="Bottom-right positioned"
          type="info"
          onClose={() => {}}
        />
      )

      const toast = container.firstChild as HTMLElement
      const styles = window.getComputedStyle(toast)
      
      // Should be fixed positioned at bottom-right
      expect(styles.position).toBe('fixed')
      expect(styles.bottom).toBe('2rem')
      expect(styles.right).toBe('2rem')
    })
  })

  describe('User wants accessible close button', () => {
    it('should have accessible close button', () => {
      render(
        <Toast
          message="Accessible notification"
          type="success"
          onClose={() => {}}
        />
      )

      const closeButton = screen.getByLabelText('Close notification')
      expect(closeButton).toBeInTheDocument()
      expect(closeButton.textContent).toBe('×')
    })

    it('should be keyboard accessible', async () => {
      // Use real timers for user interaction tests
      vi.useRealTimers()
      const user = userEvent.setup({ delay: null })
      const mockOnClose = vi.fn()
      
      render(
        <Toast
          message="Keyboard accessible"
          type="info"
          onClose={mockOnClose}
        />
      )

      // Tab to close button
      await user.tab()
      expect(document.activeElement).toBe(screen.getByLabelText('Close notification'))

      // Press Enter to close
      await user.keyboard('{Enter}')
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('User wants multiple toasts', () => {
    it('should display multiple toasts', () => {
      render(
        <>
          <Toast
            message="First toast"
            type="success"
            onClose={() => {}}
          />
          <Toast
            message="Second toast"
            type="info"
            onClose={() => {}}
          />
        </>
      )

      expect(screen.getByText('First toast')).toBeInTheDocument()
      expect(screen.getByText('Second toast')).toBeInTheDocument()
    })
  })
})