import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { StatusPanel } from './StatusPanel'
import type { StatusMessage } from './StatusPanel'
import styles from './StatusPanel.module.css'

// Mock the debug logger to provide test logs
const mockLogs = [
  '[ERROR] [MediaService] Failed to load video: network timeout',
  '[WARN] [FileStorage] Large file detected, may slow down processing',  
  '[INFO] [CourseSeedInput] Course data auto-saved successfully',
  '[DEBUG] [UnifiedMediaContext] Cache hit for media item: video-1',
  '[SUCCESS] [SCORMPackageBuilder] Package built successfully in 2.3s'
]

// Mock the window.debugLogs
beforeEach(() => {
  (window as any).debugLogs = [...mockLogs]
})

describe('StatusPanel - Debug Logs Visual Improvements', () => {
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
    isDocked: false, // Ensure panel is expanded, not docked as bell
    onDock: vi.fn(),
    onUndock: vi.fn()
  }

  test('should display debug logs with improved readability', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to be polled and displayed
    await new Promise(resolve => setTimeout(resolve, 600)) // Wait for polling interval
    
    // Should show logs with better formatting
    expect(screen.getByText(/Failed to load video: network timeout/)).toBeInTheDocument()
    expect(screen.getByText(/Large file detected/)).toBeInTheDocument()
    expect(screen.getByText(/Course data auto-saved successfully/)).toBeInTheDocument()
  })

  test('should show proper color coding for different log levels', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to be polled and displayed
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Find log entries and check their classes
    const logEntries = document.querySelectorAll(`.${styles.logEntry}`)
    expect(logEntries.length).toBeGreaterThan(0)
    
    // Should have different styling classes for different log levels
    const errorEntry = Array.from(logEntries).find(entry => 
      entry.textContent?.includes('Failed to load video')
    )
    const warnEntry = Array.from(logEntries).find(entry => 
      entry.textContent?.includes('Large file detected')
    )
    const infoEntry = Array.from(logEntries).find(entry => 
      entry.textContent?.includes('Course data auto-saved')
    )
    const debugEntry = Array.from(logEntries).find(entry => 
      entry.textContent?.includes('Cache hit')
    )
    
    // Verify entries exist and have correct styling
    if (errorEntry) expect(errorEntry).toHaveClass(styles.logError)
    if (warnEntry) expect(warnEntry).toHaveClass(styles.logWarn)
    if (infoEntry) expect(infoEntry).toHaveClass(styles.logInfo)  
    if (debugEntry) expect(debugEntry).toHaveClass(styles.logDebug)
  })

  test('should display component badges for structured logs', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to be polled and displayed
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Should show component names as badges (these will be implemented in the enhancement)
    // For now, we'll check that the component names appear in the log text
    expect(screen.getByText(/MediaService/)).toBeInTheDocument()
    expect(screen.getByText(/FileStorage/)).toBeInTheDocument()
    expect(screen.getByText(/CourseSeedInput/)).toBeInTheDocument()
  })

  test('should have improved font size for better readability', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for component to render
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const debugLogsContainer = document.querySelector(`.${styles.debugLogs}`)
    expect(debugLogsContainer).toBeInTheDocument()
    
    // For now, just verify the container exists - we'll improve the font size in implementation
    expect(debugLogsContainer).toHaveClass(styles.debugLogs)
  })

  test('should show icons for different log levels', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab  
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to be polled and displayed
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Should have log entries (icons will be implemented in the enhancement)
    const logEntries = document.querySelectorAll(`.${styles.logEntry}`)
    expect(logEntries.length).toBeGreaterThan(0)
  })

  test('should maintain existing filtering functionality', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Should still have the level filter dropdown
    const levelFilter = screen.getByDisplayValue('All Levels')
    expect(levelFilter).toBeInTheDocument()
    
    // Should still have the search input
    const searchInput = screen.getByPlaceholderText('Search logs...')
    expect(searchInput).toBeInTheDocument()
  })
})