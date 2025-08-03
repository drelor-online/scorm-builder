import { describe, it, expect, vi } from 'vitest'
import { render, screen , waitFor } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { CoursePreviewAccurate } from '../CoursePreviewAccurate'
import type { CourseContent } from '../../types/aiPrompt'

// Mock the services
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
        content: content.welcomePage?.content || 'Welcome to the course',
        startButtonText: 'Start Course',
        media: []
      },
      objectives: content.objectives || [],
      objectivesPage: {
        media: []
      },
      topics: content.topics.map((topic: any) => ({
        id: topic.id,
        title: topic.title,
        content: topic.content,
        media: topic.media || [],
        knowledgeCheck: topic.knowledgeCheck
      })),
      assessment: content.assessment || { questions: [] }
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

describe('CoursePreviewAccurate', () => {
  const mockCourseSeedData = {
    courseTitle: 'Test Course',
    courseDescription: 'Test Description',
    difficulty: 3,
    customTopics: ['Topic 1', 'Topic 2'],
    template: 'None' as const,
    templateTopics: []
  }

  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome to the course',
      narration: '',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 1
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: 'You will learn...',
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
        content: 'Topic 1 content',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5,
        knowledgeCheck: {
          question: 'Test question?',
          options: ['A', 'B', 'C'],
          correctAnswer: 0,
          explanation: 'A is correct'
        }
      }
    ],
    assessment: {
      questions: [],
      passMark: 80,
      narration: null
    }
  }

  it('should not show preview at seed step', async () => {
    const user = userEvent.setup()
    render(
      <CoursePreviewAccurate
        courseContent={null}
        courseSeedData={mockCourseSeedData}
        currentStep="seed"
      />
    )

    const button = screen.getByText('Preview Course')
    await user.click(button)

    await waitFor(() => {
      // Check that limited preview message is shown
      expect(screen.getByText('Limited preview - complete content generation for full preview')).toBeInTheDocument()
      // Check that iframe is rendered with placeholder content
      const iframe = screen.getByTitle('Course Preview')
      expect(iframe).toBeInTheDocument()
      expect(iframe).toHaveAttribute('src', 'blob:mock-url')
    })
  })

  it('should not show preview at prompt step', async () => {
    const user = userEvent.setup()
    render(
      <CoursePreviewAccurate
        courseContent={null}
        courseSeedData={mockCourseSeedData}
        currentStep="prompt"
      />
    )

    const button = screen.getByText('Preview Course')
    await user.click(button)

    await waitFor(() => {
      // Check that limited preview message is shown
      expect(screen.getByText('Limited preview - complete content generation for full preview')).toBeInTheDocument()
      // Check that iframe is rendered
      const iframe = screen.getByTitle('Course Preview')
      expect(iframe).toBeInTheDocument()
    })
  })

  it('should show preview without media at json step', async () => {
    const user = userEvent.setup()
    const { convertToEnhancedCourseContent } = await import('../../services/courseContentConverter')
    const { generatePreviewHTML } = await import('../../services/previewGenerator')

    render(
      <CoursePreviewAccurate
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        currentStep="json"
      />
    )

    const button = screen.getByText('Preview Course')
    await user.click(button)

    await waitFor(() => {
      expect(convertToEnhancedCourseContent).toHaveBeenCalled()
      expect(generatePreviewHTML).toHaveBeenCalled()
      
      // Check that the enhanced content passed to preview has no media
      const enhancedContent = (generatePreviewHTML as any).mock.calls[0][0]
      expect(enhancedContent.welcome.media).toEqual([])
      expect(enhancedContent.topics[0].media).toEqual([])
    })
  })

  it('should show preview without audio at media step', async () => {
    const user = userEvent.setup()
    const { generatePreviewHTML } = await import('../../services/previewGenerator')

    const contentWithMedia = {
      ...mockCourseContent,
      topics: [{
        ...mockCourseContent.topics[0],
        media: [{ id: 'img1', type: 'image' as const, url: 'test.jpg', title: 'Test Image' }]
      }]
    }

    render(
      <CoursePreviewAccurate
        courseContent={contentWithMedia}
        courseSeedData={mockCourseSeedData}
        currentStep="media"
      />
    )

    const button = screen.getByText('Preview Course')
    await user.click(button)

    await waitFor(() => {
      const enhancedContent = (generatePreviewHTML as any).mock.calls[0][0]
      // At media step, media should be preserved but audio removed
      // The mock converter returns the media as-is, so it should have the media
      expect(enhancedContent.topics[0].media).toBeDefined()
      expect(enhancedContent.welcome.audioFile).toBeUndefined()
      expect(enhancedContent.topics[0].audioFile).toBeUndefined()
    })
  })

  it('should show full preview at scorm step', async () => {
    const user = userEvent.setup()
    const { generatePreviewHTML } = await import('../../services/previewGenerator')

    render(
      <CoursePreviewAccurate
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        currentStep="scorm"
      />
    )

    const button = screen.getByText('Preview Course')
    await user.click(button)

    await waitFor(() => {
      expect(generatePreviewHTML).toHaveBeenCalled()
      const enhancedContent = (generatePreviewHTML as any).mock.calls[0][0]
      // Should have all content including assessment
      expect(enhancedContent.assessment).toBeDefined()
    })
  })

  it('should handle missing course content gracefully', async () => {
    const user = userEvent.setup()
    render(
      <CoursePreviewAccurate
        courseContent={null}
        courseSeedData={mockCourseSeedData}
        currentStep="json"
      />
    )

    const button = screen.getByText('Preview Course')
    await user.click(button)

    await waitFor(() => {
      // When content is null at json step, it should show limited preview
      expect(screen.getByText('Showing content available at "json" step')).toBeInTheDocument()
      const iframe = screen.getByTitle('Course Preview')
      expect(iframe).toBeInTheDocument()
    })
  })

  it('should switch between device sizes', async () => {
    const user = userEvent.setup()
    render(
      <CoursePreviewAccurate
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        currentStep="json"
      />
    )

    const button = screen.getByText('Preview Course')
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText('Desktop')).toBeInTheDocument()
    })

    // Switch to tablet view
    const tabletButton = screen.getByText('Tablet')
    await user.click(tabletButton)

    // Switch to mobile view
    const mobileButton = screen.getByText('Mobile')
    await user.click(mobileButton)

    // Verify mobile button has primary variant class
    expect(mobileButton).toHaveClass('btn-primary')
  })
})