import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MediaEnhancementWizard } from '../MediaEnhancementWizardRefactored'
import { CourseContent } from '../../types/aiPrompt'
import * as searchService from '../../services/searchService'

// Mock the search service
vi.mock('../../services/searchService', () => ({
  searchGoogleImages: vi.fn(),
  searchYouTubeVideos: vi.fn(),
  clearYouTubePageTokens: vi.fn(),
  hasYouTubeNextPage: vi.fn()
}))

describe('MediaEnhancementWizard - Pagination', () => {
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
      media: []
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
    topics: [],
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

  // Create mock search results with more than 10 items to test pagination
  const createMockImageResults = (count: number, startIndex: number = 0) => {
    return Array.from({ length: count }, (_, i) => ({
      title: `Image ${startIndex + i + 1}`,
      link: `https://example.com/image${startIndex + i + 1}.jpg`,
      thumbnail: `https://example.com/thumb${startIndex + i + 1}.jpg`,
      contextLink: `https://example.com/page${startIndex + i + 1}`,
      width: 800,
      height: 600
    }))
  }

  const createMockVideoResults = (count: number, startIndex: number = 0) => {
    return Array.from({ length: count }, (_, i) => ({
      title: `Video ${startIndex + i + 1}`,
      videoId: `video${startIndex + i + 1}`,
      thumbnail: `https://img.youtube.com/vi/video${startIndex + i + 1}/mqdefault.jpg`,
      channelTitle: `Channel ${startIndex + i + 1}`,
      duration: 'PT5M30S'
    }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Image Search Pagination', () => {
    it('should show pagination controls when there are more than 10 results', async () => {
      const mockSearchImages = vi.mocked(searchService.searchGoogleImages)
      mockSearchImages.mockResolvedValueOnce(createMockImageResults(10))

      render(<MediaEnhancementWizard {...defaultProps} />)
      
      // Type in search query and click search button
      const searchInput = screen.getByPlaceholderText(/search for images/i)
      fireEvent.change(searchInput, { target: { value: 'test search' } })
      
      const searchButtons = screen.getAllByText('Search')
      const imageSearchButton = searchButtons[0] // First search button is for images
      fireEvent.click(imageSearchButton)

      // Wait for results
      await waitFor(() => {
        expect(screen.getByText('Image 1')).toBeInTheDocument()
      })

      // Check for pagination controls
      expect(screen.getByText('Next Page')).toBeInTheDocument()
      expect(screen.getByText('Page 1')).toBeInTheDocument()
      expect(screen.queryByText('Previous Page')).toBeDisabled()
    })

    it('should load next page of results when Next Page is clicked', async () => {
      const mockSearchImages = vi.mocked(searchService.searchGoogleImages)
      // First page
      mockSearchImages.mockResolvedValueOnce(createMockImageResults(10, 0))
      // Second page
      mockSearchImages.mockResolvedValueOnce(createMockImageResults(10, 10))

      render(<MediaEnhancementWizard {...defaultProps} />)
      
      // Type in search query and search for images
      const searchInput = screen.getByPlaceholderText(/search for images/i)
      fireEvent.change(searchInput, { target: { value: 'test search' } })
      
      const searchButtons = screen.getAllByText('Search')
      const imageSearchButton = searchButtons[0]
      fireEvent.click(imageSearchButton)

      // Wait for first page results
      await waitFor(() => {
        expect(screen.getByText('Image 1')).toBeInTheDocument()
      })

      // Click Next Page
      const nextButton = screen.getByText('Next Page')
      fireEvent.click(nextButton)

      // Wait for second page results
      await waitFor(() => {
        expect(screen.getByText('Image 11')).toBeInTheDocument()
        expect(screen.queryByText('Image 1')).not.toBeInTheDocument()
      })

      // Check page indicator
      expect(screen.getByText('Page 2')).toBeInTheDocument()
      expect(screen.getByText('Previous Page')).not.toBeDisabled()
    })

    it('should show loading state while fetching next page', async () => {
      const mockSearchImages = vi.mocked(searchService.searchGoogleImages)
      mockSearchImages.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(createMockImageResults(10)), 100))
      )

      render(<MediaEnhancementWizard {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search for images/i)
      fireEvent.change(searchInput, { target: { value: 'test search' } })
      
      const searchButtons = screen.getAllByText('Search')
      const imageSearchButton = searchButtons[0]
      fireEvent.click(imageSearchButton)

      await waitFor(() => {
        expect(screen.getByText('Image 1')).toBeInTheDocument()
      })

      const nextButton = screen.getByText('Next Page')
      fireEvent.click(nextButton)

      // Should show loading indicator
      expect(screen.getByText('Loading more results...')).toBeInTheDocument()
    })

    it('should disable Next Page when on last page', async () => {
      const mockSearchImages = vi.mocked(searchService.searchGoogleImages)
      // Return less than 10 results to indicate last page
      mockSearchImages.mockResolvedValueOnce(createMockImageResults(5))

      render(<MediaEnhancementWizard {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search for images/i)
      fireEvent.change(searchInput, { target: { value: 'test search' } })
      
      const searchButtons = screen.getAllByText('Search')
      const imageSearchButton = searchButtons[0]
      fireEvent.click(imageSearchButton)

      await waitFor(() => {
        expect(screen.getByText('Image 1')).toBeInTheDocument()
      })

      // Next Page should be disabled when less than 10 results
      expect(screen.getByText('Next Page')).toBeDisabled()
    })
  })

  describe('Video Search Pagination', () => {
    it('should show pagination controls for video search results', async () => {
      const mockSearchVideos = vi.mocked(searchService.searchYouTubeVideos)
      const mockHasNextPage = vi.mocked(searchService.hasYouTubeNextPage)
      mockSearchVideos.mockResolvedValueOnce(createMockVideoResults(10))
      mockHasNextPage.mockReturnValue(true)

      render(<MediaEnhancementWizard {...defaultProps} />)
      
      // Type in search query and click search button for videos
      const searchInput = screen.getByPlaceholderText(/search for videos/i)
      fireEvent.change(searchInput, { target: { value: 'test video search' } })
      
      const searchButtons = screen.getAllByText('Search')
      const videoSearchButton = searchButtons[1] // Second search button is for videos
      fireEvent.click(videoSearchButton)

      // Wait for results
      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument()
      })

      // Check for pagination controls
      expect(screen.getByText('Next Page')).toBeInTheDocument()
      expect(screen.getByText('Page 1')).toBeInTheDocument()
      expect(screen.queryByText('Previous Page')).toBeDisabled()
    })

    it('should navigate between video pages', async () => {
      const mockSearchVideos = vi.mocked(searchService.searchYouTubeVideos)
      const mockHasNextPage = vi.mocked(searchService.hasYouTubeNextPage)
      // First page
      mockSearchVideos.mockResolvedValueOnce(createMockVideoResults(10, 0))
      // Second page
      mockSearchVideos.mockResolvedValueOnce(createMockVideoResults(10, 10))
      // Back to first page
      mockSearchVideos.mockResolvedValueOnce(createMockVideoResults(10, 0))
      // Mock hasNextPage
      mockHasNextPage.mockReturnValue(true)

      render(<MediaEnhancementWizard {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search for videos/i)
      fireEvent.change(searchInput, { target: { value: 'test video search' } })
      
      const searchButtons = screen.getAllByText('Search')
      const videoSearchButton = searchButtons[1]
      fireEvent.click(videoSearchButton)

      // Wait for first page
      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument()
      })

      // Go to second page
      fireEvent.click(screen.getByText('Next Page'))
      await waitFor(() => {
        expect(screen.getByText('Video 11')).toBeInTheDocument()
      })

      // Go back to first page
      fireEvent.click(screen.getByText('Previous Page'))
      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument()
      })
    })

    it('should reset pagination when searching with new keywords', async () => {
      const mockSearchVideos = vi.mocked(searchService.searchYouTubeVideos)
      const mockHasNextPage = vi.mocked(searchService.hasYouTubeNextPage)
      const mockClearTokens = vi.mocked(searchService.clearYouTubePageTokens)
      mockSearchVideos.mockResolvedValue(createMockVideoResults(10))
      mockHasNextPage.mockReturnValue(true)

      render(<MediaEnhancementWizard {...defaultProps} />)
      
      // Initial search
      const searchInput = screen.getByPlaceholderText(/search for videos/i)
      fireEvent.change(searchInput, { target: { value: 'test video' } })
      const searchButtons = screen.getAllByText('Search')
      fireEvent.click(searchButtons[1])
      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument()
      })

      // Go to page 2
      fireEvent.click(screen.getByText('Next Page'))
      await waitFor(() => {
        expect(screen.getByText('Page 2')).toBeInTheDocument()
      })

      // Change search term and search again
      fireEvent.change(searchInput, { target: { value: 'new search term' } })
      const newSearchButtons = screen.getAllByText('Search')
      fireEvent.click(newSearchButtons[1])

      // Should be back on page 1
      await waitFor(() => {
        expect(screen.getByText('Page 1')).toBeInTheDocument()
      })

      // Verify clearYouTubePageTokens was called for the new search
      expect(mockClearTokens).toHaveBeenCalledWith('new search term')
    })
  })

  describe('Pagination UI', () => {
    it('should show current page and total results info', async () => {
      const mockSearchImages = vi.mocked(searchService.searchGoogleImages)
      mockSearchImages.mockResolvedValueOnce(createMockImageResults(10))

      render(<MediaEnhancementWizard {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search for images/i)
      fireEvent.change(searchInput, { target: { value: 'test search' } })
      const searchButtons = screen.getAllByText('Search')
      fireEvent.click(searchButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Showing 1-10 of many results')).toBeInTheDocument()
      })
    })

    it('should have keyboard navigation support for pagination', async () => {
      const mockSearchImages = vi.mocked(searchService.searchGoogleImages)
      mockSearchImages.mockResolvedValueOnce(createMockImageResults(10))
      mockSearchImages.mockResolvedValueOnce(createMockImageResults(10, 10))

      render(<MediaEnhancementWizard {...defaultProps} />)
      
      const searchInput = screen.getByPlaceholderText(/search for images/i)
      fireEvent.change(searchInput, { target: { value: 'test search' } })
      const searchButtons = screen.getAllByText('Search')
      fireEvent.click(searchButtons[0])
      await waitFor(() => {
        expect(screen.getByText('Image 1')).toBeInTheDocument()
      })

      // Simulate keyboard navigation (e.g., arrow keys)
      const paginationContainer = screen.getByTestId('pagination-controls')
      fireEvent.keyDown(paginationContainer, { key: 'ArrowRight' })

      await waitFor(() => {
        expect(screen.getByText('Image 11')).toBeInTheDocument()
      })
    })
  })
})