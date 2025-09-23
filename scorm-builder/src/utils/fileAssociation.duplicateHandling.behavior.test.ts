/**
 * Test for fileAssociation duplicate handling behavior
 *
 * BUG SCENARIO:
 * 1. User double-clicks "MyProject.scormproj" → creates project folder with ID "myproject-1234567890"
 * 2. User double-clicks same file again → creates ANOTHER folder "myproject-1234567891"
 * 3. Expected: Should detect existing project and reuse it or prompt for action
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { handleFileAssociation } from './fileAssociation'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn()
}))

// Mock the importProject function
vi.mock('../services/ProjectExportImport', () => ({
  importProject: vi.fn()
}))

describe('FileAssociation Duplicate Handling', () => {
  let mockInvoke: any
  let mockListen: any
  let mockReadFile: any
  let mockImportProject: any

  const mockCallbacks = {
    onProjectOpened: vi.fn(),
    onError: vi.fn(),
    onUnsavedChanges: vi.fn()
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Get the mocked functions
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')
    const { readFile } = await import('@tauri-apps/plugin-fs')
    const { importProject } = await import('../services/ProjectExportImport')

    mockInvoke = vi.mocked(invoke)
    mockListen = vi.mocked(listen)
    mockReadFile = vi.mocked(readFile)
    mockImportProject = vi.mocked(importProject)

    // Reset the Date.now mock for consistent testing
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))

    // Mock file reading to return a valid project file
    const mockProjectData = {
      metadata: {
        projectName: 'My Test Project',
        version: '1.0.0',
        exportDate: '2024-01-01T00:00:00Z'
      },
      courseData: {
        title: 'My Test Project',
        topics: []
      }
    }

    mockReadFile.mockResolvedValue(new Uint8Array([1, 2, 3, 4])) // Mock file data
    mockImportProject.mockResolvedValue({
      success: true,
      data: mockProjectData
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('should detect duplicate when same file is opened multiple times', async () => {
    const filePath = 'C:\\Users\\test\\Documents\\MyProject.scormproj'

    // Mock that a project with this name already exists
    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      if (cmd === 'check_project_exists') {
        return Promise.resolve({
          exists: true,
          projectId: 'my-test-project-1703980800000', // Earlier timestamp
          projectPath: 'C:\\Users\\test\\Documents\\SCORM Projects\\my-test-project-1703980800000'
        })
      }
      if (cmd === 'get_cli_args') {
        return Promise.resolve([])
      }
      return Promise.resolve(null)
    })

    await handleFileAssociation(mockCallbacks)

    // Simulate opening the file through CLI args on second run
    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      if (cmd === 'get_cli_args') {
        return Promise.resolve(['app.exe', filePath])
      }
      if (cmd === 'check_project_exists') {
        return Promise.resolve({
          exists: true,
          projectId: 'my-test-project-1703980800000',
          projectPath: 'C:\\Users\\test\\Documents\\SCORM Projects\\my-test-project-1703980800000'
        })
      }
      return Promise.resolve(null)
    })

    await handleFileAssociation(mockCallbacks)

    // Should check for existing project before creating new one
    expect(mockInvoke).toHaveBeenCalledWith('check_project_exists', {
      projectName: 'My Test Project'
    })

    // Should NOT call onProjectOpened with a new project ID
    // Should instead reuse the existing project ID
    expect(mockCallbacks.onProjectOpened).toHaveBeenCalledWith('my-test-project-1703980800000')
    expect(mockCallbacks.onProjectOpened).not.toHaveBeenCalledWith('my-test-project-1704067200000') // New timestamp
  })

  test('should create new project when no duplicate exists', async () => {
    const filePath = 'C:\\Users\\test\\Documents\\UniqueProject.scormproj'

    // Mock that no project with this name exists
    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      if (cmd === 'check_project_exists') {
        return Promise.resolve({ exists: false })
      }
      if (cmd === 'get_cli_args') {
        return Promise.resolve(['app.exe', filePath])
      }
      return Promise.resolve(null)
    })

    await handleFileAssociation(mockCallbacks)

    // Should check for duplicates first
    expect(mockInvoke).toHaveBeenCalledWith('check_project_exists', {
      projectName: 'My Test Project'
    })

    // Should create new project ID since no duplicate exists
    expect(mockCallbacks.onProjectOpened).toHaveBeenCalledWith('my-test-project-1704067200000')
  })

  test('should handle file drop events with duplicate detection', async () => {
    const filePath = 'C:\\Users\\test\\Documents\\DroppedProject.scormproj'

    // Mock existing project
    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      if (cmd === 'check_project_exists') {
        return Promise.resolve({
          exists: true,
          projectId: 'my-test-project-existing',
          projectPath: 'C:\\Users\\test\\Documents\\SCORM Projects\\my-test-project-existing'
        })
      }
      if (cmd === 'get_cli_args') {
        return Promise.resolve([])
      }
      return Promise.resolve(null)
    })

    // Mock the listen function to simulate file drop
    mockListen.mockImplementation((event, callback) => {
      if (event === 'tauri://file-drop') {
        // Simulate file drop after a delay
        setTimeout(() => {
          callback({
            payload: [filePath]
          })
        }, 10)
      }
      return Promise.resolve(() => {}) // Return unsubscribe function
    })

    await handleFileAssociation(mockCallbacks)

    // Wait for the async file drop handler
    await new Promise(resolve => setTimeout(resolve, 20))

    // Should reuse existing project instead of creating new one
    expect(mockCallbacks.onProjectOpened).toHaveBeenCalledWith('my-test-project-existing')
  })

  test('should handle errors in duplicate checking gracefully', async () => {
    const filePath = 'C:\\Users\\test\\Documents\\ErrorProject.scormproj'

    // Mock that duplicate check fails
    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      if (cmd === 'check_project_exists') {
        return Promise.reject(new Error('Backend error'))
      }
      if (cmd === 'get_cli_args') {
        return Promise.resolve(['app.exe', filePath])
      }
      return Promise.resolve(null)
    })

    await handleFileAssociation(mockCallbacks)

    // Should still create project if duplicate check fails
    // (Don't block file opening due to backend issues)
    expect(mockCallbacks.onProjectOpened).toHaveBeenCalledWith('my-test-project-1704067200000')
    expect(mockCallbacks.onError).not.toHaveBeenCalled()
  })

  test('should extract project name from file metadata correctly', async () => {
    const filePath = 'C:\\Users\\test\\Documents\\Complex Project Name (v2).scormproj'

    // Mock project with complex name
    mockImportProject.mockResolvedValue({
      success: true,
      data: {
        metadata: {
          projectName: 'Complex Project Name (v2)',
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00Z'
        },
        courseData: {
          title: 'Complex Project Name (v2)',
          topics: []
        }
      }
    })

    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      if (cmd === 'check_project_exists') {
        return Promise.resolve({ exists: false })
      }
      if (cmd === 'get_cli_args') {
        return Promise.resolve(['app.exe', filePath])
      }
      return Promise.resolve(null)
    })

    await handleFileAssociation(mockCallbacks)

    // Should use the actual project name from metadata, not filename
    expect(mockInvoke).toHaveBeenCalledWith('check_project_exists', {
      projectName: 'Complex Project Name (v2)'
    })

    // Should generate ID based on the project name, not filename
    expect(mockCallbacks.onProjectOpened).toHaveBeenCalledWith('complex-project-name-v2-1704067200000')
  })
})