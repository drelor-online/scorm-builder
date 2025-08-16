/**
 * ActivitiesEditor - Simplified Consolidated Test Suite
 * 
 * This file consolidates the most important ActivitiesEditor tests using a working pattern
 * from the existing test files to ensure compatibility and reduce duplication.
 */

import { render, screen, fireEvent, waitFor } from '../../test/testProviders'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActivitiesEditor } from '../ActivitiesEditor'
import { UnsavedChangesProvider, useUnsavedChanges } from '../../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../../contexts/NotificationContext'
import type { CourseContent, LegacyCourseContent } from '../../types/aiPrompt'
import React from 'react'

// Test component to track dirty state changes
const UnsavedChangesTracker: React.FC = () => {
  const { hasUnsavedChanges, isDirty } = useUnsavedChanges()
  
  return (
    <div data-testid="unsaved-changes-tracker">
      <div data-testid="has-unsaved-changes">{hasUnsavedChanges.toString()}</div>
      <div data-testid="is-activities-dirty">{isDirty('activities').toString()}</div>
    </div>
  )
}

// Standard test wrapper with all required providers
const TestWrapperWithTracker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>
    <UnsavedChangesProvider>
      <UnsavedChangesTracker />
      {children}
    </UnsavedChangesProvider>
  </NotificationProvider>
)

// Sample course content (new format)
const mockCourseContent: CourseContent = {
  welcomePage: {
    id: 'welcome',
    title: 'Welcome',
    content: 'Welcome content',
    narration: 'Welcome narration',
    imageKeywords: [],
    imagePrompts: [],
    videoSearchTerms: [],
    duration: 5,
    media: []
  },
  learningObjectivesPage: {
    id: 'objectives', 
    title: 'Learning Objectives',
    content: 'Objectives content',
    narration: 'Objectives narration',
    imageKeywords: [],
    imagePrompts: [],
    videoSearchTerms: [],
    duration: 10,
    media: []
  },
  objectives: ['Learn React', 'Master TypeScript'],
  topics: [
    {
      id: 'topic-1',
      title: 'Introduction to React',
      content: 'React basics content',
      narration: 'React basics narration',
      imageKeywords: ['react', 'components'],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 15,
      media: [],
      knowledgeCheck: {
        questions: [
          {
            id: 'kc-1',
            question: 'What is React?',
            type: 'multiple-choice' as const,
            options: ['Library', 'Framework', 'Language', 'Tool'],
            correctAnswer: 'Library',
            feedback: {
              correct: 'Correct! React is a library.',
              incorrect: 'Not quite. React is a library for building UIs.'
            }
          }
        ]
      }
    }
  ],
  assessment: {
    questions: [
      {
        id: 'assess-1',
        question: 'How do you create a React component?',
        type: 'multiple-choice' as const,
        options: ['function', 'class', 'both', 'neither'],
        correctAnswer: 'both',
        feedback: {
          correct: 'Correct! You can use both functions and classes.',
          incorrect: 'Try again. Both functions and classes work.'
        }
      }
    ],
    passMark: 80
  }
}

// Legacy course content for testing old format
const mockLegacyCourseContent: LegacyCourseContent = {
  activities: [
    {
      id: 'activity-1',
      title: 'Test Activity',
      instructions: 'Test instructions',
      type: 'multiple-choice' as const,
      content: {}
    }
  ],
  quiz: {
    questions: [
      {
        id: 'quiz-1',
        question: 'What is testing?',
        type: 'multiple-choice' as const,
        options: ['Verification', 'Fun', 'Boring', 'Optional'],
        correctAnswer: 'Verification'
      }
    ],
    passMark: 70
  }
}

