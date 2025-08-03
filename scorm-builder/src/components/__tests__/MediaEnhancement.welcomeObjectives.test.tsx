import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../test/testProviders'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { CourseContent } from '../../types/aiPrompt'

describe('MediaEnhancementWizard - Welcome and Objectives Topics', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Welcome content</p>',
      narration: 'Welcome narration',
      imageKeywords: ['welcome'],
      imagePrompts: ['Welcome prompt'],
      videoSearchTerms: ['welcome video'],
      duration: 2,
      media: []
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<p>Objectives content</p>',
      narration: 'Objectives narration',
      imageKeywords: ['objectives'],
      imagePrompts: ['Objectives prompt'],
      videoSearchTerms: ['objectives video'],
      duration: 3,
      media: []
    },
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: '<p>Topic 1 content</p>',
        narration: 'Topic 1 narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5,
        imageKeywords: ['topic1'],
        imagePrompts: ['Topic 1 prompt'],
        videoSearchTerms: ['topic 1 video'],
        duration: 5,
        media: []
      }
    ],
    assessment: {
      questions: [],
      passMark: 80,
      narration: null
    }
  }

  const mockApiKeys = {
    googleImageApiKey: 'test-key',
    googleCseId: 'test-cse',
    youtubeApiKey: 'test-youtube'
  }

  const defaultProps = {
    courseContent: mockCourseContent,
    onNext: vi.fn(),
    onBack: vi.fn(),
    apiKeys: mockApiKeys
  }

  it('should display welcome page as the first topic', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Check that welcome page appears first
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
  })

  it('should navigate to learning objectives page', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Navigate to next page
    const nextButton = screen.getByText('Next Topic →')
    fireEvent.click(nextButton)
    
    // Should now show objectives page
    expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
  })

  it('should navigate through all pages including topics', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Start at welcome
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    
    // Navigate to objectives
    fireEvent.click(screen.getByText('Next Topic →'))
    expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
    
    // Navigate to topic 1
    fireEvent.click(screen.getByText('Next Topic →'))
    expect(screen.getByText('Topic 1')).toBeInTheDocument()
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()
  })

  it('should show media enhancement options for welcome page', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Welcome page should have media options
    expect(screen.getByText('Image Search')).toBeInTheDocument()
    expect(screen.getByText('Video Search')).toBeInTheDocument()
    expect(screen.getByText('Upload Media')).toBeInTheDocument()
  })

  it('should show media enhancement options for objectives page', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Navigate to objectives
    fireEvent.click(screen.getByText('Next Topic →'))
    
    // Objectives page should have media options
    expect(screen.getByText('Image Search')).toBeInTheDocument()
    expect(screen.getByText('Video Search')).toBeInTheDocument()
    expect(screen.getByText('Upload Media')).toBeInTheDocument()
  })

  it('should not show previous button on first page', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Previous button should not exist on first page
    const prevButton = screen.queryByText('← Previous Topic')
    expect(prevButton).not.toBeInTheDocument()
  })

  it('should not show next button on last page', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Navigate to last page
    fireEvent.click(screen.getByText('Next Topic →')) // to objectives
    fireEvent.click(screen.getByText('Next Topic →')) // to topic 1
    
    // Next button should not exist on last page
    const nextButton = screen.queryByText('Next Topic →')
    expect(nextButton).not.toBeInTheDocument()
  })
})