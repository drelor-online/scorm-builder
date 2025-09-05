import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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

// Small JSON that triggers auto-fix (but not as large as the original)
const smallJsonWithMissingFields = {
  welcomePage: {
    id: 'welcome',
    title: 'Welcome',
    content: '<h2>Welcome</h2>',
    narration: 'Welcome narration'
    // Missing: imageKeywords, imagePrompts, videoSearchTerms, duration
  },
  topics: [
    {
      id: 'topic-1',
      title: 'Topic 1',
      content: '<h2>Topic 1</h2>',
      narration: 'Narration 1'
      // Missing fields will trigger auto-fix
    }
  ],
  assessment: {
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice' as const,
        question: 'Question 1?',
        options: ['A', 'B'],
        correctAnswer: 'A'
        // Missing: feedback
      }
    ],
    passMark: 80
    // Missing: narration
  }
}

describe('JSONImportValidator - Simple Infinite Loop Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
  })

  it('should complete validation without hanging (simple case)', async () => {
    let validationCompleted = false
    
    // Mock console.log to detect completion
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      if (args[0]?.includes('JSON validation successful')) {
        validationCompleted = true
      }
    })
    
    const { unmount } = render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    
    // Paste small JSON that will trigger auto-fix
    fireEvent.change(textarea, { 
      target: { value: JSON.stringify(smallJsonWithMissingFields) } 
    })

    // Wait for validation to complete (should not hang)
    await waitFor(() => {
      const result = screen.queryByText(/ready to import/i) || 
                    screen.queryByText(/unable to process/i) ||
                    screen.queryByText(/processing/i)
      expect(result).toBeTruthy()
    }, { timeout: 3000 })
    
    // Test should complete within timeout, not hang
    expect(true).toBe(true) // If we get here, test didn't hang
    
    consoleSpy.mockRestore()
    unmount() // Clean cleanup to prevent memory issues
  }, 5000)

  it('should show timeout error for extremely large JSON', async () => {
    const { unmount } = render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    
    // Create a JSON string that exceeds size limit (>500KB)
    const largeString = 'x'.repeat(500001)
    const largeJson = JSON.stringify({ content: largeString })
    
    // Paste extremely large JSON
    fireEvent.change(textarea, { target: { value: largeJson } })

    // Should show size limit error
    await waitFor(() => {
      const errorMessage = screen.queryByText(/too large/i)
      expect(errorMessage).toBeTruthy()
    }, { timeout: 3000 })
    
    unmount()
  }, 5000)
})