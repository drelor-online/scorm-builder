import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import { StatusPanel } from './StatusPanel'
import type { StatusMessage } from './StatusPanel'
import styles from './StatusPanel.module.css'

describe('StatusPanel - Smaller Bell Icon Behavior', () => {
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
    isDocked: true,
    onDock: vi.fn(),
    onUndock: vi.fn()
  }

  test('should render bell button with smaller 40px dimensions when docked', () => {
    render(<StatusPanel {...defaultProps} />)
    
    const bellButton = screen.getByLabelText(/unread notifications/i)
    expect(bellButton).toBeInTheDocument()
    
    // Check that the bell button has the .bellButton class which applies 40px dimensions
    expect(bellButton).toHaveClass(styles.bellButton)
    // Check that parent has the fixedBell class indicating docked mode
    expect(bellButton.parentElement).toHaveClass(styles.fixedBell)
  })

  test('should use small icon size instead of medium', () => {
    render(<StatusPanel {...defaultProps} />)
    
    const bellButton = screen.getByLabelText(/unread notifications/i)
    const iconElement = bellButton.querySelector('svg')
    
    expect(iconElement).toBeInTheDocument()
    // Icon should be smaller - checking for size="sm" equivalent (16px instead of 20px for "md")
    expect(iconElement).toHaveAttribute('width', '16')
    expect(iconElement).toHaveAttribute('height', '16')
  })

  test('should maintain notification badge functionality with smaller icon', () => {
    render(<StatusPanel {...defaultProps} />)
    
    const notificationBadge = screen.getByTestId('notification-count')
    expect(notificationBadge).toBeInTheDocument()
    expect(notificationBadge).toHaveTextContent('1')
  })

  test('should have less intrusive visual presence', () => {
    render(<StatusPanel {...defaultProps} />)
    
    const bellButton = screen.getByLabelText(/unread notifications/i)
    expect(bellButton).toBeInTheDocument()
    
    // Should have the bellButton class which applies smaller dimensions and more subtle styling
    expect(bellButton).toHaveClass(styles.bellButton)
    
    // Verify it's clickable and responsive
    fireEvent.mouseOver(bellButton)
    fireEvent.mouseOut(bellButton)
    expect(bellButton).toBeInTheDocument()
  })

  test('should expand status panel when bell icon is clicked', () => {
    const onUndock = vi.fn()
    render(<StatusPanel {...defaultProps} onUndock={onUndock} />)
    
    const bellButton = screen.getByLabelText(/unread notifications/i)
    fireEvent.click(bellButton)
    
    expect(onUndock).toHaveBeenCalled()
  })
})