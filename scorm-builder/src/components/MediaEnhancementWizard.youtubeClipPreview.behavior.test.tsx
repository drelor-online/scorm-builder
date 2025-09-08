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

describe('YouTube Clip Preview - Behavior Test', () => {
  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: [],
    template: 'None',
    templateTopics: []
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
      media: [{
        id: 'video-clip-test',
        type: 'video',
        title: 'YouTube Video with Clip Timing',
        url: 'https://www.youtube.com/watch?v=testVideoId',
        embedUrl: 'https://www.youtube.com/embed/testVideoId?rel=0&modestbranding=1&controls=1',
        isYouTube: true,
        storageId: 'video-clip-test',
        // Clip timing: 1:30 to 3:45 (90 to 225 seconds)
        clipStart: 90,
        clipEnd: 225
      }]
    }],
    assessment: {
      questions: [],
      passMark: 80,
      narration: null
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Backend returns video with clip timing
    const youtubeVideoWithClipTiming = {
      id: 'video-clip-test',
      type: 'video',
      fileName: 'YouTube Video with Clip Timing',
      metadata: {
        type: 'video',
        title: 'YouTube Video with Clip Timing',
        embedUrl: 'https://www.youtube.com/embed/testVideoId?rel=0&modestbranding=1&controls=1',
        youtubeUrl: 'https://www.youtube.com/watch?v=testVideoId',
        isYouTube: true,
        clipStart: 90,  // 1:30 in seconds
        clipEnd: 225    // 3:45 in seconds
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

  test('should show clipped YouTube video in preview when clipStart and clipEnd are set', async () => {
    console.log('[TEST] 🎬 Testing YouTube clip preview functionality...')

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
      expect(screen.getByText('YouTube Video with Clip Timing')).toBeInTheDocument()
    }, { timeout: 5000 })

    console.log('[TEST] ✅ YouTube video loaded from backend')

    // Click video to open preview (not lightbox)
    const youtubeVideo = screen.getByText('YouTube Video with Clip Timing')
    fireEvent.click(youtubeVideo)

    // Wait for preview dialog to open
    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument()
    }, { timeout: 3000 })

    console.log('[TEST] ✅ Preview dialog opened')

    // Find the preview iframe
    const previewIframe = screen.getByTitle('YouTube Video with Clip Timing')
    expect(previewIframe).toBeInTheDocument()
    expect(previewIframe.tagName.toLowerCase()).toBe('iframe')

    console.log('[TEST] 🔍 Checking preview iframe src URL...')
    
    const iframeSrc = previewIframe.getAttribute('src')
    console.log('[TEST] Preview iframe src:', iframeSrc)

    // 🔴 FAILING TEST: This should include clip timing parameters but currently doesn't
    // The test will initially FAIL because getPreviewContent() uses embedUrl directly
    // After implementing the fix, this should pass
    expect(iframeSrc).toContain('start=90')  // 1:30 in seconds
    expect(iframeSrc).toContain('end=225')   // 3:45 in seconds
    
    console.log('[TEST] ✅ Preview shows clipped YouTube video with start=90&end=225 parameters')
    console.log('[TEST] 🎉 Clip preview functionality working correctly!')
  })

  test('should show full YouTube video in preview when no clip timing is set', async () => {
    console.log('[TEST] 🎬 Testing YouTube preview without clip timing...')

    // Course content with YouTube video but no clip timing
    const courseContentNoClip: CourseContent = {
      ...mockCourseContent,
      topics: [{
        ...mockCourseContent.topics[0],
        media: [{
          id: 'video-no-clip',
          type: 'video',
          title: 'YouTube Video without Clip Timing',
          url: 'https://www.youtube.com/watch?v=testVideoId2',
          embedUrl: 'https://www.youtube.com/embed/testVideoId2?rel=0&modestbranding=1&controls=1',
          isYouTube: true,
          storageId: 'video-no-clip',
          // No clipStart or clipEnd
        }]
      }]
    }

    const youtubeVideoNoClip = {
      id: 'video-no-clip',
      type: 'video',
      fileName: 'YouTube Video without Clip Timing',
      metadata: {
        type: 'video',
        title: 'YouTube Video without Clip Timing',
        embedUrl: 'https://www.youtube.com/embed/testVideoId2?rel=0&modestbranding=1&controls=1',
        youtubeUrl: 'https://www.youtube.com/watch?v=testVideoId2',
        isYouTube: true,
        // No clipStart or clipEnd
      }
    }

    mockGetValidMediaForPage.mockResolvedValue([youtubeVideoNoClip])

    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={courseContentNoClip}
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
      expect(screen.getByText('YouTube Video without Clip Timing')).toBeInTheDocument()
    })

    const youtubeVideo = screen.getByText('YouTube Video without Clip Timing')
    fireEvent.click(youtubeVideo)

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument()
    })

    const previewIframe = screen.getByTitle('YouTube Video without Clip Timing')
    const iframeSrc = previewIframe.getAttribute('src')
    
    console.log('[TEST] Preview iframe src (no clip):', iframeSrc)

    // Should NOT contain clip timing parameters
    expect(iframeSrc).not.toContain('start=')
    expect(iframeSrc).not.toContain('end=')
    
    console.log('[TEST] ✅ Preview shows full YouTube video without clip parameters (expected behavior)')
  })

  test('should handle regular video files without YouTube-specific logic', async () => {
    console.log('[TEST] 🎬 Testing regular video preview (not YouTube)...')

    const courseContentRegularVideo: CourseContent = {
      ...mockCourseContent,
      topics: [{
        ...mockCourseContent.topics[0],
        media: [{
          id: 'video-regular',
          type: 'video',
          title: 'Regular MP4 Video',
          url: 'asset://localhost/12345/media/video-regular.mp4',
          isYouTube: false,
          storageId: 'video-regular',
        }]
      }]
    }

    const regularVideo = {
      id: 'video-regular',
      type: 'video',
      fileName: 'Regular MP4 Video',
      metadata: {
        type: 'video',
        title: 'Regular MP4 Video',
        isYouTube: false,
      }
    }

    mockGetValidMediaForPage.mockResolvedValue([regularVideo])

    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={courseContentRegularVideo}
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
      expect(screen.getByText('Regular MP4 Video')).toBeInTheDocument()
    })

    const regularVideoElement = screen.getByText('Regular MP4 Video')
    fireEvent.click(regularVideoElement)

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument()
    })

    // Regular video should use <video> element, not iframe
    const previewVideo = screen.getByTitle('Regular MP4 Video')
    expect(previewVideo.tagName.toLowerCase()).toBe('video')
    expect(previewVideo).toHaveAttribute('controls')
    
    console.log('[TEST] ✅ Regular video preview uses <video> element (unchanged behavior)')
  })
})