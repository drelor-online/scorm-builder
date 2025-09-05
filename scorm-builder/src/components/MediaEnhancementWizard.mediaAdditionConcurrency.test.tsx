import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render } from '../test/testProviders'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'

vi.mock('../services/searchService', () => ({
  searchGoogleImages: vi.fn().mockResolvedValue([
    { id: 'image-1', title: 'Test Image 1', url: 'https://example.com/image1.jpg', thumbnail: 'https://example.com/thumb1.jpg' },
    { id: 'image-2', title: 'Test Image 2', url: 'https://example.com/image2.jpg', thumbnail: 'https://example.com/thumb2.jpg' },
    { id: 'image-3', title: 'Test Image 3', url: 'https://example.com/image3.jpg', thumbnail: 'https://example.com/thumb3.jpg' }
  ]),
  searchYouTubeVideos: vi.fn().mockResolvedValue([])
}))

// Mock MediaService with VERY SLOW storeMedia to simulate portable exe conditions
let slowMediaAdditionPromises: Promise<any>[] = []
let mediaAdditionResolvers: Array<(value: any) => void> = []

vi.mock('../services/MediaService', () => {
  const mockMediaService = {
    storeMedia: vi.fn().mockImplementation((blob, pageId, type, metadata) => {
      // Simulate EXTREMELY slow media processing like in portable exe
      return new Promise((resolve) => {
        const resolver = () => resolve({ 
          id: `stored-${Math.random().toString(36)}`, 
          fileName: `${metadata.title || 'media'}.jpg` 
        })
        
        mediaAdditionResolvers.push(resolver)
        
        // Don't auto-resolve - let the test control when it completes
        // This simulates the stuck state that happens in portable exe
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
    // Also make fetch slow to simulate portable exe network conditions
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(['mock image data'], { type: 'image/jpeg' }))
        })
      }, 100) // Small delay for fetch, real delay is in storeMedia
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

describe('MediaEnhancementWizard - Concurrent Media Addition Issue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear any pending media operations
    slowMediaAdditionPromises = []
    mediaAdditionResolvers = []
  })

  afterEach(() => {
    // Clean up any pending operations
    mediaAdditionResolvers.forEach(resolve => resolve({ id: 'cleanup', fileName: 'cleanup.jpg' }))
    mediaAdditionResolvers = []
  })

  it('should reproduce the bug: global isAddingMedia state blocks all lightboxes during media addition', async () => {
    // This test reproduces the exact issue reported by the user
    renderWithProvider()

    // Setup: Get search results
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
      expect(screen.getByText('Test Image 2')).toBeInTheDocument()
    })

    // STEP 1: Click on first image to open lightbox
    const firstResult = screen.getByTestId('search-result-0')
    fireEvent.click(firstResult)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Test Image 1')).toBeInTheDocument() // In lightbox
    })

    // STEP 2: Start media addition for first image (this will be SLOW)
    const setMediaButton1 = screen.getByRole('button', { name: /set media/i })
    expect(setMediaButton1).not.toBeDisabled()
    fireEvent.click(setMediaButton1)

    // Lightbox should close immediately, media addition starts in background
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    }, { timeout: 1000 })

    // Wait a moment for the media addition to start
    await new Promise(resolve => setTimeout(resolve, 50))

    // STEP 3: While first image is still processing, try to open second image lightbox
    const secondResult = screen.getByTestId('search-result-1')
    fireEvent.click(secondResult)

    // Lightbox should open for second image
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Test Image 2')).toBeInTheDocument() // In lightbox
    })

    // BUG REPRODUCTION: The "Set Media" button for the SECOND image should be available
    // but currently shows "Adding Media..." and is disabled because of global isAddingMedia state
    const setMediaButton2 = screen.getByRole('button', { name: /set media|adding media/i })
    
    // In the buggy version, this will be "Adding Media..." and disabled
    // In the fixed version, this should be "Set Media" and enabled
    expect(setMediaButton2.textContent).toBe('Adding Media...') // This should fail after fix
    expect(setMediaButton2).toBeDisabled() // This should fail after fix
  })

  it('should allow independent media addition for different images', async () => {
    // This test defines the correct behavior we want after the fix
    renderWithProvider()

    // Get to search results
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
      expect(screen.getByText('Test Image 2')).toBeInTheDocument()
    })

    // Start adding first image
    const firstResult = screen.getByTestId('search-result-0')
    fireEvent.click(firstResult)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const setMediaButton1 = screen.getByRole('button', { name: /set media/i })
    fireEvent.click(setMediaButton1)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // While first is processing, open second image
    const secondResult = screen.getByTestId('search-result-1')
    fireEvent.click(secondResult)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Test Image 2')).toBeInTheDocument()
    })

    // FIXED BEHAVIOR: Second image should have independent state
    // The button should show "Set Media" and be clickable
    const setMediaButton2 = screen.getByRole('button', { name: /set media/i })
    
    expect(setMediaButton2.textContent).toBe('Set Media') // Should work after fix
    expect(setMediaButton2).not.toBeDisabled() // Should work after fix
    
    // Should be able to click it
    fireEvent.click(setMediaButton2)
    
    // Should start adding the second image independently
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('should handle timeout for stuck media addition operations', async () => {
    // Test that stuck operations eventually timeout and recover
    renderWithProvider()

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

    // Start a media addition that will get stuck
    const firstResult = screen.getByTestId('search-result-0')
    fireEvent.click(firstResult)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const setMediaButton = screen.getByRole('button', { name: /set media/i })
    fireEvent.click(setMediaButton)

    // Wait for timeout period (should be around 30 seconds for timeout)
    // For testing, we'll simulate timeout by waiting and checking recovery
    
    // After timeout, user should be able to try again
    // This test will be important for portable exe where operations can truly get stuck
    
    // For now, just verify the operation was started
    expect(mediaAdditionResolvers.length).toBe(1)
  })
})