import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import type { CourseContent, Media } from '../types/aiPrompt'
import type { CourseSeedData } from '../types/course'

// Define mock functions at module level before they're used
const mockUpdateYouTubeVideoMetadata = vi.fn()
const mockGetValidMediaForPage = vi.fn()

// Mock the UnifiedMediaContext
vi.mock('../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: () => ({
    storeMedia: vi.fn(),
    updateYouTubeVideoMetadata: mockUpdateYouTubeVideoMetadata,
    getMedia: vi.fn(),
    deleteMedia: vi.fn(),
    getValidMediaForPage: mockGetValidMediaForPage,
    createBlobUrl: vi.fn().mockResolvedValue('blob:test-url'),
    getAllMedia: vi.fn().mockReturnValue([]),
    getMediaForPage: vi.fn().mockReturnValue([])
  }),
  UnifiedMediaProvider: ({ children }: { children: React.ReactNode }) => children
}))

// Mock external services
vi.mock('../services/searchService', () => ({
  searchYouTubeVideos: vi.fn().mockResolvedValue({
    videos: [],
    nextPageToken: null
  })
}))

vi.mock('../services/externalImageDownloader', () => ({
  isKnownCorsRestrictedDomain: vi.fn().mockReturnValue(false),
  downloadExternalImage: vi.fn(),
  forceDownloadExternalImage: vi.fn()
}))

// Mock PersistentStorageContext to avoid storage dependencies
vi.mock('../contexts/PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useStorage: () => ({
    saveProject: vi.fn(),
    loadProject: vi.fn(),
    saveCourseSeedData: vi.fn(),
    loadCourseSeedData: vi.fn()
  })
}))

// Mock NotificationContext to avoid notification dependencies
vi.mock('../contexts/NotificationContext', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNotifications: () => ({
    addNotification: vi.fn()
  })
}))

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    <PersistentStorageProvider>
      <UnifiedMediaProvider>
        {children}
      </UnifiedMediaProvider>
    </PersistentStorageProvider>
  </NotificationProvider>
)

