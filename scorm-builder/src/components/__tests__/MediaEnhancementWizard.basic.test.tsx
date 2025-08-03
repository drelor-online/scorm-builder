import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen , waitFor } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { CourseContent } from '../../types/aiPrompt'
import { CourseSeedData } from '../../types/course'
import { searchGoogleImages, searchYouTubeVideos, SearchError } from '../../services/searchService'

// Mock the search service
vi.mock('../../services/searchService', () => ({
  searchGoogleImages: vi.fn(),
  searchYouTubeVideos: vi.fn(),
  SearchError: class SearchError extends Error {
    constructor(message: string, public readonly code: string, public readonly statusCode?: number) {
      super(message)
      this.name = 'SearchError'
    }
  }
}))

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html
  }
}))

describe('MediaEnhancementWizard - Basic Tests', () => {
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()
  const mockOnSettingsClick = vi.fn()
  const mockOnSave = vi.fn()
  const mockOnOpen = vi.fn()
  const mockOnHelp = vi.fn()
  const mockOnStepClick = vi.fn()

  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome to Test Course',
      content: '<p>Welcome content</p>',
      narration: 'Welcome narration',
      imageKeywords: ['welcome', 'introduction'],
      imagePrompts: ['Welcome banner image'],
      videoSearchTerms: ['welcome video'],
      duration: 2
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<ul><li>Objective 1</li></ul>',
      narration: 'Objectives narration',
      imageKeywords: ['objectives'],
      imagePrompts: ['Learning objectives visual'],
      videoSearchTerms: [],
      duration: 3
    },
    topics: [{
      id: 'topic-1',
      title: 'Topic 1',
      content: '<p>Topic content</p>',
      narration: 'Topic narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5,
      imageKeywords: ['topic1'],
      imagePrompts: ['Topic 1 illustration'],
      videoSearchTerms: ['topic 1 video'],
      duration: 5
    }],
    assessment: {
      questions: [{
        id: 'q1',
        type: 'multiple-choice',
        question: 'Test question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        feedback: {
          correct: 'Correct!',
          incorrect: 'Try again'
        }
      }],
      passMark: 80
    }
  }

  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: ['Topic 1'],
    template: 'None',
    templateTopics: []
  }

  const mockApiKeys = {
    googleImageApiKey: 'test-google-key',
    googleCseId: 'test-cse-id',
    youtubeApiKey: 'test-youtube-key'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock successful searches by default
    vi.mocked(searchGoogleImages).mockResolvedValue([
      {
        id: 'img1',
        url: 'https://example.com/image1.jpg',
        title: 'Test Image 1',
        thumbnail: 'https://example.com/thumb1.jpg',
        source: 'example.com'
      }
    ])
    vi.mocked(searchYouTubeVideos).mockResolvedValue([
      {
        id: 'vid1',
        url: 'https://youtube.com/watch?v=test1',
        title: 'Test Video 1',
        thumbnail: 'https://i.ytimg.com/vi/test1/default.jpg',
        embedUrl: 'https://www.youtube.com/embed/test1',
        channel: 'Test Channel',
        views: '1000',
        uploadedAt: '2024-01-01',
        duration: '5:00'
      }
    ])
  })

  it('should render the media enhancement wizard', () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    expect(screen.getByText('Media Enhancement')).toBeInTheDocument()
    expect(screen.getByText(/Add media to enhance your course content/i)).toBeInTheDocument()
  })

  it('should display current page title in card', () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    // Should show welcome page by default
    expect(screen.getByText('Welcome to Test Course')).toBeInTheDocument()
  })

  it('should search for images when search button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    // Enter search query
    const searchInput = screen.getByPlaceholderText('Search for images...')
    await user.type(searchInput, 'test image')

    // Click search button - find the one with aria-label
    const searchButton = screen.getByRole('button', { name: 'Search images' })
    await user.click(searchButton)

    // Verify search was called
    await waitFor(() => {
      expect(searchGoogleImages).toHaveBeenCalledWith(
        'test image',
        1,
        'test-google-key',
        'test-cse-id'
      )
    })
  })

  it('should display search results', async () => {
    const user = userEvent.setup()
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    // Search for images
    const searchInput = screen.getByPlaceholderText('Search for images...')
    await user.type(searchInput, 'test')
    await user.click(screen.getByRole('button', { name: 'Search images' }))

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Test Image 1')).toBeInTheDocument()
    })
  })

  it('should navigate back when back button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    const backButton = screen.getByTestId('back-button')
    await user.click(backButton)

    expect(mockOnBack).toHaveBeenCalled()
  })

  it('should navigate to next step when next button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    const nextButton = screen.getByTestId('next-button')
    await user.click(nextButton)

    expect(mockOnNext).toHaveBeenCalledWith(mockCourseContent)
  })

  it('should handle search errors gracefully', async () => {
    const user = userEvent.setup()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Mock search failure with SearchError
    vi.mocked(searchGoogleImages).mockRejectedValue(
      new SearchError('Search failed', 'NETWORK_ERROR')
    )

    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    // Try to search
    const searchInput = screen.getByPlaceholderText('Search for images...')
    await user.type(searchInput, 'test')
    await user.click(screen.getByRole('button', { name: 'Search images' }))

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument()
    })

    consoleErrorSpy.mockRestore()
  })

  it('should have both image and video search sections visible in search mode', () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    // Both search sections should be visible when in search mode
    expect(screen.getByPlaceholderText('Search for images...')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search for videos...')).toBeInTheDocument()
  })

  it('should show media library when library button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    // Click on Media Library button
    const libraryButton = screen.getByText('Media Library')
    await user.click(libraryButton)

    // Should hide the search sections when library is active
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search for images...')).not.toBeInTheDocument()
    })
  })
})