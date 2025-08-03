import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'

// Mock the UnifiedMediaContext and API
vi.mock('../../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: vi.fn(() => ({
    storeMedia: vi.fn(),
    getMedia: vi.fn(),
    deleteMedia: vi.fn(),
    storeYouTubeVideo: vi.fn(),
    getMediaForPage: vi.fn(() => []),
    getAllMedia: vi.fn(() => []),
    getMediaById: vi.fn(),
    createBlobUrl: vi.fn((id) => Promise.resolve(`blob:mock-${id}`)),
    revokeBlobUrl: vi.fn(),
    isLoading: false,
    error: null,
    clearError: vi.fn(),
    refreshMedia: vi.fn()
  }))
}))

const mockSearchImages = vi.fn().mockResolvedValue([
  { id: '1', url: 'image1.jpg', title: 'Image 1', thumbnail: 'thumb1.jpg' },
  { id: '2', url: 'image2.jpg', title: 'Image 2', thumbnail: 'thumb2.jpg' },
  { id: '3', url: 'image3.jpg', title: 'Image 3', thumbnail: 'thumb3.jpg' }
])
const mockSearchVideos = vi.fn().mockResolvedValue([])

vi.mock('../../services/ApiService', () => ({
  searchImages: mockSearchImages,
  searchVideos: mockSearchVideos
}))

describe('MediaEnhancementWizard - Single Click Selection', () => {
  const mockProps = {
    courseSeed: {
      courseTitle: 'Test Course',
      difficulty: 3,
      customTopics: ['Topic 1', 'Topic 2'],
      template: 'None' as const,
      templateTopics: []
    },
    activities: [{
      id: 'page-1',
      type: 'page' as const,
      content: { title: 'Page 1', text: 'Content 1' }
    }],
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSave: vi.fn()
  }
  
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('should select media with single click instead of requiring bulk selection', async () => {
    const user = userEvent.setup()
    
    render(<MediaEnhancementWizard {...mockProps} />)
    
    // Navigate to Images tab
    const imagesTab = screen.getByRole('tab', { name: /images/i })
    await user.click(imagesTab)
    
    // Search for images
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    await user.type(searchInput, 'test')
    
    const searchButton = screen.getByRole('button', { name: /search/i })
    await user.click(searchButton)
    
    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Image 1')).toBeInTheDocument()
    })
    
    // Single click on an image should select it immediately
    const firstImage = screen.getByAltText('Image 1')
    await user.click(firstImage)
    
    // Image should be selected without needing a checkbox or bulk selection
    await waitFor(() => {
      // Check for visual indication of selection (border, overlay, etc)
      const imageContainer = firstImage.closest('[data-selected]') || firstImage.parentElement
      expect(imageContainer).toHaveAttribute('data-selected', 'true')
    })
    
    // Should be able to apply to current page immediately
    const applyButton = screen.getByRole('button', { name: /apply|add|use/i })
    expect(applyButton).toBeEnabled()
  })
  
  it('should not show bulk selection UI elements', async () => {
    const user = userEvent.setup()
    
    render(<MediaEnhancementWizard {...mockProps} />)
    
    // Navigate to Images tab
    const imagesTab = screen.getByRole('tab', { name: /images/i })
    await user.click(imagesTab)
    
    // Search for images
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    await user.type(searchInput, 'test')
    
    const searchButton = screen.getByRole('button', { name: /search/i })
    await user.click(searchButton)
    
    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Image 1')).toBeInTheDocument()
    })
    
    // Should not have checkboxes
    const checkboxes = screen.queryAllByRole('checkbox')
    expect(checkboxes.length).toBe(0)
    
    // Should not have "Select All" button
    expect(screen.queryByRole('button', { name: /select all/i })).not.toBeInTheDocument()
    
    // Should not have bulk action buttons
    expect(screen.queryByText(/selected items/i)).not.toBeInTheDocument()
  })
  
  it('should allow deselecting by clicking again', async () => {
    const user = userEvent.setup()
    
    render(<MediaEnhancementWizard {...mockProps} />)
    
    // Navigate to Images tab and search
    const imagesTab = screen.getByRole('tab', { name: /images/i })
    await user.click(imagesTab)
    
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    await user.type(searchInput, 'test')
    
    const searchButton = screen.getByRole('button', { name: /search/i })
    await user.click(searchButton)
    
    await waitFor(() => {
      expect(screen.getByText('Image 1')).toBeInTheDocument()
    })
    
    const firstImage = screen.getByAltText('Image 1')
    
    // Click to select
    await user.click(firstImage)
    
    await waitFor(() => {
      const imageContainer = firstImage.closest('[data-selected]') || firstImage.parentElement
      expect(imageContainer).toHaveAttribute('data-selected', 'true')
    })
    
    // Click again to deselect
    await user.click(firstImage)
    
    await waitFor(() => {
      const imageContainer = firstImage.closest('[data-selected]') || firstImage.parentElement
      expect(imageContainer).toHaveAttribute('data-selected', 'false')
    })
  })
  
  it('should support selecting different media for different pages', async () => {
    const user = userEvent.setup()
    
    const multiPageProps = {
      ...mockProps,
      activities: [
        {
          id: 'page-1',
          type: 'page' as const,
          content: { title: 'Page 1', text: 'Content 1' }
        },
        {
          id: 'page-2',
          type: 'page' as const,
          content: { title: 'Page 2', text: 'Content 2' }
        }
      ]
    }
    
    render(
      <MockMediaProvider>
        <MediaEnhancementWizard {...multiPageProps} />
      </MockMediaProvider>
    )
    
    // Navigate to Images tab
    const imagesTab = screen.getByRole('tab', { name: /images/i })
    await user.click(imagesTab)
    
    // Search for images
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    await user.type(searchInput, 'test')
    
    const searchButton = screen.getByRole('button', { name: /search/i })
    await user.click(searchButton)
    
    await waitFor(() => {
      expect(screen.getByText('Image 1')).toBeInTheDocument()
    })
    
    // Select first image for page 1
    const firstImage = screen.getByAltText('Image 1')
    await user.click(firstImage)
    
    // Apply to page 1
    const applyButton = screen.getByRole('button', { name: /apply|add|use/i })
    await user.click(applyButton)
    
    // Navigate to page 2
    const page2Button = screen.getByRole('button', { name: /page 2/i })
    await user.click(page2Button)
    
    // Select different image for page 2
    const secondImage = screen.getByAltText('Image 2')
    await user.click(secondImage)
    
    // Should be able to apply different image to page 2
    const applyButton2 = screen.getByRole('button', { name: /apply|add|use/i })
    expect(applyButton2).toBeEnabled()
  })
})