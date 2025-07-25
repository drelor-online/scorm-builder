import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CourseSeedInput } from '../CourseSeedInputRefactored'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import type { CourseSeedData } from '../../types/course'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    setTitle: vi.fn()
  }))
}))

// Mock FileStorage
vi.mock('../../services/FileStorage', () => ({
  fileStorage: {
    isInitialized: true,
    currentProjectId: 'test-project',
    initialize: vi.fn(),
    createProject: vi.fn(),
    saveProject: vi.fn(),
    getContent: vi.fn(),
    saveContent: vi.fn(),
    getCourseMetadata: vi.fn(),
    saveCourseMetadata: vi.fn(),
    addStateChangeListener: vi.fn(() => () => {})
  }
}))

/**
 * Behavior-Driven Tests for CourseSeedInput Component
 * 
 * These tests follow TDD principles by:
 * 1. Testing user behavior, not implementation details
 * 2. Using descriptive test names that explain the expected behavior
 * 3. Avoiding testing internal state or component structure
 * 4. Focusing on what users see and do
 */

describe('CourseSeedInput - User Behavior', () => {
  const mockHandlers = {
    onSubmit: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onOpen: vi.fn(),
    onSettingsClick: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn()
  }

  // Helper to render with required providers
  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <PersistentStorageProvider>
        <StepNavigationProvider initialStep={0}>
          {ui}
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('When a teacher starts creating a new course', () => {
    it('shows an empty form ready for input', () => {
      renderWithProviders(<CourseSeedInput {...mockHandlers} />)
      
      // Teacher sees the course configuration page
      expect(screen.getByText('Course Configuration')).toBeInTheDocument()
      
      // Form starts empty
      const titleInput = screen.getByPlaceholderText(/enter your course title/i)
      expect(titleInput).toHaveValue('')
      
      // Default difficulty is intermediate (3)
      const intermediateButton = screen.getByTestId('difficulty-3')
      expect(intermediateButton).toHaveClass('active')
      
      // No template is selected by default
      const templateSelect = screen.getByLabelText(/course template/i)
      expect(templateSelect).toHaveValue('None')
    })

    it('provides helpful placeholder text and labels', () => {
      renderWithProviders(<CourseSeedInput {...mockHandlers} />)
      
      // Helpful placeholders guide the teacher
      expect(screen.getByPlaceholderText(/enter your course title/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/list your course topics/i)).toBeInTheDocument()
      
      // Clear labels explain each field
      expect(screen.getByText(/course title/i)).toBeInTheDocument()
      expect(screen.getByText(/difficulty level/i)).toBeInTheDocument()
      expect(screen.getByText(/course template/i)).toBeInTheDocument()
    })
  })

  describe('When a teacher fills out the course form', () => {
    it('validates the course title is required', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CourseSeedInput {...mockHandlers} />)
      
      // Teacher focuses on title input and then leaves without entering anything
      const titleInput = screen.getByPlaceholderText(/enter your course title/i)
      await user.click(titleInput)
      await user.tab() // Move focus away to trigger blur
      
      // Should show error message
      expect(screen.getByText('Course title is required')).toBeInTheDocument()
      
      // Next button should be disabled
      const continueButton = screen.getByRole('button', { name: /next/i })
      expect(continueButton).toBeDisabled()
      
      // Should not proceed to next step
      expect(mockHandlers.onSubmit).not.toHaveBeenCalled()
    })

    it('allows setting course difficulty intuitively', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CourseSeedInput {...mockHandlers} />)
      
      // Teacher sees difficulty options with clear labels
      expect(screen.getByText('Basic')).toBeInTheDocument()
      expect(screen.getByText('Medium')).toBeInTheDocument()
      expect(screen.getByText('Expert')).toBeInTheDocument()
      
      // Teacher selects Expert level
      const expertButton = screen.getByTestId('difficulty-5')
      await user.click(expertButton)
      
      // Visual feedback shows selection
      expect(expertButton).toHaveClass('active')
    })

    it('supports both custom topics and templates', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CourseSeedInput {...mockHandlers} />)
      
      // Teacher can enter custom topics
      const topicsInput = screen.getByPlaceholderText(/list your course topics/i)
      await user.type(topicsInput, 'Introduction to React\nComponent State\nHooks and Effects')
      
      // Topics are displayed as entered
      expect(topicsInput).toHaveValue('Introduction to React\nComponent State\nHooks and Effects')
      
      // Teacher can also choose a template
      const templateSelect = screen.getByLabelText(/course template/i)
      await user.selectOptions(templateSelect, 'Technical')
      
      // Template is selected
      expect(templateSelect).toHaveValue('Technical')
    })

    it('can add template topics when a template is selected', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CourseSeedInput {...mockHandlers} />)
      
      // Teacher selects Safety template
      const templateSelect = screen.getByLabelText(/course template/i)
      await user.selectOptions(templateSelect, 'Safety')
      
      // Add Template Topics button appears
      const addTemplateButton = screen.getByText(/add template topics/i)
      expect(addTemplateButton).toBeInTheDocument()
      
      // Teacher clicks to add template topics
      await user.click(addTemplateButton)
      
      // Topics input should now contain Safety template topics
      const topicsInput = screen.getByPlaceholderText(/list your course topics/i)
      await waitFor(() => {
        expect(topicsInput.value).toContain('Safety Fundamentals')
      })
    })
  })

  describe('When a teacher completes the form', () => {
    it('submits all course data correctly', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CourseSeedInput {...mockHandlers} />)
      
      // Teacher fills out the form completely
      await user.type(
        screen.getByPlaceholderText(/enter your course title/i),
        'Advanced TypeScript Patterns'
      )
      
      // Select expert difficulty
      await user.click(screen.getByTestId('difficulty-5'))
      
      // Add custom topics
      await user.type(
        screen.getByPlaceholderText(/list your course topics/i),
        'Generics\nDecorators\nType Guards'
      )
      
      // Continue to next step
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      // Form data is submitted correctly
      expect(mockHandlers.onSubmit).toHaveBeenCalledWith({
        courseTitle: 'Advanced TypeScript Patterns',
        difficulty: 5,
        customTopics: ['Generics', 'Decorators', 'Type Guards'],
        template: 'None',
        templateTopics: []
      })
    })

    it('uses selected template when submitting', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CourseSeedInput {...mockHandlers} />)
      
      // Teacher enters title
      await user.type(
        screen.getByPlaceholderText(/enter your course title/i),
        'Safety Training Course'
      )
      
      // Select Safety template
      const templateSelect = screen.getByLabelText(/course template/i)
      await user.selectOptions(templateSelect, 'Safety')
      
      // Add custom topics
      await user.type(
        screen.getByPlaceholderText(/list your course topics/i),
        'Site-Specific Hazards\nLocal Emergency Contacts'
      )
      
      // Submit form
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      // Template is included in submission
      expect(mockHandlers.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          courseTitle: 'Safety Training Course',
          template: 'Safety',
          customTopics: ['Site-Specific Hazards', 'Local Emergency Contacts'],
          templateTopics: []
        })
      )
    })
  })

  describe('When a teacher returns to edit existing course data', () => {
    it('displays all previously entered information', () => {
      const existingData: CourseSeedData = {
        courseTitle: 'Existing Course',
        difficulty: 4,
        customTopics: ['Topic A', 'Topic B'],
        template: 'Technical',
        templateTopics: ['Technical Topic 1', 'Technical Topic 2']
      }
      
      renderWithProviders(<CourseSeedInput {...mockHandlers} initialData={existingData} />)
      
      // All data is restored
      expect(screen.getByPlaceholderText(/enter your course title/i)).toHaveValue('Existing Course')
      expect(screen.getByTestId('difficulty-4')).toHaveClass('active')
      expect(screen.getByPlaceholderText(/list your course topics/i)).toHaveValue('Topic A\nTopic B')
      expect(screen.getByLabelText(/course template/i)).toHaveValue('Technical')
    })

    it('allows modifying and resubmitting course data', async () => {
      const user = userEvent.setup()
      const existingData: CourseSeedData = {
        courseTitle: 'Original Title',
        difficulty: 3,
        customTopics: ['Topic 1', 'Topic 2'],
        template: 'None',
        templateTopics: []
      }
      
      renderWithProviders(<CourseSeedInput {...mockHandlers} initialData={existingData} />)
      
      // Teacher updates the title
      const titleInput = screen.getByPlaceholderText(/enter your course title/i)
      await user.clear(titleInput)
      await user.type(titleInput, 'Updated Course Title')
      
      // Submit updated data
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      // Updated data is submitted
      expect(mockHandlers.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          courseTitle: 'Updated Course Title',
          difficulty: 3
        })
      )
    })
  })

  describe('When a teacher uses keyboard navigation', () => {
    // TODO: Implement proper keyboard navigation support
    it.skip('supports tab navigation through form fields', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CourseSeedInput {...mockHandlers} />)
      
      // Start at title input
      const titleInput = screen.getByPlaceholderText(/enter your course title/i)
      titleInput.focus()
      expect(document.activeElement).toBe(titleInput)
      
      // Tab to difficulty buttons
      await user.tab()
      expect(document.activeElement?.getAttribute('data-testid')).toMatch(/difficulty-\d/)
      
      // Tab through difficulty options
      await user.tab()
      await user.tab()
      await user.tab()
      await user.tab()
      await user.tab()
      
      // Tab to template select
      await user.tab()
      expect(document.activeElement?.tagName).toBe('SELECT')
    })

    it.skip('allows selecting options with keyboard', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CourseSeedInput {...mockHandlers} />)
      
      // Navigate to difficulty
      const titleInput = screen.getByPlaceholderText(/enter your course title/i)
      titleInput.focus()
      await user.tab()
      
      // Use arrow keys to select different difficulty
      await user.keyboard('{ArrowRight}')
      await user.keyboard('{Space}')
      
      // Difficulty should be updated
      expect(screen.getByTestId('difficulty-2')).toHaveClass('active')
    })
  })

  describe('When a teacher needs help', () => {
    it('shows helpful descriptions for form fields', () => {
      renderWithProviders(<CourseSeedInput {...mockHandlers} />)
      
      // Help text is visible for difficulty
      expect(screen.getByText(/select the complexity level for your learners/i)).toBeInTheDocument()
      
      // Helper text for course title
      expect(screen.getByText(/enter a descriptive title for your course/i)).toBeInTheDocument()
    })

    it('provides access to help documentation', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CourseSeedInput {...mockHandlers} />)
      
      // Help button is available
      const helpButton = screen.getByRole('button', { name: /help/i })
      await user.click(helpButton)
      
      // Help handler is called
      expect(mockHandlers.onHelp).toHaveBeenCalled()
    })
  })

  describe('When a teacher saves their progress', () => {
    // TODO: Fix save button selection in test
    it.skip('allows saving at any time during form completion', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CourseSeedInput {...mockHandlers} />)
      
      // Teacher enters partial data
      await user.type(
        screen.getByPlaceholderText(/enter your course title/i),
        'Work in Progress'
      )
      
      // Save button is always available
      const saveButton = screen.getByRole('button', { name: /save project/i })
      await user.click(saveButton)
      
      // Save handler is called with current form data
      expect(mockHandlers.onSave).toHaveBeenCalledWith({
        courseTitle: 'Work in Progress',
        difficulty: 3, // default
        customTopics: [],
        template: 'None',
        templateTopics: []
      })
    })

    // TODO: Implement save confirmation feedback
    it.skip('shows save confirmation feedback', async () => {
      const user = userEvent.setup()
      mockHandlers.onSave.mockResolvedValueOnce({ success: true })
      
      renderWithProviders(<CourseSeedInput {...mockHandlers} />)
      
      // Teacher saves
      await user.click(screen.getByRole('button', { name: /save/i }))
      
      // Feedback is shown
      await waitFor(() => {
        expect(screen.getByText(/saved successfully/i)).toBeInTheDocument()
      })
    })
  })
})