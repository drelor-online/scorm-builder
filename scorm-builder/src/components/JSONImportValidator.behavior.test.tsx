import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { JSONImportValidator } from './JSONImportValidator'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'

// Mock the storage
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn(),
  saveContent: vi.fn()
}

const TestProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PersistentStorageProvider storage={mockStorage as any}>
    <StepNavigationProvider>
      <UnsavedChangesProvider>
        {children}
      </UnsavedChangesProvider>
    </StepNavigationProvider>
  </PersistentStorageProvider>
)

describe('JSONImportValidator Auto-Validation Bug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
  })

  it('should allow validation after clearing input and entering new content', async () => {
    const user = userEvent.setup()
    const mockOnNext = vi.fn()
    
    render(
      <TestProviders>
        <JSONImportValidator 
          onNext={mockOnNext}
          onBack={() => {}}
        />
      </TestProviders>
    )
    
    // Find the JSON editor textarea
    const textarea = screen.getByTestId('json-textarea')
    
    expect(textarea).toBeInTheDocument()
    
    // Step 1: Enter some invalid JSON
    fireEvent.change(textarea, { target: { value: '{"invalid": json}' } })
    
    // Wait for validation to process
    await waitFor(() => {
      // Should show validation error
      expect(screen.getByText(/JSON Error/i) || screen.getByText(/error/i)).toBeInTheDocument()
    }, { timeout: 3000 })
    
    // Step 2: Clear the input (this is where the bug occurs)
    fireEvent.change(textarea, { target: { value: '' } })
    
    // Wait for the clear to process
    await waitFor(() => {
      expect((textarea as HTMLInputElement).value).toBe('')
    })
    
    // Step 3: Enter valid JSON - this should trigger validation
    const validJSON = '{"test": "valid"}'
    
    fireEvent.change(textarea, { target: { value: validJSON } })
    
    // The bug: validation should trigger automatically but doesn't
    // This test should FAIL initially due to the isValidating stuck state
    await waitFor(() => {
      // Should show tree view or validation success
      const treeView = screen.queryByText(/Tree View/i) || 
                      screen.queryByText(/Valid JSON/i) ||
                      screen.queryByText(/welcomePage/i)
      
      expect(treeView).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('should reset isValidating state when input is cleared', async () => {
    const user = userEvent.setup()
    const mockOnNext = vi.fn()
    
    render(
      <TestProviders>
        <JSONImportValidator 
          onNext={mockOnNext}
          onBack={() => {}}
        />
      </TestProviders>
    )
    
    const textarea = screen.getByTestId('json-textarea')
    
    // Enter invalid JSON to trigger validation
    fireEvent.change(textarea, { target: { value: '{"invalid": }' } })
    
    // Wait for validation error
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
    
    // Clear the input - this should reset the validation state
    fireEvent.change(textarea, { target: { value: '' } })
    
    // Check that validation state is properly reset
    // The component should not be stuck in "validating" state
    await waitFor(() => {
      expect((textarea as HTMLInputElement).value).toBe('')
      // No error messages should be shown for empty input
      expect(screen.queryByText(/JSON Error/i)).not.toBeInTheDocument()
    })
    
    // Now paste valid JSON - this should work without being blocked
    const validJSON = '{"test": "valid"}'
    
    fireEvent.change(textarea, { target: { value: validJSON } })
    
    // Validation should work properly
    await waitFor(() => {
      // Should not show error for valid JSON
      expect(screen.queryByText(/JSON Error/i)).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should save validated JSON data to storage after successful validation', async () => {
    const user = userEvent.setup()
    const mockOnNext = vi.fn()
    
    render(
      <TestProviders>
        <JSONImportValidator 
          onNext={mockOnNext}
          onBack={() => {}}
        />
      </TestProviders>
    )
    
    const textarea = screen.getByTestId('json-textarea')
    
    // Enter valid JSON that should pass validation
    const validJSON = JSON.stringify({
      welcomePage: {
        id: "welcome",
        title: "Welcome",
        content: "<h2>Welcome</h2>",
        narration: "Welcome to the course"
      },
      learningObjectivesPage: {
        id: "objectives", 
        title: "Learning Objectives",
        content: "<h2>Objectives</h2>",
        narration: "Course objectives"
      },
      topics: [
        {
          id: "topic-1",
          title: "Test Topic",
          content: "<h2>Test</h2>",
          narration: "Test content"
        }
      ],
      assessment: {
        questions: [
          {
            id: "q1",
            type: "multiple-choice",
            question: "Test question?",
            options: ["A", "B", "C", "D"],
            correctAnswer: "A"
          }
        ]
      }
    })
    
    fireEvent.change(textarea, { target: { value: validJSON } })
    
    // Wait for successful validation
    await waitFor(() => {
      const successMessage = screen.queryByText(/JSON validated successfully/i)
      expect(successMessage).toBeInTheDocument()
    }, { timeout: 5000 })
    
    // Check that saveContent was called with the correct data
    await waitFor(() => {
      expect(mockStorage.saveContent).toHaveBeenCalledWith(
        'json-import-data',
        expect.objectContaining({
          rawJson: validJSON,
          validationResult: expect.objectContaining({
            isValid: true,
            data: expect.any(Object)
          }),
          isLocked: true
        })
      )
    })
  })
})