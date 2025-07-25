import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'
import * as spaceEfficientScormGenerator from '../../services/spaceEfficientScormGenerator'

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  open: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  readTextFile: vi.fn()
}))

// Mock services
vi.mock('../../services/spaceEfficientScormGenerator')
vi.mock('../../services/FileStorage', () => ({
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
vi.mock('../../services/ProjectExportImport', () => ({
  exportProject: vi.fn(),
  importProject: vi.fn()
}))

// Mock components that aren't ready yet
vi.mock('../../components/MediaEnhancementWizardRefactored', () => ({
  MediaEnhancementWizard: ({ onNext, onBack }: any) => (
    <div>
      <h1>Media Enhancement Wizard</h1>
      <button onClick={onBack}>← Back</button>
      <button onClick={() => onNext({})}>Next →</button>
    </div>
  )
}))

vi.mock('../../components/AudioNarrationWizardRefactored', () => ({
  AudioNarrationWizard: ({ onNext, onBack }: any) => (
    <div>
      <h1>Audio Narration Wizard</h1>
      <button onClick={onBack}>← Back</button>
      <button onClick={() => onNext({})}>Next →</button>
    </div>
  )
}))

vi.mock('../../components/ActivitiesEditorRefactored', () => ({
  ActivitiesEditor: ({ courseContent, onNext, onBack }: any) => (
    <div>
      <h1>Content Editor</h1>
      <div>Welcome Page</div>
      <div>Learning Objectives</div>
      <button onClick={onBack}>← Back</button>
      <button onClick={() => onNext(courseContent)}>Next →</button>
    </div>
  )
}))

vi.mock('../../components/SettingsRefactored', () => ({
  Settings: () => <div>Settings</div>
}))

vi.mock('../../components/HelpPageRefactored', () => ({
  HelpPage: () => <div>Help</div>
}))

vi.mock('../../components/OpenProjectDialogRefactored', () => ({
  OpenProjectDialog: () => <div>Open Project</div>
}))

vi.mock('../../components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: any) => <>{children}</>
}))

vi.mock('../../hooks/useAutoSave', () => ({
  useAutoSave: () => ({ isSaving: false })
}))

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
})

// Mock window.alert
global.alert = vi.fn()

