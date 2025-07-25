import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CoursePreview } from '../CoursePreview'
import type { CourseContent } from '../../types/aiPrompt'

describe('CoursePreview', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome to Test Course',
      content: '<h1>Welcome</h1><p>This is the welcome page.</p>',
      narration: 'Welcome to this course.',
      imageKeywords: ['welcome', 'course'],
      imagePrompts: ['Welcome banner'],
      videoSearchTerms: ['course introduction'],
      duration: 1,
      media: []
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<h2>Objectives</h2><ul><li>Understand basics</li><li>Learn fundamentals</li></ul>',
      narration: 'Here are the learning objectives.',
      imageKeywords: ['objectives', 'goals'],
      imagePrompts: ['Learning objectives graphic'],
      videoSearchTerms: ['learning goals'],
      duration: 2,
      media: []
    },
    topics: [
      {
        id: 'topic-1',
        title: 'Introduction',
        content: '<p>This is the introduction content.</p>',
        narration: 'Introduction narration.',
        imageKeywords: ['introduction'],
        imagePrompts: ['Introduction image'],
        videoSearchTerms: ['intro video'],
        duration: 5,
        media: [
          { 
            id: 'media-1',
            type: 'image' as const, 
            url: 'https://example.com/image1.jpg',
            title: 'Example Image'
          }
        ],
        knowledgeCheck: {
          questions: [
            {
              id: 'kc-1',
              type: 'multiple-choice',
              question: 'What did you learn?',
              options: ['Option A', 'Option B', 'Option C'],
              correctAnswer: 'Option A',
              feedback: {
                correct: 'Great job!',
                incorrect: 'Try again'
              }
            }
          ]
        }
      },
      {
        id: 'topic-2',
        title: 'Advanced Topics',
        content: '<p>This is advanced content.</p>',
        narration: 'Advanced topics narration.',
        imageKeywords: ['advanced'],
        imagePrompts: ['Advanced concepts'],
        videoSearchTerms: ['advanced tutorial'],
        duration: 10,
        media: []
      }
    ],
    assessment: {
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice',
          question: 'Final assessment question?',
          options: ['Answer A', 'Answer B', 'Answer C'],
          correctAnswer: 'Answer A',
          feedback: {
            correct: 'Correct!',
            incorrect: 'Incorrect, please review.'
          }
        }
      ],
      passMark: 70,
      narration: null
    }
  }

  const mockCourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: [],
    template: 'None' as const,
    templateTopics: []
  }

  it('should render preview button', () => {
    render(
      <CoursePreview 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
      />
    )

    expect(screen.getByRole('button', { name: /preview course/i })).toBeInTheDocument()
  })

  it('should open preview modal when button is clicked', async () => {
    render(
      <CoursePreview 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
      />
    )

    const previewButton = screen.getByRole('button', { name: /preview course/i })
    fireEvent.click(previewButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('should display course content in preview modal', async () => {
    render(
      <CoursePreview 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
      />
    )

    const previewButton = screen.getByRole('button', { name: /preview course/i })
    fireEvent.click(previewButton)

    await waitFor(() => {
      // The preview modal should be open
      expect(screen.getByTestId('course-preview-modal')).toBeInTheDocument()
      // Check for the iframe that contains the preview
      expect(screen.getByTestId('preview-iframe')).toBeInTheDocument()
      // Check that we're on page 1
      expect(screen.getByText('Page 1 of 5')).toBeInTheDocument()
    })
  })

  it('should navigate between topics', async () => {
    render(
      <CoursePreview 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
      />
    )

    const previewButton = screen.getByRole('button', { name: /preview course/i })
    fireEvent.click(previewButton)

    await waitFor(() => {
      // Check for page navigation (Welcome is page 1, Learning Objectives is page 2, etc.)
      expect(screen.getByText('Page 1 of 5')).toBeInTheDocument()
    })

    const nextButton = screen.getByRole('button', { name: /next/i })
    fireEvent.click(nextButton)

    await waitFor(() => {
      // Should now be on page 2 (Learning Objectives)
      expect(screen.getByText('Page 2 of 5')).toBeInTheDocument()
    })
    
    // Click next again to get to first topic
    fireEvent.click(nextButton)
    
    await waitFor(() => {
      // Should now be on page 3 (First topic)
      expect(screen.getByText('Page 3 of 5')).toBeInTheDocument()
    })
  })

  it('should close preview modal when close button is clicked', async () => {
    render(
      <CoursePreview 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
      />
    )

    const previewButton = screen.getByRole('button', { name: /preview course/i })
    fireEvent.click(previewButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Get all close buttons and click the footer one (with text "Close")
    const closeButtons = screen.getAllByRole('button', { name: /close/i })
    const footerCloseButton = closeButtons.find(btn => btn.textContent === 'Close')
    expect(footerCloseButton).toBeInTheDocument()
    fireEvent.click(footerCloseButton!)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('should disable navigation buttons appropriately', async () => {
    render(
      <CoursePreview 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
      />
    )

    const previewButton = screen.getByRole('button', { name: /preview course/i })
    fireEvent.click(previewButton)

    await waitFor(() => {
      const prevButton = screen.getByRole('button', { name: /previous/i })
      const nextButton = screen.getByRole('button', { name: /next/i })
      
      // On first page, previous should be disabled
      expect(prevButton).toBeDisabled()
      expect(nextButton).not.toBeDisabled()
    })

    // Navigate to last page - we have 5 pages total (welcome, objectives, 2 topics, assessment)
    const nextButton = screen.getByRole('button', { name: /next/i })
    // Click 4 times to get to the last page
    fireEvent.click(nextButton) // to page 2
    fireEvent.click(nextButton) // to page 3
    fireEvent.click(nextButton) // to page 4
    fireEvent.click(nextButton) // to page 5

    await waitFor(() => {
      expect(screen.getByText('Page 5 of 5')).toBeInTheDocument()
      const prevButton = screen.getByRole('button', { name: /previous/i })
      const nextButtonDisabled = screen.getByRole('button', { name: /next/i })
      
      // On last page, next should be disabled
      expect(prevButton).not.toBeDisabled()
      expect(nextButtonDisabled).toBeDisabled()
    })
  })
})