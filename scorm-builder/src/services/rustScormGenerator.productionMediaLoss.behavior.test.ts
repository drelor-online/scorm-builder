/**
 * Behavior test to reproduce the "0 media files" issue in production SCORM packages
 * 
 * This test simulates the exact scenario where a production build generates
 * a SCORM package with 0 media files, even when media is present in the course content.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateRustSCORM } from './rustScormGenerator'

// Mock the MediaService to simulate production behavior
vi.mock('./MediaService', () => ({
  createMediaService: vi.fn(() => ({
    getMedia: vi.fn(),
    listMedia: vi.fn(() => Promise.resolve([])),
  })),
}))

// Mock FileStorage to simulate file system behavior
vi.mock('./FileStorage', () => ({
  FileStorage: vi.fn(() => ({
    loadProject: vi.fn(),
    saveProject: vi.fn(),
  })),
}))

describe('Production Media Loss Issue', () => {
  const mockProjectId = 'test-project-123'
  
  const mockCourseContent = {
    title: 'Test Course with Media',
    description: 'Course containing media that should be included in SCORM package',
    welcomePage: {
      title: 'Welcome',
      content: 'Welcome content',
      media: [
        {
          id: 'image-welcome-001',
          type: 'image',
          title: 'Welcome Image',
          // No URL provided - should be loaded from MediaService by ID
        }
      ]
    },
    topics: [
      {
        id: 'topic-1',
        title: 'Topic with Audio',
        content: 'Topic content with audio',
        audioId: 'audio-topic1-001',
        media: [
          {
            id: 'video-topic1-001',
            type: 'video',
            title: 'Topic Video',
            // No URL provided - should be loaded from MediaService by ID
          }
        ]
      }
    ]
  }

  const mockCourseSettings = {
    allowRetake: true,
    showProgress: true,
    navigationMode: 'free'
  }

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    
    // Reset console.log spy to capture debug messages
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('should reproduce 0 media files issue when MediaService fails silently', async () => {
    // Mock MediaService to fail silently (simulating production behavior)
    const mockMediaService = {
      getMedia: vi.fn().mockRejectedValue(new Error('File not found')),
      listMedia: vi.fn().mockResolvedValue([]),
    }

    const { createMediaService } = await import('./MediaService')
    ;(createMediaService as any).mockReturnValue(mockMediaService)

    // Generate SCORM package - expect it to throw error about 0 media files
    await expect(
      generateRustSCORM(
        mockCourseContent,
        mockProjectId,
        undefined, // onProgress callback
        undefined, // preloadedMedia
        mockCourseSettings
      )
    ).rejects.toThrow('Failed to generate SCORM package with 0 media files')
    
    // Verify that media loading was attempted but failed silently
    expect(mockMediaService.getMedia).toHaveBeenCalled()
    
    // Check that console.log shows media loading attempts
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[Rust SCORM] No URL provided, loading from MediaService')
    )
  })

  it('should detect when media cache is empty in production-like environment', async () => {
    // Simulate production environment where media cache is not populated
    const mockMediaService = {
      getMedia: vi.fn().mockResolvedValue(null), // Returns null instead of file data
      listMedia: vi.fn().mockResolvedValue([]), // Empty media list
    }

    const { createMediaService } = await import('./MediaService')
    ;(createMediaService as any).mockReturnValue(mockMediaService)

    // Should throw error about 0 media files when cache is empty
    await expect(
      generateRustSCORM(
        mockCourseContent,
        mockProjectId,
        undefined, // onProgress callback
        undefined, // preloadedMedia
        mockCourseSettings
      )
    ).rejects.toThrow('Failed to generate SCORM package with 0 media files')
    
    // Verify that media loading returned null (production issue symptom)
    expect(mockMediaService.getMedia).toHaveBeenCalled()
    
    // Check for warning messages about missing media
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[Rust SCORM] No URL provided, loading from MediaService')
    )
  })

  it('should show that media loading errors are not properly propagated', async () => {
    // This test demonstrates how MediaService errors are silently caught
    
    const mockMediaService = {
      getMedia: vi.fn().mockRejectedValue(new Error('MediaService error in production')),
      listMedia: vi.fn().mockResolvedValue([]),
    }

    const { createMediaService } = await import('./MediaService')
    ;(createMediaService as any).mockReturnValue(mockMediaService)

    // The problem: SCORM generation fails with 0 media files when media loading fails
    // This means errors are silently caught and media is simply excluded
    await expect(
      generateRustSCORM(
        mockCourseContent,
        mockProjectId,
        undefined, // onProgress callback
        undefined, // preloadedMedia
        mockCourseSettings
      )
    ).rejects.toThrow('Failed to generate SCORM package with 0 media files')
    
    // Verify that media loading was attempted but errors were caught
    expect(mockMediaService.getMedia).toHaveBeenCalled()
  })

  it('should succeed when media files are properly loaded (expected behavior)', async () => {
    // This test should eventually pass after we fix the production media loading issue
    
    // Mock MediaService that properly loads media (expected behavior)
    const mockImageData = new Uint8Array([0xFF, 0xD8, 0xFF]) // JPEG header
    const mockAudioData = new Uint8Array([0x49, 0x44, 0x33]) // ID3 header
    const mockVideoData = new Uint8Array([0x00, 0x00, 0x00, 0x18]) // MP4 header

    const mockMediaService = {
      getMedia: vi.fn()
        .mockResolvedValueOnce({ data: mockImageData, metadata: { mimeType: 'image/jpeg' }})
        .mockResolvedValueOnce({ data: mockAudioData, metadata: { mimeType: 'audio/mpeg' }})
        .mockResolvedValueOnce({ data: mockVideoData, metadata: { mimeType: 'video/mp4' }}),
      listMedia: vi.fn().mockResolvedValue([
        { id: 'image-welcome-001', type: 'image', filename: 'image-welcome-001.jpg' },
        { id: 'audio-topic1-001', type: 'audio', filename: 'audio-topic1-001.mp3' },
        { id: 'video-topic1-001', type: 'video', filename: 'video-topic1-001.mp4' },
      ]),
    }

    const { createMediaService } = await import('./MediaService')
    ;(createMediaService as any).mockReturnValue(mockMediaService)

    // This should succeed and return a valid SCORM package
    const result = await generateRustSCORM(
      mockCourseContent,
      mockProjectId,
      undefined, // onProgress callback
      undefined, // preloadedMedia
      mockCourseSettings
    )

    // Should return a Uint8Array (ZIP file data)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBeGreaterThan(0)
    
    // Verify all media was loaded successfully
    expect(mockMediaService.getMedia).toHaveBeenCalledTimes(3)
    expect(mockMediaService.getMedia).toHaveBeenCalledWith('image-welcome-001')
    expect(mockMediaService.getMedia).toHaveBeenCalledWith('audio-topic1-001') 
    expect(mockMediaService.getMedia).toHaveBeenCalledWith('video-topic1-001')
  })
})