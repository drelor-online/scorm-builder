/**
 * CoursePreview - Consolidated Test Suite
 * 
 * This file consolidates CoursePreview tests from multiple separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - CoursePreview.test.tsx (basic functionality)
 * - CoursePreview.intent.test.tsx (interaction testing)
 * - CoursePreview.bannerStyling.test.tsx (styling and layout)
 * - CoursePreviewAccurate.test.tsx (accuracy and data validation)
 * 
 * Test Categories:
 * - Component rendering and structure
 * - Content display and navigation
 * - Interactive elements and user actions
 * - Banner styling and responsive layout
 * - Data accuracy and validation
 * - Error handling and edge cases
 * - Performance and accessibility
 */

import { render, screen, fireEvent, waitFor } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CoursePreview } from '../CoursePreview'
import { CoursePreviewAccurate } from '../CoursePreviewAccurate'

// Mock course content data
const mockCourseContent = {
  welcomePage: {
    id: 'welcome',
    title: 'Welcome to the Course',
    content: '<p>This is the welcome page content.</p>',
    mediaIds: ['welcome-banner']
  },
  objectivesPage: {
    id: 'objectives',
    title: 'Learning Objectives',
    content: '<ul><li>Objective 1</li><li>Objective 2</li></ul>',
    mediaIds: []
  },
  topics: [
    {
      id: 'topic-1',
      title: 'Introduction to React',
      content: '<p>React is a JavaScript library for building user interfaces.</p>',
      mediaIds: ['react-logo'],
      knowledgeCheck: {
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            question: 'What is React?',
            options: ['A library', 'A framework', 'A language'],
            correctAnswer: 0
          }
        ]
      }
    },
    {
      id: 'topic-2', 
      title: 'Components and Props',
      content: '<p>Components let you split the UI into independent pieces.</p>',
      mediaIds: ['components-diagram'],
      knowledgeCheck: {
        questions: [
          {
            id: 'q2',
            type: 'true-false',
            question: 'Props are mutable in React.',
            correctAnswer: false
          }
        ]
      }
    }
  ],
  finalAssessment: {
    id: 'assessment',
    title: 'Final Assessment',
    questions: [
      {
        id: 'final-q1',
        type: 'multiple-choice',
        question: 'Which hook is used for state management?',
        options: ['useState', 'useEffect', 'useContext'],
        correctAnswer: 0
      }
    ]
  }
}

