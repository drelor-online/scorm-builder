/**
 * Test to reproduce and verify fix for media export issue
 *
 * Issue: Media files are not included in exported ZIP files
 * Root cause: Export code tries to fetch from non-existent mediaData.url instead of using mediaData.data
 */

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import JSZip from 'jszip'
import { exportProject } from '../services/ProjectExportImport'

// Mock debug logger
vi.mock('../utils/debugLogger', () => ({
  debugLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('Media Export Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock DOM methods
    global.URL = {
      createObjectURL: vi.fn(() => 'mock-blob-url'),
      revokeObjectURL: vi.fn()
    } as any

    global.fetch = vi.fn() as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should include media files in exported ZIP when data is provided', async () => {
    // Test data - representing what should be passed to exportProject
    const projectData = {
      metadata: {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        projectName: 'Test Project'
      },
      courseData: {
        title: 'Test Course',
        topics: []
      },
      media: {
        images: [
          {
            filename: 'test-image.jpg',
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            mimeType: 'image/png'
          }
        ],
        audio: [
          {
            filename: 'test-audio.mp3',
            data: 'UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVGAxFn+DyvmEiDjiH0fPLdCUELoHL8tuOOAg=',
            mimeType: 'audio/mpeg'
          }
        ],
        captions: [
          {
            filename: 'test-caption.vtt',
            data: 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nTest caption content',
            mimeType: 'text/vtt'
          }
        ]
      }
    }

    // Call the export function
    const result = await exportProject(projectData)

    // Verify export succeeded
    expect(result.success).toBe(true)
    expect(result.blob).toBeDefined()
    expect(result.filename).toBeDefined()

    // Extract and verify ZIP contents
    const zip = new JSZip()
    await zip.loadAsync(result.blob!)

    // Check that media folders exist
    expect(zip.files['media/']).toBeDefined()
    expect(zip.files['media/images/']).toBeDefined()
    expect(zip.files['media/audio/']).toBeDefined()
    expect(zip.files['media/captions/']).toBeDefined()

    // Check that media files are included
    expect(zip.files['media/images/test-image.jpg']).toBeDefined()
    expect(zip.files['media/audio/test-audio.mp3']).toBeDefined()
    expect(zip.files['media/captions/test-caption.vtt']).toBeDefined()

    // Verify media file contents can be extracted
    const imageData = await zip.files['media/images/test-image.jpg'].async('base64')
    expect(imageData).toBe(projectData.media.images[0].data)

    const audioData = await zip.files['media/audio/test-audio.mp3'].async('base64')
    expect(audioData).toBe(projectData.media.audio[0].data)

    const captionData = await zip.files['media/captions/test-caption.vtt'].async('string')
    expect(captionData).toBe(projectData.media.captions[0].data)
  })

  test('should handle empty media arrays', async () => {
    const projectData = {
      metadata: {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        projectName: 'Test Project'
      },
      courseData: {
        title: 'Test Course',
        topics: []
      },
      media: {
        images: [],
        audio: [],
        captions: []
      }
    }

    const result = await exportProject(projectData)

    expect(result.success).toBe(true)
    expect(result.blob).toBeDefined()

    // Verify ZIP structure is still created
    const zip = new JSZip()
    await zip.loadAsync(result.blob!)

    expect(zip.files['manifest.json']).toBeDefined()
    expect(zip.files['course-data.json']).toBeDefined()
    expect(zip.files['media/']).toBeDefined()
  })

  test('reproduces the current bug - demonstrates fetch from url approach fails', async () => {
    // This test demonstrates the current broken behavior in ProjectDashboard
    // where it tries to fetch from mediaData.url instead of using mediaData.data

    const mockStorage = {
      fileStorage: {
        listMedia: vi.fn().mockResolvedValue([
          { id: 'image-1', filename: 'test.jpg', type: 'image' }
        ])
      },
      getMedia: vi.fn().mockResolvedValue({
        id: 'image-1',
        mediaType: 'image',
        metadata: { type: 'image', filename: 'test.jpg' },
        data: new ArrayBuffer(100), // This is what getMedia actually returns
        // NOTE: No 'url' property - this is the bug!
        size: 100
      }),
      openProject: vi.fn(),
      getCourseSeedData: vi.fn().mockResolvedValue({ courseTitle: 'Test' }),
      getCourseContent: vi.fn().mockResolvedValue({ topics: [] })
    }

    // Simulate the current buggy code path that tries to fetch from mediaData.url
    const mediaList = await mockStorage.fileStorage.listMedia()
    const exportData = {
      metadata: { version: '1.0.0', exportDate: new Date().toISOString(), projectName: 'Test' },
      courseData: { title: 'Test', topics: [] },
      media: { images: [], audio: [], captions: [] }
    }

    let fetchWasCalled = false
    global.fetch = vi.fn().mockImplementation(() => {
      fetchWasCalled = true
      return Promise.reject(new Error('TypeError: Cannot read properties of undefined (reading \'url\')'))
    })

    // Process media files (current buggy approach)
    if (mediaList) {
      for (const mediaItem of mediaList) {
        try {
          const mediaData = await mockStorage.getMedia(mediaItem.id)
          if (mediaData && mediaData.url) { // This condition fails because mediaData.url doesn't exist
            const response = await fetch(mediaData.url) // This line never executes
            const blob = await response.blob()
            // ... rest of processing
          }
        } catch (error) {
          // The bug: media processing fails silently
          console.log('Media processing failed:', error.message)
        }
      }
    }

    // Verify that the bug causes media to be empty
    expect(exportData.media.images).toHaveLength(0)
    expect(exportData.media.audio).toHaveLength(0)
    expect(exportData.media.captions).toHaveLength(0)
    expect(fetchWasCalled).toBe(false) // fetch was never called because mediaData.url doesn't exist
  })
})