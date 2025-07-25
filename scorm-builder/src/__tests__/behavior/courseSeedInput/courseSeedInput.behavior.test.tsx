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
    createProject: vi.fn().mockResolvedValue({ id: 'test-project-id', name: 'Test Project' }),
    getProjectMetadata: vi.fn().mockResolvedValue({ name: 'Test Project' }),
    getCourseMetadata: vi.fn().mockResolvedValue(null),
    updateCourseMetadata: vi.fn().mockResolvedValue(undefined),
    updateProjectMetadata: vi.fn().mockResolvedValue(undefined),
    saveContent: vi.fn().mockResolvedValue(undefined),
    getContent: vi.fn().mockResolvedValue(null),
    listProjects: vi.fn().mockResolvedValue([]),
    saveProject: vi.fn().mockResolvedValue(undefined),
    saveCourseMetadata: vi.fn().mockResolvedValue(undefined),
    openProjectFromFile: vi.fn(),
    deleteProject: vi.fn(),
    getRecentProjects: vi.fn().mockResolvedValue([])
  }
}))

// Mock useStorage hook
vi.mock('../../../contexts/PersistentStorageContext', async () => {
  const actual = await vi.importActual('../../../contexts/PersistentStorageContext')
  return {
    ...actual,
    useStorage: () => {
      const mockStorage = {
        initialize: vi.fn().mockResolvedValue(undefined),
        isInitialized: true,
        createProject: vi.fn().mockImplementation(async (name) => {
          // Set currentProjectId when creating a project
          mockStorage.currentProjectId = 'new-project-id'
          return { id: 'new-project-id', name }
        }),
        getProjectMetadata: vi.fn().mockResolvedValue({ name: 'Test Project' }),
        getCourseMetadata: vi.fn().mockResolvedValue(null),
        updateCourseMetadata: vi.fn().mockResolvedValue(undefined),
        updateProjectMetadata: vi.fn().mockResolvedValue(undefined),
        saveContent: vi.fn().mockResolvedValue(undefined),
        getContent: vi.fn().mockResolvedValue(null),
        listProjects: vi.fn().mockResolvedValue([]),
        saveProject: vi.fn().mockResolvedValue(undefined),
        saveCourseMetadata: vi.fn().mockResolvedValue(undefined),
        openProjectFromFile: vi.fn(),
        deleteProject: vi.fn(),
        getRecentProjects: vi.fn().mockResolvedValue([]),
        currentProjectId: 'test-project-id'
      }
      return mockStorage
    }
  }
})

