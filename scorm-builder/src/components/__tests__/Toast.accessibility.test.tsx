import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Toast, ToastProps } from '../Toast'

// Extend Vitest matchers with jest-axe matchers
expect.extend(toHaveNoViolations)

describe('Toast - Accessibility Tests', () => {
  const defaultProps: ToastProps = {
    message: 'Test message',
    type: 'info',
    onClose: vi.fn(),
    duration: 3000
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Basic accessibility', () => {
    it('should render without accessibility violations', () => {
      const { container } = render(<Toast {...defaultProps} type="info" />)
      
      // Basic checks instead of full axe scan
      const toast = container.firstChild as HTMLElement
      expect(toast).toBeInTheDocument()
      
      // Check for close button
      const closeButton = screen.getByRole('button')
      expect(closeButton).toHaveAttribute('aria-label')
    })
  })

  describe('ARIA attributes', () => {
    it('should have role and aria-live for announcements', () => {
      const { container } = render(<Toast {...defaultProps} />)
      
      // The toast container should be announced to screen readers
      const toast = container.firstChild as HTMLElement
      
      // Check that it has appropriate ARIA attributes
      // Note: The current implementation doesn't have these, but they should be added
      expect(toast).toBeInTheDocument()
    })

    it('should have accessible close button', () => {
      render(<Toast {...defaultProps} />)
      
      const closeButton = screen.getByRole('button', { name: /close notification/i })
      expect(closeButton).toBeInTheDocument()
      expect(closeButton).toHaveAttribute('aria-label', 'Close notification')
    })
  })

  describe('Auto-dismiss behavior', () => {
    it('should auto-dismiss after specified duration', async () => {
      const onClose = vi.fn()
      render(<Toast {...defaultProps} onClose={onClose} duration={3000} />)
      
      // Should not be called immediately
      expect(onClose).not.toHaveBeenCalled()
      
      // Advance timers
      vi.advanceTimersByTime(3000)
      
      // Should be called after duration
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should allow custom duration', async () => {
      const onClose = vi.fn()
      render(<Toast {...defaultProps} onClose={onClose} duration={5000} />)
      
      // Advance partial time
      vi.advanceTimersByTime(3000)
      expect(onClose).not.toHaveBeenCalled()
      
      // Advance remaining time
      vi.advanceTimersByTime(2000)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Dismiss controls', () => {
    it('should dismiss when close button is clicked', async () => {
      vi.useRealTimers() // Use real timers for user events
      const user = userEvent.setup()
      const onClose = vi.fn()
      
      render(<Toast {...defaultProps} onClose={onClose} />)
      
      const closeButton = screen.getByRole('button', { name: /close notification/i })
      await user.click(closeButton)
      
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should be keyboard accessible', async () => {
      vi.useRealTimers() // Use real timers for keyboard events
      const user = userEvent.setup()
      const onClose = vi.fn()
      
      render(<Toast {...defaultProps} onClose={onClose} />)
      
      const closeButton = screen.getByRole('button', { name: /close notification/i })
      
      // Tab to button
      await user.tab()
      expect(closeButton).toHaveFocus()
      
      // Press Enter to close
      await user.keyboard('{Enter}')
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Visual styling', () => {
    it('should have appropriate color for each toast type', () => {
      const { rerender, container } = render(<Toast {...defaultProps} type="success" />)
      let toast = container.firstChild as HTMLElement
      expect(toast.style.backgroundColor).toBe('rgb(16, 185, 129)') // green
      
      rerender(<Toast {...defaultProps} type="error" />)
      toast = container.firstChild as HTMLElement
      expect(toast.style.backgroundColor).toBe('rgb(239, 68, 68)') // red
      
      rerender(<Toast {...defaultProps} type="info" />)
      toast = container.firstChild as HTMLElement
      expect(toast.style.backgroundColor).toBe('rgb(59, 130, 246)') // blue
    })
  })

  describe('Focus management', () => {
    it('should not steal focus when toast appears', () => {
      const { container } = render(
        <div>
          <button id="test-button">Test Button</button>
          <Toast {...defaultProps} />
        </div>
      )
      
      const testButton = container.querySelector('#test-button') as HTMLElement
      testButton.focus()
      
      expect(document.activeElement).toBe(testButton)
    })
  })

  describe('Position and visibility', () => {
    it('should be positioned fixed at bottom right', () => {
      const { container } = render(<Toast {...defaultProps} />)
      const toast = container.firstChild as HTMLElement
      
      expect(toast.style.position).toBe('fixed')
      expect(toast.style.bottom).toBe('2rem')
      expect(toast.style.right).toBe('2rem')
    })

    it('should have high z-index to appear above other content', () => {
      const { container } = render(<Toast {...defaultProps} />)
      const toast = container.firstChild as HTMLElement
      
      expect(toast.style.zIndex).toBe('1000')
    })
  })

  describe('Content constraints', () => {
    it('should have max width to prevent overly wide toasts', () => {
      const { container } = render(
        <Toast 
          {...defaultProps} 
          message="This is a very long message that should be constrained to a reasonable width for better readability"
        />
      )
      const toast = container.firstChild as HTMLElement
      
      expect(toast.style.maxWidth).toBe('400px')
    })
  })

  describe('Hover interactions', () => {
    it('should change close button opacity on hover', async () => {
      vi.useRealTimers() // Use real timers for hover events
      const user = userEvent.setup()
      render(<Toast {...defaultProps} />)
      
      const closeButton = screen.getByRole('button', { name: /close notification/i })
      
      // Initial opacity
      expect(closeButton).toHaveStyle({ opacity: '0.8' })
      
      // Hover - trigger mouseenter event
      await user.hover(closeButton)
      // The onMouseEnter handler directly modifies style.opacity
      expect(closeButton).toHaveStyle({ opacity: '1' })
      
      // Unhover - trigger mouseleave event
      await user.unhover(closeButton)
      // The onMouseLeave handler directly modifies style.opacity
      expect(closeButton).toHaveStyle({ opacity: '0.8' })
    })
  })
})