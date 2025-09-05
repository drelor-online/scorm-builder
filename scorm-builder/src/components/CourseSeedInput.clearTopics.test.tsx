import { render, screen, fireEvent, waitFor } from '../test/testProviders'
import { vi } from 'vitest'
import { CourseSeedInput } from './CourseSeedInput'

// Mock window.confirm to track if it's being called
const mockWindowConfirm = vi.fn()
global.window.confirm = mockWindowConfirm

// Mock the ultra simple logger to prevent Tauri API errors
vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}))

// Mock the storage to prevent FileStorage errors
vi.mock('../contexts/PersistentStorageContext', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    useStorage: () => ({
      isInitialized: true,
      currentProjectId: 'test-project',
      getContent: vi.fn().mockResolvedValue(null),
      saveContent: vi.fn().mockResolvedValue(undefined),
      saveCourseSeedData: vi.fn().mockResolvedValue(undefined)
    })
  }
})

// Mock notifications
vi.mock('../contexts/NotificationContext', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    useNotifications: () => ({
      success: vi.fn(),
      info: vi.fn(),
      error: vi.fn()
    })
  }
})

describe('CourseSeedInput - Clear Topics Issues', () => {
  let mockOnSubmit: any
  let mockOnSave: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockWindowConfirm.mockReturnValue(true) // User confirms the action
    
    mockOnSubmit = vi.fn().mockResolvedValue(undefined)
    mockOnSave = vi.fn().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should actually clear topics data when Clear Topics button is clicked', async () => {
    // This test will initially FAIL (RED phase)
    // It reproduces the issue where the clear button doesn't clear the actual data

    const initialData = {
      template: 'None' as const,
      customTopics: ['Topic 1', 'Topic 2', 'Topic 3'],
      courseTitle: 'Test Course',
      difficulty: 3,
      templateTopics: []
    }

    render(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
        initialData={initialData}
      />
    )

    // Wait for component to be ready
    await waitFor(() => {
      const clearButton = screen.getByTestId('clear-topics-button')
      expect(clearButton).toBeInTheDocument()
    })

    // Verify initial topics are displayed (should show "Topic 1\nTopic 2\nTopic 3")
    // Find the topics textarea by data-testid or placeholder
    const topicsTextarea = screen.getByTestId('topics-textarea') || screen.getByPlaceholderText(/topics/i)
    expect(topicsTextarea).toHaveValue('Topic 1\nTopic 2\nTopic 3')

    // Click the Clear Topics button
    const clearButton = screen.getByTestId('clear-topics-button')
    fireEvent.click(clearButton)

    // Wait for the custom dialog to appear and click the confirm button
    await waitFor(() => {
      const confirmButton = screen.getByTestId('button-confirm')
      expect(confirmButton).toBeInTheDocument()
      fireEvent.click(confirmButton)
    })

    // Wait for the topics to be cleared and any autosave to happen
    await waitFor(() => {
      expect(topicsTextarea).toHaveValue('')
    }, { timeout: 3000 })

    // The critical test: onSave should be called with empty topics array
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        customTopics: [], // Should be empty array after clearing
        template: 'None',
        courseTitle: 'Test Course',
        difficulty: 3,
        templateTopics: []
      })
    )
  })

  it('should not use native window.confirm dialog', async () => {
    // This test verifies we should replace window.confirm with custom dialog
    // Currently this will FAIL because window.confirm is being used

    const initialData = {
      template: 'None' as const,
      customTopics: ['Topic 1'],
      courseTitle: 'Test Course', 
      difficulty: 3,
      templateTopics: []
    }

    render(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
        initialData={initialData}
      />
    )

    // Click the Clear Topics button
    const clearButton = screen.getByTestId('clear-topics-button')
    fireEvent.click(clearButton)

    // Should NOT call window.confirm (but currently it does)
    expect(mockWindowConfirm).not.toHaveBeenCalled()

    // Should show custom dialog instead (but currently doesn't exist)
    const customDialog = screen.queryByText(/Clear all topics?/)
    expect(customDialog).toBeInTheDocument()
  })

  it('should show custom confirmation dialog with proper styling', async () => {
    // This test verifies the custom dialog should appear
    // Currently this will FAIL because custom dialog doesn't exist

    const initialData = {
      template: 'None' as const,
      customTopics: ['Topic 1'],
      courseTitle: 'Test Course',
      difficulty: 3, 
      templateTopics: []
    }

    render(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
        initialData={initialData}
      />
    )

    // Click the Clear Topics button
    const clearButton = screen.getByTestId('clear-topics-button')
    fireEvent.click(clearButton)

    // Should show custom dialog with specific elements
    await waitFor(() => {
      expect(screen.getByText('Clear all topics? This cannot be undone.')).toBeInTheDocument() // Message
      expect(screen.getByTestId('button-confirm')).toBeInTheDocument() // Confirm button
      expect(screen.getByText('Cancel')).toBeInTheDocument() // Cancel button
    })
  })
})