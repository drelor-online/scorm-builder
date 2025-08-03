import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'

// Mock search service
vi.mock('../../services/searchService', () => ({
  searchGoogleImages: vi.fn().mockResolvedValue({
    results: [
      {
        id: 'img-1',
        url: 'https://example.com/image1.jpg',
        title: 'Test Image 1',
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        width: 800,
        height: 600
      }
    ],
    totalResults: 1
  })
}))

// Mock media context
const mockStoreExternalMedia = vi.fn().mockResolvedValue({
  id: 'stored-media-1',
  storageId: 'storage-1',
  url: 'https://example.com/image1.jpg',
  type: 'image'
})

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
    storeExternalMedia: mockStoreExternalMedia,
    storeYouTubeVideo: vi.fn()
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

describe('MediaEnhancementWizard - Success Message Display', () => {
  const mockOnComplete = vi.fn()
  const mockOnPageChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display success message when media is added', async () => {
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

    // Enter search query
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'test image' } })

    // Click search button
    const searchButton = screen.getByText(/Search/i)
    fireEvent.click(searchButton)

    // Wait for search results
    await waitFor(() => {
      expect(screen.getByText('Test Image 1')).toBeInTheDocument()
    })

    // Click on image result
    const imageResult = screen.getByText('Test Image 1').closest('div')
    fireEvent.click(imageResult!)

    // Should display success message
    await waitFor(() => {
      expect(screen.getByText(/Media added to page/i)).toBeInTheDocument()
    })
  })

  it('should hide success message after timeout', async () => {
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

    // Search and add media
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    fireEvent.change(searchInput, { target: { value: 'test' } })
    fireEvent.click(screen.getByText(/Search/i))

    await waitFor(() => {
      expect(screen.getByText('Test Image 1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Test Image 1').closest('div')!)

    // Success message should appear
    await waitFor(() => {
      expect(screen.getByText(/Media added to page/i)).toBeInTheDocument()
    })

    // Success message should disappear after timeout
    await waitFor(() => {
      expect(screen.queryByText(/Media added to page/i)).not.toBeInTheDocument()
    }, { timeout: 4000 })
  })

  it('should not have duplicate handleToggleSelection functions', () => {
    // This test checks the component implementation
    const componentSource = MediaEnhancementWizard.toString()
    const matches = componentSource.match(/const handleToggleSelection/g) || []
    
    // Should only have one handleToggleSelection function
    expect(matches.length).toBeLessThanOrEqual(1)
  })
})