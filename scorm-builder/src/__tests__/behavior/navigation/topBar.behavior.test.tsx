import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '../../../App'
import { PersistentStorageProvider } from '../../../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../../../contexts/StepNavigationContext'
import { fileStorage } from '../../../services/FileStorage'
import { setupBehaviorTest } from '../../utils/behaviorTestHelpers'

/**
 * Behavior Tests for Top Bar - Navigation and Actions
 * 
 * These tests verify the expected behavior from BEHAVIOR_TESTING_REQUIREMENTS.md:
 * - Open should warn about unsaved changes
 * - Save should save ALL data from ALL pages
 * - Save As should default to .scormproj folder
 * - Autosave indicator should work on EVERY page
 * - Help should open slim, efficient modal
 * - Settings should contain all app settings
 * - Preview should show course with ALL current data
 * - Back button should NOT lose data
 * - Next button only enabled when required fields filled
 */

// Mock services
vi.mock('../../../services/FileStorage', () => ({
  fileStorage: {
    initialize: vi.fn(),
    isInitialized: true,
    currentProjectId: 'test-project',
    saveProject: vi.fn(),
    saveProjectAs: vi.fn(),
    saveContent: vi.fn(),
    saveCourseMetadata: vi.fn(),
    saveAiPrompt: vi.fn(),
    saveAudioSettings: vi.fn(),
    saveScormConfig: vi.fn(),
    hasUnsavedChanges: vi.fn(),
    getProjectData: vi.fn(),
    listProjects: vi.fn()
  }
}))

const mockProjectData = {
  courseTitle: 'Test Course',
  courseSeedData: {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: ['Topic 1', 'Topic 2'],
    template: 'None',
    templateTopics: []
  },
  courseContent: {
    title: 'Test Course',
    topics: [
      { id: '1', title: 'Topic 1', content: 'Content 1' },
      { id: '2', title: 'Topic 2', content: 'Content 2' }
    ]
  },
  currentStep: 2,
  lastModified: new Date().toISOString(),
  mediaFiles: {},
  audioFiles: {}
}