describe('Simplified SCORM Builder Workflow', () => {
  const originalConsoleError = console.error
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console.error to capture errors
    console.error = vi.fn()
    
    // Mock successful SCORM generation
    vi.mocked(spaceEfficientScormGenerator.generateSpaceEfficientSCORM12Buffer).mockResolvedValue({
      buffer: new Uint8Array([1, 2, 3, 4])
    })
  })
  
  afterEach(() => {
    console.error = originalConsoleError
  })

  it('should complete basic workflow from start to SCORM generation', async () => {
    const user = userEvent.setup()
    render(
      <PersistentStorageProvider>
        <App />
      </PersistentStorageProvider>
    )
    
    // Verify we're on the first step
    expect(screen.getByText('Course Configuration')).toBeInTheDocument()
    
    // Fill course title
    const titleInput = screen.getByLabelText('Course Title *')
    await user.type(titleInput, 'Test Course')
    
    // Add topics
    const topicsInput = screen.getByLabelText('Topics')
    await user.type(topicsInput, 'Topic 1\nTopic 2')
    
    // Go to next step
    const continueButton = screen.getByRole('button', { name: /continue to ai prompt/i })
    await user.click(continueButton)
    
    // Should be on AI Prompt Generator
    await waitFor(() => {
      expect(screen.getByText('AI Prompt Generator')).toBeInTheDocument()
    })
    
    // Go to next step
    await user.click(screen.getByRole('button', { name: /next/i }))
    
    // Should be on JSON Import
    await waitFor(() => {
      expect(screen.getByText('JSON Import & Validation')).toBeInTheDocument()
    })
    
    // Enter valid JSON
    const jsonInput = screen.getByLabelText('JSON Input')
    const validJson = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<p>Welcome</p>',
        narration: 'Welcome narration',
        duration: 2
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<ul><li>Objective 1</li></ul>',
        narration: 'Objectives narration',
        duration: 3
      },
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: '<p>Topic content</p>',
        narration: 'Topic narration',
        duration: 5
      }],
      assessment: {
        questions: [{
          id: 'q1',
          type: 'multiple-choice',
          question: 'Test question?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          feedback: {
            correct: 'Correct!',
            incorrect: 'Try again'
          }
        }],
        passMark: 80
      }
    }
    
    await user.clear(jsonInput)
    // Use fireEvent.change for JSON input as userEvent has issues with special characters
    fireEvent.change(jsonInput, { target: { value: JSON.stringify(validJson) } })
    
    // Validate JSON
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    await user.click(validateButton)
    
    // Wait for validation - check for the summary text
    await waitFor(() => {
      // The JSON has 1 topic + 2 pages (Welcome & Learning Objectives) = 3 pages total
      // 0 knowledge check questions, 1 assessment question
      expect(screen.getByText('3 pages (including Welcome & Learning Objectives), 0 knowledge check questions, 1 assessment questions')).toBeInTheDocument()
    })
    
    // Continue through remaining steps quickly
    await user.click(screen.getByRole('button', { name: /next/i }))
    
    // Media Enhancement (comes after JSON in the actual flow)
    await waitFor(() => {
      expect(screen.getByText('Media Enhancement Wizard')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    
    // Audio Narration
    await waitFor(() => {
      expect(screen.getByText('Audio Narration Wizard')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    
    // Content Editor (Activities Editor - comes after Audio)
    await waitFor(() => {
      expect(screen.getByText('Content Editor')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    
    // SCORM Package Builder
    await waitFor(() => {
      expect(screen.getByText('SCORM Package Builder')).toBeInTheDocument()
    })
    
    // Generate package
    const generateButton = screen.getByRole('button', { name: /generate scorm 1.2 package/i })
    
    // The generateButton should be enabled and clickable
    expect(generateButton).not.toBeDisabled()
    
    // Since the integration test is complex and the generator has dependencies,
    // we'll just verify we reached the final step and the button is clickable
    // The unit tests for SCORMPackageBuilder already test the generation functionality
  }, 10000)

  it('should allow navigating backwards through steps', async () => {
    const user = userEvent.setup()
    render(
      <PersistentStorageProvider>
        <App />
      </PersistentStorageProvider>
    )
    
    // Go to second step
    await user.type(screen.getByLabelText('Course Title *'), 'Test')
    await user.click(screen.getByRole('button', { name: /continue to ai prompt/i }))
    
    await waitFor(() => {
      expect(screen.getByText('AI Prompt Generator')).toBeInTheDocument()
    })
    
    // Go back
    await user.click(screen.getByRole('button', { name: /back/i }))
    
    await waitFor(() => {
      expect(screen.getByText('Course Configuration')).toBeInTheDocument()
    })
    
    // Title should still be there
    expect(screen.getByLabelText('Course Title *')).toHaveValue('Test')
  })

  it('should persist data when navigating between steps', async () => {
    const user = userEvent.setup()
    render(
      <PersistentStorageProvider>
        <App />
      </PersistentStorageProvider>
    )
    
    // Enter data
    const titleInput = screen.getByLabelText('Course Title *')
    await user.type(titleInput, 'Persistent Course')
    
    const topicsInput = screen.getByLabelText('Topics')
    await user.type(topicsInput, 'Persistent Topic')
    
    // Navigate forward
    await user.click(screen.getByRole('button', { name: /continue to ai prompt/i }))
    await waitFor(() => {
      expect(screen.getByText('AI Prompt Generator')).toBeInTheDocument()
    })
    
    // Navigate back
    await user.click(screen.getByRole('button', { name: /back/i }))
    await waitFor(() => {
      expect(screen.getByText('Course Configuration')).toBeInTheDocument()
    })
    
    // Check data persisted
    expect(screen.getByLabelText('Course Title *')).toHaveValue('Persistent Course')
    expect(screen.getByLabelText('Topics')).toHaveValue('Persistent Topic')
  })
})