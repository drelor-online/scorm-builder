import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../test/testProviders'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { CourseContent } from '../../types/aiPrompt'

describe('MediaEnhancementWizard - Navigation', () => {
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
      },
      {
        id: 'topic-2',
        title: 'Topic 2',
        content: '<p>Topic 2 content</p>',
        narration: 'Topic 2 narration',
        imageKeywords: ['topic2'],
        imagePrompts: ['Topic 2 prompt'],
        videoSearchTerms: ['topic 2 video'],
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

  it('should start with Welcome page', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    expect(screen.getByText(/Welcome content/)).toBeInTheDocument()
  })

  it('should navigate through all pages including Welcome and Learning Objectives', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Should start at Welcome
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    
    // Navigate to Learning Objectives
    fireEvent.click(screen.getByText('Next Topic →'))
    expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
    expect(screen.getByText(/Objectives content/)).toBeInTheDocument()
    
    // Navigate to Topic 1
    fireEvent.click(screen.getByText('Next Topic →'))
    expect(screen.getByText('Topic 1')).toBeInTheDocument()
    
    // Navigate to Topic 2
    fireEvent.click(screen.getByText('Next Topic →'))
    expect(screen.getByText('Topic 2')).toBeInTheDocument()
    
    // Should not have Next Topic button on last topic
    expect(screen.queryByText('Next Topic →')).not.toBeInTheDocument()
  })

  it('should navigate backwards through all pages', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Navigate to Topic 2
    fireEvent.click(screen.getByText('Next Topic →')) // to objectives
    fireEvent.click(screen.getByText('Next Topic →')) // to topic 1
    fireEvent.click(screen.getByText('Next Topic →')) // to topic 2
    
    // Navigate back to Topic 1
    fireEvent.click(screen.getByText('← Previous Topic'))
    expect(screen.getByText('Topic 1')).toBeInTheDocument()
    
    // Navigate back to Learning Objectives
    fireEvent.click(screen.getByText('← Previous Topic'))
    expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
    
    // Navigate back to Welcome
    fireEvent.click(screen.getByText('← Previous Topic'))
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    
    // Should not have Previous Topic button on first page
    expect(screen.queryByText('← Previous Topic')).not.toBeInTheDocument()
  })

  it('should include Welcome and Learning Objectives in page count', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Total pages should be 4: Welcome, Learning Objectives, Topic 1, Topic 2
    expect(screen.getByText('Page 1 of 4')).toBeInTheDocument()
    
    // Navigate and check page numbers
    fireEvent.click(screen.getByText('Next Topic →'))
    expect(screen.getByText('Page 2 of 4')).toBeInTheDocument()
    
    fireEvent.click(screen.getByText('Next Topic →'))
    expect(screen.getByText('Page 3 of 4')).toBeInTheDocument()
    
    fireEvent.click(screen.getByText('Next Topic →'))
    expect(screen.getByText('Page 4 of 4')).toBeInTheDocument()
  })
})