import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../../test/testProviders'
import { PageThumbnailGrid } from '../PageThumbnailGrid'
import { CourseContent } from '../../types/aiPrompt'

describe('PageThumbnailGrid', () => {
  const mockOnPageSelect = vi.fn()
  
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome to Test Course',
      content: '<p>Welcome content preview text that should be truncated...</p>',
      narration: 'Welcome narration',
      imageKeywords: ['welcome'],
      imagePrompts: ['Welcome banner'],
      videoSearchTerms: [],
      duration: 2,
      media: [{
        id: 'welcome-media-1',
        type: 'image',
        url: 'https://example.com/welcome.jpg',
        title: 'Welcome Image'
      }]
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<ul><li>Objective 1</li><li>Objective 2</li></ul>',
      narration: 'Objectives narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3,
      media: []
    },
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1: Introduction',
        content: '<p>Topic 1 content goes here...</p>',
        narration: 'Topic narration',
        imageKeywords: ['topic'],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5,
        media: []
      },
      {
        id: 'topic-2', 
        title: 'Topic 2: Advanced Concepts',
        content: '<p>Topic 2 content with media...</p>',
        narration: 'Topic 2 narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 7,
        media: [{
          id: 'topic2-media-1',
          type: 'video',
          url: 'https://youtube.com/watch?v=123',
          embedUrl: 'https://youtube.com/embed/123',
          title: 'Topic 2 Video'
        }]
      }
    ],
    assessment: {
      questions: [],
      passMark: 80
    }
  }

  it('should render all pages in a grid layout', () => {
    render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="welcome"
        onPageSelect={mockOnPageSelect}
      />
    )

    // Should show all pages
    expect(screen.getByText('Welcome to Test Course')).toBeInTheDocument()
    expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
    expect(screen.getByText('Topic 1: Introduction')).toBeInTheDocument()
    expect(screen.getByText('Topic 2: Advanced Concepts')).toBeInTheDocument()
  })

  it('should show content preview for each page', () => {
    render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="welcome"
        onPageSelect={mockOnPageSelect}
      />
    )

    // Should show truncated content preview
    expect(screen.getByText(/Welcome content preview/)).toBeInTheDocument()
    expect(screen.getByText(/Objective 1/)).toBeInTheDocument()
    expect(screen.getByText(/Topic 1 content/)).toBeInTheDocument()
  })

  it('should highlight the current page', () => {
    render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="topic-1"
        onPageSelect={mockOnPageSelect}
      />
    )

    // Topic 1 should be highlighted
    const topic1Card = screen.getByTestId('page-thumbnail-topic-1')
    expect(topic1Card).toHaveClass('selected')
    
    // Others should not be highlighted
    const welcomeCard = screen.getByTestId('page-thumbnail-welcome')
    expect(welcomeCard).not.toHaveClass('selected')
  })

  it('should show media indicator for pages with media', () => {
    render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="welcome"
        onPageSelect={mockOnPageSelect}
      />
    )

    // Welcome page has media - should show checkmark
    const welcomeCard = screen.getByTestId('page-thumbnail-welcome')
    expect(welcomeCard.querySelector('[data-testid="media-indicator"]')).toBeInTheDocument()
    expect(screen.getByText('✓ Has media')).toBeInTheDocument()

    // Learning objectives has no media - no checkmark
    const objectivesCard = screen.getByTestId('page-thumbnail-objectives')
    expect(objectivesCard.querySelector('[data-testid="media-indicator"]')).not.toBeInTheDocument()

    // Topic 2 has video - should show checkmark
    const topic2Card = screen.getByTestId('page-thumbnail-topic-2')
    expect(topic2Card.querySelector('[data-testid="media-indicator"]')).toBeInTheDocument()
  })

  it('should handle page selection on click', () => {
    render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="welcome"
        onPageSelect={mockOnPageSelect}
      />
    )

    // Click on Topic 1
    const topic1Card = screen.getByTestId('page-thumbnail-topic-1')
    fireEvent.click(topic1Card)

    expect(mockOnPageSelect).toHaveBeenCalledWith('topic-1')
  })

  it('should show page type icons', () => {
    render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="welcome"
        onPageSelect={mockOnPageSelect}
      />
    )

    // Welcome page should have home icon
    const welcomeIcon = screen.getByTestId('page-icon-welcome')
    expect(welcomeIcon).toHaveAttribute('data-icon', 'home')

    // Objectives should have target icon
    const objectivesIcon = screen.getByTestId('page-icon-objectives')
    expect(objectivesIcon).toHaveAttribute('data-icon', 'target')

    // Topics should have number badges
    expect(screen.getByText('1')).toBeInTheDocument() // Topic 1
    expect(screen.getByText('2')).toBeInTheDocument() // Topic 2
  })

  it('should be responsive and show in grid layout', () => {
    const { container } = render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="welcome"
        onPageSelect={mockOnPageSelect}
      />
    )

    const grid = container.querySelector('[data-testid="page-thumbnail-grid"]')
    expect(grid).toHaveStyle({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))'
    })
  })

  it('should show loading skeleton when courseContent is not ready', () => {
    render(
      <PageThumbnailGrid
        courseContent={null as any}
        currentPageId=""
        onPageSelect={mockOnPageSelect}
      />
    )

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
  })

  it('should truncate long content previews', () => {
    const longContent: CourseContent = {
      ...mockCourseContent,
      welcomePage: {
        ...mockCourseContent.welcomePage,
        content: '<p>' + 'Very long content '.repeat(50) + '</p>'
      }
    }

    render(
      <PageThumbnailGrid
        courseContent={longContent}
        currentPageId="welcome"
        onPageSelect={mockOnPageSelect}
      />
    )

    const preview = screen.getByTestId('content-preview-welcome')
    const text = preview.textContent || ''
    
    // Should be truncated to ~100 characters
    expect(text.length).toBeLessThanOrEqual(103) // 100 + "..."
    expect(text).toContain('...')
  })

  it('should show media count badge when multiple media items exist', () => {
    const multiMediaContent: CourseContent = {
      ...mockCourseContent,
      topics: [{
        ...mockCourseContent.topics[0],
        media: [
          { id: '1', type: 'image', url: 'img1.jpg', title: 'Image 1' },
          { id: '2', type: 'image', url: 'img2.jpg', title: 'Image 2' },
          { id: '3', type: 'video', url: 'vid1.mp4', title: 'Video 1' }
        ]
      }]
    }

    render(
      <PageThumbnailGrid
        courseContent={multiMediaContent}
        currentPageId="welcome"
        onPageSelect={mockOnPageSelect}
      />
    )

    // Should show media count
    expect(screen.getByText('3 media items')).toBeInTheDocument()
  })
})