describe('Top Bar - Navigation and Actions', () => {
  const { 
    user, 
    expectConfirmationDialog,
    waitForAutosave,
    expectToast,
    expectPreviewToMatchCurrentData
  } = setupBehaviorTest()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fileStorage.getProjectData).mockResolvedValue(mockProjectData)
  })

  it('❌ EXPECTED FAILURE: should warn about unsaved changes when opening new project', async () => {
    // GIVEN: Current project has unsaved changes
    vi.mocked(fileStorage.hasUnsavedChanges).mockReturnValue(true)

    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <App />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // Make a change to trigger unsaved state
    const titleInput = await screen.findByRole('textbox', { name: /course.*title/i })
    await user.clear(titleInput)
    await user.type(titleInput, 'Modified Title')

    // WHEN: User clicks Open
    const openButton = screen.getByRole('button', { name: /open/i })
    await user.click(openButton)

    // THEN: Warning dialog appears
    const dialog = await expectConfirmationDialog('unsaved changes')
    
    // Dialog should offer save, discard, and cancel options
    expect(dialog.dialog).toHaveTextContent(/save.*changes|unsaved.*data/i)
    
    const saveButton = within(dialog.dialog).getByRole('button', { name: /save/i })
    const discardButton = within(dialog.dialog).getByRole('button', { name: /discard|don't save/i })
    const cancelButton = within(dialog.dialog).getByRole('button', { name: /cancel/i })
    
    expect(saveButton).toBeInTheDocument()
    expect(discardButton).toBeInTheDocument()
    expect(cancelButton).toBeInTheDocument()

    // Cancel should close dialog and stay on current project
    await user.click(cancelButton)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(titleInput).toHaveValue('Modified Title')
  })

  it('❌ EXPECTED FAILURE: should save ALL data from ALL pages when clicking Save', async () => {
    // GIVEN: Data entered on multiple pages
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <App />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // Enter data on first page
    const titleInput = await screen.findByRole('textbox', { name: /course.*title/i })
    await user.type(titleInput, ' Updated')

    // Navigate to next page
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // WHEN: User clicks Save from any page
    const saveButton = screen.getByRole('button', { name: /^save$/i })
    await user.click(saveButton)

    // THEN: All data is saved
    await waitFor(() => {
      // Should save metadata
      expect(fileStorage.saveCourseMetadata).toHaveBeenCalled()
      
      // Should save course seed data
      expect(fileStorage.saveContent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          courseTitle: expect.stringContaining('Updated')
        })
      )
      
      // Should save AI prompt if exists
      expect(fileStorage.saveAiPrompt).toHaveBeenCalled()
      
      // Main save should be called
      expect(fileStorage.saveProject).toHaveBeenCalled()
    })

    // Should show success feedback
    await expectToast(/saved.*successfully/i, 'success')
  })

  it('❌ EXPECTED FAILURE: should default Save As to .scormproj folder', async () => {
    // GIVEN: User on any page
    vi.mocked(fileStorage.saveProjectAs).mockResolvedValue({
      id: 'new-id',
      filePath: '/Users/test/Projects/course-copy.scormproj'
    })

    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <App />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // WHEN: User clicks Save As
    const saveAsButton = await screen.findByRole('button', { name: /save as/i })
    await user.click(saveAsButton)

    // THEN: File dialog opens with default folder
    expect(fileStorage.saveProjectAs).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: expect.stringContaining('Projects')
      })
    )
  })

  it('❌ EXPECTED FAILURE: should show autosave indicator on EVERY page', async () => {
    // GIVEN: User navigating through pages
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <App />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // Check first page has autosave
    expect(screen.getByText(/autosave|saving/i)).toBeInTheDocument()

    // Make a change
    const titleInput = await screen.findByRole('textbox', { name: /course.*title/i })
    await user.type(titleInput, ' Modified')

    // Should show saving indicator
    expect(screen.getByText(/saving/i)).toBeInTheDocument()

    // Wait for autosave
    await waitForAutosave()

    // Navigate to next page
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // THEN: Autosave indicator still visible on new page
    expect(screen.getByText(/autosave|saved/i)).toBeInTheDocument()

    // Navigate to another page
    const progressSteps = screen.getAllByRole('button', { name: /step/i })
    await user.click(progressSteps[2])

    // Autosave should still be present
    expect(screen.getByText(/autosave|saved/i)).toBeInTheDocument()
  })

  it('❌ EXPECTED FAILURE: should open help in slim, efficient modal', async () => {
    // GIVEN: User on any page
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <App />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // WHEN: User clicks Help
    const helpButton = await screen.findByRole('button', { name: /help/i })
    await user.click(helpButton)

    // THEN: Help modal opens
    const helpModal = await screen.findByRole('dialog', { name: /help/i })
    expect(helpModal).toBeInTheDocument()

    // Should be slim (not full screen)
    const modalStyles = window.getComputedStyle(helpModal)
    const modalWidth = parseFloat(modalStyles.width)
    const windowWidth = window.innerWidth
    expect(modalWidth).toBeLessThan(windowWidth * 0.8) // Less than 80% of screen

    // Should contain efficient information
    expect(helpModal).toHaveTextContent(/quick start|keyboard shortcuts|tips/i)
    
    // Should NOT have verbose marketing text
    const helpText = helpModal.textContent || ''
    expect(helpText.length).toBeLessThan(2000) // Reasonable amount of text

    // Should have close button
    const closeButton = within(helpModal).getByRole('button', { name: /close/i })
    expect(closeButton).toBeInTheDocument()
  })

  it('❌ EXPECTED FAILURE: should contain ALL settings in Settings window', async () => {
    // GIVEN: User opens settings
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <App />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    const settingsButton = await screen.findByRole('button', { name: /settings/i })
    await user.click(settingsButton)

    // THEN: Settings modal contains all necessary options
    const settingsModal = await screen.findByRole('dialog', { name: /settings/i })

    // API Keys section
    expect(within(settingsModal).getByLabelText(/google.*image.*api/i)).toBeInTheDocument()
    expect(within(settingsModal).getByLabelText(/google.*cse.*id/i)).toBeInTheDocument()
    expect(within(settingsModal).getByLabelText(/youtube.*api/i)).toBeInTheDocument()

    // Default project folder setting
    expect(within(settingsModal).getByLabelText(/default.*project.*folder/i)).toBeInTheDocument()
    
    // Browse button for folder selection
    expect(within(settingsModal).getByRole('button', { name: /browse|choose folder/i })).toBeInTheDocument()

    // Save and Cancel buttons
    expect(within(settingsModal).getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(within(settingsModal).getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('❌ EXPECTED FAILURE: should preview course with ALL current data regardless of page', async () => {
    // GIVEN: User has entered data on multiple pages
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <App />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // Enter some data
    const titleInput = await screen.findByRole('textbox', { name: /course.*title/i })
    await user.type(titleInput, ' - Preview Test')

    // WHEN: User clicks Preview from first page
    const previewButton = screen.getByRole('button', { name: /preview/i })
    const preview = await expectPreviewToMatchCurrentData(previewButton)

    // THEN: Preview shows all data including future pages
    await preview.expectContent('Preview Test')
    await preview.expectContent('Topic 1') // From courseContent
    await preview.expectContent('Topic 2') // From courseContent

    // Close preview
    const closeButton = screen.getByRole('button', { name: /close.*preview/i })
    await user.click(closeButton)

    // Navigate to a later page and preview again
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)
    await user.click(nextButton) // Go to page 3

    // Preview from page 3 should still show all data
    const previewButton2 = screen.getByRole('button', { name: /preview/i })
    const preview2 = await expectPreviewToMatchCurrentData(previewButton2)
    
    await preview2.expectContent('Preview Test')
    await preview2.expectContent('Topic 1')
  })

  it('❌ EXPECTED FAILURE: back button should NOT cause data loss', async () => {
    // GIVEN: User on second page with entered data
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <App />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // Go to second page
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // Enter some data on second page
    const promptField = await screen.findByRole('textbox', { name: /prompt/i })
    const testData = 'Important prompt data that should not be lost'
    await user.type(promptField, testData)

    // WHEN: User clicks Back
    const backButton = screen.getByRole('button', { name: /back/i })
    expect(backButton).toBeInTheDocument() // Should exist on page 2+
    
    await user.click(backButton)

    // Go forward again
    await user.click(nextButton)

    // THEN: Data is preserved
    const promptFieldAgain = await screen.findByRole('textbox', { name: /prompt/i })
    expect(promptFieldAgain).toHaveValue(testData)
  })

  it('❌ EXPECTED FAILURE: next button only enabled when required fields filled', async () => {
    // GIVEN: User on first page with empty required fields
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <App />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    const nextButton = screen.getByRole('button', { name: /next/i })
    
    // THEN: Next button is disabled
    expect(nextButton).toBeDisabled()

    // WHEN: User fills required fields
    const titleInput = await screen.findByRole('textbox', { name: /course.*title/i })
    const topicsInput = await screen.findByRole('textbox', { name: /topics/i })
    const difficultyButtons = screen.getAllByRole('button', { name: /level/i })

    await user.type(titleInput, 'Test Course')
    await user.type(topicsInput, 'Topic 1\nTopic 2')
    await user.click(difficultyButtons[2]) // Select difficulty 3

    // THEN: Next button becomes enabled
    await waitFor(() => {
      expect(nextButton).toBeEnabled()
    })

    // WHEN: User clears a required field
    await user.clear(titleInput)

    // THEN: Next button becomes disabled again
    expect(nextButton).toBeDisabled()
  })
})