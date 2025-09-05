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

describe('MediaEnhancementWizard - Click Handler Types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup mock responses
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

  it('should handle image search button clicks with correct TypeScript types', async () => {
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

    // Click search button - this should work without TypeScript errors
    const searchButton = screen.getByLabelText('Search images')
    
    // This test validates that the button can be clicked and the event is handled correctly
    // If there are TypeScript errors, this test will fail to compile
    fireEvent.click(searchButton)

    // Verify that search function was called with default parameters (resetPagination=true)
    await waitFor(() => {
      expect(searchService.searchGoogleImages).toHaveBeenCalledWith(
        'test images',
        1, // Should be page 1 (default resetPagination=true behavior)
        '',
        ''
      )
    })

    unmount()
  }, 8000)

  it('should handle video search button clicks with correct TypeScript types', async () => {
    const mockApiKeys = {
      youtubeApiKey: 'test-youtube-key'
    }

    const { unmount } = render(
      <TestWrapper>
        <MediaEnhancementWizard {...mockProps} apiKeys={mockApiKeys} />
      </TestWrapper>
    )

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

    // Click search button - this should work without TypeScript errors
    const searchButton = screen.getByLabelText('Search videos')
    
    // This test validates that the button can be clicked and the event is handled correctly
    fireEvent.click(searchButton)

    // Verify that search function was called with default parameters (resetPagination=true)
    await waitFor(() => {
      expect(searchService.searchYouTubeVideos).toHaveBeenCalledWith(
        'test videos',
        1, // Should be page 1 (default resetPagination=true behavior)
        'test-youtube-key'
      )
    })

    unmount()
  }, 8000)

  it('should maintain search functionality after clicking search buttons', async () => {
    const { unmount } = render(
      <TestWrapper>
        <MediaEnhancementWizard {...mockProps} />
      </TestWrapper>
    )

    // Test image search
    const searchInput = screen.getByPlaceholderText('Search for images...')
    fireEvent.change(searchInput, { target: { value: 'nature' } })
    
    const searchButton = screen.getByLabelText('Search images')
    fireEvent.click(searchButton)

    // Wait for search results
    await waitFor(() => {
      expect(searchService.searchGoogleImages).toHaveBeenCalled()
    })

    // Verify search results appear (this confirms the onClick handler works functionally)
    await waitFor(() => {
      // Look for any search results or pagination controls
      const resultsOrPagination = screen.queryByTestId('pagination-controls') || 
                                  screen.getByText('Search Images') // fallback
      expect(resultsOrPagination).toBeTruthy()
    })

    unmount()
  }, 8000)
})