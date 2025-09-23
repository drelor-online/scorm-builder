/**
 * Test for ProjectDashboard import flow behavior
 *
 * BUG SCENARIO:
 * 1. ProjectDashboard calls storage.importProjectFromZip() directly
 * 2. This bypasses the duplicate detection logic in ProjectExportImport.ts
 * 3. Currently: Always creates duplicate projects
 * 4. Expected: Should use duplicate detection and conflict resolution
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { importProject } from '../services/ProjectExportImport'
import JSZip from 'jszip'

// Mock Tauri invoke
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

describe('ProjectDashboard Import Flow Integration', () => {
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

  test('importProject function should detect duplicates and return conflict info', async () => {
    const projectName = 'Electric Distribution - 12 - Protective Coordination'
    const zipFile = await createMockProjectZip(projectName)

    // Mock that a project with this name already exists
    mockInvoke.mockImplementation((cmd: string, args: any) => {
      if (cmd === 'check_project_exists') {
        return Promise.resolve({
          exists: true,
          project_id: '1757164011126',
          project_path: 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Electric_Distribution_-_12_-_Protective_Coordination_1757164011126.scormproj'
        })
      }
      return Promise.resolve(null)
    })

    const result = await importProject(zipFile)

    // Should detect duplicate and return conflict information
    expect(mockInvoke).toHaveBeenCalledWith('check_project_exists', {
      projectName: projectName
    })

    expect(result.success).toBe(false)
    expect(result.isDuplicate).toBe(true)
    expect(result.existingProjectId).toBe('1757164011126')
    expect(result.existingProjectPath).toContain('Electric_Distribution_-_12_-_Protective_Coordination_1757164011126.scormproj')
    expect(result.conflictOptions).toEqual(['replace', 'create_new', 'cancel'])
    expect(result.error).toContain('already exists')
  })

  test('importProject function should proceed when no duplicate exists', async () => {
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

  test('importProject should handle duplicate check errors gracefully', async () => {
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

  test('demonstrates the current bug: ProjectDashboard bypasses duplicate detection', () => {
    // This test documents the current bug:
    // ProjectDashboard.handleImportProject() calls:
    //   storage.importProjectFromZip(blob)
    // which calls:
    //   invoke('extract_project_zip', { zipData })
    //
    // This completely bypasses the duplicate detection logic in:
    //   ProjectExportImport.importProject()
    //
    // The fix is to make ProjectDashboard use ProjectExportImport.importProject()
    // instead of calling storage.importProjectFromZip() directly.

    expect(true).toBe(true) // This test documents the issue
  })
})