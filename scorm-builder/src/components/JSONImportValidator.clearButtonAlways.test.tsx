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

describe('JSONImportValidator - Clear Button Always Available', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
  })

  it('should show clear button when JSON is valid syntax but fails course structure validation', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Create JSON with valid syntax but invalid structure (missing required fields)
    const invalidStructureJson = {
      title: 'My Course', // This is valid JSON but not a valid course structure
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
    fireEvent.change(textarea, { target: { value: JSON.stringify(invalidStructureJson) } })

    // Wait for validation to process
    await waitFor(() => {
      // Should show validation error
      const errorAlert = screen.queryByText(/Unable to Process Content/i)
      expect(errorAlert).toBeInTheDocument()
    }, { timeout: 3000 })

    // The clear button should be visible even when structure validation fails
    // This will fail initially because clear button is only shown when isLocked is true
    const clearButton = screen.queryByTestId('clear-json-button')
    expect(clearButton).toBeInTheDocument()
    expect(clearButton).toBeVisible()
  })

  it('should show clear button when JSON has valid structure but other validation errors', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Create JSON that might pass initial validation but fail later checks
    const partiallyValidJson = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Test content'
        // Missing other required fields like narration
      },
      learningObjectivesPage: {
        id: 'objectives', 
        title: 'Learning Objectives',
        content: 'Test content'
      },
      topics: [], // Empty topics array might cause issues
      assessment: {
        questions: []
      }
    }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(partiallyValidJson) } })

    // Wait for some kind of feedback (either error or success)
    await waitFor(() => {
      // There should be some feedback about the validation
      const hasError = screen.queryByText(/Unable to Process Content/i)
      const hasSuccess = screen.queryByText(/Ready to Import/i) 
      expect(hasError || hasSuccess).toBeTruthy()
    }, { timeout: 3000 })

    // Clear button should always be available when there's content
    const clearButton = screen.queryByTestId('clear-json-button')
    expect(clearButton).toBeInTheDocument()
    expect(clearButton).toBeVisible()
  })

  it('should show clear button in JSON editor view when validation fails', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Invalid JSON structure
    const invalidJson = { invalidStructure: true }

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(invalidJson) } })

    // Wait for validation
    await waitFor(() => {
      const errorAlert = screen.queryByText(/Unable to Process Content/i)
      expect(errorAlert).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should be in editor view (not tree view) since validation failed
    // But clear button should still be available
    const clearButton = screen.queryByTestId('clear-json-button')
    expect(clearButton).toBeInTheDocument()
  })

  it('should allow clearing content even when Next button is disabled', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Add invalid content
    const invalidContent = { invalid: 'structure' }
    
    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: JSON.stringify(invalidContent) } })

    // Wait for validation failure
    await waitFor(() => {
      // Next button should be disabled
      const nextButton = screen.getByText(/next/i)
      expect(nextButton).toBeDisabled()
    }, { timeout: 3000 })

    // But clear button should be available and functional
    const clearButton = screen.getByTestId('clear-json-button')
    expect(clearButton).toBeInTheDocument()
    expect(clearButton).not.toBeDisabled()

    // Click clear button should work
    fireEvent.click(clearButton)

    // Should show confirmation dialog
    await waitFor(() => {
      const confirmDialog = screen.queryByText(/Clear Course Structure/i)
      expect(confirmDialog).toBeInTheDocument()
    })
  })

  it('should hide clear button when textarea is empty', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Initially, with empty content, clear button should not be visible
    const clearButton = screen.queryByTestId('clear-json-button')
    expect(clearButton).not.toBeInTheDocument()

    // Add some content
    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { target: { value: 'some content' } })

    // Now clear button should appear
    await waitFor(() => {
      const clearButtonAfterContent = screen.queryByTestId('clear-json-button')
      expect(clearButtonAfterContent).toBeInTheDocument()
    })
  })
})