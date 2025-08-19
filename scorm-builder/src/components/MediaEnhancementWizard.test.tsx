import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'

// Mock the search service
vi.mock('../services/searchService', () => ({
  searchGoogleImages: vi.fn().mockResolvedValue([]),
  searchYouTubeVideos: vi.fn().mockResolvedValue([]),
  SearchError: class SearchError extends Error {}
}))

// Mock the external image downloader
vi.mock('../services/externalImageDownloader', () => ({
  isKnownCorsRestrictedDomain: vi.fn().mockReturnValue(false),
  downloadExternalImage: vi.fn().mockResolvedValue('blob:mock-url')
}))

const mockCourseContent = {
  welcomePage: {
    id: 'welcome',
    title: 'Welcome',
    content: 'Welcome to the course',
    media: []
  },
  learningObjectivesPage: {
    id: 'objectives',
    title: 'Learning Objectives',
    content: 'Course objectives',
    media: []
  },
  topics: [
    {
      id: 'topic1',
      title: 'Topic 1',
      pages: [
        {
          id: 'page1',
          title: 'Page 1',
          content: 'Page content',
          media: []
        }
      ]
    }
  ],
  assessment: {
    questions: []
  }
}

const mockProps = {
  courseContent: mockCourseContent,
  onNext: vi.fn(),
  onBack: vi.fn(),
  onUpdateContent: vi.fn()
}

describe('MediaEnhancementWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(
      <UnifiedMediaProvider>
        <PersistentStorageProvider>
          <MediaEnhancementWizard {...mockProps} />
        </PersistentStorageProvider>
      </UnifiedMediaProvider>
    )
    
    expect(screen.getByText(/Media Enhancement/i)).toBeInTheDocument()
  })

  it('displays page navigation', () => {
    render(
      <UnifiedMediaProvider>
        <PersistentStorageProvider>
          <MediaEnhancementWizard {...mockProps} />
        </PersistentStorageProvider>
      </UnifiedMediaProvider>
    )
    
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
    expect(screen.getByText('Topic 1')).toBeInTheDocument()
  })

  it('switches between pages when navigation items are clicked', async () => {
    render(
      <UnifiedMediaProvider>
        <PersistentStorageProvider>
          <MediaEnhancementWizard {...mockProps} />
        </PersistentStorageProvider>
      </UnifiedMediaProvider>
    )
    
    const objectivesButton = screen.getByText('Learning Objectives')
    fireEvent.click(objectivesButton)
    
    await waitFor(() => {
      expect(screen.getByText('Course objectives')).toBeInTheDocument()
    })
  })

  it('displays media search tabs', () => {
    render(
      <UnifiedMediaProvider>
        <PersistentStorageProvider>
          <MediaEnhancementWizard {...mockProps} />
        </PersistentStorageProvider>
      </UnifiedMediaProvider>
    )
    
    expect(screen.getByText('Search Images')).toBeInTheDocument()
    expect(screen.getByText('Search Videos')).toBeInTheDocument()
    expect(screen.getByText('Upload Media')).toBeInTheDocument()
  })

  it('handles the Next button click', () => {
    render(
      <UnifiedMediaProvider>
        <PersistentStorageProvider>
          <MediaEnhancementWizard {...mockProps} />
        </PersistentStorageProvider>
      </UnifiedMediaProvider>
    )
    
    const nextButton = screen.getByRole('button', { name: /Next/i })
    fireEvent.click(nextButton)
    
    expect(mockProps.onNext).toHaveBeenCalledWith(mockCourseContent)
  })

  it('handles the Back button click', () => {
    render(
      <UnifiedMediaProvider>
        <PersistentStorageProvider>
          <MediaEnhancementWizard {...mockProps} />
        </PersistentStorageProvider>
      </UnifiedMediaProvider>
    )
    
    const backButton = screen.getByRole('button', { name: /Back/i })
    fireEvent.click(backButton)
    
    expect(mockProps.onBack).toHaveBeenCalled()
  })

  it('updates content when media is added', async () => {
    const { rerender } = render(
      <UnifiedMediaProvider>
        <PersistentStorageProvider>
          <MediaEnhancementWizard {...mockProps} />
        </PersistentStorageProvider>
      </UnifiedMediaProvider>
    )
    
    // Simulate adding media (this would normally be done through user interaction)
    const updatedContent = {
      ...mockCourseContent,
      welcomePage: {
        ...mockCourseContent.welcomePage,
        media: [{ id: 'media1', url: 'test.jpg', type: 'image' as const }]
      }
    }
    
    rerender(
      <UnifiedMediaProvider>
        <PersistentStorageProvider>
          <MediaEnhancementWizard {...mockProps} courseContent={updatedContent} />
        </PersistentStorageProvider>
      </UnifiedMediaProvider>
    )
    
    await waitFor(() => {
      expect(mockProps.onUpdateContent).toHaveBeenCalled()
    })
  })

  it('applies correct CSS module classes', () => {
    const { container } = render(
      <UnifiedMediaProvider>
        <PersistentStorageProvider>
          <MediaEnhancementWizard {...mockProps} />
        </PersistentStorageProvider>
      </UnifiedMediaProvider>
    )
    
    // Check that CSS module classes are being used
    const pagePreview = container.querySelector('[class*="pagePreview"]')
    expect(pagePreview).toBeInTheDocument()
    
    // Check that inline styles are not present in refactored sections
    const searchContainer = container.querySelector('[class*="searchContainer"]')
    if (searchContainer) {
      expect(searchContainer.getAttribute('style')).toBeNull()
    }
  })
})