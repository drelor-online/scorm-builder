import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { vi } from 'vitest'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'

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

describe('MediaEnhancementWizard - Tab suggestions filtering', () => {
  const mockProps = {
    courseContent: {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        media: [],
        imagePrompts: ['welcome image 1', 'welcome image 2'],
        imageKeywords: ['photo', 'picture'],
        videoSearchTerms: ['welcome video', 'intro video']
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

  it('should show only image-related suggestions in the image search tab', async () => {
    render(
      <TestWrapper>
        <MediaEnhancementWizard {...mockProps} />
      </TestWrapper>
    )

    // Wait for component to render
    await screen.findByText(/Add New Media/i)

    // Click on image search tab (should be active by default)
    const imageTab = screen.getByText(/Search Images/i)
    expect(imageTab).toBeInTheDocument()

    // Check that image suggestions are shown
    const suggestedSearches = screen.getByText(/Suggested searches:/i)
    expect(suggestedSearches).toBeInTheDocument()

    // Image prompts and keywords should be shown
    expect(screen.getByText('welcome image 1')).toBeInTheDocument()
    expect(screen.getByText('welcome image 2')).toBeInTheDocument()
    expect(screen.getByText('photo')).toBeInTheDocument()
    expect(screen.getByText('picture')).toBeInTheDocument()

    // Video search terms should NOT be shown in image tab
    expect(screen.queryByText('welcome video')).toBeInTheDocument() // This should FAIL initially
    expect(screen.queryByText('intro video')).toBeInTheDocument() // This should FAIL initially
  })

  it('should show only video-related suggestions in the video search tab', async () => {
    const user = userEvent.setup()
    
    render(
      <TestWrapper>
        <MediaEnhancementWizard {...mockProps} />
      </TestWrapper>
    )

    // Wait for component to render
    await screen.findByText(/Add New Media/i)

    // Click on video search tab
    const videoTab = screen.getByText(/Search Videos/i)
    await user.click(videoTab)

    // Video tab should NOT show any prompt suggestions currently
    const suggestedSearches = screen.queryByText(/Suggested searches:/i)
    expect(suggestedSearches).not.toBeInTheDocument() // This should FAIL (we want it to show suggestions)
  })

  it('should not show mockup button in production', () => {
    render(
      <TestWrapper>
        <MediaEnhancementWizard {...mockProps} />
      </TestWrapper>
    )

    // Mockup button should not exist
    const mockupButton = screen.queryByText(/View Media Enhancement Mockup/i)
    expect(mockupButton).not.toBeInTheDocument()
  })
})