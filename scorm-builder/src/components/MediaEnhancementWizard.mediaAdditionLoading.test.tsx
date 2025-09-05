import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render } from '../test/testProviders'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'

vi.mock('../services/searchService', () => ({
  searchGoogleImages: vi.fn().mockResolvedValue([
    { id: 'image-1', title: 'Test Image 1', url: 'https://example.com/image1.jpg', thumbnail: 'https://example.com/thumb1.jpg' },
    { id: 'image-2', title: 'Test Image 2', url: 'https://example.com/image2.jpg', thumbnail: 'https://example.com/thumb2.jpg' }
  ]),
  searchYouTubeVideos: vi.fn().mockResolvedValue([])
}))

// Mock MediaService with slow storeMedia to simulate the long loading issue
vi.mock('../services/MediaService', () => {
  const mockMediaService = {
    storeMedia: vi.fn().mockImplementation(() => {
      // Simulate slow media processing (2 seconds)
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ id: 'stored-1', fileName: 'test.jpg' })
        }, 2000)
      })
    }),
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

describe('MediaEnhancementWizard - Media Addition Loading Issue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should reproduce the bug: search button shows "Searching..." during media addition', async () => {
    // This test reproduces the exact issue reported by the user
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

    // Wait for search results
    await waitFor(() => {
      expect(screen.getByText('Test Image 1')).toBeInTheDocument()
    })

    // Verify search button is back to "Search" after search completes
    expect(screen.getByText('Search')).toBeInTheDocument()
    expect(screen.queryByText('Searching...')).not.toBeInTheDocument()

    // Click on a media result to open lightbox
    const mediaResult = screen.getByTestId('search-result-0')
    fireEvent.click(mediaResult)

    // Wait for lightbox to open
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /set media/i })).toBeInTheDocument()
    })

    // Click "Set Media" to trigger media addition - this should start the slow process
    const setMediaButton = screen.getByRole('button', { name: /set media/i })
    fireEvent.click(setMediaButton)

    // BUG REPRODUCTION: The search button should NOT show "Searching..." during media addition
    // But currently it does because addMediaToPage() calls setIsSearching(true)
    await waitFor(() => {
      // This assertion should fail in the buggy version
      expect(screen.queryByText('Searching...')).not.toBeInTheDocument()
    }, { timeout: 500 }) // Quick check - should fail immediately in buggy version

    // BUG REPRODUCTION: Media results should remain clickable during media addition
    // But currently they don't because isSearching=true blocks clicks
    const otherMediaResult = screen.getByTestId('search-result-1')
    
    // This should work but fails in the buggy version because onClick checks !isSearching
    fireEvent.click(otherMediaResult)
    
    // In the buggy version, this will fail because media clicks are blocked
    await waitFor(() => {
      // Should be able to open lightbox for second image
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('should keep media results clickable during slow media addition', async () => {
    renderWithProvider()

    // Set up: Get to the point where we have search results and lightbox open
    await waitFor(() => {
      expect(screen.getByText('Add New Media')).toBeInTheDocument()
    })

    const imagesTab = screen.getByRole('tab', { name: /images/i })
    fireEvent.click(imagesTab)

    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'test images' } })
    
    const searchButton = screen.getByRole('button', { name: /search/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('Test Image 1')).toBeInTheDocument()
    })

    // Open lightbox for first image
    const firstResult = screen.getByTestId('search-result-0')
    fireEvent.click(firstResult)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Start media addition (this will be slow due to our mock)
    const setMediaButton = screen.getByRole('button', { name: /set media/i })
    fireEvent.click(setMediaButton)

    // Verify that OTHER media results are still clickable while addition is in progress
    // (This tests the core issue - media interaction should not be blocked)
    
    // Wait a bit to ensure media addition has started
    await new Promise(resolve => setTimeout(resolve, 100))

    // Try to click second media result - this should work in the fixed version
    const secondResult = screen.getByTestId('search-result-1') 
    
    // In the buggy version, this result will have 'resultCardSearching' class
    // and the onClick will be blocked by !isSearching check
    expect(secondResult).not.toHaveClass('resultCardSearching')
    
    // The click should work (not blocked by isSearching=true)
    fireEvent.click(secondResult)
    
    // Should be able to open lightbox for second result
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Test Image 2')).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('should show appropriate loading state during media addition', async () => {
    renderWithProvider()

    // Get to lightbox state
    await waitFor(() => {
      expect(screen.getByText('Add New Media')).toBeInTheDocument()
    })

    const imagesTab = screen.getByRole('tab', { name: /images/i })
    fireEvent.click(imagesTab)

    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'test images' } })
    
    const searchButton = screen.getByRole('button', { name: /search/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('Test Image 1')).toBeInTheDocument()
    })

    const mediaResult = screen.getByTestId('search-result-0')
    fireEvent.click(mediaResult)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Start media addition
    const setMediaButton = screen.getByRole('button', { name: /set media/i })
    fireEvent.click(setMediaButton)

    // The "Set Media" button should show loading state, NOT the search interface
    await waitFor(() => {
      // In the fixed version, the Set Media button should show "Adding Media..."
      expect(screen.getByText('Adding Media...')).toBeInTheDocument()
    })

    // But the search interface should remain functional
    expect(screen.getByText('Search')).toBeInTheDocument()
    expect(screen.queryByText('Searching...')).not.toBeInTheDocument()
  })
})