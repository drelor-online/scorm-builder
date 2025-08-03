import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'

// Test wrapper with required providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <StepNavigationProvider visitedSteps={[0, 1, 2]} currentStep={2}>
      {children}
    </StepNavigationProvider>
  )
}

// Mock the UnifiedMediaContext
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

// Mock the API search function
const mockSearchImages = vi.fn()
const mockSearchVideos = vi.fn()

// Mock API service
vi.mock('../../services/ApiService', () => ({
  searchImages: mockSearchImages,
  searchVideos: mockSearchVideos
}))

// Mock PersistentStorageContext
vi.mock('../../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    loading: false,
    error: null,
    projects: [],
    refreshProjects: vi.fn(),
    deleteProject: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    currentProjectId: 'test-project',
    isInitialized: true,
    getContent: vi.fn().mockResolvedValue({ steps: [0, 1, 2] }),
    saveContent: vi.fn().mockResolvedValue(true)
  })
}))

describe('MediaEnhancementWizard - Auto Search', () => {
  const mockCourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome to the course',
      imageSearchTerms: ['professional', 'office', 'workplace']
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: 'Objectives here'
    },
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic 1 content',
        imageSearchTerms: ['technology', 'computer'],
        videoSearchTerms: ['tutorial', 'training']
      }
    ]
  }
  
  const mockProps = {
    courseContent: mockCourseContent,
    courseSeedData: {
      courseTitle: 'Test Course',
      difficulty: 3,
      customTopics: ['Topic 1', 'Topic 2'],
      template: 'None' as const,
      templateTopics: []
    },
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSave: vi.fn()
  }
  
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchImages.mockResolvedValue([])
    mockSearchVideos.mockResolvedValue([])
  })
  
  describe('Image Suggestions Auto-Search', () => {
    it('should automatically search when clicking an image suggestion', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MediaEnhancementWizard {...mockProps} />
        </TestWrapper>
      )
      
      // Navigate to Images tab
      const imagesTab = screen.getByRole('tab', { name: /images/i })
      await user.click(imagesTab)
      
      // Wait for suggestions to appear
      await waitFor(() => {
        expect(screen.getByText(/suggested searches/i)).toBeInTheDocument()
      })
      
      // Find and click a suggestion
      const suggestions = screen.getAllByRole('button', { name: /search for/i })
      expect(suggestions.length).toBeGreaterThan(0)
      
      const firstSuggestion = suggestions[0]
      const suggestionText = firstSuggestion.textContent?.replace('Search for ', '').trim()
      
      // Click the suggestion
      await user.click(firstSuggestion)
      
      // Verify search was triggered automatically
      await waitFor(() => {
        expect(mockSearchImages).toHaveBeenCalledWith(expect.stringContaining(suggestionText))
      })
      
      // Verify search input was populated
      const searchInput = screen.getByPlaceholderText(/search for images/i)
      expect(searchInput).toHaveValue(expect.stringContaining(suggestionText))
    })
    
    it('should not require clicking search button after selecting suggestion', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MediaEnhancementWizard {...mockProps} />
        </TestWrapper>
      )
      
      // Navigate to Images tab
      const imagesTab = screen.getByRole('tab', { name: /images/i })
      await user.click(imagesTab)
      
      // Click a suggestion
      await waitFor(() => {
        const suggestions = screen.getAllByRole('button', { name: /search for/i })
        return user.click(suggestions[0])
      })
      
      // Search should be called without needing to click search button
      expect(mockSearchImages).toHaveBeenCalled()
      
      // Search button should not be required
      const searchButton = screen.queryByRole('button', { name: /^search$/i })
      if (searchButton) {
        // If search button exists, it should not need to be clicked
        expect(mockSearchImages).toHaveBeenCalledTimes(1)
      }
    })
  })
  
  describe('Video Suggestions Auto-Search', () => {
    it('should automatically search when clicking a video suggestion', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MediaEnhancementWizard {...mockProps} />
        </TestWrapper>
      )
      
      // Navigate to Videos tab
      const videosTab = screen.getByRole('tab', { name: /videos/i })
      await user.click(videosTab)
      
      // Wait for suggestions to appear
      await waitFor(() => {
        expect(screen.getByText(/suggested searches/i)).toBeInTheDocument()
      })
      
      // Find and click a suggestion
      const suggestions = screen.getAllByRole('button', { name: /search for/i })
      expect(suggestions.length).toBeGreaterThan(0)
      
      const firstSuggestion = suggestions[0]
      const suggestionText = firstSuggestion.textContent?.replace('Search for ', '').trim()
      
      // Click the suggestion
      await user.click(firstSuggestion)
      
      // Verify search was triggered automatically
      await waitFor(() => {
        expect(mockSearchVideos).toHaveBeenCalledWith(expect.stringContaining(suggestionText))
      })
      
      // Verify search input was populated
      const searchInput = screen.getByPlaceholderText(/search for videos/i)
      expect(searchInput).toHaveValue(expect.stringContaining(suggestionText))
    })
  })
  
  describe('Search Results Persistence', () => {
    it('should clear search results when switching tabs', async () => {
      const user = userEvent.setup()
      
      // Mock search results
      mockSearchImages.mockResolvedValue([
        { id: '1', url: 'image1.jpg', title: 'Image 1' },
        { id: '2', url: 'image2.jpg', title: 'Image 2' }
      ])
      
      mockSearchVideos.mockResolvedValue([
        { id: '3', url: 'video1.mp4', title: 'Video 1' },
        { id: '4', url: 'video2.mp4', title: 'Video 2' }
      ])
      
      render(
        <TestWrapper>
          <MediaEnhancementWizard {...mockProps} />
        </TestWrapper>
      )
      
      // Search for images
      const imagesTab = screen.getByRole('tab', { name: /images/i })
      await user.click(imagesTab)
      
      const imageSearchInput = screen.getByPlaceholderText(/search for images/i)
      await user.type(imageSearchInput, 'test images')
      
      const searchButton = screen.getByRole('button', { name: /search/i })
      await user.click(searchButton)
      
      // Wait for image results
      await waitFor(() => {
        expect(screen.getByText('Image 1')).toBeInTheDocument()
        expect(screen.getByText('Image 2')).toBeInTheDocument()
      })
      
      // Switch to Videos tab
      const videosTab = screen.getByRole('tab', { name: /videos/i })
      await user.click(videosTab)
      
      // Image results should not be visible
      expect(screen.queryByText('Image 1')).not.toBeInTheDocument()
      expect(screen.queryByText('Image 2')).not.toBeInTheDocument()
      
      // Search for videos
      const videoSearchInput = screen.getByPlaceholderText(/search for videos/i)
      await user.type(videoSearchInput, 'test videos')
      
      const videoSearchButton = screen.getByRole('button', { name: /search/i })
      await user.click(videoSearchButton)
      
      // Wait for video results
      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument()
        expect(screen.getByText('Video 2')).toBeInTheDocument()
      })
      
      // Switch back to Images tab
      await user.click(imagesTab)
      
      // Video results should not be visible
      expect(screen.queryByText('Video 1')).not.toBeInTheDocument()
      expect(screen.queryByText('Video 2')).not.toBeInTheDocument()
      
      // Image search input should be cleared
      const newImageSearchInput = screen.getByPlaceholderText(/search for images/i)
      expect(newImageSearchInput).toHaveValue('')
    })
  })
})