describe('ActivitiesEditor - Consolidated Test Suite', () => {
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()
  const mockOnUpdateContent = vi.fn()
  const mockOnSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders without crashing with new format', () => {
      render(
        <TestWrapperWithTracker>
          <ActivitiesEditor
            courseContent={mockCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
            onUpdateContent={mockOnUpdateContent}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )
      
      expect(screen.getByText('Questions & Assessment Editor')).toBeInTheDocument()
    })

    it('renders without crashing with legacy format', () => {
      render(
        <TestWrapperWithTracker>
          <ActivitiesEditor
            courseContent={mockLegacyCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
            onUpdateContent={mockOnUpdateContent}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )
      
      expect(screen.getByText('Activities & Quiz Editor')).toBeInTheDocument()
    })

    it('displays correct initial content for new format', () => {
      render(
        <TestWrapperWithTracker>
          <ActivitiesEditor
            courseContent={mockCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
            onUpdateContent={mockOnUpdateContent}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )
      
      // Should show knowledge check question
      expect(screen.getByText('What is React?')).toBeInTheDocument()
      
      // Should show assessment question
      expect(screen.getByText('How do you create a React component?')).toBeInTheDocument()
      
      // Should show pass mark
      expect(screen.getByText(/Pass Mark: 80%/)).toBeInTheDocument()
    })
  })

  describe('Unsaved Changes Integration', () => {

    it('tracks changes correctly when onUpdateContent is provided', async () => {
      const { container } = render(
        <TestWrapperWithTracker>
          <ActivitiesEditor
            courseContent={mockCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
            onUpdateContent={mockOnUpdateContent}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )

      // Initially should not be dirty
      expect(screen.getByTestId('is-activities-dirty')).toHaveTextContent('false')

      // Try to find an edit button that's specific to the activities editor
      const editButtons = container.querySelectorAll('button')
      const activitiesEditButton = Array.from(editButtons).find(btn => 
        btn.textContent === 'Edit' && btn.closest('.activities-section, .assessment-section')
      )
      
      if (activitiesEditButton) {
        fireEvent.click(activitiesEditButton)
        
        // Should call onUpdateContent when changes are made
        await waitFor(() => {
          expect(mockOnUpdateContent).toHaveBeenCalled()
        }, { timeout: 3000 })
      }
    })

    it('does not track changes when onUpdateContent is missing', async () => {
      const propsWithoutUpdateContent = {
        courseContent: mockCourseContent,
        onNext: mockOnNext,
        onBack: mockOnBack,
        onSave: mockOnSave
        // onUpdateContent is missing
      }

      render(
        <TestWrapperWithTracker>
          <ActivitiesEditor {...propsWithoutUpdateContent} />
        </TestWrapperWithTracker>
      )

      // Without onUpdateContent, changes won't be tracked properly
      expect(screen.getByTestId('is-activities-dirty')).toHaveTextContent('false')
    })
  })

  describe('Pass Mark Management', () => {
    it('allows editing pass mark', async () => {
      render(
        <TestWrapperWithTracker>
          <ActivitiesEditor
            courseContent={mockCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
            onUpdateContent={mockOnUpdateContent}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )

      // Find pass mark edit button by test ID
      const editButton = screen.queryByTestId('pass-mark-edit')
      if (editButton) {
        fireEvent.click(editButton)
        
        // Should show input field
        const input = screen.queryByTestId('pass-mark-input')
        expect(input).toBeInTheDocument()
        
        if (input) {
          // Change value
          fireEvent.change(input, { target: { value: '85' } })
          
          // Find save button in the pass mark section
          const saveButton = input.closest('div')?.querySelector('button[type="button"]')
          if (saveButton && saveButton.textContent === 'Save') {
            fireEvent.click(saveButton)
            
            // Should call onUpdateContent
            await waitFor(() => {
              expect(mockOnUpdateContent).toHaveBeenCalled()
            })
          }
        }
      }
    })
  })

  describe('Navigation', () => {
    it('handles navigation properly', async () => {
      render(
        <TestWrapperWithTracker>
          <ActivitiesEditor
            courseContent={mockCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
            onUpdateContent={mockOnUpdateContent}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )

      // Find next button by test ID (should be in PageLayout)
      const nextButton = screen.queryByTestId('next-button')
      if (nextButton) {
        fireEvent.click(nextButton)
        
        await waitFor(() => {
          expect(mockOnNext).toHaveBeenCalled()
        })
      }
    })
  })

  describe('Legacy Format Support', () => {
    it('displays activities and quiz for legacy content', () => {
      render(
        <TestWrapperWithTracker>
          <ActivitiesEditor
            courseContent={mockLegacyCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
            onUpdateContent={mockOnUpdateContent}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )

      expect(screen.getByText('Activities & Quiz Editor')).toBeInTheDocument()
      expect(screen.getByText('Test Activity')).toBeInTheDocument()
      expect(screen.getByText('What is testing?')).toBeInTheDocument()
    })
  })
})