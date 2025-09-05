import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { JSONImportValidator } from './JSONImportValidator'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'

// Mock the storage
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn(),
  saveContent: vi.fn()
}

const mockProps = {
  onNext: vi.fn(),
  onBack: vi.fn()
}

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <PersistentStorageProvider storage={mockStorage as any}>
    <StepNavigationProvider>
      <UnsavedChangesProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </UnsavedChangesProvider>
    </StepNavigationProvider>
  </PersistentStorageProvider>
)

describe('JSONImportValidator - Comprehensive Auto-Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
  })

  it('should auto-fix multiple missing fields in one pass', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Create JSON with multiple missing fields that should be auto-fixable
    const jsonWithMissingFields = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Test content'
        // Missing: narration, imageKeywords, imagePrompts, videoSearchTerms, duration
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Test content',
        narration: 'Test narration'
        // Missing: imageKeywords, imagePrompts, videoSearchTerms, duration
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Test Topic',
          content: 'Test content'
          // Missing: narration, imageKeywords, imagePrompts, videoSearchTerms, duration, knowledgeCheck
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
            // Missing: feedback
          }
        ]
        // Missing: passMark, narration
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(jsonWithMissingFields) } })

    // Wait for validation and auto-fix to complete
    await waitFor(() => {
      const nextButton = screen.getByText(/next/i)
      expect(nextButton).not.toBeDisabled()
    }, { timeout: 3000 })
  })

  it('should auto-fix missing imageKeywords, imagePrompts, and videoSearchTerms arrays', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const jsonWithMissingArrays = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Test content',
        narration: 'Test narration',
        duration: 2
        // Missing arrays: imageKeywords, imagePrompts, videoSearchTerms
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Test content',
        narration: 'Test narration',
        duration: 3
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Test Topic',
          content: 'Test content',
          narration: 'Test narration',
          duration: 5,
          knowledgeCheck: { questions: [] }
        }
      ],
      assessment: {
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            question: 'Test question?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            feedback: { correct: 'Right!', incorrect: 'Wrong!' }
          }
        ],
        passMark: 80,
        narration: 'Assessment narration'
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(jsonWithMissingArrays) } })

    await waitFor(() => {
      const nextButton = screen.getByText(/next/i)
      expect(nextButton).not.toBeDisabled()
    }, { timeout: 3000 })
  })

  it('should auto-fix missing duration fields with reasonable defaults', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const jsonWithoutDurations = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Test content',
        narration: 'Test narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: []
        // Missing: duration
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Test content',
        narration: 'Test narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: []
        // Missing: duration
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Test Topic',
          content: 'Test content',
          narration: 'Test narration',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          knowledgeCheck: { questions: [] }
          // Missing: duration
        }
      ],
      assessment: {
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            question: 'Test question?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            feedback: { correct: 'Right!', incorrect: 'Wrong!' }
          }
        ],
        passMark: 80,
        narration: 'Assessment narration'
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(jsonWithoutDurations) } })

    await waitFor(() => {
      const nextButton = screen.getByText(/next/i)
      expect(nextButton).not.toBeDisabled()
    }, { timeout: 3000 })
  })

  it('should auto-fix missing assessment passMark with default value', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const jsonWithoutPassMark = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Test content',
        narration: 'Test narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 2
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Test content',
        narration: 'Test narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 3
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Test Topic',
          content: 'Test content',
          narration: 'Test narration',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 5,
          knowledgeCheck: { questions: [] }
        }
      ],
      assessment: {
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            question: 'Test question?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            feedback: { correct: 'Right!', incorrect: 'Wrong!' }
          }
        ],
        narration: 'Assessment narration'
        // Missing: passMark
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(jsonWithoutPassMark) } })

    await waitFor(() => {
      const nextButton = screen.getByText(/next/i)
      expect(nextButton).not.toBeDisabled()
    }, { timeout: 3000 })
  })

  it('should auto-fix missing question feedback with default values', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const jsonWithoutQuestionFeedback = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Test content',
        narration: 'Test narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 2
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Test content',
        narration: 'Test narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 3
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Test Topic',
          content: 'Test content',
          narration: 'Test narration',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 5,
          knowledgeCheck: { questions: [] }
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
            // Missing: feedback
          }
        ],
        passMark: 80,
        narration: 'Assessment narration'
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(jsonWithoutQuestionFeedback) } })

    await waitFor(() => {
      const nextButton = screen.getByText(/next/i)
      expect(nextButton).not.toBeDisabled()
    }, { timeout: 3000 })
  })

  it('should auto-fix missing knowledgeCheck with empty questions array', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const jsonWithoutKnowledgeCheck = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Test content',
        narration: 'Test narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 2
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Test content',
        narration: 'Test narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 3
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Test Topic',
          content: 'Test content',
          narration: 'Test narration',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 5
          // Missing: knowledgeCheck
        }
      ],
      assessment: {
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            question: 'Test question?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            feedback: { correct: 'Right!', incorrect: 'Wrong!' }
          }
        ],
        passMark: 80,
        narration: 'Assessment narration'
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(jsonWithoutKnowledgeCheck) } })

    await waitFor(() => {
      const nextButton = screen.getByText(/next/i)
      expect(nextButton).not.toBeDisabled()
    }, { timeout: 3000 })
  })
})