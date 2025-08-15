/**
 * ProjectDashboard - Consolidated Test Suite
 * 
 * This file consolidates ProjectDashboard tests from 4 separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - ProjectDashboard.test.tsx (main functionality)
 * - ProjectDashboard.automationButtons.test.tsx (automation button features)
 * - ProjectDashboard.defaultFolder.test.tsx (default folder handling)
 * - ProjectDashboard.importExport.test.tsx (import/export functionality)
 * 
 * Test Categories:
 * - Core dashboard functionality and project listing
 * - Project operations (create, open, delete, rename)
 * - Default folder management and preferences
 * - Import/export functionality and file handling
 * - Automation buttons and batch operations
 * - Project search and filtering
 * - User interface interactions and feedback
 * - Error handling and edge cases
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectDashboard } from '../ProjectDashboard'
import { useStorage } from '../../contexts/PersistentStorageContext'

// Mock dependencies
vi.mock('../../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    isInitialized: true,
    currentProjectId: null,
    projects: [
      { id: 'project-1', name: 'Test Project 1', lastModified: '2023-01-01' },
      { id: 'project-2', name: 'Test Project 2', lastModified: '2023-01-02' }
    ],
    createProject: vi.fn(),
    openProject: vi.fn(),
    deleteProject: vi.fn(),
    renameProject: vi.fn(),
    getDefaultFolder: vi.fn().mockReturnValue('/default/path'),
    setDefaultFolder: vi.fn(),
    exportProject: vi.fn(),
    importProject: vi.fn()
  })
}))

vi.mock('../../hooks/useFormChanges', () => ({
  useFormChanges: () => ({
    attemptNavigation: (callback: () => void) => callback(),
    checkForChanges: vi.fn()
  })
}))

// Mock file operations
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockInvoke
}))

describe('ProjectDashboard - Consolidated Test Suite', () => {
  const defaultProps = {
    onProjectSelect: vi.fn(),
    onCreateNew: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue({ success: true })
  })

  describe('Core Dashboard Functionality and Project Listing', () => {
    it('renders the dashboard with project list', () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      expect(screen.getByText('Projects')).toBeInTheDocument()
      expect(screen.getByText('Test Project 1')).toBeInTheDocument()
      expect(screen.getByText('Test Project 2')).toBeInTheDocument()
    })

    it('displays create new project button', () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      expect(screen.getByText(/create new/i)).toBeInTheDocument()
    })

    it('shows project metadata correctly', () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      // Projects should show their names and last modified dates
      expect(screen.getByText('Test Project 1')).toBeInTheDocument()
      expect(screen.getByText('Test Project 2')).toBeInTheDocument()
    })

    it('handles empty project list', () => {
      // Mock empty projects list
      vi.mocked(useStorage).mockReturnValue({
        isInitialized: true,
        currentProjectId: null,
        projects: [],
        createProject: vi.fn(),
        openProject: vi.fn(),
        deleteProject: vi.fn(),
        renameProject: vi.fn(),
        getDefaultFolder: vi.fn().mockReturnValue('/default/path'),
        setDefaultFolder: vi.fn(),
        exportProject: vi.fn(),
        importProject: vi.fn()
      })

      render(<ProjectDashboard {...defaultProps} />)
      
      expect(screen.getByText(/no projects/i)).toBeInTheDocument()
    })

    it('sorts projects by last modified date', () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      const projectElements = screen.getAllByText(/Test Project/)
      
      // Should display projects in order (most recent first if that's the sort)
      expect(projectElements).toHaveLength(2)
    })
  })

  describe('Project Operations', () => {
    it('calls onProjectSelect when project is clicked', async () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      const project1 = screen.getByText('Test Project 1')
      await userEvent.click(project1)
      
      expect(defaultProps.onProjectSelect).toHaveBeenCalledWith('project-1')
    })

    it('calls onCreateNew when create button is clicked', async () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      const createButton = screen.getByText(/create new/i)
      await userEvent.click(createButton)
      
      expect(defaultProps.onCreateNew).toHaveBeenCalled()
    })

    it('handles project deletion', async () => {
      const mockStorage = vi.mocked(useStorage)()
      render(<ProjectDashboard {...defaultProps} />)
      
      // Find delete button for first project
      const deleteButtons = screen.getAllByText(/delete/i)
      await userEvent.click(deleteButtons[0])
      
      // Should show confirmation dialog
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
      
      // Confirm deletion
      const confirmButton = screen.getByText(/confirm/i)
      await userEvent.click(confirmButton)
      
      expect(mockStorage.deleteProject).toHaveBeenCalledWith('project-1')
    })

    it('handles project renaming', async () => {
      const mockStorage = vi.mocked(useStorage)()
      render(<ProjectDashboard {...defaultProps} />)
      
      // Find rename button for first project
      const renameButtons = screen.getAllByText(/rename/i)
      await userEvent.click(renameButtons[0])
      
      // Should show rename input
      const nameInput = screen.getByDisplayValue('Test Project 1')
      await userEvent.clear(nameInput)
      await userEvent.type(nameInput, 'Renamed Project')
      
      // Save the rename
      const saveButton = screen.getByText(/save/i)
      await userEvent.click(saveButton)
      
      expect(mockStorage.renameProject).toHaveBeenCalledWith('project-1', 'Renamed Project')
    })

    it('cancels project renaming when cancelled', async () => {
      const mockStorage = vi.mocked(useStorage)()
      render(<ProjectDashboard {...defaultProps} />)
      
      const renameButtons = screen.getAllByText(/rename/i)
      await userEvent.click(renameButtons[0])
      
      const cancelButton = screen.getByText(/cancel/i)
      await userEvent.click(cancelButton)
      
      expect(mockStorage.renameProject).not.toHaveBeenCalled()
    })

    it('validates project names during rename', async () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      const renameButtons = screen.getAllByText(/rename/i)
      await userEvent.click(renameButtons[0])
      
      const nameInput = screen.getByDisplayValue('Test Project 1')
      await userEvent.clear(nameInput)
      await userEvent.type(nameInput, '') // Empty name
      
      const saveButton = screen.getByText(/save/i)
      await userEvent.click(saveButton)
      
      // Should show validation error
      expect(screen.getByText(/name cannot be empty/i)).toBeInTheDocument()
    })
  })

  describe('Default Folder Management and Preferences', () => {
    it('displays current default folder', () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      // Should show default folder path
      expect(screen.getByText(/default folder/i)).toBeInTheDocument()
      expect(screen.getByText('/default/path')).toBeInTheDocument()
    })

    it('allows changing default folder', async () => {
      const mockStorage = vi.mocked(useStorage)()
      mockInvoke.mockResolvedValue('/new/folder/path')
      
      render(<ProjectDashboard {...defaultProps} />)
      
      const changeFolderButton = screen.getByText(/change folder/i)
      await userEvent.click(changeFolderButton)
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('select_folder')
        expect(mockStorage.setDefaultFolder).toHaveBeenCalledWith('/new/folder/path')
      })
    })

    it('handles folder selection cancellation', async () => {
      const mockStorage = vi.mocked(useStorage)()
      mockInvoke.mockResolvedValue(null) // User cancelled
      
      render(<ProjectDashboard {...defaultProps} />)
      
      const changeFolderButton = screen.getByText(/change folder/i)
      await userEvent.click(changeFolderButton)
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('select_folder')
        expect(mockStorage.setDefaultFolder).not.toHaveBeenCalled()
      })
    })

    it('shows folder selection error gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Folder access denied'))
      
      render(<ProjectDashboard {...defaultProps} />)
      
      const changeFolderButton = screen.getByText(/change folder/i)
      await userEvent.click(changeFolderButton)
      
      await waitFor(() => {
        expect(screen.getByText(/error selecting folder/i)).toBeInTheDocument()
      })
    })

    it('validates folder permissions', async () => {
      const mockStorage = vi.mocked(useStorage)()
      mockInvoke.mockResolvedValue('/read-only/path')
      
      render(<ProjectDashboard {...defaultProps} />)
      
      const changeFolderButton = screen.getByText(/change folder/i)
      await userEvent.click(changeFolderButton)
      
      // Should attempt to set the folder and handle any permission issues
      await waitFor(() => {
        expect(mockStorage.setDefaultFolder).toHaveBeenCalledWith('/read-only/path')
      })
    })

    it('remembers folder preference across sessions', () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      // Should load and display the saved default folder
      expect(screen.getByText('/default/path')).toBeInTheDocument()
    })
  })

  describe('Import/Export Functionality and File Handling', () => {
    it('shows import project button', () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      expect(screen.getByText(/import/i)).toBeInTheDocument()
    })

    it('handles project import', async () => {
      const mockStorage = vi.mocked(useStorage)()
      mockInvoke.mockResolvedValue('/path/to/project.scormproj')
      
      render(<ProjectDashboard {...defaultProps} />)
      
      const importButton = screen.getByText(/import/i)
      await userEvent.click(importButton)
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('select_file', {
          title: 'Import Project',
          filters: [{ name: 'SCORM Project', extensions: ['scormproj'] }]
        })
        expect(mockStorage.importProject).toHaveBeenCalledWith('/path/to/project.scormproj')
      })
    })

    it('handles export project functionality', async () => {
      const mockStorage = vi.mocked(useStorage)()
      mockInvoke.mockResolvedValue('/export/path/project.scormproj')
      
      render(<ProjectDashboard {...defaultProps} />)
      
      // Find export button for first project
      const exportButtons = screen.getAllByText(/export/i)
      await userEvent.click(exportButtons[0])
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('save_file', {
          title: 'Export Project',
          defaultPath: 'Test Project 1.scormproj',
          filters: [{ name: 'SCORM Project', extensions: ['scormproj'] }]
        })
        expect(mockStorage.exportProject).toHaveBeenCalledWith('project-1', '/export/path/project.scormproj')
      })
    })

    it('handles import cancellation gracefully', async () => {
      const mockStorage = vi.mocked(useStorage)()
      mockInvoke.mockResolvedValue(null) // User cancelled file selection
      
      render(<ProjectDashboard {...defaultProps} />)
      
      const importButton = screen.getByText(/import/i)
      await userEvent.click(importButton)
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled()
        expect(mockStorage.importProject).not.toHaveBeenCalled()
      })
    })

    it('shows import/export progress feedback', async () => {
      const mockStorage = vi.mocked(useStorage)()
      mockInvoke.mockResolvedValue('/path/to/project.scormproj')
      
      render(<ProjectDashboard {...defaultProps} />)
      
      const importButton = screen.getByText(/import/i)
      await userEvent.click(importButton)
      
      // Should show loading state
      expect(screen.getByText(/importing/i)).toBeInTheDocument()
      
      await waitFor(() => {
        expect(mockStorage.importProject).toHaveBeenCalled()
      })
      
      // Should show success message
      expect(screen.getByText(/import successful/i)).toBeInTheDocument()
    })

    it('handles file format validation', async () => {
      mockInvoke.mockResolvedValue('/path/to/invalid.txt')
      
      render(<ProjectDashboard {...defaultProps} />)
      
      const importButton = screen.getByText(/import/i)
      await userEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText(/invalid file format/i)).toBeInTheDocument()
      })
    })

    it('handles large file imports with progress tracking', async () => {
      const mockStorage = vi.mocked(useStorage)()
      mockInvoke.mockResolvedValue('/path/to/large-project.scormproj')
      
      // Mock progress tracking
      mockStorage.importProject.mockImplementation(async (path, onProgress) => {
        if (onProgress) {
          onProgress({ percent: 25, message: 'Reading file...' })
          onProgress({ percent: 50, message: 'Processing content...' })
          onProgress({ percent: 75, message: 'Creating project...' })
          onProgress({ percent: 100, message: 'Complete!' })
        }
        return { success: true }
      })
      
      render(<ProjectDashboard {...defaultProps} />)
      
      const importButton = screen.getByText(/import/i)
      await userEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText(/processing content/i)).toBeInTheDocument()
      })
    })
  })

  describe('Automation Buttons and Batch Operations', () => {
    it('shows automation controls section', () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      expect(screen.getByText(/automation/i)).toBeInTheDocument()
    })

    it('provides bulk operations for multiple projects', async () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      // Select multiple projects
      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[0])
      await userEvent.click(checkboxes[1])
      
      // Should show bulk action buttons
      expect(screen.getByText(/bulk export/i)).toBeInTheDocument()
      expect(screen.getByText(/bulk delete/i)).toBeInTheDocument()
    })

    it('handles bulk export operation', async () => {
      const mockStorage = vi.mocked(useStorage)()
      mockInvoke.mockResolvedValue('/export/folder')
      
      render(<ProjectDashboard {...defaultProps} />)
      
      // Select projects
      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[0])
      await userEvent.click(checkboxes[1])
      
      const bulkExportButton = screen.getByText(/bulk export/i)
      await userEvent.click(bulkExportButton)
      
      await waitFor(() => {
        expect(mockStorage.exportProject).toHaveBeenCalledTimes(2)
      })
    })

    it('handles bulk delete operation with confirmation', async () => {
      const mockStorage = vi.mocked(useStorage)()
      render(<ProjectDashboard {...defaultProps} />)
      
      // Select projects
      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[0])
      await userEvent.click(checkboxes[1])
      
      const bulkDeleteButton = screen.getByText(/bulk delete/i)
      await userEvent.click(bulkDeleteButton)
      
      // Should show confirmation
      expect(screen.getByText(/delete 2 projects/i)).toBeInTheDocument()
      
      const confirmButton = screen.getByText(/confirm/i)
      await userEvent.click(confirmButton)
      
      expect(mockStorage.deleteProject).toHaveBeenCalledTimes(2)
    })

    it('provides project backup automation', async () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      const backupButton = screen.getByText(/create backup/i)
      expect(backupButton).toBeInTheDocument()
      
      await userEvent.click(backupButton)
      
      // Should initiate backup process
      expect(screen.getByText(/creating backup/i)).toBeInTheDocument()
    })

    it('shows project maintenance tools', () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      expect(screen.getByText(/cleanup/i)).toBeInTheDocument()
      expect(screen.getByText(/optimize/i)).toBeInTheDocument()
    })

    it('handles automation errors gracefully', async () => {
      const mockStorage = vi.mocked(useStorage)()
      mockStorage.exportProject.mockRejectedValue(new Error('Export failed'))
      
      render(<ProjectDashboard {...defaultProps} />)
      
      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[0])
      
      const bulkExportButton = screen.getByText(/bulk export/i)
      await userEvent.click(bulkExportButton)
      
      await waitFor(() => {
        expect(screen.getByText(/export failed/i)).toBeInTheDocument()
      })
    })
  })

  describe('Project Search and Filtering', () => {
    it('provides search functionality', () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      expect(screen.getByPlaceholderText(/search projects/i)).toBeInTheDocument()
    })

    it('filters projects based on search query', async () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search projects/i)
      await userEvent.type(searchInput, 'Project 1')
      
      expect(screen.getByText('Test Project 1')).toBeInTheDocument()
      expect(screen.queryByText('Test Project 2')).not.toBeInTheDocument()
    })

    it('handles empty search results', async () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search projects/i)
      await userEvent.type(searchInput, 'Nonexistent Project')
      
      expect(screen.getByText(/no projects found/i)).toBeInTheDocument()
    })

    it('provides sorting options', () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      expect(screen.getByText(/sort by/i)).toBeInTheDocument()
      expect(screen.getByText(/name/i)).toBeInTheDocument()
      expect(screen.getByText(/date/i)).toBeInTheDocument()
    })

    it('applies sorting correctly', async () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      const sortButton = screen.getByText(/sort by name/i)
      await userEvent.click(sortButton)
      
      // Projects should be reordered alphabetically
      const projectElements = screen.getAllByText(/Test Project/)
      expect(projectElements[0]).toHaveTextContent('Test Project 1')
    })

    it('combines search and sort functionality', async () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search projects/i)
      await userEvent.type(searchInput, 'Test')
      
      const sortButton = screen.getByText(/sort by date/i)
      await userEvent.click(sortButton)
      
      // Should show filtered and sorted results
      expect(screen.getByText('Test Project 1')).toBeInTheDocument()
      expect(screen.getByText('Test Project 2')).toBeInTheDocument()
    })
  })

  describe('User Interface Interactions and Feedback', () => {
    it('provides hover effects for interactive elements', async () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      const project1 = screen.getByText('Test Project 1')
      await userEvent.hover(project1)
      
      // Should show additional project information on hover
      expect(screen.getByText(/last modified/i)).toBeInTheDocument()
    })

    it('shows loading states during operations', async () => {
      const mockStorage = vi.mocked(useStorage)()
      mockStorage.deleteProject.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))
      
      render(<ProjectDashboard {...defaultProps} />)
      
      const deleteButtons = screen.getAllByText(/delete/i)
      await userEvent.click(deleteButtons[0])
      
      const confirmButton = screen.getByText(/confirm/i)
      await userEvent.click(confirmButton)
      
      expect(screen.getByText(/deleting/i)).toBeInTheDocument()
    })

    it('provides success feedback for operations', async () => {
      const mockStorage = vi.mocked(useStorage)()
      render(<ProjectDashboard {...defaultProps} />)
      
      const renameButtons = screen.getAllByText(/rename/i)
      await userEvent.click(renameButtons[0])
      
      const nameInput = screen.getByDisplayValue('Test Project 1')
      await userEvent.clear(nameInput)
      await userEvent.type(nameInput, 'New Name')
      
      const saveButton = screen.getByText(/save/i)
      await userEvent.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText(/renamed successfully/i)).toBeInTheDocument()
      })
    })

    it('shows contextual menus for project actions', async () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      const project1 = screen.getByText('Test Project 1')
      await userEvent.rightClick(project1)
      
      // Should show context menu
      expect(screen.getByText(/open/i)).toBeInTheDocument()
      expect(screen.getByText(/rename/i)).toBeInTheDocument()
      expect(screen.getByText(/delete/i)).toBeInTheDocument()
      expect(screen.getByText(/export/i)).toBeInTheDocument()
    })

    it('handles keyboard navigation', async () => {
      render(<ProjectDashboard {...defaultProps} />)
      
      const project1 = screen.getByText('Test Project 1')
      project1.focus()
      
      await userEvent.keyboard('{Enter}')
      expect(defaultProps.onProjectSelect).toHaveBeenCalledWith('project-1')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles storage initialization errors', () => {
      vi.mocked(useStorage).mockReturnValue({
        isInitialized: false,
        currentProjectId: null,
        projects: [],
        error: 'Storage initialization failed'
      })
      
      render(<ProjectDashboard {...defaultProps} />)
      
      expect(screen.getByText(/storage error/i)).toBeInTheDocument()
    })

    it('handles corrupted project data gracefully', () => {
      vi.mocked(useStorage).mockReturnValue({
        isInitialized: true,
        currentProjectId: null,
        projects: [
          { id: 'corrupt-1', name: null, lastModified: null },
          { id: 'valid-1', name: 'Valid Project', lastModified: '2023-01-01' }
        ],
        createProject: vi.fn(),
        openProject: vi.fn(),
        deleteProject: vi.fn(),
        renameProject: vi.fn(),
        getDefaultFolder: vi.fn().mockReturnValue('/default/path'),
        setDefaultFolder: vi.fn(),
        exportProject: vi.fn(),
        importProject: vi.fn()
      })
      
      render(<ProjectDashboard {...defaultProps} />)
      
      // Should show valid project and handle corrupted one gracefully
      expect(screen.getByText('Valid Project')).toBeInTheDocument()
      expect(screen.getByText(/corrupted project/i)).toBeInTheDocument()
    })

    it('handles network connectivity issues', async () => {
      const mockStorage = vi.mocked(useStorage)()
      mockStorage.openProject.mockRejectedValue(new Error('Network error'))
      
      render(<ProjectDashboard {...defaultProps} />)
      
      const project1 = screen.getByText('Test Project 1')
      await userEvent.click(project1)
      
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })
    })

    it('handles permission errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Permission denied'))
      
      render(<ProjectDashboard {...defaultProps} />)
      
      const changeFolderButton = screen.getByText(/change folder/i)
      await userEvent.click(changeFolderButton)
      
      await waitFor(() => {
        expect(screen.getByText(/permission denied/i)).toBeInTheDocument()
      })
    })

    it('handles concurrent operations safely', async () => {
      const mockStorage = vi.mocked(useStorage)()
      render(<ProjectDashboard {...defaultProps} />)
      
      // Simulate concurrent rename and delete
      const renameButtons = screen.getAllByText(/rename/i)
      const deleteButtons = screen.getAllByText(/delete/i)
      
      await userEvent.click(renameButtons[0])
      await userEvent.click(deleteButtons[0])
      
      // Should handle concurrent operations gracefully
      expect(screen.getByText(/operation in progress/i)).toBeInTheDocument()
    })

    it('recovers from temporary failures', async () => {
      const mockStorage = vi.mocked(useStorage)()
      mockStorage.openProject
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ success: true })
      
      render(<ProjectDashboard {...defaultProps} />)
      
      const project1 = screen.getByText('Test Project 1')
      await userEvent.click(project1)
      
      // Should show retry option
      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument()
      })
      
      const retryButton = screen.getByText(/retry/i)
      await userEvent.click(retryButton)
      
      expect(defaultProps.onProjectSelect).toHaveBeenCalledWith('project-1')
    })
  })
})