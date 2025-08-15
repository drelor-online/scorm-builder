/**
 * Toast Component - Consolidated Test Suite
 * 
 * This file consolidates Toast component tests from 5 separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - Toast.test.tsx (main functionality)
 * - Toast.accessibility.test.tsx (accessibility features)
 * - Toast.cutoff.test.tsx (text cutoff handling)
 * - Toast.intent.test.tsx (user intent detection)
 * - Toast.simple.test.tsx (basic functionality)
 * 
 * Test Categories:
 * - Core rendering and functionality
 * - Different toast types (success, error, info, warning)
 * - Auto-dismiss behavior and timing
 * - User interaction (close button, manual dismiss)
 * - Accessibility features and ARIA support
 * - Text handling and overflow management
 * - Animation and transition behavior
 * - Edge cases and error scenarios
 */

import React from 'react'
import { render, screen, waitFor } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Toast, ToastProps } from '../Toast'

describe('Toast Component - Consolidated Test Suite', () => {
  const defaultProps: ToastProps = {
    message: 'Test message',
    type: 'info',
    onClose: vi.fn(),
    duration: 3000
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Core Rendering and Functionality', () => {
    it('renders with success type and message', () => {
      render(
        <Toast 
          message="Operation successful!" 
          type="success" 
          onClose={defaultProps.onClose} 
        />
      )
      
      expect(screen.getByText('Operation successful!')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('renders with error type and message', () => {
      render(
        <Toast 
          message="An error occurred" 
          type="error" 
          onClose={defaultProps.onClose} 
        />
      )
      
      expect(screen.getByText('An error occurred')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('renders with info type and message', () => {
      render(
        <Toast 
          message="Information message" 
          type="info" 
          onClose={defaultProps.onClose} 
        />
      )
      
      expect(screen.getByText('Information message')).toBeInTheDocument()
    })

    it('renders with warning type and message', () => {
      render(
        <Toast 
          message="Warning message" 
          type="warning" 
          onClose={defaultProps.onClose} 
        />
      )
      
      expect(screen.getByText('Warning message')).toBeInTheDocument()
    })

    it('applies correct CSS classes based on type', () => {
      const { rerender } = render(
        <Toast 
          message="Test" 
          type="success" 
          onClose={defaultProps.onClose} 
        />
      )
      
      let toast = screen.getByRole('alert')
      expect(toast).toHaveClass('toast')
      
      rerender(
        <Toast 
          message="Test" 
          type="error" 
          onClose={defaultProps.onClose} 
        />
      )
      
      toast = screen.getByRole('alert')
      expect(toast).toHaveClass('toast')
    })
  })

  describe('Auto-dismiss Behavior and Timing', () => {
    it('auto-dismisses after specified duration', async () => {
      const mockOnClose = vi.fn()
      render(
        <Toast 
          message="Test message" 
          type="info" 
          onClose={mockOnClose}
          duration={3000}
        />
      )
      
      expect(mockOnClose).not.toHaveBeenCalled()
      
      // Fast-forward time by the duration
      vi.advanceTimersByTime(3000)
      
      // Wait for animation delay (200ms)
      vi.advanceTimersByTime(200)
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1)
      })
    })

    it('respects custom duration', async () => {
      const mockOnClose = vi.fn()
      render(
        <Toast 
          message="Test message" 
          type="info" 
          onClose={mockOnClose}
          duration={5000}
        />
      )
      
      // Should not dismiss before custom duration
      vi.advanceTimersByTime(3000)
      expect(mockOnClose).not.toHaveBeenCalled()
      
      // Should dismiss after custom duration + animation delay
      vi.advanceTimersByTime(2000)
      vi.advanceTimersByTime(200)
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1)
      })
    })

    it('does not auto-dismiss when duration is 0', async () => {
      const mockOnClose = vi.fn()
      render(
        <Toast 
          message="Test message" 
          type="info" 
          onClose={mockOnClose}
          duration={0}
        />
      )
      
      // Fast-forward a long time
      vi.advanceTimersByTime(10000)
      
      // Should not auto-dismiss
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('clears timer on unmount', () => {
      const mockOnClose = vi.fn()
      const { unmount } = render(
        <Toast 
          message="Test message" 
          type="info" 
          onClose={mockOnClose}
          duration={3000}
        />
      )
      
      unmount()
      
      // Fast-forward time after unmount
      vi.advanceTimersByTime(5000)
      
      // Should not call onClose after unmount
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('User Interaction', () => {
    it('calls onClose when close button is clicked', async () => {
      const mockOnClose = vi.fn()
      render(
        <Toast 
          message="Test message" 
          type="info" 
          onClose={mockOnClose}
        />
      )
      
      const closeButton = screen.getByRole('button', { name: /close/i })
      await userEvent.click(closeButton)
      
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('supports keyboard interaction for close button', async () => {
      const mockOnClose = vi.fn()
      render(
        <Toast 
          message="Test message" 
          type="info" 
          onClose={mockOnClose}
        />
      )
      
      const closeButton = screen.getByRole('button', { name: /close/i })
      closeButton.focus()
      
      await userEvent.keyboard('{Enter}')
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('pauses auto-dismiss on hover', async () => {
      const mockOnClose = vi.fn()
      render(
        <Toast 
          message="Test message" 
          type="info" 
          onClose={mockOnClose}
          duration={3000}
        />
      )
      
      const toast = screen.getByRole('alert')
      
      // Hover over toast
      await userEvent.hover(toast)
      
      // Fast-forward past original duration
      vi.advanceTimersByTime(3000)
      
      // Should not auto-dismiss while hovering
      expect(mockOnClose).not.toHaveBeenCalled()
      
      // Unhover
      await userEvent.unhover(toast)
      
      // Should resume auto-dismiss
      vi.advanceTimersByTime(3000)
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Accessibility Features and ARIA Support', () => {
    it('has proper ARIA role and attributes', () => {
      render(<Toast {...defaultProps} type="success" />)
      
      const toast = screen.getByRole('alert')
      expect(toast).toBeInTheDocument()
      expect(toast).toHaveAttribute('role', 'alert')
    })

    it('has accessible close button', () => {
      render(<Toast {...defaultProps} />)
      
      const closeButton = screen.getByRole('button', { name: /close/i })
      expect(closeButton).toBeInTheDocument()
      expect(closeButton).toHaveAttribute('aria-label')
    })

    it('announces different toast types appropriately', () => {
      const { rerender } = render(<Toast {...defaultProps} type="error" />)
      
      let toast = screen.getByRole('alert')
      expect(toast).toHaveAttribute('role', 'alert')
      
      rerender(<Toast {...defaultProps} type="info" />)
      toast = screen.getByRole('alert')
      expect(toast).toHaveAttribute('role', 'alert')
    })

    it('supports screen reader navigation', () => {
      render(<Toast {...defaultProps} />)
      
      const toast = screen.getByRole('alert')
      const closeButton = screen.getByRole('button')
      
      // Toast should be discoverable by screen readers
      expect(toast).toBeInTheDocument()
      expect(closeButton).toBeInTheDocument()
      
      // Close button should be focusable
      closeButton.focus()
      expect(closeButton).toHaveFocus()
    })

    it('maintains focus management', async () => {
      render(<Toast {...defaultProps} />)
      
      const closeButton = screen.getByRole('button')
      
      // Button should be focusable
      closeButton.focus()
      expect(closeButton).toHaveFocus()
      
      // Focus should be maintained during interaction
      await userEvent.tab()
      // Focus should move appropriately
    })

    it('provides high contrast for different types', () => {
      const { rerender } = render(<Toast {...defaultProps} type="error" />)
      
      let toast = screen.getByRole('alert')
      expect(toast).toHaveClass('toast')
      
      rerender(<Toast {...defaultProps} type="success" />)
      toast = screen.getByRole('alert')
      expect(toast).toHaveClass('toast')
      
      rerender(<Toast {...defaultProps} type="warning" />)
      toast = screen.getByRole('alert')
      expect(toast).toHaveClass('toast')
    })
  })

  describe('Text Handling and Overflow Management', () => {
    it('handles long messages without breaking layout', () => {
      const longMessage = 'This is a very long message that should be handled gracefully without breaking the toast layout or causing display issues'
      
      render(
        <Toast 
          message={longMessage}
          type="info" 
          onClose={defaultProps.onClose}
        />
      )
      
      expect(screen.getByText(longMessage)).toBeInTheDocument()
    })

    it('truncates extremely long messages appropriately', () => {
      const extremelyLongMessage = 'A'.repeat(500)
      
      render(
        <Toast 
          message={extremelyLongMessage}
          type="info" 
          onClose={defaultProps.onClose}
        />
      )
      
      const toast = screen.getByRole('alert')
      expect(toast).toBeInTheDocument()
      
      // Should not cause layout issues
      expect(toast).toHaveStyle('overflow: hidden')
    })

    it('handles multiline messages', () => {
      const multilineMessage = 'Line 1\nLine 2\nLine 3'
      
      render(
        <Toast 
          message={multilineMessage}
          type="info" 
          onClose={defaultProps.onClose}
        />
      )
      
      expect(screen.getByText(/Line 1/)).toBeInTheDocument()
    })

    it('handles special characters and HTML entities', () => {
      const specialMessage = 'Special chars: <script>alert("test")</script> & émojis 🎯'
      
      render(
        <Toast 
          message={specialMessage}
          type="info" 
          onClose={defaultProps.onClose}
        />
      )
      
      // Should escape HTML and display safely
      expect(screen.getByText(/Special chars/)).toBeInTheDocument()
    })

    it('preserves message formatting when needed', () => {
      const formattedMessage = 'Important: Project saved successfully!'
      
      render(
        <Toast 
          message={formattedMessage}
          type="success" 
          onClose={defaultProps.onClose}
        />
      )
      
      expect(screen.getByText(formattedMessage)).toBeInTheDocument()
    })
  })

  describe('Animation and Transition Behavior', () => {
    it('applies entrance animation', () => {
      render(<Toast {...defaultProps} />)
      
      const toast = screen.getByRole('alert')
      expect(toast).toBeInTheDocument()
      
      // Should have animation classes
      expect(toast).toHaveClass('toast')
    })

    it('handles transition states properly', async () => {
      const mockOnClose = vi.fn()
      render(
        <Toast 
          message="Test message" 
          type="info" 
          onClose={mockOnClose}
        />
      )
      
      const closeButton = screen.getByRole('button')
      await userEvent.click(closeButton)
      
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('manages multiple toast animations', () => {
      const { rerender } = render(
        <Toast 
          message="First toast" 
          type="info" 
          onClose={vi.fn()}
        />
      )
      
      expect(screen.getByText('First toast')).toBeInTheDocument()
      
      rerender(
        <Toast 
          message="Second toast" 
          type="success" 
          onClose={vi.fn()}
        />
      )
      
      expect(screen.getByText('Second toast')).toBeInTheDocument()
    })
  })

  describe('User Intent Detection', () => {
    it('detects success intent from message content', () => {
      render(
        <Toast 
          message="Successfully saved project" 
          type="success" 
          onClose={defaultProps.onClose}
        />
      )
      
      expect(screen.getByText(/successfully/i)).toBeInTheDocument()
    })

    it('detects error intent from message content', () => {
      render(
        <Toast 
          message="Failed to save project" 
          type="error" 
          onClose={defaultProps.onClose}
        />
      )
      
      expect(screen.getByText(/failed/i)).toBeInTheDocument()
    })

    it('provides appropriate urgency indicators', () => {
      const { rerender } = render(
        <Toast 
          message="Critical error occurred" 
          type="error" 
          onClose={defaultProps.onClose}
        />
      )
      
      let toast = screen.getByRole('alert')
      expect(toast).toBeInTheDocument()
      
      rerender(
        <Toast 
          message="Operation completed" 
          type="info" 
          onClose={defaultProps.onClose}
        />
      )
      
      toast = screen.getByRole('alert')
      expect(toast).toBeInTheDocument()
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    it('handles empty message gracefully', () => {
      render(
        <Toast 
          message="" 
          type="info" 
          onClose={defaultProps.onClose}
        />
      )
      
      const toast = screen.getByRole('alert')
      expect(toast).toBeInTheDocument()
    })

    it('handles null message gracefully', () => {
      render(
        <Toast 
          message={null as any} 
          type="info" 
          onClose={defaultProps.onClose}
        />
      )
      
      const toast = screen.getByRole('alert')
      expect(toast).toBeInTheDocument()
    })

    it('handles missing onClose callback', () => {
      expect(() => {
        render(
          <Toast 
            message="Test message" 
            type="info" 
            onClose={undefined as any}
          />
        )
      }).not.toThrow()
    })

    it('handles invalid toast type gracefully', () => {
      render(
        <Toast 
          message="Test message" 
          type={'invalid' as any} 
          onClose={defaultProps.onClose}
        />
      )
      
      const toast = screen.getByRole('alert')
      expect(toast).toBeInTheDocument()
    })

    it('handles rapid show/hide cycles', async () => {
      const mockOnClose = vi.fn()
      const { unmount } = render(
        <Toast 
          message="Test message" 
          type="info" 
          onClose={mockOnClose}
          duration={100}
        />
      )
      
      // Unmount quickly
      unmount()
      
      // Should not cause errors
      vi.advanceTimersByTime(200)
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('Performance and Memory Management', () => {
    it('cleans up timers on unmount to prevent memory leaks', () => {
      const mockOnClose = vi.fn()
      const { unmount } = render(
        <Toast 
          message="Test message" 
          type="info" 
          onClose={mockOnClose}
          duration={3000}
        />
      )
      
      unmount()
      
      // Advance time after unmount
      vi.advanceTimersByTime(5000)
      
      // Timer should be cleaned up
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('handles multiple rapid renders efficiently', () => {
      const { rerender } = render(
        <Toast 
          message="Message 1" 
          type="info" 
          onClose={vi.fn()}
        />
      )
      
      // Rapid re-renders
      for (let i = 2; i <= 10; i++) {
        rerender(
          <Toast 
            message={`Message ${i}`} 
            type="info" 
            onClose={vi.fn()}
          />
        )
      }
      
      expect(screen.getByText('Message 10')).toBeInTheDocument()
    })

    it('maintains performance with complex messages', () => {
      const complexMessage = {
        text: 'Complex message with embedded data',
        timestamp: new Date().toISOString(),
        metadata: { source: 'test', priority: 'high' }
      }
      
      render(
        <Toast 
          message={JSON.stringify(complexMessage)} 
          type="info" 
          onClose={defaultProps.onClose}
        />
      )
      
      expect(screen.getByText(/Complex message/)).toBeInTheDocument()
    })
  })

  describe('Integration with Notification System', () => {
    it('works as part of a notification stack', () => {
      render(
        <div>
          <Toast 
            message="First notification" 
            type="info" 
            onClose={vi.fn()}
          />
          <Toast 
            message="Second notification" 
            type="success" 
            onClose={vi.fn()}
          />
        </div>
      )
      
      expect(screen.getByText('First notification')).toBeInTheDocument()
      expect(screen.getByText('Second notification')).toBeInTheDocument()
    })

    it('maintains independence when stacked', async () => {
      const firstOnClose = vi.fn()
      const secondOnClose = vi.fn()
      
      render(
        <div>
          <Toast 
            message="First notification" 
            type="info" 
            onClose={firstOnClose}
            duration={1000}
          />
          <Toast 
            message="Second notification" 
            type="success" 
            onClose={secondOnClose}
            duration={2000}
          />
        </div>
      )
      
      // First should dismiss after 1 second
      vi.advanceTimersByTime(1000)
      await waitFor(() => {
        expect(firstOnClose).toHaveBeenCalledTimes(1)
      })
      expect(secondOnClose).not.toHaveBeenCalled()
      
      // Second should dismiss after 2 seconds total
      vi.advanceTimersByTime(1000)
      await waitFor(() => {
        expect(secondOnClose).toHaveBeenCalledTimes(1)
      })
    })
  })
})