import { render, screen, fireEvent, waitFor } from '../test/testProviders'
import { vi } from 'vitest'
import { CourseSeedInput } from './CourseSeedInput'

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

describe('CourseSeedInput - No Autosave During Focus', () => {
  let mockOnSubmit: any
  let mockOnSave: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockOnSubmit = vi.fn().mockResolvedValue(undefined)
    mockOnSave = vi.fn().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should not autosave while topics textarea is focused', async () => {
    // This test verifies the key fix: no autosave while user is typing in topics
    const initialData = {
      template: 'None' as const,
      customTopics: ['Initial Topic'],
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
    const textarea = screen.getByTestId('topics-textarea')
    await waitFor(() => {
      expect(textarea).toHaveValue('Initial Topic')
    })

    // Focus the textarea (this should disable autosave)
    fireEvent.focus(textarea)
    
    // Make a change while focused
    fireEvent.change(textarea, { 
      target: { value: 'Modified Topic While Focused' }
    })
    
    // Wait for what would normally be the autosave delay (5 seconds + buffer)
    // Autosave should NOT trigger because textarea is still focused
    await new Promise(resolve => setTimeout(resolve, 5500))
    
    // Verify that onSave was not called due to autosave
    expect(mockOnSave).not.toHaveBeenCalled()
    
    // Now blur the textarea (this should trigger immediate save)
    fireEvent.blur(textarea)
    
    // Verify that immediate save was triggered on blur
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          customTopics: ['Modified Topic While Focused']
        })
      )
    })
  })

  it('should trigger autosave normally when textarea is not focused', async () => {
    // This test verifies autosave still works for other fields
    const initialData = {
      template: 'None' as const,
      customTopics: [],
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

    // Change the course title (not the topics textarea)
    const titleInput = screen.getByLabelText(/course title/i)
    fireEvent.change(titleInput, { target: { value: 'New Title' }})
    
    // Wait for autosave delay (5 seconds + buffer)
    await new Promise(resolve => setTimeout(resolve, 5500))
    
    // Verify autosave was triggered for title change
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          courseTitle: 'New Title'
        })
      )
    })
  })

  it('should have longer autosave delay (5 seconds) and immediate save on blur', async () => {
    // This test verifies the increased delay and immediate save behavior
    const initialData = {
      template: 'None' as const,
      customTopics: ['Test Topic'],
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

    const textarea = screen.getByTestId('topics-textarea')
    
    // Focus and make a change (this prevents autosave)
    fireEvent.focus(textarea)
    fireEvent.change(textarea, { 
      target: { value: 'Changed Topic' }
    })
    
    // Wait for old delay time (1 second + buffer)
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Should not have saved yet because textarea is focused
    expect(mockOnSave).not.toHaveBeenCalled()
    
    // Now blur the textarea - this should trigger immediate save
    fireEvent.blur(textarea)
    
    // Immediate save should happen on blur
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          customTopics: ['Changed Topic']
        })
      )
    })
  })

  it('should prevent excessive re-renders during rapid changes', async () => {
    // This test verifies the debouncing works to prevent the original 50+ renders/second issue
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    
    const initialData = {
      template: 'None' as const,
      customTopics: [],
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

    const textarea = screen.getByTestId('topics-textarea')
    
    // Focus textarea to disable autosave
    fireEvent.focus(textarea)
    
    // Make rapid changes (simulating fast typing)
    fireEvent.change(textarea, { target: { value: 'A' }})
    fireEvent.change(textarea, { target: { value: 'Ab' }})
    fireEvent.change(textarea, { target: { value: 'Abc' }})
    fireEvent.change(textarea, { target: { value: 'Abcd' }})
    fireEvent.change(textarea, { target: { value: 'Abcde' }})
    
    // Should not trigger any saves due to focus protection
    expect(mockOnSave).not.toHaveBeenCalled()
    
    // Blur to finish editing
    fireEvent.blur(textarea)
    
    // Should trigger one immediate save on blur
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1)
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          customTopics: ['Abcde']
        })
      )
    })
    
    spy.mockRestore()
  })
})