describe('Course Seed Input Page Behavior', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should require course title, at least one topic, and difficulty selection', async () => {
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
      const elements = screen.getAllByText(/Course Configuration/i)
      expect(elements.length).toBeGreaterThan(0)
    }, { timeout: 10000 })

    // Check if all required fields are present
    const titleInput = screen.getByLabelText(/course title/i)
    const topicsTextarea = screen.getByLabelText(/topics/i)
    const difficultyLabel = screen.getByText(/difficulty level/i)
    // Check that Medium (difficulty 3) is selected by default
    const mediumButton = screen.getByRole('button', { name: 'Level 3', pressed: true })
    
    expect(titleInput).toBeInTheDocument()
    expect(topicsTextarea).toBeInTheDocument()
    expect(difficultyLabel).toBeInTheDocument()
    expect(mediumButton).toBeInTheDocument()

    // Find Next button - it should be disabled initially (no topics)
    const nextButton = screen.getByRole('button', { name: /next/i })
    expect(nextButton).toBeDisabled()
    
    // Enter course title
    await user.type(titleInput, 'Test Course')
    
    // Next button should still be disabled (no topics yet)
    expect(nextButton).toBeDisabled()
    
    // Enter a topic
    await user.type(topicsTextarea, 'Topic 1')
    
    // Next button should now be enabled (has title and topics)
    await waitFor(() => {
      expect(nextButton).toBeEnabled()
    })
    
    // Clear the title to test validation
    await user.clear(titleInput)
    
    // Next button should be disabled again (missing title)
    await waitFor(() => {
      expect(nextButton).toBeDisabled()
    })
    
    // Re-enter course title
    await user.type(titleInput, 'My Test Course')
    
    // Enter topics (one per line)
    await user.type(topicsTextarea, 'Introduction to Testing\nAdvanced Testing Concepts')
    
    // Difficulty should already have a default value (3 = Medium)
    expect(screen.getByRole('button', { name: 'Level 3', pressed: true })).toBeInTheDocument()
    
    // Now Next button should be enabled (all required fields filled)
    await waitFor(() => {
      expect(nextButton).toBeEnabled()
    })
  }, 30000)

  it('should allow template selection and adding template topics', async () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <AutoSaveProvider isSaving={false} lastSaved={null} hasUnsavedChanges={false}>
            <App />
          </AutoSaveProvider>
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    await waitFor(() => {
      const elements = screen.getAllByText(/Course Configuration/i)
      expect(elements.length).toBeGreaterThan(0)
    }, { timeout: 10000 })

    // Select a template
    const templateSelect = screen.getByLabelText(/template/i)
    await user.selectOptions(templateSelect, 'How-to Guide')

    // Template topics button should appear
    await waitFor(() => {
      expect(screen.getByText(/add template topics/i)).toBeInTheDocument()
    })

    // Click to add template topics
    const addTemplateButton = screen.getByText(/add template topics/i)
    await user.click(addTemplateButton)

    // Topics should be added to the textarea
    const topicsTextarea = screen.getByLabelText(/topics/i) as HTMLTextAreaElement
    await waitFor(() => {
      expect(topicsTextarea.value).toContain('Introduction')
    })
  }, 30000)

  it('should warn when adding template topics if existing topics are present', async () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <AutoSaveProvider isSaving={false} lastSaved={null} hasUnsavedChanges={false}>
            <App />
          </AutoSaveProvider>
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    await waitFor(() => {
      const elements = screen.getAllByText(/Course Configuration/i)
      expect(elements.length).toBeGreaterThan(0)
    }, { timeout: 10000 })

    // Enter some topics first
    const topicsTextarea = screen.getByLabelText(/topics/i)
    await user.type(topicsTextarea, 'My Custom Topic')

    // Select a template
    const templateSelect = screen.getByLabelText(/template/i)
    await user.selectOptions(templateSelect, 'How-to Guide')

    // Click to add template topics
    const addTemplateButton = await screen.findByText(/add template topics/i)
    await user.click(addTemplateButton)

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/existing topics will be cleared/i)).toBeInTheDocument()
    })

    // Confirm to replace topics
    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmButton)

    // Original topics should be replaced with template topics
    await waitFor(() => {
      expect(topicsTextarea.value).not.toContain('My Custom Topic')
      expect(topicsTextarea.value).toContain('Introduction')
    })
  }, 30000)

  it('should show manage templates dialog as coming soon', async () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <AutoSaveProvider isSaving={false} lastSaved={null} hasUnsavedChanges={false}>
            <App />
          </AutoSaveProvider>
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    await waitFor(() => {
      const elements = screen.getAllByText(/Course Configuration/i)
      expect(elements.length).toBeGreaterThan(0)
    }, { timeout: 10000 })

    // Click manage templates button
    const manageTemplatesButton = screen.getByText(/manage templates/i)
    await user.click(manageTemplatesButton)

    // Should show coming soon dialog
    await waitFor(() => {
      expect(screen.getByText(/will be implemented in a future release/i)).toBeInTheDocument()
    })
  }, 30000)

  it('should accept one topic per line in the topics box', async () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <AutoSaveProvider isSaving={false} lastSaved={null} hasUnsavedChanges={false}>
            <App />
          </AutoSaveProvider>
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    await waitFor(() => {
      const elements = screen.getAllByText(/Course Configuration/i)
      expect(elements.length).toBeGreaterThan(0)
    }, { timeout: 10000 })

    const topicsTextarea = screen.getByLabelText(/topics/i) as HTMLTextAreaElement

    // Type multiple topics separated by newlines
    await user.type(topicsTextarea, 'Topic 1{Enter}Topic 2{Enter}Topic 3')

    // Check that topics are properly formatted
    expect(topicsTextarea.value).toBe('Topic 1\nTopic 2\nTopic 3')
  }, 30000)

  it('should allow difficulty adjustment', async () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <AutoSaveProvider isSaving={false} lastSaved={null} hasUnsavedChanges={false}>
            <App />
          </AutoSaveProvider>
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    await waitFor(() => {
      const elements = screen.getAllByText(/Course Configuration/i)
      expect(elements.length).toBeGreaterThan(0)
    }, { timeout: 10000 })

    // Find difficulty controls - should have Level 3 (Medium) selected by default
    const level3Button = screen.getByRole('button', { name: 'Level 3', pressed: true })
    expect(level3Button).toBeInTheDocument()

    // Click Level 2 (Easy) button
    const level2Button = screen.getByRole('button', { name: 'Level 2' })
    await user.click(level2Button)
    
    // Verify Level 2 is now selected
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Level 2', pressed: true })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Level 3', pressed: false })).toBeInTheDocument()
    })

    // Click Level 5 (Expert) button
    const level5Button = screen.getByRole('button', { name: 'Level 5' })
    await user.click(level5Button)
    
    // Verify Level 5 is now selected
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Level 5', pressed: true })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Level 2', pressed: false })).toBeInTheDocument()
    })
  }, 30000)

  it('should allow submitting form when all fields are valid', async () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <AutoSaveProvider isSaving={false} lastSaved={null} hasUnsavedChanges={false}>
            <App />
          </AutoSaveProvider>
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    await waitFor(() => {
      const elements = screen.getAllByText(/Course Configuration/i)
      expect(elements.length).toBeGreaterThan(0)
    }, { timeout: 10000 })

    // Fill in required fields
    const titleInput = screen.getByLabelText(/course title/i)
    await user.type(titleInput, 'My Test Course')

    const topicsTextarea = screen.getByLabelText(/topics/i)
    await user.type(topicsTextarea, 'Topic 1\nTopic 2')

    // Click Next
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // Check that no error message is displayed
    await waitFor(() => {
      const errorText = screen.queryByText(/is required/i)
      expect(errorText).not.toBeInTheDocument()
    })
    
    // The form should have been submitted successfully
    // The Next button should remain enabled after submission
    expect(nextButton).toBeEnabled()
  }, 30000)

  it.skip('should show course preview with entered data', async () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <AutoSaveProvider isSaving={false} lastSaved={null} hasUnsavedChanges={false}>
            <App />
          </AutoSaveProvider>
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    await waitFor(() => {
      const elements = screen.getAllByText(/Course Configuration/i)
      expect(elements.length).toBeGreaterThan(0)
    }, { timeout: 10000 })

    // Enter course data
    const titleInput = screen.getByLabelText(/course title/i)
    await user.type(titleInput, 'Preview Test Course')

    const topicsTextarea = screen.getByLabelText(/topics/i)
    await user.type(topicsTextarea, 'Preview Topic 1\nPreview Topic 2')

    // Click preview button
    const previewButton = screen.getByText(/preview course/i)
    await user.click(previewButton)

    // Should show preview with entered data
    await waitFor(() => {
      expect(screen.getByText(/Preview Test Course/i)).toBeInTheDocument()
    }, { timeout: 10000 })
  }, 30000)
})