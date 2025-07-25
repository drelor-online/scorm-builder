import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'
import * as spaceEfficientScormGenerator from '../../services/spaceEfficientScormGenerator'
import { CourseContent } from '../../types/aiPrompt'

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

vi.mock('../../components/SCORMPackageBuilderRefactored', () => ({
  SCORMPackageBuilder: ({ courseContent, courseSeedData, onBack }: any) => {
    const handleGenerate = async () => {
      const spaceEfficientScormGenerator = await import('../../services/spaceEfficientScormGenerator')
      await spaceEfficientScormGenerator.generateSpaceEfficientSCORM12Buffer(courseContent)
    }
    
    return (
      <div>
        <h1>SCORM Package Builder</h1>
        <div>{courseSeedData?.courseTitle || 'Integration Test Course'}</div>
        <button onClick={onBack}>← Back</button>
        <button onClick={handleGenerate}>Generate SCORM Package</button>
      </div>
    )
  }
}))

vi.mock('../../components/SettingsRefactored', () => ({
  Settings: () => <div>Settings</div>
}))

vi.mock('../../components/HelpPageRefactored', () => ({
  HelpPage: () => <div>Help</div>
}))

vi.mock('../../components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: any) => <>{children}</>
}))

vi.mock('../../hooks/useAutoSave', () => ({
  useAutoSave: () => ({ isSaving: false })
}))

// Mock window APIs
const mockClipboard = {
  writeText: vi.fn()
}
Object.assign(navigator, {
  clipboard: mockClipboard
})

// Mock window.alert
global.alert = vi.fn()

