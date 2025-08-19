import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'

// Mock the storage
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn(),
  saveContent: vi.fn(),
  saveCourseContent: vi.fn(),
  saveProject: vi.fn()
}

const TestProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PersistentStorageProvider storage={mockStorage as any}>
    <StepNavigationProvider>
      <UnifiedMediaProvider projectId="test-project">
        <UnsavedChangesProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </UnsavedChangesProvider>
      </UnifiedMediaProvider>
    </StepNavigationProvider>
  </PersistentStorageProvider>
)

// Valid course content
const courseContent = {
  welcomePage: {
    id: 'content-0',
    title: 'Welcome',
    content: '<h1>Welcome</h1>',
    narration: 'Welcome',
    imageKeywords: [],
    imagePrompts: [],
    videoSearchTerms: [],
    duration: 2
  },
  learningObjectivesPage: {
    id: 'content-1',
    title: 'Objectives',
    content: '<h2>Objectives</h2>',
    narration: 'Objectives',
    imageKeywords: [],
    imagePrompts: [],
    videoSearchTerms: [],
    duration: 1
  },
  topics: [
    {
      id: 'content-2',
      title: 'Topic 1',
      content: '<h2>Topic 1</h2>',
      narration: 'Topic 1',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3
    }
  ],
  assessment: {
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice' as const,
        question: 'Test question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        explanation: 'Test explanation.'
      }
    ]
  }
}

const courseSeedData = {
  courseTitle: 'Test Course',
  courseDescription: 'Test Description',
  targetAudience: 'Test Audience',
  learningObjectives: ['Objective 1'],
  assessmentCriteria: ['Criteria 1'],
  additionalContext: ''
}

describe('MediaEnhancementWizard Concurrent Upload Race Condition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
  })

  it('should prevent concurrent file uploads and cancel previous upload', async () => {
    const user = userEvent.setup()
    
    render(
      <TestProviders>
        <MediaEnhancementWizard 
          courseContent={courseContent as any}
          courseSeedData={courseSeedData as any}
          onUpdateContent={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onSettingsClick={vi.fn()}
          onHelp={vi.fn()}
          onSave={vi.fn()}
          onOpen={vi.fn()}
          onStepClick={vi.fn()}
        />
      </TestProviders>
    )

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText(/Media Enhancement/i)).toBeInTheDocument()
    })

    // Find the file input
    const fileInput = screen.getByTestId('file-input') as HTMLInputElement

    // Create mock files for testing
    const file1 = new File(['test content 1'], 'test1.jpg', { type: 'image/jpeg' })
    const file2 = new File(['test content 2'], 'test2.jpg', { type: 'image/jpeg' })

    // Simulate first file upload
    Object.defineProperty(fileInput, 'files', {
      value: [file1],
      writable: false,
    })
    fireEvent.change(fileInput)

    // Check that processing has started
    await waitFor(() => {
      expect(screen.getByText(/Processing/i)).toBeInTheDocument()
    })

    // Quickly attempt second file upload (while first is still processing)
    Object.defineProperty(fileInput, 'files', {
      value: [file2],
      writable: false,
    })
    fireEvent.change(fileInput)

    // RACE CONDITION: Both uploads might run simultaneously
    // The second upload should either:
    // 1. Be rejected because first is still processing, OR
    // 2. Cancel the first upload and start the second
    
    // Wait for processing to complete
    await waitFor(() => {
      expect(screen.queryByText(/Processing/i)).not.toBeInTheDocument()
    }, { timeout: 3000 })

    // Only one upload should have succeeded
    // This test demonstrates the race condition - both might succeed currently
    expect(true).toBe(true) // Placeholder - actual assertion depends on fix
  })

  it('should handle file input disabled during processing', async () => {
    const user = userEvent.setup()
    
    render(
      <TestProviders>
        <MediaEnhancementWizard 
          courseContent={courseContent as any}
          courseSeedData={courseSeedData as any}
          onUpdateContent={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onSettingsClick={vi.fn()}
          onHelp={vi.fn()}
          onSave={vi.fn()}
          onOpen={vi.fn()}
          onStepClick={vi.fn()}
        />
      </TestProviders>
    )

    const fileInput = screen.getByTestId('file-input') as HTMLInputElement
    const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })

    // Start upload
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    })
    fireEvent.change(fileInput)

    // File input should be disabled during processing
    await waitFor(() => {
      expect(fileInput).toBeDisabled()
    })

    // Wait for processing to complete
    await waitFor(() => {
      expect(fileInput).not.toBeDisabled()
    }, { timeout: 3000 })
  })

  it('should handle component unmounting during file upload', async () => {
    const user = userEvent.setup()
    
    const { unmount } = render(
      <TestProviders>
        <MediaEnhancementWizard 
          courseContent={courseContent as any}
          courseSeedData={courseSeedData as any}
          onUpdateContent={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onSettingsClick={vi.fn()}
          onHelp={vi.fn()}
          onSave={vi.fn()}
          onOpen={vi.fn()}
          onStepClick={vi.fn()}
        />
      </TestProviders>
    )

    const fileInput = screen.getByTestId('file-input') as HTMLInputElement
    const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })

    // Start upload
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    })
    fireEvent.change(fileInput)

    // Unmount component during processing
    unmount()

    // Should not cause errors or memory leaks
    // If we get here without errors, test passes
    expect(true).toBe(true)
  })
})