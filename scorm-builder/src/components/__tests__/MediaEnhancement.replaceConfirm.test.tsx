import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent , waitFor } from '../../test/testProviders'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { CourseContent } from '../../types/aiPrompt'

describe('MediaEnhancementWizard - Replace Media Confirmation', () => {
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
        url: 'https://example.com/existing-image.jpg',
        title: 'Existing Image'
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

  it('should show replacement confirmation when trying to add media to a page that already has media', async () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Verify existing media is shown
    expect(screen.getByText('✓ Media has been added to this topic')).toBeInTheDocument()
    
    // Click on Upload Media button to trigger file selection
    const uploadInput = screen.getByLabelText('Upload media file')
    const file = new File(['dummy content'], 'new-image.jpg', { type: 'image/jpeg' })
    
    // Simulate file selection
    fireEvent.change(uploadInput, { target: { files: [file] } })
    
    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText('Replace Media')).toBeInTheDocument()
      expect(screen.getByText('This topic already has media. Do you want to replace it with the new selection?')).toBeInTheDocument()
    })
    
    // Verify both buttons are present
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
  })

  it('should not replace media if user cancels', async () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Verify existing media
    expect(screen.getByText('✓ Media has been added to this topic')).toBeInTheDocument()
    
    // Try to upload new media
    const uploadInput = screen.getByLabelText('Upload media file')
    const file = new File(['dummy content'], 'new-image.jpg', { type: 'image/jpeg' })
    fireEvent.change(uploadInput, { target: { files: [file] } })
    
    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText('Replace Media')).toBeInTheDocument()
    })
    
    // Click cancel
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)
    
    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText('Replace Media')).not.toBeInTheDocument()
    })
    
    // Original media should still be present
    expect(screen.getByText('✓ Media has been added to this topic')).toBeInTheDocument()
  })

  it('should not show confirmation when adding media to a page without existing media', async () => {
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Navigate to a page without media (objectives)
    fireEvent.click(screen.getByText('Next Topic →'))
    
    // Verify no media exists
    expect(screen.getByText(/no media added yet/i)).toBeInTheDocument()
    
    // Upload media
    const uploadInput = screen.getByLabelText('Upload media file')
    const file = new File(['dummy content'], 'new-image.jpg', { type: 'image/jpeg' })
    fireEvent.change(uploadInput, { target: { files: [file] } })
    
    // No confirmation dialog should appear
    await waitFor(() => {
      expect(screen.queryByText('Replace Media')).not.toBeInTheDocument()
    })
    
    // Media should be added directly
    await waitFor(() => {
      expect(screen.getByText('✓ Media has been added to this topic')).toBeInTheDocument()
    })
  })
})