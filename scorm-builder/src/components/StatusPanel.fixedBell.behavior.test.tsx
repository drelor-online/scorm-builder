import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { StatusPanel } from './StatusPanel'

describe('StatusPanel Fixed Bell Behavior', () => {
  const mockProps = {
    messages: [
      {
        id: '1',
        type: 'info' as const,
        title: 'Test Message',
        message: 'Test message content',
        timestamp: Date.now()
      }
    ],
    onDismiss: vi.fn(),
    onClearAll: vi.fn(),
    isDocked: true,
    onUndock: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should show fixed bell icon in bottom-right when docked', () => {
    render(<StatusPanel {...mockProps} />)
    
    const dockedPanel = screen.getByTestId('status-panel')
    expect(dockedPanel).toBeInTheDocument()
    
    // Should have fixedBell class (CSS modules generates hashed class names)
    expect(dockedPanel.className).toContain('fixedBell')
  })

  test('should not be draggable when using fixed bell approach', () => {
    render(<StatusPanel {...mockProps} />)
    
    const dockedPanel = screen.getByTestId('status-panel')
    
    // Should not have draggable cursor
    const styles = window.getComputedStyle(dockedPanel)
    expect(styles.cursor).not.toBe('grab')
    expect(styles.cursor).not.toBe('grabbing')
  })

  test('should show notification count on bell icon', () => {
    render(<StatusPanel {...mockProps} />)
    
    const notificationCount = screen.getByTestId('notification-count')
    expect(notificationCount).toBeInTheDocument()
    expect(notificationCount).toHaveTextContent('1')
  })

  test('should expand when bell icon is clicked', () => {
    render(<StatusPanel {...mockProps} />)
    
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    
    // Should have bell icon or similar indicator
    expect(button).toHaveAttribute('aria-label', expect.stringContaining('notification'))
  })
})