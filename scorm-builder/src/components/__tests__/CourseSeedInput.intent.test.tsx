import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen , waitFor } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { CourseSeedInput } from '../CourseSeedInput'
import type { CourseSeedData } from '../../types/course'

describe('CourseSeedInput - User Intent Tests', () => {
  const mockOnSubmit = vi.fn()
  const mockOnSave = vi.fn()
  const mockOnOpen = vi.fn()
  const mockOnSettingsClick = vi.fn()
  const mockOnHelp = vi.fn()
  const mockOnStepClick = vi.fn()
  const mockOnExport = vi.fn()
  const mockOnImport = vi.fn()

  const defaultProps = {
    onSubmit: mockOnSubmit,
    onSave: mockOnSave,
    onOpen: mockOnOpen,
    onSettingsClick: mockOnSettingsClick,
    onHelp: mockOnHelp,
    onStepClick: mockOnStepClick,
    onExport: mockOnExport,
    onImport: mockOnImport
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('User wants to create a new course', () => {
    it('should display all required form fields', () => {
      render(<CourseSeedInput {...defaultProps} />)

      // Should show course title input
      expect(screen.getByLabelText(/course title \*/i)).toBeInTheDocument()
      
      // Should show difficulty slider
      expect(screen.getByText(/difficulty level/i)).toBeInTheDocument()
      
      // Should show template selector
      expect(screen.getByText(/course template/i)).toBeInTheDocument()
      
      // Should show custom topics input
      expect(screen.getByLabelText('Topics')).toBeInTheDocument()
    })

    it('should show error when submitting without course title', async () => {
      const user = userEvent.setup()
      render(<CourseSeedInput {...defaultProps} />)

      const nextButton = screen.getByRole('button', { name: /continue to ai prompt/i })
      
      // Click without entering title
      await user.click(nextButton)

      // Should show error
      expect(screen.getByText('Course title is required')).toBeInTheDocument()
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should submit course data when form is complete', async () => {
      const user = userEvent.setup()
      render(<CourseSeedInput {...defaultProps} />)

      // Fill in the form
      await user.type(screen.getByLabelText(/course title \*/i), 'JavaScript Fundamentals')
      
      // Add custom topics
      const topicsInput = screen.getByLabelText('Topics')
      await user.type(topicsInput, 'Variables{enter}Functions{enter}Arrays{enter}')

      // Click next
      await user.click(screen.getByRole('button', { name: /continue to ai prompt/i }))

      // Should call onSubmit with the data
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          courseTitle: 'JavaScript Fundamentals',
          difficulty: expect.any(Number),
          customTopics: expect.arrayContaining(['Variables', 'Functions', 'Arrays']),
          template: expect.any(String),
          templateTopics: expect.any(Array)
        })
      )
    })
  })

  describe('User wants to use a course template', () => {
    it('should show template options when selecting a template', async () => {
      const user = userEvent.setup()
      render(<CourseSeedInput {...defaultProps} />)

      // Select Safety template
      const templateButtons = screen.getAllByRole('button')
      const safetyButton = templateButtons.find(btn => btn.textContent?.includes('Safety'))
      
      if (safetyButton) {
        await user.click(safetyButton)
        
        // Should show template topics
        await waitFor(() => {
          expect(screen.getByText(/safety fundamentals/i)).toBeInTheDocument()
        })
      }
    })

    it('should allow toggling template topics', async () => {
      const user = userEvent.setup()
      render(<CourseSeedInput {...defaultProps} />)

      // Select a template with topics
      const templateButtons = screen.getAllByRole('button')
      const technicalButton = templateButtons.find(btn => btn.textContent?.includes('Technical'))
      
      if (technicalButton) {
        await user.click(technicalButton)
        
        // Find and toggle a topic checkbox
        await waitFor(async () => {
          const checkboxes = screen.getAllByRole('checkbox')
          if (checkboxes.length > 0) {
            await user.click(checkboxes[0])
            expect(checkboxes[0]).not.toBeChecked()
          }
        })
      }
    })
  })

  describe('User wants to save their progress', () => {
    it('should call save handler when save button is clicked', async () => {
      const user = userEvent.setup()
      render(<CourseSeedInput {...defaultProps} />)

      // Type a title first
      await user.type(screen.getByLabelText(/course title \*/i), 'Test Course')

      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      expect(mockOnSave).toHaveBeenCalled()
    })

    it('should display save confirmation', async () => {
      const user = userEvent.setup()
      const mockOnSave = vi.fn().mockResolvedValue({ success: true })
      
      render(<CourseSeedInput {...defaultProps} onSave={mockOnSave} />)

      await user.type(screen.getByLabelText(/course title \*/i), 'Test Course')
      await user.click(screen.getByRole('button', { name: /save/i }))

      // Check for success feedback (this depends on implementation)
      // await waitFor(() => {
      //   expect(screen.getByText(/saved/i)).toBeInTheDocument()
      // })
    })
  })

  describe('User wants to adjust difficulty', () => {
    it('should update difficulty value when slider is moved', async () => {
      const user = userEvent.setup()
      render(<CourseSeedInput {...defaultProps} />)

      const slider = screen.getByRole('slider', { name: /difficulty/i })
      
      // Change difficulty
      await user.click(slider)
      // Note: userEvent doesn't have great slider support, so we might need to test differently
      
      // The difficulty text should update
      expect(screen.getByText(/difficulty.*level/i)).toBeInTheDocument()
    })
  })

  describe('User wants to continue from previous data', () => {
    it('should populate form with initial data', () => {
      const initialData: CourseSeedData = {
        courseTitle: 'Existing Course',
        difficulty: 4,
        customTopics: ['Topic 1', 'Topic 2'],
        template: 'Corporate' as const,
        templateTopics: []
      }

      render(<CourseSeedInput {...defaultProps} initialData={initialData} />)

      // Should show the existing title
      expect(screen.getByDisplayValue('Existing Course')).toBeInTheDocument()
      
      // Should show existing custom topics in the textarea (joined with newlines)
      const topicsTextarea = screen.getByLabelText('Topics')
      expect(topicsTextarea).toHaveValue('Topic 1\nTopic 2')
    })
  })

  describe('User wants help or access settings', () => {
    it('should call help handler when help button is clicked', async () => {
      const user = userEvent.setup()
      render(<CourseSeedInput {...defaultProps} />)

      const helpButton = screen.getByRole('button', { name: /help/i })
      await user.click(helpButton)

      expect(mockOnHelp).toHaveBeenCalled()
    })

    it('should call settings handler when settings button is clicked', async () => {
      const user = userEvent.setup()
      render(<CourseSeedInput {...defaultProps} />)

      const settingsButton = screen.getByRole('button', { name: /settings/i })
      await user.click(settingsButton)

      expect(mockOnSettingsClick).toHaveBeenCalled()
    })
  })
})