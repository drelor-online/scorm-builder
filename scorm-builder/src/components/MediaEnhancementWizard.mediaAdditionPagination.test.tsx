import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render } from '../test/testProviders'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'

// Mock the search services
const mockGoogleResults = [
  { id: 'image-1', title: 'Test Image 1', url: 'https://example.com/image1.jpg', thumbnail: 'https://example.com/thumb1.jpg' },
  { id: 'image-2', title: 'Test Image 2', url: 'https://example.com/image2.jpg', thumbnail: 'https://example.com/thumb2.jpg' },
  { id: 'image-3', title: 'Test Image 3', url: 'https://example.com/image3.jpg', thumbnail: 'https://example.com/thumb3.jpg' }
]

vi.mock('../services/searchService', () => ({
  searchGoogleImages: vi.fn().mockImplementation((query, page) => {
    // Simulate different results for different pages
    if (page === 1) {
      return Promise.resolve(mockGoogleResults.slice(0, 2))
    } else if (page === 2) {
      return Promise.resolve([mockGoogleResults[2]]) // Only one result on page 2
    }
    return Promise.resolve([])
  }),
  searchYouTubeVideos: vi.fn().mockResolvedValue([])
}))

vi.mock('../services/MediaService', () => {
  const mockMediaService = {
    storeMedia: vi.fn().mockResolvedValue({ id: 'stored-1', fileName: 'test.jpg' }),
    storeYouTubeVideo: vi.fn().mockResolvedValue({ id: 'stored-video-1', fileName: 'video.mp4' }),
    getMedia: vi.fn().mockResolvedValue({ id: 'stored-1', fileName: 'test.jpg' }),
    deleteMedia: vi.fn().mockResolvedValue(undefined),
    listMediaForPage: vi.fn().mockResolvedValue([]),
    listAllMedia: vi.fn().mockResolvedValue([]),
    getMediaUrl: vi.fn().mockResolvedValue('blob:mock-url'),
    clearCache: vi.fn(),
    getStorageInfo: vi.fn().mockResolvedValue({ totalSize: 0, itemCount: 0 })
  }
  
  return {
    MediaService: mockMediaService,
    createMediaService: vi.fn().mockReturnValue(mockMediaService)
  }
})

// Mock fetch for image downloads
global.fetch = vi.fn().mockImplementation((url) => {
  if (typeof url === 'string' && url.includes('example.com')) {
    return Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob(['mock image data'], { type: 'image/jpeg' }))
    })
  }
  return Promise.reject(new Error('Fetch not mocked for this URL'))
})

const mockCourseContent = {
  title: 'Test Course',
  description: 'Test Description',
  welcomePage: {
    title: 'Welcome',
    content: 'Welcome content'
  },
  learningObjectivesPage: {
    title: 'Learning Objectives', 
    content: 'Objectives content'
  },
  topics: [
    {
      title: 'Topic 1',
      content: 'Topic 1 content',
      media: []
    }
  ]
}

const defaultProps = {
  currentPageIndex: 2, // Topic 1 (0=welcome, 1=objectives, 2=topic1)
  courseContent: mockCourseContent,
  onUpdateContent: vi.fn(),
  onSave: vi.fn()
}

const renderWithProvider = (props = {}) => {
  return render(<MediaEnhancementWizard {...defaultProps} {...props} />)
}

describe('MediaEnhancementWizard - Media Addition on Pagination Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow media clicks during initial search and after search completion', async () => {
    // This test verifies that the fix allows media clicks after search
    renderWithProvider()

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Add New Media')).toBeInTheDocument()
    })

    // Navigate to the images tab
    const imagesTab = screen.getByRole('tab', { name: /images/i })
    fireEvent.click(imagesTab)

    // Search for images
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'test images' } })
    
    const searchButton = screen.getByRole('button', { name: /search/i })
    fireEvent.click(searchButton)

    // Wait for results and verify they become clickable after search completes
    await waitFor(() => {
      expect(screen.getByText('Test Image 1')).toBeInTheDocument()
    })

    // Verify that search results are clickable (not in loading state) after search completes
    const results = screen.getAllByTestId(/search-result-/)
    expect(results.length).toBeGreaterThan(0)
    
    // FIXED: Results should NOT have the 'resultCardSearching' class after search completes
    results.forEach((result, index) => {
      expect(result).not.toHaveClass('resultCardSearching')
    })

    // Test that clicking on a result opens the lightbox (media addition workflow)
    fireEvent.click(results[0])

    await waitFor(() => {
      // Lightbox should open for media preview
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Should have Set Media button in lightbox (since there's no existing media)
    expect(screen.getByRole('button', { name: /set media/i })).toBeInTheDocument()
  })
})