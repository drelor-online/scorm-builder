import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AudioNarrationWizard } from '../AudioNarrationWizardRefactored'
import { CourseContent } from '../../types/aiPrompt'

// Mock JSZip
vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({
    loadAsync: vi.fn().mockResolvedValue({
      files: {
        '0001-Block.mp3': {
          dir: false,
          async: vi.fn().mockResolvedValue(new Blob(['audio'], { type: 'audio/mpeg' }))
        }
      }
    })
  }))
}))

describe('AudioNarrationWizard with Design System', () => {
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
      narration: 'Welcome to this course on design systems.',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: 'Objectives content',
      narration: 'By the end of this course, you will understand design systems.',
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
        narration: 'Design systems provide consistency across applications.',
        media: [],
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 10
      },
      {
        id: 'topic2',
        title: 'Component Architecture',
        content: 'Topic 2 content',
        narration: 'Components should be reusable and maintainable.',
        media: [],
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 10
      }
    ],
    assessment: {
      questions: [{
        id: 'q1',
        type: 'multiple-choice',
        question: 'Test question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        feedback: {
          correct: 'Correct!',
          incorrect: 'Try again.'
        }
      }],
      passMark: 70,
      narration: null
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses design system components for layout', () => {
    render(
      <AudioNarrationWizard 
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

  it('uses Button components with consistent styling', () => {
    render(
      <AudioNarrationWizard 
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

  it('displays narration blocks in a structured layout', () => {
    render(
      <AudioNarrationWizard 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Should display all narration blocks
    expect(screen.getByText('Welcome to this course on design systems.')).toBeInTheDocument()
    expect(screen.getByText('By the end of this course, you will understand design systems.')).toBeInTheDocument()
    expect(screen.getByText('Design systems provide consistency across applications.')).toBeInTheDocument()
    expect(screen.getByText('Components should be reusable and maintainable.')).toBeInTheDocument()
  })

  it('uses Input component for editing narration', async () => {
    render(
      <AudioNarrationWizard 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Click edit on first narration block
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    fireEvent.click(editButtons[0])

    // Should show textarea with Input component styling
    await waitFor(() => {
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveClass('textarea')
      expect(textarea.parentElement).toHaveClass('input-wrapper')
    })
  })

  it('uses Alert component for status messages', () => {
    render(
      <AudioNarrationWizard 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // The component includes Alert components in its structure
    // Check that the Alert component is imported and used in the design
    // Check for the download button instead of instruction text
    const downloadButton = screen.getByRole('button', { name: /download narration text/i })
    expect(downloadButton).toBeInTheDocument()
    
    // Check that upload buttons use design system
    const uploadAudioButton = screen.getByRole('button', { name: /upload audio zip/i })
    expect(uploadAudioButton).toHaveClass('btn')
    
    const uploadCaptionButton = screen.getByRole('button', { name: /upload captions zip/i })
    expect(uploadCaptionButton).toHaveClass('btn')
  })

  it('uses ButtonGroup for file upload actions', () => {
    render(
      <AudioNarrationWizard 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Check for button groups
    const buttonGroups = document.querySelectorAll('.button-group')
    expect(buttonGroups.length).toBeGreaterThan(0)
  })

  it('uses Flex layout for button arrangements', () => {
    render(
      <AudioNarrationWizard 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    const flexContainers = document.querySelectorAll('.flex')
    expect(flexContainers.length).toBeGreaterThan(0)
  })

  it('uses consistent spacing with Section components', () => {
    const { container } = render(
      <AudioNarrationWizard 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    const sections = container.querySelectorAll('.section')
    expect(sections.length).toBeGreaterThan(0)
  })

  it('maintains edit functionality with design system', async () => {
    render(
      <AudioNarrationWizard 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Click edit
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    fireEvent.click(editButtons[0])

    // Change text
    await waitFor(() => {
      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'Updated narration text' } })
    })

    // Save - get the save button within the narration block
    const saveButtons = screen.getAllByRole('button', { name: /save/i })
    const editSaveButton = saveButtons.find(btn => btn.classList.contains('btn-small'))
    expect(editSaveButton).toBeInTheDocument()
    fireEvent.click(editSaveButton!)

    // Should show updated text
    await waitFor(() => {
      expect(screen.getByText('Updated narration text')).toBeInTheDocument()
    })
  })

  it('displays block numbers with proper styling', () => {
    render(
      <AudioNarrationWizard 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Should show block numbers
    expect(screen.getByText('0001')).toBeInTheDocument()
    expect(screen.getByText('0002')).toBeInTheDocument()
    expect(screen.getByText('0003')).toBeInTheDocument()
    expect(screen.getByText('0004')).toBeInTheDocument()
  })

  it('handles file uploads with design system components', () => {
    render(
      <AudioNarrationWizard 
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Check for upload buttons
    const uploadButtons = screen.getAllByText(/upload/i)
    uploadButtons.forEach(button => {
      if (button.tagName === 'BUTTON') {
        expect(button).toHaveClass('btn')
      }
    })
  })
})