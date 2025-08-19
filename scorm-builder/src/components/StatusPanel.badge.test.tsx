import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StatusPanel } from './StatusPanel'
import { StatusMessage } from './StatusPanel'

describe('StatusPanel Badge', () => {
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

  it('should show badge with message count when docked and has messages', () => {
    const messages = createMockMessages(3)
    
    render(
      <StatusPanel 
        {...defaultProps} 
        messages={messages}
        isDocked={true}
      />
    )
    
    // Should show the dock button with badge
    const dockButton = screen.getByRole('button', { name: /undock status panel/i })
    expect(dockButton).toBeInTheDocument()
    
    // Badge should show count
    const badge = screen.getByTestId('notification-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('3')
  })

  it('should not show badge when docked but no messages', () => {
    render(
      <StatusPanel 
        {...defaultProps} 
        messages={[]}
        isDocked={true}
      />
    )
    
    const dockButton = screen.getByRole('button', { name: /undock status panel/i })
    expect(dockButton).toBeInTheDocument()
    
    // Badge should not be present
    const badge = screen.queryByTestId('notification-badge')
    expect(badge).not.toBeInTheDocument()
  })

  it('should not show badge when not docked (full panel visible)', () => {
    const messages = createMockMessages(2)
    
    render(
      <StatusPanel 
        {...defaultProps} 
        messages={messages}
        isDocked={false}
      />
    )
    
    // Panel should be visible, no badge needed
    const badge = screen.queryByTestId('notification-badge')
    expect(badge).not.toBeInTheDocument()
  })

  it('should show correct count even with many messages', () => {
    const messages = createMockMessages(15)
    
    render(
      <StatusPanel 
        {...defaultProps} 
        messages={messages}
        isDocked={true}
      />
    )
    
    const badge = screen.getByTestId('notification-badge')
    expect(badge).toHaveTextContent('15')
  })
})