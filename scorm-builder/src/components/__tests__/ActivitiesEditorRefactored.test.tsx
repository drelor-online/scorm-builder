import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActivitiesEditor } from '../ActivitiesEditorRefactored'
import { CourseContent } from '../../types/aiPrompt'

describe('ActivitiesEditor with Design System', () => {
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()
  const mockOnSettingsClick = vi.fn()
  const mockOnSave = vi.fn()
  const mockOnOpen = vi.fn()
  const mockOnHelp = vi.fn()

  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome content',
      narration: 'Welcome narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: 'Objectives content',
      narration: 'Objectives narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5
    },
    topics: [
      {
        id: 'topic1',
        title: 'Introduction to Design Systems',
        content: 'Topic 1 content',
        narration: 'Topic 1 narration',
        media: [],
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 10,
        knowledgeCheck: {
          questions: [
            {
              id: 'kc1',
              type: 'multiple-choice',
              question: 'What is a design system?',
              options: ['A', 'B', 'C', 'D'],
              correctAnswer: 'A'
            }
          ]
        }
      },
      {
        id: 'topic2',
        title: 'Component Architecture',
        content: 'Topic 2 content',
        narration: 'Topic 2 narration',
        media: [],
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 10
      }
    ],
    assessment: {
      questions: [
        {
          id: 'aq1',
          type: 'multiple-choice',
          question: 'What is the main benefit of a design system?',
          options: ['Consistency', 'Speed', 'Quality', 'All of the above'],
          correctAnswer: 'All of the above',
          feedback: {
            correct: 'Great job!',
            incorrect: 'Try again.'
          }
        },
        {
          id: 'aq2',
          type: 'true-false',
          question: 'Design systems are only for large teams.',
          correctAnswer: 'False',
          feedback: {
            correct: 'Correct!',
            incorrect: 'Not quite.'
          }
        }
      ],
      passMark: 80,
      narration: null
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses design system components for layout', () => {
    render(
      <ActivitiesEditor 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        onSettingsClick={mockOnSettingsClick}
        onSave={mockOnSave}
        onOpen={mockOnOpen}
        onHelp={mockOnHelp}
      />
    )

    // Check for Card components
    const cards = document.querySelectorAll('.card')
    expect(cards.length).toBeGreaterThan(0)
    
    // Check for Section components
    const sections = document.querySelectorAll('.section')
    expect(sections.length).toBeGreaterThan(0)
  })

  it('displays both knowledge check and assessment questions', () => {
    render(
      <ActivitiesEditor 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Should show knowledge check question
    expect(screen.getByText('What is a design system?')).toBeInTheDocument()
    
    // Should show assessment questions
    expect(screen.getByText('What is the main benefit of a design system?')).toBeInTheDocument()
    expect(screen.getByText('Design systems are only for large teams.')).toBeInTheDocument()
  })

  it('shows assessment section with proper heading', () => {
    render(
      <ActivitiesEditor 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Should have assessment section
    expect(screen.getByText('Assessment Questions')).toBeInTheDocument()
  })

  it('uses Button components with consistent styling', () => {
    render(
      <ActivitiesEditor 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Check edit buttons
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    editButtons.forEach(button => {
      expect(button).toHaveClass('btn')
    })
    
    // Check navigation buttons
    const backButton = screen.getByRole('button', { name: /back/i })
    expect(backButton).toHaveClass('btn', 'btn-secondary')
    
    const nextButton = screen.getByRole('button', { name: /next/i })
    expect(nextButton).toHaveClass('btn', 'btn-primary')
  })

  it('allows editing question text, options, and correct answer', async () => {
    render(
      <ActivitiesEditor 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Click edit on first knowledge check question
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    fireEvent.click(editButtons[0])

    // Modal should open
    await waitFor(() => {
      expect(screen.getByText('Edit Question')).toBeInTheDocument()
    })

    // Should have input for question text
    const questionInput = screen.getByLabelText(/question text/i)
    expect(questionInput).toHaveValue('What is a design system?')

    // Should have inputs for all options
    expect(screen.getByLabelText(/option 1/i)).toHaveValue('A')
    expect(screen.getByLabelText(/option 2/i)).toHaveValue('B')
    expect(screen.getByLabelText(/option 3/i)).toHaveValue('C')
    expect(screen.getByLabelText(/option 4/i)).toHaveValue('D')

    // Should have correct answer selector
    const correctAnswerSelect = screen.getByLabelText(/correct answer/i)
    expect(correctAnswerSelect).toHaveValue('A')
  })

  it('allows editing assessment questions', async () => {
    render(
      <ActivitiesEditor 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Find edit button for assessment question
    const assessmentSection = screen.getByText('What is the main benefit of a design system?')
      .closest('.card')
    const editButton = assessmentSection?.querySelector('button')
    expect(editButton).toBeTruthy()
    fireEvent.click(editButton!)

    // Modal should open
    await waitFor(() => {
      expect(screen.getByText('Edit Assessment Question')).toBeInTheDocument()
    })

    // Should have all editing fields including feedback
    expect(screen.getByLabelText(/question text/i)).toBeInTheDocument()
    expect(screen.getByText('Correct Feedback')).toBeInTheDocument()
    expect(screen.getByText('Incorrect Feedback')).toBeInTheDocument()
  })

  it('uses Alert component for statistics', () => {
    render(
      <ActivitiesEditor 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Should show statistics in alert components
    expect(screen.getByText(/Total Questions:/)).toBeInTheDocument()
    expect(screen.getByText(/Knowledge Check Questions:/)).toBeInTheDocument()
    expect(screen.getByText(/Assessment Questions:/)).toBeInTheDocument()
  })

  it('uses Grid layout for question lists', () => {
    const { container } = render(
      <ActivitiesEditor 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    const grids = container.querySelectorAll('.grid')
    expect(grids.length).toBeGreaterThan(0)
  })

  it('displays question types with badges', () => {
    render(
      <ActivitiesEditor 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Should show question type badges
    const multipleChoiceBadges = screen.getAllByText('Multiple Choice')
    expect(multipleChoiceBadges.length).toBeGreaterThan(0)
    
    const trueFalseBadges = screen.getAllByText('True/False')
    expect(trueFalseBadges.length).toBeGreaterThan(0)
  })

  it('shows correct answers with checkmarks', () => {
    render(
      <ActivitiesEditor 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Should show correct answer indicators for multiple choice questions
    // In our mock data, 'A' is correct for knowledge check and 'All of the above' for assessment
    const optionA = screen.getByText('A')
    expect(optionA).toBeInTheDocument()
    
    // Check for checkmark next to correct answer
    const correctAnswer = screen.getByText('All of the above')
    const checkmark = correctAnswer.parentElement?.querySelector('span')
    expect(checkmark?.textContent).toBe('✓')
  })

  it('saves all edited fields when saving a question', async () => {
    render(
      <ActivitiesEditor 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Click edit on first knowledge check question
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    fireEvent.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Edit Question')).toBeInTheDocument()
    })

    // Change question text
    const questionInput = screen.getByLabelText(/question text/i)
    fireEvent.change(questionInput, { target: { value: 'Updated question?' } })

    // Change an option
    const option2Input = screen.getByLabelText(/option 2/i)
    fireEvent.change(option2Input, { target: { value: 'Updated Option B' } })

    // Change correct answer
    const correctAnswerSelect = screen.getByLabelText(/correct answer/i)
    fireEvent.change(correctAnswerSelect, { target: { value: 'Updated Option B' } })

    // Save - get the save button within the modal
    const saveButtons = screen.getAllByRole('button', { name: /save/i })
    const modalSaveButton = saveButtons.find(btn => btn.classList.contains('btn-primary'))
    expect(modalSaveButton).toBeTruthy()
    fireEvent.click(modalSaveButton!)

    // Verify changes are reflected
    await waitFor(() => {
      expect(screen.getByText('Updated question?')).toBeInTheDocument()
      expect(screen.getByText('Updated Option B')).toBeInTheDocument()
    })
  })

  it('uses Modal component for edit dialogs', async () => {
    render(
      <ActivitiesEditor 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Click edit
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    fireEvent.click(editButtons[0])

    // Should use modal with proper overlay
    await waitFor(() => {
      const modal = document.querySelector('.modal')
      expect(modal).toBeInTheDocument()
      
      const overlay = document.querySelector('.modal-overlay')
      expect(overlay).toBeInTheDocument()
    })
  })

  it('handles true/false questions properly', async () => {
    render(
      <ActivitiesEditor 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Find true/false question
    const tfQuestion = screen.getByText('Design systems are only for large teams.')
    const cardElement = tfQuestion.closest('.card')
    const editButton = cardElement?.querySelector('button.btn-primary')
    expect(editButton).toBeTruthy()
    fireEvent.click(editButton!)

    await waitFor(() => {
      // Should show True/False options
      const trueOption = screen.getByRole('radio', { name: /true/i })
      const falseOption = screen.getByRole('radio', { name: /false/i })
      expect(trueOption).toBeInTheDocument()
      expect(falseOption).toBeInTheDocument()
    })
  })
})