/**
 * Test for missing audio on learning objectives SCORM page
 * This test reproduces the issue where audio is not showing up on the learning objectives page
 * in the generated SCORM package despite being in the media array.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Tauri before importing any modules that use it
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
  emit: vi.fn()
}))

// Mock MediaService before importing
vi.mock('./MediaService', () => ({
  createMediaService: vi.fn(() => ({
    getMediaBatchDirect: vi.fn(),
    listAllMedia: vi.fn()
  }))
}))

// Import the function we'll be testing
import { buildScormPackageEnhanced } from './rustScormGenerator'

describe('Objectives Page Audio Missing Bug', () => {
  let mockMediaService: any
  let originalConsoleError: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Suppress console.error during tests
    originalConsoleError = console.error
    console.error = vi.fn()

    // Mock Tauri window object
    global.window = global.window || {}
    global.window.__TAURI__ = {
      invoke: vi.fn().mockResolvedValue(undefined)
    }

    // Get fresh mock instances
    const { createMediaService } = await import('./MediaService')
    mockMediaService = createMediaService('test-project')

    // Setup default mock responses
    mockMediaService.listAllMedia.mockResolvedValue([])
    mockMediaService.getMediaBatchDirect.mockResolvedValue(new Map())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    console.error = originalConsoleError
  })

  it('should include audio_file in learning_objectives_page when audio is in media array', async () => {
    const courseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome',
        media: []
      },
      objectivesPage: {
        title: 'Learning Objectives',
        narration: 'Objectives narration text',
        media: [
          { id: 'audio-1', type: 'audio', url: '', title: 'Objectives Audio', pageId: 'objectives' }
        ]
        // Note: audioFile property is not set, but audio is in media array
      },
      topics: []
    }

    const courseSeedData = {
      projectId: 'test-project',
      title: 'Test Course'
    }

    const mockMediaCache = new Map([
      ['audio-1', { data: new Uint8Array([1, 2, 3]), mimeType: 'audio/mp3' }]
    ])

    const authoritativeExtensionMap = new Map([
      ['audio-1', '.mp3']
    ])

    // Mock successful Tauri invoke
    global.window.__TAURI__.invoke = vi.fn().mockImplementation((command, payload) => {
      if (command === 'generate_scorm_package') {
        // Extract the course data passed to Rust
        const rustCourseData = payload.course_data

        // ASSERTION: The learning_objectives_page should have audio_file set
        expect(rustCourseData.learning_objectives_page).toBeDefined()
        expect(rustCourseData.learning_objectives_page.audio_file).toBeDefined()
        expect(rustCourseData.learning_objectives_page.audio_file).toBe('media/audio-1.mp3')

        console.log('[TEST] Rust course data learning_objectives_page:', rustCourseData.learning_objectives_page)

        return Promise.resolve(new Uint8Array([1, 2, 3, 4, 5]))
      }
      return Promise.resolve(undefined)
    })

    // The test should pass when the audio is properly mapped
    const result = await buildScormPackageEnhanced(
      courseContent,
      courseSeedData,
      mockMediaCache,
      authoritativeExtensionMap,
      { strictValidation: false }
    )

    expect(result).toBeDefined()
    expect(result).toBeInstanceOf(Uint8Array)
  })

  it('should handle both objectivesPage and learningObjectivesPage structures', async () => {
    const courseContentWithLearningObjectivesPage = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome',
        media: []
      },
      learningObjectivesPage: {
        title: 'Learning Objectives',
        narration: 'Objectives narration text',
        media: [
          { id: 'audio-1', type: 'audio', url: '', title: 'Objectives Audio', pageId: 'objectives' }
        ]
        // Note: audioFile property is not set, but audio is in media array
      },
      topics: []
    }

    const courseSeedData = {
      projectId: 'test-project',
      title: 'Test Course'
    }

    const mockMediaCache = new Map([
      ['audio-1', { data: new Uint8Array([1, 2, 3]), mimeType: 'audio/mp3' }]
    ])

    const authoritativeExtensionMap = new Map([
      ['audio-1', '.mp3']
    ])

    // Mock successful Tauri invoke
    global.window.__TAURI__.invoke = vi.fn().mockImplementation((command, payload) => {
      if (command === 'generate_scorm_package') {
        // Extract the course data passed to Rust
        const rustCourseData = payload.course_data

        // ASSERTION: The learning_objectives_page should have audio_file set
        expect(rustCourseData.learning_objectives_page).toBeDefined()
        expect(rustCourseData.learning_objectives_page.audio_file).toBeDefined()
        expect(rustCourseData.learning_objectives_page.audio_file).toBe('media/audio-1.mp3')

        return Promise.resolve(new Uint8Array([1, 2, 3, 4, 5]))
      }
      return Promise.resolve(undefined)
    })

    // The test should pass when the audio is properly mapped
    const result = await buildScormPackageEnhanced(
      courseContentWithLearningObjectivesPage,
      courseSeedData,
      mockMediaCache,
      authoritativeExtensionMap,
      { strictValidation: false }
    )

    expect(result).toBeDefined()
    expect(result).toBeInstanceOf(Uint8Array)
  })

  it('should prioritize audioFile property over media array when both are present', async () => {
    const courseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome',
        media: []
      },
      objectivesPage: {
        title: 'Learning Objectives',
        narration: 'Objectives narration text',
        audioFile: 'specific-audio-file', // Explicit audioFile should take priority
        media: [
          { id: 'audio-1', type: 'audio', url: '', title: 'Objectives Audio', pageId: 'objectives' }
        ]
      },
      topics: []
    }

    const courseSeedData = {
      projectId: 'test-project',
      title: 'Test Course'
    }

    const mockMediaCache = new Map([
      ['audio-1', { data: new Uint8Array([1, 2, 3]), mimeType: 'audio/mp3' }],
      ['specific-audio-file', { data: new Uint8Array([4, 5, 6]), mimeType: 'audio/mp3' }]
    ])

    const authoritativeExtensionMap = new Map([
      ['audio-1', '.mp3'],
      ['specific-audio-file', '.mp3']
    ])

    // Mock successful Tauri invoke
    global.window.__TAURI__.invoke = vi.fn().mockImplementation((command, payload) => {
      if (command === 'generate_scorm_package') {
        // Extract the course data passed to Rust
        const rustCourseData = payload.course_data

        // ASSERTION: Should use the explicit audioFile, not the media array
        expect(rustCourseData.learning_objectives_page).toBeDefined()
        expect(rustCourseData.learning_objectives_page.audio_file).toBe('media/specific-audio-file.mp3')

        return Promise.resolve(new Uint8Array([1, 2, 3, 4, 5]))
      }
      return Promise.resolve(undefined)
    })

    // The test should pass when the explicit audioFile is used
    const result = await buildScormPackageEnhanced(
      courseContent,
      courseSeedData,
      mockMediaCache,
      authoritativeExtensionMap,
      { strictValidation: false }
    )

    expect(result).toBeDefined()
    expect(result).toBeInstanceOf(Uint8Array)
  })
})