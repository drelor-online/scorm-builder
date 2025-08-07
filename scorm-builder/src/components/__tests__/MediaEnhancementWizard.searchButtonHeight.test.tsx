import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'

// Mock MediaService
vi.mock('../../services/MediaService', () => ({
  createMediaService: vi.fn().mockReturnValue({
    getMedia: vi.fn(),
    storeMedia: vi.fn(),
    deleteMedia: vi.fn(),
    listMedia: vi.fn().mockResolvedValue([]),
    listAllMedia: vi.fn().mockResolvedValue([])
  })
}))

// Mock API calls
vi.mock('../../services/api', () => ({
  googleImageSearch: vi.fn(),
  generateAIImage: vi.fn(),
  youtubeSearch: vi.fn()
}))

// Mock search service
vi.mock('../../services/searchService', () => ({
  searchImages: vi.fn().mockResolvedValue([]),
  searchYouTubeVideos: vi.fn().mockResolvedValue([])
}))

// Mock API key storage
vi.mock('../../services/ApiKeyStorage', () => ({
  loadApiKeys: vi.fn().mockResolvedValue({})
}))

// Mock external image downloader
vi.mock('../../services/externalImageDownloader', () => ({
  isKnownCorsRestrictedDomain: vi.fn().mockReturnValue(false),
  downloadExternalImage: vi.fn()
}))

describe('MediaEnhancementWizard - Search Button Height', () => {
  const mockProps = {
    courseContent: {
      courseTitle: 'Test Course',
      topics: [],
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content'
      },
      objectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Objectives content'
      }
    },
    courseSeedData: {},
    onNext: vi.fn(),
    onBack: vi.fn(),
    onCourseContentChange: vi.fn(),
    onSettingsClick: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have search button same height as input field', async () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider totalSteps={5} currentStep={3}>
          <UnifiedMediaProvider projectId="test">
            <MediaEnhancementWizard {...mockProps} />
          </UnifiedMediaProvider>
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search.*images/i)).toBeInTheDocument()
    })

    // Find all search inputs and buttons
    const searchInputs = screen.getAllByPlaceholderText(/search/i)
    const searchButtons = screen.getAllByText('Search')

    // Check each pair
    searchInputs.forEach((input, index) => {
      if (searchButtons[index]) {
        const inputStyles = window.getComputedStyle(input)
        const buttonStyles = window.getComputedStyle(searchButtons[index])

        // Get computed heights including padding and border
        const inputHeight = input.offsetHeight
        const buttonHeight = searchButtons[index].offsetHeight

        console.log(`Pair ${index + 1} - Input height: ${inputHeight}px, Button height: ${buttonHeight}px`)

        // They should be the same height (allowing for 2px difference)
        expect(Math.abs(inputHeight - buttonHeight)).toBeLessThanOrEqual(2)
      }
    })
  })

  it('should have consistent vertical padding for search elements', async () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider totalSteps={5} currentStep={3}>
          <UnifiedMediaProvider projectId="test">
            <MediaEnhancementWizard {...mockProps} />
          </UnifiedMediaProvider>
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search.*images/i)).toBeInTheDocument()
    })

    const searchInputs = screen.getAllByPlaceholderText(/search/i)
    const searchButtons = screen.getAllByText('Search')

    searchInputs.forEach((input, index) => {
      if (searchButtons[index]) {
        const inputStyles = window.getComputedStyle(input)
        const buttonStyles = window.getComputedStyle(searchButtons[index])

        // Check padding values
        const inputPaddingTop = parseFloat(inputStyles.paddingTop)
        const inputPaddingBottom = parseFloat(inputStyles.paddingBottom)
        const buttonPaddingTop = parseFloat(buttonStyles.paddingTop)
        const buttonPaddingBottom = parseFloat(buttonStyles.paddingBottom)

        const inputTotalPadding = inputPaddingTop + inputPaddingBottom
        const buttonTotalPadding = buttonPaddingTop + buttonPaddingBottom

        console.log(`Pair ${index + 1} - Input padding: ${inputTotalPadding}px, Button padding: ${buttonTotalPadding}px`)

        // Padding should be similar
        expect(Math.abs(inputTotalPadding - buttonTotalPadding)).toBeLessThanOrEqual(4)
      }
    })
  })

  it('should have matching border widths', async () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider totalSteps={5} currentStep={3}>
          <UnifiedMediaProvider projectId="test">
            <MediaEnhancementWizard {...mockProps} />
          </UnifiedMediaProvider>
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search.*images/i)).toBeInTheDocument()
    })

    const searchInputs = screen.getAllByPlaceholderText(/search/i)
    const searchButtons = screen.getAllByText('Search')

    searchInputs.forEach((input, index) => {
      if (searchButtons[index]) {
        const inputStyles = window.getComputedStyle(input)
        const buttonStyles = window.getComputedStyle(searchButtons[index])

        // Get border widths
        const inputBorder = parseFloat(inputStyles.borderTopWidth) + parseFloat(inputStyles.borderBottomWidth)
        const buttonBorder = parseFloat(buttonStyles.borderTopWidth) + parseFloat(buttonStyles.borderBottomWidth)

        console.log(`Pair ${index + 1} - Input border: ${inputBorder}px, Button border: ${buttonBorder}px`)

        // Border widths should match (allow 2px difference for different rendering)
        expect(Math.abs(inputBorder - buttonBorder)).toBeLessThanOrEqual(2)
      }
    })
  })
})