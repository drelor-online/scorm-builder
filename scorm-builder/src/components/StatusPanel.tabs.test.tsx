import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { StatusPanel } from './StatusPanel'
import type { StatusMessage } from './StatusPanel'

// Mock ultraSimpleLogger
const mockDebugLogs: string[] = [
  '[INFO] App initialized successfully',
  '[ERROR] Failed to load resource',
  '[WARN] Deprecated API usage detected',
  '[DEBUG] User clicked button'
]

// Mock window.debugLogs
Object.defineProperty(window, 'debugLogs', {
  value: mockDebugLogs,
  writable: true,
})

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
})

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-blob-url')
global.URL.revokeObjectURL = vi.fn()

describe('StatusPanel with Tabs', () => {
  const mockMessages: StatusMessage[] = [
    {
      id: '1',
      type: 'success',
      title: 'Project Saved',
      message: 'All changes have been saved successfully',
      timestamp: Date.now() - 1000,
    },
    {
      id: '2', 
      type: 'info',
      title: 'Auto-save',
      message: 'Changes auto-saved',
      timestamp: Date.now() - 2000,
    },
  ]

  const mockProps = {
    messages: mockMessages,
    onDismiss: vi.fn(),
    onClearAll: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window.debugLogs
    window.debugLogs = [...mockDebugLogs]
  })

  describe('Tab Navigation', () => {
    it('should render both Activity and Debug Logs tabs', () => {
      render(<StatusPanel {...mockProps} />)
      
      expect(screen.getByText(/Activity \(/)).toBeInTheDocument()
      expect(screen.getByText(/Debug Logs \(/)).toBeInTheDocument()
    })

    it('should show Activity tab as active by default', () => {
      render(<StatusPanel {...mockProps} />)
      
      const activityTab = screen.getByRole('tab', { name: /activity/i })
      const debugTab = screen.getByRole('tab', { name: /debug logs/i })
      
      expect(activityTab).toHaveAttribute('aria-selected', 'true')
      expect(debugTab).toHaveAttribute('aria-selected', 'false')
    })

    it('should switch to Debug Logs tab when clicked', () => {
      render(<StatusPanel {...mockProps} />)
      
      const debugTab = screen.getByRole('tab', { name: /debug logs/i })
      fireEvent.click(debugTab)
      
      expect(debugTab).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('tab', { name: /activity/i })).toHaveAttribute('aria-selected', 'false')
    })

    it('should show activity messages in Activity tab', () => {
      render(<StatusPanel {...mockProps} />)
      
      expect(screen.getByText('Project Saved')).toBeInTheDocument()
      expect(screen.getByText('All changes have been saved successfully')).toBeInTheDocument()
    })

    it('should show debug logs in Debug Logs tab', async () => {
      render(<StatusPanel {...mockProps} />)
      
      const debugTab = screen.getByRole('tab', { selected: false })
      fireEvent.click(debugTab)
      
      await waitFor(() => {
        expect(screen.getByText(/App initialized successfully/)).toBeInTheDocument()
        expect(screen.getByText(/Failed to load resource/)).toBeInTheDocument()
      })
    })
  })

  describe('Debug Logs Functionality', () => {
    it('should show log count in Debug Logs tab title', async () => {
      render(<StatusPanel {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText(/Debug Logs \(\d+\)/)).toBeInTheDocument()
      })
    })

    it('should refresh debug logs automatically', async () => {
      render(<StatusPanel {...mockProps} />)
      
      // Add a new log
      window.debugLogs.push('[INFO] New log entry')
      
      // Wait for auto-refresh (500ms interval)
      await waitFor(() => {
        expect(screen.getByText(/Debug Logs \(\d+\)/)).toBeInTheDocument()
      }, { timeout: 1000 })
    })

    it('should filter logs by search term', async () => {
      render(<StatusPanel {...mockProps} />)
      
      const debugTab = screen.getByRole('tab', { selected: false })
      fireEvent.click(debugTab)
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search logs/i)
        fireEvent.change(searchInput, { target: { value: 'ERROR' } })
      })
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load resource/)).toBeInTheDocument()
      })
    })

    it('should filter logs by level', async () => {
      render(<StatusPanel {...mockProps} />)
      
      const debugTab = screen.getByRole('tab', { selected: false })
      fireEvent.click(debugTab)
      
      await waitFor(() => {
        const levelSelect = screen.getByDisplayValue('All Levels')
        fireEvent.change(levelSelect, { target: { value: 'ERROR' } })
      })
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load resource/)).toBeInTheDocument()
      })
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should toggle panel visibility with Ctrl+Shift+D', () => {
      const { container } = render(<StatusPanel {...mockProps} />)
      
      // Panel should be visible initially
      expect(container.firstChild).toBeVisible()
      
      // Press Ctrl+Shift+D to hide - logic is: if not collapsed and on activity tab, switch to debug. If collapsed, expand to debug
      fireEvent.keyDown(window, { key: 'D', ctrlKey: true, shiftKey: true })
      
      // Should switch to debug tab (not collapse since we were on activity tab)
      expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Debug Logs')
      
      // Press again to collapse
      fireEvent.keyDown(window, { key: 'D', ctrlKey: true, shiftKey: true })
      
      // Panel should be collapsed now
      expect(container.querySelector('[data-testid="status-panel"]')?.className).toContain('collapsed')
    })

    it('should switch to Debug Logs tab with Ctrl+Shift+D when panel is expanded', () => {
      render(<StatusPanel {...mockProps} />)
      
      // Panel is visible, press Ctrl+Shift+D
      fireEvent.keyDown(window, { key: 'D', ctrlKey: true, shiftKey: true })
      
      // Should switch to debug tab
      const debugTab = screen.getByRole('tab', { name: /debug logs/i })
      expect(debugTab).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('Log Actions', () => {
    it('should copy logs to clipboard', async () => {
      // Ensure logs are available
      window.debugLogs = [...mockDebugLogs]
      
      render(<StatusPanel {...mockProps} />)
      
      const debugTab = screen.getByRole('tab', { selected: false })
      fireEvent.click(debugTab)
      
      // Wait for logs to be loaded (500ms interval)
      await waitFor(() => {
        expect(screen.getByText(/App initialized successfully/)).toBeInTheDocument()
      }, { timeout: 1000 })
      
      await waitFor(() => {
        const copyButton = screen.getByText(/copy logs/i)
        fireEvent.click(copyButton)
      })
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockDebugLogs.join('\n'))
      
      await waitFor(() => {
        expect(screen.getByText(/copied!/i)).toBeInTheDocument()
      })
    })

    it('should export logs to file', async () => {
      render(<StatusPanel {...mockProps} />)
      
      const debugTab = screen.getByRole('tab', { selected: false })
      fireEvent.click(debugTab)
      
      await waitFor(() => {
        const exportButton = screen.getByText(/export/i)
        fireEvent.click(exportButton)
      })
      
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })

    it('should clear logs when clear button is clicked', async () => {
      // Set up initial logs
      window.debugLogs = [...mockDebugLogs]
      
      render(<StatusPanel {...mockProps} />)
      
      const debugTab = screen.getByRole('tab', { selected: false })
      fireEvent.click(debugTab)
      
      // Wait for logs to appear
      await waitFor(() => {
        expect(screen.getByText(/App initialized successfully/)).toBeInTheDocument()
      }, { timeout: 1000 })
      
      await waitFor(() => {
        const clearButton = screen.getByText(/clear/i)
        fireEvent.click(clearButton)
      })
      
      // After clear, logs should be empty
      await waitFor(() => {
        expect(screen.getByText(/No debug logs yet/)).toBeInTheDocument()
      })
    })
  })

  it('should maintain collapse functionality for entire panel', () => {
    render(<StatusPanel {...mockProps} />)
    
    const collapseButton = screen.getByTestId('status-toggle-collapse')
    fireEvent.click(collapseButton)
    
    const panel = screen.getByTestId('status-panel')
    expect(panel.className).toContain('collapsed')
  })
})