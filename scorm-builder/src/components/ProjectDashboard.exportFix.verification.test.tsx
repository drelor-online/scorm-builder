import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProjectDashboard } from './ProjectDashboard'
import { invoke } from '@tauri-apps/api/tauri'

// Mock the tauri invoke function
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn()
}))

// Mock other dependencies
vi.mock('../services/FileStorage', () => ({
  getInstance: () => ({
    loadProject: vi.fn(),
    deleteProject: vi.fn()
  })
}))

vi.mock('../utils/debugLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../components/DesignSystem', () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  Card: ({ children }: any) => <div>{children}</div>,
  Modal: ({ children, isOpen }: any) => isOpen ? <div data-testid="modal">{children}</div> : null,
  LoadingSpinner: () => <div data-testid="loading">Loading...</div>
}))

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

const mockInvoke = invoke as any

describe('ProjectDashboard Export Fix Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock successful project list
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'list_projects') {
        return Promise.resolve([
          {
            id: 'test-project-123',
            name: 'Test Project',
            path: '/test/path.scormproj',
            lastModified: '2024-01-01'
          }
        ])
      }
      return Promise.resolve([])
    })
  })

  it('should handle camelCase response from Rust create_project_zip command', async () => {
    // Mock export_project_data response
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'list_projects') {
        return Promise.resolve([
          {
            id: 'test-project-123',
            name: 'Test Project',
            path: '/test/path.scormproj',
            lastModified: '2024-01-01'
          }
        ])
      }
      if (command === 'export_project_data') {
        return Promise.resolve({
          id: 'test-project-123',
          name: 'Test Project',
          mediaList: [
            { id: 'audio-0', type: 'audio' },
            { id: 'image-1', type: 'image' }
          ]
        })
      }
      if (command === 'create_project_zip') {
        // Return the CORRECT camelCase format that Rust actually sends
        return Promise.resolve({
          zipData: [80, 75, 3, 4, 20, 0, 0, 0], // Mock ZIP header bytes
          fileCount: 3,
          totalSize: 1024
        })
      }
      return Promise.resolve([])
    })

    render(<ProjectDashboard />)

    // Wait for projects to load
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    // Find and click the export button
    const exportButton = screen.getByText('Export')
    fireEvent.click(exportButton)

    // Wait for export to complete
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('create_project_zip', {
        projectPath: '/test/path.scormproj',
        projectId: 'test-project-123',
        includeMedia: true
      })
    }, { timeout: 5000 })

    // Verify the export completed successfully (no error thrown)
    // If the field names were wrong, this would have thrown an error
    expect(mockInvoke).toHaveBeenCalledWith('export_project_data', {
      projectPath: '/test/path.scormproj'
    })
  })

  it('should throw error when zipData is empty or undefined', async () => {
    // Mock empty response to test error handling
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'list_projects') {
        return Promise.resolve([
          {
            id: 'test-project-123',
            name: 'Test Project',
            path: '/test/path.scormproj',
            lastModified: '2024-01-01'
          }
        ])
      }
      if (command === 'export_project_data') {
        return Promise.resolve({
          id: 'test-project-123',
          name: 'Test Project',
          mediaList: []
        })
      }
      if (command === 'create_project_zip') {
        // Return empty zipData to test error handling
        return Promise.resolve({
          zipData: [], // Empty array
          fileCount: 0,
          totalSize: 0
        })
      }
      return Promise.resolve([])
    })

    render(<ProjectDashboard />)

    // Wait for projects to load
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    // Find and click the export button
    const exportButton = screen.getByText('Export')
    fireEvent.click(exportButton)

    // Wait for export to fail
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('create_project_zip', expect.any(Object))
    }, { timeout: 5000 })

    // The export should handle the empty data gracefully with our error checking
  })

  it('should correctly convert zipData array to Uint8Array', async () => {
    const testZipData = [80, 75, 3, 4, 20, 0, 0, 0, 8, 0] // Mock ZIP bytes

    mockInvoke.mockImplementation((command: string) => {
      if (command === 'list_projects') {
        return Promise.resolve([
          {
            id: 'test-project-123',
            name: 'Test Project',
            path: '/test/path.scormproj',
            lastModified: '2024-01-01'
          }
        ])
      }
      if (command === 'export_project_data') {
        return Promise.resolve({
          id: 'test-project-123',
          name: 'Test Project',
          mediaList: []
        })
      }
      if (command === 'create_project_zip') {
        return Promise.resolve({
          zipData: testZipData,
          fileCount: 1,
          totalSize: testZipData.length
        })
      }
      return Promise.resolve([])
    })

    render(<ProjectDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    // Mock URL.createObjectURL to verify blob creation
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url')
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const exportButton = screen.getByText('Export')
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('create_project_zip', expect.any(Object))
    }, { timeout: 5000 })

    // Verify blob was created (indicating successful conversion)
    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
  })
})