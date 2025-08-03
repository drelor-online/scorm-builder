import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../test/testProviders'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { CourseContent } from '../../types/aiPrompt'
import * as searchService from '../../services/searchService'

// Mock search services
vi.mock('../../services/searchService', () => ({
  searchGoogleImages: vi.fn(),
  searchYouTubeVideos: vi.fn()
}))

describe('MediaEnhancementWizard - Tabbed Interface', () => {
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()
  
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Welcome</p>',
      narration: '',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 2,
      media: []
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Objectives',
      content: '<p>Objectives</p>',
      narration: '',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3,
      media: []
    },
    topics: [],
    assessment: { questions: [], passMark: 80 }
  }

  const mockApiKeys = {
    googleImageApiKey: 'test-key',
    googleCseId: 'test-cse',
    youtubeApiKey: 'test-youtube'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show three tabs for Images, Videos, and Upload', () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    // Should have tab navigation
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    
    // Should have three tabs
    expect(screen.getByRole('tab', { name: 'Search Images' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Search Videos' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Upload Files' })).toBeInTheDocument()
  })

  it('should show Images tab content by default', () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    // Images tab should be active
    const imagesTab = screen.getByRole('tab', { name: 'Search Images' })
    expect(imagesTab).toHaveAttribute('aria-selected', 'true')
    
    // Should show image search input
    expect(screen.getByPlaceholderText('Search for images...')).toBeInTheDocument()
    
    // Should not show video search or upload inputs
    expect(screen.queryByPlaceholderText('Search for videos...')).not.toBeInTheDocument()
    expect(screen.queryByText('Drop files here or click to upload')).not.toBeInTheDocument()
  })

  it('should switch to Videos tab when clicked', async () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    // Click Videos tab
    const videosTab = screen.getByRole('tab', { name: 'Search Videos' })
    fireEvent.click(videosTab)

    // Videos tab should be active
    await waitFor(() => {
      expect(videosTab).toHaveAttribute('aria-selected', 'true')
    })
    
    // Should show video search input
    expect(screen.getByPlaceholderText('Search for videos...')).toBeInTheDocument()
    
    // Should not show image search
    expect(screen.queryByPlaceholderText('Search for images...')).not.toBeInTheDocument()
  })

  it('should switch to Upload tab when clicked', async () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    // Click Upload tab
    const uploadTab = screen.getByRole('tab', { name: 'Upload Files' })
    fireEvent.click(uploadTab)

    // Upload tab should be active
    await waitFor(() => {
      expect(uploadTab).toHaveAttribute('aria-selected', 'true')
    })
    
    // Should show upload area
    expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument()
    expect(screen.getByText('Drop files here or click to upload')).toBeInTheDocument()
    
    // Should show accepted file types
    expect(screen.getByText('Accepted: Images (JPG, PNG, GIF) and Videos (MP4, MOV)')).toBeInTheDocument()
  })

  it('should show tab icons', () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    // Each tab should have an icon
    const imagesTab = screen.getByRole('tab', { name: 'Search Images' })
    const videosTab = screen.getByRole('tab', { name: 'Search Videos' })
    const uploadTab = screen.getByRole('tab', { name: 'Upload Files' })
    
    expect(imagesTab.querySelector('[data-testid="image-icon"]')).toBeInTheDocument()
    expect(videosTab.querySelector('[data-testid="video-icon"]')).toBeInTheDocument()
    expect(uploadTab.querySelector('[data-testid="upload-icon"]')).toBeInTheDocument()
  })

  it('should maintain search results when switching tabs', async () => {
    const mockImages = [
      { id: '1', url: 'img1.jpg', title: 'Image 1', thumbnail: 'thumb1.jpg' }
    ]
    vi.mocked(searchService.searchGoogleImages).mockResolvedValue(mockImages)

    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    // Search for images
    const searchInput = screen.getByPlaceholderText('Search for images...')
    fireEvent.change(searchInput, { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Image 1')).toBeInTheDocument()
    })

    // Switch to Videos tab
    fireEvent.click(screen.getByRole('tab', { name: 'Search Videos' }))

    // Switch back to Images tab
    fireEvent.click(screen.getByRole('tab', { name: 'Search Images' }))

    // Results should still be there
    expect(screen.getByText('Image 1')).toBeInTheDocument()
  })

  it('should show search history dropdown in each tab', () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    // Focus on search input
    const searchInput = screen.getByPlaceholderText('Search for images...')
    fireEvent.focus(searchInput)

    // Should show search history dropdown
    expect(screen.getByTestId('search-history-dropdown')).toBeInTheDocument()
    expect(screen.getByText('Recent searches')).toBeInTheDocument()
  })

  it('should handle keyboard navigation between tabs', () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    const tablist = screen.getByRole('tablist')
    const imagesTab = screen.getByRole('tab', { name: 'Search Images' })
    
    // Focus on first tab
    imagesTab.focus()
    
    // Press right arrow to go to next tab
    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    
    // Videos tab should be focused
    expect(screen.getByRole('tab', { name: 'Search Videos' })).toHaveFocus()
  })

  it('should show tab panel with proper ARIA attributes', () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    // Tab panel should have proper ARIA attributes
    const imagesPanel = screen.getByRole('tabpanel', { name: 'Search Images' })
    expect(imagesPanel).toHaveAttribute('aria-labelledby', expect.stringContaining('images'))
    expect(imagesPanel).toBeVisible()
  })

  it('should show upload progress in Upload tab', async () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    // Switch to Upload tab
    fireEvent.click(screen.getByRole('tab', { name: 'Upload Files' }))

    // Create a mock file
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const input = screen.getByTestId('file-input')
    
    // Trigger file upload
    fireEvent.change(input, { target: { files: [file] } })

    // Should show upload progress
    await waitFor(() => {
      expect(screen.getByTestId('upload-progress')).toBeInTheDocument()
      expect(screen.getByText('Uploading test.jpg...')).toBeInTheDocument()
    })
  })

  it('should style active tab differently', () => {
    const { container } = render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        apiKeys={mockApiKeys}
      />
    )

    const imagesTab = screen.getByRole('tab', { name: 'Search Images' })
    const videosTab = screen.getByRole('tab', { name: 'Search Videos' })
    
    // Active tab should have different styling
    expect(imagesTab).toHaveClass('active')
    expect(videosTab).not.toHaveClass('active')
    
    // Click videos tab
    fireEvent.click(videosTab)
    
    // Now videos should be active
    expect(videosTab).toHaveClass('active')
    expect(imagesTab).not.toHaveClass('active')
  })
})