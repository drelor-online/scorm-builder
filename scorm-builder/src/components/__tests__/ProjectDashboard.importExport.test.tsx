import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent , waitFor } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
// Removed unused React import

// Mock the storage context
const mockCreateProject = vi.fn()
const mockOpenProject = vi.fn()
const mockListProjects = vi.fn()
const mockDeleteProject = vi.fn()
const mockExportProject = vi.fn()
const mockImportProjectFromZip = vi.fn()
const mockGetCurrentProjectId = vi.fn()
const mockGetRecentProjects = vi.fn()
const mockClearRecentFilesCache = vi.fn()

vi.mock('../../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    isInitialized: true,
    currentProjectId: null,
    error: null,
    createProject: mockCreateProject,
    openProject: mockOpenProject,
    listProjects: mockListProjects,
    deleteProject: mockDeleteProject,
    exportProject: mockExportProject,
    importProjectFromZip: mockImportProjectFromZip,
    getCurrentProjectId: mockGetCurrentProjectId,
    getRecentProjects: mockGetRecentProjects,
    clearRecentFilesCache: mockClearRecentFilesCache
  })
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}))

vi.mock('../ErrorNotification', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
  showInfo: vi.fn(),
  ErrorNotification: () => null
}))

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => 'less than a minute ago')
}))

// Mock Design System components to avoid appendChild issues
vi.mock('../DesignSystem/Button', () => ({
  Button: ({ children, ...props }: any) => React.createElement('button', props, children)
}))

vi.mock('../DesignSystem/Card', () => ({
  Card: ({ children, ...props }: any) => React.createElement('div', props, children)
}))

vi.mock('../DesignSystem/Modal', () => ({
  Modal: ({ children, isOpen, ...props }: any) => isOpen ? React.createElement('div', props, children) : null
}))

vi.mock('../DesignSystem/LoadingSpinner', () => ({
  LoadingSpinner: () => React.createElement('div', null, 'Loading...')
}))

vi.mock('../DesignSystem/Tooltip', () => ({
  Tooltip: ({ children }: any) => children
}))

// Import components after mocks
import { ProjectDashboard } from '../ProjectDashboard'

