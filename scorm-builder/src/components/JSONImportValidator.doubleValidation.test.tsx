import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
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

// JSON that triggers auto-fix (will cause double validation in current implementation)
const jsonNeedingAutofix = {
  welcomePage: {
    id: 'welcome',
    title: 'Welcome',
    content: '<h2>Welcome</h2>',
    narration: 'Welcome narration'
    // Missing: imageKeywords, imagePrompts, videoSearchTerms, duration - will trigger auto-fix
  },
  topics: [
    {
      id: 'topic-0',
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
    // Missing: narration - will trigger auto-fix
  }
}

describe('JSONImportValidator - Double Validation Prevention', () => {
  let validationCallCount = 0
  let originalConsoleLog: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
    validationCallCount = 0
    
    // Spy on console.log to count validation calls
    originalConsoleLog = console.log
    console.log = vi.fn((...args) => {
      if (args[0]?.includes && args[0].includes('JSON validation successful (pre-processing)')) {
        validationCallCount++
      }
      // Call original for other logs
      if (!args[0]?.includes || !args[0].includes('JSON validation successful')) {
        originalConsoleLog(...args)
      }
    })
  })

  afterEach(() => {
    console.log = originalConsoleLog
  })

  it('should NOT trigger double validation within rapid succession', async () => {
    const { unmount } = render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    
    // Reset validation count before test
    validationCallCount = 0
    
    // Paste JSON that will trigger auto-fix
    act(() => {
      fireEvent.change(textarea, { 
        target: { value: JSON.stringify(jsonNeedingAutofix, null, 2) } 
      })
    })

    // Wait for validation to complete
    await waitFor(() => {
      const result = screen.queryByText(/ready to import/i) || 
                    screen.queryByText(/unable to process/i) ||
                    screen.queryByText(/automatically fixed/i)
      expect(result).toBeTruthy()
    }, { timeout: 3000 })
    
    // Allow any additional async operations to complete
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // SHOULD ONLY VALIDATE ONCE, but currently validates twice (this test should FAIL initially)
    expect(validationCallCount).toBe(1) // This will fail with current implementation showing the bug
    
    unmount()
  }, 5000)

  it('should not have overlapping validation states during auto-fix', async () => {
    let isValidatingCount = 0
    
    // Mock the useState for isValidating to track state changes
    const originalUseState = React.useState
    const mockUseState = vi.spyOn(React, 'useState').mockImplementation((initial) => {
      if (typeof initial === 'boolean' && initial === false) {
        // This might be isValidating state
        const [state, setState] = originalUseState(initial)
        const wrappedSetState = (newState: any) => {
          if (newState === true) {
            isValidatingCount++
          }
          setState(newState)
        }
        return [state, wrappedSetState]
      }
      return originalUseState(initial)
    })

    const { unmount } = render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    
    // Reset count before test
    isValidatingCount = 0
    
    // Paste JSON that will trigger auto-fix
    act(() => {
      fireEvent.change(textarea, { 
        target: { value: JSON.stringify(jsonNeedingAutofix, null, 2) } 
      })
    })

    // Wait for validation to complete
    await waitFor(() => {
      const result = screen.queryByText(/ready to import/i) || 
                    screen.queryByText(/unable to process/i) ||
                    screen.queryByText(/automatically fixed/i)
      expect(result).toBeTruthy()
    }, { timeout: 3000 })
    
    // Should not have multiple overlapping validation states
    expect(isValidatingCount).toBeLessThanOrEqual(2) // Allow for one retry but not infinite
    
    mockUseState.mockRestore()
    unmount()
  }, 5000)
})