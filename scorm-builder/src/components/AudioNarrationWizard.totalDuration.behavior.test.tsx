/**
 * Test real audio duration calculation in AudioNarrationWizard
 *
 * This test verifies that the wizard calculates the true total duration
 * from actual audio files using the MediaService batch API, not fake
 * duration calculations based on file count.
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AudioNarrationWizard } from './AudioNarrationWizard'
import type { CourseContentUnion } from '../types/aiPrompt'

// Mock the storage context
const mockStorage = {
  currentProjectId: 'test-project-123',
  getContent: vi.fn(),
  saveContent: vi.fn()
}

vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: () => mockStorage
}))

// Mock the media context
const mockMedia = {
  actions: {
    storeMedia: vi.fn(),
    createBlobUrl: vi.fn(),
    deleteMedia: vi.fn()
  },
  selectors: {
    getMedia: vi.fn(),
    getAllMedia: vi.fn(() => [])
  }
}

vi.mock('../hooks/useMedia', () => ({
  useMedia: () => mockMedia
}))

// Mock other required contexts
vi.mock('../contexts/UnsavedChangesContext', () => ({
  useUnsavedChanges: () => ({
    markUnsaved: vi.fn(),
    markSaved: vi.fn(),
    hasUnsavedChanges: false
  })
}))

vi.mock('../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn()
  })
}))

vi.mock('../hooks/useStepData', () => ({
  useStepData: () => ({
    currentStep: 5,
    totalSteps: 8,
    stepName: 'Audio Narration'
  })
}))

// Mock step navigation context
vi.mock('../contexts/StepNavigationContext', () => ({
  useStepNavigation: () => ({
    currentStep: 5,
    setCurrentStep: vi.fn(),
    totalSteps: 8,
    steps: [],
    navigateToStep: vi.fn()
  })
}))

// Mock MediaService with batch loading capability
const mockGetMediaBatchDirect = vi.fn()

vi.mock('../services/MediaService', () => ({
  createMediaService: vi.fn(() => ({
    getMediaBatchDirect: mockGetMediaBatchDirect,
    storeMedia: vi.fn(),
    getMedia: vi.fn(),
    deleteMedia: vi.fn()
  }))
}))

// Mock audio duration measurement
const originalCreateElement = document.createElement
const mockAudioElements = new Map<string, HTMLAudioElement>()

// Helper to create mock audio blob with known duration
const createMockAudioBlob = (durationSeconds: number): Blob => {
  const data = new Uint8Array([0x49, 0x44, 0x33]) // MP3 header bytes
  return new Blob([data], { type: 'audio/mpeg' })
}

// Helper to mock audio element behavior
const mockAudioElement = (duration: number) => {
  const audio = {
    preload: '',
    src: '',
    readyState: 0,
    duration: duration,
    onloadedmetadata: null as (() => void) | null,
    onerror: null as (() => void) | null,
    load: vi.fn(() => {
      // Simulate metadata loading
      setTimeout(() => {
        if (audio.onloadedmetadata) {
          audio.onloadedmetadata()
        }
      }, 10)
    })
  } as Partial<HTMLAudioElement>

  return audio as HTMLAudioElement
}

describe('AudioNarrationWizard Real Duration Calculation', () => {
  const mockCourseContent: CourseContentUnion = {
    welcomePage: {
      title: 'Welcome',
      content: 'Welcome content'
    },
    learningObjectivesPage: {
      title: 'Learning Objectives',
      content: 'Objectives content'
    },
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic 1 content'
      },
      {
        id: 'topic-2',
        title: 'Topic 2',
        content: 'Topic 2 content'
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAudioElements.clear()

    // Mock document.createElement to return our mock audio elements
    document.createElement = vi.fn((tagName: string) => {
      if (tagName === 'audio') {
        const mockAudio = mockAudioElement(0) // Default duration, will be overridden
        return mockAudio
      }
      return originalCreateElement.call(document, tagName)
    })

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn((blob: Blob) => `blob:mock-url-${Math.random()}`)
    global.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    document.createElement = originalCreateElement
    vi.restoreAllMocks()
  })

  it('should calculate real total duration from actual audio files, not fake formula', async () => {
    // ARRANGE: Set up audio files with known durations
    const audioFile1Duration = 45.5 // seconds
    const audioFile2Duration = 32.8 // seconds
    const audioFile3Duration = 28.2 // seconds
    const expectedTotalSeconds = audioFile1Duration + audioFile2Duration + audioFile3Duration // 106.5 seconds = 1:46

    // Mock the batch media loading to return audio blobs
    mockGetMediaBatchDirect.mockResolvedValue(new Map([
      ['audio-welcome-123', {
        data: new Uint8Array([0x49, 0x44, 0x33]), // Mock MP3 data
        metadata: { mimeType: 'audio/mpeg' }
      }],
      ['audio-topic-1-456', {
        data: new Uint8Array([0x49, 0x44, 0x33]), // Mock MP3 data
        metadata: { mimeType: 'audio/mpeg' }
      }],
      ['audio-topic-2-789', {
        data: new Uint8Array([0x49, 0x44, 0x33]), // Mock MP3 data
        metadata: { mimeType: 'audio/mpeg' }
      }]
    ]))

    // Override createElement to return audio elements with specific durations
    let audioElementIndex = 0
    const durations = [audioFile1Duration, audioFile2Duration, audioFile3Duration]

    document.createElement = vi.fn((tagName: string) => {
      if (tagName === 'audio') {
        const duration = durations[audioElementIndex++] || 0
        return mockAudioElement(duration)
      }
      return originalCreateElement.call(document, tagName)
    })

    // Mock course content with audio files already present in media arrays
    const courseContentWithAudio = {
      ...mockCourseContent,
      welcomePage: {
        ...mockCourseContent.welcomePage,
        media: [{
          id: 'audio-welcome-123',
          type: 'audio' as const,
          pageId: 'welcome'
        }]
      },
      topics: [
        {
          ...mockCourseContent.topics[0],
          media: [{
            id: 'audio-topic-1-456',
            type: 'audio' as const,
            pageId: 'topic-1'
          }]
        },
        {
          ...mockCourseContent.topics[1],
          media: [{
            id: 'audio-topic-2-789',
            type: 'audio' as const,
            pageId: 'topic-2'
          }]
        }
      ]
    }

    // ACT: Render the wizard with audio files
    render(
      <AudioNarrationWizard
        courseContent={courseContentWithAudio}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Wait for the component to load and detect audio files
    await waitFor(() => {
      // Look for the duration display in the stats bar
      const durationElement = screen.getByText(/Duration/i)
      expect(durationElement).toBeInTheDocument()
    })

    // ASSERT: Verify real duration calculation, not fake formula
    await waitFor(() => {
      // Should show calculated duration (1:46 for 106.5 seconds), not fake count * 1.5
      const durationDisplay = screen.getByText(/1:46|106\.5|1 min 46/i)
      expect(durationDisplay).toBeInTheDocument()

      // Should NOT show the fake formula result (3 files * 1.5 = 4.5 minutes = "4 min")
      const fakeDurationDisplay = screen.queryByText(/4 min|4\.5/i)
      expect(fakeDurationDisplay).not.toBeInTheDocument()
    }, { timeout: 5000 })

    // Verify that MediaService batch loading was called
    expect(mockGetMediaBatchDirect).toHaveBeenCalledWith(
      expect.arrayContaining(['audio-welcome-123', 'audio-topic-1-456', 'audio-topic-2-789'])
    )
  })

  it('should show loading state while calculating durations', async () => {
    // ARRANGE: Make batch loading slow to test loading state
    mockGetMediaBatchDirect.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve(new Map()), 2000))
    )

    // Mock course content with audio files already present in media arrays
    const courseContentWithAudio = {
      ...mockCourseContent,
      welcomePage: {
        ...mockCourseContent.welcomePage,
        media: [{
          id: 'audio-welcome-123',
          type: 'audio' as const,
          pageId: 'welcome'
        }]
      }
    }

    // ACT: Render wizard
    render(
      <AudioNarrationWizard
        courseContent={courseContentWithAudio}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // ASSERT: Should show loading state
    await waitFor(() => {
      const loadingText = screen.getByText(/calculating|loading/i)
      expect(loadingText).toBeInTheDocument()
    })
  })

  it('should handle missing or corrupt audio files gracefully', async () => {
    // ARRANGE: Mock some missing files and some corrupt files
    mockGetMediaBatchDirect.mockResolvedValue(new Map([
      ['audio-1', null], // Missing file
      ['audio-2', {
        data: new Uint8Array([0x00, 0x00]), // Corrupt data
        metadata: { mimeType: 'audio/mpeg' }
      }],
      ['audio-3', {
        data: new Uint8Array([0x49, 0x44, 0x33]), // Valid MP3
        metadata: { mimeType: 'audio/mpeg' }
      }]
    ]))

    // Mock audio element to simulate loading error for corrupt file
    let elementCount = 0
    document.createElement = vi.fn((tagName: string) => {
      if (tagName === 'audio') {
        elementCount++
        if (elementCount === 1) {
          // First audio element simulates corrupt file (duration = NaN)
          const audio = mockAudioElement(NaN)
          audio.onerror = () => {} // Will be called for corrupt data
          return audio
        } else {
          // Second audio element is valid (30 seconds)
          return mockAudioElement(30)
        }
      }
      return originalCreateElement.call(document, tagName)
    })

    // Mock course content with audio files already present in media arrays
    const courseContentWithAudio = {
      ...mockCourseContent,
      welcomePage: {
        ...mockCourseContent.welcomePage,
        media: [{
          id: 'audio-1',
          type: 'audio' as const,
          pageId: 'welcome'
        }]
      },
      topics: [
        {
          ...mockCourseContent.topics[0],
          media: [{
            id: 'audio-2',
            type: 'audio' as const,
            pageId: 'topic-1'
          }]
        },
        {
          ...mockCourseContent.topics[1],
          media: [{
            id: 'audio-3',
            type: 'audio' as const,
            pageId: 'topic-2'
          }]
        }
      ]
    }

    // ACT: Render wizard
    render(
      <AudioNarrationWizard
        courseContent={courseContentWithAudio}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // ASSERT: Should show duration for only the valid file (0:30)
    await waitFor(() => {
      const durationDisplay = screen.getByText(/0:30|30/i)
      expect(durationDisplay).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should ignore JSON duration fields and calculate from actual files only', async () => {
    const realDuration = 42.3 // Real duration from actual file
    mockGetMediaBatchDirect.mockResolvedValue(new Map([
      ['audio-welcome', {
        data: new Uint8Array([0x49, 0x44, 0x33]),
        metadata: { mimeType: 'audio/mpeg' }
      }]
    ]))

    document.createElement = vi.fn((tagName: string) => {
      if (tagName === 'audio') {
        return mockAudioElement(realDuration)
      }
      return originalCreateElement.call(document, tagName)
    })

    // ARRANGE: Course content with fake JSON durations and actual audio files
    const courseContentWithFakeDurations = {
      ...mockCourseContent,
      welcomePage: {
        ...mockCourseContent.welcomePage,
        audioDuration: 999, // Fake JSON duration - should be ignored
        duration: '16:39', // Another fake duration field - should be ignored
        media: [{
          id: 'audio-welcome',
          type: 'audio' as const,
          pageId: 'welcome'
        }]
      }
    }

    // ACT: Render wizard
    render(
      <AudioNarrationWizard
        courseContent={courseContentWithFakeDurations}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // ASSERT: Should show real duration (0:42), not JSON duration (16:39)
    await waitFor(() => {
      const realDurationDisplay = screen.getByText(/0:42|42/i)
      expect(realDurationDisplay).toBeInTheDocument()

      // Should NOT show fake JSON durations
      const fakeDurationDisplay = screen.queryByText(/16:39|999/i)
      expect(fakeDurationDisplay).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })
})