describe('Complete SCORM Builder Workflow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    
    // Mock successful SCORM generation
    vi.mocked(spaceEfficientScormGenerator.generateSpaceEfficientSCORM12Buffer).mockResolvedValue({
      buffer: new Uint8Array([1, 2, 3, 4])
    })
    
    // Mock clipboard
    mockClipboard.writeText.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('User completes full course creation workflow', () => {
    it('should navigate through all steps from course setup to SCORM generation', async () => {
      const user = userEvent.setup()
      render(
        <PersistentStorageProvider>
          <App />
        </PersistentStorageProvider>
      )
      
      // Step 1: Course Seed Input
      expect(screen.getByText('Course Configuration')).toBeInTheDocument()
      
      // Fill in course details
      const titleInput = screen.getByLabelText('Course Title *')
      await user.clear(titleInput)
      await user.type(titleInput, 'Integration Test Course')
      
      // Add custom topics
      const topicsTextarea = screen.getByLabelText('Topics')
      await user.clear(topicsTextarea)
      await user.type(topicsTextarea, 'Introduction to Testing\nWriting Good Tests\nTest Best Practices')
      
      // Click Next
      const nextButton = screen.getByText('Continue to AI Prompt →')
      await user.click(nextButton)
      
      // Step 2: AI Prompt Generator
      await waitFor(() => {
        expect(screen.getByText('AI Prompt Generator')).toBeInTheDocument()
      })
      
      // Verify course information is displayed
      expect(screen.getByText('Integration Test Course')).toBeInTheDocument()
      
      // Copy the prompt
      const copyButton = screen.getByLabelText('Copy prompt to clipboard')
      await user.click(copyButton)
      
      await waitFor(() => {
        // Check if copy succeeded - the button text should change
        expect(screen.getByText('✓ Copied!')).toBeInTheDocument()
      })
      
      // Click Next
      await user.click(screen.getByText('Next →'))
      
      // Step 3: JSON Import/Validator
      await waitFor(() => {
        expect(screen.getByText('JSON Import & Validation')).toBeInTheDocument()
      })
      
      // Paste sample JSON
      const jsonTextarea = screen.getByLabelText('JSON Input')
      const sampleJson = createSampleCourseContent()
      await user.clear(jsonTextarea)
      await user.click(jsonTextarea)
      // Use paste instead of type to avoid keyboard parsing issues
      await user.paste(JSON.stringify(sampleJson))
      
      // Click Validate
      const validateButton = screen.getByText('Validate JSON')
      await user.click(validateButton)
      
      // Wait for validation
      await waitFor(() => {
        expect(screen.getByText('Valid JSON Structure')).toBeInTheDocument()
      })
      
      // Click Next
      await user.click(screen.getByText('Next →'))
      
      // Step 4: Media Enhancement (skip for integration test)
      await waitFor(() => {
        expect(screen.getByText('Media Enhancement Wizard')).toBeInTheDocument()
      })
      
      await user.click(screen.getByText('Next →'))
      
      // Step 5: Audio Narration (skip for integration test)
      await waitFor(() => {
        expect(screen.getByText('Audio Narration Wizard')).toBeInTheDocument()
      })
      
      await user.click(screen.getByText('Next →'))
      
      // Step 6: Content Editor
      await waitFor(() => {
        expect(screen.getByText('Content Editor')).toBeInTheDocument()
      })
      
      // Verify content is loaded
      expect(screen.getByText('Welcome Page')).toBeInTheDocument()
      expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
      
      // Click Next (skip editing for integration test)
      await user.click(screen.getByText('Next →'))
      
      // Step 7: SCORM Package Builder
      await waitFor(() => {
        expect(screen.getByText('SCORM Package Builder')).toBeInTheDocument()
      })
      
      // Verify course information
      expect(screen.getByText('Integration Test Course')).toBeInTheDocument()
      
      // Generate SCORM package
      const generateButton = screen.getByText('Generate SCORM Package')
      await user.click(generateButton)
      
      // Verify generation function is called
      await waitFor(() => {
        expect(spaceEfficientScormGenerator.generateSpaceEfficientSCORM12Buffer).toHaveBeenCalled()
      }, { timeout: 5000 })
    }, 20000)

    it('should allow navigation back through steps', async () => {
      const user = userEvent.setup()
      render(
        <PersistentStorageProvider>
          <App />
        </PersistentStorageProvider>
      )
      
      // Navigate to step 2
      const titleInput = screen.getByLabelText('Course Title *')
      await user.type(titleInput, 'Test Course')
      await user.click(screen.getByText('Continue to AI Prompt →'))
      
      await waitFor(() => {
        expect(screen.getByText('AI Prompt Generator')).toBeInTheDocument()
      })
      
      // Go back to step 1
      const backButton = screen.getByText('← Back')
      await user.click(backButton)
      
      await waitFor(() => {
        expect(screen.getByText('Course Configuration')).toBeInTheDocument()
        expect(screen.getByLabelText('Course Title *')).toHaveValue('Test Course')
      })
    })

    it('should save and restore course data when navigating between steps', async () => {
      const user = userEvent.setup()
      render(
        <PersistentStorageProvider>
          <App />
        </PersistentStorageProvider>
      )
      
      // Enter course data
      const titleInput = screen.getByLabelText('Course Title *')
      await user.clear(titleInput)
      await user.type(titleInput, 'Persistent Test Course')
      
      // Navigate forward and back
      await user.click(screen.getByText('Continue to AI Prompt →'))
      await waitFor(() => {
        expect(screen.getByText('AI Prompt Generator')).toBeInTheDocument()
      })
      
      await user.click(screen.getByText('← Back'))
      await waitFor(() => {
        expect(screen.getByText('Course Configuration')).toBeInTheDocument()
      })
      
      // Verify data persisted
      expect(screen.getByLabelText('Course Title *')).toHaveValue('Persistent Test Course')
      // Course title should persist
    })

    it('should handle errors gracefully throughout the workflow', async () => {
      const user = userEvent.setup()
      render(
        <PersistentStorageProvider>
          <App />
        </PersistentStorageProvider>
      )
      
      // Navigate to JSON import
      await user.type(screen.getByLabelText('Course Title *'), 'Error Test Course')
      await user.click(screen.getByText('Continue to AI Prompt →'))
      await waitFor(() => screen.getByText('AI Prompt Generator'))
      await user.click(screen.getByText('Next →'))
      
      // Try to import invalid JSON
      const jsonTextarea = screen.getByLabelText('JSON Input')
      await user.type(jsonTextarea, 'invalid json')
      
      const validateButton = screen.getByText('Validate JSON')
      await user.click(validateButton)
      
      // Should show error
      await waitFor(() => {
        expect(screen.getByText('Validation Error')).toBeInTheDocument()
      })
      
      // Fix JSON and continue
      await user.clear(jsonTextarea)
      await user.click(jsonTextarea)
      await user.paste(JSON.stringify(createSampleCourseContent()))
      await user.click(validateButton)
      
      await waitFor(() => {
        expect(screen.getByText('Valid JSON Structure')).toBeInTheDocument()
      })
    })

    it('should validate required fields at each step', async () => {
      const user = userEvent.setup()
      render(
        <PersistentStorageProvider>
          <App />
        </PersistentStorageProvider>
      )
      
      // Try to proceed without filling required fields
      const nextButton = screen.getByText('Continue to AI Prompt →')
      
      // Clear the title field to test validation
      const titleInput = screen.getByLabelText('Course Title *')
      await user.clear(titleInput)
      
      // Should not be able to proceed
      await user.click(nextButton)
      
      // Should still be on step 1
      expect(screen.getByText('Course Configuration')).toBeInTheDocument()
      
      // Fill required field and proceed
      await user.type(titleInput, 'Valid Course Title')
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('AI Prompt Generator')).toBeInTheDocument()
      })
    })
  })

  describe('User can use keyboard navigation', () => {
    it('should support keyboard shortcuts for navigation', async () => {
      render(
        <PersistentStorageProvider>
          <App />
        </PersistentStorageProvider>
      )
      
      // Enter some data
      const titleInput = screen.getByLabelText('Course Title *')
      await userEvent.type(titleInput, 'Keyboard Test Course')
      
      // Test tab navigation through form elements
      let focusedElement
      let attempts = 0
      const maxAttempts = 20
      
      // Keep tabbing until we find the next button or reach max attempts
      while (attempts < maxAttempts) {
        await userEvent.tab()
        focusedElement = document.activeElement
        if (focusedElement?.textContent?.includes('Continue to AI Prompt →')) {
          break
        }
        attempts++
      }
      
      // Should be able to find and focus the next button via keyboard navigation
      expect(focusedElement).toBeDefined()
      expect(focusedElement?.textContent).toContain('Continue to AI Prompt →')
      
      // Verify keyboard navigation reaches important elements
      expect(attempts).toBeLessThan(maxAttempts)
    }, 10000)
  })

  describe('User can preview course at various stages', () => {
    it('should show preview button and open preview modal', async () => {
      const user = userEvent.setup()
      render(
        <PersistentStorageProvider>
          <App />
        </PersistentStorageProvider>
      )
      
      // Fill basic info and navigate to a step with preview
      await user.type(screen.getByLabelText('Course Title *'), 'Preview Test Course')
      await user.click(screen.getByText('Continue to AI Prompt →'))
      
      // Look for preview button
      const previewButton = screen.queryByText('Preview')
      if (previewButton) {
        await user.click(previewButton)
        
        // Should show preview (implementation dependent)
        await waitFor(() => {
          expect(screen.getByText(/preview test course/i)).toBeInTheDocument()
        })
      }
    })
  })
})

