import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { render } from '../test/testProviders'
import JSONImportValidator from './JSONImportValidator'

// Mock production-like minification behavior
// This simulates how Terser might remove console.log and adjacent state updates
const mockMinifyConsoleLogWithStateUpdates = (originalFunction: Function) => {
  return vi.fn((...args: any[]) => {
    // In production minification, if console.log is in pure_funcs,
    // and state updates are on the same line or adjacent,
    // Terser might remove both the console.log and state updates
    const callStack = new Error().stack || ''
    
    // If this looks like the problematic pattern from validateJSON
    if (callStack.includes('validateJSON') && args[0]?.includes('Processed JSON is valid')) {
      // Simulate minification removing this call and adjacent state updates
      console.warn('Simulating production minification: console.log and adjacent state updates removed')
      return // Don't call the original function or any state updates
    }
    
    return originalFunction(...args)
  })
}

describe('JSONImportValidator - Production Minification Issues', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should reproduce the issue where tree view does not appear due to minification', async () => {
    // Mock console.log to simulate production minification behavior
    const originalConsoleLog = console.log
    console.log = mockMinifyConsoleLogWithStateUpdates(originalConsoleLog)

    const validJSON = JSON.stringify({
      welcomePage: {
        id: 'welcome-1',
        title: 'Welcome',
        content: 'Welcome content',
        narration: 'Welcome narration'
      },
      learningObjectivesPage: {
        id: 'objectives-1',
        title: 'Objectives',
        content: 'Objectives content',
        narration: 'Objectives narration'
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
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            question: 'Test question?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 0
          }
        ]
      }
    }, null, 2)

    const mockOnValidContent = vi.fn()
    const mockOnClear = vi.fn()

    render(
      <JSONImportValidator 
        onValidContent={mockOnValidContent}
        onClear={mockOnClear}
      />
    )

    // Input valid JSON
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: validJSON } })

    // Wait for validation
    await waitFor(() => {
      // The validation should happen but due to minification simulation,
      // the tree view should NOT appear
      expect(screen.queryByText('Course Structure Preview')).not.toBeInTheDocument()
    }, { timeout: 3000 })

    // Verify the JSON editor is still visible (not locked)
    expect(textarea).toBeVisible()
    expect(textarea).not.toHaveAttribute('readonly')

    // Verify that the content appears to be valid but state wasn't updated
    expect(textarea.value).toBe(validJSON)

    // Restore original console.log
    console.log = originalConsoleLog
  })

  it('should fail to call onValidContent when state updates are minified away', async () => {
    // This test specifically checks that the callback is not called
    // when minification removes the state update calls
    
    const originalConsoleLog = console.log
    console.log = mockMinifyConsoleLogWithStateUpdates(originalConsoleLog)

    const validJSON = JSON.stringify({
      welcomePage: {
        id: 'welcome-1',
        title: 'Welcome',
        content: 'Welcome content',
        narration: 'Welcome narration'
      },
      learningObjectivesPage: {
        id: 'objectives-1',
        title: 'Objectives',
        content: 'Objectives content',
        narration: 'Objectives narration'
      },
      topics: [],
      assessment: { questions: [] }
    })

    const mockOnValidContent = vi.fn()
    const mockOnClear = vi.fn()

    render(
      <JSONImportValidator 
        onValidContent={mockOnValidContent}
        onClear={mockOnClear}
      />
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: validJSON } })

    // Wait and verify the callback was NOT called due to minification
    await waitFor(() => {
      expect(mockOnValidContent).not.toHaveBeenCalled()
    }, { timeout: 2000 })

    // Restore original console.log
    console.log = originalConsoleLog
  })

  it('should show validation debug messages but fail to update UI state', async () => {
    // This test verifies that console.log messages appear but UI state is not updated
    
    const consoleSpy = vi.spyOn(console, 'log')
    const originalConsoleLog = console.log
    
    // Create a spy that captures calls but simulates minification removing state updates
    console.log = vi.fn((...args) => {
      originalConsoleLog(...args) // Still log for testing
      
      // But simulate that adjacent state updates are removed
      if (args[0]?.includes('Processed JSON is valid')) {
        // In real minification, the setValidationResult, setToast, setIsLocked calls
        // that follow would be removed
        console.warn('Production minification would remove state updates here')
      }
    })

    const validJSON = JSON.stringify({
      welcomePage: {
        id: 'welcome-1',
        title: 'Welcome',
        content: 'Welcome content',
        narration: 'Welcome narration'
      },
      learningObjectivesPage: {
        id: 'objectives-1',
        title: 'Objectives',
        content: 'Objectives content',
        narration: 'Objectives narration'
      },
      topics: [],
      assessment: { questions: [] }
    })

    render(
      <JSONImportValidator 
        onValidContent={vi.fn()}
        onClear={vi.fn()}
      />
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: validJSON } })

    // Wait for validation debug messages
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('=== JSON Validation Debug ===')
      expect(consoleSpy).toHaveBeenCalledWith('Processed JSON is valid after smart quote fixes!')
    }, { timeout: 2000 })

    // But tree view should not appear due to state update removal
    expect(screen.queryByText('Course Structure Preview')).not.toBeInTheDocument()

    // Restore console
    console.log = originalConsoleLog
    consoleSpy.mockRestore()
  })
})