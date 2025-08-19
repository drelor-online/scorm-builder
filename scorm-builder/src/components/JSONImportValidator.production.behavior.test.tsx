import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JSONImportValidator } from './JSONImportValidator'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'

// Mock React's flushSync to simulate production behavior
const originalFlushSync = React.unstable_batchedUpdates || ((fn: Function) => fn())

// Mock the SimpleJSONEditor to simulate production timing behavior
vi.mock('./SimpleJSONEditor', () => ({
  SimpleJSONEditor: ({ value, onChange, onValidate }: any) => {
    React.useEffect(() => {
      if (value && value.trim().length > 100) {
        // Simulate production-like rapid validation
        const timer = setTimeout(() => {
          onValidate(true, [])
        }, 5) // Very short delay like production minified code
        return () => clearTimeout(timer)
      }
    }, [value, onValidate])

    return (
      <textarea
        data-testid="json-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }
}))

const validCourseContent = JSON.stringify({
  welcomePage: {
    id: "welcome-1",
    title: "Welcome to Natural Gas Safety",
    content: "<h1>Welcome</h1><p>Learn about natural gas safety protocols.</p>",
    narration: "Welcome to this comprehensive course on natural gas safety."
  },
  learningObjectivesPage: {
    id: "objectives-1", 
    title: "Learning Objectives",
    content: "<ul><li>Understand safety fundamentals</li></ul>",
    narration: "By the end of this course, you will understand key safety principles."
  },
  topics: [
    {
      id: "topic-1",
      title: "Safety Fundamentals", 
      content: "<h2>Safety Fundamentals</h2><p>Basic safety principles and protocols.</p>",
      narration: "Let's start with the fundamental principles of natural gas safety."
    }
  ],
  assessment: {
    questions: [
      {
        id: "q1",
        type: "multiple-choice",
        question: "What is the first step in gas safety?",
        options: ["Check for leaks", "Turn on equipment", "Ignore warnings"],
        correctAnswer: "Check for leaks"
      }
    ]
  }
}, null, 2)

// Mock storage
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn().mockResolvedValue(null),
  saveContent: vi.fn().mockResolvedValue(undefined)
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

describe('JSONImportValidator Production Tree View Issue', () => {
  let user: ReturnType<typeof userEvent.setup>
  
  beforeEach(() => {
    vi.clearAllMocks()
    user = userEvent.setup()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
  })

  it('should show tree view after automatic validation with production-like state batching', async () => {
    const mockOnNext = vi.fn()
    const mockOnBack = vi.fn()

    render(
      <TestProviders>
        <JSONImportValidator onNext={mockOnNext} onBack={mockOnBack} />
      </TestProviders>
    )

    // Get the JSON editor
    const editor = screen.getByTestId('json-textarea')
    
    // Verify we start with the editor visible
    expect(screen.getByText('Chatbot Response')).toBeInTheDocument()
    expect(screen.queryByText('Course Structure')).not.toBeInTheDocument()

    // Simulate pasting valid JSON content (production-like behavior)
    act(() => {
      fireEvent.change(editor, { target: { value: validCourseContent } })
    })

    // Wait for validation to complete and tree view to appear
    // This test should FAIL initially due to the state batching issue
    await waitFor(() => {
      expect(screen.getByText('Course Structure')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Verify the tree view shows the course content
    expect(screen.getByText('Welcome Page')).toBeInTheDocument()
    expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
    expect(screen.getByText('Topics (1)')).toBeInTheDocument()
    expect(screen.getByText('Assessment')).toBeInTheDocument()

    // Verify the JSON editor is no longer visible (replaced by tree view)
    expect(screen.queryByText('Chatbot Response')).not.toBeInTheDocument()
  })

  it('should handle rapid state updates in production environment', async () => {
    const mockOnNext = vi.fn()
    const mockOnBack = vi.fn()

    // Simulate production React behavior with concurrent features
    const originalSetState = React.useState
    let stateUpdateCount = 0
    
    vi.spyOn(React, 'useState').mockImplementation((initial) => {
      const [state, setState] = originalSetState(initial)
      return [state, (newState: any) => {
        stateUpdateCount++
        // Simulate production state batching delays
        if (stateUpdateCount > 3) {
          setTimeout(() => setState(newState), 1)
        } else {
          setState(newState)
        }
      }]
    })

    render(
      <TestProviders>
        <JSONImportValidator onNext={mockOnNext} onBack={mockOnBack} />
      </TestProviders>
    )

    const editor = screen.getByTestId('json-textarea')
    
    // Simulate production-like rapid state changes
    act(() => {
      fireEvent.change(editor, { target: { value: validCourseContent } })
    })

    // Should eventually show the tree view despite timing issues
    await waitFor(() => {
      expect(screen.getByText('Course Structure')).toBeInTheDocument()
    }, { timeout: 5000 })

    // Verify state remains stable
    await waitFor(() => {
      expect(screen.getByText('Welcome Page')).toBeInTheDocument()
    }, { timeout: 1000 })

    // Restore original useState
    vi.restoreAllMocks()
  })

  it('should maintain tree view visibility when finally block executes', async () => {
    const mockOnNext = vi.fn()
    const mockOnBack = vi.fn()

    render(
      <TestProviders>
        <JSONImportValidator onNext={mockOnNext} onBack={mockOnBack} />
      </TestProviders>
    )

    const editor = screen.getByTestId('json-textarea')
    
    // Type valid JSON
    act(() => {
      fireEvent.change(editor, { target: { value: validCourseContent } })
    })

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText('Course Structure')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Check that tree view remains visible for a period
    // (simulating that finally block doesn't interfere)
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(screen.getByText('Course Structure')).toBeInTheDocument()
    expect(screen.getByText('Welcome Page')).toBeInTheDocument()
  })
})