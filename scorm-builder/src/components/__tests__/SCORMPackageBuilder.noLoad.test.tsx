import React from 'react'
import { render, screen, waitFor } from '../../test/testProviders'
import { vi } from 'vitest'
import { SCORMPackageBuilder } from '../SCORMPackageBuilder'
import { CourseContent } from '../../types/aiPrompt'
import { CourseSeedData } from '../../types/course'

describe('SCORMPackageBuilder Loading Issue', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Welcome content</p>',
      narration: '',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 1
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<p>Objectives</p>',
      narration: '',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 1
    },
    objectives: ['Objective 1', 'Objective 2'],
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: '<p>Topic content</p>',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 3
      }
    ],
    assessment: {
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice',
          question: 'Test question?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          feedback: {
            correct: 'Correct!',
            incorrect: 'Try again'
          }
        }
      ],
      passMark: 80,
      narration: null
    }
  }

  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    courseDescription: 'Test Description',
    difficulty: 3,
    duration: 30,
    customTopics: [],
    template: 'None' as const,
    templateTopics: []
  }

  it('should render without crashing when loaded', async () => {
    const mockOnNext = vi.fn()
    const mockOnBack = vi.fn()

    render(
      <SCORMPackageBuilder
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // The component should render basic structure
    await waitFor(() => {
      expect(screen.getByText(/SCORM Package Generation/i)).toBeInTheDocument()
    })

    // Should show course information
    expect(screen.getByText(mockCourseSeedData.courseTitle)).toBeInTheDocument()
    
    // Should show assessment questions count
    const assessmentText = screen.getByText(/assessment questions/i)
    expect(assessmentText).toBeInTheDocument()
    expect(assessmentText.textContent).toContain('1')
  })

  it('should handle missing assessment gracefully', async () => {
    const contentWithoutAssessment = {
      ...mockCourseContent,
      assessment: undefined
    }

    render(
      <SCORMPackageBuilder
        courseContent={contentWithoutAssessment}
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/SCORM Package Generation/i)).toBeInTheDocument()
    })

    // Should show 0 assessment questions when assessment is missing
    const assessmentText = screen.getByText(/assessment questions/i)
    expect(assessmentText.textContent).toContain('0')
  })
})
