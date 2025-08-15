import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import App from '../App'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { AutoSaveProvider } from '../contexts/AutoSaveContext'

// Mock the storage hook
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project-123',
  error: null,
  getContent: vi.fn(),
  getCourseMetadata: vi.fn(),
  saveCourseMetadata: vi.fn(),
  saveContent: vi.fn(),
  saveProject: vi.fn(),
  createProject: vi.fn(),
  openProject: vi.fn(),
  openProjectFromFile: vi.fn(),
  openProjectFromPath: vi.fn(),
  saveProjectAs: vi.fn(),
  listProjects: vi.fn(),
  getRecentProjects: vi.fn(),
  checkForRecovery: vi.fn(),
  recoverFromBackup: vi.fn(),
  storeMedia: vi.fn(),
  storeYouTubeVideo: vi.fn(),
  getMedia: vi.fn(),
  getMediaForTopic: vi.fn(),
  saveAiPrompt: vi.fn(),
  getAiPrompt: vi.fn(),
  saveAudioSettings: vi.fn(),
  getAudioSettings: vi.fn(),
  saveScormConfig: vi.fn(),
  getScormConfig: vi.fn(),
  deleteProject: vi.fn(),
  exportProject: vi.fn(),
  importProjectFromZip: vi.fn(),
  getCurrentProjectId: vi.fn(),
  setProjectsDirectory: vi.fn(),
  migrateFromLocalStorage: vi.fn(),
  clearRecentFilesCache: vi.fn(),
  fileStorage: {} as any
}

vi.mock('../contexts/PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: any) => children,
  useStorage: () => mockStorage
}))

// Mock UnifiedMediaProvider
vi.mock('../contexts/UnifiedMediaContext', () => ({
  UnifiedMediaProvider: ({ children }: any) => children,
  useUnifiedMedia: () => ({
    getMedia: vi.fn(),
    getAllMedia: vi.fn().mockReturnValue([]),
    getMediaForPage: vi.fn().mockReturnValue([]),
    createBlobUrl: vi.fn()
  })
}))

// Mock API services
vi.mock('../services/ApiKeyStorage', () => ({
  apiKeyStorage: {
    load: vi.fn().mockResolvedValue(null)
  }
}))

vi.mock('../services/courseContentAudioIdMapper', () => ({
  mapAudioIds: vi.fn((content) => Promise.resolve(content))
}))

describe('App - Course Content Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should load course-content directly when it exists in the project', async () => {
    const mockCourseContent = {
      topics: [
        {
          id: 'safety-fundamentals',
          title: 'Safety Fundamentals',
          content: '<h2>Understanding Natural Gas</h2><p>Natural gas is primarily composed of methane...</p>',
          duration: 5,
          imageKeywords: ['methane molecule', 'flammability chart'],
          imagePrompts: ['A simple infographic showing the properties of natural gas'],
          videoSearchTerms: [],
          narration: '',
          knowledgeCheck: {
            questions: [
              {
                type: 'multiple-choice',
                question: 'What gives natural gas its distinctive smell?',
                options: ['Methane', 'Mercaptan', 'Propane', 'Butane'],
                correctAnswer: 'Mercaptan',
                explanation: 'Mercaptan is added to natural gas to give it a rotten egg smell for safety.'
              }
            ]
          }
        }
      ],
      welcomePage: {
        id: 'content-0',
        title: 'Welcome',
        content: '<p>Welcome to Natural Gas Safety</p>',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      learningObjectivesPage: {
        id: 'content-1',
        title: 'Learning Objectives',
        content: '<p>By the end of this course...</p>',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      objectives: ['Understand natural gas properties', 'Identify hazards'],
      assessment: {
        questions: [
          {
            id: 'assess-q1',
            type: 'true-false',
            question: 'Natural gas is naturally odorless.',
            correctAnswer: 'true',
            feedback: {
              correct: 'Correct!',
              incorrect: 'Incorrect.'
            }
          }
        ],
        passMark: 80,
        narration: null
      }
    }

    const mockMetadata = {
      title: 'Natural Gas Safety',
      difficulty: 3,
      topics: ['Safety Fundamentals'],
      template: 'Safety'
    }

    // Setup mock responses
    mockStorage.getContent.mockImplementation((contentId: string) => {
      if (contentId === 'course-content') {
        return Promise.resolve(mockCourseContent)
      }
      if (contentId === 'currentStep') {
        return Promise.resolve({ step: 'scorm' })
      }
      if (contentId === 'courseSeedData') {
        return Promise.resolve(null) // No seed data saved separately
      }
      // Individual content items don't exist
      if (contentId.startsWith('content-')) {
        return Promise.resolve(null)
      }
      return Promise.resolve(null)
    })

    mockStorage.getCourseMetadata.mockResolvedValue(mockMetadata)

    render(
      <StepNavigationProvider>
        <AutoSaveProvider>
          <PersistentStorageProvider>
            <App />
          </PersistentStorageProvider>
        </AutoSaveProvider>
      </StepNavigationProvider>
    )

    // Wait for the data to load
    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('course-content')
    }, { timeout: 5000 })

    // The app should have loaded the course content
    // Check that it's not showing the seed input (which would mean no content loaded)
    await waitFor(() => {
      const seedInput = screen.queryByText(/Course Title/i)
      expect(seedInput).not.toBeInTheDocument()
    }, { timeout: 5000 })

    // It should be at the scorm step
    await waitFor(() => {
      const scormText = screen.queryByText(/Generate SCORM Package/i)
      expect(scormText).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('should fall back to reconstruction logic when course-content does not exist', async () => {
    const mockMetadata = {
      title: 'Test Course',
      difficulty: 3,
      topics: ['Topic 1', 'Topic 2'],
      template: 'Basic'
    }

    // Setup mock responses - no course-content exists
    mockStorage.getContent.mockImplementation((contentId: string) => {
      if (contentId === 'course-content') {
        return Promise.resolve(null) // No direct course content
      }
      if (contentId === 'content-2') {
        // Topic 1 stored individually (old format)
        return Promise.resolve({
          title: 'Topic 1',
          content: '<p>Topic 1 content</p>',
          narration: '',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 5
        })
      }
      if (contentId === 'content-3') {
        // Topic 2 stored individually (old format)
        return Promise.resolve({
          title: 'Topic 2',
          content: '<p>Topic 2 content</p>',
          narration: '',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 5
        })
      }
      if (contentId === 'assessment') {
        return Promise.resolve({
          questions: [],
          passMark: 80,
          narration: null
        })
      }
      if (contentId === 'welcome') {
        return Promise.resolve({
          id: 'content-0',
          title: 'Welcome',
          content: '<p>Welcome</p>',
          narration: '',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 1
        })
      }
      if (contentId === 'objectives') {
        return Promise.resolve({
          id: 'content-1',
          title: 'Objectives',
          content: '<p>Objectives</p>',
          narration: '',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 1
        })
      }
      return Promise.resolve(null)
    })

    mockStorage.getCourseMetadata.mockResolvedValue(mockMetadata)

    render(
      <StepNavigationProvider>
        <AutoSaveProvider>
          <PersistentStorageProvider>
            <App />
          </PersistentStorageProvider>
        </AutoSaveProvider>
      </StepNavigationProvider>
    )

    // Wait for the reconstruction logic to run
    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('content-2')
      expect(mockStorage.getContent).toHaveBeenCalledWith('content-3')
    }, { timeout: 5000 })
  })
})