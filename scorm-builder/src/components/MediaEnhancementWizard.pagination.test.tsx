import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import * as searchService from '../services/searchService'

// Mock the search service
vi.mock('../services/searchService', () => ({
  searchGoogleImages: vi.fn(),
  searchYouTubeVideos: vi.fn(),
  SearchError: class SearchError extends Error {
    constructor(message: string, public code: string, public statusCode?: number) {
      super(message)
      this.name = 'SearchError'
    }
  }
}))

const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn().mockResolvedValue(null),
  saveContent: vi.fn().mockResolvedValue(undefined)
}

const mockCourseContent = {
  welcomePage: {
    id: 'welcome',
    title: 'Welcome',
    content: 'Welcome content',
    narration: 'Welcome narration',
    imageKeywords: ['welcome', 'intro'],
    imagePrompts: ['welcome image'],
    videoSearchTerms: ['welcome video'],
    duration: 2,
    media: []
  },
  learningObjectivesPage: {
    id: 'objectives',
    title: 'Learning Objectives',
    content: 'Objectives content',
    narration: 'Objectives narration',
    imageKeywords: ['learning', 'goals'],
    imagePrompts: ['objectives image'],
    videoSearchTerms: ['learning video'],
    duration: 3,
    media: []
  },
  topics: [],
  assessment: { questions: [], passMark: 80, narration: null }
}

const mockProps = {
  courseContent: mockCourseContent,
  onNext: vi.fn(),
  onBack: vi.fn(),
  onSave: vi.fn()
}

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <PersistentStorageProvider storage={mockStorage as any}>
    <StepNavigationProvider>
      <UnsavedChangesProvider>
        <NotificationProvider>
          <UnifiedMediaProvider>
            {children}
          </UnifiedMediaProvider>
        </NotificationProvider>
      </UnsavedChangesProvider>
    </StepNavigationProvider>
  </PersistentStorageProvider>
)

