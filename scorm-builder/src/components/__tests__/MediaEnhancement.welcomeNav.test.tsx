import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MediaEnhancementWizard } from '../MediaEnhancementWizardRefactored'
import { CourseContent } from '../../types/aiPrompt'

describe('MediaEnhancementWizard - Welcome/Objectives Navigation', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Welcome content here</p>',
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
      content: '<p>Objectives content here</p>',
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
        content: '<p>Topic 1 content here</p>',
        narration: 'Topic 1 narration',
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

  it('should include welcome and objectives in page count', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Should show "Page 1 of 3" initially
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
  })

  it('should display welcome page initially', () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Should show welcome title and content
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    expect(screen.getByText('Welcome content here')).toBeInTheDocument()
  })

  it('should navigate to objectives when clicking next', async () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Click next button
    const nextButton = screen.getByText('Next Topic →')
    fireEvent.click(nextButton)
    
    // Wait for state update and check for objectives content
    await waitFor(() => {
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    })
    
    // Should now show objectives
    await waitFor(() => {
      expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
    })
    
    await waitFor(() => {
      expect(screen.getByText('Objectives content here')).toBeInTheDocument()
    })
  })

  it('should navigate through all pages', async () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Start at welcome (Topic 1 of 3)
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    
    // Navigate to objectives
    fireEvent.click(screen.getByText('Next Topic →'))
    await waitFor(() => {
      expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    })
    
    // Navigate to topic 1
    fireEvent.click(screen.getByText('Next Topic →'))
    await waitFor(() => {
      expect(screen.getByText('Topic 1')).toBeInTheDocument()
      expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()
    })
  })
})