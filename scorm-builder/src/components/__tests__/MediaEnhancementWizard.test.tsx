import { render, screen, fireEvent , waitFor } from './../../test/testProviders'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { CourseContent } from '../../types/aiPrompt'

describe('MediaEnhancementWizard - Remove Media Confirmation', () => {
  const mockCourseContent: CourseContent = {
    topics: [{
      id: '1',
      title: 'Test Topic',
      content: '<p>Test content</p>',
      narration: 'Test narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5,
      imageKeywords: ['test'],
      imagePrompts: ['test prompt'],
      videoSearchTerms: ['test video'],
      duration: 120,
      media: [{
        id: 'test-media-1',
        type: 'image',
        url: 'https://example.com/image.jpg',
        title: 'Test Image'
      }]
    }],
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Welcome</p>',
      narration: 'Welcome narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 60,
      media: []
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<p>Objectives</p>',
      narration: 'Objectives narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 60,
      media: []
    },
    assessment: {
      questions: [],
      passMark: 80,
      narration: null
    }
  }

  beforeEach(() => {
    // Mock window.confirm
    global.confirm = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should not remove media when user cancels confirmation', async () => {
    const mockOnNext = vi.fn()
    vi.mocked(global.confirm).mockReturnValue(false)

    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={() => {}}
      />
    )

    // Navigate to the topic with media
    const nextTopicButton = screen.getByText('Next Topic →')
    fireEvent.click(nextTopicButton)
    fireEvent.click(nextTopicButton)

    // Verify media is present
    expect(screen.getByText('✓ Media has been added to this topic')).toBeInTheDocument()
    expect(screen.getByAltText('Test Image')).toBeInTheDocument()

    // Click Remove Media button
    const removeButton = screen.getByText('Remove Media')
    fireEvent.click(removeButton)

    // Wait for async operations
    await waitFor(() => {
      expect(global.confirm).toHaveBeenCalledWith(
        'Are you sure you want to remove the media from this topic? This action cannot be undone.'
      )
    })

    // Verify media is still present after canceling
    expect(screen.getByText('✓ Media has been added to this topic')).toBeInTheDocument()
    expect(screen.getByAltText('Test Image')).toBeInTheDocument()
  })

  it('should only remove media after user confirms', async () => {
    const mockOnNext = vi.fn()
    vi.mocked(global.confirm).mockReturnValue(true)

    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={() => {}}
      />
    )

    // Navigate to the topic with media
    const nextTopicButton = screen.getByText('Next Topic →')
    fireEvent.click(nextTopicButton)
    fireEvent.click(nextTopicButton)

    // Verify media is present
    expect(screen.getByText('✓ Media has been added to this topic')).toBeInTheDocument()

    // Click Remove Media button
    const removeButton = screen.getByText('Remove Media')
    fireEvent.click(removeButton)

    // Wait for async operations
    await waitFor(() => {
      expect(global.confirm).toHaveBeenCalled()
    })

    // Verify media is removed after confirming
    await waitFor(() => {
      expect(screen.getByText('No media added yet. Use the search below or upload your own.')).toBeInTheDocument()
    })
    expect(screen.queryByAltText('Test Image')).not.toBeInTheDocument()
  })

  it('should handle prop updates without losing media state', async () => {
    const mockOnNext = vi.fn()
    const { rerender } = render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={() => {}}
      />
    )

    // Navigate to topic
    const nextTopicButton = screen.getByText('Next Topic →')
    fireEvent.click(nextTopicButton)
    fireEvent.click(nextTopicButton)

    // Verify media is present
    expect(screen.getByText('✓ Media has been added to this topic')).toBeInTheDocument()

    // Simulate prop update (parent re-render with same content)
    rerender(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={() => {}}
      />
    )

    // Media should still be present after re-render
    expect(screen.getByText('✓ Media has been added to this topic')).toBeInTheDocument()
    expect(screen.getByAltText('Test Image')).toBeInTheDocument()
  })
})