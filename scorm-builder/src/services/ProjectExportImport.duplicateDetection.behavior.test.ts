/**
 * Test for ProjectExportImport duplicate detection behavior
 *
 * BUG SCENARIO:
 * 1. User has existing project "My Course Project"
 * 2. User imports another .zip file with the same project name
 * 3. Currently: Creates duplicate project folder without warning
 * 4. Expected: Should detect duplicate and prompt user for action
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { importProject, type ImportResult } from './ProjectExportImport'
import JSZip from 'jszip'

// Mock Tauri
const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args: any) => mockInvoke(cmd, args)
}))

// Mock logger
vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('ProjectExportImport Duplicate Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function createMockProjectZip(projectName: string): Promise<File> {
    const zip = new JSZip()

    // Add manifest with project metadata
    const manifest = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      projectName: projectName
    }
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))

    // Add course data
    const courseData = {
      title: projectName,
      topics: [
        {
          title: 'Introduction',
          content: 'Welcome to the course',
          media: []
        }
      ]
    }
    zip.file('course-data.json', JSON.stringify(courseData, null, 2))

    // Generate zip file
    const blob = await zip.generateAsync({ type: 'blob' })
    return new File([blob], `${projectName}.zip`, { type: 'application/zip' })
  }

  test('should detect when project with same name already exists', async () => {
    const projectName = 'My Course Project'
    const zipFile = await createMockProjectZip(projectName)

    // Mock that a project with this name already exists
    mockInvoke.mockImplementation((cmd: string, args: any) => {
      if (cmd === 'check_project_exists') {
        return Promise.resolve({ exists: true, project_id: '1234567890' })
      }
      return Promise.resolve(null)
    })

    const result = await importProject(zipFile)

    // Currently this test SHOULD FAIL because the function doesn't check for duplicates
    expect(mockInvoke).toHaveBeenCalledWith('check_project_exists', {
      projectName: projectName
    })

    // Should return a special result indicating duplicate was found
    expect(result.success).toBe(false)
    expect(result.error).toContain('already exists')
    expect((result as any).isDuplicate).toBe(true)
    expect((result as any).existingProjectId).toBe('1234567890')
  })

  test('should proceed normally when no duplicate exists', async () => {
    const projectName = 'Unique Project Name'
    const zipFile = await createMockProjectZip(projectName)

    // Mock that no project with this name exists
    mockInvoke.mockImplementation((cmd: string, args: any) => {
      if (cmd === 'check_project_exists') {
        return Promise.resolve({ exists: false })
      }
      return Promise.resolve(null)
    })

    const result = await importProject(zipFile)

    // Should check for duplicates first
    expect(mockInvoke).toHaveBeenCalledWith('check_project_exists', {
      projectName: projectName
    })

    // Should proceed with normal import since no duplicate exists
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.metadata.projectName).toBe(projectName)
  })

  test('should handle errors in duplicate checking gracefully', async () => {
    const projectName = 'Test Project'
    const zipFile = await createMockProjectZip(projectName)

    // Mock that duplicate check fails (e.g., backend error)
    mockInvoke.mockImplementation((cmd: string, args: any) => {
      if (cmd === 'check_project_exists') {
        return Promise.reject(new Error('Backend error'))
      }
      return Promise.resolve(null)
    })

    const result = await importProject(zipFile)

    // Should still proceed with import if duplicate check fails
    // (We don't want to block imports due to backend issues)
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
  })

  test('should provide conflict resolution options when duplicate detected', async () => {
    const projectName = 'Existing Project'
    const zipFile = await createMockProjectZip(projectName)

    // Mock that a project with this name already exists
    mockInvoke.mockImplementation((cmd: string, args: any) => {
      if (cmd === 'check_project_exists') {
        return Promise.resolve({
          exists: true,
          project_id: '1234567890',
          project_path: '/path/to/existing/project'
        })
      }
      return Promise.resolve(null)
    })

    const result = await importProject(zipFile)

    // Should return conflict information for UI to handle
    expect(result.success).toBe(false)
    expect((result as any).isDuplicate).toBe(true)
    expect((result as any).existingProjectId).toBe('1234567890')
    expect((result as any).existingProjectPath).toBe('/path/to/existing/project')
    expect((result as any).conflictOptions).toEqual([
      'replace',
      'create_new',
      'cancel'
    ])
  })
})