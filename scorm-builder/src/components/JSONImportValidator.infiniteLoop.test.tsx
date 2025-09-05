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

// Large JSON with 20 topics that triggers auto-fix and potential infinite loop
const largeJsonWithMissingFields = {
  welcomePage: {
    id: 'welcome',
    title: 'Welcome to 49 CFR Part 192',
    content: '<h2>Welcome</h2><p>Course content</p>',
    narration: 'Welcome narration'
    // Missing: imageKeywords, imagePrompts, videoSearchTerms, duration (will trigger auto-fix)
  },
  learningObjectivesPage: {
    id: 'learning-objectives',
    title: 'Learning Objectives',
    content: '<h2>Learning Objectives</h2><p>Objectives content</p>',
    narration: 'Objectives narration'
    // Missing fields will trigger auto-fix
  },
  topics: Array.from({ length: 20 }, (_, i) => ({
    id: `topic-${i}`,
    title: `Topic ${i + 1}`,
    content: `<h2>Topic ${i + 1}</h2><p>Content for topic ${i + 1}</p>`,
    narration: `Narration for topic ${i + 1}`
    // Missing: imageKeywords, imagePrompts, videoSearchTerms, duration, knowledgeCheck
    // This will trigger auto-fix for all 20 topics
  })),
  assessment: {
    questions: Array.from({ length: 12 }, (_, i) => ({
      id: `q${i + 1}`,
      type: 'multiple-choice' as const,
      question: `Question ${i + 1}?`,
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A'
      // Missing: feedback (will trigger auto-fix)
    })),
    passMark: 80
    // Missing: narration (will trigger auto-fix)
  }
}

describe('JSONImportValidator - Infinite Loop Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
    
    // Clear any existing timers
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not get stuck in infinite validation loop with large JSON requiring auto-fix', async () => {
    const validateJSONSpy = vi.fn()
    
    // Mock console.log to capture validation calls
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    // Paste the large JSON that will trigger auto-fix
    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { 
      target: { value: JSON.stringify(largeJsonWithMissingFields) } 
    })

    // Wait for initial validation
    await waitFor(() => {
      // Should show some kind of processing indicator or result
      const isProcessing = screen.queryByText(/validating/i) || screen.queryByText(/processing/i)
      const hasResult = screen.queryByText(/ready to import/i) || screen.queryByText(/unable to process/i)
      expect(isProcessing || hasResult).toBeTruthy()
    }, { timeout: 5000 })

    // Fast-forward timers to simulate multiple validation cycles
    // In an infinite loop, this would keep triggering validations
    act(() => {
      vi.advanceTimersByTime(1000) // Advance 1 second
    })

    // Count validation debug logs - should not keep increasing infinitely
    const validationLogs = consoleSpy.mock.calls.filter(call => 
      call[0]?.includes('JSON Validation Debug') || 
      call[0]?.includes('JSON validation successful')
    )

    // Should have completed validation by now (not still running)
    const stillValidating = screen.queryByText(/validating/i)
    expect(stillValidating).not.toBeInTheDocument()

    // Should have a clear result (success or error)
    await waitFor(() => {
      const successResult = screen.queryByText(/ready to import/i)
      const errorResult = screen.queryByText(/unable to process/i)
      expect(successResult || errorResult).toBeTruthy()
    })

    // Validation should not be called excessively (more than 3 times indicates a loop)
    expect(validationLogs.length).toBeLessThan(4)
    
    consoleSpy.mockRestore()
  }, 10000)

  it('should complete auto-fix in reasonable time for large JSON', async () => {
    const startTime = Date.now()
    
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { 
      target: { value: JSON.stringify(largeJsonWithMissingFields) } 
    })

    // Should complete validation within reasonable time
    await waitFor(() => {
      const result = screen.queryByText(/ready to import/i) || screen.queryByText(/unable to process/i)
      expect(result).toBeTruthy()
      
      const elapsed = Date.now() - startTime
      expect(elapsed).toBeLessThan(5000) // Should complete within 5 seconds
    }, { timeout: 6000 })
  })

  it('should prevent multiple simultaneous validations', async () => {
    let validationCount = 0
    const originalSetTimeout = window.setTimeout
    
    // Mock setTimeout to count validation calls
    vi.spyOn(window, 'setTimeout').mockImplementation((fn, delay) => {
      if (delay === 50) { // This is the validation delay
        validationCount++
      }
      return originalSetTimeout(fn, delay)
    })

    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    
    // Rapidly change the textarea multiple times (simulating the auto-fix update loop)
    fireEvent.change(textarea, { target: { value: JSON.stringify(largeJsonWithMissingFields) } })
    fireEvent.change(textarea, { target: { value: JSON.stringify(largeJsonWithMissingFields) + ' ' } })
    fireEvent.change(textarea, { target: { value: JSON.stringify(largeJsonWithMissingFields) } })

    // Wait for validation to complete
    await waitFor(() => {
      const result = screen.queryByText(/ready to import/i) || screen.queryByText(/unable to process/i)
      expect(result).toBeTruthy()
    }, { timeout: 5000 })

    // Should not have scheduled excessive validations
    expect(validationCount).toBeLessThan(10) // Reasonable limit for validation attempts
  })

  it('should show progress or loading state during long validation', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { 
      target: { value: JSON.stringify(largeJsonWithMissingFields) } 
    })

    // Should show some kind of loading/processing indicator initially
    await waitFor(() => {
      const loadingIndicator = screen.queryByText(/validating/i) || 
                             screen.queryByText(/processing/i) ||
                             screen.queryByRole('progressbar')
      expect(loadingIndicator).toBeTruthy()
    }, { timeout: 1000 })

    // Eventually should complete and show result
    await waitFor(() => {
      const result = screen.queryByText(/ready to import/i) || screen.queryByText(/unable to process/i)
      expect(result).toBeTruthy()
    }, { timeout: 5000 })
  })

  it('should handle timeout for extremely long validation', async () => {
    // Create an extremely large JSON that might cause timeout
    const extremelyLargeJson = {
      ...largeJsonWithMissingFields,
      topics: Array.from({ length: 100 }, (_, i) => ({
        id: `topic-${i}`,
        title: `Topic ${i + 1}`,
        content: `<h2>Topic ${i + 1}</h2><p>${'Very long content '.repeat(100)}</p>`,
        narration: `Narration for topic ${i + 1}`
      }))
    }

    render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    fireEvent.change(textarea, { 
      target: { value: JSON.stringify(extremelyLargeJson) } 
    })

    // Should either complete successfully or show timeout error
    await waitFor(() => {
      const success = screen.queryByText(/ready to import/i)
      const timeout = screen.queryByText(/timeout/i)
      const error = screen.queryByText(/unable to process/i)
      expect(success || timeout || error).toBeTruthy()
    }, { timeout: 15000 }) // Allow up to 15 seconds for this test
  })
})