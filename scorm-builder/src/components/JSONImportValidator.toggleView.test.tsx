import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { JSONImportValidator } from './JSONImportValidator'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'

// Mock the storage context
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn(),
  saveContent: vi.fn(),
}

vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: () => mockStorage,
}))

// Mock other dependencies
vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('../utils/jsonAutoFixer', () => ({
  smartAutoFixJSON: vi.fn((input) => input),
}))

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <StepNavigationProvider>
    <UnsavedChangesProvider>
      <UnifiedMediaProvider>
        {children}
      </UnifiedMediaProvider>
    </UnsavedChangesProvider>
  </StepNavigationProvider>
)

const validCourseJSON = `{
  "welcomePage": {
    "id": "welcome",
    "title": "Welcome",
    "content": "Welcome to the course",
    "narration": "Welcome narration"
  },
  "learningObjectivesPage": {
    "id": "objectives",
    "title": "Learning Objectives",
    "content": "Course objectives",
    "narration": "Objectives narration"
  },
  "topics": [
    {
      "id": "topic1",
      "title": "Topic 1",
      "content": "Topic content",
      "narration": "Topic narration"
    }
  ],
  "assessment": {
    "questions": [
      {
        "id": "q1",
        "type": "multiple-choice",
        "question": "Test question?",
        "correctAnswer": "A",
        "options": ["A", "B", "C", "D"]
      }
    ]
  }
}`

describe('JSONImportValidator Toggle View', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
  })

  it('should show toggle view button when JSON is valid and data exists', async () => {
    const onNext = vi.fn()
    const onBack = vi.fn()

    render(
      <TestWrapper>
        <JSONImportValidator onNext={onNext} onBack={onBack} />
      </TestWrapper>
    )

    // Initially, toggle button should not be visible
    expect(screen.queryByTestId('toggle-view-button')).not.toBeInTheDocument()

    // Enter valid JSON
    const editor = screen.getByRole('textbox')
    fireEvent.change(editor, { target: { value: validCourseJSON } })

    // Wait for validation to complete
    await waitFor(() => {
      expect(screen.getByTestId('toggle-view-button')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Button should be enabled and show "Show JSON Editor" (since it auto-switches to tree view)
    const toggleButton = screen.getByTestId('toggle-view-button')
    expect(toggleButton).not.toBeDisabled()
    expect(toggleButton).toHaveTextContent('Show JSON Editor')
    
    // Should also show tree view automatically
    expect(screen.getByText('Course Structure')).toBeInTheDocument()
  })

  it('should toggle between JSON editor and tree view when button is clicked', async () => {
    const onNext = vi.fn()
    const onBack = vi.fn()

    render(
      <TestWrapper>
        <JSONImportValidator onNext={onNext} onBack={onBack} />
      </TestWrapper>
    )

    // Enter valid JSON and wait for validation
    const editor = screen.getByRole('textbox')
    fireEvent.change(editor, { target: { value: validCourseJSON } })

    await waitFor(() => {
      expect(screen.getByTestId('toggle-view-button')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should auto-switch to tree view (JSON editor not visible)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('Course Structure')).toBeInTheDocument()

    // Click toggle button to show JSON editor
    const toggleButton = screen.getByTestId('toggle-view-button')
    expect(toggleButton).toHaveTextContent('Show JSON Editor')
    fireEvent.click(toggleButton)

    // Should now show JSON editor and hide tree view
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
    expect(screen.queryByText('Course Structure')).not.toBeInTheDocument()
    expect(toggleButton).toHaveTextContent('Show Course Tree')

    // Click toggle button to show tree view again
    fireEvent.click(toggleButton)

    // Should show tree view and hide JSON editor
    await waitFor(() => {
      expect(screen.getByText('Course Structure')).toBeInTheDocument()
    })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(toggleButton).toHaveTextContent('Show JSON Editor')
  })

  it('should be disabled when validation result is invalid or no data exists', async () => {
    const onNext = vi.fn()
    const onBack = vi.fn()

    render(
      <TestWrapper>
        <JSONImportValidator onNext={onNext} onBack={onBack} />
      </TestWrapper>
    )

    // Initially no button should be visible
    expect(screen.queryByTestId('toggle-view-button')).not.toBeInTheDocument()

    // Enter invalid JSON
    const editor = screen.getByRole('textbox')
    fireEvent.change(editor, { target: { value: '{ invalid json' } })

    // Wait a bit to ensure validation runs
    await waitFor(() => {
      // Button should still not be visible for invalid JSON
      expect(screen.queryByTestId('toggle-view-button')).not.toBeInTheDocument()
    }, { timeout: 2000 })

    // Clear the input
    fireEvent.change(editor, { target: { value: '' } })

    // Button should still not be visible for empty input
    expect(screen.queryByTestId('toggle-view-button')).not.toBeInTheDocument()
  })

  it('should automatically switch to tree view when validation succeeds', async () => {
    const onNext = vi.fn()
    const onBack = vi.fn()

    render(
      <TestWrapper>
        <JSONImportValidator onNext={onNext} onBack={onBack} />
      </TestWrapper>
    )

    // Enter valid JSON
    const editor = screen.getByRole('textbox')
    fireEvent.change(editor, { target: { value: validCourseJSON } })

    // Wait for validation and auto-switch to tree view
    await waitFor(() => {
      expect(screen.getByText('Course Structure')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should show tree view automatically
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    
    // Toggle button should show "Show JSON Editor"
    const toggleButton = screen.getByTestId('toggle-view-button')
    expect(toggleButton).toHaveTextContent('Show JSON Editor')
  })
})