describe('MediaEnhancementWizard - Pagination Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mock responses for search services
    const mockImageResults = Array.from({ length: 10 }, (_, i) => ({
      id: `img-${i + 1}`,
      url: `https://example.com/image-${i + 1}.jpg`,
      thumbnail: `https://example.com/thumb-${i + 1}.jpg`,
      title: `Image Result ${i + 1}`,
      source: `Source ${i + 1}`,
      dimensions: `${800 + i * 100}x600`
    }));
    
    const mockVideoResults = Array.from({ length: 10 }, (_, i) => ({
      id: `video-${i + 1}`,
      url: `https://youtube.com/watch?v=${i + 1}`,
      embedUrl: `https://youtube.com/embed/${i + 1}`,
      thumbnail: `https://img.youtube.com/vi/${i + 1}/hqdefault.jpg`,
      title: `Video Result ${i + 1}`,
      channel: `Channel ${i + 1}`,
      views: `${Math.floor(Math.random() * 900 + 100)}K views`,
      uploadedAt: `${i + 1} days ago`,
      duration: `${Math.floor(Math.random() * 50 + 10)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`
    }));

    (searchService.searchGoogleImages as Mock).mockResolvedValue(mockImageResults);
    (searchService.searchYouTubeVideos as Mock).mockResolvedValue(mockVideoResults)
  })

  describe('Search Functions Should Receive Correct Page Numbers', () => {
    it('should pass resultPage to searchGoogleImages when searching for images', async () => {
      const { unmount } = render(
        <TestWrapper>
          <MediaEnhancementWizard {...mockProps} />
        </TestWrapper>
      )

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search for images...')).toBeTruthy()
      })

      // Enter search query
      const searchInput = screen.getByPlaceholderText('Search for images...')
      fireEvent.change(searchInput, { target: { value: 'test images' } })

      // Click search button (find by aria-label)
      const searchButton = screen.getByLabelText('Search images')
      fireEvent.click(searchButton)

      // Wait for search to complete
      await waitFor(() => {
        // Search should be called with page 1 initially
        expect(searchService.searchGoogleImages).toHaveBeenCalledWith(
          'test images',
          1, // This is the page parameter we're testing
          '', // API key
          ''  // CSE ID
        )
      })

      // For this test, let's just verify that page 1 is called correctly
      // The pagination behavior will be tested in a separate integration test
      await waitFor(() => {
        expect(searchService.searchGoogleImages).toHaveBeenCalledWith(
          'test images',
          1, // First search should use page 1
          '',
          ''
        )
      })

      unmount()
    }, 10000)

    it('should pass resultPage to searchYouTubeVideos when searching for videos', async () => {
      const mockApiKeys = {
        youtubeApiKey: 'test-youtube-key'
      }

      const { unmount } = render(
        <TestWrapper>
          <MediaEnhancementWizard {...mockProps} apiKeys={mockApiKeys} />
        </TestWrapper>
      )

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('Search Videos')).toBeTruthy()
      })

      // Switch to videos tab
      const videosTab = screen.getByText('Search Videos')
      fireEvent.click(videosTab)

      // Wait for video tab to activate and search input to be available
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search for videos...')).toBeTruthy()
      })

      // Enter search query
      const searchInput = screen.getByPlaceholderText('Search for videos...')
      fireEvent.change(searchInput, { target: { value: 'test videos' } })

      // Click search button (find by aria-label)
      const searchButton = screen.getByLabelText('Search videos')
      fireEvent.click(searchButton)

      // Wait for search to complete
      await waitFor(() => {
        // Search should be called with page 1 initially
        expect(searchService.searchYouTubeVideos).toHaveBeenCalledWith(
          'test videos',
          1, // This is the page parameter we're testing
          'test-youtube-key'
        )
      })

      // For this test, let's just verify that page 1 is called correctly
      // The pagination behavior will be tested in a separate integration test  
      await waitFor(() => {
        expect(searchService.searchYouTubeVideos).toHaveBeenCalledWith(
          'test videos',
          1, // First search should use page 1
          'test-youtube-key'
        )
      })

      unmount()
    }, 10000)
  })

  describe('Pagination UI Behavior', () => {
    it('should show pagination controls when search results exist', async () => {
      const { unmount } = render(
        <TestWrapper>
          <MediaEnhancementWizard {...mockProps} />
        </TestWrapper>
      )

      // Perform search to get results
      const searchInput = screen.getByPlaceholderText('Search for images...')
      fireEvent.change(searchInput, { target: { value: 'test' } })
      
      const searchButton = screen.getByLabelText('Search images')
      fireEvent.click(searchButton)

      // Wait for search results and pagination controls
      await waitFor(() => {
        const paginationControls = screen.queryByTestId('pagination-controls')
        expect(paginationControls).toBeTruthy()
      })

      unmount()
    }, 8000)

    it('should update page number when pagination is clicked', async () => {
      const { unmount } = render(
        <TestWrapper>
          <MediaEnhancementWizard {...mockProps} />
        </TestWrapper>
      )

      // Perform search to get results
      const searchInput = screen.getByPlaceholderText('Search for images...')
      fireEvent.change(searchInput, { target: { value: 'test' } })
      
      const searchButton = screen.getByLabelText('Search images')
      fireEvent.click(searchButton)

      // Wait for search results
      await waitFor(() => {
        const paginationControls = screen.queryByTestId('pagination-controls')
        expect(paginationControls).toBeTruthy()
      })

      // Click Next button to go to page 2
      const nextButton = screen.getByText('Next Page')
      fireEvent.click(nextButton)

      // This test verifies that the pagination state changes
      // The actual search call test is above - this just tests UI state
      await waitFor(() => {
        // Look for indication that we're on page 2
        // This might be in pagination display text or component state
        expect(screen.queryByText('Page 2')).toBeTruthy()
      })

      unmount()
    }, 8000)
  })

  describe('Pagination API Integration', () => {
    it('should call search API with page 2 when pagination Next is clicked', async () => {
      const { unmount } = render(
        <TestWrapper>
          <MediaEnhancementWizard {...mockProps} />
        </TestWrapper>
      )

      // Perform initial search
      const searchInput = screen.getByPlaceholderText('Search for images...')
      fireEvent.change(searchInput, { target: { value: 'test' } })
      
      const searchButton = screen.getByLabelText('Search images')
      fireEvent.click(searchButton)

      // Wait for search results and ensure pagination appears
      await waitFor(() => {
        const paginationControls = screen.queryByTestId('pagination-controls')
        expect(paginationControls).toBeTruthy()
      })

      // Clear the mock call history so we can test the next call
      vi.clearAllMocks()

      // Click Next button to go to page 2 
      const nextButton = screen.getByText('Next Page')
      fireEvent.click(nextButton)

      // Verify that search is called again with page 2
      await waitFor(() => {
        expect(searchService.searchGoogleImages).toHaveBeenCalledWith(
          'test',
          2, // Should be page 2 now
          '',
          ''
        )
      }, { timeout: 3000 })

      unmount()
    }, 10000)
  })
})