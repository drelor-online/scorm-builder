import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import type { CourseContent } from '../types/aiPrompt'

// Mock the search service
vi.mock('../services/searchService', () => ({
  searchGoogleImages: vi.fn().mockResolvedValue([]),
  searchYouTubeVideos: vi.fn().mockResolvedValue([]),
  SearchError: class SearchError extends Error {}
}))

// Mock the external image downloader  
vi.mock('../services/externalImageDownloader', () => ({
  isKnownCorsRestrictedDomain: vi.fn().mockReturnValue(false),
  downloadExternalImage: vi.fn().mockResolvedValue('blob:mock-url')
}))

// Mock PersistentStorageContext to avoid storage dependencies
vi.mock('../contexts/PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useStorage: () => ({
    saveProject: vi.fn(),
    loadProject: vi.fn(),
    saveCourseSeedData: vi.fn(),
    loadCourseSeedData: vi.fn(),
    getContent: vi.fn().mockResolvedValue(null),
    saveContent: vi.fn(),
    deleteContent: vi.fn(),
    listContent: vi.fn().mockResolvedValue([])
  })
}))

// Mock NotificationContext to avoid notification dependencies
vi.mock('../contexts/NotificationContext', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNotifications: () => ({
    addNotification: vi.fn()
  })
}))

// Mock UnsavedChangesContext to avoid provider dependencies
vi.mock('../contexts/UnsavedChangesContext', () => ({
  UnsavedChangesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useUnsavedChanges: () => ({
    markDirty: vi.fn(),
    isClean: vi.fn().mockReturnValue(true),
    clearDirty: vi.fn()
  })
}))

// Mock StepNavigationContext to avoid provider dependencies
vi.mock('../contexts/StepNavigationContext', () => ({
  StepNavigationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useStepNavigation: () => ({
    currentStep: 'media',
    navigateToStep: vi.fn(),
    canNavigateToStep: vi.fn().mockReturnValue(true),
    steps: [
      { key: 'seed', label: 'Course Seed', number: 1 },
      { key: 'media', label: 'Media Enhancement', number: 2 },
      { key: 'audio', label: 'Audio Narration', number: 3 },
      { key: 'scorm', label: 'SCORM Package', number: 4 }
    ]
  })
}))

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <UnifiedMediaProvider>
    <PersistentStorageProvider>
      {children}
    </PersistentStorageProvider>
  </UnifiedMediaProvider>
)

