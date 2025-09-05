import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MediaEnhancementWizard from './MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'

// Mock the search service - we'll control its behavior precisely
vi.mock('../services/searchService', () => ({
  searchGoogleImages: vi.fn(),
  searchYouTubeVideos: vi.fn().mockResolvedValue([]),
  SearchError: class SearchError extends Error {
    constructor(message: string, public readonly code: string, public readonly statusCode?: number) {
      super(message)
      this.name = 'SearchError'
    }
  }
}))

// Mock other services
vi.mock('../services/rustScormGenerator', () => ({ 
  getApiKeys: vi.fn().mockResolvedValue({
    googleImageApiKey: 'valid-api-key',
    googleCseId: 'valid-cse-id',
    youtubeApiKey: ''
  })
}))
vi.mock('../services/FileStorage')

// Mock Tauri APIs
const mockTauriAPI = {
  invoke: vi.fn().mockResolvedValue(undefined),
  convertFileSrc: vi.fn().mockImplementation((path: string) => `tauri://localhost/${path}`)
}

Object.defineProperty(window, '__TAURI__', {
  value: mockTauriAPI,
  writable: true
})

import * as searchService from '../services/searchService'

const renderWithAllProviders = (component: React.ReactElement) => {
  return render(
    <PersistentStorageProvider>
      <StepNavigationProvider>
        <UnsavedChangesProvider>
          <NotificationProvider>
            <UnifiedMediaProvider>
              {component}
            </UnifiedMediaProvider>
          </NotificationProvider>
        </UnsavedChangesProvider>
      </StepNavigationProvider>
    </PersistentStorageProvider>
  )
}

