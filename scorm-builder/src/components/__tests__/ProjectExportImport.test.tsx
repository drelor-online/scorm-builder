import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectExportButton, ProjectImportButton } from '../ProjectExportImport'
import { exportProject, importProject } from '../../services/ProjectExportImport'

// Mock the export/import service
vi.mock('../../services/ProjectExportImport')

// Mock file download
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock the download link click
const mockClick = vi.fn()
const mockRemove = vi.fn()
HTMLAnchorElement.prototype.click = mockClick
HTMLAnchorElement.prototype.remove = mockRemove

describe('ProjectExportImport Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ProjectExportButton', () => {
    const mockProjectData = {
      metadata: {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        projectName: 'Test Project'
      },
      courseData: {
        title: 'Test Course',
        topics: []
      },
      media: {
        images: [],
        audio: [],
        captions: []
      }
    }

    const mockOnExport = vi.fn()

    it('should render export button', () => {
      render(
        <ProjectExportButton 
          projectData={mockProjectData}
          onExport={mockOnExport}
        />
      )
      
      expect(screen.getByRole('button', { name: /export project/i })).toBeInTheDocument()
    })

    it('should show loading state while exporting', async () => {
      const user = userEvent.setup()
      vi.mocked(exportProject).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          filename: 'test.zip',
          blob: new Blob(['test'])
        }), 100))
      )
      
      render(
        <ProjectExportButton 
          projectData={mockProjectData}
          onExport={mockOnExport}
        />
      )
      
      const button = screen.getByRole('button', { name: /export project/i })
      await user.click(button)
      
      expect(screen.getByText(/exporting/i)).toBeInTheDocument()
      expect(button).toBeDisabled()
    })

    it('should download file on successful export', async () => {
      const user = userEvent.setup()
      const mockBlob = new Blob(['test'], { type: 'application/zip' })
      
      vi.mocked(exportProject).mockResolvedValue({
        success: true,
        filename: 'project-export.zip',
        blob: mockBlob
      })
      
      render(
        <ProjectExportButton 
          projectData={mockProjectData}
          onExport={mockOnExport}
        />
      )
      
      await user.click(screen.getByRole('button', { name: /export project/i }))
      
      await waitFor(() => {
        expect(mockClick).toHaveBeenCalled()
        expect(mockOnExport).toHaveBeenCalledWith({ success: true })
      })
    })

    it('should show error message on export failure', async () => {
      const user = userEvent.setup()
      
      vi.mocked(exportProject).mockResolvedValue({
        success: false,
        error: 'Export failed: Invalid data'
      })
      
      render(
        <ProjectExportButton 
          projectData={mockProjectData}
          onExport={mockOnExport}
        />
      )
      
      await user.click(screen.getByRole('button', { name: /export project/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/export failed: invalid data/i)).toBeInTheDocument()
        expect(mockOnExport).toHaveBeenCalledWith({ 
          success: false, 
          error: 'Export failed: Invalid data' 
        })
      })
    })

    it('should disable button when disabled prop is true', () => {
      render(
        <ProjectExportButton 
          projectData={mockProjectData}
          onExport={mockOnExport}
          disabled={true}
        />
      )
      
      expect(screen.getByRole('button', { name: /export project/i })).toBeDisabled()
    })

    it('should support custom button text', () => {
      render(
        <ProjectExportButton 
          projectData={mockProjectData}
          onExport={mockOnExport}
          buttonText="Download Project"
        />
      )
      
      expect(screen.getByRole('button', { name: /download project/i })).toBeInTheDocument()
    })
  })

  describe('ProjectImportButton', () => {
    const mockOnImport = vi.fn()

    it('should render import button', () => {
      render(
        <ProjectImportButton 
          onImport={mockOnImport}
        />
      )
      
      expect(screen.getByRole('button', { name: /import project/i })).toBeInTheDocument()
    })

    it('should show file input when clicked', async () => {
      const user = userEvent.setup()
      
      render(
        <ProjectImportButton 
          onImport={mockOnImport}
        />
      )
      
      await user.click(screen.getByRole('button', { name: /import project/i }))
      
      expect(screen.getByLabelText(/select project file/i)).toBeInTheDocument()
    })

    it('should handle file selection and import', async () => {
      const user = userEvent.setup()
      const mockFile = new File(['test'], 'project.zip', { type: 'application/zip' })
      
      vi.mocked(importProject).mockResolvedValue({
        success: true,
        data: {
          metadata: { version: '1.0.0', exportDate: '', projectName: 'Imported' },
          courseData: { title: 'Imported Course', topics: [] },
          mediaMap: {},
          captionsMap: {}
        }
      })
      
      render(
        <ProjectImportButton 
          onImport={mockOnImport}
        />
      )
      
      await user.click(screen.getByRole('button', { name: /import project/i }))
      
      const fileInput = screen.getByLabelText(/select project file/i)
      await user.upload(fileInput, mockFile)
      
      await waitFor(() => {
        expect(importProject).toHaveBeenCalledWith(mockFile)
        expect(mockOnImport).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            courseData: expect.objectContaining({ title: 'Imported Course' })
          })
        })
      })
    })

    it.skip('should validate file type', async () => {
      const user = userEvent.setup()
      const invalidFile = new File(['test'], 'project.txt', { type: 'text/plain' })
      
      render(
        <ProjectImportButton 
          onImport={mockOnImport}
        />
      )
      
      await user.click(screen.getByRole('button', { name: /import project/i }))
      
      const fileInput = screen.getByLabelText(/select project file/i)
      await user.upload(fileInput, invalidFile)
      
      // Error should be shown
      await waitFor(() => {
        expect(screen.getByText('Please select a .zip file')).toBeInTheDocument()
      })
      
      // Modal stays open but file input is reset
      expect(importProject).not.toHaveBeenCalled()
    })

    it('should show loading state during import', async () => {
      const user = userEvent.setup()
      const mockFile = new File(['test'], 'project.zip', { type: 'application/zip' })
      
      vi.mocked(importProject).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: {
            metadata: { version: '1.0.0', exportDate: '', projectName: 'Test' },
            courseData: {},
            mediaMap: {},
            captionsMap: {}
          }
        }), 100))
      )
      
      render(
        <ProjectImportButton 
          onImport={mockOnImport}
        />
      )
      
      await user.click(screen.getByRole('button', { name: /import project/i }))
      
      const fileInput = screen.getByLabelText(/select project file/i)
      await user.upload(fileInput, mockFile)
      
      expect(screen.getByText(/importing/i)).toBeInTheDocument()
    })

    it('should show error on import failure', async () => {
      const user = userEvent.setup()
      const mockFile = new File(['test'], 'project.zip', { type: 'application/zip' })
      
      vi.mocked(importProject).mockResolvedValue({
        success: false,
        error: 'Invalid project file'
      })
      
      render(
        <ProjectImportButton 
          onImport={mockOnImport}
        />
      )
      
      await user.click(screen.getByRole('button', { name: /import project/i }))
      
      const fileInput = screen.getByLabelText(/select project file/i)
      await user.upload(fileInput, mockFile)
      
      await waitFor(() => {
        expect(screen.getByText('Invalid project file')).toBeInTheDocument()
        expect(mockOnImport).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid project file'
        })
      })
    })

    it('should show confirmation dialog before import', async () => {
      const user = userEvent.setup()
      const mockFile = new File(['test'], 'project.zip', { type: 'application/zip' })
      
      render(
        <ProjectImportButton 
          onImport={mockOnImport}
          showConfirmation={true}
        />
      )
      
      await user.click(screen.getByRole('button', { name: /import project/i }))
      
      const fileInput = screen.getByLabelText(/select project file/i)
      await user.upload(fileInput, mockFile)
      
      // Should show confirmation dialog
      expect(screen.getByText(/are you sure you want to import/i)).toBeInTheDocument()
      const buttons = screen.getAllByRole('button', { name: /cancel/i })
      expect(buttons.length).toBeGreaterThan(0)
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
    })

    it('should cancel import when confirmation is declined', async () => {
      const user = userEvent.setup()
      const mockFile = new File(['test'], 'project.zip', { type: 'application/zip' })
      
      render(
        <ProjectImportButton 
          onImport={mockOnImport}
          showConfirmation={true}
        />
      )
      
      await user.click(screen.getByRole('button', { name: /import project/i }))
      
      const fileInput = screen.getByLabelText(/select project file/i)
      await user.upload(fileInput, mockFile)
      
      // Click cancel on confirmation dialog (last cancel button)
      const cancelButtons = screen.getAllByRole('button', { name: /cancel/i })
      await user.click(cancelButtons[cancelButtons.length - 1])
      
      expect(importProject).not.toHaveBeenCalled()
      expect(mockOnImport).not.toHaveBeenCalled()
    })

    it('should handle large file warning', async () => {
      const user = userEvent.setup()
      // Create a mock file with size property instead of actual content
      const largeFile = new File(['test'], 'large.zip', { type: 'application/zip' })
      Object.defineProperty(largeFile, 'size', { value: 100 * 1024 * 1024 }) // 100MB
      
      render(
        <ProjectImportButton 
          onImport={mockOnImport}
          maxFileSize={50 * 1024 * 1024} // 50MB limit
        />
      )
      
      await user.click(screen.getByRole('button', { name: /import project/i }))
      
      const fileInput = screen.getByLabelText(/select project file/i)
      await user.upload(fileInput, largeFile)
      
      await waitFor(() => {
        expect(screen.getByText(/file is too large/i)).toBeInTheDocument()
      })
      expect(importProject).not.toHaveBeenCalled()
    }, 10000)
  })
})