describe('MediaEnhancementWizard - YouTube Clip SCORM Integration', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome to the course',
      narration: 'Welcome narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5,
      media: [
        {
          id: 'youtube-test-video',
          type: 'video' as const,
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Test YouTube Video for Clip Timing',
          description: 'This video will test clip timing in SCORM packages',
          thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
          isYouTube: true,
          embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
        }
      ]
    },
    learningObjectivesPage: {
      id: 'objectives', 
      title: 'Learning Objectives',
      content: 'Course objectives',
      narration: 'Objectives narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5,
      media: []
    },
    topics: [
      {
        id: 'topic1',
        title: 'Topic 1 with YouTube Video',
        content: 'This topic has a YouTube video for clip testing',
        narration: 'Topic 1 narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 10,
        media: []
      }
    ],
    assessment: {
      questions: [],
      passMark: 80,
      narration: null
    }
  }

  let onUpdateContentSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    onUpdateContentSpy = vi.fn()
    
    // Mock localStorage to avoid JSON parsing errors
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => {
        if (key === 'scorm_builder_force_download_mode') return 'false'
        return null
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    }
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    })
  })

  it('should reproduce the SCORM integration issue where YouTube clip timing data is not propagated to course content', async () => {
    // STEP 1: Render MediaEnhancementWizard with YouTube video
    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          currentPageIndex={0} // Welcome page with YouTube video
          onNext={vi.fn()}
          onBack={vi.fn()}
          onUpdateContent={onUpdateContentSpy}
        />
      </TestWrapper>
    )

    // Wait for the component to load and display the YouTube video
    await waitFor(() => {
      expect(screen.getByText('Test YouTube Video for Clip Timing')).toBeInTheDocument()
    })

    // STEP 2: Find and set clip timing inputs
    const startInput = screen.getByPlaceholderText('0:30 or 30') as HTMLInputElement
    const endInput = screen.getByPlaceholderText('2:00 or 120') as HTMLInputElement

    // Verify inputs exist and are initially empty
    expect(startInput).toBeInTheDocument()
    expect(endInput).toBeInTheDocument()

    // STEP 3: Set start time to 30 seconds
    await act(async () => {
      fireEvent.focus(startInput)
      fireEvent.change(startInput, { target: { value: '30' } })
      fireEvent.blur(startInput)
    })

    // Wait for start time to be formatted and persist
    await waitFor(() => {
      expect(startInput.value).toBe('0:30')
    }, { timeout: 2000 })

    // STEP 4: Set end time to 120 seconds
    await act(async () => {
      fireEvent.focus(endInput)
      fireEvent.change(endInput, { target: { value: '120' } })
      fireEvent.blur(endInput)
    })

    // Wait for end time to be formatted and persist
    await waitFor(() => {
      expect(endInput.value).toBe('2:00')
    }, { timeout: 2000 })

    // STEP 5: Verify that onUpdateContent was called with timing data
    // This is the critical test - the onUpdateContent callback should receive
    // course content where the YouTube media has clipStart=30 and clipEnd=120
    await waitFor(() => {
      expect(onUpdateContentSpy).toHaveBeenCalled()
    }, { timeout: 3000 })

    // Get the last call to onUpdateContent to inspect the data
    const lastCall = onUpdateContentSpy.mock.calls[onUpdateContentSpy.mock.calls.length - 1]
    expect(lastCall).toBeDefined()
    
    const updatedCourseContent = lastCall[0] as CourseContent
    expect(updatedCourseContent).toBeDefined()
    expect(updatedCourseContent.welcomePage).toBeDefined()
    expect(updatedCourseContent.welcomePage.media).toHaveLength(1)

    // THE CRITICAL ASSERTION: The media object should contain clip timing data
    const youtubeMedia = updatedCourseContent.welcomePage.media?.[0]
    expect(youtubeMedia).toBeDefined()
    expect(youtubeMedia?.id).toBe('youtube-test-video')
    
    // THIS IS THE FAILING ASSERTION: clipStart and clipEnd should be present
    // If this test fails, it means the timing data is not flowing to course content
    expect(youtubeMedia?.clipStart).toBe(30) // Start time in seconds
    expect(youtubeMedia?.clipEnd).toBe(120)   // End time in seconds
    
    // Additional verification: isYouTube flag should be preserved
    expect(youtubeMedia?.isYouTube).toBe(true)
    expect(youtubeMedia?.url).toContain('youtube.com')

    console.log('✅ SUCCESS: YouTube timing data correctly propagated to course content:', {
      clipStart: youtubeMedia?.clipStart,
      clipEnd: youtubeMedia?.clipEnd,
      isYouTube: youtubeMedia?.isYouTube
    })
  }, 15000) // Extended timeout for complex interactions

  it('should verify that course content updates preserve YouTube video properties for SCORM generation', async () => {
    // This test specifically checks the data structure that would be passed to SCORM generation
    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          currentPageIndex={0}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onUpdateContent={onUpdateContentSpy}
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Test YouTube Video for Clip Timing')).toBeInTheDocument()
    })

    const startInput = screen.getByPlaceholderText('0:30 or 30') as HTMLInputElement
    const endInput = screen.getByPlaceholderText('2:00 or 120') as HTMLInputElement

    // Set both timing values
    await act(async () => {
      fireEvent.focus(startInput)
      fireEvent.change(startInput, { target: { value: '45' } })
      fireEvent.blur(startInput)
      
      fireEvent.focus(endInput)
      fireEvent.change(endInput, { target: { value: '180' } })
      fireEvent.blur(endInput)
    })

    await waitFor(() => {
      expect(startInput.value).toBe('0:45')
      expect(endInput.value).toBe('3:00')
    })

    // Verify the final course content structure matches what SCORM generator expects
    await waitFor(() => {
      expect(onUpdateContentSpy).toHaveBeenCalled()
    })

    const finalCourseContent = onUpdateContentSpy.mock.calls[onUpdateContentSpy.mock.calls.length - 1][0] as CourseContent
    const media = finalCourseContent.welcomePage.media?.[0]

    // These properties are essential for rustScormGenerator.ts
    expect(media?.type).toBe('video')
    expect(media?.isYouTube).toBe(true)
    expect(media?.url).toContain('youtube.com')
    expect(media?.clipStart).toBe(45)   // 45 seconds
    expect(media?.clipEnd).toBe(180)    // 3 minutes = 180 seconds
    expect(media?.embedUrl).toBeTruthy() // Should have embed URL for fallback

    console.log('✅ Course content structure ready for SCORM generation:', {
      mediaType: media?.type,
      isYouTube: media?.isYouTube,
      hasUrl: !!media?.url,
      clipStart: media?.clipStart,
      clipEnd: media?.clipEnd,
      hasEmbedUrl: !!media?.embedUrl
    })
  })

  it('should handle edge cases in YouTube clip timing that could break SCORM generation', async () => {
    // Test edge cases that might cause SCORM generation issues
    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          currentPageIndex={0}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onUpdateContent={onUpdateContentSpy}
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Test YouTube Video for Clip Timing')).toBeInTheDocument()
    })

    const startInput = screen.getByPlaceholderText('0:30 or 30') as HTMLInputElement
    const endInput = screen.getByPlaceholderText('2:00 or 120') as HTMLInputElement

    // EDGE CASE 1: Start time only (no end time)
    await act(async () => {
      fireEvent.focus(startInput)
      fireEvent.change(startInput, { target: { value: '90' } })
      fireEvent.blur(startInput)
    })

    await waitFor(() => {
      expect(startInput.value).toBe('1:30')
    })

    await waitFor(() => {
      expect(onUpdateContentSpy).toHaveBeenCalled()
    })

    let lastContent = onUpdateContentSpy.mock.calls[onUpdateContentSpy.mock.calls.length - 1][0] as CourseContent
    let media = lastContent.welcomePage.media?.[0]
    
    expect(media?.clipStart).toBe(90)
    expect(media?.clipEnd).toBeUndefined() // End time should remain undefined

    // EDGE CASE 2: End time smaller than start time (invalid range)
    await act(async () => {
      fireEvent.focus(endInput)
      fireEvent.change(endInput, { target: { value: '60' } }) // 60 < 90, invalid
      fireEvent.blur(endInput)
    })

    await waitFor(() => {
      expect(endInput.value).toBe('1:00')
    })

    await waitFor(() => {
      expect(onUpdateContentSpy).toHaveBeenCalled()
    })

    lastContent = onUpdateContentSpy.mock.calls[onUpdateContentSpy.mock.calls.length - 1][0] as CourseContent
    media = lastContent.welcomePage.media?.[0]
    
    // Even with invalid range, both values should be preserved for SCORM generation
    expect(media?.clipStart).toBe(90)
    expect(media?.clipEnd).toBe(60)

    console.log('✅ Edge cases handled correctly for SCORM:', {
      startOnly: media?.clipStart,
      invalidRange: `${media?.clipStart} > ${media?.clipEnd}`,
      bothPreserved: media?.clipStart !== undefined && media?.clipEnd !== undefined
    })
  })
})