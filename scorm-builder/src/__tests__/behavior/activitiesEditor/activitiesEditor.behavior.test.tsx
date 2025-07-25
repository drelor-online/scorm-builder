import React from 'react'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActivitiesEditor } from '../../../components/ActivitiesEditorRefactored'
import { CourseContent } from '../../../types/aiPrompt'
import { CourseSeedData } from '../../../types/course'

// Mock dependencies
vi.mock('../../../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    isInitialized: true,
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    storageService: {
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined)
    }
  })
}))

vi.mock('../../../hooks/useStepData', () => ({
  useStepData: () => ({
    getStepData: vi.fn().mockReturnValue({
      courseContent: null,
      assessment: {
        questions: []
      }
    }),
    updateStepData: vi.fn().mockResolvedValue(undefined)
  })
}))

// Mock components
vi.mock('../../../components/CoursePreview', () => ({
  CoursePreview: () => <div data-testid="course-preview">Course Preview</div>
}))

vi.mock('../../../components/PageLayout', () => ({
  PageLayout: ({ children, title, description, onNext, coursePreview }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
      {coursePreview}
      <button onClick={onNext}>Next</button>
    </div>
  )
}))

vi.mock('../../../components/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen, title, message, onConfirm, onCancel }: any) => 
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <p>{message}</p>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null
}))

// Mock the design system components
vi.mock('../../../components/DesignSystem', () => ({
  Button: ({ children, onClick, disabled, icon, variant, size }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size}>
      {icon && <span>{icon}</span>}
      {children}
    </button>
  ),
  Card: ({ children, title }: any) => (
    <div data-testid="card">
      {title && <h3>{title}</h3>}
      {children}
    </div>
  ),
  Input: ({ label, value, onChange, placeholder, type, multiline, rows, fullWidth }: any) => (
    <div>
      {label && <label>{label}</label>}
      {multiline ? (
        <textarea 
          value={value || ''} 
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          aria-label={label}
        />
      ) : (
        <input 
          value={value || ''} 
          onChange={onChange}
          placeholder={placeholder}
          type={type}
          aria-label={label}
        />
      )}
    </div>
  ),
  ButtonGroup: ({ children }: any) => <div data-testid="button-group">{children}</div>,
  Section: ({ children }: any) => <section>{children}</section>,
  Grid: ({ children }: any) => <div data-testid="grid">{children}</div>,
  Flex: ({ children, justify, align }: any) => <div data-testid="flex" style={{ display: 'flex', justifyContent: justify, alignItems: align }}>{children}</div>,
  Modal: ({ isOpen, onClose, title, children }: any) => 
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <div>
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Close">×</button>
        </div>
        <div>{children}</div>
      </div>
    ) : null,
  Alert: ({ type, children }: any) => (
    <div className={`alert alert-${type}`} role="alert" data-type={type}>{children}</div>
  )
}))

