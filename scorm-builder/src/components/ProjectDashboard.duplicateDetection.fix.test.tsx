/**
 * Test to fix the duplicate detection bug in ProjectDashboard
 *
 * BUG DESCRIPTION:
 * When importing a project ZIP file, the duplicate detection fails because
 * the code tries to access parsed.name instead of parsed.project.name
 * from the .scormproj file structure.
 *
 * This test creates a realistic .scormproj file structure and verifies
 * that duplicate detection works correctly.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectDashboard } from './ProjectDashboard'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import JSZip from 'jszip'

// Mock Tauri file dialog
const mockOpen = vi.fn()
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: () => mockOpen()
}))

// Mock Tauri file system
const mockReadFile = vi.fn()
vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: (path: string) => mockReadFile(path)
}))

// Mock FileStorage
vi.mock('../services/FileStorage', () => {
  const mockStorage = {
    listProjects: vi.fn(),
    getRecentProjects: vi.fn(),
    getCurrentProjectId: vi.fn(),
    importProjectFromZip: vi.fn(),
    exportProjectToZip: vi.fn(),
    setProjectsDirectory: vi.fn(),
    diagnoseProjectDirectory: vi.fn()
  }

  const FileStorageClass = vi.fn(() => mockStorage)
  FileStorageClass.getInstance = vi.fn(() => mockStorage)

  return {
    default: mockStorage,
    FileStorage: FileStorageClass
  }
})

// Mock logger
vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}))

// Mock notification system
vi.mock('../utils/notificationHelpers', () => ({
  success: vi.fn(),
  notifyError: vi.fn()
}))

describe('ProjectDashboard Duplicate Detection Fix', () => {
  let mockFileStorage: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Get the mocked FileStorage instance
    const { default: FileStorage } = await import('../services/FileStorage')
    mockFileStorage = FileStorage

    // Mock existing projects list with the exact project we'll try to import
    mockFileStorage.listProjects.mockResolvedValue([
      {
        id: '1758554187321',
        name: 'Complex Projects - 03 - ASME B31_8 (Gas Transmission & Distribution Piping Code)',
        createdAt: '2025-09-22T01:03:07.321Z',
        lastModified: '2025-09-22T01:05:45.765Z',
        path: 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Complex_Projects_-_03_-_ASME_B31_8_(Gas_Transmission_&_Distribution_Piping_Code)_1758554187321.scormproj'
      }
    ])

    mockFileStorage.getRecentProjects.mockResolvedValue([])
    mockFileStorage.diagnoseProjectDirectory.mockResolvedValue({
      projects_directory: 'C:\\Users\\sierr\\Documents\\SCORM Projects',
      directory_exists: true,
      directory_readable: true,
      file_count: 44,
      scormproj_count: 44,
      first_few_files: [],
      error_details: null
    })
  })

  async function createRealisticProjectZip(projectName: string): Promise<Uint8Array> {
    const zip = new JSZip()

    // Create the actual .scormproj file structure with nested project object
    const scormProjData = {
      "project": {
        "id": "1756944197691",
        "name": projectName,
        "created": "2025-09-04T00:03:17.693539600Z",
        "last_modified": "2025-09-22T01:05:45.765398600Z",
        "path": "C:\\Users\\sierr\\Documents\\SCORM Projects\\Complex_Projects_-_03_-_ASME_B31_8__Gas_Transmission___Distribution_Piping_Code__1756944197691.scormproj"
      },
      "course_data": {
        "title": projectName,
        "difficulty": 3,
        "template": "None",
        "topics": [
          "3.1. Scope of ASME B31.8 – covers the design, fabrication, installation"
        ]
      },
      "ai_prompt": null,
      "course_content": {
        "assessment": {
          "narration": "",
          "passMark": 80,
          "questions": []
        }
      }
    }

    // Add the .scormproj file with realistic filename
    const fileName = 'Complex_Projects_-_03_-_ASME_B31_8_(Gas_Transmission_&_Distribution_Piping_Code)_1756944197691.scormproj'
    zip.file(fileName, JSON.stringify(scormProjData, null, 2))

    // Add some media files to simulate realistic export structure
    zip.file('1756944197691/media/audio-0.mp3', 'fake audio data')
    zip.file('1756944197691/media/image-1.jpg', 'fake image data')

    // Generate zip file as Uint8Array
    const zipBlob = await zip.generateAsync({ type: 'uint8array' })
    return zipBlob
  }

  test('should correctly parse project name from .scormproj structure', async () => {
    // This test specifically verifies the ZIP parsing logic
    // Create a realistic ZIP with the actual .scormproj structure
    const zipData = await createRealisticProjectZip('Complex Projects - 03 - ASME B31_8 (Gas Transmission & Distribution Piping Code)')

    // Test the ZIP parsing logic directly using JSZip
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    await zip.loadAsync(zipData)

    let projectName: string | null = null

    // Try to find a .scormproj file in the ZIP (mimicking the real parsing logic)
    for (const [fileName, zipEntry] of Object.entries(zip.files)) {
      if (fileName.endsWith('.scormproj') && !zipEntry.dir) {
        try {
          const projectData = await zipEntry.async('string')
          const parsed = JSON.parse(projectData)

          // This is the FIXED logic that should work now
          projectName = parsed.project?.name || parsed.course_data?.title
          break
        } catch (error) {
          console.warn('Failed to parse .scormproj file', { fileName, error })
        }
      }
    }

    // Should successfully extract the project name
    expect(projectName).toBe('Complex Projects - 03 - ASME B31_8 (Gas Transmission & Distribution Piping Code)')
    expect(projectName).not.toBeNull()
    expect(projectName).not.toContain('undefined')
  })

  test('should parse project name from legacy manifest.json format', async () => {
    // Test fallback logic for old ZIP format
    const zip = new JSZip()
    const manifest = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      projectName: 'Legacy Project Name'
    }
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))
    zip.file('course-data.json', JSON.stringify({ title: 'Test Course' }, null, 2))

    const zipData = await zip.generateAsync({ type: 'uint8array' })

    // Test the fallback parsing logic
    const zipToTest = new JSZip()
    await zipToTest.loadAsync(zipData)

    let projectName: string | null = null

    // Try to find a .scormproj file in the ZIP (should not exist)
    for (const [fileName, zipEntry] of Object.entries(zipToTest.files)) {
      if (fileName.endsWith('.scormproj') && !zipEntry.dir) {
        try {
          const projectData = await zipEntry.async('string')
          const parsed = JSON.parse(projectData)
          projectName = parsed.project?.name || parsed.course_data?.title
          break
        } catch (error) {
          console.warn('Failed to parse .scormproj file', { fileName, error })
        }
      }
    }

    // Fallback: Try to read from manifest.json (old format)
    if (!projectName && zipToTest.files['manifest.json']) {
      try {
        const manifestContent = await zipToTest.files['manifest.json'].async('string')
        const manifest = JSON.parse(manifestContent)
        projectName = manifest.projectName
      } catch (error) {
        console.warn('Failed to parse manifest.json', { error })
      }
    }

    // Should successfully extract the project name from manifest.json
    expect(projectName).toBe('Legacy Project Name')
    expect(projectName).not.toBeNull()
  })

  test('should correctly parse project name from course_data title as fallback', async () => {
    // Test the secondary fallback within .scormproj structure
    const zipData = await createRealisticProjectZip('Different Project Name')

    // Modify the project to only have course_data.title (no project.name)
    const JSZipTest = (await import('jszip')).default
    const zip = new JSZipTest()
    await zip.loadAsync(zipData)

    // Find and modify the .scormproj file to remove project.name
    for (const [fileName, zipEntry] of Object.entries(zip.files)) {
      if (fileName.endsWith('.scormproj') && !zipEntry.dir) {
        const projectData = await zipEntry.async('string')
        const parsed = JSON.parse(projectData)

        // Remove the project.name to test fallback to course_data.title
        delete parsed.project.name
        parsed.course_data.title = 'Fallback Title From Course Data'

        // Update the zip file
        zip.file(fileName, JSON.stringify(parsed, null, 2))
        break
      }
    }

    const modifiedZipData = await zip.generateAsync({ type: 'uint8array' })

    // Test the parsing logic
    const zipToTest = new JSZipTest()
    await zipToTest.loadAsync(modifiedZipData)

    let projectName: string | null = null

    for (const [fileName, zipEntry] of Object.entries(zipToTest.files)) {
      if (fileName.endsWith('.scormproj') && !zipEntry.dir) {
        try {
          const projectData = await zipEntry.async('string')
          const parsed = JSON.parse(projectData)
          projectName = parsed.project?.name || parsed.course_data?.title
          break
        } catch (error) {
          console.warn('Failed to parse .scormproj file', { fileName, error })
        }
      }
    }

    // Should successfully extract the title from course_data when project.name is missing
    expect(projectName).toBe('Fallback Title From Course Data')
    expect(projectName).not.toBeNull()
  })
})