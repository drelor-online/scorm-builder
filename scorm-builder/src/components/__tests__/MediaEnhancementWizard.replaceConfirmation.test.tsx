import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { vi } from 'vitest'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'

// Mock MediaService
vi.mock('../../services/MediaService', () => {
  const mockStoreMedia = vi.fn()
  return {
    createMediaService: vi.fn().mockReturnValue({
      getMedia: vi.fn(),
      storeMedia: mockStoreMedia,
      deleteMedia: vi.fn(),
      listMedia: vi.fn().mockResolvedValue([]),
      listAllMedia: vi.fn().mockResolvedValue([])
    })
  }
})

// Mock API calls
vi.mock('../../services/api', () => ({
  googleImageSearch: vi.fn().mockResolvedValue([{
    id: 'test-image-1',
    url: 'https://example.com/image1.jpg',
    thumbnail: 'https://example.com/thumb1.jpg',
    title: 'Test Image 1'
  }]),
  generateAIImage: vi.fn(),
  youtubeSearch: vi.fn()
}))

// Mock external image downloader
vi.mock('../../services/externalImageDownloader', () => ({
  downloadExternalImage: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'image/jpeg' })),
  isKnownCorsRestrictedDomain: vi.fn().mockReturnValue(false)
}))

describe('MediaEnhancementWizard - Replace Confirmation', () => {
  const mockProps = {
    courseContent: {
      courseTitle: 'Test Course',
      topics: [],
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        media: [{
          id: 'existing-media',
          type: 'image',
          url: 'existing.jpg'
        }]
      },
      objectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Objectives content'
      }
    },
    onNext: vi.fn(),
    onBack: vi.fn(),
    onCourseContentChange: vi.fn(),
    onSettingsClick: vi.fn()
  }

  it('should show confirmation dialog when replacing existing media', async () => {

    render(
      <PersistentStorageProvider>
        <StepNavigationProvider>
          <UnifiedMediaProvider projectId="test">
            <MediaEnhancementWizard {...mockProps} />
          </UnifiedMediaProvider>
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // Search for images
    const searchInput = await screen.findByPlaceholderText('Search for images...')
    const searchButton = screen.getByRole('button', { name: /search images/i })
    
    fireEvent.change(searchInput, { target: { value: 'test' } })
    fireEvent.click(searchButton)

    // Wait for search results
    await waitFor(() => {
      expect(screen.getByText('Test Image 1')).toBeInTheDocument()
    })

    // Click on the search result
    const searchResult = screen.getByTestId('search-result-0')
    fireEvent.click(searchResult)

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/replace existing media/i)).toBeInTheDocument()
    })

    // Should have Cancel and Replace buttons
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /replace/i })).toBeInTheDocument()
  })
})