/**
 * @file SCORMPackageBuilder.captionProcessing.behavior.test.tsx
 *
 * TDD Test for fixing SCORM generation hanging with captions.
 *
 * ISSUE: SCORM generation appears to hang at "Loading course content" step
 * when projects contain caption files.
 *
 * EXPECTED BEHAVIOR:
 * - SCORM generation should progress through all steps normally
 * - Loading messages should update properly when processing captions
 * - Caption files should be properly filtered and processed
 * - Generation should complete successfully
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../test/testProviders'
import { SCORMPackageBuilder } from './SCORMPackageBuilder'
import type { CourseContentUnion, CourseSeedData } from '../types/aiPrompt'

// Mock the rust SCORM generator
vi.mock('../services/rustScormGenerator', () => ({
  generateRustSCORM: vi.fn(),
}))

// Get the mock function
const { generateRustSCORM } = await import('../services/rustScormGenerator')
const mockGenerateRustSCORM = vi.mocked(generateRustSCORM)

// Mock the unified media context
const mockGetMediaForPage = vi.fn()
const mockGetMedia = vi.fn()
const mockUnifiedMediaContext = {
  getMediaForPage: mockGetMediaForPage,
  getMedia: mockGetMedia,
  getAllMedia: vi.fn(() => []),
  getMediaById: vi.fn(),
  isLoading: false,
  error: null,
  clearError: vi.fn(),
  refreshMedia: vi.fn(),
}

vi.mock('../contexts/UnifiedMediaContext', async () => {
  const actual = await vi.importActual('../contexts/UnifiedMediaContext')
  return {
    ...actual,
    useUnifiedMedia: () => mockUnifiedMediaContext,
  }
})

// Mock course content with captions
const createCourseContentWithCaptions = (): CourseContentUnion => ({
  title: 'Test Course with Captions',
  welcome: {
    pageId: 'welcome',
    content: 'Welcome to the test course',
    media: [
      {
        id: 'audio-welcome',
        type: 'audio',
        url: 'welcome-audio.mp3',
        title: 'Welcome Audio'
      },
      {
        id: 'caption-welcome',
        type: 'caption',
        url: 'welcome-captions.vtt',
        title: 'Welcome Captions'
      }
    ],
    audioId: 'audio-welcome',
    captionId: 'caption-welcome'
  },
  objectives: ['Learn about captions', 'Understand SCORM generation'],
  objectivesPage: {
    pageId: 'objectives',
    content: 'Course objectives',
    media: [
      {
        id: 'audio-objectives',
        type: 'audio',
        url: 'objectives-audio.mp3',
        title: 'Objectives Audio'
      },
      {
        id: 'caption-objectives',
        type: 'caption',
        url: 'objectives-captions.vtt',
        title: 'Objectives Captions'
      }
    ],
    audioId: 'audio-objectives',
    captionId: 'caption-objectives'
  },
  topics: Array.from({ length: 5 }, (_, i) => ({
    id: `topic-${i + 1}`,
    title: `Topic ${i + 1}`,
    content: `Content for topic ${i + 1} with captions`,
    media: [
      {
        id: `audio-topic-${i + 1}`,
        type: 'audio',
        url: `topic-${i + 1}-audio.mp3`,
        title: `Topic ${i + 1} Audio`
      },
      {
        id: `caption-topic-${i + 1}`,
        type: 'caption',
        url: `topic-${i + 1}-captions.vtt`,
        title: `Topic ${i + 1} Captions`
      }
    ],
    audioId: `audio-topic-${i + 1}`,
    captionId: `caption-topic-${i + 1}`
  }))
})

const createMockCourseSeedData = (): CourseSeedData => ({
  title: 'Test Course with Captions',
  learnerDescription: 'Test learner description',
  learnerGoals: 'Test learner goals',
  topics: ['Topic 1', 'Topic 2', 'Topic 3', 'Topic 4', 'Topic 5'],
  courseTone: 'professional' as const,
  courseStructure: 'modular' as const,
  contentTypes: ['text', 'interactive'] as const,
  estimatedDuration: 60
})

describe('SCORMPackageBuilder Caption Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock successful media retrieval
    mockGetMediaForPage.mockResolvedValue([])
    mockGetMedia.mockImplementation(async (mediaId: string) => {
      if (mediaId.includes('audio')) {
        return {
          data: new Uint8Array(1024), // Mock audio data
          metadata: { filename: `${mediaId}.mp3`, type: 'audio' },
          url: `asset://${mediaId}.mp3`
        }
      } else if (mediaId.includes('caption')) {
        return {
          data: new TextEncoder().encode('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nTest caption content'),
          metadata: { filename: `${mediaId}.vtt`, type: 'caption' },
          url: `asset://${mediaId}.vtt`
        }
      }
      return null
    })

    // Mock successful SCORM generation
    mockGenerateRustSCORM.mockImplementation(async (courseContent, courseSeedData, mediaFiles, projectId) => {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100))
      return {
        success: true,
        downloadUrl: 'mock-download-url',
        fileName: 'test-course.zip'
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should generate SCORM package successfully with caption content', async () => {
    // ARRANGE: Create course content with captions
    const courseContent = createCourseContentWithCaptions()
    const courseSeedData = createMockCourseSeedData()

    const onGenerationComplete = vi.fn()
    const onBack = vi.fn()

    // ACT: Render the component
    render(
      <SCORMPackageBuilder
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onGenerationComplete={onGenerationComplete}
        onBack={onBack}
      />
    )

    // Click generate button
    const generateButton = screen.getByText('Generate SCORM Package')
    fireEvent.click(generateButton)

    // ASSERT: Should show proper loading progression
    await waitFor(() => {
      expect(screen.getByText('Generating SCORM Package')).toBeInTheDocument()
    })

    // Should progress through loading states
    await waitFor(() => {
      expect(screen.getByText('Preparing course content...')).toBeInTheDocument()
    }, { timeout: 1000 })

    // Should show media loading phase
    await waitFor(() => {
      expect(screen.getByText('Loading media files...')).toBeInTheDocument()
    }, { timeout: 2000 })

    // Should show SCORM generation phase
    await waitFor(() => {
      expect(screen.getByText('Generating SCORM package...')).toBeInTheDocument()
    }, { timeout: 3000 })

    // SCORM generation should complete
    await waitFor(() => {
      expect(mockGenerateRustSCORM).toHaveBeenCalled()
    }, { timeout: 5000 })

    // Verify captions are properly passed to generator but filtered
    const generatorCall = mockGenerateRustSCORM.mock.calls[0]
    const [passedCourseContent, passedCourseSeedData, mediaFiles, projectId] = generatorCall

    // Should have called with course content that includes captions
    expect(passedCourseContent.welcome.captionId).toBe('caption-welcome')
    expect(passedCourseContent.objectivesPage.captionId).toBe('caption-objectives')

    // Verify no hanging at any loading phase
    expect(onGenerationComplete).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      downloadUrl: 'mock-download-url'
    }))
  }, 10000)

  it('should handle caption processing without infinite loops', async () => {
    // ARRANGE: Course with many captions (simulate the 22+22 scenario)
    const courseContent = createCourseContentWithCaptions()
    // Add more topics to simulate a larger course
    const extraTopics = Array.from({ length: 17 }, (_, i) => ({
      id: `topic-${i + 6}`,
      title: `Topic ${i + 6}`,
      content: `Content for topic ${i + 6}`,
      media: [
        {
          id: `audio-topic-${i + 6}`,
          type: 'caption',
          url: `topic-${i + 6}-captions.vtt`,
          title: `Topic ${i + 6} Captions`
        }
      ],
      captionId: `caption-topic-${i + 6}`
    }))

    const extendedCourseContent = {
      ...courseContent,
      topics: [...courseContent.topics, ...extraTopics]
    }

    const courseSeedData = createMockCourseSeedData()
    const onGenerationComplete = vi.fn()
    const onBack = vi.fn()

    // Track how many times each loading phase appears
    const loadingPhaseTracker = {
      preparing: 0,
      loadingMedia: 0,
      generating: 0
    }

    // ACT: Render and generate
    render(
      <SCORMPackageBuilder
        courseContent={extendedCourseContent}
        courseSeedData={courseSeedData}
        onGenerationComplete={onGenerationComplete}
        onBack={onBack}
      />
    )

    const generateButton = screen.getByText('Generate SCORM Package')
    fireEvent.click(generateButton)

    // Monitor loading phases to ensure no infinite loops
    const checkLoadingPhases = async () => {
      if (screen.queryByText('Preparing course content...')) {
        loadingPhaseTracker.preparing++
      }
      if (screen.queryByText('Loading media files...')) {
        loadingPhaseTracker.loadingMedia++
      }
      if (screen.queryByText('Generating SCORM package...')) {
        loadingPhaseTracker.generating++
      }
    }

    // Check phases every 100ms for 5 seconds
    const interval = setInterval(checkLoadingPhases, 100)

    // Wait for completion
    await waitFor(() => {
      expect(mockGenerateRustSCORM).toHaveBeenCalled()
    }, { timeout: 8000 })

    clearInterval(interval)

    // ASSERT: Each phase should appear only once or a reasonable number of times
    expect(loadingPhaseTracker.preparing).toBeLessThan(10) // Should not loop indefinitely
    expect(loadingPhaseTracker.loadingMedia).toBeLessThan(10)
    expect(loadingPhaseTracker.generating).toBeLessThan(10)

    // Generation should complete successfully
    expect(onGenerationComplete).toHaveBeenCalled()
  }, 15000)

  it('should show proper progress when processing many caption files', async () => {
    // ARRANGE: Course with 22 caption files
    const courseContent = createCourseContentWithCaptions()
    const courseSeedData = createMockCourseSeedData()

    // Mock media that returns many caption files
    mockGetMediaForPage.mockImplementation((pageId: string) => {
      if (pageId === 'welcome') {
        return [
          { id: 'caption-welcome', type: 'caption', pageId, url: 'welcome.vtt' }
        ]
      } else if (pageId === 'objectives') {
        return [
          { id: 'caption-objectives', type: 'caption', pageId, url: 'objectives.vtt' }
        ]
      } else if (pageId.startsWith('topic-')) {
        return Array.from({ length: 4 }, (_, i) => ({
          id: `caption-${pageId}-${i}`,
          type: 'caption',
          pageId,
          url: `${pageId}-${i}.vtt`
        }))
      }
      return []
    })

    const onGenerationComplete = vi.fn()
    const onBack = vi.fn()

    // ACT: Generate SCORM
    render(
      <SCORMPackageBuilder
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onGenerationComplete={onGenerationComplete}
        onBack={onBack}
      />
    )

    fireEvent.click(screen.getByText('Generate SCORM Package'))

    // ASSERT: Should show progress for loading media files
    await waitFor(() => {
      expect(screen.getByText('Loading media files...')).toBeInTheDocument()
    })

    // Should show file count progress
    await waitFor(() => {
      const progressElements = screen.queryAllByText(/\d+\/\d+/)
      expect(progressElements.length).toBeGreaterThan(0)
    }, { timeout: 3000 })

    // Should complete without hanging
    await waitFor(() => {
      expect(mockGenerateRustSCORM).toHaveBeenCalled()
    }, { timeout: 8000 })

    expect(onGenerationComplete).toHaveBeenCalled()
  }, 12000)

  it('should handle caption files during SCORM generation without blocking', async () => {
    // ARRANGE: Mock a scenario where caption processing takes time
    const courseContent = createCourseContentWithCaptions()
    const courseSeedData = createMockCourseSeedData()

    // Mock slow caption retrieval
    mockGetMedia.mockImplementation(async (mediaId: string) => {
      if (mediaId.includes('caption')) {
        // Simulate slower caption processing
        await new Promise(resolve => setTimeout(resolve, 200))
        return {
          data: new TextEncoder().encode('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nTest caption'),
          metadata: { filename: `${mediaId}.vtt`, type: 'caption' },
          url: `asset://${mediaId}.vtt`
        }
      } else if (mediaId.includes('audio')) {
        return {
          data: new Uint8Array(1024),
          metadata: { filename: `${mediaId}.mp3`, type: 'audio' },
          url: `asset://${mediaId}.mp3`
        }
      }
      return null
    })

    const onGenerationComplete = vi.fn()
    const onBack = vi.fn()

    // ACT: Start generation
    render(
      <SCORMPackageBuilder
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onGenerationComplete={onGenerationComplete}
        onBack={onBack}
      />
    )

    const startTime = Date.now()
    fireEvent.click(screen.getByText('Generate SCORM Package'))

    // ASSERT: Should not hang indefinitely
    await waitFor(() => {
      expect(mockGenerateRustSCORM).toHaveBeenCalled()
    }, { timeout: 10000 })

    const endTime = Date.now()
    const duration = endTime - startTime

    // Should complete in reasonable time (not hang for 30+ seconds)
    expect(duration).toBeLessThan(8000) // Less than 8 seconds

    expect(onGenerationComplete).toHaveBeenCalled()
  }, 15000)
})