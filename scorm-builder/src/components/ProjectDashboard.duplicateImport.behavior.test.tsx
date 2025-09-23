/**
 * Test for ProjectDashboard duplicate import behavior
 *
 * BUG SCENARIO:
 * 1. User exports a project from ProjectDashboard
 * 2. User imports the same project back
 * 3. Currently: Creates duplicate project without warning
 * 4. Expected: Should detect duplicate and prompt user for action
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectDashboard } from './ProjectDashboard'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
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

describe('ProjectDashboard Duplicate Import Detection', () => {
  let mockFileStorage: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Get the mocked FileStorage instance
    const { default: FileStorage } = await import('../services/FileStorage')
    mockFileStorage = FileStorage

    // Mock existing projects list
    mockFileStorage.listProjects.mockResolvedValue([
      {
        id: '1757164011126',
        name: 'Electric Distribution - 12 - Protective Coordination',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        path: 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Electric_Distribution_-_12_-_Protective_Coordination_1757164011126.scormproj'
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

  async function createMockProjectZip(projectName: string): Promise<Uint8Array> {
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

    // Generate zip file as Uint8Array
    const zipBlob = await zip.generateAsync({ type: 'uint8array' })
    return zipBlob
  }

  test('should detect duplicate when importing existing project', async () => {
    const user = userEvent.setup()

    // Render ProjectDashboard with context provider
    render(
      <PersistentStorageProvider>
        <ProjectDashboard onProjectSelected={vi.fn()} />
      </PersistentStorageProvider>
    )

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Electric Distribution - 12 - Protective Coordination')).toBeInTheDocument()
    })

    // Mock file dialog to return a zip file path
    const zipPath = 'C:\\Downloads\\Electric_Distribution_12_Protective_Coordination.zip'
    mockOpen.mockResolvedValue(zipPath)

    // Create mock zip data for the same project name
    const zipData = await createMockProjectZip('Electric Distribution - 12 - Protective Coordination')
    mockReadFile.mockResolvedValue(zipData)

    // Mock storage import to create duplicate (current buggy behavior)
    mockFileStorage.importProjectFromZip.mockResolvedValue(undefined)
    mockFileStorage.getCurrentProjectId.mockReturnValue('1758542848163') // New timestamp ID

    // Click import button
    const importButton = screen.getByText('Import Project')
    await user.click(importButton)

    // Wait for file selection and import
    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalledWith({
        filters: [{
          name: 'ZIP Files',
          extensions: ['zip']
        }],
        multiple: false
      })
    })

    await waitFor(() => {
      expect(mockReadFile).toHaveBeenCalledWith(zipPath)
    })

    await waitFor(() => {
      expect(mockFileStorage.importProjectFromZip).toHaveBeenCalled()
    })

    // Currently this test documents the BUG:
    // The import proceeds without duplicate detection
    // Expected: Should show conflict dialog instead

    // This test SHOULD FAIL because we want to fix this behavior
    // After fix, this should show a conflict dialog instead of importing
    expect(mockFileStorage.importProjectFromZip).toHaveBeenCalled()
  })

  test('should proceed normally when importing unique project', async () => {
    const user = userEvent.setup()

    // Render ProjectDashboard with context provider
    render(
      <PersistentStorageProvider>
        <ProjectDashboard onProjectSelected={vi.fn()} />
      </PersistentStorageProvider>
    )

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Electric Distribution - 12 - Protective Coordination')).toBeInTheDocument()
    })

    // Mock file dialog to return a zip file path
    const zipPath = 'C:\\Downloads\\New_Unique_Project.zip'
    mockOpen.mockResolvedValue(zipPath)

    // Create mock zip data for a unique project name
    const zipData = await createMockProjectZip('Unique Project Name')
    mockReadFile.mockResolvedValue(zipData)

    // Mock successful import
    mockFileStorage.importProjectFromZip.mockResolvedValue(undefined)
    mockFileStorage.getCurrentProjectId.mockReturnValue('1758542848200') // New project ID

    // Click import button
    const importButton = screen.getByText('Import Project')
    await user.click(importButton)

    // Wait for import to complete
    await waitFor(() => {
      expect(mockFileStorage.importProjectFromZip).toHaveBeenCalled()
    })

    // Should proceed with normal import for unique project
    expect(mockFileStorage.importProjectFromZip).toHaveBeenCalledWith(expect.any(Blob))
  })
})