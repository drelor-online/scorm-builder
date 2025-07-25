import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectDashboard } from '../ProjectDashboard'

// Mock Tauri dialog
const mockOpen = vi.fn()
vi.mock('@tauri-apps/api/dialog', () => ({
  open: mockOpen
}))

// Mock window.__TAURI__
global.window = Object.create(window)
Object.defineProperty(window, '__TAURI__', {
  value: {},
  writable: true
})

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

// Mock console methods
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}

// Mock storage context
const mockStorage = {
  isInitialized: true,
  currentProjectId: null,
  error: null,
  createProject: vi.fn(),
  openProject: vi.fn(),
  openProjectFromFile: vi.fn(),
  openProjectFromPath: vi.fn(),
  saveProject: vi.fn(),
  saveProjectAs: vi.fn(),
  listProjects: vi.fn().mockResolvedValue([]),
  getRecentProjects: vi.fn().mockResolvedValue([]),
  checkForRecovery: vi.fn(),
  recoverFromBackup: vi.fn(),
  storeMedia: vi.fn(),
  storeYouTubeVideo: vi.fn(),
  getMedia: vi.fn(),
  getMediaForTopic: vi.fn(),
  saveContent: vi.fn(),
  getContent: vi.fn(),
  saveCourseMetadata: vi.fn(),
  getCourseMetadata: vi.fn(),
  saveAiPrompt: vi.fn(),
  getAiPrompt: vi.fn(),
  saveAudioSettings: vi.fn(),
  getAudioSettings: vi.fn(),
  saveScormConfig: vi.fn(),
  getScormConfig: vi.fn(),
  deleteProject: vi.fn(),
  exportProject: vi.fn(),
  migrateFromLocalStorage: vi.fn(),
  clearRecentFilesCache: vi.fn()
}

vi.mock('../../contexts/PersistentStorageContext', () => ({
  useStorage: () => mockStorage
}))

// Mock ErrorNotification
vi.mock('../ErrorNotification', () => ({
  showError: vi.fn(),
  showInfo: vi.fn()
}))

const renderDashboard = () => {
  return render(<ProjectDashboard onProjectSelected={() => {}} />)
}

describe('ProjectDashboard Default Folder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  describe('Default Folder Display', () => {
    it('should display current default folder when set', () => {
      mockLocalStorage.getItem.mockReturnValue('C:\\Users\\Test\\Projects')
      
      renderDashboard()
      
      expect(screen.getByText(/Default Folder:/i)).toBeInTheDocument()
      expect(screen.getByText('C:\\Users\\Test\\Projects')).toBeInTheDocument()
    })

    it('should display "Not set" when no default folder', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      
      renderDashboard()
      
      expect(screen.getByText(/Default Folder:/i)).toBeInTheDocument()
      expect(screen.getByText('Not set')).toBeInTheDocument()
    })

    it('should show Change Folder button', () => {
      renderDashboard()
      
      const changeButton = screen.getByRole('button', { name: /Change Folder/i })
      expect(changeButton).toBeInTheDocument()
    })
  })

  describe('Change Folder Functionality', () => {
    it('should open folder dialog when Change Folder clicked', async () => {
      mockOpen.mockResolvedValueOnce('C:\\Users\\Test\\NewFolder')
      
      renderDashboard()
      
      const changeButton = screen.getByRole('button', { name: /Change Folder/i })
      fireEvent.click(changeButton)
      
      await waitFor(() => {
        expect(mockOpen).toHaveBeenCalledWith({
          directory: true,
          multiple: false,
          title: 'Select Default Project Folder'
        })
      })
    })

    it('should update localStorage when new folder selected', async () => {
      mockOpen.mockResolvedValueOnce('C:\\Users\\Test\\NewFolder')
      
      renderDashboard()
      
      const changeButton = screen.getByRole('button', { name: /Change Folder/i })
      fireEvent.click(changeButton)
      
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'defaultProjectFolder',
          'C:\\Users\\Test\\NewFolder'
        )
      })
    })

    it('should update display after folder change', async () => {
      mockOpen.mockResolvedValueOnce('C:\\Users\\Test\\NewFolder')
      
      renderDashboard()
      
      const changeButton = screen.getByRole('button', { name: /Change Folder/i })
      fireEvent.click(changeButton)
      
      await waitFor(() => {
        expect(screen.getByText('C:\\Users\\Test\\NewFolder')).toBeInTheDocument()
      })
    })

    it('should handle dialog cancellation', async () => {
      mockOpen.mockResolvedValueOnce(null)
      
      renderDashboard()
      
      const changeButton = screen.getByRole('button', { name: /Change Folder/i })
      fireEvent.click(changeButton)
      
      await waitFor(() => {
        expect(mockLocalStorage.setItem).not.toHaveBeenCalled()
      })
    })

    it('should handle dialog errors gracefully', async () => {
      mockOpen.mockRejectedValueOnce(new Error('Dialog error'))
      
      renderDashboard()
      
      const changeButton = screen.getByRole('button', { name: /Change Folder/i })
      fireEvent.click(changeButton)
      
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          'Failed to select folder:',
          expect.any(Error)
        )
      })
    })
  })

  describe('Clear Default Folder', () => {
    it('should show clear button when default folder is set', () => {
      mockLocalStorage.getItem.mockReturnValue('C:\\Users\\Test\\Projects')
      
      renderDashboard()
      
      const clearButton = screen.getByRole('button', { name: /Clear/i })
      expect(clearButton).toBeInTheDocument()
    })

    it('should not show clear button when no default folder', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      
      renderDashboard()
      
      const clearButton = screen.queryByRole('button', { name: /Clear/i })
      expect(clearButton).not.toBeInTheDocument()
    })

    it('should remove default folder when clear clicked', async () => {
      mockLocalStorage.getItem.mockReturnValue('C:\\Users\\Test\\Projects')
      
      renderDashboard()
      
      const clearButton = screen.getByRole('button', { name: /Clear/i })
      fireEvent.click(clearButton)
      
      await waitFor(() => {
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('defaultProjectFolder')
      })
    })

    it('should update display after clearing', async () => {
      mockLocalStorage.getItem.mockReturnValue('C:\\Users\\Test\\Projects')
      
      renderDashboard()
      
      const clearButton = screen.getByRole('button', { name: /Clear/i })
      fireEvent.click(clearButton)
      
      // Mock the cleared state
      mockLocalStorage.getItem.mockReturnValue(null)
      
      await waitFor(() => {
        expect(screen.getByText('Not set')).toBeInTheDocument()
      })
    })
  })

  describe('Create New Project with Default Folder', () => {
    it('should use default folder for new project if set', async () => {
      mockLocalStorage.getItem.mockReturnValue('C:\\Users\\Test\\Projects')
      mockStorage.createProject.mockResolvedValue({ id: 'test-id', name: 'Test Project' })
      
      renderDashboard()
      
      const createButton = screen.getByRole('button', { name: /Create New Project/i })
      fireEvent.click(createButton)
      
      // Enter project name
      const input = screen.getByPlaceholderText('Enter project name')
      fireEvent.change(input, { target: { value: 'Test Project' } })
      
      // Click create in modal
      const modalCreateButton = screen.getAllByRole('button', { name: /Create/i })[1] // Second create button is in modal
      fireEvent.click(modalCreateButton)
      
      // The createProject should be called with defaultFolder parameter
      await waitFor(() => {
        expect(mockStorage.createProject).toHaveBeenCalledWith('Test Project', 'C:\\Users\\Test\\Projects')
      })
    })
  })
})