/**
 * Tests for YouTube video URL and clip timing extraction fix
 * This test verifies that YouTube videos properly get their URLs and clip timing
 * even when visual-only mode is active.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MediaService } from './MediaService'
import type { FileStorage } from './FileStorage'

// Mock FileStorage to simulate YouTube video storage
const createMockFileStorage = () => {
  const mockFileStorage = {
    getMedia: vi.fn(),
    storeYouTubeVideo: vi.fn(),
  } as unknown as FileStorage

  return mockFileStorage
}

describe('MediaService YouTube URL Fix', () => {
  let mediaService: MediaService
  let mockFileStorage: FileStorage

  beforeEach(() => {
    mockFileStorage = createMockFileStorage()
    mediaService = new MediaService('test-project', mockFileStorage)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should extract YouTube URL from blob data when metadata is missing', async () => {
    // Arrange: YouTube video stored with URL in blob data but no URL in metadata
    const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const mediaId = 'video-test-1'

    // Mock the blob data containing the YouTube URL
    const urlBlob = new TextEncoder().encode(youtubeUrl)

    vi.mocked(mockFileStorage.getMedia).mockResolvedValue({
      data: urlBlob,
      mediaType: 'youtube',
      metadata: {
        source: 'youtube',
        isYouTube: true,
        clip_start: 30,
        clip_end: 90,
        // Note: embedUrl and youtubeUrl are missing from metadata
      }
    })

    // Act: Get the media
    const result = await mediaService.getMedia(mediaId)

    // Assert: Should extract URL from blob data and preserve clip timing
    expect(result).toBeTruthy()
    expect(result!.url).toBe(youtubeUrl + '?start=30&end=90')
    expect(result!.metadata.clipStart).toBe(30)
    expect(result!.metadata.clipEnd).toBe(90)
    expect(result!.metadata.isYouTube).toBe(true)
  })

  it('should use metadata URL when available and add clip timing parameters', async () => {
    // Arrange: YouTube video with URL in metadata
    const baseUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ'
    const mediaId = 'video-test-2'

    vi.mocked(mockFileStorage.getMedia).mockResolvedValue({
      data: new Uint8Array([]), // Empty blob data
      mediaType: 'youtube',
      metadata: {
        source: 'youtube',
        isYouTube: true,
        embed_url: baseUrl,
        clip_start: 45,
        clip_end: 120
      }
    })

    // Act: Get the media
    const result = await mediaService.getMedia(mediaId)

    // Assert: Should use metadata URL and add clip timing
    expect(result).toBeTruthy()
    expect(result!.url).toBe(baseUrl + '?start=45&end=120')
    expect(result!.metadata.clipStart).toBe(45)
    expect(result!.metadata.clipEnd).toBe(120)
    expect(result!.metadata.embedUrl).toBe(baseUrl)
  })

  it('should handle YouTube video without clip timing', async () => {
    // Arrange: YouTube video without clip timing
    const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const mediaId = 'video-test-3'

    const urlBlob = new TextEncoder().encode(youtubeUrl)

    vi.mocked(mockFileStorage.getMedia).mockResolvedValue({
      data: urlBlob,
      mediaType: 'youtube',
      metadata: {
        source: 'youtube',
        isYouTube: true,
        // No clip timing
      }
    })

    // Act: Get the media
    const result = await mediaService.getMedia(mediaId)

    // Assert: Should use URL without clip timing parameters
    expect(result).toBeTruthy()
    expect(result!.url).toBe(youtubeUrl)
    expect(result!.metadata.clipStart).toBeUndefined()
    expect(result!.metadata.clipEnd).toBeUndefined()
    expect(result!.metadata.isYouTube).toBe(true)
  })

  it('should provide fallback URL for YouTube video with no URL data', async () => {
    // Arrange: YouTube video with no URL data anywhere
    const mediaId = 'video-test-4'

    vi.mocked(mockFileStorage.getMedia).mockResolvedValue({
      data: new Uint8Array([]), // Empty blob data
      mediaType: 'youtube',
      metadata: {
        source: 'youtube',
        isYouTube: true,
        // No URL fields
      }
    })

    // Act: Get the media
    const result = await mediaService.getMedia(mediaId)

    // Assert: Should provide fallback URL
    expect(result).toBeTruthy()
    expect(result!.url).toBe('https://www.youtube.com/watch?v=invalid')
    expect(result!.metadata.isYouTube).toBe(true)
  })

  it('should convert snake_case metadata fields to camelCase', async () => {
    // Arrange: YouTube video with snake_case metadata
    const youtubeUrl = 'https://www.youtube.com/watch?v=test'
    const mediaId = 'video-test-5'

    const urlBlob = new TextEncoder().encode(youtubeUrl)

    vi.mocked(mockFileStorage.getMedia).mockResolvedValue({
      data: urlBlob,
      mediaType: 'youtube',
      metadata: {
        source: 'youtube',
        isYouTube: true,
        embed_url: 'https://www.youtube.com/embed/test',
        clip_start: 10,
        clip_end: 60,
        page_id: 'test-page',
        mime_type: 'video/mp4'
      }
    })

    // Act: Get the media
    const result = await mediaService.getMedia(mediaId)

    // Assert: Should convert snake_case to camelCase
    expect(result).toBeTruthy()
    expect(result!.metadata.embedUrl).toBe('https://www.youtube.com/embed/test')
    expect(result!.metadata.clipStart).toBe(10)
    expect(result!.metadata.clipEnd).toBe(60)
    expect(result!.metadata.pageId).toBe('test-page')
    expect(result!.metadata.mimeType).toBe('video/mp4')
  })
})