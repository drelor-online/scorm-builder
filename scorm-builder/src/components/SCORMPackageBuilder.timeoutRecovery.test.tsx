/**
 * Test for SCORM generation timeout recovery
 *
 * This test reproduces the issue where SCORM generation hangs when media items timeout
 * during the batch loading process. The goal is to ensure generation continues
 * even when individual media items fail to load.
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
vi.mock('../services/MediaService', () => ({
  createMediaService: vi.fn(() => ({
    getMediaBatchDirect: vi.fn(),
    listAllMedia: vi.fn()
  }))
}))

// Import the function we'll be testing
import { buildScormPackageEnhanced } from '../services/rustScormGenerator'

describe('SCORM Generation Timeout Recovery', () => {
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
    const { createMediaService } = await import('../services/MediaService')
    mockMediaService = createMediaService('test-project')

    // Setup default mock responses
    mockMediaService.listAllMedia.mockResolvedValue([])
    mockMediaService.getMediaBatchDirect.mockResolvedValue(new Map())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    console.error = originalConsoleError
  })

  it('should continue SCORM generation when media items timeout', async () => {
    // Setup course content with media that will timeout
    const courseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome',
        media: []
      },
      learningObjectivesPage: {
        title: 'Learning Objectives',
        media: [
          { id: 'image-1', type: 'image', url: '', title: 'Objectives Image' }
        ]
      },
      topics: []
    }

    const courseSeedData = {
      projectId: 'test-project',
      title: 'Test Course'
    }

    // Mock media cache with one item that will timeout (resolve to null)
    const mockMediaCache = new Map([
      // image-1 is missing from cache, simulating timeout
    ])

    const authoritativeExtensionMap = new Map([
      ['image-1', '.jpg']
    ])

    // Mock Tauri invoke for SCORM generation - this should be called despite timeout
    let scormGenerationCalled = false
    global.window.__TAURI__.invoke = vi.fn().mockImplementation((command, payload) => {
      if (command === 'generate_scorm_enhanced') {
        scormGenerationCalled = true
        console.log('[TEST] SCORM generation called successfully despite media timeout')
        return Promise.resolve([1, 2, 3, 4, 5]) // Return number array like Rust does
      }
      return Promise.resolve(undefined)
    })

    // Call the SCORM generation function directly - this should NOT hang
    const result = await buildScormPackageEnhanced(
      courseContent,
      courseSeedData,
      mockMediaCache,
      authoritativeExtensionMap,
      { strictValidation: false }
    )

    // Verify that generation completed successfully despite the media timeout
    expect(scormGenerationCalled).toBe(true)
    expect(result).toBeDefined()
    expect(result).toBeInstanceOf(Uint8Array)
    console.log('[TEST] SCORM generation completed successfully despite media timeout')
  }, 10000) // 10 second test timeout

  it('should handle multiple media timeouts gracefully', async () => {
    const courseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome',
        media: [
          { id: 'image-welcome', type: 'image' }
        ]
      },
      learningObjectivesPage: {
        title: 'Learning Objectives',
        media: [
          { id: 'image-1', type: 'image' },
          { id: 'audio-1', type: 'audio' }
        ]
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          media: [
            { id: 'image-2', type: 'image' }
          ]
        }
      ]
    }

    const courseSeedData = {
      projectId: 'test-project',
      title: 'Test Course'
    }

    // Mock partial media cache - some items missing to simulate timeouts
    const mockMediaCache = new Map([
      ['image-welcome', { data: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' }],
      ['audio-1', { data: new Uint8Array([4, 5, 6]), mimeType: 'audio/mp3' }]
      // image-1 and image-2 are missing, simulating timeouts
    ])

    const authoritativeExtensionMap = new Map([
      ['image-welcome', '.jpg'],
      ['image-1', '.jpg'],
      ['audio-1', '.mp3'],
      ['image-2', '.jpg']
    ])

    let scormGenerationCalled = false
    global.window.__TAURI__.invoke = vi.fn().mockImplementation((command) => {
      if (command === 'generate_scorm_enhanced') {
        scormGenerationCalled = true
        return Promise.resolve([1, 2, 3, 4, 5]) // Return number array like Rust does
      }
      return Promise.resolve(undefined)
    })

    // Should complete despite multiple timeouts
    const result = await buildScormPackageEnhanced(
      courseContent,
      courseSeedData,
      mockMediaCache,
      authoritativeExtensionMap,
      { strictValidation: false }
    )

    expect(scormGenerationCalled).toBe(true)
    expect(result).toBeDefined()
    expect(result).toBeInstanceOf(Uint8Array)
  }, 10000)

  it('should generate SCORM package even with missing media files', async () => {
    const courseContent = {
      title: 'Test Course',
      welcome: { title: 'Welcome', media: [] },
      learningObjectivesPage: {
        title: 'Learning Objectives',
        media: [{ id: 'image-1', type: 'image' }]
      },
      topics: []
    }

    const courseSeedData = { projectId: 'test-project', title: 'Test Course' }

    // Mock empty media cache - all media missing to simulate complete timeout
    const mockMediaCache = new Map()

    const authoritativeExtensionMap = new Map([
      ['image-1', '.jpg']
    ])

    let scormGenerationCalled = false
    global.window.__TAURI__.invoke = vi.fn().mockImplementation((command) => {
      if (command === 'generate_scorm_enhanced') {
        scormGenerationCalled = true
        return Promise.resolve([1, 2, 3, 4, 5]) // Return number array like Rust does
      }
      return Promise.resolve(undefined)
    })

    // Should complete generation even with no media loaded
    const result = await buildScormPackageEnhanced(
      courseContent,
      courseSeedData,
      mockMediaCache,
      authoritativeExtensionMap,
      { strictValidation: false }
    )

    expect(scormGenerationCalled).toBe(true)
    expect(result).toBeDefined()
    expect(result).toBeInstanceOf(Uint8Array)
  }, 10000)
})