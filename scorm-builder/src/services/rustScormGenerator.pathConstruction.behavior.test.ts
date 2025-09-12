/**
 * Test to reproduce the path construction bug in ensureProjectLoaded function
 * The bug creates invalid double paths like:
 * C:\Users\sierr\Documents\SCORM Projects\C:\Users\sierr\Documents\SCORM Projects\Complex_Projects...
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Path Construction Bug in ensureProjectLoaded', () => {
  // Mock console to capture the path construction attempts
  let consoleLogSpy: any
  
  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  
  afterEach(() => {
    consoleLogSpy?.mockRestore()
  })

  it('should reproduce the double path construction bug', async () => {
    // Import the module that contains ensureProjectLoaded
    const { convertToRustFormat } = await import('./rustScormGenerator')
    
    // This is the actual projectId that causes the issue (full path instead of just ID)
    const FULL_PROJECT_PATH = 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Complex_Projects_-_1_-_49_CFR_192_1756944000180.scormproj'
    
    // Mock course content
    const mockCourseContent = {
      welcome: { heading: 'Welcome' },
      objectives: { heading: 'Learning Objectives' },
      topics: [{ heading: 'Topic 1' }]
    }

    console.log('[PATH TEST] Testing with full project path as projectId')
    console.log('[PATH TEST] Input projectId:', FULL_PROJECT_PATH)
    
    try {
      // This should trigger the ensureProjectLoaded function with the full path
      // which will cause the double path construction bug
      await convertToRustFormat(mockCourseContent, FULL_PROJECT_PATH)
    } catch (error) {
      // Expected to fail, but we want to check the console logs
      console.log('[PATH TEST] Conversion failed as expected:', error instanceof Error ? error.message : error)
    }
    
    // Check the console logs for evidence of double path construction
    const logs = consoleLogSpy.mock.calls.map(call => call.join(' '))
    const pathLogs = logs.filter(log => log.includes('Trying to open:'))
    
    console.log('[PATH TEST] Captured path construction attempts:')
    pathLogs.forEach(log => console.log('[PATH TEST]', log))
    
    // Look for the bug: paths that contain the projects directory twice
    const doublePathLogs = pathLogs.filter(log => 
      (log.match(/SCORM Projects/g) || []).length >= 2
    )
    
    console.log('[PATH TEST] Double paths found:', doublePathLogs.length)
    
    if (doublePathLogs.length > 0) {
      console.log('[PATH TEST] ❌ BUG REPRODUCED: Found double path construction')
      doublePathLogs.forEach(log => console.log('[PATH TEST] Double path:', log))
      
      // This test should fail until we fix the bug
      expect(doublePathLogs.length).toBe(0) // This will FAIL, demonstrating the bug
    } else {
      console.log('[PATH TEST] ✅ No double paths found - bug may be fixed')
      expect(doublePathLogs.length).toBe(0) // This will PASS if bug is fixed
    }
  })
  
  it('should handle project ID correctly when given just the ID', async () => {
    const { convertToRustFormat } = await import('./rustScormGenerator')
    
    // Test with just the project ID (not full path)
    const PROJECT_ID = '1756944000180'
    
    const mockCourseContent = {
      welcome: { heading: 'Welcome' },
      objectives: { heading: 'Learning Objectives' },
      topics: [{ heading: 'Topic 1' }]
    }

    console.log('[PATH TEST] Testing with project ID only')
    console.log('[PATH TEST] Input projectId:', PROJECT_ID)
    
    try {
      await convertToRustFormat(mockCourseContent, PROJECT_ID)
    } catch (error) {
      console.log('[PATH TEST] Conversion failed:', error instanceof Error ? error.message : error)
    }
    
    // Check the console logs
    const logs = consoleLogSpy.mock.calls.map(call => call.join(' '))
    const pathLogs = logs.filter(log => log.includes('Trying to open:'))
    
    console.log('[PATH TEST] Captured path construction attempts with ID:')
    pathLogs.forEach(log => console.log('[PATH TEST]', log))
    
    // With just an ID, there should be no double paths
    const doublePathLogs = pathLogs.filter(log => 
      (log.match(/SCORM Projects/g) || []).length >= 2
    )
    
    console.log('[PATH TEST] Double paths with ID input:', doublePathLogs.length)
    expect(doublePathLogs.length).toBe(0) // This should pass with ID-only input
  })
  
  it('should demonstrate the correct path construction logic needed', () => {
    // This test documents what the fix should do
    
    const FULL_PATH = 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Complex_Projects_-_1_-_49_CFR_192_1756944000180.scormproj'
    const PROJECT_ID = '1756944000180'
    const PROJECTS_BASE = 'C:\\Users\\sierr\\Documents\\SCORM Projects'
    
    console.log('[PATH TEST] Demonstrating correct path construction logic')
    
    // Function to determine if input is a full path vs project ID
    function isFullPath(input: string): boolean {
      return input.includes('\\') || input.includes('/') || input.includes('.scormproj')
    }
    
    // Function to construct correct paths based on input type
    function constructCorrectPaths(input: string): string[] {
      if (isFullPath(input)) {
        console.log('[PATH TEST] Input is full path, using as-is:', input)
        return [input] // Use the full path directly
      } else {
        console.log('[PATH TEST] Input is project ID, constructing paths:', input)
        return [
          `${PROJECTS_BASE}\\${input}.scormproj`,
          `${PROJECTS_BASE}\\Complex_Projects_-_1_-_49_CFR_192_${input}.scormproj`
        ]
      }
    }
    
    // Test with full path
    const pathsFromFullPath = constructCorrectPaths(FULL_PATH)
    console.log('[PATH TEST] Paths from full path:', pathsFromFullPath)
    expect(pathsFromFullPath).toEqual([FULL_PATH])
    expect(pathsFromFullPath.every(path => !path.includes('SCORM Projects\\C:\\'))).toBe(true)
    
    // Test with project ID
    const pathsFromId = constructCorrectPaths(PROJECT_ID)
    console.log('[PATH TEST] Paths from ID:', pathsFromId)
    expect(pathsFromId.length).toBe(2)
    expect(pathsFromId.every(path => !path.includes('SCORM Projects\\C:\\'))).toBe(true)
    
    console.log('[PATH TEST] ✅ Correct path construction logic demonstrated')
  })
})