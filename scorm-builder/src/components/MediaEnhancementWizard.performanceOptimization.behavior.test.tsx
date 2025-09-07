import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import type { SearchResult } from '../services/searchService'
import type { MediaItem } from '../services/MediaService'
import type { CourseContent } from '../types/course'

const mockCourseContent: CourseContent = {
  title: 'Test Course',
  welcomePage: {
    title: 'Welcome',
    content: 'Welcome to the course',
    startButtonText: 'Start',
    media: []
  },
  learningObjectivesPage: {
    objectives: ['Learn basics', 'Understand concepts'],
    media: []
  },
  topics: [
    {
      id: 'topic-1',
      title: 'Topic 1',
      content: 'Topic content',
      media: []
    }
  ],
  assessment: {
    questions: [
      {
        id: 'q1',
        question: 'Test question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0
      }
    ]
  }
}

// Track render counts to verify performance optimizations
let renderCount = 0
const originalConsoleLog = console.log

// Mock search service
vi.mock('../services/searchService', () => ({
  searchGoogleImages: vi.fn().mockResolvedValue({
    results: Array.from({ length: 10 }, (_, i) => ({
      id: `search-${i}`,
      title: `Search Result ${i}`,
      url: `https://example.com/image-${i}.jpg`,
      thumbnail: `https://example.com/thumb-${i}.jpg`,
      source: 'Test Source',
      dimensions: '800x600',
      alt: `Alt text ${i}`
    })),
    totalResults: 100,
    error: null
  }),
  searchYouTubeVideos: vi.fn().mockResolvedValue({
    results: [],
    totalResults: 0,
    error: null
  })
}))

const mockUploadedMedia: MediaItem[] = Array.from({ length: 10 }, (_, i) => ({
  id: `upload-${i}`,
  title: `Uploaded Media ${i}`,
  url: `blob:///upload-${i}`,
  thumbnail: `blob:///thumb-${i}`,
  source: 'Upload',
  dimensions: '1024x768',
  alt: `Alt text ${i}`,
  blob: new Blob(),
  type: 'image' as const
}))

// Mock UnifiedMediaContext
const mockMediaContext = {
  storeMedia: vi.fn(),
  getMedia: vi.fn(),
  listMedia: vi.fn().mockResolvedValue(mockUploadedMedia),
  deleteMedia: vi.fn(),
  storeYouTubeVideo: vi.fn(),
  clearProject: vi.fn()
}

vi.mock('../contexts/UnifiedMediaContext', () => ({
  UnifiedMediaProvider: ({ children }: { children: React.ReactNode }) => children,
  useUnifiedMedia: () => mockMediaContext
}))

// Mock UnsavedChangesContext
vi.mock('../contexts/UnsavedChangesContext', () => ({
  UnsavedChangesProvider: ({ children }: { children: React.ReactNode }) => children,
  useUnsavedChanges: () => ({
    addUnsavedChanges: vi.fn(),
    removeUnsavedChanges: vi.fn(),
    hasUnsavedChanges: false,
    unsavedChanges: []
  })
}))

// Mock NotificationContext
vi.mock('../contexts/NotificationContext', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => children,
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  })
}))

// Mock PersistentStorageContext
vi.mock('../contexts/PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: { children: React.ReactNode }) => children,
  useStorage: () => ({
    saveCourseSeedData: vi.fn(),
    getCourseSeedData: vi.fn(),
    saveContent: vi.fn(),
    getContent: vi.fn()
  })
}))

// Mock StepNavigationContext
vi.mock('../contexts/StepNavigationContext', () => ({
  StepNavigationProvider: ({ children }: { children: React.ReactNode }) => children,
  useStepNavigation: () => ({
    currentStep: 'media-enhancement',
    setCurrentStep: vi.fn(),
    navigateToStep: vi.fn(),
    getStepInfo: vi.fn().mockReturnValue({ title: 'Media Enhancement', isCompleted: false })
  })
}))

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <UnsavedChangesProvider>
    <UnifiedMediaProvider>
      {children}
    </UnifiedMediaProvider>
  </UnsavedChangesProvider>
)

