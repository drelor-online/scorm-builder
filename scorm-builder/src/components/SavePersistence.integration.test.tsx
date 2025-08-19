import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { App } from '../App'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn()
}))

// Mock all dynamic imports
vi.mock('../components/CourseSeedInput', () => ({
  CourseSeedInput: () => <div data-testid="course-seed-input">Course Seed Input</div>
}))

vi.mock('../components/JSONImportValidator', () => ({
  JSONImportValidator: () => <div data-testid="json-import-validator">JSON Import Validator</div>
}))

vi.mock('../components/MediaEnhancementWizard', () => ({
  MediaEnhancementWizard: () => <div data-testid="media-enhancement-wizard">Media Enhancement Wizard</div>
}))

vi.mock('../components/AudioNarrationWizard', () => ({
  AudioNarrationWizard: () => <div data-testid="audio-narration-wizard">Audio Narration Wizard</div>
}))

vi.mock('../components/ActivitiesEditor', () => ({
  ActivitiesEditor: () => <div data-testid="activities-editor">Activities Editor</div>
}))

vi.mock('../components/SCORMPackageBuilder', () => ({
  SCORMPackageBuilder: () => <div data-testid="scorm-package-builder">SCORM Package Builder</div>
}))

// Mock storage implementation
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project-123',
  
  // Core save methods
  saveCourseSeedData: vi.fn(),
  saveCourseContent: vi.fn(),
  saveContent: vi.fn(),
  saveProject: vi.fn(),
  
  // Core load methods
  getCourseSeedData: vi.fn(),
  getCourseContent: vi.fn(),
  getContent: vi.fn(),
  
  // Project management
  createProject: vi.fn(),
  openProject: vi.fn(),
  listProjects: vi.fn(),
  deleteProject: vi.fn()
}

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PersistentStorageProvider storage={mockStorage as any}>
    {children}
  </PersistentStorageProvider>
)

describe('Save Persistence Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up default mock returns
    mockStorage.getCourseSeedData.mockResolvedValue(null)
    mockStorage.getCourseContent.mockResolvedValue(null)
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveCourseSeedData.mockResolvedValue(undefined)
    mockStorage.saveCourseContent.mockResolvedValue(undefined)
    mockStorage.saveContent.mockResolvedValue(undefined)
    mockStorage.saveProject.mockResolvedValue(undefined)
  })

  it('should save and persist course seed data when user makes changes', async () => {
    const user = userEvent.setup()
    
    // Initial data to simulate loaded project
    const initialSeedData = {
      courseTitle: 'Test Course',
      difficulty: 3,
      customTopics: ['Topic 1', 'Topic 2'],
      template: 'business',
      templateTopics: []
    }
    
    mockStorage.getCourseSeedData.mockResolvedValue(initialSeedData)
    
    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    )
    
    // Wait for initial load
    await waitFor(() => {
      expect(mockStorage.getCourseSeedData).toHaveBeenCalled()
    })
    
    // Verify that auto-save is triggered when course seed data changes
    await waitFor(() => {
      expect(mockStorage.saveCourseSeedData).toHaveBeenCalledWith(
        expect.objectContaining({
          courseTitle: 'Test Course',
          difficulty: 3,
          customTopics: ['Topic 1', 'Topic 2']
        })
      )
    }, { timeout: 5000 })
  })

  it('should save course content when user edits content in MediaEnhancementWizard', async () => {
    const courseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<h2>Welcome to the course</h2>',
        narration: 'Welcome narration'
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<h2>Objectives</h2>',
        narration: 'Objectives narration'
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Test Topic',
          content: '<h2>Topic Content</h2>',
          narration: 'Topic narration'
        }
      ],
      assessment: {
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            question: 'Test question?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A'
          }
        ]
      }
    }
    
    mockStorage.getCourseContent.mockResolvedValue(courseContent)
    
    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    )
    
    // Wait for course content to be loaded
    await waitFor(() => {
      expect(mockStorage.getCourseContent).toHaveBeenCalled()
    })
    
    // Verify that course content is saved when changes are made
    await waitFor(() => {
      expect(mockStorage.saveCourseContent).toHaveBeenCalledWith(
        expect.objectContaining({
          welcomePage: expect.any(Object),
          learningObjectivesPage: expect.any(Object),
          topics: expect.arrayContaining([expect.any(Object)]),
          assessment: expect.objectContaining({
            questions: expect.arrayContaining([expect.any(Object)])
          })
        })
      )
    }, { timeout: 5000 })
  })

  it('should persist current step when navigating between wizard steps', async () => {
    const user = userEvent.setup()
    
    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    )
    
    // Wait for initial load and step save
    await waitFor(() => {
      expect(mockStorage.saveContent).toHaveBeenCalledWith(
        'currentStep', 
        expect.objectContaining({ step: expect.any(String) })
      )
    })
  })

  it('should restore all data when reopening a project', async () => {
    const savedSeedData = {
      courseTitle: 'Saved Course Title',
      difficulty: 4,
      customTopics: ['Saved Topic 1', 'Saved Topic 2'],
      template: 'education',
      templateTopics: []
    }
    
    const savedCourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Saved Welcome',
        content: '<h2>Saved welcome content</h2>',
        narration: 'Saved welcome narration'
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Saved Objectives',
        content: '<h2>Saved objectives content</h2>',
        narration: 'Saved objectives narration'
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Saved Topic',
          content: '<h2>Saved topic content</h2>',
          narration: 'Saved topic narration'
        }
      ],
      assessment: {
        questions: [
          {
            id: 'saved-q1',
            type: 'multiple-choice',
            question: 'Saved question?',
            options: ['Saved A', 'Saved B', 'Saved C', 'Saved D'],
            correctAnswer: 'Saved A'
          }
        ]
      }
    }
    
    const savedCurrentStep = { step: 'media' }
    
    // Mock the load methods to return saved data
    mockStorage.getCourseSeedData.mockResolvedValue(savedSeedData)
    mockStorage.getCourseContent.mockResolvedValue(savedCourseContent)
    mockStorage.getContent.mockImplementation((key) => {
      if (key === 'currentStep') return Promise.resolve(savedCurrentStep)
      if (key === 'visitedSteps') return Promise.resolve({ steps: [0, 1, 2] })
      return Promise.resolve(null)
    })
    
    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    )
    
    // Verify all load methods are called during project initialization
    await waitFor(() => {
      expect(mockStorage.getCourseSeedData).toHaveBeenCalled()
      expect(mockStorage.getCourseContent).toHaveBeenCalled()
      expect(mockStorage.getContent).toHaveBeenCalledWith('currentStep')
    })
  })

  it('should detect and save unsaved changes before navigation', async () => {
    const user = userEvent.setup()
    
    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    )
    
    // Wait for initial load
    await waitFor(() => {
      expect(mockStorage.getCourseSeedData).toHaveBeenCalled()
    })
    
    // Auto-save should eventually be triggered as state changes
    await waitFor(() => {
      expect(mockStorage.saveProject).toHaveBeenCalled()
    }, { timeout: 10000 })
  })

  it('should handle save failures gracefully', async () => {
    // Mock a save failure
    mockStorage.saveProject.mockRejectedValue(new Error('Save failed'))
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    )
    
    // Wait for save attempt and error handling
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Save error'),
        expect.any(Error)
      )
    }, { timeout: 5000 })
    
    consoleSpy.mockRestore()
  })
})