describe('Activities Editor Page Behavior', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome to Test Course',
      content: '<h1>Welcome</h1>',
      narration: 'Welcome narration'
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<ul><li>Objective 1</li></ul>',
      narration: 'Objectives narration'
    },
    topics: [
      {
        id: 'topic1',
        title: 'Topic 1',
        content: '<p>Content 1</p>',
        narration: 'Topic 1 narration',
        knowledgeCheck: {
          questions: [
            {
              id: 'kc1',
              type: 'multiple-choice',
              question: 'What is topic 1 about?',
              options: ['Option A', 'Option B', 'Option C'],
              correctAnswer: 'Option A',
              feedback: {
                correct: 'Great job!',
                incorrect: 'Try again.'
              }
            }
          ]
        }
      },
      {
        id: 'topic2',
        title: 'Topic 2',
        content: '<p>Content 2</p>',
        narration: 'Topic 2 narration'
      }
    ],
    assessment: {
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice',
          question: 'What is 2 + 2?',
          options: ['3', '4', '5', '6'],
          correctAnswer: '4',
          feedback: {
            correct: 'Correct!',
            incorrect: 'Try again.'
          }
        }
      ]
    }
  }

  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    template: 'None',
    customTopics: ['Topic 1', 'Topic 2'],
    templateTopics: []
  }

  const mockHandlers = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSettingsClick: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onOpen: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display summary statistics', () => {
    render(
      <ActivitiesEditor
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Should show summary statistics
    expect(screen.getByText('Summary Statistics')).toBeInTheDocument()
    expect(screen.getByText(/Total Questions:/)).toBeInTheDocument()
    expect(screen.getByText(/Knowledge Check Questions:/)).toBeInTheDocument()
    expect(screen.getByText(/Assessment Questions:/)).toBeInTheDocument()
  })

  it('should display knowledge check questions by topic', () => {
    render(
      <ActivitiesEditor
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Should show Knowledge Check Questions section
    expect(screen.getByText('Knowledge Check Questions')).toBeInTheDocument()
    
    // Should show topics
    expect(screen.getByText('Topic 1')).toBeInTheDocument()
    expect(screen.getByText('Topic 2')).toBeInTheDocument()
    
    // Should show the knowledge check question for topic 1
    expect(screen.getByText('What is topic 1 about?')).toBeInTheDocument()
    
    // Should show "No knowledge check questions" for topic 2
    expect(screen.getByText(/No knowledge check questions/)).toBeInTheDocument()
  })

  it('should display assessment questions', () => {
    render(
      <ActivitiesEditor
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Should show Assessment Questions section
    expect(screen.getByText('Assessment Questions')).toBeInTheDocument()
    
    // Should show the assessment question
    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument()
    
    // Should show question type badge - getAllByText since there might be multiple
    const badges = screen.getAllByText('Multiple Choice')
    expect(badges.length).toBeGreaterThan(0)
    
    // Should show edit button for assessment question
    const assessmentSection = screen.getByText('Assessment Questions').closest('section')
    const editButton = within(assessmentSection!).getByRole('button', { name: /edit/i })
    expect(editButton).toBeInTheDocument()
  })

  it('should allow editing a knowledge check question', async () => {
    const user = userEvent.setup()
    
    render(
      <ActivitiesEditor
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Find and click the edit button for the knowledge check question
    const kcSection = screen.getByText('Knowledge Check Questions').closest('section')
    const editButtons = within(kcSection!).getAllByRole('button', { name: /edit/i })
    await user.click(editButtons[0]) // First edit button should be for the knowledge check question
    
    // Should open modal - look for the Edit Question heading (for knowledge check)
    await waitFor(() => {
      expect(screen.getByText('Edit Question')).toBeInTheDocument()
    })
    
    // Should show the question text in an input
    const questionInput = screen.getAllByRole('textbox')[0] // First textbox should be the question
    expect(questionInput).toHaveValue('What is topic 1 about?')
    
    // Modal should have save and cancel buttons
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    
    // Click cancel to close modal
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    
    // Modal should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('should allow editing an assessment question', async () => {
    const user = userEvent.setup()
    
    render(
      <ActivitiesEditor
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Find and click the edit button for the assessment question
    const assessmentSection = screen.getByText('Assessment Questions').closest('section')
    const editButton = within(assessmentSection!).getByRole('button', { name: /edit/i })
    await user.click(editButton)
    
    // Should open modal - look for the Edit Assessment Question heading
    await waitFor(() => {
      expect(screen.getByText('Edit Assessment Question')).toBeInTheDocument()
    })
    
    // Should show the question text - first textbox should be the question
    const questionInput = screen.getAllByRole('textbox')[0]
    expect(questionInput).toHaveValue('What is 2 + 2?')
    
    // Modal should have save and cancel buttons
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    
    // Click cancel to close modal
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    
    // Modal should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('should show correct feedback fields when editing', async () => {
    const user = userEvent.setup()
    
    render(
      <ActivitiesEditor
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Edit an assessment question
    const assessmentSection = screen.getByText('Assessment Questions').closest('section')
    const editButton = within(assessmentSection!).getByRole('button', { name: /edit/i })
    await user.click(editButton)
    
    // Should open modal - the title will be Edit Assessment Question
    await waitFor(() => {
      expect(screen.getByText('Edit Assessment Question')).toBeInTheDocument()
    })
    
    // Should show feedback fields - they will be textboxes among all the inputs
    const textboxes = screen.getAllByRole('textbox')
    // Find feedback inputs by their values
    const correctFeedback = textboxes.find(input => (input as HTMLInputElement).value === 'Correct!')
    const incorrectFeedback = textboxes.find(input => (input as HTMLInputElement).value === 'Try again.')
    
    expect(correctFeedback).toBeInTheDocument()
    expect(incorrectFeedback).toBeInTheDocument()
  })

  it('should show empty state when no assessment questions exist', () => {
    const contentNoAssessment = {
      ...mockCourseContent,
      assessment: { questions: [] }
    }
    
    render(
      <ActivitiesEditor
        courseContent={contentNoAssessment}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Should show Assessment Questions section
    const assessmentSection = screen.getByText('Assessment Questions').closest('section')
    
    // Check for empty state message (no questions)
    expect(within(assessmentSection!).getByTestId('grid')).toBeEmptyDOMElement()
  })

  it('should cancel editing when clicking cancel', async () => {
    const user = userEvent.setup()
    
    render(
      <ActivitiesEditor
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Edit an assessment question
    const assessmentSection = screen.getByText('Assessment Questions').closest('section')
    const editButton = within(assessmentSection!).getByRole('button', { name: /edit/i })
    await user.click(editButton)
    
    // Should open modal - the title will be Edit Assessment Question
    await waitFor(() => {
      expect(screen.getByText('Edit Assessment Question')).toBeInTheDocument()
    })
    
    // Make some changes
    const questionInput = screen.getAllByRole('textbox')[0]
    await user.clear(questionInput)
    await user.type(questionInput, 'Changed question')
    
    // Click cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)
    
    // Modal should close and changes should not be saved
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument()
    expect(screen.queryByText('Changed question')).not.toBeInTheDocument()
  })

  it('should save all question data when moving to next step', async () => {
    const user = userEvent.setup()
    
    render(
      <ActivitiesEditor
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Click Next without making changes
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)
    
    // Check that onNext was called with the current content
    expect(mockHandlers.onNext).toHaveBeenCalledWith(expect.objectContaining({
      welcomePage: expect.any(Object),
      learningObjectivesPage: expect.any(Object),
      topics: expect.any(Array),
      assessment: expect.objectContaining({
        questions: expect.arrayContaining([
          expect.objectContaining({
            question: 'What is 2 + 2?'
          })
        ])
      })
    }))
  })

  it('should show pass mark for assessment', () => {
    render(
      <ActivitiesEditor
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Should show pass mark in assessment section
    expect(screen.getByText(/Pass Mark:/)).toBeInTheDocument()
  })

  // Test to ensure assessment data is properly saved to .scormproj file
  it.todo('should save all question data to .scormproj file when project is saved')
})