describe('CoursePreview - Consolidated Test Suite', () => {
  const mockProps = {
    courseContent: mockCourseContent,
    onClose: vi.fn(),
    onNavigate: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering and Structure', () => {
    it('should render course preview with all main sections', () => {
      render(<CoursePreview {...mockProps} />)

      expect(screen.getByText('Welcome to the Course')).toBeInTheDocument()
      expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
      expect(screen.getByText('Introduction to React')).toBeInTheDocument()
      expect(screen.getByText('Components and Props')).toBeInTheDocument()
      expect(screen.getByText('Final Assessment')).toBeInTheDocument()
    })

    it('should display course navigation menu', () => {
      render(<CoursePreview {...mockProps} />)

      const navigation = screen.getByRole('navigation')
      expect(navigation).toBeInTheDocument()

      // Check navigation items
      expect(screen.getByRole('button', { name: /welcome/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /objectives/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /introduction to react/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /components and props/i })).toBeInTheDocument()
    })

    it('should show progress indicator', () => {
      render(<CoursePreview {...mockProps} />)

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveAttribute('aria-valuenow', '0')
    })

    it('should display close button', () => {
      render(<CoursePreview {...mockProps} />)

      const closeButton = screen.getByRole('button', { name: /close/i })
      expect(closeButton).toBeInTheDocument()
    })
  })

  describe('Content Display and Navigation', () => {
    it('should display welcome page content by default', () => {
      render(<CoursePreview {...mockProps} />)

      expect(screen.getByText('This is the welcome page content.')).toBeInTheDocument()
    })

    it('should navigate to different sections when clicked', async () => {
      render(<CoursePreview {...mockProps} />)

      const objectivesButton = screen.getByRole('button', { name: /objectives/i })
      await userEvent.click(objectivesButton)

      await waitFor(() => {
        expect(screen.getByText('Objective 1')).toBeInTheDocument()
        expect(screen.getByText('Objective 2')).toBeInTheDocument()
      })
    })

    it('should update progress when navigating', async () => {
      render(<CoursePreview {...mockProps} />)

      const topicButton = screen.getByRole('button', { name: /introduction to react/i })
      await userEvent.click(topicButton)

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar')
        expect(progressBar).toHaveAttribute('aria-valuenow', '25')
      })
    })

    it('should show previous/next navigation buttons', async () => {
      render(<CoursePreview {...mockProps} />)

      // Navigate to a middle section
      const topicButton = screen.getByRole('button', { name: /introduction to react/i })
      await userEvent.click(topicButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
      })
    })

    it('should disable previous button on first page', () => {
      render(<CoursePreview {...mockProps} />)

      const previousButton = screen.getByRole('button', { name: /previous/i })
      expect(previousButton).toBeDisabled()
    })

    it('should disable next button on last page', async () => {
      render(<CoursePreview {...mockProps} />)

      // Navigate to last section
      const assessmentButton = screen.getByRole('button', { name: /assessment/i })
      await userEvent.click(assessmentButton)

      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /next/i })
        expect(nextButton).toBeDisabled()
      })
    })
  })

  describe('Interactive Elements and User Actions', () => {
    it('should render knowledge check questions', async () => {
      render(<CoursePreview {...mockProps} />)

      const topicButton = screen.getByRole('button', { name: /introduction to react/i })
      await userEvent.click(topicButton)

      await waitFor(() => {
        expect(screen.getByText('What is React?')).toBeInTheDocument()
        expect(screen.getByText('A library')).toBeInTheDocument()
        expect(screen.getByText('A framework')).toBeInTheDocument()
        expect(screen.getByText('A language')).toBeInTheDocument()
      })
    })

    it('should allow selecting answers in knowledge checks', async () => {
      render(<CoursePreview {...mockProps} />)

      const topicButton = screen.getByRole('button', { name: /introduction to react/i })
      await userEvent.click(topicButton)

      await waitFor(() => {
        const answerOption = screen.getByRole('radio', { name: /a library/i })
        expect(answerOption).toBeInTheDocument()
      })

      const answerOption = screen.getByRole('radio', { name: /a library/i })
      await userEvent.click(answerOption)

      expect(answerOption).toBeChecked()
    })

    it('should provide feedback on question answers', async () => {
      render(<CoursePreview {...mockProps} />)

      const topicButton = screen.getByRole('button', { name: /introduction to react/i })
      await userEvent.click(topicButton)

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit/i })
        expect(submitButton).toBeInTheDocument()
      })

      const answerOption = screen.getByRole('radio', { name: /a library/i })
      await userEvent.click(answerOption)

      const submitButton = screen.getByRole('button', { name: /submit/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/correct/i)).toBeInTheDocument()
      })
    })

    it('should call onClose when close button clicked', async () => {
      render(<CoursePreview {...mockProps} />)

      const closeButton = screen.getByRole('button', { name: /close/i })
      await userEvent.click(closeButton)

      expect(mockProps.onClose).toHaveBeenCalledTimes(1)
    })

    it('should call onNavigate when navigation occurs', async () => {
      render(<CoursePreview {...mockProps} />)

      const topicButton = screen.getByRole('button', { name: /introduction to react/i })
      await userEvent.click(topicButton)

      expect(mockProps.onNavigate).toHaveBeenCalledWith('topic-1')
    })
  })

  describe('Banner Styling and Responsive Layout', () => {
    it('should apply correct banner styling classes', () => {
      render(<CoursePreview {...mockProps} />)

      const banner = screen.getByTestId('course-banner')
      expect(banner).toHaveClass('course-preview-banner')
      expect(banner).toHaveClass('gradient-background')
    })

    it('should be responsive on mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      render(<CoursePreview {...mockProps} />)

      const container = screen.getByTestId('preview-container')
      expect(container).toHaveClass('mobile-responsive')
    })

    it('should stack navigation vertically on small screens', () => {
      // Mock small screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320,
      })

      render(<CoursePreview {...mockProps} />)

      const navigation = screen.getByRole('navigation')
      expect(navigation).toHaveClass('vertical-layout')
    })

    it('should display media content correctly', async () => {
      const propsWithMedia = {
        ...mockProps,
        mediaLibrary: {
          'welcome-banner': {
            id: 'welcome-banner',
            url: 'http://example.com/banner.jpg',
            type: 'image',
            metadata: { alt: 'Welcome banner' }
          }
        }
      }

      render(<CoursePreview {...propsWithMedia} />)

      const mediaImage = screen.getByRole('img', { name: /welcome banner/i })
      expect(mediaImage).toBeInTheDocument()
      expect(mediaImage).toHaveAttribute('src', 'http://example.com/banner.jpg')
    })
  })

  describe('Data Accuracy and Validation', () => {
    it('should render CoursePreviewAccurate component correctly', () => {
      render(<CoursePreviewAccurate courseContent={mockCourseContent} />)

      expect(screen.getByText('Welcome to the Course')).toBeInTheDocument()
      expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
    })

    it('should validate course content structure', () => {
      const invalidContent = {
        // Missing required fields
        welcomePage: { title: 'Welcome' },
        topics: []
      }

      render(<CoursePreviewAccurate courseContent={invalidContent} />)

      expect(screen.getByText(/invalid course structure/i)).toBeInTheDocument()
    })

    it('should display accurate topic count', () => {
      render(<CoursePreviewAccurate courseContent={mockCourseContent} />)

      expect(screen.getByText('2 Topics')).toBeInTheDocument()
    })

    it('should show correct assessment question count', () => {
      render(<CoursePreviewAccurate courseContent={mockCourseContent} />)

      expect(screen.getByText('1 Assessment Question')).toBeInTheDocument()
    })

    it('should calculate estimated completion time', () => {
      render(<CoursePreviewAccurate courseContent={mockCourseContent} />)

      // Should calculate based on content length and reading speed
      expect(screen.getByText(/estimated time: \d+ minutes/i)).toBeInTheDocument()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing course content gracefully', () => {
      render(<CoursePreview courseContent={null} onClose={vi.fn()} />)

      expect(screen.getByText(/no course content available/i)).toBeInTheDocument()
    })

    it('should handle empty topics array', () => {
      const emptyContent = {
        ...mockCourseContent,
        topics: []
      }

      render(<CoursePreview courseContent={emptyContent} onClose={vi.fn()} />)

      expect(screen.getByText(/no topics available/i)).toBeInTheDocument()
    })

    it('should handle topics without knowledge checks', async () => {
      const contentWithoutChecks = {
        ...mockCourseContent,
        topics: [{
          id: 'topic-simple',
          title: 'Simple Topic',
          content: '<p>Simple content</p>',
          mediaIds: []
        }]
      }

      render(<CoursePreview courseContent={contentWithoutChecks} onClose={vi.fn()} />)

      const topicButton = screen.getByRole('button', { name: /simple topic/i })
      await userEvent.click(topicButton)

      await waitFor(() => {
        expect(screen.getByText('Simple content')).toBeInTheDocument()
        expect(screen.queryByText(/knowledge check/i)).not.toBeInTheDocument()
      })
    })

    it('should handle navigation errors', async () => {
      const mockPropsWithError = {
        ...mockProps,
        onNavigate: vi.fn().mockRejectedValue(new Error('Navigation failed'))
      }

      render(<CoursePreview {...mockPropsWithError} />)

      const topicButton = screen.getByRole('button', { name: /introduction to react/i })
      await userEvent.click(topicButton)

      await waitFor(() => {
        expect(screen.getByText(/navigation error/i)).toBeInTheDocument()
      })
    })
  })

  describe('Performance and Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<CoursePreview {...mockProps} />)

      const navigation = screen.getByRole('navigation')
      expect(navigation).toHaveAttribute('aria-label', 'Course navigation')

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-label', 'Course progress')
    })

    it('should be keyboard navigable', async () => {
      render(<CoursePreview {...mockProps} />)

      const firstNavButton = screen.getByRole('button', { name: /welcome/i })
      firstNavButton.focus()

      // Tab should move to next navigation item
      fireEvent.keyDown(firstNavButton, { key: 'Tab' })
      
      const secondNavButton = screen.getByRole('button', { name: /objectives/i })
      expect(secondNavButton).toHaveFocus()
    })

    it('should support arrow key navigation', async () => {
      render(<CoursePreview {...mockProps} />)

      const firstNavButton = screen.getByRole('button', { name: /welcome/i })
      firstNavButton.focus()

      fireEvent.keyDown(firstNavButton, { key: 'ArrowDown' })

      const secondNavButton = screen.getByRole('button', { name: /objectives/i })
      expect(secondNavButton).toHaveFocus()
    })

    it('should have semantic HTML structure', () => {
      render(<CoursePreview {...mockProps} />)

      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getAllByRole('heading')).toHaveLength(5) // One for each section
    })
  })
})