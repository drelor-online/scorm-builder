import { describe, test, expect, beforeEach, vi } from 'vitest'
import { FileStorage } from './FileStorage'

// Mock the Tauri API core invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('FileStorage Queue Structure Bug', () => {
  let fileStorage: FileStorage
  let mockInvoke: any

  beforeEach(async () => {
    // Get the mocked invoke function
    const { invoke } = await import('@tauri-apps/api/core')
    mockInvoke = invoke as any

    fileStorage = new FileStorage()
    vi.clearAllMocks()
    
    // Mock successful project operations
    mockInvoke.mockImplementation((command: string, args?: any) => {
      if (command === 'load_project') {
        return Promise.resolve({
          course_data: { title: 'Test Course', difficulty: 1, template: 'default', topics: [] },
          course_seed_data: null,
          course_content: {},
          json_import_data: null
        })
      }
      if (command === 'save_project') {
        return Promise.resolve()
      }
      return Promise.resolve()
    })
  })

  test('should save actual data content, not queue wrapper structure', async () => {
    // Mock the project path directly to bypass openProject
    ;(fileStorage as any)._currentProjectPath = '/test/path.scorm'

    // The data we want to save
    const jsonImportData = {
      rawJson: '{"test": "data"}',
      validationResult: { isValid: true, data: { test: 'data' } },
      isLocked: true,
      isTreeVisible: true
    }

    // Save the JSON import data
    await fileStorage.saveContent('json-import-data', jsonImportData)

    // Wait for debounced save to complete
    await new Promise(resolve => setTimeout(resolve, 600)) // Wait longer than debounce time

    // Log all mock calls for debugging
    console.log('All mock invoke calls:', mockInvoke.mock.calls.map(call => call[0]))

    // Verify save_project was called
    expect(mockInvoke).toHaveBeenCalledWith('save_project', expect.any(Object))

    // Get the actual saved data from the mock call
    const saveCall = mockInvoke.mock.calls.find(call => call[0] === 'save_project')
    expect(saveCall).toBeDefined()
    const savedProjectData = saveCall![1].projectData

    // FAILING TEST: Currently this saves queue wrapper instead of actual data
    // The saved json_import_data should be the actual data, not wrapped in queue structure
    expect(savedProjectData.json_import_data).toEqual(jsonImportData)
    
    // Should NOT have queue wrapper keys
    expect(savedProjectData.json_import_data).not.toHaveProperty('key')
    expect(savedProjectData.json_import_data).not.toHaveProperty('data')
    expect(savedProjectData.json_import_data).not.toHaveProperty('retryCount')
    expect(savedProjectData.json_import_data).not.toHaveProperty('timestamp')
  })

  test('should retrieve correct data structure on load', async () => {
    // Mock a project with correctly saved json_import_data
    const correctData = {
      rawJson: '{"test": "data"}',
      validationResult: { isValid: true, data: { test: 'data' } },
      isLocked: true,
      isTreeVisible: true
    }

    mockInvoke.mockImplementation((command: string) => {
      if (command === 'load_project') {
        return Promise.resolve({
          course_data: { title: 'Test Course', difficulty: 1, template: 'default', topics: [] },
          json_import_data: correctData
        })
      }
      return Promise.resolve()
    })

    ;(fileStorage as any)._currentProjectPath = '/test/path.scorm'
    const retrieved = await fileStorage.getContent('json-import-data')

    // Should get back the correct structure
    expect(retrieved).toEqual(correctData)
    expect(retrieved.rawJson).toBe('{"test": "data"}')
    expect(retrieved.isLocked).toBe(true)
  })

  test('current implementation fails - saves queue wrapper instead of data', async () => {
    // Mock the project path directly
    ;(fileStorage as any)._currentProjectPath = '/test/path.scorm'

    const testData = { rawJson: '{"test": "data"}', isLocked: true }
    await fileStorage.saveContent('json-import-data', testData)

    // Wait for debounced save to complete
    await new Promise(resolve => setTimeout(resolve, 600))

    // Get the saved data structure
    const saveCall = mockInvoke.mock.calls.find(call => call[0] === 'save_project')
    if (!saveCall) {
      console.log('No save_project call found. All calls:', mockInvoke.mock.calls.map(call => call[0]))
      expect(saveCall).toBeDefined()
      return
    }
    const actualSaved = saveCall[1].projectData.json_import_data

    // FAILING TEST: This documents the bug - currently saves queue wrapper
    // This test should PASS once the bug is fixed
    if (actualSaved && typeof actualSaved === 'object') {
      // Check if it has the queue wrapper structure (this is the bug)
      const hasQueueStructure = actualSaved.hasOwnProperty('key') && 
                               actualSaved.hasOwnProperty('data') && 
                               actualSaved.hasOwnProperty('retryCount') && 
                               actualSaved.hasOwnProperty('timestamp')
      
      // This should be false (no queue wrapper), but currently it's true (bug)
      expect(hasQueueStructure).toBe(false)
    }
  })
})