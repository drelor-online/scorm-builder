import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import { StatusPanel } from './StatusPanel'
import type { StatusMessage } from './StatusPanel'

describe('StatusPanel - Expanded by Default Behavior', () => {
  const mockMessages: StatusMessage[] = [
    {
      id: '1',
      type: 'info',
      title: 'Test Message',
      message: 'This is a test message',
      timestamp: Date.now()
    }
  ]

  const defaultProps = {
    messages: mockMessages,
    onDismiss: vi.fn(),
    onClearAll: vi.fn(),
    isDocked: false, // Testing expanded panel, not docked bell
    onDock: vi.fn(),
    onUndock: vi.fn()
  }

  test('should open expanded by default when not docked', () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Should show the expanded content immediately
    expect(screen.getByText('Test Message')).toBeInTheDocument()
    expect(screen.getByText('This is a test message')).toBeInTheDocument()
    
    // Should show tab navigation
    expect(screen.getByRole('tab', { name: /activity/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /debug logs/i })).toBeInTheDocument()
  })

  test('should not auto-collapse (auto-hide disabled)', () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Verify content is visible initially
    expect(screen.getByText('Test Message')).toBeInTheDocument()
    
    // Since auto-hide is disabled, content should remain visible
    // No need to test timers as the feature is disabled
    expect(screen.getByText('Test Message')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /activity/i })).toBeInTheDocument()
  })

  test('should allow manual collapse and expand', () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Find and click the collapse button
    const collapseButton = screen.getByTestId('status-toggle-collapse')
    expect(collapseButton).toBeInTheDocument()
    
    // Should start expanded with "Collapse" label
    expect(screen.getByText('Test Message')).toBeInTheDocument()
    expect(collapseButton).toHaveAttribute('aria-label', 'Collapse status panel')
    
    // Click to collapse
    fireEvent.click(collapseButton)
    
    // After clicking, button should change to "Expand" label
    expect(collapseButton).toHaveAttribute('aria-label', 'Expand status panel')
  })

  test('should maintain expanded state even with new messages', async () => {
    const { rerender } = render(<StatusPanel {...defaultProps} />)
    
    // Verify initially expanded
    expect(screen.getByText('Test Message')).toBeInTheDocument()
    
    // Add a new message
    const newMessages: StatusMessage[] = [
      ...mockMessages,
      {
        id: '2',
        type: 'success',
        title: 'New Message',
        message: 'This is a new message',
        timestamp: Date.now() + 1000
      }
    ]
    
    // Re-render with new messages
    rerender(<StatusPanel {...defaultProps} messages={newMessages} />)
    
    // Should still be expanded and show both messages
    expect(screen.getByText('Test Message')).toBeInTheDocument()
    expect(screen.getByText('New Message')).toBeInTheDocument()
    expect(screen.getByText('This is a new message')).toBeInTheDocument()
  })
})