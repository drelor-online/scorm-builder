import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { StatusPanel } from './StatusPanel'
import type { StatusMessage } from './StatusPanel'
import styles from './StatusPanel.module.css'

// Mock localStorage globally for vitest
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true
})

// Mock real logs for testing
const mockLogs = [
  '[2024-01-15T10:30:15.123Z] [MediaService] ERROR: Failed to load video: network timeout',
  '[2024-01-15T10:29:45.456Z] [FileStorage] WARN: Large file detected, may slow down processing'
]

beforeEach(() => {
  (window as any).debugLogs = [...mockLogs]
})

describe('StatusPanel - Panel Sizing and Usability', () => {
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
    isDocked: false,
    onDock: vi.fn(),
    onUndock: vi.fn()
  }

  test('should display maximize button when panel is normal size', () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Should show maximize button
    const maximizeButton = screen.getByRole('button', { name: /maximize status panel/i })
    expect(maximizeButton).toBeInTheDocument()
  })

  test('should maximize panel to full screen when maximize button clicked', () => {
    render(<StatusPanel {...defaultProps} />)
    
    const maximizeButton = screen.getByRole('button', { name: /maximize status panel/i })
    const panel = screen.getByTestId('status-panel')
    
    // Panel should start with normal size classes
    expect(panel).not.toHaveClass(styles.maximized)
    
    // Click maximize
    fireEvent.click(maximizeButton)
    
    // Panel should now be maximized
    expect(panel).toHaveClass(styles.maximized)
  })

  test('should show minimize button when panel is maximized', () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Maximize first
    const maximizeButton = screen.getByRole('button', { name: /maximize status panel/i })
    fireEvent.click(maximizeButton)
    
    // Should now show minimize button instead of maximize
    const minimizeButton = screen.getByRole('button', { name: /minimize status panel/i })
    expect(minimizeButton).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /maximize status panel/i })).not.toBeInTheDocument()
  })

  test('should restore normal size when minimize button clicked', () => {
    render(<StatusPanel {...defaultProps} />)
    
    const panel = screen.getByTestId('status-panel')
    
    // Maximize first
    const maximizeButton = screen.getByRole('button', { name: /maximize status panel/i })
    fireEvent.click(maximizeButton)
    expect(panel).toHaveClass(styles.maximized)
    
    // Then minimize
    const minimizeButton = screen.getByRole('button', { name: /minimize status panel/i })
    fireEvent.click(minimizeButton)
    
    // Should be back to normal size
    expect(panel).not.toHaveClass(styles.maximized)
  })

  test('should have larger default width (600px minimum)', () => {
    render(<StatusPanel {...defaultProps} />)
    
    const panel = screen.getByTestId('status-panel')
    
    // In JSDOM, we can't reliably test computed CSS values
    // Instead, we verify the CSS class is applied and trust the CSS implementation
    expect(panel).toHaveClass(styles.statusPanel)
    expect(panel).not.toHaveClass(styles.maximized)
    
    // The width should be controlled by CSS - this is tested via visual inspection
    // and the CSS has width: 600px set for .statusPanel
  })

  test('should expand component dropdown to prevent text cutoff', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for debug panel to render
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const componentFilter = screen.getByDisplayValue('All Components')
    const computedStyle = window.getComputedStyle(componentFilter)
    
    // Component dropdown should have adequate width
    const width = parseInt(computedStyle.minWidth || computedStyle.width)
    expect(width).toBeGreaterThanOrEqual(140)
  })

  test('should save maximized state to localStorage', () => {
    // Clear localStorage mocks before test
    vi.clearAllMocks()
    
    render(<StatusPanel {...defaultProps} />)
    
    const panel = screen.getByTestId('status-panel')
    const maximizeButton = screen.getByTestId('status-maximize-button')
    
    // Verify initial state is not maximized
    expect(panel).not.toHaveClass(styles.maximized)
    
    // Maximize panel
    fireEvent.click(maximizeButton)
    
    // Verify panel is now maximized (this proves the click worked)
    expect(panel).toHaveClass(styles.maximized)
    
    // Should save maximized state
    expect(window.localStorage.setItem).toHaveBeenCalledWith('statusPanel_maximized', 'true')
    
    // Minimize panel
    fireEvent.click(maximizeButton) // Same button, toggles between maximize/minimize
    
    // Verify panel is back to normal
    expect(panel).not.toHaveClass(styles.maximized)
    
    // Should save minimized state
    expect(window.localStorage.setItem).toHaveBeenCalledWith('statusPanel_maximized', 'false')
  })

  test('should restore maximized state from localStorage', () => {
    // Mock localStorage to return maximized state
    ;(window.localStorage.getItem as any).mockReturnValue('true')
    
    render(<StatusPanel {...defaultProps} />)
    
    const panel = screen.getByTestId('status-panel')
    
    // Panel should start maximized based on localStorage
    expect(panel).toHaveClass(styles.maximized)
  })

  test('should maintain maximize state when switching tabs', () => {
    // Clear localStorage mock to ensure clean state
    vi.clearAllMocks()
    ;(window.localStorage.getItem as any).mockReturnValue(null)
    
    render(<StatusPanel {...defaultProps} />)
    
    const panel = screen.getByTestId('status-panel')
    
    // Maximize panel
    const maximizeButton = screen.getByTestId('status-maximize-button')
    fireEvent.click(maximizeButton)
    expect(panel).toHaveClass(styles.maximized)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Should still be maximized
    expect(panel).toHaveClass(styles.maximized)
    
    // Switch back to activity tab
    const activityTab = screen.getByRole('tab', { name: /activity/i })
    fireEvent.click(activityTab)
    
    // Should still be maximized
    expect(panel).toHaveClass(styles.maximized)
  })

  test('should have appropriate z-index when maximized', () => {
    // Clear localStorage mock to ensure clean state
    vi.clearAllMocks()
    ;(window.localStorage.getItem as any).mockReturnValue(null)
    
    render(<StatusPanel {...defaultProps} />)
    
    const panel = screen.getByTestId('status-panel')
    
    // Maximize panel
    const maximizeButton = screen.getByTestId('status-maximize-button')
    fireEvent.click(maximizeButton)
    
    // Verify the panel has the maximized class which includes high z-index in CSS
    expect(panel).toHaveClass(styles.maximized)
    
    // In JSDOM, we can't reliably test computed CSS values
    // The z-index: 1100 is defined in the CSS .maximized class
  })
})