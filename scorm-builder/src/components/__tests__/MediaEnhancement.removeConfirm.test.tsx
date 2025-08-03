import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent , waitFor } from '../../test/testProviders'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { CourseContent } from '../../types/aiPrompt'
describe('MediaEnhancementWizard - Remove Media Confirmation', () => {
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
      media: [{
        id: 'media-1',
        type: 'image',
        url: 'https://example.com/image.jpg',
        title: 'Test Image'
      }]
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

  beforeEach(() => {
    // No longer mocking window.confirm since we're using custom dialog
  })

  afterEach(() => {
    // Cleanup
  })

  it('should show confirmation dialog when removing media', async () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Media should be present
    expect(screen.getByText('✓ Media has been added to this topic')).toBeInTheDocument()
    
    // Click remove media button
    const removeButton = screen.getByRole('button', { name: 'Remove Media' })
    fireEvent.click(removeButton)
    
    // Custom dialog should appear with the correct message
    await waitFor(() => {
      expect(screen.getByText('Remove Media')).toBeInTheDocument()
      expect(screen.getByText('Are you sure you want to remove the media from this topic? This action cannot be undone.')).toBeInTheDocument()
    })
    
    // Verify both buttons are present
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('should not remove media if user cancels confirmation', async () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Media should be present
    expect(screen.getByText('✓ Media has been added to this topic')).toBeInTheDocument()
    
    // Click remove media button
    const removeButton = screen.getByRole('button', { name: 'Remove Media' })
    fireEvent.click(removeButton)
    
    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByText('Remove Media')).toBeInTheDocument()
    })
    
    // Click cancel button
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)
    
    // Dialog should disappear
    await waitFor(() => {
      expect(screen.queryByText('Remove Media')).not.toBeInTheDocument()
    })
    
    // Media should still be present
    expect(screen.getByText('✓ Media has been added to this topic')).toBeInTheDocument()
  })

  it('should remove media if user confirms', async () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Media should be present
    expect(screen.getByText('✓ Media has been added to this topic')).toBeInTheDocument()
    
    // Click remove media button
    const removeButton = screen.getByRole('button', { name: 'Remove Media' })
    fireEvent.click(removeButton)
    
    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByText('Remove Media')).toBeInTheDocument()
    })
    
    // Click remove button in dialog
    const confirmRemoveButton = screen.getByRole('button', { name: 'Remove' })
    fireEvent.click(confirmRemoveButton)
    
    // Dialog should disappear
    await waitFor(() => {
      expect(screen.queryByText('Remove Media')).not.toBeInTheDocument()
    })
    
    // Check if the message changes to indicate no media
    await waitFor(() => {
      expect(screen.queryByText('✓ Media has been added to this topic')).not.toBeInTheDocument()
    })
    
    // Now check for the no media message
    expect(screen.getByText(/no media added yet/i)).toBeInTheDocument()
  })

  it('should show confirmation for topics with media', async () => {
    // Add media to topic 1
    const contentWithTopicMedia = {
      ...mockCourseContent,
      topics: [{
        ...mockCourseContent.topics[0],
        media: [{
          id: 'media-2',
          type: 'video' as const,
          url: 'https://example.com/video.mp4',
          title: 'Test Video'
        }]
      }]
    }
    
    render(<MediaEnhancementWizard {...defaultProps} courseContent={contentWithTopicMedia} />)
    
    // Navigate to topic 1
    fireEvent.click(screen.getByText('Next Topic →')) // to objectives
    fireEvent.click(screen.getByText('Next Topic →')) // to topic 1
    
    // Media should be present
    expect(screen.getByText('✓ Media has been added to this topic')).toBeInTheDocument()
    
    // Click remove media button
    const removeButton = screen.getByRole('button', { name: 'Remove Media' })
    fireEvent.click(removeButton)
    
    // Confirm dialog should appear
    await waitFor(() => {
      expect(screen.getByText('Remove Media')).toBeInTheDocument()
      expect(screen.getByText('Are you sure you want to remove the media from this topic? This action cannot be undone.')).toBeInTheDocument()
    })
  })
})