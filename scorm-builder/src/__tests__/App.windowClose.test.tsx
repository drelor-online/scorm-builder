import React from 'react'
import { render, waitFor } from '../test/testProviders'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import App from '../App'

// Mock Tauri API
const mockClose = vi.fn()
const mockOnCloseRequested = vi.fn()
const mockUnlisten = vi.fn()

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    close: mockClose,
    onCloseRequested: mockOnCloseRequested.mockImplementation((handler) => {
      // Store the handler for testing
      (window as any).__closeHandler = handler
      // Return unlisten function
      return Promise.resolve(mockUnlisten)
    })
  })
}))

// Mock FileStorage
vi.mock('../services/FileStorage', () => ({
  FileStorage: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    cancelAllPendingSaves: vi.fn(),
    getProjectList: vi.fn().mockResolvedValue([]),
    getContent: vi.fn().mockResolvedValue(null),
    saveContent: vi.fn().mockResolvedValue(undefined),
    getCourseMetadata: vi.fn().mockResolvedValue(null),
    saveCourseMetadata: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Mock debugLogger
vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    createBugReport: vi.fn().mockReturnValue('mock-bug-report'),
    exportToFile: vi.fn().mockResolvedValue(undefined),
    writeToFile: vi.fn()
  }
}))

describe('App - Window Close Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (window as any).__closeHandler
  })
  
  afterEach(() => {
    delete (window as any).__closeHandler
  })
  
  it('should set up close handler on mount', async () => {
    render(<App />)
    
    // Wait for effect to run
    await waitFor(() => {
      expect(mockOnCloseRequested).toHaveBeenCalled()
    })
    
    // Verify handler was registered
    expect((window as any).__closeHandler).toBeDefined()
  })
  
  it('should prevent default close and perform cleanup', async () => {
    render(<App />)
    
    // Wait for handler to be set up
    await waitFor(() => {
      expect((window as any).__closeHandler).toBeDefined()
    })
    
    // Create mock event
    const mockEvent = {
      preventDefault: vi.fn()
    }
    
    // Call the close handler
    const handler = (window as any).__closeHandler
    await handler(mockEvent)
    
    // Should prevent default
    expect(mockEvent.preventDefault).toHaveBeenCalled()
    
    // Should eventually close the window
    await waitFor(() => {
      expect(mockClose).toHaveBeenCalled()
    }, { timeout: 200 })
  })
  
  it('should unlisten before closing to prevent infinite loop', async () => {
    render(<App />)
    
    // Wait for handler to be set up
    await waitFor(() => {
      expect((window as any).__closeHandler).toBeDefined()
    })
    
    // Reset mocks to track order
    mockUnlisten.mockClear()
    mockClose.mockClear()
    
    // Create mock event
    const mockEvent = {
      preventDefault: vi.fn()
    }
    
    // Modify close handler to check if unlisten is called
    const originalHandler = (window as any).__closeHandler
    let unlistenCalled = false
    mockUnlisten.mockImplementation(() => {
      unlistenCalled = true
    })
    
    // Mock close to verify unlisten was called first
    mockClose.mockImplementation(() => {
      if (!unlistenCalled) {
        throw new Error('close() called before unlisten()')
      }
      return Promise.resolve()
    })
    
    // Call the close handler
    await originalHandler(mockEvent)
    
    // Wait for close to be called
    await waitFor(() => {
      expect(mockClose).toHaveBeenCalled()
    }, { timeout: 200 })
    
    // This test will fail until we fix the implementation
    // because currently unlisten is never called
    expect(mockUnlisten).toHaveBeenCalled()
  })
  
  it('should not create recursive close calls', async () => {
    render(<App />)
    
    // Wait for handler to be set up
    await waitFor(() => {
      expect((window as any).__closeHandler).toBeDefined()
    })
    
    // Create mock event
    const mockEvent = {
      preventDefault: vi.fn()
    }
    
    // Track how many times close is called
    let closeCallCount = 0
    mockClose.mockImplementation(() => {
      closeCallCount++
      
      // If close is called more than once, we have a recursion problem
      if (closeCallCount > 1) {
        throw new Error('Recursive close detected!')
      }
      
      // Simulate the close event being triggered again
      // (this is what happens in the real Tauri environment)
      if ((window as any).__closeHandler && closeCallCount === 1) {
        // This would normally trigger the handler again if not unlistened
        // but we'll skip it for this test to avoid infinite loop in test
      }
      
      return Promise.resolve()
    })
    
    // Call the close handler
    const handler = (window as any).__closeHandler
    await handler(mockEvent)
    
    // Wait a bit to ensure no recursive calls
    await waitFor(() => {
      expect(mockClose).toHaveBeenCalledTimes(1)
    }, { timeout: 200 })
    
    // Verify only called once
    expect(closeCallCount).toBe(1)
  })
})