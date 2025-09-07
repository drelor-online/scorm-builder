import { describe, test, expect, vi, beforeEach } from 'vitest'
import { MediaService } from './MediaService'
import { FileStorage } from './FileStorage'

// Mock FileStorage
vi.mock('./FileStorage')

describe('YouTube Clip Timing SCORM Integration', () => {
  let mediaService: MediaService
  let mockFileStorage: FileStorage

  beforeEach(() => {
    mockFileStorage = {
      storeYouTubeVideo: vi.fn(),
      getMedia: vi.fn(),
    } as any

    mediaService = new MediaService({
      projectId: 'test-project',
      fileStorage: mockFileStorage
    })
  })

  test('should store YouTube video with clip timing metadata', async () => {
    const mockStoreYouTubeVideo = vi.fn().mockResolvedValue(undefined)
    mockFileStorage.storeYouTubeVideo = mockStoreYouTubeVideo

    // Store YouTube video with clip timing
    await mediaService.storeYouTubeVideo(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ?start=30&end=120',
      'topic-1',
      {
        title: 'Test Video',
        clipStart: 30,
        clipEnd: 120
      }
    )

    // Verify the FileStorage was called with correct metadata including clip timing
    expect(mockStoreYouTubeVideo).toHaveBeenCalledWith(
      expect.any(String), // mediaId
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      expect.objectContaining({
        clip_start: 30,
        clip_end: 120,
        embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=30&end=120'
      })
    )
  })

  test('should retrieve YouTube video with clip timing metadata', async () => {
    const mockGetMedia = vi.fn().mockResolvedValue({
      data: new Uint8Array([1, 2, 3]),
      metadata: {
        page_id: 'topic-1',
        type: 'video',
        title: 'Test Video',
        embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=30&end=120',
        clip_start: 30,
        clip_end: 120
      }
    })
    mockFileStorage.getMedia = mockGetMedia

    // Retrieve media
    const result = await mediaService.getMedia('video-123')

    // Verify clip timing is included in metadata
    expect(result?.metadata).toMatchObject({
      clip_start: 30,
      clip_end: 120
    })
  })

  test('should handle YouTube video without clip timing', async () => {
    const mockStoreYouTubeVideo = vi.fn().mockResolvedValue(undefined)
    mockFileStorage.storeYouTubeVideo = mockStoreYouTubeVideo

    // Store YouTube video without clip timing
    await mediaService.storeYouTubeVideo(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'topic-1',
      {
        title: 'Test Video'
        // No clipStart/clipEnd
      }
    )

    // Verify the FileStorage was called without clip timing
    expect(mockStoreYouTubeVideo).toHaveBeenCalledWith(
      expect.any(String), // mediaId
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      expect.objectContaining({
        clip_start: undefined,
        clip_end: undefined,
        embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
      })
    )
  })
})