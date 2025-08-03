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

// Mock media context
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
    title: 'Learning Objectives', 
    content: 'Objectives content',
    media: []
  },
  topics: [
    {
      id: 'topic-1',
      title: 'Introduction to Safety',
      content: 'Safety basics',
      media: []
    }
  ]
}

describe('MediaEnhancementWizard - Media Persistence', () => {
  const mockOnComplete = vi.fn()
  const mockOnPageChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should clear uploaded media when changing pages', async () => {
    const { rerender } = render(
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

    // Switch to upload tab
    const uploadTab = screen.getByText(/Upload/i, { selector: 'button[role="tab"]' })
    fireEvent.click(uploadTab)

    // Simulate file upload
    const fileInput = screen.getByLabelText(/drop files here/i).parentElement?.querySelector('input[type="file"]')
    expect(fileInput).toBeDefined()
    
    const file = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    })
    fireEvent.change(fileInput!)

    // Wait for upload to process
    await waitFor(() => {
      expect(screen.getByText('test.jpg')).toBeInTheDocument()
    })

    // Change to a different page
    rerender(
      <PersistentStorageProvider>
        <UnifiedMediaProvider>
          <StepNavigationProvider>
            <MediaEnhancementWizard
              courseContent={mockCourseContent}
              onComplete={mockOnComplete}
              currentPageIndex={1} // Changed to Learning Objectives
              onPageChange={mockOnPageChange}
            />
          </StepNavigationProvider>
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Switch back to upload tab to check
    const uploadTabAgain = screen.getByText(/Upload/i, { selector: 'button[role="tab"]' })
    fireEvent.click(uploadTabAgain)

    // Uploaded media should be cleared
    expect(screen.queryByText('test.jpg')).not.toBeInTheDocument()
  })

  it('should clear search results when changing pages', async () => {
    const { rerender } = render(
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
    fireEvent.change(searchInput, { target: { value: 'test query' } })

    // Change page
    rerender(
      <PersistentStorageProvider>
        <UnifiedMediaProvider>
          <StepNavigationProvider>
            <MediaEnhancementWizard
              courseContent={mockCourseContent}
              onComplete={mockOnComplete}
              currentPageIndex={1}
              onPageChange={mockOnPageChange}
            />
          </StepNavigationProvider>
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Search input should be cleared
    const newSearchInput = screen.getByPlaceholderText(/search for images/i)
    expect(newSearchInput).toHaveValue('')
  })

  it('should keep media specific to each page', async () => {
    const getMediaForPageMock = vi.fn()
    
    // Mock different media for different pages
    getMediaForPageMock.mockImplementation((pageId: string) => {
      if (pageId === 'welcome') {
        return [{ id: 'media-1', type: 'image', title: 'Welcome Image' }]
      } else if (pageId === 'objectives') {
        return [{ id: 'media-2', type: 'image', title: 'Objectives Image' }]
      }
      return []
    })

    vi.mock('../../contexts/UnifiedMediaContext', () => ({
      useUnifiedMedia: () => ({
        getMediaForPage: getMediaForPageMock,
        // ... other methods
      })
    }))

    const { rerender } = render(
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

    // Welcome page should show its media
    expect(getMediaForPageMock).toHaveBeenCalledWith('welcome')

    // Change to objectives page
    rerender(
      <PersistentStorageProvider>
        <UnifiedMediaProvider>
          <StepNavigationProvider>
            <MediaEnhancementWizard
              courseContent={mockCourseContent}
              onComplete={mockOnComplete}
              currentPageIndex={1}
              onPageChange={mockOnPageChange}
            />
          </StepNavigationProvider>
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Should now show objectives page media
    expect(getMediaForPageMock).toHaveBeenCalledWith('objectives')
  })
})