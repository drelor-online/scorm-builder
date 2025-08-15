import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaService } from '../MediaService'
import { FileStorage } from '../FileStorage'

// Mock FileStorage
vi.mock('../FileStorage', () => ({
  FileStorage: vi.fn().mockImplementation(() => ({
    storeMedia: vi.fn().mockResolvedValue(true),
    storeYouTubeVideo: vi.fn().mockResolvedValue(true),
    getMedia: vi.fn().mockResolvedValue({
      data: new Uint8Array(),
      metadata: {}
    }),
    deleteMedia: vi.fn().mockResolvedValue(true),
    listMedia: vi.fn().mockResolvedValue([])
  }))
}))

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

describe('MediaService - YouTube Metadata Persistence', () => {
  let mediaService: MediaService
  let mockFileStorage: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockFileStorage = {
      storeMedia: vi.fn().mockResolvedValue(true),
      storeYouTubeVideo: vi.fn().mockResolvedValue(true),
      getMedia: vi.fn().mockResolvedValue({
        data: new Uint8Array(),
        metadata: {}
      }),
      deleteMedia: vi.fn().mockResolvedValue(true),
      listMedia: vi.fn().mockResolvedValue([])
    }
    
    // Use getInstance with a test config
    mediaService = MediaService.getInstance({
      projectId: 'test-project',
      fileStorage: mockFileStorage
    })
  })

  it('should store isYouTube flag in metadata when storing YouTube video', async () => {
    const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const embedUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ'
    const pageId = 'welcome'
    const metadata = {
      title: 'Test Video',
      thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
    }

    const result = await mediaService.storeYouTubeVideo(
      youtubeUrl,
      embedUrl,
      pageId,
      metadata
    )

    // Check that the returned media item has isYouTube flag
    expect(result).toMatchObject({
      type: 'video',
      pageId: pageId,
      metadata: expect.objectContaining({
        youtubeUrl,
        embedUrl,
        isYouTube: true  // This should be included
      })
    })

    // Verify FileStorage was called with correct parameters
    expect(mockFileStorage.storeYouTubeVideo).toHaveBeenCalledWith(
      expect.any(String),
      youtubeUrl,
      expect.objectContaining({
        page_id: pageId,
        title: metadata.title,
        thumbnail: metadata.thumbnail,
        embed_url: embedUrl
      })
    )
  })

  it('should preserve isYouTube flag when retrieving YouTube videos', async () => {
    const mediaId = 'video-0-welcome'
    
    // Mock FileStorage to return YouTube metadata
    mockFileStorage.getMedia.mockResolvedValue({
      data: new Uint8Array(),
      metadata: {
        type: 'video',
        youtubeUrl: 'https://www.youtube.com/watch?v=test123',
        embedUrl: 'https://www.youtube.com/embed/test123',
        isYouTube: true
      }
    })

    const result = await mediaService.getMedia(mediaId)

    expect(result).toBeDefined()
    expect(result.metadata).toMatchObject({
      type: 'video',
      youtubeUrl: 'https://www.youtube.com/watch?v=test123',
      embedUrl: 'https://www.youtube.com/embed/test123',
      isYouTube: true
    })
  })

  it('should include isYouTube in media array for pages', async () => {
    const pageId = 'welcome'
    
    // Mock listMedia to return YouTube videos
    mockFileStorage.listMedia.mockResolvedValue([
      {
        id: 'video-0-welcome',
        metadata: {
          type: 'video',
          page_id: pageId,
          youtubeUrl: 'https://www.youtube.com/watch?v=abc123',
          embedUrl: 'https://www.youtube.com/embed/abc123',
          isYouTube: true
        }
      }
    ])

    const mediaList = await mediaService.listMediaForPage(pageId)

    expect(mediaList).toHaveLength(1)
    expect(mediaList[0]).toMatchObject({
      id: 'video-0-welcome',
      type: 'video',
      pageId,
      metadata: expect.objectContaining({
        isYouTube: true
      })
    })
  })

  it('should differentiate between YouTube and regular videos', async () => {
    const pageId = 'topic-1'
    
    // Store regular video
    const regularVideo = await mediaService.storeMedia(
      new File(['video data'], 'regular.mp4', { type: 'video/mp4' }),
      'video',
      pageId
    )

    expect(regularVideo.metadata.isYouTube).toBeUndefined()

    // Store YouTube video
    const youtubeVideo = await mediaService.storeYouTubeVideo(
      'https://www.youtube.com/watch?v=xyz789',
      'https://www.youtube.com/embed/xyz789',
      pageId
    )

    expect(youtubeVideo.metadata.isYouTube).toBe(true)
  })

  it('should return media with correct structure for PageThumbnailGrid', async () => {
    const pageId = 'objectives'
    const youtubeUrl = 'https://youtu.be/short123'
    const embedUrl = 'https://www.youtube.com/embed/short123'
    
    const storedVideo = await mediaService.storeYouTubeVideo(
      youtubeUrl,
      embedUrl,
      pageId,
      {
        title: 'Short URL Video',
        thumbnail: 'https://img.youtube.com/vi/short123/mqdefault.jpg'
      }
    )

    // The returned object should have the structure expected by PageThumbnailGrid
    expect(storedVideo).toMatchObject({
      id: expect.stringMatching(/^video-\d+-objectives$/),
      type: 'video',
      pageId,
      fileName: 'Short URL Video',
      metadata: expect.objectContaining({
        youtubeUrl,
        embedUrl,
        isYouTube: true,
        thumbnail: 'https://img.youtube.com/vi/short123/mqdefault.jpg'
      })
    })
  })
})