import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { PersistentStorageProvider } from './contexts/PersistentStorageContext'

// Mock the FileStorage service
vi.mock('./services/FileStorage', () => ({
  fileStorage: {
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: true,
    currentProjectId: null,
    createProject: vi.fn().mockResolvedValue({ id: 'test-id', name: 'Test Project', created: new Date().toISOString(), last_modified: new Date().toISOString() }),
    openProject: vi.fn().mockResolvedValue(undefined),
    saveProject: vi.fn().mockResolvedValue(undefined),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    listProjects: vi.fn().mockResolvedValue([]),
    getRecentProjects: vi.fn().mockResolvedValue([]),
    getCurrentProjectId: vi.fn().mockReturnValue(null),
    clearCurrentProject: vi.fn(),
    saveContent: vi.fn().mockResolvedValue(undefined),
    getContent: vi.fn().mockResolvedValue(null),
    saveCourseMetadata: vi.fn().mockResolvedValue(undefined),
    getCourseMetadata: vi.fn().mockResolvedValue(null),
    addStateChangeListener: vi.fn().mockReturnValue(() => {})
  }
}))

// Mock components to simplify testing
vi.mock('./components/OpenProjectDialog', () => ({
  OpenProjectDialog: ({ isOpen, onClose, onProjectOpen, onProjectDelete }: any) => 
    isOpen ? (
      <div data-testid="open-project-dialog">
        <button onClick={() => onProjectOpen('project-123')}>Open Project</button>
        <button onClick={() => onProjectDelete('project-123')}>Delete Project</button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
}))

vi.mock('./components/DeleteConfirmDialog', () => ({
  DeleteConfirmDialog: ({ isOpen, projectName, onConfirm, onCancel }: any) =>
    isOpen ? (
      <div data-testid="delete-confirm-dialog">
        <span>Delete {projectName}?</span>
        <button onClick={onConfirm}>Confirm Delete</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null
}))

vi.mock('./components/UnsavedChangesDialog', () => ({
  UnsavedChangesDialog: ({ isOpen, onSaveAndContinue, onDiscardChanges, onCancel }: any) =>
    isOpen ? (
      <div data-testid="unsaved-changes-dialog">
        <button onClick={onSaveAndContinue}>Save & Continue</button>
        <button onClick={onDiscardChanges}>Discard Changes</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('should render the Course Configuration page by default', () => {
    render(
      <PersistentStorageProvider>
        <App />
      </PersistentStorageProvider>
    )
    
    const heading = screen.getByRole('heading', { name: /course configuration/i })
    expect(heading).toBeInTheDocument()
  })
  
  it('should render the Course Seed Input component', () => {
    render(
      <PersistentStorageProvider>
        <App />
      </PersistentStorageProvider>
    )
    
    // Course Seed Input uses a form element
    const titleInput = screen.getByLabelText(/course title/i)
    expect(titleInput).toBeInTheDocument()
  })

  it('should navigate through all wizard steps', async () => {
    const user = userEvent.setup()
    render(
      <PersistentStorageProvider>
        <App />
      </PersistentStorageProvider>
    )
    
    // Step 1: Course Seed Input (Course Setup)
    expect(screen.getByLabelText(/course title/i)).toBeInTheDocument()
    
    // Fill and submit course seed
    const titleInput = screen.getByLabelText(/course title/i)
    await user.type(titleInput, 'Test Course')
    const nextButton = screen.getByRole('button', { name: /continue to ai prompt/i })
    await user.click(nextButton)
    
    // Step 2: AI Prompt Generator
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /ai prompt generator/i })).toBeInTheDocument()
    })
    const promptNextButton = screen.getByRole('button', { name: 'Next →' })
    await user.click(promptNextButton)
    
    // Step 3: JSON Import Validator
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /json import.*validation/i })).toBeInTheDocument()
    })
    const jsonTextarea = screen.getByLabelText(/json input/i)
    const validJson = JSON.stringify({
      courseTitle: 'Test Course',
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<p>Welcome to Test Course</p>',
        narration: 'Welcome to Test Course',
        imageKeywords: ['welcome'],
        imagePrompts: ['Welcome image'],
        videoSearchTerms: ['welcome video'],
        duration: 2,
        media: []
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<p>You will learn...</p>',
        narration: 'You will learn...',
        imageKeywords: ['objectives'],
        imagePrompts: ['Objectives image'],
        videoSearchTerms: ['objectives video'],
        duration: 3,
        media: []
      },
      topics: [{
        id: 'topic-1',
        title: 'Test Topic',
        content: '<p>Test content</p>',
        narration: 'Test narration',
        imageKeywords: ['test'],
        imagePrompts: ['Test prompt'],
        videoSearchTerms: ['test video'],
        duration: 5,
        media: []
      }],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    })
    await user.clear(jsonTextarea)
    await user.paste(validJson)
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    await user.click(validateButton)
    
    // Wait for validation to complete and click Next
    await waitFor(() => {
      expect(screen.getByText('Valid JSON Structure')).toBeInTheDocument()
    })
    const jsonNextButton = screen.getByRole('button', { name: 'Next →' })
    await user.click(jsonNextButton)
    
    // Step 4: Media Enhancement Wizard
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /media enhancement/i })).toBeInTheDocument()
    })
    const mediaNextButton = screen.getByRole('button', { name: 'Next →' })
    await user.click(mediaNextButton)
    
    // Step 5: Audio Narration Wizard
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /audio narration wizard/i })).toBeInTheDocument()
    })
    const audioNextButton = screen.getByRole('button', { name: 'Next →' })
    await user.click(audioNextButton)
    
    // Step 6: Activities Editor (or Questions & Assessment Editor)
    await waitFor(() => {
      const activityHeading = screen.queryByRole('heading', { name: /activities.*editor/i })
      const questionsHeading = screen.queryByRole('heading', { name: /questions.*assessment.*editor/i })
      expect(activityHeading || questionsHeading).toBeInTheDocument()
    })
    const activitiesNextButton = screen.getByRole('button', { name: 'Next →' })
    await user.click(activitiesNextButton)
    
    // Step 7: SCORM Package Builder
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /scorm package builder/i })).toBeInTheDocument()
    })
  })

  it('should allow navigation backwards through wizard steps', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // Go to step 2
    const titleInput = screen.getByLabelText(/course title/i)
    await user.type(titleInput, 'Test Course')
    const nextButton = screen.getByRole('button', { name: /continue to ai prompt/i })
    await user.click(nextButton)
    
    // Verify we're on step 2
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /ai prompt generator/i })).toBeInTheDocument()
    })
    
    // Go back to step 1
    const backButton = screen.getByRole('button', { name: /back/i })
    await user.click(backButton)
    
    // Verify we're back on step 1
    expect(screen.getByLabelText(/course title/i)).toBeInTheDocument()
  })

  describe('Save/Open Integration', () => {
    it('should save project when Save button is clicked', async () => {
      mockStorage.saveProject.mockResolvedValue({
        success: true,
        projectId: 'project-123',
        message: 'Project saved successfully'
      })

      render(<App />)
      
      // Enter course title first
      const titleInput = screen.getByLabelText(/course title/i)
      await userEvent.type(titleInput, 'Test Course')
      
      // Find and click Save button
      const saveButtons = screen.getAllByText('Save')
      fireEvent.click(saveButtons[0])
      
      await waitFor(() => {
        expect(mockStorage.saveProject).toHaveBeenCalledWith(
          expect.objectContaining({
            courseTitle: 'Test Course',
            courseSeedData: expect.objectContaining({
              courseTitle: 'Test Course'
            })
          }),
          undefined
        )
      })
    })

    it('should show error toast when save fails without course title', async () => {
      mockStorage.saveProject.mockResolvedValue({
        success: false,
        error: 'Course title is required to save project'
      })

      render(<App />)
      
      // Click Save without entering title
      const saveButtons = screen.getAllByText('Save')
      fireEvent.click(saveButtons[0])
      
      await waitFor(() => {
        expect(screen.getByText('Course title is required to save project')).toBeInTheDocument()
      })
    })

    it('should show open dialog when Open button is clicked', async () => {
      mockStorage.listProjects.mockResolvedValue([
        {
          id: 'project-1',
          title: 'Project 1',
          lastModified: new Date().toISOString(),
          currentStep: 2,
          template: 'Technical' as const,
          preview: '3 topics, Step 3'
        }
      ])

      render(<App />)
      
      const openButtons = screen.getAllByText('Open')
      fireEvent.click(openButtons[0])
      
      await waitFor(() => {
        expect(screen.getByTestId('open-project-dialog')).toBeInTheDocument()
      })
    })

    it.skip('should load project when selected from dialog', async () => {
      const user = userEvent.setup()
      
      mockStorage.listProjects.mockResolvedValue([])
      mockStorage.loadProject.mockResolvedValue({
        success: true,
        data: {
          courseTitle: 'Loaded Project',
          courseSeedData: {
            courseTitle: 'Loaded Project',
            difficulty: 4,
            customTopics: ['Topic 1'],
            template: 'Corporate' as const,
            templateTopics: []
          },
          currentStep: 3
        }
      })

      render(<App />)
      
      // Open dialog
      const openButtons = screen.getAllByText('Open')
      await user.click(openButtons[0])
      
      // Wait for dialog to be shown
      await waitFor(() => {
        expect(screen.getByTestId('open-project-dialog')).toBeInTheDocument()
      })
      
      // Click the Open Project button
      const openProjectButton = screen.getByText('Open Project')
      await user.click(openProjectButton)
      
      // Wait for the dialog to close and the project to load
      await waitFor(() => {
        expect(mockStorage.loadProject).toHaveBeenCalledWith('project-123')
      })
    })

    it.skip('should show unsaved changes dialog when opening with unsaved changes', async () => {
      render(<App />)
      
      // Make changes
      const titleInput = screen.getByLabelText(/course title/i)
      await userEvent.type(titleInput, 'Test Course')
      
      // Try to open
      const openButtons = screen.getAllByText('Open')
      fireEvent.click(openButtons[0])
      
      await waitFor(() => {
        expect(screen.getByTestId('unsaved-changes-dialog')).toBeInTheDocument()
      })
    })

    it.skip('should handle help and settings clicks', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      
      render(<App />)
      
      const helpButtons = screen.getAllByText('Help')
      fireEvent.click(helpButtons[0])
      expect(alertSpy).toHaveBeenCalledWith('Help clicked')
      
      const settingsButtons = screen.getAllByText('Settings')
      fireEvent.click(settingsButtons[0])
      expect(alertSpy).toHaveBeenCalledWith('Settings clicked')
      
      alertSpy.mockRestore()
    })

    it.skip('should show delete confirmation and delete project', async () => {
      mockStorage.listProjects
        .mockResolvedValueOnce([{
          id: 'project-123',
          title: 'Project to Delete',
          lastModified: new Date().toISOString(),
          currentStep: 1,
          template: 'None' as const,
          preview: '0 topics'
        }])
        .mockResolvedValueOnce([])
      
      mockStorage.deleteProject.mockResolvedValue({ success: true })

      render(<App />)
      
      const openButtons = screen.getAllByText('Open')
      fireEvent.click(openButtons[0])
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Delete Project'))
      })
      
      expect(screen.getByText('Delete Project to Delete?')).toBeInTheDocument()
      
      fireEvent.click(screen.getByText('Confirm Delete'))
      
      await waitFor(() => {
        expect(mockStorage.deleteProject).toHaveBeenCalledWith('project-123')
      })
    })

    it('should enable autosave after first manual save', async () => {
      mockStorage.hasBeenSaved
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
      
      mockStorage.saveProject.mockResolvedValue({
        success: true,
        projectId: 'project-123'
      })

      render(<App />)
      
      // Enter title and save
      const titleInput = screen.getByLabelText(/course title/i)
      await userEvent.type(titleInput, 'Test Course')
      
      const saveButtons = screen.getAllByText('Save')
      fireEvent.click(saveButtons[0])
      
      await waitFor(() => {
        expect(mockStorage.saveProject).toHaveBeenCalled()
        expect(mockStorage.setCurrentProjectId).toHaveBeenCalledWith('project-123')
      })
    })
  })
})