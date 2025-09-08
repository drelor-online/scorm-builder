import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import type { CourseContent } from '../types/aiPrompt'
import type { CourseSeedData } from '../types/course'

// Mock functions at module level
const mockGetValidMediaForPage = vi.fn()
const mockUpdateYouTubeVideoMetadata = vi.fn()

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
  searchYouTubeVideos: vi.fn().mockResolvedValue({ videos: [], nextPageToken: null }),
  searchGoogleImages: vi.fn().mockResolvedValue([])
}))

vi.mock('../services/externalImageDownloader', () => ({
  isKnownCorsRestrictedDomain: vi.fn().mockReturnValue(false),
  downloadExternalImage: vi.fn(),
  forceDownloadExternalImage: vi.fn()
}))

// Mock contexts
vi.mock('../contexts/PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useStorage: () => ({
    saveProject: vi.fn(),
    loadProject: vi.fn(),
    saveCourseSeedData: vi.fn(),
    loadCourseSeedData: vi.fn()
  })
}))

vi.mock('../contexts/NotificationContext', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNotifications: () => ({ addNotification: vi.fn() })
}))

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    <PersistentStorageProvider>
      <UnifiedMediaProvider>
        <UnsavedChangesProvider>
          <StepNavigationProvider>
            {children}
          </StepNavigationProvider>
        </UnsavedChangesProvider>
      </UnifiedMediaProvider>
    </PersistentStorageProvider>
  </NotificationProvider>
)

describe('YouTube Clip Timing Load Fix - Verify Backend Data is Extracted', () => {
  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    courseDescription: 'Test Description',
    learningObjectives: ['Objective 1'],
    targetAudience: 'Students'
  }

  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Welcome</p>',
      narration: '',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5,
      media: []
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<p>Objectives</p>',
      narration: '',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3,
      media: []
    },
    topics: [{
      id: 'topic-0',
      title: 'Test Topic',
      content: '<p>Topic content</p>',
      narration: '',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 10,
      media: []
    }],
    assessment: {
      questions: [],
      passMark: 80,
      narration: null
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock backend data with clip timing (simulates saved user data)
    const youtubeVideoWithClipTiming = {
      id: 'video-test',
      type: 'video',
      fileName: 'Test YouTube Video',
      metadata: {
        type: 'video',
        title: 'Test YouTube Video',
        embedUrl: 'https://www.youtube.com/embed/testId?rel=0&modestbranding=1&controls=1',
        youtubeUrl: 'https://www.youtube.com/watch?v=testId',
        isYouTube: true,
        clipStart: 90,  // 1:30 in seconds - this is the saved data
        clipEnd: 225    // 3:45 in seconds - this is the saved data
      }
    }

    mockGetValidMediaForPage.mockImplementation((pageId: string) => {
      if (pageId === 'topic-0') {
        return Promise.resolve([youtubeVideoWithClipTiming])
      }
      return Promise.resolve([])
    })

    // Fix localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true,
      configurable: true
    })
  })

  test('should load YouTube video with clip timing from backend metadata (VERIFIES FIX)', async () => {
    console.log('[TEST] 🔧 Testing that clip timing is now loaded from backend...')

    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onUpdateContent={vi.fn()}
        />
      </TestWrapper>
    )

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText('Media Enhancement')).toBeInTheDocument()
    })

    // Navigate to the topic with the YouTube video
    const topicTab = screen.getByText('Test Topic')
    fireEvent.click(topicTab)

    // Wait for media to load
    await waitFor(() => {
      expect(screen.getByText('Test YouTube Video')).toBeInTheDocument()
    }, { timeout: 5000 })

    console.log('[TEST] ✅ YouTube video loaded from backend')

    // Click video to open lightbox
    const youtubeVideo = screen.getByText('Test YouTube Video')
    fireEvent.click(youtubeVideo)

    // Wait for clip timing inputs
    await waitFor(() => {
      expect(screen.getByLabelText('Clip start time')).toBeInTheDocument()
      expect(screen.getByLabelText('Clip end time')).toBeInTheDocument()
    }, { timeout: 3000 })

    const startInput = screen.getByLabelText('Clip start time')
    const endInput = screen.getByLabelText('Clip end time')

    console.log('[TEST] 🔍 Checking if clip timing was loaded from backend...')
    console.log('[TEST] Start input value:', startInput.getAttribute('value'))
    console.log('[TEST] End input value:', endInput.getAttribute('value'))

    // 🔧 FIXED: After the fix, these values should be loaded from backend
    // The fix extracts clipStart and clipEnd from (item as any).metadata
    expect(startInput).toHaveValue('1:30') // Should now work with the fix
    expect(endInput).toHaveValue('3:45')   // Should now work with the fix

    console.log('[TEST] ✅ Clip timing values successfully loaded: 1:30 and 3:45')
    console.log('[TEST] 🎉 FIX VERIFIED: Backend clip timing data is now extracted properly!')
  })

  test('should handle videos without clip timing gracefully', async () => {
    // Test with video that has no clip timing
    const videoWithoutClipTiming = {
      id: 'video-no-timing',
      type: 'video',
      fileName: 'Video Without Timing',
      metadata: {
        type: 'video',
        title: 'Video Without Timing',
        embedUrl: 'https://www.youtube.com/embed/testId2',
        youtubeUrl: 'https://www.youtube.com/watch?v=testId2',
        isYouTube: true,
        // No clipStart or clipEnd - should default to undefined
      }
    }

    mockGetValidMediaForPage.mockResolvedValue([videoWithoutClipTiming])

    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onUpdateContent={vi.fn()}
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Media Enhancement')).toBeInTheDocument()
    })

    const topicTab = screen.getByText('Test Topic')
    fireEvent.click(topicTab)

    await waitFor(() => {
      expect(screen.getByText('Video Without Timing')).toBeInTheDocument()
    })

    const video = screen.getByText('Video Without Timing')
    fireEvent.click(video)

    await waitFor(() => {
      expect(screen.getByLabelText('Clip start time')).toBeInTheDocument()
    })

    const startInput = screen.getByLabelText('Clip start time')
    const endInput = screen.getByLabelText('Clip end time')

    // Should be empty when no clip timing is saved
    expect(startInput).toHaveValue('')
    expect(endInput).toHaveValue('')

    console.log('[TEST] ✅ Videos without clip timing show empty inputs correctly')
  })
})