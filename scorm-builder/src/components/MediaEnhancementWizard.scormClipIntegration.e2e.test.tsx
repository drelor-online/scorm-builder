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

// Mock functions at module level to capture what gets passed around
const mockGetValidMediaForPage = vi.fn()
const mockUpdateYouTubeVideoMetadata = vi.fn()
const mockOnNext = vi.fn()
const mockOnUpdateContent = vi.fn()

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

describe('MediaEnhancementWizard to SCORM Integration - E2E Test', () => {
  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: [],
    template: 'None',
    templateTopics: []
  }

  // Simulate the REAL issue: CourseContent that starts WITHOUT clip timing
  const initialCourseContent: CourseContent = {
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
      title: 'Test Topic with YouTube Video',
      content: '<p>Topic content</p>',
      narration: '',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 10,
      media: [{
        id: 'video-e2e-test',
        type: 'video',
        title: 'YouTube Video for E2E Test',
        url: 'https://www.youtube.com/watch?v=testVideoE2E',
        embedUrl: 'https://www.youtube.com/embed/testVideoE2E?rel=0&modestbranding=1&controls=1',
        isYouTube: true,
        storageId: 'video-e2e-test',
        // CRITICAL: Initially NO clip timing - this simulates the real scenario
        clipStart: undefined,
        clipEnd: undefined
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

    // Backend returns video that has clip timing saved (simulates after user sets it)
    const youtubeVideoWithSavedClipTiming = {
      id: 'video-e2e-test',
      type: 'video',
      fileName: 'YouTube Video for E2E Test',
      metadata: {
        type: 'video',
        title: 'YouTube Video for E2E Test',
        embedUrl: 'https://www.youtube.com/embed/testVideoE2E?start=45&end=180',
        youtubeUrl: 'https://www.youtube.com/watch?v=testVideoE2E',
        isYouTube: true,
        clipStart: 45,   // 45 seconds
        clipEnd: 180     // 3 minutes - this is what should be passed to SCORM
      }
    }

    mockGetValidMediaForPage.mockImplementation((pageId: string) => {
      if (pageId === 'topic-0') {
        return Promise.resolve([youtubeVideoWithSavedClipTiming])
      }
      return Promise.resolve([])
    })

    mockUpdateYouTubeVideoMetadata.mockResolvedValue({
      id: 'video-e2e-test',
      metadata: {
        ...youtubeVideoWithSavedClipTiming.metadata,
        clipStart: 45,
        clipEnd: 180
      }
    })

    // Reset the captured function calls
    mockOnNext.mockClear()
    mockOnUpdateContent.mockClear()

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

  test('should pass CourseContent with clip timing to onNext when user proceeds to SCORM generation', async () => {
    console.log('[E2E TEST] 🎯 Testing end-to-end clip timing data flow to SCORM...')
    
    console.log('[E2E TEST] 📝 Initial CourseContent (before user sets clip timing):', {
      videoClipStart: initialCourseContent.topics[0].media![0].clipStart,
      videoClipEnd: initialCourseContent.topics[0].media![0].clipEnd,
      videoTitle: initialCourseContent.topics[0].media![0].title
    })

    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={initialCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={vi.fn()}
          onUpdateContent={mockOnUpdateContent}
        />
      </TestWrapper>
    )

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText('Media Enhancement')).toBeInTheDocument()
    })

    // Navigate to the topic with the YouTube video
    const topicTab = screen.getByText('Test Topic with YouTube Video')
    fireEvent.click(topicTab)

    // Wait for media to load (this will trigger loadExistingMedia)
    await waitFor(() => {
      expect(screen.getByText('YouTube Video for E2E Test')).toBeInTheDocument()
    }, { timeout: 5000 })

    console.log('[E2E TEST] ✅ MediaEnhancementWizard loaded YouTube video')

    // The loadExistingMedia function should have been called and should populate the media with clip timing
    // Check if onUpdateContent was called with the clip timing data
    console.log('[E2E TEST] 🔍 Checking if onUpdateContent was called with clip timing...')
    console.log('[E2E TEST] onUpdateContent call count:', mockOnUpdateContent.mock.calls.length)

    // If onUpdateContent was called, check the latest call
    if (mockOnUpdateContent.mock.calls.length > 0) {
      const latestCall = mockOnUpdateContent.mock.calls[mockOnUpdateContent.mock.calls.length - 1]
      const updatedContent = latestCall[0] as CourseContent
      const videoMedia = updatedContent.topics[0].media![0]
      
      console.log('[E2E TEST] 📊 Latest onUpdateContent call - video media:', {
        clipStart: videoMedia.clipStart,
        clipEnd: videoMedia.clipEnd,
        title: videoMedia.title
      })

      // This is the critical test: Does the updated content have clip timing?
      expect(videoMedia.clipStart).toBe(45)   // Should have clip timing from backend
      expect(videoMedia.clipEnd).toBe(180)    // Should have clip timing from backend
      
      console.log('[E2E TEST] ✅ onUpdateContent called with correct clip timing!')
    }

    // Now simulate user clicking "Next" to proceed to SCORM generation
    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)

    // Wait for onNext to be called
    await waitFor(() => {
      expect(mockOnNext).toHaveBeenCalled()
    })

    console.log('[E2E TEST] 🔍 Checking CourseContent passed to onNext...')
    
    // Get the CourseContent that was passed to onNext (this goes to SCORM generation)
    expect(mockOnNext).toHaveBeenCalledTimes(1)
    const courseContentPassedToScorm = mockOnNext.mock.calls[0][0] as CourseContent
    const videoInScormContent = courseContentPassedToScorm.topics[0].media![0]
    
    console.log('[E2E TEST] 📊 CourseContent passed to SCORM generation:', {
      videoClipStart: videoInScormContent.clipStart,
      videoClipEnd: videoInScormContent.clipEnd,
      videoTitle: videoInScormContent.title,
      videoEmbedUrl: videoInScormContent.embedUrl
    })

    // 🎯 THE CRITICAL TEST: Does the CourseContent passed to SCORM have clip timing?
    console.log('[E2E TEST] 🚨 CRITICAL CHECK: Does SCORM get clip timing data?')
    
    if (videoInScormContent.clipStart === undefined || videoInScormContent.clipEnd === undefined) {
      console.log('[E2E TEST] ❌ ISSUE FOUND: CourseContent passed to SCORM missing clip timing!')
      console.log('[E2E TEST] This explains why SCORM packages have full videos instead of clips')
      
      // This test should FAIL if there's a data flow issue
      expect(videoInScormContent.clipStart).toBe(45)   // Should have clip timing
      expect(videoInScormContent.clipEnd).toBe(180)    // Should have clip timing
    } else {
      console.log('[E2E TEST] ✅ CourseContent passed to SCORM has correct clip timing!')
      expect(videoInScormContent.clipStart).toBe(45)
      expect(videoInScormContent.clipEnd).toBe(180)
    }

    console.log('[E2E TEST] 🎉 E2E test completed - clip timing data flow verified!')
  })

  test('should demonstrate the issue by showing CourseContent state vs backend state', async () => {
    console.log('[E2E TEST] 🔬 Demonstrating potential state synchronization issue...')

    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={initialCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={vi.fn()}
          onUpdateContent={mockOnUpdateContent}
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Media Enhancement')).toBeInTheDocument()
    })

    const topicTab = screen.getByText('Test Topic with YouTube Video')
    fireEvent.click(topicTab)

    await waitFor(() => {
      expect(screen.getByText('YouTube Video for E2E Test')).toBeInTheDocument()
    })

    // Check what the backend has vs what the component state might have
    const backendData = await mockGetValidMediaForPage('topic-0')
    console.log('[E2E TEST] 🏪 Backend data for video:', {
      clipStart: backendData[0].metadata.clipStart,
      clipEnd: backendData[0].metadata.clipEnd
    })

    console.log('[E2E TEST] 🏠 Initial CourseContent state:', {
      clipStart: initialCourseContent.topics[0].media![0].clipStart,
      clipEnd: initialCourseContent.topics[0].media![0].clipEnd
    })

    // If loadExistingMedia is working correctly, onUpdateContent should have been called
    // to sync the backend data with the component state
    if (mockOnUpdateContent.mock.calls.length === 0) {
      console.log('[E2E TEST] ⚠️ WARNING: onUpdateContent was never called - possible sync issue')
    }

    // The issue might be that the user navigates away from MediaEnhancementWizard
    // before the loadExistingMedia effect completes, so the parent component never
    // gets the updated CourseContent with clip timing
  })
})