describe('ProjectDashboard - Import/Export Functionality', () => {
  let onProjectSelected: jest.Mock

  beforeEach(() => {
    vi.clearAllMocks()
    onProjectSelected = vi.fn()
    
    // Reset mock implementations
    mockListProjects.mockResolvedValue([])
    mockGetRecentProjects.mockResolvedValue([])
    mockExportProject.mockReset()
    mockImportProjectFromZip.mockReset()
    mockGetCurrentProjectId.mockReset()
    mockOpenProject.mockReset()
    mockClearRecentFilesCache.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const renderDashboard = () => {
    return render(<ProjectDashboard onProjectSelected={onProjectSelected} />)
  }

  describe('Intent: Export project as zip file', () => {
    it('should show export button for each project', async () => {
      // Arrange
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project 1',
          created: new Date().toISOString(),
          last_modified: new Date().toISOString(),
          lastAccessed: new Date().toISOString()
        }
      ]
      mockListProjects.mockResolvedValue(mockProjects)

      // Act
      renderDashboard()

      // Assert
      await waitFor(() => {
        expect(screen.getByLabelText('Export project Test Project 1')).toBeInTheDocument()
      })
    })

    it('should export project when export button is clicked', async () => {
      // Arrange
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project 1',
          created: new Date().toISOString(),
          last_modified: new Date().toISOString(),
          lastAccessed: new Date().toISOString()
        }
      ]
      mockListProjects.mockResolvedValue(mockProjects)
      mockExportProject.mockResolvedValue(new Blob(['test'], { type: 'application/zip' }))

      // Act
      renderDashboard()
      
      await waitFor(() => {
        expect(screen.getByLabelText('Export project Test Project 1')).toBeInTheDocument()
      })
      
      const exportButton = screen.getByLabelText('Export project Test Project 1')
      await userEvent.click(exportButton)

      // Assert
      await waitFor(() => {
        expect(mockOpenProject).toHaveBeenCalledWith('project-1')
        expect(mockExportProject).toHaveBeenCalled()
      })
    })

    it('should download zip file after successful export', async () => {
      // Arrange
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project 1',
          created: new Date().toISOString(),
          last_modified: new Date().toISOString(),
          lastAccessed: new Date().toISOString()
        }
      ]
      mockListProjects.mockResolvedValue(mockProjects)
      mockExportProject.mockResolvedValue(new Blob(['test'], { type: 'application/zip' }))
      
      // Mock URL.createObjectURL and download link
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url')
      global.URL.revokeObjectURL = vi.fn()
      
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
        remove: vi.fn()
      }
      
      const originalCreateElement = document.createElement.bind(document)
      document.createElement = vi.fn().mockImplementation((tagName) => {
        if (tagName === 'a') return mockLink as any
        return originalCreateElement(tagName)
      })
      
      // Mock document.body methods
      const originalAppendChild = document.body.appendChild
      const originalRemoveChild = document.body.removeChild
      document.body.appendChild = vi.fn((element) => {
        originalAppendChild.call(document.body, element)
        return element
      })
      document.body.removeChild = vi.fn((element) => {
        originalRemoveChild.call(document.body, element)
        return element
      })

      // Act
      renderDashboard()
      
      await waitFor(() => {
        expect(screen.getByLabelText('Export project Test Project 1')).toBeInTheDocument()
      })
      
      const exportButton = screen.getByLabelText('Export project Test Project 1')
      await userEvent.click(exportButton)

      // Assert
      await waitFor(() => {
        expect(mockLink.download).toBe('Test Project 1.zip')
        expect(mockLink.click).toHaveBeenCalled()
      })
      
      // Cleanup
      document.body.appendChild = originalAppendChild
      document.body.removeChild = originalRemoveChild
    })
  })

  describe('Intent: Import project from zip file', () => {
    it('should show import button in dashboard header', async () => {
      // Act
      renderDashboard()

      // Assert
      expect(screen.getByText('Import Project')).toBeInTheDocument()
    })

    it('should open file dialog when import button is clicked', async () => {
      // Arrange
      const { open } = await import('@tauri-apps/plugin-dialog')
      const mockOpen = open as jest.MockedFunction<typeof open>

      // Act
      renderDashboard()
      
      const importButton = await screen.findByText('Import Project')
      await userEvent.click(importButton)

      // Assert
      expect(mockOpen).toHaveBeenCalledWith({
        filters: [{
          name: 'ZIP Files',
          extensions: ['zip']
        }],
        multiple: false
      })
    })

    it('should import project when file is selected', async () => {
      // Arrange
      const { open } = await import('@tauri-apps/plugin-dialog')
      const mockOpen = open as jest.MockedFunction<typeof open>
      mockOpen.mockResolvedValue('/path/to/project.zip')
      
      // Mock File and FileReader
      const mockFile = new File(['test zip content'], 'project.zip', { type: 'application/zip' })
      global.fetch = vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(mockFile)
      })

      mockImportProjectFromZip.mockResolvedValue(undefined)
      mockGetCurrentProjectId.mockReturnValue('imported-project-id')

      // Act
      renderDashboard()
      
      const importButton = await screen.findByText('Import Project')
      await userEvent.click(importButton)

      // Assert
      await waitFor(() => {
        expect(mockImportProjectFromZip).toHaveBeenCalledWith(expect.any(Blob))
        expect(onProjectSelected).toHaveBeenCalledWith('imported-project-id')
      })
    })

    it('should show loading state during import', async () => {
      // Arrange
      const { open } = await import('@tauri-apps/plugin-dialog')
      const mockOpen = open as jest.MockedFunction<typeof open>
      mockOpen.mockResolvedValue('/path/to/project.zip')
      
      const mockFile = new File(['test'], 'project.zip', { type: 'application/zip' })
      global.fetch = vi.fn().mockResolvedValue({
        blob: () => new Promise(resolve => setTimeout(() => resolve(mockFile), 100))
      })

      // Act
      renderDashboard()
      
      const importButton = await screen.findByText('Import Project')
      await userEvent.click(importButton)

      // Assert
      expect(screen.getByText('Importing project...')).toBeInTheDocument()
    })

    it('should handle import errors gracefully', async () => {
      // Arrange
      const { open } = await import('@tauri-apps/plugin-dialog')
      const { showError } = await import('../ErrorNotification')
      const mockOpen = open as jest.MockedFunction<typeof open>
      mockOpen.mockResolvedValue('/path/to/project.zip')
      
      const mockFile = new File(['test'], 'project.zip', { type: 'application/zip' })
      global.fetch = vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(mockFile)
      })

      mockImportProjectFromZip.mockRejectedValue(new Error('Invalid zip file'))

      // Act
      renderDashboard()
      
      const importButton = await screen.findByText('Import Project')
      await userEvent.click(importButton)

      // Assert
      await waitFor(() => {
        expect(showError).toHaveBeenCalledWith('Failed to import project: Invalid zip file')
      })
    })
  })

  describe('Intent: Bulk export multiple projects', () => {
    it('should show checkbox for each project when in selection mode', async () => {
      // Arrange
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project 1',
          created: new Date().toISOString(),
          last_modified: new Date().toISOString()
        },
        {
          id: 'project-2',
          name: 'Test Project 2',
          created: new Date().toISOString(),
          last_modified: new Date().toISOString()
        }
      ]
      mockListProjects.mockResolvedValue(mockProjects)

      // Act
      renderDashboard()
      
      // Enter selection mode
      const bulkExportButton = await screen.findByText('Bulk Export')
      await userEvent.click(bulkExportButton)

      // Assert
      await waitFor(() => {
        expect(screen.getByLabelText('Select Test Project 1')).toBeInTheDocument()
        expect(screen.getByLabelText('Select Test Project 2')).toBeInTheDocument()
      })
    })

    it('should export selected projects as individual zip files', async () => {
      // Arrange
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project 1',
          created: new Date().toISOString(),
          last_modified: new Date().toISOString()
        },
        {
          id: 'project-2',
          name: 'Test Project 2',
          created: new Date().toISOString(),
          last_modified: new Date().toISOString()
        }
      ]
      mockListProjects.mockResolvedValue(mockProjects)
      mockExportProject.mockResolvedValue(new Blob(['test'], { type: 'application/zip' }))

      // Act
      renderDashboard()
      
      // Enter selection mode
      const bulkExportButton = await screen.findByText('Bulk Export')
      await userEvent.click(bulkExportButton)

      // Select projects
      const checkbox1 = await screen.findByLabelText('Select Test Project 1')
      await userEvent.click(checkbox1)

      // Export selected
      const exportSelectedButton = screen.getByText('Export Selected (1)')
      await userEvent.click(exportSelectedButton)

      // Assert
      await waitFor(() => {
        expect(mockOpenProject).toHaveBeenCalledWith('project-1')
        expect(mockExportProject).toHaveBeenCalled()
      })
    })
  })
})