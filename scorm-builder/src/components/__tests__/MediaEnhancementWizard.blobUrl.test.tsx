import React from 'react'
import { render, screen, waitFor } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import MediaEnhancementWizard from '../MediaEnhancementWizard'
import { act } from 'react-dom/test-utils'

// Mock Tauri API
global.window = {
  ...global.window,
  __TAURI__: {
    invoke: vi.fn()
  },
  __TAURI_INTERNALS__: {
    invoke: vi.fn(),
    convertFileSrc: vi.fn((path: string) => `tauri://localhost/${path}`)
  }
}

// Mock URL.createObjectURL
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()
global.URL.createObjectURL = mockCreateObjectURL
global.URL.revokeObjectURL = mockRevokeObjectURL

// Mock the external services
vi.mock('../../services/searchService', () => ({
  searchGoogleImages: vi.fn().mockResolvedValue([]),
  searchYouTubeVideos: vi.fn().mockResolvedValue([])
}))

// Mock external image downloader
vi.mock('../../services/externalImageDownloader', () => ({
  downloadIfExternal: vi.fn((url) => Promise.resolve(null)),
  isKnownCorsRestrictedDomain: vi.fn(() => false)
}))

describe('MediaEnhancementWizard - Blob URL Generation', () => {
  const mockCourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome content',
      narration: '',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 0,
      media: []
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Objectives',
      content: 'Objectives content',
      narration: '',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 0,
      media: []
    },
    topics: [],
    assessment: { questions: [], passMark: 80, narration: null }
  }

  const mockProps = {
    courseContent: mockCourseContent,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSettingsClick: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onOpen: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn(),
    apiKeys: {
      googleCustomSearchApiKey: 'test-key',
      googleCustomSearchEngineId: 'test-engine'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateObjectURL.mockReturnValue('blob:mock-url-123')
    
    // Mock Tauri store_media command
    ;(window.__TAURI_INTERNALS__.invoke as any).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'store_media') {
        return `stored-${args.id}`
      }
      if (cmd === 'get_media') {
        return {
          id: args.mediaId,
          data: new Uint8Array([1, 2, 3, 4]),
          metadata: {
            page_id: 'welcome',
            type: 'image',
            original_name: 'test.jpg'
          }
        }
      }
      return null
    })
  })

  it('should generate blob URL immediately after uploading an image', async () => {
    const user = userEvent.setup()
    
    render(<MediaEnhancementWizard {...mockProps} />)

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Select a page to add media')).toBeInTheDocument()
    })

    // Click on Upload Media button
    const uploadButton = screen.getByText('Upload Media')
    await user.click(uploadButton)

    // Create a test file
    const testFile = new File(['test image content'], 'test-image.jpg', { type: 'image/jpeg' })
    
    // Find file input and upload file
    const fileInput = screen.getByLabelText('Choose file')
    await user.upload(fileInput, testFile)

    // Wait for upload to complete
    await waitFor(() => {
      // Verify that createObjectURL was called for the uploaded image
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    // Check that the welcome card shows the uploaded image thumbnail
    await waitFor(() => {
      const welcomeCard = screen.queryByTestId('welcome-card')
      if (welcomeCard) {
        const thumbnail = welcomeCard.querySelector('img[alt="Welcome thumbnail"]')
        
        // The image should have a blob URL
        expect(thumbnail).toBeInTheDocument()
        expect(thumbnail?.getAttribute('src')).toBe('blob:mock-url-123')
      }
    })

    // Verify the checkmark appears on the welcome card
    expect(screen.getByTestId('media-count-welcome')).toBeInTheDocument()
  })

  it('should display uploaded image in the current media preview section', async () => {
    const user = userEvent.setup()
    
    render(<MediaEnhancementWizard {...mockProps} />)

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Select a page to add media')).toBeInTheDocument()
    })

    // Click on Upload Media button
    const uploadButton = screen.getByText('Upload Media')
    await user.click(uploadButton)

    // Upload a file
    const testFile = new File(['test image content'], 'test-image.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByLabelText('Choose file')
    await user.upload(fileInput, testFile)

    // Check for current media preview section
    await waitFor(() => {
      const currentMediaSection = screen.queryByText(/Current Media for Welcome/i)
      expect(currentMediaSection).toBeInTheDocument()
      
      // Should show the uploaded image
      const mediaPreview = screen.getByAltText(/Current media/i)
      expect(mediaPreview).toBeInTheDocument()
      expect(mediaPreview.getAttribute('src')).toBe('blob:mock-url-123')
    })
  })

  it('should maintain blob URLs when switching between pages', async () => {
    const user = userEvent.setup()
    
    render(<MediaEnhancementWizard {...mockProps} />)

    // Upload image to welcome page
    await waitFor(() => {
      expect(screen.getByText('Select a page to add media')).toBeInTheDocument()
    })

    const uploadButton = screen.getByText('Upload Media')
    await user.click(uploadButton)

    const testFile = new File(['test image content'], 'test-image.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByLabelText('Choose file')
    await user.upload(fileInput, testFile)

    // Wait for upload
    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    // Switch to objectives page
    const objectivesCard = screen.getByTestId('objectives-card')
    await user.click(objectivesCard)

    // Switch back to welcome page
    const welcomeCard = screen.getByTestId('welcome-card')
    await user.click(welcomeCard)

    // Check that the image is still displayed
    await waitFor(() => {
      const thumbnail = welcomeCard.querySelector('img[alt="Welcome thumbnail"]')
      expect(thumbnail).toBeInTheDocument()
      expect(thumbnail?.getAttribute('src')).toBe('blob:mock-url-123')
    })
  })
})