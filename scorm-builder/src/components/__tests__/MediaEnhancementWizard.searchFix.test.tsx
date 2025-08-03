import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { vi } from 'vitest'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'
import * as searchService from '../../services/searchService'

// Mock contexts
vi.mock('../../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: () => ({
    storeMedia: vi.fn(),
    getMediaForPage: vi.fn().mockReturnValue([]),
    storeYouTubeVideo: vi.fn(),
    deleteMedia: vi.fn(),
  })
}))

// Mock search service
vi.mock('../../services/searchService', () => ({
  searchGoogleImages: vi.fn(),
  searchYouTubeVideos: vi.fn(),
  SearchError: class SearchError extends Error {}
}))

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <PersistentStorageProvider>
      <StepNavigationProvider visitedSteps={[0, 1, 2, 3]} currentStep={3}>
        {children}
      </StepNavigationProvider>
    </PersistentStorageProvider>
  )
}

describe('MediaEnhancementWizard - Search Results Fix', () => {
  const mockProps = {
    courseContent: {
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
    },
    apiKeys: {
      googleImageApiKey: 'test-key',
      googleCseId: 'test-cse-id'
    },
    onNext: vi.fn(),
    onBack: vi.fn(),
    onUpdateContent: vi.fn(),
    onSave: vi.fn()
  }

  it('should correctly display search results from searchGoogleImages', async () => {
    const mockSearchResults = [
      {
        id: 'img-1',
        url: 'https://example.com/image1.jpg',
        thumbnail: 'https://example.com/thumb1.jpg',
        title: 'Test Image 1',
        source: 'example.com'
      },
      {
        id: 'img-2',
        url: 'https://example.com/image2.jpg',
        thumbnail: 'https://example.com/thumb2.jpg',
        title: 'Test Image 2',
        source: 'example.com'
      }
    ]

    vi.mocked(searchService.searchGoogleImages).mockResolvedValue(mockSearchResults)

    const user = userEvent.setup()
    
    render(
      <TestWrapper>
        <MediaEnhancementWizard {...mockProps} />
      </TestWrapper>
    )

    // Wait for component to render
    await screen.findByText(/Add New Media/i)

    // Enter search query
    const searchInput = screen.getByPlaceholderText(/Search for images/i)
    await user.type(searchInput, 'test query')

    // Click search button
    const searchButton = screen.getByText(/^Search$/i)
    await user.click(searchButton)

    // Wait for search to complete
    await waitFor(() => {
      expect(searchService.searchGoogleImages).toHaveBeenCalledWith('test query', 1, 'test-key', 'test-cse-id')
    })

    // Check that search results are displayed
    await waitFor(() => {
      // Results should be displayed in the grid
      const result1 = screen.getByTestId('search-result-0')
      const result2 = screen.getByTestId('search-result-1')
      
      expect(result1).toBeInTheDocument()
      expect(result2).toBeInTheDocument()
    })
  })

  it('should not re-map SearchResult objects from searchGoogleImages', async () => {
    // This test verifies that we're not incorrectly mapping the results
    const mockSearchResults = [
      {
        id: 'test-id',
        url: 'https://example.com/image.jpg',
        thumbnail: 'https://example.com/thumb.jpg',
        title: 'Test Image',
        source: 'example.com',
        dimensions: '800x600'
      }
    ]

    vi.mocked(searchService.searchGoogleImages).mockResolvedValue(mockSearchResults)

    const user = userEvent.setup()
    
    render(
      <TestWrapper>
        <MediaEnhancementWizard {...mockProps} />
      </TestWrapper>
    )

    await screen.findByText(/Add New Media/i)

    const searchInput = screen.getByPlaceholderText(/Search for images/i)
    await user.type(searchInput, 'test')

    const searchButton = screen.getByText(/^Search$/i)
    await user.click(searchButton)

    await waitFor(() => {
      expect(searchService.searchGoogleImages).toHaveBeenCalled()
    })

    // The component should use the results directly without remapping
    // If it was still trying to map img.link instead of using the SearchResult object,
    // the result would have undefined properties and wouldn't display correctly
    await waitFor(() => {
      const result = screen.getByTestId('search-result-0')
      expect(result).toBeInTheDocument()
      
      // The result should have the correct title
      expect(screen.getByText('Test Image')).toBeInTheDocument()
    })
  })
})