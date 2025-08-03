import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'

// Mock storage functions
vi.mock('../../services/PersistentStorage', () => ({
  PersistentStorage: {
    saveProject: vi.fn(),
    loadProject: vi.fn(),
    getAvailableProjects: vi.fn().mockResolvedValue([]),
    deleteProject: vi.fn(),
    autoSave: vi.fn()
  }
}))

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock storeYouTubeVideo to track what parameters it receives
const mockStoreYouTubeVideo = vi.fn()

// Mock search service to return YouTube results with title in wrong place
vi.mock('../../services/searchService', () => ({
  searchYouTubeVideos: vi.fn().mockResolvedValue([
    {
      id: 'video-1',
      url: 'Natural Gas 101', // WRONG: This should be a URL, not a title
      title: 'Natural Gas 101',
      embedUrl: 'https://youtube.com/embed/abc123',
      channel: 'Education Channel',
      duration: '5:00'
    },
    {
      id: 'video-2',
      url: 'https://youtube.com/watch?v=xyz789', // CORRECT: Proper URL
      title: 'Mercaptan Safety',
      embedUrl: 'https://youtube.com/embed/xyz789',
      channel: 'Safety Channel',
      duration: '3:00'
    }
  ]),
  searchGoogleImages: vi.fn()
}))

// Mock unified media context
vi.mock('../../contexts/UnifiedMediaContext', () => ({
  UnifiedMediaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useUnifiedMedia: () => ({
    listMedia: vi.fn().mockResolvedValue([]),
    getMediaForPage: vi.fn().mockReturnValue([]),
    storeMedia: vi.fn(),
    deleteMedia: vi.fn(),
    createBlobUrl: vi.fn(),
    revokeBlobUrl: vi.fn(),
    getMediaUrl: vi.fn(),
    storeExternalMedia: vi.fn(),
    storeYouTubeVideo: mockStoreYouTubeVideo
  })
}))

const mockCourseContent = {
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
}

describe('MediaEnhancementWizard - YouTube URL Handling', () => {
  const mockOnComplete = vi.fn()
  const mockOnPageChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreYouTubeVideo.mockResolvedValue({
      id: 'stored-video-1',
      storageId: 'storage-1',
      url: 'https://youtube.com/watch?v=abc123',
      type: 'video'
    })
  })

  it('should handle YouTube results with title in URL field correctly', async () => {
    render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider>
          <StepNavigationProvider>
            <MediaEnhancementWizard
              courseContent={mockCourseContent}
              onComplete={mockOnComplete}
              currentPageIndex={0}
              onPageChange={mockOnPageChange}
            />
          </StepNavigationProvider>
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Switch to video search
    const videoTab = screen.getByText(/Videos/i, { selector: 'button[role="tab"]' })
    fireEvent.click(videoTab)

    // Enter search query
    const searchInput = screen.getByPlaceholderText(/search for videos/i)
    fireEvent.change(searchInput, { target: { value: 'natural gas' } })

    // Click search button - be more specific since there are multiple
    const searchButtons = screen.getAllByText(/Search/i)
    const actualSearchButton = searchButtons.find(btn => 
      btn.tagName === 'BUTTON' && !btn.getAttribute('role')
    )
    expect(actualSearchButton).toBeDefined()
    fireEvent.click(actualSearchButton!)

    // Wait for search results
    await waitFor(() => {
      expect(screen.getByText('Natural Gas 101')).toBeInTheDocument()
    })

    // Click on first video result (the one with wrong URL format)
    const firstVideo = screen.getByText('Natural Gas 101').closest('div[data-testid^="search-result"]')
    expect(firstVideo).toBeDefined()
    fireEvent.click(firstVideo!)

    // Should call storeYouTubeVideo with proper URL, not the title
    await waitFor(() => {
      expect(mockStoreYouTubeVideo).toHaveBeenCalled()
    })

    // Check what parameters were passed
    const callArgs = mockStoreYouTubeVideo.mock.calls[0]
    
    // First parameter should be a valid URL, not the title
    expect(callArgs[0]).not.toBe('Natural Gas 101')
    
    // If embedUrl exists, it should use that, otherwise construct from video ID
    expect(callArgs[0]).toMatch(/^https:\/\/(youtube\.com|youtu\.be)/)
    
    // Second parameter should be the title
    expect(callArgs[1]).toBe('Natural Gas 101')
  })

  it('should handle YouTube results with proper URL correctly', async () => {
    render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider>
          <StepNavigationProvider>
            <MediaEnhancementWizard
              courseContent={mockCourseContent}
              onComplete={mockOnComplete}
              currentPageIndex={0}
              onPageChange={mockOnPageChange}
            />
          </StepNavigationProvider>
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Switch to video search
    const videoTab = screen.getByText(/Videos/i, { selector: 'button[role="tab"]' })
    fireEvent.click(videoTab)

    // Search
    const searchInput = screen.getByPlaceholderText(/search for videos/i)
    fireEvent.change(searchInput, { target: { value: 'safety' } })
    
    const searchButtons = screen.getAllByText(/Search/i)
    const actualSearchButton = searchButtons.find(btn => 
      btn.tagName === 'BUTTON' && !btn.getAttribute('role')
    )
    fireEvent.click(actualSearchButton!)

    await waitFor(() => {
      expect(screen.getByText('Mercaptan Safety')).toBeInTheDocument()
    })

    // Click on second video (the one with correct URL)
    const secondVideo = screen.getByText('Mercaptan Safety').closest('div[data-testid^="search-result"]')
    fireEvent.click(secondVideo!)

    await waitFor(() => {
      expect(mockStoreYouTubeVideo).toHaveBeenCalledWith(
        'https://youtube.com/watch?v=xyz789',
        'Mercaptan Safety'
      )
    })
  })

  it('should not show error message when video is added successfully', async () => {
    render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider>
          <StepNavigationProvider>
            <MediaEnhancementWizard
              courseContent={mockCourseContent}
              onComplete={mockOnComplete}
              currentPageIndex={0}
              onPageChange={mockOnPageChange}
            />
          </StepNavigationProvider>
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Switch to video search and search
    const videoTab = screen.getByText(/Videos/i, { selector: 'button[role="tab"]' })
    fireEvent.click(videoTab)

    const searchInput = screen.getByPlaceholderText(/search for videos/i)
    fireEvent.change(searchInput, { target: { value: 'test' } })
    
    const searchButtons = screen.getAllByText(/Search/i)
    const actualSearchButton = searchButtons.find(btn => 
      btn.tagName === 'BUTTON' && !btn.getAttribute('role')
    )
    fireEvent.click(actualSearchButton!)

    await waitFor(() => {
      expect(screen.getByText('Mercaptan Safety')).toBeInTheDocument()
    })

    // Click on video with proper URL
    const video = screen.getByText('Mercaptan Safety').closest('div[data-testid^="search-result"]')
    fireEvent.click(video!)

    // Should not show error message
    await waitFor(() => {
      expect(screen.queryByText(/Failed to add media/i)).not.toBeInTheDocument()
    })
  })
})