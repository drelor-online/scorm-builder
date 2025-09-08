import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../test/testProviders'
import React from 'react'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import type { CourseContent } from '../types/aiPrompt'
import type { CourseSeedData } from '../types/course'

// Simple mock functions at module level
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

describe('Simple YouTube Clip Test', () => {
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
      media: [{
        id: 'youtube-video-1',
        type: 'video',
        title: 'Test YouTube Video',
        url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg',
        isYouTube: true,
        storageId: 'storage-123',
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

    // Set up basic mock responses
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

    mockGetValidMediaForPage.mockResolvedValue([])

    // Fix localStorage mock to return null instead of undefined
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

  test('should render MediaEnhancementWizard without crashing', async () => {
    const mockOnNext = vi.fn()
    const mockOnBack = vi.fn()
    const mockOnUpdateContent = vi.fn()

    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={mockOnBack}
        onUpdateContent={mockOnUpdateContent}
      />
    )

    // Just verify the component renders
    await waitFor(() => {
      expect(screen.getByText('Media Enhancement')).toBeInTheDocument()
    }, { timeout: 5000 })

    console.log('[TEST] ✅ Component rendered successfully!')
  })
})