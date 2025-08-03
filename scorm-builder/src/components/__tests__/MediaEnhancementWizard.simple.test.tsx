import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { CourseContent } from '../../types/aiPrompt'
import { CourseSeedData } from '../../types/course'

// Mock the search service
vi.mock('../../services/searchService', () => ({
  searchGoogleImages: vi.fn().mockResolvedValue({ results: [] }),
  searchYouTubeVideos: vi.fn().mockResolvedValue({ results: [] })
}))

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html
  }
}))

describe('MediaEnhancementWizard - Simple Tests', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Welcome</p>',
      narration: 'Welcome',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 2
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Objectives',
      content: '<p>Objectives</p>',
      narration: 'Objectives',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3
    },
    topics: [],
    assessment: {
      questions: [],
      passMark: 80
    }
  }

  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test',
    difficulty: 3,
    customTopics: [],
    template: 'None',
    templateTopics: []
  }

  it('should render without crashing', () => {
    const mockOnNext = vi.fn()
    const mockOnBack = vi.fn()
    
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Should show the page title
    expect(screen.getByText('Media Enhancement')).toBeInTheDocument()
  })

  it('should call onBack when back button is clicked', async () => {
    const mockOnNext = vi.fn()
    const mockOnBack = vi.fn()
    const user = userEvent.setup()
    
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    const backButton = screen.getByTestId('back-button')
    await user.click(backButton)

    expect(mockOnBack).toHaveBeenCalled()
  })

  it('should call onNext when next button is clicked', async () => {
    const mockOnNext = vi.fn()
    const mockOnBack = vi.fn()
    const user = userEvent.setup()
    
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    const nextButton = screen.getByTestId('next-button')
    await user.click(nextButton)

    expect(mockOnNext).toHaveBeenCalledWith(mockCourseContent)
  })

  it('should show search tabs', () => {
    const mockOnNext = vi.fn()
    const mockOnBack = vi.fn()
    
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    // Should have tabs for different media types
    expect(screen.getByRole('button', { name: /image/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /video/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /library/i })).toBeInTheDocument()
  })
})