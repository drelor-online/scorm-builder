import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PersistentStorageProvider } from '../../../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../../../contexts/StepNavigationContext'
import { AutoSaveProvider } from '../../../contexts/AutoSaveContext'
import App from '../../../App'

// Mock file storage
vi.mock('../../../services/FileStorage', () => ({
  fileStorage: {
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),
    createProject: vi.fn().mockResolvedValue('test-project-id'),
    getProjectMetadata: vi.fn().mockResolvedValue({ name: 'Test Project' }),
    getCourseMetadata: vi.fn().mockResolvedValue(null),
    updateCourseMetadata: vi.fn().mockResolvedValue(undefined),
    updateProjectMetadata: vi.fn().mockResolvedValue(undefined),
    saveContent: vi.fn().mockResolvedValue(undefined),
    getContent: vi.fn().mockResolvedValue(null),
    listProjects: vi.fn().mockResolvedValue([])
  }
}))

describe('Button Tooltips', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show tooltips on header buttons when hovering', async () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <AutoSaveProvider isSaving={false} lastSaved={null} hasUnsavedChanges={false}>
            <App />
          </AutoSaveProvider>
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // Wait for the app to load
    await waitFor(() => {
      expect(screen.getByLabelText('Save project')).toBeInTheDocument()
    })

    // Test Save button tooltip
    const saveButton = screen.getByLabelText('Save project')
    await user.hover(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText('Save current project (Ctrl+S)')).toBeInTheDocument()
    })

    // Move away to hide tooltip
    await user.unhover(saveButton)
    await waitFor(() => {
      expect(screen.queryByText('Save current project (Ctrl+S)')).not.toBeInTheDocument()
    })

    // Test Help button tooltip
    const helpButton = screen.getByLabelText('Help documentation')
    await user.hover(helpButton)
    
    await waitFor(() => {
      expect(screen.getByText('View help documentation (F1)')).toBeInTheDocument()
    })

    // Test Settings button tooltip
    const settingsButton = screen.getByLabelText('Application settings')
    await user.hover(settingsButton)
    
    await waitFor(() => {
      expect(screen.getByText('Configure application settings')).toBeInTheDocument()
    })
  })

  it('should show tooltips on Open and Save As buttons', async () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <AutoSaveProvider isSaving={false} lastSaved={null} hasUnsavedChanges={false}>
            <App />
          </AutoSaveProvider>
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // Wait for buttons to be rendered
    await waitFor(() => {
      expect(screen.getByLabelText('Open project')).toBeInTheDocument()
    })

    // Test Open button tooltip
    const openButton = screen.getByLabelText('Open project')
    await user.hover(openButton)
    
    await waitFor(() => {
      expect(screen.getByText('Open an existing project file')).toBeInTheDocument()
    })

    // Test Save As button tooltip
    const saveAsButton = screen.getByLabelText('Save project as')
    await user.hover(saveAsButton)
    
    await waitFor(() => {
      expect(screen.getByText('Save project with a new name')).toBeInTheDocument()
    })
  })

  it('should show tooltips with keyboard navigation', async () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <AutoSaveProvider isSaving={false} lastSaved={null} hasUnsavedChanges={false}>
            <App />
          </AutoSaveProvider>
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // Wait for buttons to be rendered
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open project/i })).toBeInTheDocument()
    })

    // Tab to Open button and focus should show tooltip
    const openButton = screen.getByLabelText('Open project')
    openButton.focus()
    
    await waitFor(() => {
      expect(screen.getByText('Open an existing project file')).toBeInTheDocument()
    })
  })
})