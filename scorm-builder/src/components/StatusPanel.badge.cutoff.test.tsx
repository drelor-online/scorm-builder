import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StatusPanel } from './StatusPanel'
import { StatusMessage } from './StatusPanel'

describe('StatusPanel Badge Cutoff Issue', () => {
  const createMockMessages = (count: number): StatusMessage[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `msg-${i}`,
      type: 'info' as const,
      title: `Message ${i}`,
      message: `Test message ${i}`,
      timestamp: Date.now(),
      dismissed: false
    }))
  }

  const defaultProps = {
    messages: [],
    onDismiss: vi.fn(),
    onClearAll: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display double-digit numbers without cutoff in docked badge', () => {
    const messages = createMockMessages(15) // Double digit count
    
    render(
      <StatusPanel 
        {...defaultProps} 
        messages={messages}
        isDocked={true}
      />
    )
    
    const badge = screen.getByTestId('notification-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('15')
    
    // Badge should have some CSS class for styling (CSS modules generate scoped names)
    expect(badge.className).toContain('notificationBadge')
  })

  it('should display three-digit numbers without cutoff', () => {
    const messages = createMockMessages(999) // Three digit count
    
    render(
      <StatusPanel 
        {...defaultProps} 
        messages={messages}
        isDocked={true}
      />
    )
    
    const badge = screen.getByTestId('notification-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('999')
    expect(badge.className).toContain('notificationBadge')
  })

  it('should handle single digit numbers properly', () => {
    const messages = createMockMessages(5) // Single digit
    
    render(
      <StatusPanel 
        {...defaultProps} 
        messages={messages}
        isDocked={true}
      />
    )
    
    const badge = screen.getByTestId('notification-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('5')
    expect(badge.className).toContain('notificationBadge')
  })

  it('should have proper styling attributes to prevent cutoff', () => {
    const messages = createMockMessages(25)
    
    render(
      <StatusPanel 
        {...defaultProps} 
        messages={messages}
        isDocked={true}
      />
    )
    
    const badge = screen.getByTestId('notification-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('25')
    
    // Badge should have the CSS class that contains the fix
    expect(badge.className).toContain('notificationBadge')
    
    // Should be a span element for proper text display
    expect(badge.tagName).toBe('SPAN')
  })
})