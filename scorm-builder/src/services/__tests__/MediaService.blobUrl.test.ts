import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MediaService } from '../MediaService'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core')

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Mock debugLogger
vi.mock('../../utils/debugLogger', () => ({
  debugLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Mock mediaUrlService
vi.mock('../mediaUrl', () => ({
  mediaUrlService: {
    getMediaUrl: vi.fn().mockResolvedValue('asset://localhost/test-project/media/image-0.bin')
  }
}))

describe('MediaService - Blob URL Generation Bug', () => {
  let service: MediaService
  const mockInvoke = vi.mocked(invoke)
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Create service with mocked FileStorage
    service = new MediaService({ projectId: 'test-project' })
    
    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/12345')
    global.URL.revokeObjectURL = vi.fn()
  })
  
  it('should create actual blob URLs from media data, not return asset URLs', async () => {
    // This test reproduces the bug where createBlobUrl returns asset URLs instead of blob URLs
    // PageThumbnailGrid expects blob URLs for images to display properly
    
    const mockImageData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) // PNG header
    const mockMetadata = {
      type: 'image',
      pageId: 'welcome',
      mimeType: 'image/png',
      fileName: 'test.png'
    }
    
    // Mock the service's getMedia method to return data
    vi.spyOn(service, 'getMedia').mockResolvedValueOnce({
      id: 'image-0',
      type: 'image',
      pageId: 'welcome',
      fileName: 'test.png',
      data: mockImageData,
      metadata: mockMetadata,
      url: undefined
    })
    
    // Call createBlobUrl
    const result = await service.createBlobUrl('image-0')
    
    // Should return a blob URL, not an asset URL
    expect(result).toMatch(/^blob:/)
    expect(result).not.toMatch(/^asset:/)
    
    // Verify URL.createObjectURL was called with a Blob
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(
      expect.any(Blob)
    )
  })
  
  it('should handle audio files and create blob URLs with correct MIME type', async () => {
    const mockAudioData = new Uint8Array([255, 251, 144, 0]) // MP3 header
    const mockMetadata = {
      type: 'audio',
      pageId: 'welcome',
      mimeType: 'audio/mpeg',
      fileName: 'audio.mp3'
    }
    
    // Mock the service's getMedia method to return audio data
    vi.spyOn(service, 'getMedia').mockResolvedValueOnce({
      id: 'audio-0',
      type: 'audio',
      pageId: 'welcome',
      fileName: 'audio.mp3',
      data: mockAudioData,
      metadata: mockMetadata,
      url: undefined
    })
    
    const result = await service.createBlobUrl('audio-0')
    
    // Should return a blob URL, not an asset URL
    expect(result).toMatch(/^blob:/)
    
    // Verify the Blob was created with the correct MIME type
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'audio/mpeg'
      })
    )
  })
  
  it('should fallback to existing URLs when no media data is available', async () => {
    // When media has no data (e.g., YouTube videos), it's OK to return the existing URL
    const mockMetadata = {
      type: 'video',
      pageId: 'welcome',
      youtubeUrl: 'https://youtube.com/watch?v=123',
      embedUrl: 'https://youtube.com/embed/123'
    }
    
    // Mock the service's getMedia method to return no data but with a URL
    vi.spyOn(service, 'getMedia').mockResolvedValueOnce({
      id: 'video-0',
      type: 'video',
      pageId: 'welcome',
      fileName: 'video.mp4',
      data: undefined, // No data for YouTube videos
      metadata: mockMetadata,
      url: 'https://youtube.com/embed/123' // YouTube embed URL
    })
    
    const result = await service.createBlobUrl('video-0')
    
    // For YouTube videos with no data, should return the existing URL
    expect(result).toBe('https://youtube.com/embed/123')
    
    // URL.createObjectURL should NOT be called when there's no data
    expect(global.URL.createObjectURL).not.toHaveBeenCalled()
  })
})