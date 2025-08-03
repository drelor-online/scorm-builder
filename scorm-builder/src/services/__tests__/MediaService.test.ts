import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaService } from '../MediaService'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core')
let idCounters: Record<string, number> = {}

vi.mock('../../utils/idGenerator', () => ({
  generateMediaId: vi.fn((type, pageId) => {
    const key = `${type}-${pageId}`
    if (!idCounters[key]) idCounters[key] = 0
    const id = `${type}-${idCounters[key]}-${pageId}`
    idCounters[key]++
    return id
  })
}))

// Mock logger to avoid console noise in tests
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('MediaService', () => {
  let service: MediaService
  const mockInvoke = vi.mocked(invoke)
  
  beforeEach(() => {
    vi.clearAllMocks()
    idCounters = {} // Reset ID counters
    service = new MediaService({ projectId: 'test-project' })
  })
  
  // Helper to create mock files with arrayBuffer method
  const createMockFile = (content: string, name: string, type: string) => {
    const encoder = new TextEncoder()
    const buffer = encoder.encode(content).buffer
    
    return {
      name,
      type,
      size: content.length,
      arrayBuffer: vi.fn().mockResolvedValue(buffer),
      slice: vi.fn(),
      stream: vi.fn(),
      text: vi.fn().mockResolvedValue(content)
    } as unknown as File
  }
  
  describe('storeMedia', () => {
    it('should store a media file and return MediaItem', async () => {
      const file = createMockFile('test content', 'test.jpg', 'image/jpeg')
      const pageId = 'welcome'
      const type = 'image'
      
      mockInvoke.mockResolvedValueOnce(undefined) // store_media returns void
      
      const result = await service.storeMedia(file, pageId, type)
      
      expect(result).toMatchObject({
        id: 'image-0-welcome',
        type: 'image',
        pageId: 'welcome',
        fileName: 'image-0-welcome.jpg',
        metadata: {
          uploadedAt: expect.any(String),
          mimeType: 'image/jpeg',
          size: 12,
          originalName: 'image-0-welcome.jpg',
          pageId: 'welcome',
          type: 'image'
        }
      })
      
      expect(mockInvoke).toHaveBeenCalledWith('store_media', {
        project_id: 'test-project',
        media_id: 'image-0-welcome',
        data: expect.any(Uint8Array),
        file_name: 'image-0-welcome.jpg',
        mime_type: 'image/jpeg'
      })
    })
    
    it('should handle blob input', async () => {
      const content = 'test content'
      const encoder = new TextEncoder()
      const buffer = encoder.encode(content).buffer
      
      const blob = {
        type: 'image/png',
        size: content.length,
        arrayBuffer: vi.fn().mockResolvedValue(buffer),
        slice: vi.fn(),
        stream: vi.fn(),
        text: vi.fn().mockResolvedValue(content)
      } as unknown as Blob
      
      const pageId = 'topic-1'
      const type = 'image'
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const result = await service.storeMedia(blob, pageId, type)
      
      expect(result.fileName).toBe('image-0-topic-1.png')
      expect(result.metadata.originalName).toBe('image-0-topic-1.png')
    })
    
    it('should include custom metadata', async () => {
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      const customMetadata = { width: 800, height: 600 }
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const result = await service.storeMedia(file, 'welcome', 'image', customMetadata)
      
      expect(result.metadata).toMatchObject(customMetadata)
    })
  })
  
  describe('getMedia', () => {
    it('should retrieve media from backend', async () => {
      const mockData = [1, 2, 3, 4, 5]
      const mockMetadata = { type: 'image', pageId: 'welcome' }
      
      mockInvoke.mockResolvedValueOnce({
        data: mockData,
        metadata: mockMetadata
      })
      
      const result = await service.getMedia('image-0-welcome')
      
      expect(result).not.toBeNull()
      expect(result!.data).toBeInstanceOf(Uint8Array)
      expect(result!.data).toEqual(new Uint8Array(mockData))
      expect(result!.metadata).toMatchObject(mockMetadata)
      
      expect(mockInvoke).toHaveBeenCalledWith('get_media', {
        project_id: 'test-project',
        media_id: 'image-0-welcome'
      })
    })
    
    it('should return null for non-existent media', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Not found'))
      
      const result = await service.getMedia('non-existent')
      
      expect(result).toBeNull()
    })
    
    it('should use cached metadata when available', async () => {
      // First store a file to populate cache
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      mockInvoke.mockResolvedValueOnce(undefined) // store_media
      
      const stored = await service.storeMedia(file, 'welcome', 'image')
      
      // Now get it - should use cached metadata
      mockInvoke.mockResolvedValueOnce({
        data: [1, 2, 3],
        metadata: null // Backend returns no metadata
      })
      
      const result = await service.getMedia(stored.id)
      
      expect(result!.metadata).toEqual(stored.metadata)
    })
  })
  
  describe('deleteMedia', () => {
    it('should delete media and update cache', async () => {
      // First store a file
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      mockInvoke.mockResolvedValueOnce(undefined) // store_media
      
      const stored = await service.storeMedia(file, 'welcome', 'image')
      
      // Now delete it
      mockInvoke.mockResolvedValueOnce(undefined) // delete_media
      
      const result = await service.deleteMedia(stored.id)
      
      expect(result).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('delete_media', {
        project_id: 'test-project',
        media_id: stored.id
      })
      
      // Verify it's removed from cache
      mockInvoke.mockResolvedValueOnce(null)
      const getResult = await service.getMedia(stored.id)
      expect(getResult).toBeNull()
    })
    
    it('should handle deletion errors gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Delete failed'))
      
      const result = await service.deleteMedia('some-id')
      
      expect(result).toBe(false)
    })
  })
  
  describe('listMediaForPage', () => {
    it('should filter media by page ID', async () => {
      const mockMediaList = [
        { id: 'image-0-welcome', fileName: 'welcome.jpg', mimeType: 'image/jpeg' },
        { id: 'audio-0-welcome', fileName: 'welcome.mp3', mimeType: 'audio/mpeg' },
        { id: 'image-0-topic-1', fileName: 'topic1.jpg', mimeType: 'image/jpeg' }
      ]
      
      mockInvoke.mockResolvedValueOnce(mockMediaList)
      
      const result = await service.listMediaForPage('welcome')
      
      expect(result).toHaveLength(2)
      expect(result[0].pageId).toBe('welcome')
      expect(result[1].pageId).toBe('welcome')
      expect(result.find(item => item.pageId === 'topic-1')).toBeUndefined()
    })
    
    it('should handle alternative page ID formats', async () => {
      const mockMediaList = [
        { id: 'image-0-objectives', fileName: 'obj.jpg', mimeType: 'image/jpeg' },
        { id: 'image-1', fileName: 'old.jpg', mimeType: 'image/jpeg' } // Old format
      ]
      
      mockInvoke.mockResolvedValueOnce(mockMediaList)
      
      const result = await service.listMediaForPage('objectives')
      
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('image-0-objectives')
    })
  })
  
  describe('storeYouTubeVideo', () => {
    it('should store YouTube reference without backend call', async () => {
      const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      const embedUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ'
      
      const result = await service.storeYouTubeVideo(
        youtubeUrl,
        embedUrl,
        'welcome',
        { thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg' }
      )
      
      expect(result).toEqual({
        id: 'video-0-welcome',
        type: 'video',
        pageId: 'welcome',
        fileName: youtubeUrl,
        metadata: expect.objectContaining({
          youtubeUrl,
          embedUrl,
          thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg',
          type: 'video',
          pageId: 'welcome'
        })
      })
      
      // Should NOT call backend
      expect(mockInvoke).not.toHaveBeenCalled()
    })
  })
  
  describe('createBlobUrl', () => {
    it('should create blob URL from media data', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5])
      mockInvoke.mockResolvedValueOnce({
        data: Array.from(mockData),
        metadata: { mimeType: 'image/jpeg' }
      })
      
      // Mock URL.createObjectURL
      const mockUrl = 'blob:http://localhost/12345'
      global.URL.createObjectURL = vi.fn().mockReturnValue(mockUrl)
      
      const result = await service.createBlobUrl('image-0-welcome')
      
      expect(result).toBe(mockUrl)
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(
        expect.any(Blob)
      )
    })
    
    it('should return null for non-existent media', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Not found'))
      
      const result = await service.createBlobUrl('non-existent')
      
      expect(result).toBeNull()
    })
  })
  
  describe('getStats', () => {
    it('should return media statistics', async () => {
      // Store some media to populate cache
      const files = [
        { file: createMockFile('1', '1.jpg', 'image/jpeg'), pageId: 'welcome', type: 'image' as const },
        { file: createMockFile('2', '2.jpg', 'image/jpeg'), pageId: 'welcome', type: 'image' as const },
        { file: createMockFile('3', '3.mp3', 'audio/mpeg'), pageId: 'welcome', type: 'audio' as const },
        { file: createMockFile('4', '4.jpg', 'image/jpeg'), pageId: 'topic-1', type: 'image' as const }
      ]
      
      mockInvoke.mockResolvedValue(undefined) // All store_media calls
      
      for (const { file, pageId, type } of files) {
        await service.storeMedia(file, pageId, type)
      }
      
      const stats = service.getStats()
      
      expect(stats).toEqual({
        totalItems: 4,
        itemsByType: {
          image: 3,
          audio: 1
        },
        itemsByPage: {
          welcome: 3,
          'topic-1': 1
        }
      })
    })
  })
  
  describe('clearCache', () => {
    it('should clear all cached data', async () => {
      // Store a file
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      mockInvoke.mockResolvedValueOnce(undefined)
      
      await service.storeMedia(file, 'welcome', 'image')
      
      // Verify cache has data
      let stats = service.getStats()
      expect(stats.totalItems).toBe(1)
      
      // Clear cache
      service.clearCache()
      
      // Verify cache is empty
      stats = service.getStats()
      expect(stats.totalItems).toBe(0)
    })
  })
})