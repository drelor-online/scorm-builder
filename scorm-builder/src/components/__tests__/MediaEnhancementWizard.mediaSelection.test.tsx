import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'

// Mock search service
vi.mock('../../services/searchService', () => ({
  searchGoogleImages: vi.fn().mockResolvedValue({
    results: [
      {
        id: 'img-1',
        url: 'https://example.com/image1.jpg',
        title: 'Test Image 1',
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        width: 800,
        height: 600
      },
      {
        id: 'img-2',
        url: 'https://example.com/image2.jpg',
        title: 'Test Image 2',
        thumbnailUrl: 'https://example.com/thumb2.jpg',
        width: 800,
        height: 600
      }
    ],
    totalResults: 2
  }),
  searchYouTubeVideos: vi.fn().mockResolvedValue({
    results: [
      {
        id: 'vid-1',
        url: 'https://youtube.com/watch?v=test1',
        title: 'Test Video 1',
        thumbnailUrl: 'https://i.ytimg.com/vi/test1/hqdefault.jpg',
        channel: 'Test Channel',
        duration: '5:00'
      }
    ],
    totalResults: 1
  })
}))

// Mock media context
const mockStoreExternalMedia = vi.fn().mockResolvedValue({
  id: 'stored-media-1',
  storageId: 'storage-1',
  url: 'https://example.com/image1.jpg',
  type: 'image'
})

const mockStoreYouTubeVideo = vi.fn().mockResolvedValue({
  id: 'stored-video-1',
  storageId: 'storage-2',
  url: 'https://youtube.com/watch?v=test1',
  type: 'video'
})

vi.mock('../../contexts/UnifiedMediaContext', () => ({
  UnifiedMediaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useUnifiedMedia: () => ({
    listMedia: vi.fn().mockResolvedValue([]),
    getMediaForPage: vi.fn().mockReturnValue([]),
    storeMedia: vi.fn(),
    deleteMedia: vi.fn(),
    createBlobUrl: vi.fn(),
    revokeBlobUrl: vi.fn(),
    getMediaUrl: vi.fn(),
    storeExternalMedia: mockStoreExternalMedia,
    storeYouTubeVideo: mockStoreYouTubeVideo
  })
}))

const mockCourseContent = {
  welcomePage: {
    id: 'welcome',
    title: 'Welcome',
    content: 'Welcome content',
    media: []
  },
  learningObjectivesPage: {
    id: 'objectives',
    title: 'Objectives', 
    content: 'Objectives content',
    media: []
  },
  topics: []
}

describe('MediaEnhancementWizard - Media Selection', () => {
  const mockOnComplete = vi.fn()
  const mockOnPageChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow clicking on image search results to add to page', async () => {
    render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider>
          <StepNavigationProvider>
            <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onComplete={mockOnComplete}
            currentPageIndex={0}
            onPageChange={mockOnPageChange}
          />
          </StepNavigationProvider>
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Enter search query
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'test image' } })

    // Click search button
    const searchButton = screen.getByText(/Search/i)
    fireEvent.click(searchButton)

    // Wait for search results
    await waitFor(() => {
      expect(screen.getByText('Test Image 1')).toBeInTheDocument()
    })

    // Click on first image result
    const firstImage = screen.getByText('Test Image 1').closest('div')
    expect(firstImage).toHaveStyle({ cursor: 'pointer' })
    
    fireEvent.click(firstImage!)

    // Should call storeExternalMedia
    await waitFor(() => {
      expect(mockStoreExternalMedia).toHaveBeenCalledWith(
        'https://example.com/image1.jpg',
        'Test Image 1'
      )
    })

    // Should show success indicator
    expect(screen.getByText(/added to page/i)).toBeInTheDocument()
  })

  it('should allow clicking on video search results to add to page', async () => {
    render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider>
          <StepNavigationProvider>
            <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onComplete={mockOnComplete}
            currentPageIndex={0}
            onPageChange={mockOnPageChange}
          />
          </StepNavigationProvider>
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Switch to video search
    const videoTab = screen.getByText(/Videos/i)
    fireEvent.click(videoTab)

    // Enter search query
    const searchInput = screen.getByPlaceholderText(/search for videos/i)
    fireEvent.change(searchInput, { target: { value: 'test video' } })

    // Click search button
    const searchButton = screen.getByText(/Search/i)
    fireEvent.click(searchButton)

    // Wait for search results
    await waitFor(() => {
      expect(screen.getByText('Test Video 1')).toBeInTheDocument()
    })

    // Click on video result
    const videoResult = screen.getByText('Test Video 1').closest('div')
    expect(videoResult).toHaveStyle({ cursor: 'pointer' })
    
    fireEvent.click(videoResult!)

    // Should call storeYouTubeVideo
    await waitFor(() => {
      expect(mockStoreYouTubeVideo).toHaveBeenCalledWith(
        'https://youtube.com/watch?v=test1',
        'Test Video 1'
      )
    })
  })

  it('should show visual feedback when media is selected', async () => {
    render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider>
          <StepNavigationProvider>
            <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onComplete={mockOnComplete}
            currentPageIndex={0}
            onPageChange={mockOnPageChange}
          />
          </StepNavigationProvider>
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Search for images
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'test' } })
    fireEvent.click(screen.getByText(/Search/i))

    await waitFor(() => {
      expect(screen.getByText('Test Image 1')).toBeInTheDocument()
    })

    // Click on image
    const imageResult = screen.getByText('Test Image 1').closest('div')
    fireEvent.click(imageResult!)

    // Should show selected state
    await waitFor(() => {
      expect(imageResult).toHaveClass('selected')
      // Or check for visual indicator
      expect(imageResult?.querySelector('[data-selected="true"]')).toBeInTheDocument()
    })
  })

  it('should disable selection while media is being stored', async () => {
    mockStoreExternalMedia.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ id: 'test' }), 1000))
    )

    render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider>
          <StepNavigationProvider>
            <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onComplete={mockOnComplete}
            currentPageIndex={0}
            onPageChange={mockOnPageChange}
          />
          </StepNavigationProvider>
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Search and get results
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'test' } })
    fireEvent.click(screen.getByText(/Search/i))

    await waitFor(() => {
      expect(screen.getByText('Test Image 1')).toBeInTheDocument()
    })

    // Click on first image
    const firstImage = screen.getByText('Test Image 1').closest('div')
    fireEvent.click(firstImage!)

    // Should show loading state
    expect(screen.getByText(/adding/i)).toBeInTheDocument()

    // Other images should be disabled
    const secondImage = screen.getByText('Test Image 2').closest('div')
    expect(secondImage).toHaveStyle({ pointerEvents: 'none' })
  })
})