import { render, screen, waitFor } from '../test/testProviders'
import { vi } from 'vitest'
import { JSONImportValidator } from './JSONImportValidator'

// Mock the storage with saved validation data
const mockValidJSON = `{
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

// Parsed data that would be in validationResult.data
const parsedValidationData = JSON.parse(mockValidJSON)

const mockSavedData = {
  rawJson: mockValidJSON,
  validationResult: {
    isValid: true,
    data: parsedValidationData,
    summary: "Successfully parsed! Contains 1 topics."
  },
  isLocked: true,
  isTreeVisible: true
}

const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn().mockImplementation((key) => {
    if (key === 'json-import-data') {
      return Promise.resolve(mockSavedData)
    }
    return Promise.resolve(null)
  }),
  saveContent: vi.fn().mockResolvedValue(undefined),
  saveProject: vi.fn().mockResolvedValue(undefined)
}

vi.mock('../contexts/PersistentStorageContext', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    useStorage: vi.fn(() => mockStorage)
  }
})

// Mock the notifications
const mockNotifications = {
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn()
}

vi.mock('../contexts/NotificationContext', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    useNotifications: () => mockNotifications
  }
})

describe('JSONImportValidator - Storage Load Issue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show actual tree content when loading project with saved validation data', async () => {
    // This test reproduces the issue where tree view shows "data temporarily unavailable"
    // even when loading a project with previously validated JSON

    const mockOnNext = vi.fn()
    const mockOnClearData = vi.fn()

    // Act: Render component which should load saved data from storage
    render(
      <JSONImportValidator
        onNext={mockOnNext}
        onClearData={mockOnClearData}
      />
    )

    // Wait for storage to load and state to be restored
    await waitFor(() => {
      // Toggle button should appear (this was fixed previously)
      const toggleButton = screen.getByTestId('toggle-view-button')
      expect(toggleButton).toBeInTheDocument()
    })

    // Verify that the toggle button shows we're in tree view mode
    await waitFor(() => {
      const currentToggleButton = screen.getByTestId('toggle-view-button')
      console.log('Debug - Toggle button text after loading:', currentToggleButton.textContent)
      expect(currentToggleButton).toHaveTextContent('Show JSON Editor')
    })

    // The critical test: Tree view should show actual content, not fallback message
    await waitFor(() => {
      // Should NOT show the "data temporarily unavailable" message
      const unavailableMessage = screen.queryByText(/data is temporarily unavailable/)
      console.log('Debug - Unavailable message found:', !!unavailableMessage)
      expect(unavailableMessage).not.toBeInTheDocument()
    }, { timeout: 5000 })

    // Should show the actual tree structure from the loaded data
    await waitFor(() => {
      // Look for the specific tree view section heading
      const courseStructureHeading = screen.getAllByText(/Course Structure/i).find(el => 
        el.tagName === 'H2' || el.classList.contains('sectionTitle')
      )
      
      // The tree view section should be present and rendered
      expect(courseStructureHeading).toBeTruthy()
    }, { timeout: 5000 })
  })

  it('should preserve loaded validation result and not re-validate on mount', async () => {
    // This test ensures that loading from storage doesn't trigger unnecessary re-validation
    // which would clear the loaded validationResult

    const mockOnNext = vi.fn()

    render(
      <JSONImportValidator
        onNext={mockOnNext}
        onClearData={vi.fn()}
      />
    )

    // Wait for loading to complete
    await waitFor(() => {
      const toggleButton = screen.queryByTestId('toggle-view-button')
      expect(toggleButton).toBeInTheDocument()
    })

    // Verify that storage.getContent was called to load data
    expect(mockStorage.getContent).toHaveBeenCalledWith('json-import-data')

    // The Next button should be enabled (indicating validation result is preserved)
    const nextButton = screen.getByTestId('next-button')
    expect(nextButton).not.toHaveAttribute('disabled')

    // Tree view should be visible and functional
    const toggleButton = screen.getByTestId('toggle-view-button')
    expect(toggleButton).toHaveTextContent('Show JSON Editor') // In tree view mode
  })
})