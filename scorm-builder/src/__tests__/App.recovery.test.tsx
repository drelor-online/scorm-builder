import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AppWithDashboard } from '../App.dashboard'
import { showError } from '../components/ErrorNotification'

// Mock the storage hook
const mockStorage = {
  isInitialized: true,
  error: null,
  currentProjectId: null,
  openProject: vi.fn(),
  deleteProject: vi.fn(),
  checkForRecovery: vi.fn(),
  recoverFromBackup: vi.fn(),
  listProjects: vi.fn(),
  getRecentProjects: vi.fn(),
  getContent: vi.fn().mockResolvedValue(null),
  saveContent: vi.fn(),
  getCourseMetadata: vi.fn().mockResolvedValue(null),
  saveCourseMetadata: vi.fn()
}

vi.mock('../hooks/usePersistentStorage', () => ({
  usePersistentStorage: () => mockStorage
}))

vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: () => mockStorage,
  PersistentStorageProvider: ({ children }: any) => children
}))

// Mock file association
vi.mock('../utils/fileAssociation', () => ({
  handleFileAssociation: vi.fn()
}))

// Mock other components
vi.mock('../components/DebugInfo', () => ({
  DebugInfo: () => null
}))

vi.mock('../components/DebugPanel', () => ({
  DebugPanel: () => null
}))

vi.mock('../components/ErrorNotification', () => ({
  ErrorNotification: () => null,
  showError: vi.fn(),
  showInfo: vi.fn(),
  showWarning: vi.fn()
}))

vi.mock('../contexts/UnifiedMediaContext', () => ({
  UnifiedMediaProvider: ({ children }: any) => children
}))

describe('App Dashboard - Recovery Dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.listProjects.mockResolvedValue([])
    mockStorage.getRecentProjects.mockResolvedValue([])
  })

  it('should show recovery dialog when backup is detected', async () => {
    // Mock checkForRecovery to return a backup
    mockStorage.checkForRecovery.mockResolvedValue({
      hasBackup: true,
      backupTimestamp: '2024-01-15T10:00:00Z',
      projectPath: 'C:/Projects/MyProject_123.scormproj',
      projectName: 'MyProject'
    })

    render(<AppWithDashboard />)

    // Wait for recovery check
    await waitFor(() => {
      expect(mockStorage.checkForRecovery).toHaveBeenCalled()
    })

    // Check that recovery dialog is shown
    await waitFor(() => {
      expect(screen.getByText(/recover unsaved work/i)).toBeInTheDocument()
      expect(screen.getByText(/MyProject/)).toBeInTheDocument()
      expect(screen.getByText(/unsaved work from a previous session/i)).toBeInTheDocument()
    })

    // Should have Recover and Ignore buttons
    expect(screen.getByRole('button', { name: /recover/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument()
  })

  it('should recover project when Recover button is clicked', async () => {
    const projectPath = 'C:/Projects/MyProject_123.scormproj'
    
    mockStorage.checkForRecovery.mockResolvedValue({
      hasBackup: true,
      backupTimestamp: '2024-01-15T10:00:00Z',
      projectPath,
      projectName: 'MyProject'
    })

    mockStorage.recoverFromBackup.mockResolvedValue({
      pages: [],
      metadata: { title: 'Recovered Project' }
    })

    render(<AppWithDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/recover unsaved work/i)).toBeInTheDocument()
    })

    // Click Recover button
    const recoverButton = screen.getByRole('button', { name: /recover/i })
    fireEvent.click(recoverButton)

    await waitFor(() => {
      // Should call recoverFromBackup with the project path (not backup path)
      expect(mockStorage.recoverFromBackup).toHaveBeenCalledWith(projectPath)
      
      // Should then open the recovered project
      expect(mockStorage.openProject).toHaveBeenCalledWith(
        projectPath,
        expect.any(Function)
      )
    })
  })

  it('should dismiss recovery dialog when Discard button is clicked', async () => {
    mockStorage.checkForRecovery.mockResolvedValue({
      hasBackup: true,
      backupTimestamp: '2024-01-15T10:00:00Z',
      projectPath: 'C:/Projects/MyProject_123.scormproj',
      projectName: 'MyProject'
    })

    render(<AppWithDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/recover unsaved work/i)).toBeInTheDocument()
    })

    // Click Discard button
    const discardButton = screen.getByRole('button', { name: /discard/i })
    fireEvent.click(discardButton)

    await waitFor(() => {
      // Dialog should be dismissed
      expect(screen.queryByText(/recover unsaved work/i)).not.toBeInTheDocument()
      
      // Should not call recovery
      expect(mockStorage.recoverFromBackup).not.toHaveBeenCalled()
    })
  })

  it('should not show recovery dialog when no backup exists', async () => {
    mockStorage.checkForRecovery.mockResolvedValue({
      hasBackup: false
    })

    render(<AppWithDashboard />)

    await waitFor(() => {
      expect(mockStorage.checkForRecovery).toHaveBeenCalled()
    })

    // Should not show recovery dialog
    expect(screen.queryByText(/recover unsaved work/i)).not.toBeInTheDocument()
  })

  it('should handle recovery errors gracefully', async () => {
    const projectPath = 'C:/Projects/MyProject_123.scormproj'
    
    mockStorage.checkForRecovery.mockResolvedValue({
      hasBackup: true,
      backupTimestamp: '2024-01-15T10:00:00Z',
      projectPath,
      projectName: 'MyProject'
    })

    mockStorage.recoverFromBackup.mockRejectedValue(
      new Error('Failed to recover from backup')
    )

    render(<AppWithDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/recover unsaved work/i)).toBeInTheDocument()
    })

    // Click Recover button
    const recoverButton = screen.getByRole('button', { name: /recover/i })
    fireEvent.click(recoverButton)

    await waitFor(() => {
      // Should call recoverFromBackup
      expect(mockStorage.recoverFromBackup).toHaveBeenCalledWith(projectPath)
    })

    await waitFor(() => {
      // Should show error toast
      expect(showError).toHaveBeenCalledWith(
        expect.stringMatching(/failed to recover/i)
      )
    })

    // Dialog should still be visible for retry (based on updated implementation)
    expect(screen.getByText(/recover unsaved work/i)).toBeInTheDocument()
  })
})