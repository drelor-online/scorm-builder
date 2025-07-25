import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CoursePreview } from '../CoursePreview'

// Mock the preview generator service
vi.mock('../../services/progressivePreviewGenerator', () => ({
  generateProgressivePreviewHTML: vi.fn().mockResolvedValue(`
    <html>
      <body>
        <h1>Welcome to Safety Training</h1>
        <p>This course covers essential safety procedures.</p>
        <div>Narration: Welcome to our safety training course.</div>
        <nav>
          <a href="#objectives">Learning Objectives</a>
          <a href="#topic-1">Hazard Identification</a>
          <a href="#topic-2">Personal Protective Equipment</a>
          <a href="#assessment">Assessment</a>
        </nav>
        <div>Page 1 of 5</div>
        <button>Previous</button>
        <button>Next</button>
      </body>
    </html>
  `)
}))

// Mock the Modal component to render its children directly
vi.mock('../DesignSystem', () => ({
  Button: ({ children, onClick, variant, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
  Modal: ({ isOpen, children }: any) => isOpen ? <div role="dialog">{children}</div> : null,
  LoadingSpinner: () => <div>Loading...</div>
}))

describe('CoursePreview - User Intent Tests', () => {
  const mockCourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome to Safety Training',
      content: '<h2>Welcome!</h2><p>This course covers essential safety procedures.</p>',
      narration: 'Welcome to our safety training course.',
      imageKeywords: ['safety', 'training'],
      imagePrompts: ['Professional safety training environment'],
      videoSearchTerms: ['workplace safety'],
      duration: 2
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<h2>What You Will Learn</h2><ul><li>Identify hazards</li><li>Use PPE correctly</li><li>Emergency procedures</li></ul>',
      narration: 'By the end of this course, you will master three key areas.',
      imageKeywords: ['objectives', 'goals'],
      imagePrompts: ['Learning objectives checklist'],
      videoSearchTerms: [],
      duration: 3
    },
    topics: [
      {
        id: 'topic-1',
        title: 'Hazard Identification',
        content: '<h2>Identifying Workplace Hazards</h2><p>Learn to spot potential dangers.</p>',
        narration: 'Hazard identification is the first step in workplace safety.',
        imageKeywords: ['hazards', 'danger', 'workplace'],
        imagePrompts: ['Common workplace hazards'],
        videoSearchTerms: ['hazard identification'],
        duration: 5
      },
      {
        id: 'topic-2',
        title: 'Personal Protective Equipment',
        content: '<h2>Using PPE</h2><p>Proper use of safety equipment.</p>',
        narration: 'Personal protective equipment is your last line of defense.',
        imageKeywords: ['PPE', 'safety equipment'],
        imagePrompts: ['Worker wearing full PPE'],
        videoSearchTerms: ['PPE tutorial'],
        duration: 4
      }
    ],
    assessment: {
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice' as const,
          question: 'What should you do when you identify a hazard?',
          options: ['Ignore it', 'Report it immediately', 'Fix it yourself', 'Tell a coworker'],
          correctAnswer: 'Report it immediately',
          feedback: {
            correct: 'Correct! Always report hazards immediately.',
            incorrect: 'Remember to report hazards immediately to your supervisor.'
          }
        }
      ],
      passMark: 80,
      narration: null
    }
  }

  const mockCourseSeedData = {
    courseTitle: 'Safety Training Course',
    difficulty: 3,
    customTopics: [],
    template: 'Safety' as const,
    templateTopics: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('User wants to preview their course', () => {
    it('should show preview button', () => {
      render(
        <CoursePreview
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
        />
      )

      expect(screen.getByText('Preview Course')).toBeInTheDocument()
    })

    it('should open preview modal when button is clicked', async () => {
      const user = userEvent.setup()
      
      render(
        <CoursePreview
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
        />
      )

      // Click the preview button
      const previewButton = screen.getByText('Preview Course')
      await user.click(previewButton)

      // Modal should open
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('should display course content in preview', async () => {
      const user = userEvent.setup()
      const { generateProgressivePreviewHTML } = await import('../../services/progressivePreviewGenerator')
      
      render(
        <CoursePreview
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
        />
      )

      // Open preview
      await user.click(screen.getByText('Preview Course'))

      // Wait for iframe and service call
      await waitFor(() => {
        const iframe = screen.getByTestId('preview-iframe')
        expect(iframe).toBeInTheDocument()
        expect(generateProgressivePreviewHTML).toHaveBeenCalledWith(
          mockCourseContent,
          mockCourseSeedData,
          'welcome'
        )
      })
    })
  })

  describe('User wants to navigate through preview', () => {
    it('should have navigation controls', async () => {
      const user = userEvent.setup()
      
      render(
        <CoursePreview
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
        />
      )

      // Open preview
      await user.click(screen.getByText('Preview Course'))

      // Should have navigation arrows
      await waitFor(() => {
        expect(screen.getByText('Previous')).toBeInTheDocument()
        expect(screen.getByText('Next')).toBeInTheDocument()
      })
    })

    it('should navigate between pages', async () => {
      const user = userEvent.setup()
      const { generateProgressivePreviewHTML } = await import('../../services/progressivePreviewGenerator')
      
      render(
        <CoursePreview
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
        />
      )

      // Open preview
      await user.click(screen.getByText('Preview Course'))

      // Click next
      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument()
      })
      
      await user.click(screen.getByText('Next'))

      // Service should be called with new page
      await waitFor(() => {
        expect(generateProgressivePreviewHTML).toHaveBeenCalledWith(
          mockCourseContent,
          mockCourseSeedData,
          'objectives'
        )
      })
    })

    it('should disable previous button on first page', async () => {
      const user = userEvent.setup()
      
      render(
        <CoursePreview
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
        />
      )

      // Open preview
      await user.click(screen.getByText('Preview Course'))

      await waitFor(() => {
        const prevButton = screen.getByText('Previous')
        expect(prevButton).toBeDisabled()
      })
    })
  })

  describe('User wants device preview', () => {
    it('should show device selector', async () => {
      const user = userEvent.setup()
      
      render(
        <CoursePreview
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
        />
      )

      // Open preview
      await user.click(screen.getByText('Preview Course'))

      // Should have device buttons
      await waitFor(() => {
        expect(screen.getByText('Desktop')).toBeInTheDocument()
        expect(screen.getByText('Tablet')).toBeInTheDocument()
        expect(screen.getByText('Mobile')).toBeInTheDocument()
      })
    })

    it('should switch between device views', async () => {
      const user = userEvent.setup()
      
      render(
        <CoursePreview
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
        />
      )

      // Open preview
      await user.click(screen.getByText('Preview Course'))

      // Click mobile view
      await waitFor(() => {
        expect(screen.getByText('Mobile')).toBeInTheDocument()
      })
      
      const mobileButton = screen.getByText('Mobile')
      await user.click(mobileButton)

      // The iframe container should have mobile dimensions
      // Note: We can't directly test the iframe dimensions due to jsdom limitations
      // but we can verify the button variant changed to primary
      expect(mobileButton).toHaveAttribute('data-variant', 'primary')
    })
  })

  describe('User wants to close preview', () => {
    it('should close when close button is clicked', async () => {
      const user = userEvent.setup()
      
      render(
        <CoursePreview
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
        />
      )

      // Open preview
      await user.click(screen.getByText('Preview Course'))

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Click close
      await user.click(screen.getByText('Close'))

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('should close with escape key', async () => {
      const user = userEvent.setup()
      
      render(
        <CoursePreview
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
        />
      )

      // Open preview
      await user.click(screen.getByText('Preview Course'))

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Press escape
      await user.keyboard('{Escape}')

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })

  describe('User wants keyboard navigation', () => {
    it('should navigate with arrow keys', async () => {
      const user = userEvent.setup()
      const { generateProgressivePreviewHTML } = await import('../../services/progressivePreviewGenerator')
      
      render(
        <CoursePreview
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
        />
      )

      // Open preview
      await user.click(screen.getByText('Preview Course'))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Press right arrow
      await user.keyboard('{ArrowRight}')

      // Should navigate to next page
      await waitFor(() => {
        expect(generateProgressivePreviewHTML).toHaveBeenCalledWith(
          mockCourseContent,
          mockCourseSeedData,
          'objectives'
        )
      })
    })
  })

  describe('User wants to preview without content', () => {
    it('should show preview with seed data only', async () => {
      const user = userEvent.setup()
      
      render(
        <CoursePreview
          courseContent={null}
          courseSeedData={mockCourseSeedData}
        />
      )

      // Should still show preview button
      expect(screen.getByText('Preview Course')).toBeInTheDocument()

      // Open preview
      await user.click(screen.getByText('Preview Course'))

      // Should generate preview with null content
      const { generateProgressivePreviewHTML } = await import('../../services/progressivePreviewGenerator')
      await waitFor(() => {
        expect(generateProgressivePreviewHTML).toHaveBeenCalledWith(
          null,
          mockCourseSeedData,
          'welcome'
        )
      })
    })
  })
})