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

  it('should display welcome page in the topics list', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Check that welcome page appears
    expect(screen.getByText('Welcome')).toBeInTheDocument()
  })

  it('should display learning objectives page in the topics list', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Navigate to objectives page first
    const nextButton = screen.getByText('Next Topic →')
    fireEvent.click(nextButton)
    
    // Check that objectives page appears
    expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
  })

  it('should display all topics including welcome and objectives', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Start at welcome page
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    
    // Navigate to objectives page
    fireEvent.click(screen.getByText('Next Topic →'))
    expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
    
    // Navigate to topic 1
    fireEvent.click(screen.getByText('Next Topic →'))
    expect(screen.getByText('Topic 1')).toBeInTheDocument()
  })

  it('should show media enhancement options for welcome page', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Welcome page is shown by default
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    
    // Should have media options
    expect(screen.getByText('Image Search')).toBeInTheDocument()
    expect(screen.getByText('Video Search')).toBeInTheDocument()
    expect(screen.getByText('Upload Media')).toBeInTheDocument()
  })

  it('should show media enhancement options for objectives page', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Navigate to objectives page
    fireEvent.click(screen.getByText('Next Topic →'))
    
    // Check that objectives page is shown
    expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
    
    // Should have media options
    expect(screen.getByText('Image Search')).toBeInTheDocument()
    expect(screen.getByText('Video Search')).toBeInTheDocument()
    expect(screen.getByText('Upload Media')).toBeInTheDocument()
  })
})