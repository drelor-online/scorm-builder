import React from 'react'
import { render, screen, waitFor } from '../../test/testProviders'
import { vi } from 'vitest'
import App from '../App'
// Mock storage with assessment data
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getCourseMetadata: vi.fn().mockResolvedValue({
    courseTitle: 'Test Course with Assessment',
    topics: ['Topic 1', 'Topic 2'],
    objectives: ['Learn something', 'Learn more'],
    welcomeContent: 'Welcome to the course'
  }),
  getContent: vi.fn().mockImplementation((key) => {
    console.log('[Test] getContent called with key:', key)
    
    if (key === 'courseSeedData') {
      return Promise.resolve({
        courseTitle: 'Test Course with Assessment',
        courseDescription: 'A test course',
        difficulty: 3,
        duration: 30,
        customTopics: [],
        template: 'None',
        templateTopics: []
      })
    }
    
    if (key === 'currentStep') {
      return Promise.resolve({ step: 'activities' })
    }
    
    if (key === 'content-2') {
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
    
    if (key === 'content-3') {
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
    
    if (key === 'assessment') {
      console.log('[Test] Returning assessment data')
      return Promise.resolve({
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            question: 'Test assessment question 1?',
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: 'Option A',
            feedback: {
              correct: 'Correct!',
              incorrect: 'Try again'
            }
          },
          {
            id: 'q2',
            type: 'true-false',
            question: 'Test assessment question 2?',
            correctAnswer: 'True',
            feedback: {
              correct: 'Well done!',
              incorrect: 'Not quite'
            }
          }
        ],
        passMark: 80,
        narration: null
      })
    }
    
    return Promise.resolve(null)
  }),
  saveContent: vi.fn(),
  saveCourseMetadata: vi.fn()
}

vi.mock('../hooks/usePersistentStorage', () => ({
  usePersistentStorage: () => mockStorage
}))

vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: () => mockStorage,
  PersistentStorageProvider: ({ children }: { children: React.ReactNode }) => children
}))

vi.mock('../services/ApiKeyStorage', () => ({
  apiKeyStorage: {
    load: vi.fn().mockResolvedValue({
      openaiApiKey: 'test-key',
      googleApiKey: 'test-key',
      unsplashAccessKey: 'test-key'
    }),
    save: vi.fn()
  }
}))

describe('App Assessment Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should load and display assessment questions in Activities Editor', async () => {
    render(<App />)

    // Wait for the app to load and navigate to activities step
    await waitFor(() => {
      expect(mockStorage.getCourseMetadata).toHaveBeenCalled()
    })

    // Wait for assessment content to be loaded
    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('assessment')
    })

    // Wait for Activities Editor to render
    await waitFor(() => {
      expect(screen.getByText(/Questions & Assessment Editor/i)).toBeInTheDocument()
    }, { timeout: 5000 })

    // Check that assessment questions are displayed
    await waitFor(() => {
      expect(screen.getByText('Assessment Questions')).toBeInTheDocument()
    })

    // Check that the actual questions are shown
    expect(screen.getByText('Test assessment question 1?')).toBeInTheDocument()
    expect(screen.getByText('Test assessment question 2?')).toBeInTheDocument()

    // Check that question count is correct
    const assessmentQuestionsText = screen.getByText(/Assessment Questions:/)
    expect(assessmentQuestionsText.parentElement?.textContent).toContain('2')
  })

  it('should create default empty assessment if none exists in storage', async () => {
    // Override getContent to return null for assessment
    const noAssessmentStorage = {
      ...mockStorage,
      getContent: vi.fn().mockImplementation((key) => {
        if (key === 'assessment') {
          console.log('[Test] Returning null for assessment')
          return Promise.resolve(null)
        }
        return mockStorage.getContent(key)
      })
    }

    vi.mocked(mockStorage.getContent).mockImplementation(noAssessmentStorage.getContent)

    render(<App />)

    // Wait for Activities Editor to render
    await waitFor(() => {
      expect(screen.getByText(/Questions & Assessment Editor/i)).toBeInTheDocument()
    }, { timeout: 5000 })

    // Should show 0 assessment questions when none exist
    const assessmentQuestionsText = screen.getByText(/Assessment Questions:/)
    expect(assessmentQuestionsText.parentElement?.textContent).toContain('0')
  })
})
