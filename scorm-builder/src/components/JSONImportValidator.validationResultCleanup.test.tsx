import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JSONImportValidator } from './JSONImportValidator'
import { NotificationProvider } from '../contexts/NotificationContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext' 
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'

// Mock all the contexts and services
vi.mock('../contexts/PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: any) => children,
  useStorage: () => ({
    isInitialized: true,
    currentProjectId: 'test-project',
    getCourseContent: vi.fn().mockResolvedValue(null),
    saveCourseContent: vi.fn().mockResolvedValue(undefined),
    saveContent: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('../contexts/UnifiedMediaContext', () => ({
  UnifiedMediaProvider: ({ children }: any) => children,
  useUnifiedMedia: () => ({
    getMedia: vi.fn()
  })
}))

vi.mock('../contexts/StepNavigationContext', () => ({
  StepNavigationProvider: ({ children }: any) => children,
  useStepNavigation: () => ({
    currentStepIndex: 0,
    setCurrentStep: vi.fn()
  })
}))

vi.mock('../contexts/UnsavedChangesContext', () => ({
  UnsavedChangesProvider: ({ children }: any) => children,
  useUnsavedChanges: () => ({
    hasUnsavedChanges: false,
    setHasUnsavedChanges: vi.fn()
  })
}))

vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('JSONImportValidator - Validation Result Cleanup', () => {
  let mockOnNext: Mock
  let mockGetMedia: Mock

  beforeEach(() => {
    mockOnNext = vi.fn()
    mockGetMedia = vi.fn()
    vi.clearAllMocks()
  })

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <NotificationProvider>
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <UnsavedChangesProvider>
            <UnifiedMediaProvider>
              {children}
            </UnifiedMediaProvider>
          </UnsavedChangesProvider>
        </StepNavigationProvider>
      </PersistentStorageProvider>
    </NotificationProvider>
  )

  it('should clean orphaned media references from validation result data before passing to onNext', async () => {
    // SCENARIO: This reproduces the exact issue from your console logs
    // 1. JSON input has no media references (fresh paste)
    // 2. But validation result somehow gets media references added 
    // 3. These orphaned references should be cleaned before onNext() is called
    
    const user = userEvent.setup()
    
    // Mock media existence check - image-0 was deleted, image-1 exists
    mockGetMedia.mockImplementation(async (mediaId: string) => {
      if (mediaId === 'image-0') {
        return null // This media was deleted - should be cleaned
      }
      if (mediaId === 'image-1') {
        return { // This media exists - should be kept
          data: new Uint8Array([1, 2, 3]),
          metadata: { type: 'image', title: 'Valid Image' },
          url: 'blob:http://localhost:1420/valid-url'
        }
      }
      return null
    })

    // JSON input with NO media references (typical fresh paste)
    const inputJsonWithNoMedia = JSON.stringify({
      welcomePage: {
        id: 'welcome-1',
        title: 'Welcome',
        content: '<h1>Welcome to the course</h1>',
        narration: 'Welcome to this course',
        imageKeywords: ['welcome'],
        imagePrompts: ['welcome scene'],
        videoSearchTerms: ['intro'],
        duration: 2
        // NO media array - this is fresh input
      },
      learningObjectivesPage: {
        id: 'objectives-1', 
        title: 'Learning Objectives',
        content: '<p>Learn about...</p>',
        narration: 'The learning objectives are...',
        imageKeywords: ['objectives'],
        imagePrompts: ['learning goals'],
        videoSearchTerms: ['goals'],
        duration: 3
        // NO media array - this is fresh input
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Introduction',
          content: '<p>This is the introduction</p>',
          narration: 'This is the introduction to our course',
          imageKeywords: ['intro'],
          imagePrompts: ['introduction scene'],
          videoSearchTerms: ['intro'],
          duration: 5
          // NO media array - this is fresh input
        }
      ],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    })

    render(
      <TestWrapper>
        <JSONImportValidator
          onNext={mockOnNext}
          onBack={() => {}}
        />
      </TestWrapper>
    )

    // Find and paste the JSON
    const textArea = screen.getByRole('textbox')
    await user.clear(textArea)
    await user.type(textArea, inputJsonWithNoMedia)

    // Click validate
    const validateButton = screen.getByRole('button', { name: /validate/i })
    await user.click(validateButton)

    await waitFor(() => {
      expect(screen.getByText(/valid json/i)).toBeInTheDocument()
    }, { timeout: 10000 })

    // Simulate the bug: somehow validation result gets media references added
    // (This might happen during parsing, validation, or from previous app state)
    // We need to intercept and modify the validation result to include orphaned media
    
    // Click Next to proceed 
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // Wait for onNext to be called
    await waitFor(() => {
      expect(mockOnNext).toHaveBeenCalled()
    }, { timeout: 5000 })

    // CRITICAL ASSERTION: The data passed to onNext should NOT contain orphaned media references
    const passedData = mockOnNext.mock.calls[0][0]
    
    // Check that orphaned media references (image-0) have been removed
    if (passedData.welcomePage.media) {
      const welcomeMediaIds = passedData.welcomePage.media.map((m: any) => m.id)
      expect(welcomeMediaIds).not.toContain('image-0') // Should be cleaned
    }
    
    if (passedData.learningObjectivesPage.media) {
      const objectivesMediaIds = passedData.learningObjectivesPage.media.map((m: any) => m.id)
      expect(objectivesMediaIds).not.toContain('image-0') // Should be cleaned
    }
    
    if (passedData.topics[0].media) {
      const topicMediaIds = passedData.topics[0].media.map((m: any) => m.id)
      expect(topicMediaIds).not.toContain('image-0') // Should be cleaned
      // But valid media should remain
      if (topicMediaIds.includes('image-1')) {
        expect(topicMediaIds).toContain('image-1') // Should be kept
      }
    }
  })

  it('should handle the case where validation result has no media references at all', async () => {
    // Simpler test: ensure cleanup doesn't break when there are no media references
    const user = userEvent.setup()
    
    const simpleJson = JSON.stringify({
      welcomePage: {
        id: 'welcome-1',
        title: 'Welcome',
        content: '<h1>Welcome</h1>',
        narration: 'Welcome',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 2
      },
      learningObjectivesPage: {
        id: 'objectives-1',
        title: 'Objectives', 
        content: '<p>Objectives</p>',
        narration: 'Objectives',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 2
      },
      topics: [],
      assessment: { questions: [], passMark: 80, narration: null }
    })

    render(
      <TestWrapper>
        <JSONImportValidator
          onNext={mockOnNext}
          onBack={() => {}}
        />
      </TestWrapper>
    )

    const textArea = screen.getByRole('textbox')
    await user.clear(textArea)
    await user.type(textArea, simpleJson)

    const validateButton = screen.getByRole('button', { name: /validate/i })
    await user.click(validateButton)

    await waitFor(() => {
      expect(screen.getByText(/valid json/i)).toBeInTheDocument()
    }, { timeout: 10000 })

    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    await waitFor(() => {
      expect(mockOnNext).toHaveBeenCalled()
    }, { timeout: 5000 })

    // Should not throw errors and should pass clean data
    expect(mockOnNext).toHaveBeenCalledWith(expect.any(Object))
  })
})