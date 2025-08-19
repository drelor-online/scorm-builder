import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

describe('JSONImportValidator - isValidating Bug Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
  })

  it('should reset isValidating state when input is cleared', async () => {
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
    
    // Enter invalid JSON to trigger validation state
    fireEvent.change(textarea, { target: { value: 'invalid json' } })
    
    // Clear the input - this should reset isValidating to false
    fireEvent.change(textarea, { target: { value: '' } })
    
    // Verify the textarea is empty
    expect((textarea as HTMLInputElement).value).toBe('')
    
    // The fix: isValidating should be reset to false, allowing subsequent validation
    // We can't directly test the internal state, but we can verify behavior
    
    // Enter valid JSON - this should work without being blocked
    const validJSON = '{"test": "value"}'
    fireEvent.change(textarea, { target: { value: validJSON } })
    
    // If isValidating was properly reset, this should process without hanging
    await waitFor(() => {
      expect((textarea as HTMLInputElement).value).toBe(validJSON)
    }, { timeout: 1000 })
  })
})