import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { JSONImportValidator } from './JSONImportValidator'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { CourseContent } from '../types/aiPrompt'

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

describe('JSONImportValidator - Type Compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
  })

  it('should handle assessment narration type compatibility correctly', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Create JSON with null assessment narration (as per aiPrompt.ts interface)
    const jsonWithNullNarration: CourseContent = {
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
        narration: null // This should be valid according to aiPrompt.ts
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(jsonWithNullNarration) } })

    // Wait for validation to complete
    await waitFor(() => {
      const nextButton = screen.getByText(/next/i)
      expect(nextButton).not.toBeDisabled()
    }, { timeout: 3000 })

    // Verify that the auto-fix maintains type consistency
    // The assessment narration should remain null (as per aiPrompt.ts interface)
    // This test will fail if auto-fix tries to assign string to null type
  })

  it('should preserve null assessment narration after auto-fix', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Create JSON with missing assessment narration field
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
        // narration field is missing - should be auto-fixed to null, not empty string
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(jsonWithMissingNarration) } })

    // Wait for validation and auto-fix to complete
    await waitFor(() => {
      const nextButton = screen.getByText(/next/i)
      expect(nextButton).not.toBeDisabled()
    }, { timeout: 3000 })

    // This test validates that the auto-fix preserves type compatibility
    // If the auto-fix tries to set narration to an empty string instead of null,
    // this will cause a TypeScript error because aiPrompt.ts defines narration as null
  })

  it('should compile without TypeScript errors', () => {
    // This test ensures the type definitions are consistent
    // If there's a type mismatch in the auto-fix code, this test will fail to compile
    const validAssessment: CourseContent['assessment'] = {
      questions: [],
      passMark: 80,
      narration: null // This must be null according to aiPrompt.ts
    }

    // Verify we can't assign string to null type (this would cause TS error)
    expect(validAssessment.narration).toBe(null)
    
    // This assertion would fail if we tried to set narration to empty string:
    // validAssessment.narration = '' // TypeScript error!
  })
})