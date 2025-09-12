import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { StatusPanel } from './StatusPanel'
import type { StatusMessage } from './StatusPanel'

// Mock REAL logs as they actually appear from ultraSimpleLogger
const mockRealLogs = [
  '[2024-01-15T10:30:15.123Z] [MediaService] ERROR: Failed to load video: network timeout',
  '[2024-01-15T10:29:45.456Z] [FileStorage] WARN: Large file detected, may slow down processing',  
  '[2024-01-15T10:29:30.789Z] [CourseSeedInput] Course data auto-saved successfully',
  '[2024-01-15T10:29:00.012Z] [UnifiedMediaContext] DEBUG: Cache hit for media item: video-1',
  '[2024-01-15T10:25:15.345Z] [SCORMPackageBuilder] Package built successfully in 2.3s',
  '[2024-01-15T10:20:30.678Z] [AudioNarrationWizard] ERROR: TTS service unavailable',
  '[2024-01-15T10:15:45.901Z] [MediaService] WARN: Video compression quality reduced',
  '[2024-01-15T10:10:30.234Z] [TemplateEditor] Template validation completed',
  '[2024-01-15T10:05:15.567Z] [FileStorage] DEBUG: File chunk uploaded: chunk-3',
  '[2024-01-15T10:00:00.890Z] [AudioNarrationWizard] Audio narration generated'
]

// Mock the window.debugLogs with REAL format
beforeEach(() => {
  (window as any).debugLogs = [...mockRealLogs]
})

describe('StatusPanel - Real Log Format Issues', () => {
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

  test('should parse real ultraSimpleLogger format correctly', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to load
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Should show logs with real format
    expect(screen.getByText(/Failed to load video: network timeout/)).toBeInTheDocument()
    expect(screen.getByText(/Large file detected/)).toBeInTheDocument()
    expect(screen.getByText(/Course data auto-saved successfully/)).toBeInTheDocument()
  })

  test('should extract log levels from REAL format (ERROR:, WARN:, DEBUG:)', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to load
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Click "Errors Only" button - should work with real format
    const errorButton = screen.getByRole('button', { name: /show only errors/i })
    fireEvent.click(errorButton)
    
    // Should show ERROR logs from real format
    expect(screen.getByText(/Failed to load video/)).toBeInTheDocument() // Has "ERROR:" in message
    expect(screen.getByText(/TTS service unavailable/)).toBeInTheDocument() // Has "ERROR:" in message
    expect(screen.queryByText(/Large file detected/)).not.toBeInTheDocument() // Is WARN:, should be filtered out
    expect(screen.queryByText(/Course data auto-saved/)).not.toBeInTheDocument() // No level prefix, should be filtered out
  })

  test('should extract components from REAL format [ComponentName]', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to load
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Should populate component dropdown with real components
    const componentFilter = screen.getByDisplayValue('All Components')
    expect(componentFilter.querySelector('option[value="MediaService"]')).toBeInTheDocument()
    expect(componentFilter.querySelector('option[value="FileStorage"]')).toBeInTheDocument()
    expect(componentFilter.querySelector('option[value="CourseSeedInput"]')).toBeInTheDocument()
    
    // Test component filtering
    fireEvent.change(componentFilter, { target: { value: 'MediaService' } })
    
    // Should only show MediaService logs
    expect(screen.getByText(/Failed to load video/)).toBeInTheDocument()
    expect(screen.getByText(/Video compression quality reduced/)).toBeInTheDocument()
    expect(screen.queryByText(/Large file detected/)).not.toBeInTheDocument() // FileStorage, should be hidden
  })

  test('should parse ISO timestamps from REAL format', async () => {
    // Mock current time to make time filtering predictable
    const mockNow = new Date('2024-01-15T10:30:00.000Z').getTime()
    vi.spyOn(Date, 'now').mockReturnValue(mockNow)
    
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to load
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Click "Last 5 minutes" button
    const last5MinButton = screen.getByRole('button', { name: /^Last 5 minutes$/i })
    fireEvent.click(last5MinButton)
    
    // Should show logs from last 5 minutes (after 10:25:00)
    expect(screen.getByText(/Failed to load video/)).toBeInTheDocument() // 10:30:15
    expect(screen.getByText(/Large file detected/)).toBeInTheDocument()  // 10:29:45
    expect(screen.getByText(/Course data auto-saved/)).toBeInTheDocument() // 10:29:30
    expect(screen.getByText(/Cache hit/)).toBeInTheDocument() // 10:29:00
    expect(screen.getByText(/Package built successfully/)).toBeInTheDocument() // 10:25:15
    expect(screen.queryByText(/TTS service unavailable/)).not.toBeInTheDocument() // 10:20:30 - outside 5 min window
    
    vi.restoreAllMocks()
  })

  test('should handle logs without explicit level markers (INFO level)', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to load
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Click "Info Only" button
    const infoButton = screen.getByRole('button', { name: /show only info/i })
    fireEvent.click(infoButton)
    
    // Should show logs without ERROR:/WARN:/DEBUG: prefixes (treated as INFO)
    expect(screen.getByText(/Course data auto-saved successfully/)).toBeInTheDocument() // No prefix = INFO
    expect(screen.getByText(/Template validation completed/)).toBeInTheDocument() // No prefix = INFO  
    expect(screen.getByText(/Package built successfully/)).toBeInTheDocument() // No prefix = INFO
    expect(screen.getByText(/Audio narration generated/)).toBeInTheDocument() // No prefix = INFO
    expect(screen.queryByText(/Failed to load video/)).not.toBeInTheDocument() // Has ERROR: prefix
    expect(screen.queryByText(/Large file detected/)).not.toBeInTheDocument() // Has WARN: prefix
  })

  test('should show all logs when filter is "ALL"', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to load
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Should show all logs by default (ALL filter active)
    expect(screen.getByText(/Failed to load video/)).toBeInTheDocument() // ERROR
    expect(screen.getByText(/Large file detected/)).toBeInTheDocument() // WARN
    expect(screen.getByText(/Course data auto-saved/)).toBeInTheDocument() // INFO
    expect(screen.getByText(/Cache hit/)).toBeInTheDocument() // DEBUG
    expect(screen.getByText(/Package built successfully/)).toBeInTheDocument() // INFO
  })
})