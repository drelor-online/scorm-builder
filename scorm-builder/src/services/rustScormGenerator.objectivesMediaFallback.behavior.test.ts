/**
 * Test for learning objectives page media fallback behavior
 * This test verifies that audio-1 and caption-1 are always included when objectives page exists,
 * even if not explicitly specified in the content structure.
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
    listAllMedia: vi.fn(),
    getMedia: vi.fn()
  }))
}))

// Import the function we'll be testing
import { buildScormPackageEnhanced, collectAllMediaIds } from './rustScormGenerator'

describe('Learning Objectives Media Fallback Behavior', () => {
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
  })

  afterEach(() => {
    console.error = originalConsoleError
    vi.clearAllMocks()
  })

  it('should always collect audio-1 and caption-1 when objectives page exists', () => {
    const courseContent = {
      title: "Test Course",
      learningObjectivesPage: {
        objectives: ["Learn something important"],
        // Note: No explicit audioFile or captionFile specified
        media: [] // Empty media array
      },
      topics: [],
      assessment: {
        questions: []
      }
    }

    const collectedIds = collectAllMediaIds(courseContent)

    // Should include fallback IDs even when not explicitly specified
    expect(collectedIds).toContain('audio-1')
    expect(collectedIds).toContain('caption-1')
  })

  it('should include explicit media IDs when present alongside fallbacks', () => {
    const courseContent = {
      title: "Test Course",
      learningObjectivesPage: {
        objectives: ["Learn something important"],
        audioFile: "custom-audio-objectives",
        captionFile: "custom-caption-objectives",
        media: [
          { id: "custom-audio-objectives", type: "audio" },
          { id: "custom-caption-objectives", type: "caption" }
        ]
      },
      topics: [],
      assessment: {
        questions: []
      }
    }

    const collectedIds = collectAllMediaIds(courseContent)

    // Should include both explicit and fallback IDs
    expect(collectedIds).toContain('custom-audio-objectives')
    expect(collectedIds).toContain('custom-caption-objectives')
    expect(collectedIds).toContain('audio-1')
    expect(collectedIds).toContain('caption-1')
  })

  it('should support both learningObjectivesPage and objectivesPage naming', () => {
    const courseContentWithObjectivesPage = {
      title: "Test Course",
      objectivesPage: {
        objectives: ["Learn something important"],
        media: []
      },
      topics: [],
      assessment: {
        questions: []
      }
    }

    const collectedIds = collectAllMediaIds(courseContentWithObjectivesPage)

    expect(collectedIds).toContain('audio-1')
    expect(collectedIds).toContain('caption-1')
  })

  it('should not include fallback IDs when no objectives page exists', () => {
    const courseContent = {
      title: "Test Course",
      // No learningObjectivesPage or objectivesPage
      topics: [],
      assessment: {
        questions: []
      }
    }

    const collectedIds = collectAllMediaIds(courseContent)

    expect(collectedIds).not.toContain('audio-1')
    expect(collectedIds).not.toContain('caption-1')
  })

  it('should include audio-1 and caption-1 in SCORM package when objectives page has media', async () => {
    // Mock the getMediaBatchDirect to return audio-1 and caption-1
    const mockAudio1 = new Uint8Array([65, 85, 68, 73, 79]) // "AUDIO" in bytes
    const mockCaption1 = new Uint8Array([86, 84, 84]) // "VTT" in bytes

    mockMediaService.getMediaBatchDirect.mockResolvedValue(new Map([
      ['audio-1', { data: mockAudio1, metadata: { mimeType: 'audio/mp3' } }],
      ['caption-1', { data: mockCaption1, metadata: { mimeType: 'text/vtt' } }]
    ]))

    mockMediaService.getMedia.mockImplementation(async (id: string) => {
      if (id === 'audio-1') {
        return { data: mockAudio1, metadata: { mimeType: 'audio/mp3' } }
      }
      if (id === 'caption-1') {
        return { data: mockCaption1, metadata: { mimeType: 'text/vtt' } }
      }
      return null
    })

    mockMediaService.listAllMedia.mockResolvedValue([])

    const courseContent = {
      title: "Test Course",
      welcomePage: {
        title: "Welcome",
        content: "Welcome to the course",
        media: []
      },
      learningObjectivesPage: {
        title: "Learning Objectives",
        heading: "What You Will Learn",
        objectives: ["Learn something important"],
        media: [
          { id: "audio-1", type: "audio", title: "Objectives Audio" },
          { id: "caption-1", type: "caption", title: "Objectives Caption" }
        ]
      },
      topics: [],
      assessment: {
        questions: []
      }
    }

    const result = await buildScormPackageEnhanced(
      courseContent,
      { projectId: 'test-project', title: 'Test Course' },
      new Map([
        ['audio-1', { data: mockAudio1, mimeType: 'audio/mp3' }],
        ['caption-1', { data: mockCaption1, mimeType: 'text/vtt' }]
      ]),
      new Map([
        ['audio-1', '.mp3'],
        ['caption-1', '.vtt']
      ])
    )

    expect(result).toBeDefined()
    expect(result.length).toBeGreaterThan(0)

    // Verify the mock was called for batch loading
    expect(mockMediaService.getMediaBatchDirect).toHaveBeenCalledWith(
      expect.arrayContaining(['audio-1', 'caption-1'])
    )
  })

  it('should handle fallback when media not in preloaded cache but exists in MediaService', async () => {
    // Mock empty preloaded cache but media exists in MediaService
    const mockAudio1 = new Uint8Array([65, 85, 68, 73, 79]) // "AUDIO" in bytes
    const mockCaption1 = new Uint8Array([86, 84, 84]) // "VTT" in bytes

    mockMediaService.getMediaBatchDirect.mockResolvedValue(new Map()) // Empty preload cache

    mockMediaService.getMedia.mockImplementation(async (id: string) => {
      if (id === 'audio-1') {
        return { data: mockAudio1, metadata: { mimeType: 'audio/mp3' } }
      }
      if (id === 'caption-1') {
        return { data: mockCaption1, metadata: { mimeType: 'text/vtt' } }
      }
      return null
    })

    mockMediaService.listAllMedia.mockResolvedValue([])

    const courseContent = {
      title: "Test Course",
      welcomePage: {
        title: "Welcome",
        content: "Welcome to the course",
        media: []
      },
      learningObjectivesPage: {
        title: "Learning Objectives",
        heading: "What You Will Learn",
        objectives: ["Learn something important"]
        // No explicit media - should fallback to audio-1 and caption-1
      },
      topics: [],
      assessment: {
        questions: []
      }
    }

    const result = await buildScormPackageEnhanced(
      courseContent,
      { projectId: 'test-project', title: 'Test Course' },
      new Map(), // Empty preloaded cache
      new Map() // Empty extension map
    )

    expect(result).toBeDefined()
    expect(result.length).toBeGreaterThan(0)

    // Should have tried to load from MediaService as fallback
    expect(mockMediaService.getMedia).toHaveBeenCalledWith('audio-1')
    expect(mockMediaService.getMedia).toHaveBeenCalledWith('caption-1')
  })
})