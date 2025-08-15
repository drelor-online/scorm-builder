import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AppWithDashboard } from '../App.dashboard'

// Mock Tauri's invoke function
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

// Mock Tauri window
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    listen: vi.fn(),
    emit: vi.fn(),
    onCloseRequested: vi.fn()
  })
}))

// Mock file association
vi.mock('../utils/fileAssociation', () => ({
  handleFileAssociation: vi.fn()
}))

// Mock error notifications
vi.mock('../components/ErrorNotification', () => ({
  ErrorNotification: () => null,
  showError: vi.fn(),
  showInfo: vi.fn(),
  showWarning: vi.fn()
}))

describe('Recovery Integration Test', () => {
  const testProjectPath = 'C:/Projects/TestProject_1234567890.scormproj'
  const testBackupPath = 'C:/Projects/TestProject_1234567890.scormproj.backup'
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock responses
    mockInvoke.mockImplementation((cmd, args) => {
      switch (cmd) {
        case 'list_projects':
          return Promise.resolve([])
        case 'get_recent_projects':
          return Promise.resolve([])
        case 'init_storage':
          return Promise.resolve(true)
        case 'get_base_path':
          return Promise.resolve('C:/Projects')
        case 'set_projects_directory':
          return Promise.resolve()
        case 'get_default_projects_dir':
          return Promise.resolve('C:/Projects')
        default:
          return Promise.resolve()
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should complete full recovery flow from detection to project opening', async () => {
    // Step 1: Setup - backup exists
    mockInvoke.mockImplementation((cmd, args) => {
      switch (cmd) {
        case 'check_for_recovery':
          return Promise.resolve({
            hasBackup: true,
            backupTimestamp: '2024-01-15T10:00:00Z',
            projectPath: testProjectPath,
            projectName: 'TestProject'
          })
        case 'recover_from_backup':
          // Simulate successful recovery
          return Promise.resolve({
            pages: [
              { id: 'page-1', title: 'Welcome', content: 'Recovered content' }
            ],
            metadata: {
              title: 'Recovered Test Project',
              version: '1.0.0'
            }
          })
        case 'open_project':
          // Simulate successful project opening
          return Promise.resolve({
            id: '1234567890',
            name: 'TestProject',
            path: testProjectPath
          })
        case 'list_projects':
          return Promise.resolve([{
            id: '1234567890',
            name: 'TestProject',
            path: testProjectPath,
            lastModified: new Date().toISOString()
          }])
        case 'get_content':
          return Promise.resolve({
            pages: [
              { id: 'page-1', title: 'Welcome', content: 'Recovered content' }
            ]
          })
        case 'get_course_metadata':
          return Promise.resolve({
            title: 'Recovered Test Project',
            version: '1.0.0'
          })
        case 'init_storage':
          return Promise.resolve(true)
        case 'get_base_path':
          return Promise.resolve('C:/Projects')
        case 'set_projects_directory':
          return Promise.resolve()
        case 'get_default_projects_dir':
          return Promise.resolve('C:/Projects')
        case 'get_recent_projects':
          return Promise.resolve([])
        default:
          return Promise.resolve()
      }
    })

    // Step 2: Render the app
    render(<AppWithDashboard />)

    // Step 3: Wait for storage initialization
    await waitFor(() => {
      expect(screen.getByText(/SCORM Builder Projects/i)).toBeInTheDocument()
    }, { timeout: 5000 })

    // Step 4: Recovery dialog should appear
    await waitFor(() => {
      expect(screen.getByText(/recover unsaved work/i)).toBeInTheDocument()
      expect(screen.getByText(/TestProject/)).toBeInTheDocument()
    }, { timeout: 5000 })

    // Step 5: Click Recover button
    const recoverButton = screen.getByRole('button', { name: /recover/i })
    fireEvent.click(recoverButton)

    // Step 6: Verify recovery was called with correct parameters
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('recover_from_backup', {
        projectId: testProjectPath
      })
    })

    // Step 7: Verify project was opened after recovery
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('open_project', 
        expect.objectContaining({
          projectId: testProjectPath
        })
      )
    })

    // Step 8: Recovery dialog should be closed
    await waitFor(() => {
      expect(screen.queryByText(/recover unsaved work/i)).not.toBeInTheDocument()
    })
  })

  it('should handle recovery failure and allow retry', async () => {
    let recoveryAttempts = 0
    
    mockInvoke.mockImplementation((cmd, args) => {
      switch (cmd) {
        case 'check_for_recovery':
          return Promise.resolve({
            hasBackup: true,
            backupTimestamp: '2024-01-15T10:00:00Z',
            projectPath: testProjectPath,
            projectName: 'TestProject'
          })
        case 'recover_from_backup':
          recoveryAttempts++
          if (recoveryAttempts === 1) {
            // First attempt fails
            return Promise.reject(new Error('Backup file corrupted'))
          } else {
            // Second attempt succeeds
            return Promise.resolve({
              pages: [],
              metadata: { title: 'Recovered' }
            })
          }
        case 'open_project':
          return Promise.resolve({
            id: '1234567890',
            name: 'TestProject',
            path: testProjectPath
          })
        case 'init_storage':
          return Promise.resolve(true)
        case 'get_base_path':
          return Promise.resolve('C:/Projects')
        case 'list_projects':
          return Promise.resolve([])
        case 'get_recent_projects':
          return Promise.resolve([])
        default:
          return Promise.resolve()
      }
    })

    render(<AppWithDashboard />)

    // Wait for recovery dialog
    await waitFor(() => {
      expect(screen.getByText(/recover unsaved work/i)).toBeInTheDocument()
    })

    // First recovery attempt
    const recoverButton = screen.getByRole('button', { name: /recover/i })
    fireEvent.click(recoverButton)

    // Wait for error handling
    await waitFor(() => {
      expect(recoveryAttempts).toBe(1)
    })

    // Dialog should still be visible for retry
    expect(screen.getByText(/recover unsaved work/i)).toBeInTheDocument()

    // Second recovery attempt
    fireEvent.click(recoverButton)

    await waitFor(() => {
      expect(recoveryAttempts).toBe(2)
    })

    // After successful recovery, dialog should close
    await waitFor(() => {
      expect(screen.queryByText(/recover unsaved work/i)).not.toBeInTheDocument()
    })
  })

  it('should allow user to discard recovery and delete backup', async () => {
    mockInvoke.mockImplementation((cmd, args) => {
      switch (cmd) {
        case 'check_for_recovery':
          return Promise.resolve({
            hasBackup: true,
            backupTimestamp: '2024-01-15T10:00:00Z',
            projectPath: testProjectPath,
            projectName: 'TestProject'
          })
        case 'delete_project':
          // Track that backup was deleted
          if (args.filePath === testProjectPath) {
            return Promise.resolve()
          }
          return Promise.reject(new Error('Invalid path'))
        case 'init_storage':
          return Promise.resolve(true)
        case 'get_base_path':
          return Promise.resolve('C:/Projects')
        case 'list_projects':
          return Promise.resolve([])
        case 'get_recent_projects':
          return Promise.resolve([])
        default:
          return Promise.resolve()
      }
    })

    render(<AppWithDashboard />)

    // Wait for recovery dialog
    await waitFor(() => {
      expect(screen.getByText(/recover unsaved work/i)).toBeInTheDocument()
    })

    // Click Discard button
    const discardButton = screen.getByRole('button', { name: /discard/i })
    fireEvent.click(discardButton)

    // Verify backup was deleted
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('delete_project', {
        filePath: testProjectPath
      })
    })

    // Dialog should be closed
    expect(screen.queryByText(/recover unsaved work/i)).not.toBeInTheDocument()

    // Dashboard should be visible
    expect(screen.getByText(/SCORM Builder Projects/i)).toBeInTheDocument()
  })

  it('should not show recovery dialog when no backup exists', async () => {
    mockInvoke.mockImplementation((cmd, args) => {
      switch (cmd) {
        case 'check_for_recovery':
          return Promise.resolve({
            hasBackup: false
          })
        case 'init_storage':
          return Promise.resolve(true)
        case 'get_base_path':
          return Promise.resolve('C:/Projects')
        case 'list_projects':
          return Promise.resolve([])
        case 'get_recent_projects':
          return Promise.resolve([])
        default:
          return Promise.resolve()
      }
    })

    render(<AppWithDashboard />)

    // Wait for dashboard to appear
    await waitFor(() => {
      expect(screen.getByText(/SCORM Builder Projects/i)).toBeInTheDocument()
    })

    // Recovery dialog should never appear
    expect(screen.queryByText(/recover unsaved work/i)).not.toBeInTheDocument()

    // Verify check was performed
    expect(mockInvoke).toHaveBeenCalledWith('check_for_recovery')
  })
})