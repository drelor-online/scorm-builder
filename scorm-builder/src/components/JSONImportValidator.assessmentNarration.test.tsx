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

describe('JSONImportValidator - Assessment Narration Auto-Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
  })

  it('should auto-fix null assessment narration', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Create JSON with null assessment narration (like the beta tester's file)
    const jsonWithNullNarration = {
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
        passMark: 80,
        narration: null  // This is the issue!
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(jsonWithNullNarration) } })

    // Wait for automatic validation and auto-fix to complete
    await waitFor(() => {
      // Check that the Next button is enabled, indicating successful validation
      const nextButton = screen.getByText(/next/i)
      expect(nextButton).not.toBeDisabled()
    }, { timeout: 3000 })
  })

  it('should auto-fix missing assessment narration field', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Create JSON with missing assessment narration
    const jsonWithMissingNarration = {
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
        passMark: 80
        // narration field is missing entirely
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(jsonWithMissingNarration) } })

    // Wait for automatic validation and auto-fix to complete
    await waitFor(() => {
      // Check that the Next button is enabled, indicating successful validation
      const nextButton = screen.getByText(/next/i)
      expect(nextButton).not.toBeDisabled()
    }, { timeout: 3000 })
  })

  it('should preserve existing valid assessment narration', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Create JSON with valid assessment narration
    const jsonWithValidNarration = {
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
        passMark: 80,
        narration: 'This is a valid assessment narration'
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(jsonWithValidNarration) } })

    // Wait for validation to complete
    await waitFor(() => {
      // Check that the narration was preserved
      const updatedValue = (textarea as HTMLTextAreaElement).value
      const parsedFixed = JSON.parse(updatedValue)
      expect(parsedFixed.assessment.narration).toBe('This is a valid assessment narration')
    }, { timeout: 3000 })
  })

  it('should enable Next button after successful auto-fix', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Create JSON with null assessment narration
    const jsonWithNullNarration = {
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
        passMark: 80,
        narration: null
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(jsonWithNullNarration) } })

    // Wait for validation and check Next button is enabled
    await waitFor(() => {
      const nextButton = screen.getByText(/next/i)
      expect(nextButton).not.toBeDisabled()
    }, { timeout: 3000 })
  })
})