describe('MediaEnhancementWizard Performance Optimization', () => {
  beforeEach(() => {
    renderCount = 0
    vi.clearAllMocks()
    
    // Intercept console.log to count renders (for debugging purposes)
    console.log = (...args) => {
      if (args[0]?.includes?.('MediaEnhancementWizard render')) {
        renderCount++
      }
      originalConsoleLog(...args)
    }
  })

  afterEach(() => {
    console.log = originalConsoleLog
  })

  it('should minimize re-renders when combining search and upload results', async () => {
    const onSave = vi.fn()
    const { rerender } = render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          onSave={onSave}
          currentPage="welcome"
        />
      </TestWrapper>
    )

    // Initial render
    expect(screen.getByText('Add Media')).toBeInTheDocument()

    // Switch to images tab and search
    const imagesTab = screen.getByRole('tab', { name: 'Images' })
    fireEvent.click(imagesTab)

    const searchInput = screen.getByPlaceholderText('Search for images...')
    fireEvent.change(searchInput, { target: { value: 'test search' } })

    const searchButton = screen.getByText('Search')
    fireEvent.click(searchButton)

    // Wait for search results
    await waitFor(() => {
      expect(screen.getByTestId('search-result-0')).toBeInTheDocument()
    })

    // Record initial render state
    const initialResultsGrid = screen.getByTestId('search-result-0').parentElement

    // Trigger state changes that shouldn't cause unnecessary re-renders
    // This simulates user interactions that currently cause array recombination
    fireEvent.change(searchInput, { target: { value: 'test search modified' } })
    
    // The results grid should use memoized array combination
    // Without optimization: array combination happens on every render
    // With optimization: array combination only happens when dependencies change
    
    // Re-render with same props to test memoization
    rerender(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          onSave={onSave}
          currentPage="welcome"
        />
      </TestWrapper>
    )

    // The DOM should remain stable (indicating memoization is working)
    expect(screen.getByTestId('search-result-0').parentElement).toBe(initialResultsGrid)
  })

  it('should prevent expensive array operations on every render', async () => {
    let arrayOperationCount = 0
    
    // Mock Array.prototype methods to count operations
    const originalSpread = Array.prototype.concat
    Array.prototype.concat = function(...args) {
      arrayOperationCount++
      return originalSpread.call(this, ...args)
    }

    const onSave = vi.fn()
    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          onSave={onSave}
          currentPage="welcome"
        />
      </TestWrapper>
    )

    // Switch to images tab and search
    const imagesTab = screen.getByRole('tab', { name: 'Images' })
    fireEvent.click(imagesTab)

    const searchInput = screen.getByPlaceholderText('Search for images...')
    fireEvent.change(searchInput, { target: { value: 'test' } })
    fireEvent.click(screen.getByText('Search'))

    await waitFor(() => {
      expect(screen.getByTestId('search-result-0')).toBeInTheDocument()
    })

    const initialOperationCount = arrayOperationCount

    // Trigger multiple state updates that shouldn't cause array recombination
    fireEvent.change(searchInput, { target: { value: 'test 1' } })
    fireEvent.change(searchInput, { target: { value: 'test 2' } })
    fireEvent.change(searchInput, { target: { value: 'test 3' } })

    // Without memoization: array operations increase with each render
    // With memoization: array operations should remain stable when dependencies don't change
    const finalOperationCount = arrayOperationCount

    // This test will initially fail, demonstrating the performance issue
    expect(finalOperationCount).toBe(initialOperationCount)

    // Restore original method
    Array.prototype.concat = originalSpread
  })

  it('should memoize video thumbnail generation for consistent results', async () => {
    const videoResults: SearchResult[] = [
      {
        id: 'video-1',
        title: 'Test Video',
        url: 'https://youtube.com/watch?v=abc123',
        embedUrl: 'https://youtube.com/embed/abc123',
        thumbnail: 'https://img.youtube.com/vi/abc123/mqdefault.jpg',
        source: 'YouTube',
        dimensions: '1280x720',
        alt: 'Test video'
      }
    ]

    // Mock search to return video results
    const { searchGoogleImages } = await import('../services/searchService')
    vi.mocked(searchGoogleImages).mockResolvedValueOnce({
      results: videoResults,
      totalResults: 1,
      error: null
    })

    const onSave = vi.fn()
    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          onSave={onSave}
          currentPage="welcome"
        />
      </TestWrapper>
    )

    // Search for videos
    const imagesTab = screen.getByRole('tab', { name: 'Images' })
    fireEvent.click(imagesTab)

    fireEvent.change(screen.getByPlaceholderText('Search for images...'), { 
      target: { value: 'video test' } 
    })
    fireEvent.click(screen.getByText('Search'))

    await waitFor(() => {
      expect(screen.getByTestId('search-result-0')).toBeInTheDocument()
    })

    // Check that video thumbnail is rendered consistently
    const videoElement = screen.getByText('📹 Video') || screen.getByAltText('Test Video')
    expect(videoElement).toBeInTheDocument()

    // Multiple re-renders shouldn't recreate video thumbnails unnecessarily
    fireEvent.change(screen.getByPlaceholderText('Search for images...'), { 
      target: { value: 'video test modified' } 
    })

    // Video element should remain stable
    expect(videoElement).toBeInTheDocument()
  })
})