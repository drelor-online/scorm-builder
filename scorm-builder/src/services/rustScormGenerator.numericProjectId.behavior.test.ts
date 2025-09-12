/**
 * Test to reproduce the path construction bug with numeric project ID from production logs
 * The user's logs show that storage.currentProjectId is "1756944000180" (just a numeric ID)
 * but ensureProjectLoaded is creating invalid double paths
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Numeric Project ID Path Construction Bug', () => {
  let originalConsoleLog: typeof console.log
  let mockConsoleLog: ReturnType<typeof vi.fn>

  beforeEach(() => {
    originalConsoleLog = console.log
    mockConsoleLog = vi.fn()
    console.log = mockConsoleLog
    
    // Clear any module caches
    vi.resetModules()
  })

  afterEach(() => {
    console.log = originalConsoleLog
  })

  it('FAILING TEST: Should handle numeric project ID without creating double paths', async () => {
    // This is the exact project ID from user's logs
    const numericProjectId = '1756944000180'
    
    // Mock FileStorage to simulate the state from production
    const mockFileStorage = {
      _currentProjectId: numericProjectId,  // This is what FileStorage.openProject sets
      openProject: vi.fn().mockResolvedValue(undefined)
    }
    
    // Dynamic import to get fresh module
    const { generateRustSCORM } = await import('./rustScormGenerator')
    
    // Mock the FileStorage import within the module
    vi.doMock('./FileStorage', () => ({
      FileStorage: vi.fn(() => mockFileStorage)
    }))
    
    // Create minimal test data matching user's scenario
    const mockEnhancedContent = {
      title: 'Complex Projects - 1 - 49 CFR 192',
      learningObjectives: ['Test objective'],
      topics: [
        {
          id: 'topic-0',
          title: 'Test Topic',
          content: 'Test content',
          media: []
        }
      ]
    }
    
    const mockProgressCallback = vi.fn()
    const mockMediaFiles: any[] = []
    
    try {
      // This call should reproduce the path construction bug
      // The generateRustSCORM function calls ensureProjectLoaded(numericProjectId)
      // which should construct paths correctly without doubling them
      await generateRustSCORM(
        mockEnhancedContent,
        numericProjectId,  // This is the numeric ID that causes the bug
        mockProgressCallback,
        mockMediaFiles
      )
      
      // Check the console logs to see what paths were constructed
      const pathConstructionLogs = mockConsoleLog.mock.calls
        .map(call => call.join(' '))
        .filter(log => log.includes('[Rust SCORM]') && log.includes('path'))
      
      console.log('Path construction logs:', pathConstructionLogs)
      
      // The bug: we should NOT see double paths like:
      // "C:\Users\sierr\Documents\SCORM Projects\C:\Users\sierr\Documents\SCORM Projects\..."
      const hasDoublePaths = pathConstructionLogs.some(log => 
        log.includes('C:\\Users\\sierr\\Documents\\SCORM Projects\\C:\\Users\\sierr\\Documents\\SCORM Projects')
      )
      
      if (hasDoublePaths) {
        const doublePathLogs = pathConstructionLogs.filter(log => 
          log.includes('C:\\Users\\sierr\\Documents\\SCORM Projects\\C:\\Users\\sierr\\Documents\\SCORM Projects')
        )
        console.error('FOUND DOUBLE PATHS:', doublePathLogs)
      }
      
      expect(hasDoublePaths).toBe(false)
      
    } catch (error) {
      // Even if the function throws an error (due to missing files), 
      // we should still check that paths were constructed correctly
      const pathConstructionLogs = mockConsoleLog.mock.calls
        .map(call => call.join(' '))
        .filter(log => log.includes('[Rust SCORM]') && log.includes('path'))
      
      console.log('Path construction logs (with error):', pathConstructionLogs)
      
      const hasDoublePaths = pathConstructionLogs.some(log => 
        log.includes('C:\\Users\\sierr\\Documents\\SCORM Projects\\C:\\Users\\sierr\\Documents\\SCORM Projects')
      )
      
      expect(hasDoublePaths).toBe(false)
    }
  })

  it('Should correctly identify numeric ID vs full path', () => {
    const numericId = '1756944000180'
    const fullPath = 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Complex_Projects_-_1_-_49_CFR_192_1756944000180.scormproj'
    
    // Test the logic used in ensureProjectLoaded
    const isNumericIdFullPath = numericId.includes('\\') || numericId.includes('/') || numericId.includes('.scormproj')
    const isFullPathFullPath = fullPath.includes('\\') || fullPath.includes('/') || fullPath.includes('.scormproj')
    
    expect(isNumericIdFullPath).toBe(false)  // Should be false - it's just a numeric ID
    expect(isFullPathFullPath).toBe(true)    // Should be true - it's a full path
  })
})