describe('MediaEnhancementWizard - Refined Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should work normally with valid API keys and successful API calls', async () => {
    // Simulate successful Google Images API response
    const mockSearchGoogleImages = searchService.searchGoogleImages as Mock
    mockSearchGoogleImages.mockResolvedValue([
      {
        id: 'real-google-1',
        url: 'https://example.com/image1.jpg',
        title: 'Real Google Image 1',
        source: 'example.com', // Real API source, not Unsplash/Pixabay
        thumbnail: 'https://example.com/thumb1.jpg'
      },
      {
        id: 'real-google-2', 
        url: 'https://example.com/image2.jpg',
        title: 'Real Google Image 2',
        source: 'another-site.com',
        thumbnail: 'https://example.com/thumb2.jpg'
      }
    ])

    const mockCourseContent = {
      courseTitle: 'Test Course',
      topics: [{ title: 'Topic 1', content: 'Content 1' }],
      pages: [{
        title: 'Topic 1',
        content: 'Content 1',
        media: []
      }]
    }

    renderWithAllProviders(
      <MediaEnhancementWizard 
        courseContent={mockCourseContent}
        onSave={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Topic 1')).toBeInTheDocument()
    })

    // Perform search with valid API keys
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'test search' } })
    
    const searchButton = screen.getByRole('button', { name: /search images/i })
    fireEvent.click(searchButton)

    // Should get real API results
    await waitFor(() => {
      expect(screen.getByText('Real Google Image 1')).toBeInTheDocument()
      expect(screen.getByText('Real Google Image 2')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should NOT show any error messages
    expect(screen.queryByText(/rate limit/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/invalid api/i)).not.toBeInTheDocument()
    
    // Should show real API sources, not mock sources
    expect(screen.getByText('example.com')).toBeInTheDocument()
    expect(screen.getByText('another-site.com')).toBeInTheDocument()
    
    // Should NOT show mock/stock image sources
    expect(screen.queryByText(/unsplash/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/pixabay/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/pexels/i)).not.toBeInTheDocument()
  })

  it('should show error dialog for rate limit (429) and NOT fall back to mock data', async () => {
    const mockSearchGoogleImages = searchService.searchGoogleImages as Mock
    const searchError = new (searchService as any).SearchError('Rate limit exceeded. Please try again later.', 'RATE_LIMIT', 429)
    mockSearchGoogleImages.mockRejectedValue(searchError)

    const mockCourseContent = {
      courseTitle: 'Test Course',
      topics: [{ title: 'Topic 1', content: 'Content 1' }],
      pages: [{
        title: 'Topic 1',
        content: 'Content 1',
        media: []
      }]
    }

    renderWithAllProviders(
      <MediaEnhancementWizard 
        courseContent={mockCourseContent}
        onSave={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Topic 1')).toBeInTheDocument()
    })

    // Perform search that hits rate limit
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'test search' } })
    
    const searchButton = screen.getByRole('button', { name: /search images/i })
    fireEvent.click(searchButton)

    // Should show rate limit error
    await waitFor(() => {
      expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should NOT fall back to mock data
    expect(screen.queryByText(/unsplash/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/pixabay/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/pexels/i)).not.toBeInTheDocument()
    
    // Should not show any search results
    expect(screen.queryByTestId('search-result-item')).not.toBeInTheDocument()
  })

  it('should show error dialog for invalid API key (403) and NOT fall back to mock data', async () => {
    const mockSearchGoogleImages = searchService.searchGoogleImages as Mock
    const searchError = new (searchService as any).SearchError('Invalid API key or insufficient permissions.', 'INVALID_KEY', 403)
    mockSearchGoogleImages.mockRejectedValue(searchError)

    const mockCourseContent = {
      courseTitle: 'Test Course',
      topics: [{ title: 'Topic 1', content: 'Content 1' }],
      pages: [{
        title: 'Topic 1',
        content: 'Content 1',
        media: []
      }]
    }

    renderWithAllProviders(
      <MediaEnhancementWizard 
        courseContent={mockCourseContent}
        onSave={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Topic 1')).toBeInTheDocument()
    })

    // Perform search with invalid API key
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'test search' } })
    
    const searchButton = screen.getByRole('button', { name: /search images/i })
    fireEvent.click(searchButton)

    // Should show invalid key error
    await waitFor(() => {
      expect(screen.getByText(/invalid api key/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should NOT fall back to mock data
    expect(screen.queryByText(/unsplash/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/pixabay/i)).not.toBeInTheDocument()
  })

  it('should fall back to mock data for network errors (not show error dialog)', async () => {
    // Note: This tests the searchService behavior, but since we're mocking searchGoogleImages,
    // we need to simulate what the actual service would do for network errors
    const mockSearchGoogleImages = searchService.searchGoogleImages as Mock
    mockSearchGoogleImages.mockResolvedValue([
      {
        id: 'mock-1',
        url: 'https://picsum.photos/800/600?random=1',
        title: 'Test Query - Result 1',
        source: 'Unsplash', // Mock data source - this is OK for network errors
        thumbnail: 'https://picsum.photos/400/300?random=1'
      }
    ])

    const mockCourseContent = {
      courseTitle: 'Test Course',
      topics: [{ title: 'Topic 1', content: 'Content 1' }],
      pages: [{
        title: 'Topic 1',
        content: 'Content 1',
        media: []
      }]
    }

    renderWithAllProviders(
      <MediaEnhancementWizard 
        courseContent={mockCourseContent}
        onSave={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Topic 1')).toBeInTheDocument()
    })

    // Perform search - this simulates network error fallback behavior
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'test search' } })
    
    const searchButton = screen.getByRole('button', { name: /search images/i })
    fireEvent.click(searchButton)

    // Should get mock data results (fallback behavior for network errors)
    await waitFor(() => {
      expect(screen.getByText('Test Query - Result 1')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should NOT show error messages (network errors fall back gracefully)
    expect(screen.queryByText(/rate limit/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/invalid api/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/api request failed/i)).not.toBeInTheDocument()

    // Mock data with Unsplash is acceptable in this case (network error fallback)
    expect(screen.getByText('Unsplash')).toBeInTheDocument()
  })
})