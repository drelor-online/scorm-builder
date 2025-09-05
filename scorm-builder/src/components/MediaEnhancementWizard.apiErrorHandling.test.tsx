import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MediaEnhancementWizard from './MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { SearchError } from '../services/searchService'

// Mock the search service
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
    googleImageApiKey: 'test-key',
    googleCseId: 'test-cse',
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

describe('MediaEnhancementWizard - API Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show error dialog when API rate limit is hit', async () => {
    // Simulate API rate limit error
    const mockSearchGoogleImages = searchService.searchGoogleImages as Mock
    mockSearchGoogleImages.mockRejectedValue(
      new SearchError('Daily quota exceeded. Please wait 24 hours.', 'RATE_LIMIT', 429)
    )

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

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Topic 1')).toBeInTheDocument()
    })

    // Perform a search that will hit the rate limit
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'electrical safety' } })
    
    const searchButton = screen.getByRole('button', { name: /search images/i })
    fireEvent.click(searchButton)

    // Should show the API limit error message
    await waitFor(() => {
      expect(screen.getByText(/daily quota exceeded/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // CRITICAL: Should NOT show any results with Unsplash/Pixabay sources
    expect(screen.queryByText(/unsplash/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/pixabay/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/pexels/i)).not.toBeInTheDocument()

    // Should not show any search results at all
    expect(screen.queryByTestId('search-result-item')).not.toBeInTheDocument()
  })

  it('should show error dialog when API key is invalid', async () => {
    const mockSearchGoogleImages = searchService.searchGoogleImages as Mock
    mockSearchGoogleImages.mockRejectedValue(
      new SearchError('Invalid API key or insufficient permissions.', 'INVALID_KEY', 403)
    )

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

    // Perform search
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'test search' } })
    
    const searchButton = screen.getByRole('button', { name: /search images/i })
    fireEvent.click(searchButton)

    // Should show API key error
    await waitFor(() => {
      expect(screen.getByText(/invalid api key/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should NOT fallback to stock images
    expect(screen.queryByText(/unsplash/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/pixabay/i)).not.toBeInTheDocument()
  })

  it('should still show mock data when no API keys are configured (acceptable)', async () => {
    // Import and mock the rustScormGenerator
    const rustScormGenerator = await import('../services/rustScormGenerator')
    const getApiKeysMock = vi.mocked(rustScormGenerator.getApiKeys)
    
    // Override the API keys to be empty (no keys configured)
    getApiKeysMock.mockResolvedValue({
      googleImageApiKey: '',
      googleCseId: '',
      youtubeApiKey: ''
    })

    const mockSearchGoogleImages = searchService.searchGoogleImages as Mock
    mockSearchGoogleImages.mockResolvedValue([
      {
        id: 'mock-1',
        url: 'https://picsum.photos/800/600?random=1',
        title: 'Mock Result 1',
        source: 'Unsplash', // This is OK when no API keys
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

    // Search should work with mock data when no keys
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'test' } })
    
    const searchButton = screen.getByRole('button', { name: /search images/i })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(mockSearchGoogleImages).toHaveBeenCalledWith('test', 1, '', '')
    })

    // In this case, mock data with Unsplash source is acceptable 
    // because user has no API keys configured
    await waitFor(() => {
      expect(screen.getByText('Mock Result 1')).toBeInTheDocument()
    })
  })
})