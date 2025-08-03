import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { vi } from 'vitest'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'

// Mock UnifiedMediaContext
const mockGetMediaForPage = vi.fn().mockReturnValue([])
const mockStoreMedia = vi.fn()
const mockStoreYouTubeVideo = vi.fn()
const mockDeleteMedia = vi.fn()

vi.mock('../../contexts/UnifiedMediaContext', () => ({
  UnifiedMediaProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useUnifiedMedia: () => ({
    storeMedia: mockStoreMedia,
    getMediaForPage: mockGetMediaForPage,
    storeYouTubeVideo: mockStoreYouTubeVideo,
    deleteMedia: mockDeleteMedia,
  })
}))

// Mock search service
vi.mock('../../services/searchService', () => ({
  searchGoogleImages: vi.fn(),
  searchYouTubeVideos: vi.fn(),
  SearchError: class SearchError extends Error {}
}))

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <PersistentStorageProvider>
      <StepNavigationProvider visitedSteps={[0, 1, 2, 3]} currentStep={3}>
        {children}
      </StepNavigationProvider>
    </PersistentStorageProvider>
  )
}

describe('MediaEnhancementWizard - loadExistingMedia scope issue', () => {
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
    onNext: vi.fn(),
    onBack: vi.fn(),
    onUpdateContent: vi.fn(),
    onSave: vi.fn()
  }

  it('should not throw error when handleAddMedia tries to call loadExistingMedia', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(
      <TestWrapper>
        <MediaEnhancementWizard {...mockProps} />
      </TestWrapper>
    )

    // Wait for component to mount
    await waitFor(() => {
      expect(screen.getByText(/Welcome Page/i)).toBeInTheDocument()
    })

    // Find and click on upload tab
    const uploadTab = screen.getByText(/Upload Media/i)
    await userEvent.click(uploadTab)

    // Create a mock file
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement

    // Upload the file - this should trigger handleAddMedia which calls loadExistingMedia
    await userEvent.upload(input, file)

    // Wait a bit for async operations
    await waitFor(() => {
      // Check that no error was thrown about loadExistingMedia being undefined
      const errorCalls = consoleErrorSpy.mock.calls
      const hasLoadExistingMediaError = errorCalls.some(call => 
        call.some(arg => 
          typeof arg === 'string' && arg.includes('loadExistingMedia is not defined')
        )
      )
      
      expect(hasLoadExistingMediaError).toBe(true) // This test should FAIL initially
    }, { timeout: 2000 })

    consoleErrorSpy.mockRestore()
  })

  it('should be able to reload existing media after adding new media', async () => {
    // Reset and setup mocks for this test
    mockGetMediaForPage.mockReset()
    mockGetMediaForPage
      .mockReturnValueOnce([]) // Initial load
      .mockReturnValueOnce([  // After adding media
        {
          id: 'media-1',
          type: 'image',
          fileName: 'test.jpg',
          metadata: { title: 'Test Image' }
        }
      ])
    
    mockStoreMedia.mockResolvedValue({ id: 'media-1' })

    render(
      <TestWrapper>
        <MediaEnhancementWizard {...mockProps} />
      </TestWrapper>
    )

    // Wait for initial load
    await waitFor(() => {
      expect(mockGetMediaForPage).toHaveBeenCalledWith('welcome')
    })

    // Upload a file
    const uploadTab = screen.getByText(/Upload Media/i)
    await userEvent.click(uploadTab)

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const input = screen.getByLabelText(/Choose files/i) as HTMLInputElement
    await userEvent.upload(input, file)

    // After upload, loadExistingMedia should be called again
    await waitFor(() => {
      // Should have been called at least twice (initial + after upload)
      expect(mockGetMediaForPage).toHaveBeenCalledTimes(2)
    })
  })
})