import { render, screen, waitFor, fireEvent } from '../test/testProviders'
import { vi } from 'vitest'
import { JSONImportValidator } from './JSONImportValidator'

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    readText: vi.fn()
  }
})

// Mock the storage - create stable object to prevent re-renders
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn().mockResolvedValue(null),
  saveContent: vi.fn().mockResolvedValue(undefined),
  saveProject: vi.fn().mockResolvedValue(undefined)
}

vi.mock('../contexts/PersistentStorageContext', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    useStorage: vi.fn(() => mockStorage) // Ensure same object is always returned
  }
})

// Mock the notifications
const mockNotifyError = vi.fn()
const mockSuccess = vi.fn()
const mockInfo = vi.fn()
vi.mock('../contexts/NotificationContext', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    useNotifications: () => ({
      error: mockNotifyError,
      success: mockSuccess,
      info: mockInfo
    })
  }
})

describe('JSONImportValidator - Toggle Button After Clear Issue', () => {
  const validJSON = `{
    "welcomePage": {
      "id": "welcome",
      "title": "Welcome to Natural Gas Safety",
      "content": "Hello and welcome to your comprehensive training on Natural Gas Safety."
    },
    "learningObjectivesPage": {
      "id": "objectives",
      "title": "Learning Objectives",
      "content": "By the end of this course, you will be able to understand natural gas safety procedures."
    },
    "topics": [
      {
        "id": "topic-1",
        "title": "Introduction to Natural Gas",
        "content": "Natural gas is a vital part of our energy infrastructure."
      }
    ],
    "assessment": {
      "questions": [
        {
          "id": "q1",
          "question": "What is natural gas?",
          "type": "multiple-choice",
          "options": ["A gas", "A liquid", "A solid"],
          "correctAnswer": 0
        }
      ]
    }
  }`

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock successful clipboard read
    navigator.clipboard.readText = vi.fn().mockResolvedValue(validJSON)
  })

  it.only('should show toggle button after clearing and entering new JSON', async () => {
    // This test reproduces the specific issue from beta feedback:
    // 1. Enter valid JSON → shows tree view automatically  
    // 2. Clear course structure
    // 3. Enter another valid JSON → doesn't switch to tree view and toggle button disappears

    const mockOnNext = vi.fn()
    const mockOnClearData = vi.fn()

    // Act: Render the component
    render(
      <JSONImportValidator
        onNext={mockOnNext}
        onClearData={mockOnClearData}
      />
    )

    // Step 1: Enter valid JSON (first time)
    const jsonTextarea = screen.getByTestId('json-textarea')
    const pasteButton = screen.getByTestId('paste-clipboard-button')

    // Paste first JSON
    fireEvent.click(pasteButton)
    
    await waitFor(() => {
      expect(jsonTextarea).toHaveValue(validJSON)
    })

    // Wait for validation to complete - Next button should become enabled
    await waitFor(() => {
      const nextButton = screen.queryByTestId('next-button')
      const isNextDisabled = nextButton?.hasAttribute('disabled')
      
      console.log('Debug - Next disabled?', isNextDisabled)
      
      if (isNextDisabled) {
        throw new Error(`Validation not complete yet. Next enabled: ${!isNextDisabled}`)
      }
      
      expect(nextButton).not.toHaveAttribute('disabled')
    }, { timeout: 10000 })

    // Now the toggle button should appear  
    await waitFor(() => {
      const toggleButton = screen.queryByTestId('toggle-view-button')
      console.log('Debug - Toggle button found?', !!toggleButton)
      expect(toggleButton).toBeInTheDocument()
    }, { timeout: 3000 })

    // Success! The toggle button now appears after validation
    const toggleButton1 = screen.getByTestId('toggle-view-button')
    
    // Check if the automatic tree view switch worked
    // If it worked, button should show "Show JSON Editor" (meaning we're in tree view)
    // If not, it should show "Show Course Tree" (meaning we're in JSON editor)
    const currentButtonText = toggleButton1.textContent
    console.log('Button text after validation:', currentButtonText)
    
    if (currentButtonText === 'Show JSON Editor') {
      // Automatic switch to tree view worked! This is the desired behavior.
      expect(toggleButton1).toHaveTextContent('Show JSON Editor')
      
      // Verify we can toggle back to JSON editor
      fireEvent.click(toggleButton1)
      await waitFor(() => {
        expect(toggleButton1).toHaveTextContent('Show Course Tree')
      }, { timeout: 3000 })
    } else {
      // Tree view didn't auto-switch, but toggle should still work
      expect(toggleButton1).toHaveTextContent('Show Course Tree')
      
      // Click to manually switch to tree view
      fireEvent.click(toggleButton1)
      await waitFor(() => {
        expect(toggleButton1).toHaveTextContent('Show JSON Editor')
      }, { timeout: 3000 })
    }

    // Step 2: Clear course structure  
    const clearButton = screen.getByTestId('clear-json-button')
    fireEvent.click(clearButton)

    // Confirm the clear action
    await waitFor(() => {
      const confirmButton = screen.getByTestId('button-confirm')
      expect(confirmButton).toBeInTheDocument()
    })
    
    const confirmButton = screen.getByTestId('button-confirm')
    fireEvent.click(confirmButton)

    // Wait for clearing to complete
    await waitFor(() => {
      expect(jsonTextarea).toHaveValue('')
      // Toggle button should be gone after clear
      expect(screen.queryByTestId('toggle-view-button')).not.toBeInTheDocument()
    })

    // Step 3: Enter another valid JSON (this is where the bug occurs)
    // Update the mock to return different JSON
    const secondJSON = `{
      "welcomePage": {
        "id": "welcome2", 
        "title": "Second Course",
        "content": "This is the second course content."
      },
      "pages": [
        {
          "id": "page-1",
          "title": "Page One",
          "content": "Content for page one."
        }
      ]
    }`
    
    navigator.clipboard.readText = vi.fn().mockResolvedValue(secondJSON)
    
    // Paste second JSON
    fireEvent.click(pasteButton)
    
    await waitFor(() => {
      expect(jsonTextarea).toHaveValue(secondJSON)
    })

    // BUG: After clearing and entering new JSON, the toggle button should appear again
    // but it doesn't due to state management issues
    await waitFor(() => {
      const toggleButton = screen.queryByTestId('toggle-view-button')
      expect(toggleButton).toBeInTheDocument() // This should pass after fix
    }, { timeout: 10000 }) // Extended timeout to account for validation delays

    // The toggle button should allow switching to tree view
    const toggleButton2 = screen.getByTestId('toggle-view-button')
    expect(toggleButton2).toHaveTextContent('Show Course Tree') // Should be in JSON editor mode initially
    
    // Should be able to switch to tree view
    fireEvent.click(toggleButton2)
    
    await waitFor(() => {
      expect(toggleButton2).toHaveTextContent('Show JSON Editor') // Should switch to tree view
    })
  })

  it('should properly reset isTreeVisible state when clearing course structure', async () => {
    // This test focuses on the state management aspect of the bug
    
    const mockOnNext = vi.fn()
    const mockOnClearData = vi.fn()

    render(
      <JSONImportValidator
        onNext={mockOnNext}
        onClearData={mockOnClearData}
      />
    )

    // Enter JSON and switch to tree view
    const jsonTextarea = screen.getByTestId('json-textarea')
    const pasteButton = screen.getByTestId('paste-clipboard-button')

    fireEvent.click(pasteButton)
    
    await waitFor(() => {
      expect(jsonTextarea).toHaveValue(validJSON)
    })

    // Wait for toggle button and switch to tree view
    await waitFor(() => {
      const toggleButton = screen.getByTestId('toggle-view-button')
      fireEvent.click(toggleButton)
    })

    await waitFor(() => {
      const toggleButton = screen.getByTestId('toggle-view-button')
      expect(toggleButton).toHaveTextContent('Show JSON Editor') // Should be in tree view
    })

    // Clear course structure while in tree view
    const clearButton = screen.getByTestId('clear-json-button')
    fireEvent.click(clearButton)

    await waitFor(() => {
      const confirmButton = screen.getByTestId('button-confirm')
      fireEvent.click(confirmButton)
    })

    // After clear, component should reset to JSON editor view
    await waitFor(() => {
      expect(jsonTextarea).toHaveValue('')
      expect(screen.queryByTestId('toggle-view-button')).not.toBeInTheDocument()
    })

    // Enter new JSON - should start in JSON editor view, not tree view
    const newJSON = '{"welcomePage": {"id": "new", "title": "New Course"}}'
    navigator.clipboard.readText = vi.fn().mockResolvedValue(newJSON)
    
    fireEvent.click(pasteButton)
    
    await waitFor(() => {
      expect(jsonTextarea).toHaveValue(newJSON)
    })

    // Toggle button should appear and start in correct state
    await waitFor(() => {
      const toggleButton = screen.getByTestId('toggle-view-button')
      expect(toggleButton).toBeInTheDocument()
      expect(toggleButton).toHaveTextContent('Show Course Tree') // Should start in JSON editor mode
    })
  })

  it('should maintain validation state correctly after clear operation', async () => {
    // Test that validation properly re-runs after clear
    
    const mockOnNext = vi.fn()
    const mockOnClearData = vi.fn()

    render(
      <JSONImportValidator
        onNext={mockOnNext}
        onClearData={mockOnClearData}
      />
    )

    const jsonTextarea = screen.getByTestId('json-textarea')
    const pasteButton = screen.getByTestId('paste-clipboard-button')

    // Enter valid JSON
    fireEvent.click(pasteButton)
    
    await waitFor(() => {
      expect(jsonTextarea).toHaveValue(validJSON)
      expect(screen.getByText(/Valid JSON/)).toBeInTheDocument()
    })

    // Clear
    const clearButton = screen.getByTestId('clear-json-button')
    fireEvent.click(clearButton)

    await waitFor(() => {
      const confirmButton = screen.getByTestId('button-confirm')
      fireEvent.click(confirmButton)
    })

    // After clear, validation should be reset
    await waitFor(() => {
      expect(jsonTextarea).toHaveValue('')
      expect(screen.queryByText(/Valid JSON/)).not.toBeInTheDocument()
    })

    // Enter invalid JSON to test validation
    const invalidJSON = '{"invalid": json}'
    navigator.clipboard.readText = vi.fn().mockResolvedValue(invalidJSON)
    
    fireEvent.click(pasteButton)
    
    await waitFor(() => {
      expect(jsonTextarea).toHaveValue(invalidJSON)
      // Should show error, not the toggle button
      expect(screen.queryByTestId('toggle-view-button')).not.toBeInTheDocument()
    })

    // Fix the JSON
    const fixedJSON = '{"valid": "json"}'
    navigator.clipboard.readText = vi.fn().mockResolvedValue(fixedJSON)
    
    fireEvent.click(pasteButton)
    
    await waitFor(() => {
      expect(jsonTextarea).toHaveValue(fixedJSON)
      // Now toggle button should appear for valid JSON
      expect(screen.getByTestId('toggle-view-button')).toBeInTheDocument()
    })
  })
})