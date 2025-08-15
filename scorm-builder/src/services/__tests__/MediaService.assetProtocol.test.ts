import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaService } from '../MediaService'
import { mediaUrlService } from '../mediaUrl'

// Mock FileStorage to avoid project ID issues
vi.mock('../FileStorage', () => ({
  FileStorage: vi.fn().mockImplementation(() => ({
    _currentProjectId: 'test-project-123',
    getMedia: vi.fn()
  }))
}))

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path) => `asset://localhost/${path}`)
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...parts) => parts.join('/'))
}))

// Mock the mediaUrl service
vi.mock('../mediaUrl', () => ({
  mediaUrlService: {
    getMediaUrl: vi.fn()
  }
}))

describe('MediaService - Asset Protocol', () => {
  let mediaService: MediaService
  let mockFileStorage: any
  const mockProjectId = 'test-project-123'
  const mockMediaId = 'media-456'

  beforeEach(async () => {
    vi.clearAllMocks()
    MediaService.clearInstance(mockProjectId)
    
    // Create a mock FileStorage instance
    mockFileStorage = {
      _currentProjectId: mockProjectId,
      getMedia: vi.fn()
    }
    
    // Mock the FileStorage constructor to return our mock
    const { FileStorage } = await import('../FileStorage')
    vi.mocked(FileStorage).mockImplementation(() => mockFileStorage as any)
    
    mediaService = MediaService.getInstance({ projectId: mockProjectId })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return asset protocol URLs instead of blob URLs for images', async () => {
    const mockMediaData = {
      id: mockMediaId,
      data: new ArrayBuffer(4),
      mediaType: 'image',
      metadata: {
        type: 'image',
        mime_type: 'image/png',
        original_name: 'test.png'
      }
    }

    const mockAssetUrl = `asset://localhost/path/to/media/${mockMediaId}.bin`
    
    vi.mocked(mediaUrlService.getMediaUrl).mockResolvedValue(mockAssetUrl)
    vi.mocked(mockFileStorage.getMedia).mockResolvedValue(mockMediaData)

    const media = await mediaService.getMedia(mockMediaId)
    
    expect(media).toBeDefined()
    expect(media?.url).toBe(mockAssetUrl)
    expect(media?.url).toMatch(/^asset:\/\//)
    expect(media?.url).not.toMatch(/^blob:/)
    
    // Verify mediaUrlService was called with correct parameters
    expect(mediaUrlService.getMediaUrl).toHaveBeenCalledWith(mockProjectId, mockMediaId)
  })

  it('should return asset protocol URLs for audio files', async () => {
    const mockMediaData = {
      id: mockMediaId,
      data: new ArrayBuffer(4),
      mediaType: 'audio',
      metadata: {
        type: 'audio',
        mime_type: 'audio/mpeg',
        original_name: 'test.mp3'
      }
    }

    const mockAssetUrl = `asset://localhost/path/to/media/${mockMediaId}.bin`
    
    vi.mocked(mediaUrlService.getMediaUrl).mockResolvedValue(mockAssetUrl)
    vi.mocked(mockFileStorage.getMedia).mockResolvedValue(mockMediaData)

    const media = await mediaService.getMedia(mockMediaId)
    
    expect(media).toBeDefined()
    expect(media?.url).toBe(mockAssetUrl)
    expect(media?.url).toMatch(/^asset:\/\//)
    expect(media?.url).not.toMatch(/^blob:/)
  })

  it('should return asset protocol URLs for video files', async () => {
    const mockMediaData = {
      id: mockMediaId,
      data: new ArrayBuffer(4),
      mediaType: 'video',
      metadata: {
        type: 'video',
        mime_type: 'video/mp4',
        original_name: 'test.mp4'
      }
    }

    const mockAssetUrl = `asset://localhost/path/to/media/${mockMediaId}.bin`
    
    vi.mocked(mediaUrlService.getMediaUrl).mockResolvedValue(mockAssetUrl)
    vi.mocked(mockFileStorage.getMedia).mockResolvedValue(mockMediaData)

    const media = await mediaService.getMedia(mockMediaId)
    
    expect(media).toBeDefined()
    expect(media?.url).toBe(mockAssetUrl)
    expect(media?.url).toMatch(/^asset:\/\//)
    expect(media?.url).not.toMatch(/^blob:/)
  })

  it('should handle YouTube URLs directly without creating blob URLs', async () => {
    const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const mockMediaData = {
      id: mockMediaId,
      data: new ArrayBuffer(youtubeUrl.length),
      mediaType: 'video',
      metadata: {
        type: 'youtube',
        source: 'youtube',
        embedUrl: youtubeUrl,
        isYouTube: true
      }
    }

    vi.mocked(mockFileStorage.getMedia).mockResolvedValue(mockMediaData)

    const media = await mediaService.getMedia(mockMediaId)
    
    expect(media).toBeDefined()
    expect(media?.url).toBe(youtubeUrl)
    expect(media?.url).not.toMatch(/^blob:/)
    expect(media?.url).not.toMatch(/^asset:/)
    
    // YouTube URLs should not use mediaUrlService
    expect(mediaUrlService.getMediaUrl).not.toHaveBeenCalled()
  })

  it('should return data URLs for SVG files', async () => {
    const svgContent = '<svg><circle cx="50" cy="50" r="40"/></svg>'
    const encoder = new TextEncoder()
    const svgBytes = encoder.encode(svgContent)
    const mockMediaData = {
      id: mockMediaId,
      data: svgBytes.buffer,
      mediaType: 'image',
      metadata: {
        type: 'image',
        mime_type: 'image/svg+xml',
        original_name: 'test.svg'
      }
    }

    const dataUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`
    
    vi.mocked(mediaUrlService.getMediaUrl).mockResolvedValue(dataUrl)
    vi.mocked(mockFileStorage.getMedia).mockResolvedValue(mockMediaData)

    const media = await mediaService.getMedia(mockMediaId)
    
    expect(media).toBeDefined()
    expect(media?.url).toBe(dataUrl)
    expect(media?.url).toMatch(/^data:image\/svg\+xml/)
    expect(media?.url).not.toMatch(/^blob:/)
  })

  it('should not create any blob URLs in getAllMedia', async () => {
    // First, store some media in the cache
    const media1Data = {
      id: 'media-1',
      data: new ArrayBuffer(3),
      mediaType: 'image',
      metadata: { type: 'image', mime_type: 'image/png' }
    }
    const media2Data = {
      id: 'media-2',
      data: new ArrayBuffer(3),
      mediaType: 'audio',
      metadata: { type: 'audio', mime_type: 'audio/mpeg' }
    }

    // Mock the FileStorage responses
    vi.mocked(mockFileStorage.getMedia)
      .mockResolvedValueOnce(media1Data)
      .mockResolvedValueOnce(media2Data)
    
    // Mock asset URLs for each media
    vi.mocked(mediaUrlService.getMediaUrl)
      .mockResolvedValueOnce(`asset://localhost/media/media-1.bin`)
      .mockResolvedValueOnce(`asset://localhost/media/media-2.bin`)
      .mockResolvedValueOnce(`asset://localhost/media/media-1.bin`)
      .mockResolvedValueOnce(`asset://localhost/media/media-2.bin`)

    // Get media to populate the cache
    await mediaService.getMedia('media-1')
    await mediaService.getMedia('media-2')

    const allMedia = await mediaService.getAllMedia()
    
    expect(allMedia).toHaveLength(2)
    allMedia.forEach(media => {
      expect(media.url).toMatch(/^asset:\/\//)
      expect(media.url).not.toMatch(/^blob:/)
    })
    
    // Verify mediaUrlService was called for each media item
    // Note: called 4 times total - 2 during getMedia, 2 during getAllMedia
    expect(mediaUrlService.getMediaUrl).toHaveBeenCalledTimes(4)
  })

  it('should not register blob URLs with BlobURLManager', async () => {
    const mockMediaData = {
      id: mockMediaId,
      data: new ArrayBuffer(4),
      mediaType: 'image',
      metadata: {
        type: 'image',
        mime_type: 'image/png',
        original_name: 'test.png'
      }
    }

    const mockAssetUrl = `asset://localhost/path/to/media/${mockMediaId}.bin`
    
    vi.mocked(mediaUrlService.getMediaUrl).mockResolvedValue(mockAssetUrl)
    vi.mocked(mockFileStorage.getMedia).mockResolvedValue(mockMediaData)

    // Spy on URL.createObjectURL to ensure it's never called
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL')

    const media = await mediaService.getMedia(mockMediaId)
    
    expect(media).toBeDefined()
    expect(createObjectURLSpy).not.toHaveBeenCalled()
    
    createObjectURLSpy.mockRestore()
  })
})