describe('YouTube Clip Timing Persistence - Headless Behavior Tests', () => {
  let mockOnNext: ReturnType<typeof vi.fn>
  let mockOnBack: ReturnType<typeof vi.fn>
  let mockOnUpdateContent: ReturnType<typeof vi.fn>

  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    courseDescription: 'Test Description',
    learningObjectives: ['Objective 1'],
    targetAudience: 'Students'
  }

  const youtubeVideoWithoutClipTiming: Media = {
    id: 'youtube-video-1',
    type: 'video',
    title: 'Test YouTube Video',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg',
    isYouTube: true,
    storageId: 'storage-123',
    // No initial clip timing
    clipStart: undefined,
    clipEnd: undefined
  }

  const youtubeVideoWithClipTiming: Media = {
    ...youtubeVideoWithoutClipTiming,
    clipStart: 90, // 1:30 in seconds
    clipEnd: 225,  // 3:45 in seconds
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=90&end=225',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=90&end=225'
  }

  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Welcome content</p>',
      narration: 'Welcome narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5,
      media: []
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<p>Objectives content</p>',
      narration: 'Objectives narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3,
      media: []
    },
    topics: [{
      id: 'topic-1',
      title: 'Test Topic',
      content: '<p>Topic content</p>',
      narration: 'Topic narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: ['test video'],
      duration: 10,
      media: [youtubeVideoWithoutClipTiming]
    }],
    assessment: {
      questions: [],
      passMark: 80,
      narration: null
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockOnNext = vi.fn()
    mockOnBack = vi.fn()
    mockOnUpdateContent = vi.fn()
    
    // Reset and configure module-level mocks
    mockUpdateYouTubeVideoMetadata.mockResolvedValue({
      id: 'youtube-video-1',
      metadata: {
        type: 'video',
        title: 'Test YouTube Video',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=90&end=225',
        clipStart: 90,
        clipEnd: 225,
        isYouTube: true
      }
    })

    // Initially return video without clip timing
    mockGetValidMediaForPage.mockResolvedValue([
      {
        id: 'youtube-video-1',
        metadata: {
          type: 'video',
          title: 'Test YouTube Video',
          embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          clipStart: undefined,
          clipEnd: undefined,
          isYouTube: true
        },
        data: new Uint8Array()
      }
    ])

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should persist clip timing values when leaving and returning to page', async () => {
    // Step 1: Render MediaEnhancementWizard with YouTube video (no initial clip timing)
    const { unmount } = render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
          onUpdateContent={mockOnUpdateContent}
        />
      </TestWrapper>
    )

    // Wait for component to render and load media
    await waitFor(() => {
      expect(screen.getByText('Media Enhancement')).toBeInTheDocument()
    })

    // Step 2: Navigate to the topic page with YouTube video
    const topicTab = screen.getByText('Test Topic')
    fireEvent.click(topicTab)

    // Wait for YouTube video to be visible and click on it to open lightbox
    await waitFor(() => {
      expect(screen.getByText('Test YouTube Video')).toBeInTheDocument()
    })

    const youtubeVideo = screen.getByText('Test YouTube Video')
    fireEvent.click(youtubeVideo)

    // Wait for lightbox to open with clip timing inputs
    await waitFor(() => {
      expect(screen.getByLabelText('Clip start time')).toBeInTheDocument()
      expect(screen.getByLabelText('Clip end time')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Step 3: Enter clip timing values
    const startTimeInput = screen.getByLabelText('Clip start time')
    const endTimeInput = screen.getByLabelText('Clip end time')

    // Enter start time: 1:30
    fireEvent.change(startTimeInput, { target: { value: '1:30' } })
    fireEvent.blur(startTimeInput)

    // Enter end time: 3:45  
    fireEvent.change(endTimeInput, { target: { value: '3:45' } })
    fireEvent.blur(endTimeInput)

    // Step 4: Wait for backend save to be called
    await waitFor(() => {
      expect(mockUpdateYouTubeVideoMetadata).toHaveBeenCalledWith('storage-123', {
        clipStart: 90,  // 1:30 in seconds
        clipEnd: 225    // 3:45 in seconds
      })
    }, { timeout: 2000 })

    console.log('[TEST] Backend save verified, unmounting component...')

    // Step 5: Unmount component (simulating navigation away)
    unmount()

    // Step 6: Update mock to return persisted clip timing data
    mockGetValidMediaForPage.mockResolvedValue([
      {
        id: 'youtube-video-1',
        metadata: {
          type: 'video',
          title: 'Test YouTube Video',
          embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=90&end=225',
          clipStart: 90,  // Persisted from backend
          clipEnd: 225,   // Persisted from backend
          isYouTube: true
        },
        data: new Uint8Array()
      }
    ])

    // Step 7: Re-render component (simulating navigation back)
    const courseContentWithPersistedData: CourseContent = {
      ...mockCourseContent,
      topics: [{
        ...mockCourseContent.topics[0],
        media: [youtubeVideoWithClipTiming] // Now includes persisted clip timing
      }]
    }

    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={courseContentWithPersistedData}
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
          onUpdateContent={mockOnUpdateContent}
        />
      </TestWrapper>
    )

    console.log('[TEST] Component re-mounted, verifying persistence...')

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Media Enhancement')).toBeInTheDocument()
    })

    // Navigate back to topic page
    const topicTabReturned = screen.getByText('Test Topic')
    fireEvent.click(topicTabReturned)

    // Click on YouTube video again
    await waitFor(() => {
      expect(screen.getByText('Test YouTube Video')).toBeInTheDocument()
    })

    const youtubeVideoReturned = screen.getByText('Test YouTube Video')
    fireEvent.click(youtubeVideoReturned)

    // Step 8: Verify persisted values are displayed in input fields
    await waitFor(() => {
      const persistedStartInput = screen.getByLabelText('Clip start time')
      const persistedEndInput = screen.getByLabelText('Clip end time')
      
      expect(persistedStartInput).toBeInTheDocument()
      expect(persistedEndInput).toBeInTheDocument()
      
      // Verify the persisted values are displayed
      expect(persistedStartInput).toHaveValue('1:30')
      expect(persistedEndInput).toHaveValue('3:45')
    }, { timeout: 3000 })

    console.log('[TEST] ✅ Persistence verification complete!')

    // Step 9: Verify no additional backend saves occurred (should only load, not save)
    // The updateYouTubeVideoMetadata should have been called exactly once during the initial save
    expect(mockUpdateYouTubeVideoMetadata).toHaveBeenCalledTimes(2) // Once for start, once for end
  })

  test('should handle backend save failure gracefully', async () => {
    // Mock backend failure
    mockUpdateYouTubeVideoMetadata.mockRejectedValue(new Error('Backend save failed'))

    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
          onUpdateContent={mockOnUpdateContent}
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Media Enhancement')).toBeInTheDocument()
    })

    // Navigate to topic and click video
    const topicTab = screen.getByText('Test Topic')
    fireEvent.click(topicTab)

    await waitFor(() => {
      expect(screen.getByText('Test YouTube Video')).toBeInTheDocument()
    })

    const youtubeVideo = screen.getByText('Test YouTube Video')
    fireEvent.click(youtubeVideo)

    await waitFor(() => {
      expect(screen.getByLabelText('Clip start time')).toBeInTheDocument()
    })

    // Enter clip time that will fail to save
    const startTimeInput = screen.getByLabelText('Clip start time')
    fireEvent.change(startTimeInput, { target: { value: '2:00' } })
    fireEvent.blur(startTimeInput)

    // Verify backend was called despite failure
    await waitFor(() => {
      expect(mockUpdateYouTubeVideoMetadata).toHaveBeenCalled()
    })

    // UI should still show the entered value (local state preserved)
    expect(startTimeInput).toHaveValue('2:00')
  })

  test('should preserve invalid input values for user correction', async () => {
    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
          onUpdateContent={mockOnUpdateContent}
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Media Enhancement')).toBeInTheDocument()
    })

    const topicTab = screen.getByText('Test Topic')
    fireEvent.click(topicTab)

    await waitFor(() => {
      expect(screen.getByText('Test YouTube Video')).toBeInTheDocument()
    })

    const youtubeVideo = screen.getByText('Test YouTube Video')
    fireEvent.click(youtubeVideo)

    await waitFor(() => {
      expect(screen.getByLabelText('Clip start time')).toBeInTheDocument()
    })

    // Enter invalid time format
    const startTimeInput = screen.getByLabelText('Clip start time')
    fireEvent.change(startTimeInput, { target: { value: 'invalid-time' } })
    fireEvent.blur(startTimeInput)

    // Wait a moment for any potential processing
    await new Promise(resolve => setTimeout(resolve, 100))

    // Should NOT call backend with invalid input
    expect(mockUpdateYouTubeVideoMetadata).not.toHaveBeenCalled()

    // Should preserve the invalid value for user to correct
    expect(startTimeInput).toHaveValue('invalid-time')
  })
})