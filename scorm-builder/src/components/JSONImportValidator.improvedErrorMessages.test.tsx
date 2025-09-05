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

describe('JSONImportValidator - Improved Error Messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
  })

  it('should show helpful error message for completely wrong structure with AI suggestion', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Create JSON with completely wrong structure that can't be auto-fixed
    const wrongStructureJson = {
      title: 'My Course',
      sections: [
        {
          name: 'Introduction',
          text: 'Some content here'
        }
      ],
      quiz: {
        q1: 'What is 2+2?',
        answer: '4'
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(wrongStructureJson) } })

    // Wait for validation error with helpful message
    await waitFor(() => {
      const errorMessage = screen.getByText(/Invalid format.*old JSON format/i)
      expect(errorMessage).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should not enable Next button for unfixable structure
    const nextButton = screen.getByText(/next/i)
    expect(nextButton).toBeDisabled()
  })

  it('should show helpful error message for missing major sections with AI suggestion', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Create JSON missing major required sections
    const missingMajorSections = {
      topics: [
        {
          id: 'topic-1',
          title: 'Test Topic',
          content: 'Test content',
          narration: 'Test narration'
        }
      ]
      // Missing: welcomePage, learningObjectivesPage, assessment
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(missingMajorSections) } })

    // Wait for validation error
    await waitFor(() => {
      const errorMessage = screen.getByText(/Missing required field: welcomePage/i)
      expect(errorMessage).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should not enable Next button
    const nextButton = screen.getByText(/next/i)
    expect(nextButton).toBeDisabled()
  })

  it('should show helpful error message for corrupted assessment questions', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Create JSON with corrupted assessment that can't be auto-fixed
    const corruptedAssessment = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Test content',
        narration: 'Test narration'
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Test content',
        narration: 'Test narration'
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Test Topic',
          content: 'Test content',
          narration: 'Test narration'
        }
      ],
      assessment: {
        questions: 'not an array', // This can't be auto-fixed
        passMark: 80,
        narration: 'Assessment narration'
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(corruptedAssessment) } })

    // Wait for validation error
    await waitFor(() => {
      const errorMessage = screen.getByText(/Missing required field: assessment/i)
      expect(errorMessage).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should not enable Next button
    const nextButton = screen.getByText(/next/i)
    expect(nextButton).toBeDisabled()
  })

  it('should show helpful error message for topics with wrong format', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Create JSON with topics in wrong format that can't be auto-fixed
    const wrongTopicFormat = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Test content',
        narration: 'Test narration'
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Test content',
        narration: 'Test narration'
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Test Topic',
          content: 'Test content',
          bulletPoints: ['Point 1', 'Point 2'], // Old format
          narration: ['Part 1', 'Part 2'] // Wrong format - should be string
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
        ],
        passMark: 80,
        narration: 'Assessment narration'
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(wrongTopicFormat) } })

    // Wait for validation error
    await waitFor(() => {
      const errorMessage = screen.getByText(/Invalid format.*bulletPoints.*narration.*string/i)
      expect(errorMessage).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should not enable Next button
    const nextButton = screen.getByText(/next/i)
    expect(nextButton).toBeDisabled()
  })

  it('should show helpful error message for missing essential topic fields', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Create JSON with topic missing essential fields that can't be auto-fixed
    const missingEssentialFields = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Test content',
        narration: 'Test narration'
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Test content',
        narration: 'Test narration'
      },
      topics: [
        {
          // Missing: id, title, content - essential fields that can't be guessed
          narration: 'Test narration'
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
        ],
        passMark: 80,
        narration: 'Assessment narration'
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(missingEssentialFields) } })

    // Wait for validation error
    await waitFor(() => {
      const errorMessage = screen.getByText(/Missing required fields in topic/i)
      expect(errorMessage).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should not enable Next button
    const nextButton = screen.getByText(/next/i)
    expect(nextButton).toBeDisabled()
  })

  it('should show success message when auto-fixes are applied', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Create JSON with fixable missing fields
    const fixableJson = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Test content',
        narration: 'Test narration'
        // Missing: imageKeywords, imagePrompts, videoSearchTerms, duration (auto-fixable)
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Test content',
        narration: 'Test narration'
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Test Topic',
          content: 'Test content'
          // Missing: narration, imageKeywords, imagePrompts, videoSearchTerms, duration, knowledgeCheck (auto-fixable)
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
            // Missing: feedback (auto-fixable)
          }
        ]
        // Missing: passMark, narration (auto-fixable)
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(fixableJson) } })

    // Wait for auto-fix success message
    await waitFor(() => {
      // Look for success message indicating auto-fixes were applied
      const successMessage = screen.queryByText(/automatically fixed/i) || 
                           screen.queryByText(/formatting issue/i)
      expect(successMessage).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should enable Next button after auto-fix
    await waitFor(() => {
      const nextButton = screen.getByText(/next/i)
      expect(nextButton).not.toBeDisabled()
    }, { timeout: 3000 })
  })
})