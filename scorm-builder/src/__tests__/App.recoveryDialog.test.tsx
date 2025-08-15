import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AppWithDashboard } from '../App.dashboard'
import { FileStorage } from '../services/FileStorage'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock FileStorage
vi.mock('../services/FileStorage', () => ({
  FileStorage: vi.fn().mockImplementation(() => ({
    checkForRecovery: vi.fn(),
    recoverFromBackup: vi.fn(),
    openProject: vi.fn(),
    deleteProject: vi.fn(),
    getRecentFiles: vi.fn().mockResolvedValue([]),
    createProject: vi.fn()
  }))
}))

// Mock navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  BrowserRouter: ({ children }: any) => children,
  Routes: ({ children }: any) => children,
  Route: ({ element }: any) => element
}))

describe('Recovery Dialog Integration Tests', () => {
  let mockFileStorage: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockFileStorage = new FileStorage()
  })

  describe('Recovery Dialog Display', () => {
    it('should show recovery dialog when backup is detected on startup', async () => {
      // Arrange
      mockFileStorage.checkForRecovery.mockResolvedValueOnce({
        hasBackup: true,
        projectPath: '/path/to/project.scormproj',
        projectName: 'Test Project'
      })

      // Act
      render(<AppDashboard />)

      // Assert
      await waitFor(() => {
        expect(mockFileStorage.checkForRecovery).toHaveBeenCalled()
      })

      await waitFor(() => {
        const dialog = screen.getByText(/crash recovery detected/i)
        expect(dialog).toBeInTheDocument()
      })

      expect(screen.getByText(/Test Project/)).toBeInTheDocument()
      expect(screen.getByText(/recover/i)).toBeInTheDocument()
      expect(screen.getByText(/discard/i)).toBeInTheDocument()
    })

    it('should not show recovery dialog when no backup exists', async () => {
      // Arrange
      mockFileStorage.checkForRecovery.mockResolvedValueOnce({
        hasBackup: false
      })

      // Act
      render(<AppDashboard />)

      // Assert
      await waitFor(() => {
        expect(mockFileStorage.checkForRecovery).toHaveBeenCalled()
      })

      // Should not show recovery dialog
      expect(screen.queryByText(/crash recovery detected/i)).not.toBeInTheDocument()
    })

    it('should not show recovery dialog when checkForRecovery fails', async () => {
      // Arrange
      mockFileStorage.checkForRecovery.mockRejectedValueOnce(
        new Error('Failed to check recovery')
      )

      // Act
      render(<AppDashboard />)

      // Assert
      await waitFor(() => {
        expect(mockFileStorage.checkForRecovery).toHaveBeenCalled()
      })

      // Should not show recovery dialog
      expect(screen.queryByText(/crash recovery detected/i)).not.toBeInTheDocument()
    })
  })

  describe('Recovery Dialog Actions', () => {
    beforeEach(async () => {
      // Setup recovery state
      mockFileStorage.checkForRecovery.mockResolvedValueOnce({
        hasBackup: true,
        projectPath: '/path/to/project.scormproj',
        projectName: 'Test Project'
      })

      render(<AppDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/crash recovery detected/i)).toBeInTheDocument()
      })
    })

    it('should recover project when Recover button is clicked', async () => {
      // Arrange
      mockFileStorage.recoverFromBackup.mockResolvedValueOnce({
        project: { id: 'test-123', name: 'Test Project' },
        course_content: {},
        course_data: {}
      })
      mockFileStorage.openProject.mockResolvedValueOnce({})

      // Act
      const recoverButton = screen.getByText(/recover/i)
      fireEvent.click(recoverButton)

      // Assert
      await waitFor(() => {
        expect(mockFileStorage.recoverFromBackup).toHaveBeenCalledWith(
          '/path/to/project.scormproj'
        )
      })

      await waitFor(() => {
        expect(mockFileStorage.openProject).toHaveBeenCalledWith(
          '/path/to/project.scormproj',
          expect.any(Function)
        )
      })

      // Dialog should be closed
      await waitFor(() => {
        expect(screen.queryByText(/crash recovery detected/i)).not.toBeInTheDocument()
      })
    })

    it('should show error message when recovery fails', async () => {
      // Arrange
      mockFileStorage.recoverFromBackup.mockRejectedValueOnce(
        new Error('Recovery failed')
      )

      // Act
      const recoverButton = screen.getByText(/recover/i)
      fireEvent.click(recoverButton)

      // Assert
      await waitFor(() => {
        expect(mockFileStorage.recoverFromBackup).toHaveBeenCalled()
      })

      // Should show error message
      await waitFor(() => {
        const errorMessage = screen.getByText(/failed to recover/i)
        expect(errorMessage).toBeInTheDocument()
      })

      // Dialog should remain open
      expect(screen.getByText(/crash recovery detected/i)).toBeInTheDocument()
    })

    it('should delete backup when Discard button is clicked', async () => {
      // Arrange
      const mockInvoke = await import('@tauri-apps/api/core').then(m => m.invoke as any)
      mockInvoke.mockResolvedValueOnce(undefined)

      // Act
      const discardButton = screen.getByText(/discard/i)
      fireEvent.click(discardButton)

      // Assert
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('delete_project', {
          filePath: '/path/to/project.scormproj'
        })
      })

      // Dialog should be closed
      await waitFor(() => {
        expect(screen.queryByText(/crash recovery detected/i)).not.toBeInTheDocument()
      })
    })

    it('should handle discard errors gracefully', async () => {
      // Arrange
      const mockInvoke = await import('@tauri-apps/api/core').then(m => m.invoke as any)
      mockInvoke.mockRejectedValueOnce(new Error('Delete failed'))

      // Act
      const discardButton = screen.getByText(/discard/i)
      fireEvent.click(discardButton)

      // Assert
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('delete_project', {
          filePath: '/path/to/project.scormproj'
        })
      })

      // Dialog should still close (error handled silently)
      await waitFor(() => {
        expect(screen.queryByText(/crash recovery detected/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Recovery Progress Display', () => {
    it('should show loading progress during recovery', async () => {
      // Arrange
      mockFileStorage.checkForRecovery.mockResolvedValueOnce({
        hasBackup: true,
        projectPath: '/path/to/project.scormproj',
        projectName: 'Test Project'
      })

      let progressCallback: Function | null = null
      mockFileStorage.recoverFromBackup.mockResolvedValueOnce({})
      mockFileStorage.openProject.mockImplementation((path: string, callback: Function) => {
        progressCallback = callback
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({})
          }, 100)
        })
      })

      render(<AppDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/crash recovery detected/i)).toBeInTheDocument()
      })

      // Act
      const recoverButton = screen.getByText(/recover/i)
      fireEvent.click(recoverButton)

      // Simulate progress updates
      await waitFor(() => {
        expect(progressCallback).toBeTruthy()
      })

      if (progressCallback) {
        progressCallback({ phase: 'loading', progress: 25 })
        await waitFor(() => {
          expect(screen.getByText(/loading project/i)).toBeInTheDocument()
        })

        progressCallback({ phase: 'media', progress: 50 })
        await waitFor(() => {
          expect(screen.getByText(/loading media/i)).toBeInTheDocument()
        })

        progressCallback({ phase: 'content', progress: 75 })
        await waitFor(() => {
          expect(screen.getByText(/loading content/i)).toBeInTheDocument()
        })

        progressCallback({ phase: 'finalizing', progress: 95 })
        await waitFor(() => {
          expect(screen.getByText(/finalizing/i)).toBeInTheDocument()
        })
      }
    })
  })

  describe('Multiple Recovery Scenarios', () => {
    it('should handle multiple projects with backups', async () => {
      // First check - has backup
      mockFileStorage.checkForRecovery.mockResolvedValueOnce({
        hasBackup: true,
        projectPath: '/path/to/project1.scormproj',
        projectName: 'Project 1'
      })

      const { rerender } = render(<AppDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/Project 1/)).toBeInTheDocument()
      })

      // Discard first backup
      const discardButton = screen.getByText(/discard/i)
      fireEvent.click(discardButton)

      await waitFor(() => {
        expect(screen.queryByText(/crash recovery detected/i)).not.toBeInTheDocument()
      })

      // Second check - another backup
      mockFileStorage.checkForRecovery.mockResolvedValueOnce({
        hasBackup: true,
        projectPath: '/path/to/project2.scormproj',
        projectName: 'Project 2'
      })

      // Simulate app restart
      rerender(<AppDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/Project 2/)).toBeInTheDocument()
      })
    })

    it('should only check for recovery once on mount', async () => {
      // Arrange
      mockFileStorage.checkForRecovery.mockResolvedValue({
        hasBackup: false
      })

      // Act
      const { rerender } = render(<AppDashboard />)

      await waitFor(() => {
        expect(mockFileStorage.checkForRecovery).toHaveBeenCalledTimes(1)
      })

      // Rerender should not trigger another check
      rerender(<AppDashboard />)

      // Assert
      expect(mockFileStorage.checkForRecovery).toHaveBeenCalledTimes(1)
    })
  })

  describe('Recovery Dialog Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      // Arrange
      mockFileStorage.checkForRecovery.mockResolvedValueOnce({
        hasBackup: true,
        projectPath: '/path/to/project.scormproj',
        projectName: 'Test Project'
      })

      // Act
      render(<AppDashboard />)

      // Assert
      await waitFor(() => {
        const dialog = screen.getByRole('dialog', { name: /crash recovery/i })
        expect(dialog).toBeInTheDocument()
      })

      const recoverButton = screen.getByRole('button', { name: /recover project/i })
      expect(recoverButton).toBeInTheDocument()

      const discardButton = screen.getByRole('button', { name: /discard backup/i })
      expect(discardButton).toBeInTheDocument()
    })

    it('should be keyboard navigable', async () => {
      // Arrange
      mockFileStorage.checkForRecovery.mockResolvedValueOnce({
        hasBackup: true,
        projectPath: '/path/to/project.scormproj',
        projectName: 'Test Project'
      })

      render(<AppDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/crash recovery detected/i)).toBeInTheDocument()
      })

      // Act - Tab to recover button
      const recoverButton = screen.getByText(/recover/i)
      recoverButton.focus()

      // Assert
      expect(document.activeElement).toBe(recoverButton)

      // Act - Tab to discard button
      const discardButton = screen.getByText(/discard/i)
      discardButton.focus()

      // Assert
      expect(document.activeElement).toBe(discardButton)
    })
  })
})