/**
 * Behavior test for SCORM package download failures
 *
 * This test reproduces the issue where SCORM packages appear to download
 * but then immediately disappear from the user's folder due to permission errors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SCORMPackageBuilder } from './SCORMPackageBuilder'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { NotificationProvider } from '../contexts/NotificationContext'

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn()
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock other dependencies
vi.mock('../services/courseContentConverter', () => ({
  convertToEnhancedCourseContent: vi.fn()
}))

vi.mock('../services/rustScormGenerator', () => ({
  generateRustSCORM: vi.fn()
}))

vi.mock('../utils/dynamicImports', () => ({
  loadCourseContentConverter: vi.fn(),
  loadSCORMGenerator: vi.fn()
}))

vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    error: vi.fn()
  }
}))

describe('SCORMPackageBuilder Download Failure Behavior', () => {
  let mockStorage: any
  let mockMedia: any
  let mockNotifications: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockStorage = {
      currentProjectId: 'test-project',
      saveProject: vi.fn(),
      loadProject: vi.fn(),
      saveCourseSeedData: vi.fn(),
      loadCourseSeedData: vi.fn()
    }

    mockMedia = {
      getAllMedia: vi.fn().mockReturnValue([])
    }

    mockNotifications = {
      success: vi.fn(),
      error: vi.fn(),
      addNotification: vi.fn()
    }
  })

  const renderSCORMBuilder = (courseContent = {}, courseSeedData = {}) => {
    return render(
      <NotificationProvider>
        <PersistentStorageProvider>
          <UnifiedMediaProvider>
            <SCORMPackageBuilder
              courseContent={courseContent}
              courseSeedData={courseSeedData}
              onNext={vi.fn()}
              onBack={vi.fn()}
              onSettingsClick={vi.fn()}
              onSave={vi.fn()}
              onOpen={vi.fn()}
              onHelp={vi.fn()}
              onStepClick={vi.fn()}
            />
          </UnifiedMediaProvider>
        </PersistentStorageProvider>
      </NotificationProvider>
    )
  }

  it('should show permission error when Tauri writeFile fails due to missing permissions', async () => {
    // Arrange: Set up course content and mock successful SCORM generation
    const courseContent = {
      welcomePage: { title: 'Test Course', content: 'Test content', media: [] },
      topics: [{ title: 'Topic 1', content: 'Topic content', media: [] }]
    }

    const courseSeedData = {
      courseTitle: 'Test Course'
    }

    // Mock successful generation and dialog, but failed file write
    const { loadCourseContentConverter, loadSCORMGenerator } = await import('../utils/dynamicImports')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { convertToEnhancedCourseContent } = await import('../services/courseContentConverter')
    const { generateRustSCORM } = await import('../services/rustScormGenerator')

    vi.mocked(loadCourseContentConverter).mockResolvedValue(vi.fn().mockResolvedValue({}))
    vi.mocked(loadSCORMGenerator).mockResolvedValue(generateRustSCORM)
    vi.mocked(convertToEnhancedCourseContent).mockResolvedValue({})
    vi.mocked(generateRustSCORM).mockResolvedValue(new Uint8Array([80, 75, 3, 4])) // ZIP file signature

    vi.mocked(save).mockResolvedValue('C:\\Users\\test\\Downloads\\test-course.zip')

    // Simulate permission error - this is the core issue we're testing
    const permissionError = new Error('Permission denied: Cannot write to selected location')
    permissionError.name = 'PermissionError'
    vi.mocked(writeFile).mockRejectedValue(permissionError)

    // Act: Render component and generate SCORM package
    renderSCORMBuilder(courseContent, courseSeedData)

    // Generate the package first
    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    fireEvent.click(generateButton)

    // Wait for generation to complete
    await waitFor(() => {
      expect(screen.queryByText(/generating scorm package/i)).not.toBeInTheDocument()
    }, { timeout: 10000 })

    // Try to download the package
    const downloadButton = screen.getByRole('button', { name: /download package/i })
    fireEvent.click(downloadButton)

    // Assert: Should log the error details and show error in UI
    await waitFor(() => {
      const { debugLogger } = require('../utils/ultraSimpleLogger')
      expect(debugLogger.error).toHaveBeenCalledWith(
        'SCORM_SAVE',
        'Failed to save SCORM package to file system',
        expect.objectContaining({
          error: 'Permission denied: Cannot write to selected location',
          errorName: 'PermissionError'
        })
      )
    })

    // Should show error message in the UI
    await waitFor(() => {
      expect(screen.getByText(/Permission denied/)).toBeInTheDocument()
    })
  })

  it('should handle file system write failures gracefully', async () => {
    // Arrange: Set up for file system error (like disk full, read-only folder, etc.)
    const courseContent = {
      welcomePage: { title: 'Test Course', content: 'Test content', media: [] },
      topics: []
    }

    const courseSeedData = {
      courseTitle: 'Test Course'
    }

    // Mock successful generation but file system error
    const { loadCourseContentConverter, loadSCORMGenerator } = await import('../utils/dynamicImports')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { convertToEnhancedCourseContent } = await import('../services/courseContentConverter')
    const { generateRustSCORM } = await import('../services/rustScormGenerator')

    vi.mocked(loadCourseContentConverter).mockResolvedValue(vi.fn().mockResolvedValue({}))
    vi.mocked(loadSCORMGenerator).mockResolvedValue(generateRustSCORM)
    vi.mocked(convertToEnhancedCourseContent).mockResolvedValue({})
    vi.mocked(generateRustSCORM).mockResolvedValue(new Uint8Array([80, 75, 3, 4]))

    vi.mocked(save).mockResolvedValue('C:\\readonly\\test-course.zip')

    // Simulate file system error
    const fsError = new Error('EACCES: permission denied, open \'C:\\readonly\\test-course.zip\'')
    fsError.name = 'EACCES'
    vi.mocked(writeFile).mockRejectedValue(fsError)

    // Act
    renderSCORMBuilder(courseContent, courseSeedData)

    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(screen.queryByText(/generating scorm package/i)).not.toBeInTheDocument()
    }, { timeout: 10000 })

    const downloadButton = screen.getByRole('button', { name: /download package/i })
    fireEvent.click(downloadButton)

    // Assert: Should show user-friendly error message in UI
    await waitFor(() => {
      expect(screen.getByText(/Error saving SCORM package/)).toBeInTheDocument()
    })
  })

  it('should succeed when file write permissions are properly configured', async () => {
    // Arrange: Test the happy path to ensure our test setup is correct
    const courseContent = {
      welcomePage: { title: 'Test Course', content: 'Test content', media: [] },
      topics: []
    }

    const courseSeedData = {
      courseTitle: 'Test Course'
    }

    // Mock successful generation and file write
    const { loadCourseContentConverter, loadSCORMGenerator } = await import('../utils/dynamicImports')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { convertToEnhancedCourseContent } = await import('../services/courseContentConverter')
    const { generateRustSCORM } = await import('../services/rustScormGenerator')

    vi.mocked(loadCourseContentConverter).mockResolvedValue(vi.fn().mockResolvedValue({}))
    vi.mocked(loadSCORMGenerator).mockResolvedValue(generateRustSCORM)
    vi.mocked(convertToEnhancedCourseContent).mockResolvedValue({})
    vi.mocked(generateRustSCORM).mockResolvedValue(new Uint8Array([80, 75, 3, 4]))

    vi.mocked(save).mockResolvedValue('C:\\Users\\test\\Downloads\\test-course.zip')

    // Mock successful file write
    vi.mocked(writeFile).mockResolvedValue()

    // Act
    renderSCORMBuilder(courseContent, courseSeedData)

    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(screen.queryByText(/generating scorm package/i)).not.toBeInTheDocument()
    }, { timeout: 10000 })

    const downloadButton = screen.getByRole('button', { name: /download package/i })
    fireEvent.click(downloadButton)

    // Assert: Should write the file with correct data
    await waitFor(() => {
      expect(writeFile).toHaveBeenCalledWith(
        'C:\\Users\\test\\Downloads\\test-course.zip',
        expect.any(Uint8Array)
      )
    })

    // Should show success in UI (either via toast or success state)
    await waitFor(() => {
      expect(screen.queryByText(/Error saving SCORM package/)).not.toBeInTheDocument()
    })
  })
})