import { render, screen, fireEvent, waitFor } from './../../test/testProviders'
import { describe, it, expect, vi } from 'vitest'
import { CoursePreview } from '../CoursePreview'
import type { CourseContent } from '../../types/aiPrompt'

// Mock the services
vi.mock('../../services/courseContentConverter', () => ({
  convertToEnhancedCourseContent: vi.fn((content, metadata) => {
    return {
      title: metadata.title,
      duration: metadata.duration,
      passMark: metadata.passMark,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: content?.welcomePage?.content || 'Welcome to the course',
        startButtonText: 'Start Course',
        media: []
      },
      objectives: content?.objectives || [],
      objectivesPage: {
        media: []
      },
      topics: content?.topics?.map((topic: any) => ({
        id: topic.id,
        title: topic.title,
        content: topic.content,
        media: topic.media || [],
        knowledgeCheck: topic.knowledgeCheck
      })) || [],
      assessment: content?.assessment || { questions: [] }
    }
  })
}))

vi.mock('../../services/previewGenerator', () => ({
  generatePreviewHTML: vi.fn((content) => {
    return `<html><body><h1>${content.title}</h1><p>Preview content</p></body></html>`
  })
}))

vi.mock('../../hooks/usePerformanceMonitor', () => ({
  usePerformanceMonitor: () => ({
    measureAsync: async (name: string, fn: () => Promise<any>) => fn()
  })
}))

// Mock the DesignSystem components
vi.mock('../DesignSystem', () => ({
  Button: ({ children, onClick, variant, disabled }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      data-variant={variant}
      className={variant === 'primary' ? 'btn-primary' : ''}
    >
      {children}
    </button>
  ),
  Modal: ({ isOpen, children, 'data-testid': testId }: any) => 
    isOpen ? (
      <div role="dialog" data-testid={testId}>
        {children}
      </div>
    ) : null
}))

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
        currentStep="json"
      />
    )

    const previewButton = screen.getByRole('button', { name: /preview course/i })
    fireEvent.click(previewButton)

    await waitFor(() => {
      // The preview modal should be open
      expect(screen.getByTestId('course-preview-modal')).toBeInTheDocument()
      // Check for the iframe that contains the preview
      const iframe = screen.getByTitle('Course Preview')
      expect(iframe).toBeInTheDocument()
      // Check for the step indicator
      expect(screen.getByText('Showing content available at "json" step')).toBeInTheDocument()
    })
  })

  it('should show device switching options', async () => {
    render(
      <CoursePreview 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        currentStep="json"
      />
    )

    const previewButton = screen.getByRole('button', { name: /preview course/i })
    fireEvent.click(previewButton)

    await waitFor(() => {
      // Check for device buttons
      expect(screen.getByText('Desktop')).toBeInTheDocument()
      expect(screen.getByText('Tablet')).toBeInTheDocument()
      expect(screen.getByText('Mobile')).toBeInTheDocument()
    })

    // Click tablet button
    const tabletButton = screen.getByText('Tablet')
    fireEvent.click(tabletButton)

    // Tablet button should have primary variant
    expect(tabletButton).toHaveAttribute('data-variant', 'primary')
  })

  it('should close preview modal when close button is clicked', async () => {
    render(
      <CoursePreview 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        currentStep="json"
      />
    )

    const previewButton = screen.getByRole('button', { name: /preview course/i })
    fireEvent.click(previewButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Close button should be available (from CoursePreviewAccurate)
    const closeButtons = screen.getAllByText('Close')
    // Click the last close button (from CoursePreviewAccurate)
    fireEvent.click(closeButtons[closeButtons.length - 1])

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('should handle different workflow steps', async () => {
    // Test with seed step (limited preview)
    const { rerender } = render(
      <CoursePreview 
        courseContent={null}
        courseSeedData={mockCourseSeedData}
        currentStep="seed"
      />
    )

    let previewButton = screen.getByRole('button', { name: /preview course/i })
    fireEvent.click(previewButton)

    await waitFor(() => {
      expect(screen.getByText('Limited preview - complete content generation for full preview')).toBeInTheDocument()
    })

    // Close modal - get all close buttons and click the last one
    const closeButtons = screen.getAllByText('Close')
    fireEvent.click(closeButtons[closeButtons.length - 1])

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Test with json step (content preview)
    rerender(
      <CoursePreview 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        currentStep="json"
      />
    )

    previewButton = screen.getByRole('button', { name: /preview course/i })
    fireEvent.click(previewButton)

    await waitFor(() => {
      expect(screen.getByText('Showing content available at "json" step')).toBeInTheDocument()
    })
  })
})