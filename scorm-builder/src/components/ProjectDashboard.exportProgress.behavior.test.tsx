import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProjectDashboard } from './ProjectDashboard'
import { NotificationProvider } from '../contexts/NotificationContext'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'

// Mock Tauri
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockInvoke
}))

// Mock the storage
const mockStorage = {
  getAllProjects: vi.fn().mockResolvedValue([
    {
      id: 'test-project-123',
      name: 'Test Project',
      path: 'C:\\Users\\test\\Projects\\test-project.scormproj',
      created: new Date().toISOString(),
      last_modified: new Date().toISOString()
    }
  ]),
  getRecentProjects: vi.fn().mockResolvedValue([]),
  getCurrentProjectId: vi.fn().mockReturnValue(null),
  importProjectFromZip: vi.fn(),
  deleteProject: vi.fn(),
  // Add additional methods that FileStorage might need
  listProjects: vi.fn().mockResolvedValue([
    {
      id: 'test-project-123',
      name: 'Test Project',
      path: 'C:\\Users\\test\\Projects\\test-project.scormproj',
      created: new Date().toISOString(),
      last_modified: new Date().toISOString()
    }
  ])
}

function renderDashboard() {
  return render(
    <NotificationProvider>
      <PersistentStorageProvider storage={mockStorage}>
        <UnifiedMediaProvider projectId="test-project-123">
          <ProjectDashboard
            storage={mockStorage}
            onProjectSelected={vi.fn()}
          />
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    </NotificationProvider>
  )
}

describe('ProjectDashboard Export Progress Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show progress dialog during export with phase updates', async () => {
    // Arrange: Mock the export process to simulate slow export with phases
    let exportResolve: ((value: any) => void) | undefined
    const exportPromise = new Promise((resolve) => {
      exportResolve = resolve
    })

    // Mock export_project_data to return immediately
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'export_project_data') {
        return Promise.resolve({
          courseSeedData: { topics: ['test topic'] },
          courseData: { title: 'Test' },
          mediaList: Array.from({ length: 50 }, (_, i) => `audio-${i}`)
        })
      }
      if (command === 'create_project_zip') {
        return exportPromise
      }
      return Promise.resolve()
    })

    renderDashboard()

    // Wait for projects to load
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    // Act: Click export button
    const exportButton = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportButton)

    // Assert: Progress dialog should appear
    await waitFor(() => {
      expect(screen.getByText(/exporting project/i)).toBeInTheDocument()
    })

    // Should show initial phase
    expect(screen.getByText(/preparing export/i)).toBeInTheDocument()

    // Should show progress bar
    expect(screen.getByRole('progressbar')).toBeInTheDocument()

    // Should show cancel button
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()

    // Simulate export completion
    exportResolve!({
      zipData: new Array(1000).fill(0),
      fileCount: 51,
      totalSize: 1000000
    })

    // Assert: Progress dialog should disappear after completion
    await waitFor(() => {
      expect(screen.queryByText(/exporting project/i)).not.toBeInTheDocument()
    })

    // Should show success notification
    await waitFor(() => {
      expect(screen.getByText(/project exported successfully/i)).toBeInTheDocument()
    })
  })

  it('should allow canceling export operation', async () => {
    // Arrange: Mock a long-running export
    let exportReject: ((reason: any) => void) | undefined
    const exportPromise = new Promise((_, reject) => {
      exportReject = reject
    })

    mockInvoke.mockImplementation((command: string) => {
      if (command === 'export_project_data') {
        return Promise.resolve({
          courseSeedData: { topics: ['test'] },
          courseData: { title: 'Test' },
          mediaList: ['audio-0']
        })
      }
      if (command === 'create_project_zip') {
        return exportPromise
      }
      return Promise.resolve()
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    // Act: Start export
    const exportButton = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportButton)

    // Wait for progress dialog
    await waitFor(() => {
      expect(screen.getByText(/exporting project/i)).toBeInTheDocument()
    })

    // Click cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)

    // Simulate the backend cancellation
    exportReject!(new Error('Export cancelled by user'))

    // Assert: Dialog should close
    await waitFor(() => {
      expect(screen.queryByText(/exporting project/i)).not.toBeInTheDocument()
    })

    // Should not show success message
    expect(screen.queryByText(/project exported successfully/i)).not.toBeInTheDocument()
  })

  it('should show file processing progress with count', async () => {
    // Arrange: Mock export with multiple media files
    const mediaFiles = Array.from({ length: 25 }, (_, i) => `audio-${i}`)

    mockInvoke.mockImplementation((command: string) => {
      if (command === 'export_project_data') {
        return Promise.resolve({
          courseSeedData: { topics: Array(23).fill('test') },
          courseData: { title: 'Large Project' },
          mediaList: mediaFiles
        })
      }
      if (command === 'create_project_zip') {
        return Promise.resolve({
          zipData: new Array(5000).fill(0),
          fileCount: 26, // 25 media + 1 project file
          totalSize: 5000000
        })
      }
      return Promise.resolve()
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    // Act: Start export
    const exportButton = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportButton)

    // Assert: Should show file count information
    await waitFor(() => {
      expect(screen.getByText(/25 media files/i)).toBeInTheDocument()
    })
  })

  it('should handle export errors gracefully', async () => {
    // Arrange: Mock export failure
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'export_project_data') {
        return Promise.resolve({
          courseSeedData: { topics: ['test'] },
          courseData: { title: 'Test' },
          mediaList: ['audio-0']
        })
      }
      if (command === 'create_project_zip') {
        return Promise.reject(new Error('Export failed: Disk full'))
      }
      return Promise.resolve()
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    // Act: Start export
    const exportButton = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportButton)

    // Assert: Should show error and close dialog
    await waitFor(() => {
      expect(screen.getByText(/failed to export project.*disk full/i)).toBeInTheDocument()
    })

    // Progress dialog should be closed
    expect(screen.queryByText(/exporting project/i)).not.toBeInTheDocument()
  })

  it('should prevent multiple simultaneous exports', async () => {
    // Arrange: Mock slow export
    const exportPromise = new Promise(() => {}) // Never resolves

    mockInvoke.mockImplementation((command: string) => {
      if (command === 'export_project_data') {
        return Promise.resolve({
          courseSeedData: { topics: ['test'] },
          courseData: { title: 'Test' },
          mediaList: ['audio-0']
        })
      }
      if (command === 'create_project_zip') {
        return exportPromise
      }
      return Promise.resolve()
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    // Act: Start first export
    const exportButton = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportButton)

    // Wait for progress dialog
    await waitFor(() => {
      expect(screen.getByText(/exporting project/i)).toBeInTheDocument()
    })

    // Try to start second export
    fireEvent.click(exportButton)

    // Assert: Should not start second export
    // Export button should be disabled during export
    expect(exportButton).toBeDisabled()
  })
})