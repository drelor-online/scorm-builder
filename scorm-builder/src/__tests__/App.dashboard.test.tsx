// Remove unused import
// import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent , waitFor } from './../test/testProviders'
import userEvent from '@testing-library/user-event'
import { AppWithDashboard } from '../App.dashboard'

// Mock child components
vi.mock('../components/ProjectDashboard', () => ({
  ProjectDashboard: ({ onProjectSelected }: any) => (
    <div data-testid="project-dashboard">
      <button onClick={() => onProjectSelected('test-project-id')}>
        Select Project
      </button>
    </div>
  )
}))

vi.mock('../components/ProjectLoadingDialog', () => ({
  ProjectLoadingDialog: ({ isOpen, progress }: any) => 
    isOpen ? (
      <div data-testid="loading-dialog">
        <div data-testid="loading-phase">{progress.phase}</div>
        <div data-testid="loading-percent">{progress.percent}%</div>
        <div data-testid="loading-message">{progress.message}</div>
      </div>
    ) : null
}))

vi.mock('../components/DebugInfo', () => ({
  DebugInfo: () => <div data-testid="debug-info" id="debug-panel" style={{ display: 'none' }}>Debug Info</div>
}))

vi.mock('../components/ErrorNotification', () => ({
  ErrorNotification: () => <div data-testid="error-notification">Error Notification</div>,
  showError: vi.fn(),
  showInfo: vi.fn()
}))

vi.mock('../App', () => ({
  default: ({ onBackToDashboard, pendingProjectId, onPendingProjectHandled }: any) => (
    <div data-testid="main-app">
      <button onClick={onBackToDashboard}>Back to Dashboard</button>
      {pendingProjectId && (
        <button onClick={onPendingProjectHandled}>Handle Pending Project</button>
      )}
    </div>
  )
}))

// Mock storage context
const mockStorage = {
  isInitialized: true,
  error: null as string | null,
  currentProjectId: null as string | null,
  openProject: vi.fn(),
  openProjectFromPath: vi.fn(),
  checkForRecovery: vi.fn(),
  recoverFromBackup: vi.fn()
}

vi.mock('../contexts/PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: any) => children,
  useStorage: () => mockStorage
}))

// Mock file association
vi.mock('../utils/fileAssociation', () => ({
  handleFileAssociation: vi.fn()
}))

// Mock Tauri API
const mockOpenDevtools = vi.fn()
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    openDevtools: mockOpenDevtools
  }))
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

import { handleFileAssociation } from '../utils/fileAssociation'
import { showError, showInfo } from '../components/ErrorNotification'
import { invoke } from '@tauri-apps/api/core'

