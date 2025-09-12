import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { StatusPanel } from './StatusPanel'
import type { StatusMessage } from './StatusPanel'

// Mock comprehensive debug logs in REAL ultraSimpleLogger format
const mockLogs = [
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

// Mock the window.debugLogs
beforeEach(() => {
  (window as any).debugLogs = [...mockLogs]
})

describe('StatusPanel - Enhanced Filtering Features', () => {
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

  test('should display quick filter buttons for log levels', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for component to render
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Should show quick filter buttons for each log level
    expect(screen.getByRole('button', { name: /show only errors/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show only warnings/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show only info/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show only debug/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show only success/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show all levels/i })).toBeInTheDocument()
  })

  test('should filter logs when quick filter button is clicked', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to load
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Initially should show all logs
    expect(screen.getByText(/Failed to load video/)).toBeInTheDocument()
    expect(screen.getByText(/Large file detected/)).toBeInTheDocument()
    expect(screen.getByText(/Course data auto-saved/)).toBeInTheDocument()
    
    // Click "Errors Only" button
    const errorButton = screen.getByRole('button', { name: /show only errors/i })
    fireEvent.click(errorButton)
    
    // Should only show error logs
    expect(screen.getByText(/Failed to load video/)).toBeInTheDocument()
    expect(screen.getByText(/TTS service unavailable/)).toBeInTheDocument()
    expect(screen.queryByText(/Large file detected/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Course data auto-saved/)).not.toBeInTheDocument()
  })

  test('should display time-based filter buttons', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Should show time-based filter buttons
    expect(screen.getByRole('button', { name: /last 5 minutes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /last 15 minutes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /last hour/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /all time/i })).toBeInTheDocument()
  })

  test('should filter logs based on time when time filter is applied', async () => {
    // Mock current time to make time filtering predictable
    const mockNow = new Date('2024-01-15T10:30:00').getTime()
    vi.spyOn(Date, 'now').mockReturnValue(mockNow)
    
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to load
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Verify logs are loaded first
    expect(screen.getByText(/Failed to load video/)).toBeInTheDocument()
    expect(screen.getByText(/Package built successfully/)).toBeInTheDocument()
    
    // Click "Last 5 minutes" button
    const last5MinButton = screen.getByRole('button', { name: /^Last 5 minutes$/i })
    fireEvent.click(last5MinButton)
    
    // Wait a bit for filter to apply
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Should only show logs from last 5 minutes (after 10:25:00.000Z)
    // All logs from 10:25:15 (inclusive) to 10:30:15 should be visible
    expect(screen.getByText(/Failed to load video/)).toBeInTheDocument() // 10:30:15 - within window
    expect(screen.getByText(/Large file detected/)).toBeInTheDocument()  // 10:29:45 - within window
    expect(screen.getByText(/Course data auto-saved/)).toBeInTheDocument() // 10:29:30 - within window
    expect(screen.getByText(/Cache hit/)).toBeInTheDocument() // 10:29:00 - within window
    expect(screen.getByText(/Package built successfully/)).toBeInTheDocument() // 10:25:15 - exactly at threshold
    expect(screen.queryByText(/TTS service unavailable/)).not.toBeInTheDocument() // 10:20:30 - outside window
    
    vi.restoreAllMocks()
  })

  test('should display component-based filter dropdown', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Should show component filter dropdown
    const componentFilter = screen.getByDisplayValue('All Components')
    expect(componentFilter).toBeInTheDocument()
    
    // Should have options for each component found in logs
    fireEvent.click(componentFilter)
    await waitFor(() => {
      // Use more specific selectors to find options in the dropdown
      expect(componentFilter.querySelector('option[value="MediaService"]')).toBeInTheDocument()
      expect(componentFilter.querySelector('option[value="FileStorage"]')).toBeInTheDocument()
      expect(componentFilter.querySelector('option[value="CourseSeedInput"]')).toBeInTheDocument()
      expect(componentFilter.querySelector('option[value="UnifiedMediaContext"]')).toBeInTheDocument()
      expect(componentFilter.querySelector('option[value="SCORMPackageBuilder"]')).toBeInTheDocument()
      expect(componentFilter.querySelector('option[value="AudioNarrationWizard"]')).toBeInTheDocument()
      expect(componentFilter.querySelector('option[value="TemplateEditor"]')).toBeInTheDocument()
    })
  })

  test('should filter logs by component when component filter is selected', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to load
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Select MediaService from component filter
    const componentFilter = screen.getByDisplayValue('All Components')
    fireEvent.change(componentFilter, { target: { value: 'MediaService' } })
    
    // Should only show MediaService logs
    expect(screen.getByText(/Failed to load video/)).toBeInTheDocument()
    expect(screen.getByText(/Video compression quality reduced/)).toBeInTheDocument()
    expect(screen.queryByText(/Large file detected/)).not.toBeInTheDocument() // FileStorage
    expect(screen.queryByText(/Course data auto-saved/)).not.toBeInTheDocument() // CourseSeedInput
  })

  test('should maintain enhanced search functionality with highlighted matches', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to load
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Use the search input
    const searchInput = screen.getByPlaceholderText('Search logs...')
    fireEvent.change(searchInput, { target: { value: 'video' } })
    
    // Should show only logs containing "video"
    expect(screen.getByText(/Failed to load video/)).toBeInTheDocument()
    expect(screen.getByText(/Cache hit for media item: video-1/)).toBeInTheDocument()
    expect(screen.queryByText(/Large file detected/)).not.toBeInTheDocument()
    
    // TODO: In implementation, search matches should be highlighted
    // This test establishes the expectation for highlighting functionality
  })

  test('should combine multiple filters (level + component + search)', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to load
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Apply multiple filters:
    // 1. Show only errors
    const errorButton = screen.getByRole('button', { name: /show only errors/i })
    fireEvent.click(errorButton)
    
    // 2. Filter by MediaService component
    const componentFilter = screen.getByDisplayValue('All Components')
    fireEvent.change(componentFilter, { target: { value: 'MediaService' } })
    
    // 3. Search for "video"
    const searchInput = screen.getByPlaceholderText('Search logs...')
    fireEvent.change(searchInput, { target: { value: 'video' } })
    
    // Should only show MediaService error logs containing "video"
    expect(screen.getByText(/Failed to load video/)).toBeInTheDocument()
    expect(screen.queryByText(/TTS service unavailable/)).not.toBeInTheDocument() // Different component
    expect(screen.queryByText(/Video compression quality reduced/)).not.toBeInTheDocument() // WARN level, not ERROR
  })

  test('should show active filter indicators', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for debug panel to render
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Apply a filter
    const errorButton = screen.getByRole('button', { name: /show only errors/i })
    fireEvent.click(errorButton)
    
    // Wait for filter indicator to appear
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Should show active filter indicator
    expect(screen.getByText(/active filters:/i)).toBeInTheDocument()
    expect(screen.getByText(/error only/i)).toBeInTheDocument()
    
    // Should have clear all filters button
    expect(screen.getByRole('button', { name: /clear all filters/i })).toBeInTheDocument()
  })

  test('should clear all filters when clear filters button is clicked', async () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Switch to debug tab
    const debugTab = screen.getByRole('tab', { name: /debug logs/i })
    fireEvent.click(debugTab)
    
    // Wait for logs to load
    await new Promise(resolve => setTimeout(resolve, 600))
    
    // Apply multiple filters
    const errorButton = screen.getByRole('button', { name: /show only errors/i })
    fireEvent.click(errorButton)
    
    const componentFilter = screen.getByDisplayValue('All Components')
    fireEvent.change(componentFilter, { target: { value: 'MediaService' } })
    
    const searchInput = screen.getByPlaceholderText('Search logs...')
    fireEvent.change(searchInput, { target: { value: 'video' } })
    
    // Clear all filters
    const clearButton = screen.getByRole('button', { name: /clear all filters/i })
    fireEvent.click(clearButton)
    
    // All filters should be reset
    expect(screen.getByText(/Failed to load video/)).toBeInTheDocument()
    expect(screen.getByText(/Large file detected/)).toBeInTheDocument()
    expect(screen.getByText(/Course data auto-saved/)).toBeInTheDocument()
    expect(componentFilter).toHaveValue('All Components')
    expect(searchInput).toHaveValue('')
  })
})