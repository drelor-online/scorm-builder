import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen , waitFor } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { CoursePreview } from '../CoursePreview'

// Mock the course content converter and preview generator
vi.mock('../../services/courseContentConverter', () => ({
  convertToEnhancedCourseContent: vi.fn((content, metadata) => {
    // Return a basic enhanced content structure
    return {
      title: metadata.title,
      duration: metadata.duration,
      passMark: metadata.passMark,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: content?.welcomePage?.content || '<h1>Welcome to Safety Training</h1>',
        startButtonText: 'Start Course',
        media: []
      },
      objectives: content?.objectives || ['Identify hazards', 'Use PPE correctly', 'Emergency procedures'],
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
    return `
      <html>
        <body>
          <h1>${content.title}</h1>
          <div class="course-nav">
            <a href="#objectives">Learning Objectives</a>
            ${content.topics.map((t: any) => `<a href="#${t.id}">${t.title}</a>`).join('')}
            <a href="#assessment">Assessment</a>
          </div>
          <div class="content">
            ${content.welcome.content}
          </div>
          <div class="controls">
            <button onclick="previousPage()">Previous</button>
            <button onclick="nextPage()">Next</button>
          </div>
        </body>
      </html>
    `
  })
}))

// Mock the performance monitor hook
vi.mock('../../hooks/usePerformanceMonitor', () => ({
  usePerformanceMonitor: () => ({
    measureAsync: async (name: string, fn: () => Promise<any>) => fn()
  })
}))

// Mock the Modal component to render its children directly with data-testid
vi.mock('../DesignSystem', () => ({
  Button: ({ children, onClick, variant, disabled, size, style }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      data-variant={variant}
      className={variant === 'primary' ? 'btn-primary' : ''}
      style={style}
    >
      {children}
    </button>
  ),
  Modal: ({ isOpen, children, 'data-testid': testId }: any) => 
    isOpen ? <div role="dialog" data-testid={testId}>{children}</div> : null,
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
        const iframe = screen.getByTitle('Course Preview')
        expect(iframe).toBeInTheDocument()
      })
      
      // Verify the services were imported and used
      // Since CoursePreviewAccurate calls these internally, we can't directly assert on them
      // Instead, check that the iframe was created with a blob URL
      const iframe = screen.getByTitle('Course Preview')
      expect(iframe).toHaveAttribute('src', 'blob:mock-url')
    })
  })

  describe('User wants to see preview content', () => {
    it('should generate preview HTML with course content', async () => {
      const user = userEvent.setup()
      const { generatePreviewHTML } = await import('../../services/previewGenerator')
      
      render(
        <CoursePreview
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          currentStep="json"
        />
      )

      // Open preview
      await user.click(screen.getByText('Preview Course'))

      // Wait for preview to generate
      await waitFor(() => {
        expect(generatePreviewHTML).toHaveBeenCalled()
        const enhancedContent = (generatePreviewHTML as any).mock.calls[0][0]
        expect(enhancedContent.title).toBe('Safety Training Course')
        expect(enhancedContent.topics).toHaveLength(2)
      })
    })

    it('should show limited preview for early steps', async () => {
      const user = userEvent.setup()
      
      render(
        <CoursePreview
          courseContent={null}
          courseSeedData={mockCourseSeedData}
          currentStep="seed"
        />
      )

      // Open preview
      await user.click(screen.getByText('Preview Course'))

      // Should show limited preview message
      await waitFor(() => {
        expect(screen.getByText('Limited preview - complete content generation for full preview')).toBeInTheDocument()
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

      // The mobile button should now be primary variant
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

    it('should close with close button', async () => {
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

      // Click the Close button
      const closeButton = screen.getByText('Close')
      expect(closeButton).toBeInTheDocument()
      await user.click(closeButton)

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })

  describe('User wants different device views', () => {
    it('should show all device options', async () => {
      const user = userEvent.setup()
      
      render(
        <CoursePreview
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          currentStep="json"
        />
      )

      // Open preview
      await user.click(screen.getByText('Preview Course'))

      await waitFor(() => {
        expect(screen.getByText('Desktop')).toBeInTheDocument()
        expect(screen.getByText('Tablet')).toBeInTheDocument()
        expect(screen.getByText('Mobile')).toBeInTheDocument()
      })
    })
  })

  describe('User wants to preview at different workflow steps', () => {
    it('should show appropriate content for json step', async () => {
      const user = userEvent.setup()
      
      render(
        <CoursePreview
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          currentStep="json"
        />
      )

      // Open preview
      await user.click(screen.getByText('Preview Course'))

      // Should show content available message
      await waitFor(() => {
        expect(screen.getByText('Showing content available at "json" step')).toBeInTheDocument()
      })
    })

    it('should show full preview at scorm step', async () => {
      const user = userEvent.setup()
      
      render(
        <CoursePreview
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          currentStep="scorm"
        />
      )

      // Open preview
      await user.click(screen.getByText('Preview Course'))

      // Should show content available message
      await waitFor(() => {
        expect(screen.getByText('Showing content available at "scorm" step')).toBeInTheDocument()
      })
    })
  })
})