describe('AppWithDashboard', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
    
    // Reset mock storage state
    mockStorage.isInitialized = true
    mockStorage.error = null
    mockStorage.currentProjectId = null
    mockStorage.checkForRecovery.mockResolvedValue({ hasBackup: false })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Rendering', () => {
    it('should render project dashboard when no project is open', () => {
      render(<AppWithDashboard />)
      
      expect(screen.getByTestId('project-dashboard')).toBeInTheDocument()
      expect(screen.getByTestId('debug-info')).toBeInTheDocument()
      expect(screen.getByTestId('error-notification')).toBeInTheDocument()
    })

    it('should render main app when currentProjectId exists', () => {
      mockStorage.currentProjectId = 'existing-project'
      
      render(<AppWithDashboard />)
      
      expect(screen.getByTestId('main-app')).toBeInTheDocument()
      expect(screen.queryByTestId('project-dashboard')).not.toBeInTheDocument()
    })

    it('should show loading state when storage is not initialized', () => {
      mockStorage.isInitialized = false
      
      render(<AppWithDashboard />)
      
      expect(screen.getByText('Initializing SCORM Builder...')).toBeInTheDocument()
      expect(screen.getByText('Setting up file storage system')).toBeInTheDocument()
    })

    it('should show error state when storage initialization fails', () => {
      mockStorage.isInitialized = false
      mockStorage.error = 'Failed to connect to backend'
      
      render(<AppWithDashboard />)
      
      expect(screen.getByText('Storage Initialization Failed')).toBeInTheDocument()
      expect(screen.getByText('Failed to connect to backend')).toBeInTheDocument()
      expect(screen.getByText(/Tauri backend isn't responding/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    })

    it('should reload page when retry button is clicked', () => {
      mockStorage.isInitialized = false
      mockStorage.error = 'Failed to connect'
      
      // Mock window.location.reload using vi.fn
      const reloadMock = vi.fn()
      const originalLocation = window.location
      delete (window as any).location
      window.location = { ...originalLocation, reload: reloadMock } as any
      
      render(<AppWithDashboard />)
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
      
      expect(reloadMock).toHaveBeenCalled()
      
      // Restore original
      window.location = originalLocation as any
    })
  })

  describe('Project Selection', () => {
    it('should open project when selected from dashboard', async () => {
      mockStorage.openProject.mockResolvedValue(undefined)
      
      render(<AppWithDashboard />)
      
      fireEvent.click(screen.getByText('Select Project'))
      
      await waitFor(() => {
        expect(mockStorage.openProject).toHaveBeenCalledWith('test-project-id', expect.any(Function))
        expect(screen.getByTestId('main-app')).toBeInTheDocument()
      })
      
      expect(showInfo).toHaveBeenCalledWith('Project opened successfully')
    })

    it('should show loading dialog during project opening', async () => {
      mockStorage.openProject.mockImplementation((_id, onProgress) => {
        onProgress({ phase: 'loading', percent: 50, message: 'Loading project...' })
        return Promise.resolve()
      })
      
      render(<AppWithDashboard />)
      
      fireEvent.click(screen.getByText('Select Project'))
      
      expect(screen.getByTestId('loading-dialog')).toBeInTheDocument()
      expect(screen.getByTestId('loading-phase')).toHaveTextContent('loading')
      expect(screen.getByTestId('loading-percent')).toHaveTextContent('50%')
      expect(screen.getByTestId('loading-message')).toHaveTextContent('Loading project...')
    })

    it('should handle project open errors', async () => {
      mockStorage.openProject.mockRejectedValue(new Error('Project not found'))
      
      render(<AppWithDashboard />)
      
      fireEvent.click(screen.getByText('Select Project'))
      
      await waitFor(() => {
        expect(showError).toHaveBeenCalledWith('Project not found', expect.objectContaining({
          label: 'Retry',
          onClick: expect.any(Function)
        }))
      })
    })

    it('should handle unsaved changes when opening project', async () => {
      mockStorage.openProject.mockRejectedValue(new Error('UNSAVED_CHANGES'))
      
      render(<AppWithDashboard />)
      
      fireEvent.click(screen.getByText('Select Project'))
      
      await waitFor(() => {
        expect(screen.getByTestId('main-app')).toBeInTheDocument()
        expect(screen.getByText('Handle Pending Project')).toBeInTheDocument()
      })
    })
  })

  describe('Back to Dashboard', () => {
    it('should return to dashboard when back button is clicked', () => {
      mockStorage.currentProjectId = 'existing-project'
      
      render(<AppWithDashboard />)
      
      fireEvent.click(screen.getByText('Back to Dashboard'))
      
      expect(screen.getByTestId('project-dashboard')).toBeInTheDocument()
      expect(screen.queryByTestId('main-app')).not.toBeInTheDocument()
    })

    it('should open pending file when returning to dashboard', async () => {
      // Start without a project, so dashboard is shown
      mockStorage.currentProjectId = null
      mockStorage.openProjectFromPath.mockResolvedValue(undefined)
      
      // Simulate file association with pending file
      let fileAssociationCallback: any
      vi.mocked(handleFileAssociation).mockImplementation(async (config) => {
        fileAssociationCallback = config
      })
      
      render(<AppWithDashboard />)
      
      // Trigger unsaved changes with a file path
      fileAssociationCallback.onUnsavedChanges('/path/to/file.scorm')
      
      // Open a project first to switch to main app
      mockStorage.openProject.mockResolvedValue(undefined)
      fireEvent.click(screen.getByText('Select Project'))
      
      await waitFor(() => {
        expect(screen.getByTestId('main-app')).toBeInTheDocument()
      })
      
      // Update mock to have a project ID
      mockStorage.currentProjectId = 'test-project-id'
      mockStorage.openProjectFromPath.mockImplementation(() => {
        mockStorage.currentProjectId = 'new-project-id'
        return Promise.resolve()
      })
      
      // Go back to dashboard
      fireEvent.click(screen.getByText('Back to Dashboard'))
      
      await waitFor(() => {
        expect(mockStorage.openProjectFromPath).toHaveBeenCalledWith(
          '/path/to/file.scorm',
          expect.objectContaining({
            skipUnsavedCheck: true,
            onProgress: expect.any(Function)
          })
        )
      })
    })

    it('should open pending project when returning to dashboard', async () => {
      // Start with dashboard
      mockStorage.currentProjectId = null
      mockStorage.openProject
        .mockRejectedValueOnce(new Error('UNSAVED_CHANGES'))
        .mockResolvedValueOnce(undefined)
      
      render(<AppWithDashboard />)
      
      // Try to open a project (will fail with UNSAVED_CHANGES)
      fireEvent.click(screen.getByText('Select Project'))
      
      await waitFor(() => {
        expect(screen.getByTestId('main-app')).toBeInTheDocument()
      })
      
      // Update mock to simulate successful project open
      mockStorage.currentProjectId = 'test-project-id'
      
      // Go back to dashboard
      fireEvent.click(screen.getByText('Back to Dashboard'))
      
      await waitFor(() => {
        expect(mockStorage.openProject).toHaveBeenCalledTimes(2)
        expect(showInfo).toHaveBeenCalledWith('Project opened successfully')
      })
    })
  })

  describe('Crash Recovery', () => {
    it('should show recovery dialog when backup is found', async () => {
      mockStorage.checkForRecovery.mockResolvedValue({
        hasBackup: true,
        backupPath: '/path/to/backup',
        projectName: 'My Project'
      })
      
      render(<AppWithDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Recover Unsaved Work?')).toBeInTheDocument()
        expect(screen.getByText(/found unsaved work.*My Project/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Recover' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument()
      })
    })

    it('should recover from backup when recover is clicked', async () => {
      mockStorage.checkForRecovery.mockResolvedValue({
        hasBackup: true,
        backupPath: '/path/to/backup',
        projectName: 'My Project'
      })
      mockStorage.recoverFromBackup.mockResolvedValue(undefined)
      mockStorage.currentProjectId = 'recovered-project'
      
      render(<AppWithDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Recover Unsaved Work?')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByRole('button', { name: 'Recover' }))
      
      await waitFor(() => {
        expect(mockStorage.recoverFromBackup).toHaveBeenCalledWith('/path/to/backup')
        expect(mockStorage.openProject).toHaveBeenCalledWith('recovered-project', expect.any(Function))
      })
    })

    it('should discard backup when discard is clicked', async () => {
      mockStorage.checkForRecovery.mockResolvedValue({
        hasBackup: true,
        backupPath: '/path/to/backup',
        projectName: 'My Project'
      })
      vi.mocked(invoke).mockResolvedValue(undefined)
      
      render(<AppWithDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Recover Unsaved Work?')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
      
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('delete_project', { filePath: '/path/to/backup' })
        expect(screen.queryByText('Recover Unsaved Work?')).not.toBeInTheDocument()
      })
    })

    it('should handle recovery errors', async () => {
      mockStorage.checkForRecovery.mockResolvedValue({
        hasBackup: true,
        backupPath: '/path/to/backup',
        projectName: 'My Project'
      })
      mockStorage.recoverFromBackup.mockRejectedValue(new Error('Recovery failed'))
      
      render(<AppWithDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Recover Unsaved Work?')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByRole('button', { name: 'Recover' }))
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to recover project: Recovery failed/)).toBeInTheDocument()
      })
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should toggle debug panel with Ctrl+Shift+D', async () => {
      render(<AppWithDashboard />)
      
      const debugPanel = screen.getByTestId('debug-info')
      expect(debugPanel).toHaveStyle({ display: 'none' })
      
      await user.keyboard('{Control>}{Shift>}D')
      
      expect(debugPanel).toHaveStyle({ display: 'flex' })
      
      await user.keyboard('{Control>}{Shift>}D')
      
      expect(debugPanel).toHaveStyle({ display: 'none' })
    })

    it('should handle F12 key for devtools', async () => {
      render(<AppWithDashboard />)
      
      await user.keyboard('{F12}')
      
      // Wait for async import and execution
      await waitFor(() => {
        expect(mockOpenDevtools).toHaveBeenCalled()
      })
    })
  })

  describe('File Association', () => {
    it('should handle file association on mount', () => {
      render(<AppWithDashboard />)
      
      expect(handleFileAssociation).toHaveBeenCalledWith({
        onProjectOpened: expect.any(Function),
        onError: expect.any(Function),
        onUnsavedChanges: expect.any(Function)
      })
    })

    it('should handle project opened from file association', async () => {
      let fileAssociationCallback: any
      vi.mocked(handleFileAssociation).mockImplementation(async (config) => {
        fileAssociationCallback = config
      })
      
      mockStorage.openProject.mockResolvedValue(undefined)
      
      render(<AppWithDashboard />)
      
      await fileAssociationCallback.onProjectOpened('file-assoc-project')
      
      await waitFor(() => {
        expect(mockStorage.openProject).toHaveBeenCalledWith('file-assoc-project', expect.any(Function))
        expect(screen.getByTestId('main-app')).toBeInTheDocument()
      })
    })

    it('should show error from file association', async () => {
      let fileAssociationCallback: any
      vi.mocked(handleFileAssociation).mockImplementation(async (config) => {
        fileAssociationCallback = config
      })
      
      render(<AppWithDashboard />)
      
      fileAssociationCallback.onError('Invalid file format')
      
      // Just check that error is displayed
      await waitFor(() => {
        const errorDiv = screen.getByText('Invalid file format')
        expect(errorDiv).toBeInTheDocument()
      })
    })
  })

  describe('Error Display', () => {
    it('should display error messages', async () => {
      mockStorage.openProject.mockRejectedValue(new Error('Network error'))
      
      render(<AppWithDashboard />)
      
      fireEvent.click(screen.getByText('Select Project'))
      
      await waitFor(() => {
        expect(showError).toHaveBeenCalledWith('Network error', expect.any(Object))
      })
    })
  })
})