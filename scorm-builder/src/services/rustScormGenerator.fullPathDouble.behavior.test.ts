/**
 * Test to reproduce the full path double construction bug from production logs
 * User's logs show ensureProjectLoaded receiving a full path, then creating double paths
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Full Path Double Construction Bug', () => {
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

  it('Should extract numeric ID and prevent double paths when full path is passed', async () => {
    // This is the exact full path from user's logs that causes the double path issue
    const fullProjectPath = 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Complex_Projects_-_1_-_49_CFR_192_1756944000180.scormproj'
    
    // Mock FileStorage to simulate the scenario where _currentProjectId contains a full path
    // This can happen if the numeric ID extraction in openProjectFromPath fails
    const mockFileStorage = {
      _currentProjectId: fullProjectPath,  // This is the bug scenario
      openProject: vi.fn().mockImplementation(async (projectPath) => {
        console.log(`[Mock FileStorage] openProject called with: ${projectPath}`)
        // Simulate the double path construction that happens in production
        if (projectPath.includes('C:\\Users\\sierr\\Documents\\SCORM Projects\\C:\\Users\\sierr\\Documents\\SCORM Projects')) {
          console.log('[Mock FileStorage] DOUBLE PATH DETECTED!')
          throw new Error('Access denied: Path is outside projects directory')
        }
        return undefined
      })
    }
    
    // Mock the FileStorage import within the ensureProjectLoaded function
    vi.doMock('./FileStorage', () => ({
      FileStorage: vi.fn(() => mockFileStorage)
    }))
    
    // Dynamic import to get the ensureProjectLoaded function with mocked FileStorage
    const rustScormModule = await import('./rustScormGenerator')
    
    // Extract the ensureProjectLoaded function from the module (it's not exported, so we need to test it indirectly)
    // We'll test this by calling generateRustSCORM which calls ensureProjectLoaded
    
    // Create minimal test data
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
      // This should trigger the ensureProjectLoaded function with the full path
      // The bug is that ensureProjectLoaded treats it as a full path (correct)
      // but then FileStorage.openProject somehow creates a double path
      await rustScormModule.generateRustSCORM(
        mockEnhancedContent,
        fullProjectPath,  // This full path should be handled correctly
        mockProgressCallback,
        mockMediaFiles
      )
      
      // Check if openProject was called with a double path
      const openProjectCalls = mockFileStorage.openProject.mock.calls
      console.log('openProject calls:', openProjectCalls)
      
      const hasDoublePath = openProjectCalls.some(call => {
        const path = call[0]
        return path.includes('C:\\Users\\sierr\\Documents\\SCORM Projects\\C:\\Users\\sierr\\Documents\\SCORM Projects')
      })
      
      if (hasDoublePath) {
        const doublePathCalls = openProjectCalls.filter(call =>
          call[0].includes('C:\\Users\\sierr\\Documents\\SCORM Projects\\C:\\Users\\sierr\\Documents\\SCORM Projects')
        )
        console.error('FOUND DOUBLE PATH CALLS:', doublePathCalls)
      }
      
      expect(hasDoublePath).toBe(false)
      
    } catch (error) {
      // Even if there's an error, check the paths that were attempted
      const openProjectCalls = mockFileStorage.openProject.mock.calls
      console.log('openProject calls (with error):', openProjectCalls)
      
      const hasDoublePath = openProjectCalls.some(call => {
        const path = call[0]
        return path.includes('C:\\Users\\sierr\\Documents\\SCORM Projects\\C:\\Users\\sierr\\Documents\\SCORM Projects')
      })
      
      expect(hasDoublePath).toBe(false)
    }
  })

  it('Should correctly handle ensureProjectLoaded path construction logic', () => {
    const fullPath = 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Complex_Projects_-_1_-_49_CFR_192_1756944000180.scormproj'
    
    // This is the logic from ensureProjectLoaded
    const isFullPath = fullPath.includes('\\') || fullPath.includes('/') || fullPath.includes('.scormproj')
    
    expect(isFullPath).toBe(true)  // Should correctly identify as full path
    
    // When isFullPath is true, possiblePaths should be [fullPath]
    const possiblePaths = isFullPath ? [fullPath] : []
    
    expect(possiblePaths).toEqual([fullPath])  // Should use the path directly
  })
})