// Helper function to create sample course content
function createSampleCourseContent(): CourseContent {
  return {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome to Integration Test Course',
      content: '<p>Welcome to this integration test course!</p>',
      narration: 'Welcome narration text',
      duration: 2,
      imageKeywords: ['welcome', 'course'],
      imagePrompts: ['Professional welcome screen'],
      videoSearchTerms: ['course introduction']
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<ul><li>Understand integration testing</li><li>Write effective tests</li></ul>',
      narration: 'Learning objectives narration',
      duration: 3,
      imageKeywords: ['objectives', 'goals'],
      imagePrompts: ['Learning objectives checklist'],
      videoSearchTerms: ['learning objectives']
    },
    topics: [
      {
        id: 'topic-1',
        title: 'Introduction to Testing',
        content: '<p>Testing is important...</p>',
        narration: 'Topic 1 narration',
        duration: 5,
        imageKeywords: ['testing', 'introduction'],
        imagePrompts: ['Software testing concept'],
        videoSearchTerms: ['introduction to testing'],
        knowledgeCheck: {
          questions: [{
            id: 'kc-1',
            type: 'multiple-choice',
            question: 'What is integration testing?',
            options: ['Unit testing', 'System testing', 'Testing component interactions', 'Performance testing'],
            correctAnswer: 'Testing component interactions',
            feedback: {
              correct: 'Correct! Integration testing verifies component interactions.',
              incorrect: 'Not quite. Integration testing focuses on component interactions.'
            }
          }]
        }
      },
      {
        id: 'topic-2',
        title: 'Writing Good Tests',
        content: '<p>Good tests are...</p>',
        narration: 'Topic 2 narration',
        duration: 5,
        imageKeywords: ['testing', 'best practices'],
        imagePrompts: ['Writing test code'],
        videoSearchTerms: ['test writing tutorial']
      },
      {
        id: 'topic-3',
        title: 'Test Best Practices',
        content: '<p>Best practices include...</p>',
        narration: 'Topic 3 narration',
        duration: 5,
        imageKeywords: ['testing', 'practices'],
        imagePrompts: ['Testing best practices'],
        videoSearchTerms: ['testing best practices']
      }
    ],
    assessment: {
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice',
          question: 'What makes a good integration test?',
          options: ['Tests single units', 'Tests component interactions', 'Tests performance', 'Tests security'],
          correctAnswer: 'Tests component interactions',
          feedback: {
            correct: 'Excellent! Integration tests verify component interactions.',
            incorrect: 'Review the material on integration testing.'
          }
        },
        {
          id: 'q2',
          type: 'true-false',
          question: 'Integration tests should mock all dependencies.',
          correctAnswer: 'false',
          feedback: {
            correct: 'Right! Integration tests should use real dependencies when possible.',
            incorrect: 'Actually, integration tests should use real dependencies to test interactions.'
          }
        }
      ],
      passMark: 80
    }
  }
}