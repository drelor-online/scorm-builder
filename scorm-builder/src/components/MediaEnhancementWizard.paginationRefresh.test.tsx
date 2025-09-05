import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import * as searchService from '../services/searchService'

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('../services/searchService', () => ({
  searchGoogleImages: vi.fn(),
  searchYouTubeVideos: vi.fn(),
  SearchError: class SearchError extends Error {
    constructor(message: string, public code: string) {
      super(message)
      this.name = 'SearchError'
    }
  }
}))

vi.mock('../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: () => ({
    createBlobUrl: vi.fn(() => 'blob:test-url'),
    getMediaForPage: vi.fn(() => []),
    storeMedia: vi.fn(() => Promise.resolve({ id: 'test-media', fileName: 'test.jpg' }))
  })
}))

vi.mock('../contexts/UnsavedChangesContext', () => ({
  useUnsavedChanges: () => ({
    markDirty: vi.fn(),
    resetDirty: vi.fn()
  })
}))

vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    currentProjectId: 'test-project'
  })
}))

vi.mock('../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  })
}))

vi.mock('../contexts/StepNavigationContext', () => ({
  useStepNavigation: () => ({
    currentStep: 'media',
    navigateToStep: vi.fn(),
    unlockSteps: vi.fn(),
    lockSteps: vi.fn()
  })
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('MediaEnhancementWizard Pagination Refresh Issue', () => {
  const mockCourseContent = {
    welcomePage: { id: 'welcome', title: 'Welcome', content: 'Welcome content' },
    learningObjectivesPage: { id: 'objectives', title: 'Learning Objectives', content: 'Objectives content' },
    topics: [
      { id: 'topic-1', title: 'Topic 1', content: 'Topic 1 content' },
      { id: 'topic-2', title: 'Topic 2', content: 'Topic 2 content' }
    ]
  }

  const defaultProps = {
    courseContent: mockCourseContent,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSave: vi.fn()
  }

  const mockSearchResults = [
    { id: '1', url: 'https://example.com/image1.jpg', title: 'Image 1', thumbnail: 'thumb1.jpg' },
    { id: '2', url: 'https://example.com/image2.jpg', title: 'Image 2', thumbnail: 'thumb2.jpg' },
    { id: '3', url: 'https://example.com/image3.jpg', title: 'Image 3', thumbnail: 'thumb3.jpg' },
    { id: '4', url: 'https://example.com/image4.jpg', title: 'Image 4', thumbnail: 'thumb4.jpg' },
    { id: '5', url: 'https://example.com/image5.jpg', title: 'Image 5', thumbnail: 'thumb5.jpg' },
    { id: '6', url: 'https://example.com/image6.jpg', title: 'Image 6', thumbnail: 'thumb6.jpg' },
    { id: '7', url: 'https://example.com/image7.jpg', title: 'Image 7', thumbnail: 'thumb7.jpg' },
    { id: '8', url: 'https://example.com/image8.jpg', title: 'Image 8', thumbnail: 'thumb8.jpg' },
    { id: '9', url: 'https://example.com/image9.jpg', title: 'Image 9', thumbnail: 'thumb9.jpg' },
    { id: '10', url: 'https://example.com/image10.jpg', title: 'Image 10', thumbnail: 'thumb10.jpg' }
  ]

  const mockPage2Results = [
    { id: '11', url: 'https://example.com/image11.jpg', title: 'Image 11', thumbnail: 'thumb11.jpg' },
    { id: '12', url: 'https://example.com/image12.jpg', title: 'Image 12', thumbnail: 'thumb12.jpg' },
    { id: '13', url: 'https://example.com/image13.jpg', title: 'Image 13', thumbnail: 'thumb13.jpg' },
    { id: '14', url: 'https://example.com/image14.jpg', title: 'Image 14', thumbnail: 'thumb14.jpg' },
    { id: '15', url: 'https://example.com/image15.jpg', title: 'Image 15', thumbnail: 'thumb15.jpg' },
    { id: '16', url: 'https://example.com/image16.jpg', title: 'Image 16', thumbnail: 'thumb16.jpg' },
    { id: '17', url: 'https://example.com/image17.jpg', title: 'Image 17', thumbnail: 'thumb17.jpg' },
    { id: '18', url: 'https://example.com/image18.jpg', title: 'Image 18', thumbnail: 'thumb18.jpg' },
    { id: '19', url: 'https://example.com/image19.jpg', title: 'Image 19', thumbnail: 'thumb19.jpg' },
    { id: '20', url: 'https://example.com/image20.jpg', title: 'Image 20', thumbnail: 'thumb20.jpg' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup search mock to return different results for different pages
    const mockSearchGoogleImages = vi.mocked(searchService.searchGoogleImages)
    mockSearchGoogleImages.mockImplementation((query: string, page: number = 1) => {
      if (page === 1) {
        return Promise.resolve(mockSearchResults)
      } else if (page === 2) {
        return Promise.resolve(mockPage2Results)
      } else {
        return Promise.resolve([])
      }
    })
  })

  it('should reproduce pagination refresh issue: page 1 from page 2 does not refresh images', async () => {
    render(<MediaEnhancementWizard {...defaultProps} />)

    // Step 1: Perform initial search
    const searchInput = screen.getByPlaceholderText('Search for images...')
    const searchButton = screen.getByText('Search')

    fireEvent.change(searchInput, { target: { value: 'test search' } })
    fireEvent.click(searchButton)

    // Wait for search results to appear
    await waitFor(() => {
      expect(searchService.searchGoogleImages).toHaveBeenCalledWith('test search', 1, undefined, undefined)
    })

    // Verify page 1 results are displayed
    await waitFor(() => {
      expect(screen.getByText('Image 1')).toBeInTheDocument()
      expect(screen.getByText('Image 10')).toBeInTheDocument()
    })

    // Step 2: Navigate to page 2
    const nextPageButton = screen.getByText('Next Page')
    fireEvent.click(nextPageButton)

    // Wait for page 2 results to load
    await waitFor(() => {
      expect(searchService.searchGoogleImages).toHaveBeenCalledWith('test search', 2, undefined, undefined)
    })

    // Verify page 2 results are displayed
    await waitFor(() => {
      expect(screen.getByText('Image 11')).toBeInTheDocument()
      expect(screen.getByText('Image 20')).toBeInTheDocument()
    })

    // Clear previous mock calls to isolate the issue
    vi.clearAllMocks()
    const mockSearchGoogleImages = vi.mocked(searchService.searchGoogleImages)
    mockSearchGoogleImages.mockImplementation((query: string, page: number = 1) => {
      if (page === 1) {
        return Promise.resolve(mockSearchResults)
      } else if (page === 2) {
        return Promise.resolve(mockPage2Results)
      } else {
        return Promise.resolve([])
      }
    })

    // Step 3: Navigate back to page 1 - THIS IS WHERE THE BUG OCCURS
    const previousPageButton = screen.getByText('Previous Page')
    fireEvent.click(previousPageButton)

    // Wait a reasonable amount of time for any potential search to trigger
    await waitFor(() => {
      // The current implementation has a bug: it doesn't trigger a new search
      // when going back to page 1 from page 2, so the search service should NOT be called
      // This test will fail after we fix the bug
      expect(searchService.searchGoogleImages).not.toHaveBeenCalled()
    }, { timeout: 2000 })

    // The page should still show page 2 results because the search wasn't triggered
    // This is the bug we're trying to reproduce
    expect(screen.queryByText('Image 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Image 11')).toBeInTheDocument()

    // After fix, we expect:
    // 1. searchGoogleImages to be called with page 1
    // 2. Page 1 results to be displayed
    // 3. Page 2 results to be cleared from the UI
  })

  it('should trigger loading state when navigating between pages', async () => {
    render(<MediaEnhancementWizard {...defaultProps} />)

    // Perform initial search
    const searchInput = screen.getByPlaceholderText('Search for images...')
    const searchButton = screen.getByText('Search')

    fireEvent.change(searchInput, { target: { value: 'test search' } })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('Image 1')).toBeInTheDocument()
    })

    // Navigate to page 2 and check loading state
    const nextPageButton = screen.getByText('Next Page')
    fireEvent.click(nextPageButton)

    // The pagination loading should be active during page navigation
    // Current implementation may not properly handle this
    await waitFor(() => {
      expect(screen.getByText('Loading more results...')).toBeInTheDocument()
    }, { timeout: 500 })

    await waitFor(() => {
      expect(screen.getByText('Image 11')).toBeInTheDocument()
    })
  })

  it('should properly handle search state when navigating pages', async () => {
    render(<MediaEnhancementWizard {...defaultProps} />)

    // Perform initial search
    const searchInput = screen.getByPlaceholderText('Search for images...')
    const searchButton = screen.getByText('Search')

    fireEvent.change(searchInput, { target: { value: 'test search' } })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('Image 1')).toBeInTheDocument()
    })

    // Navigate to page 2
    const nextPageButton = screen.getByText('Next Page')
    fireEvent.click(nextPageButton)

    await waitFor(() => {
      expect(screen.getByText('Image 11')).toBeInTheDocument()
    })

    // Clear mocks and prepare for page 1 navigation
    vi.clearAllMocks()
    const mockSearchGoogleImages = vi.mocked(searchService.searchGoogleImages)
    mockSearchGoogleImages.mockResolvedValue(mockSearchResults)

    // Navigate back to page 1
    const previousPageButton = screen.getByText('Previous Page')
    fireEvent.click(previousPageButton)

    // This should trigger a fresh search for page 1
    // The current bug means this assertion will fail
    await waitFor(() => {
      expect(searchService.searchGoogleImages).toHaveBeenCalledWith('test search', 1, undefined, undefined)
    }, { timeout: 2000 })

    // Results should be refreshed
    await waitFor(() => {
      expect(screen.getByText('Image 1')).toBeInTheDocument()
      expect(screen.queryByText('Image 11')).not.toBeInTheDocument()
    })
  })
})