import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaService } from '../MediaService'
import { invoke } from '@tauri-apps/api/core'
import type { MediaType } from '../../utils/idGenerator'

// Mock dependencies
vi.mock('@tauri-apps/api/core')

// Create a resetable counter for ID generation
let idCounters: Record<string, number> = {}
export const resetIdCounters = () => { idCounters = {} }

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

describe('MediaService Comprehensive Tests', () => {
  let service: MediaService
  const mockInvoke = vi.mocked(invoke)
  
  beforeEach(() => {
    vi.clearAllMocks()
    resetIdCounters() // Reset the ID generation counters
    
    service = new MediaService({ projectId: 'test-project' })
    
    // Mock File constructor if not available in test environment
    if (typeof File === 'undefined') {
      global.File = class File extends Blob {
        name: string
        constructor(bits: any[], name: string, options?: any) {
          super(bits, options)
          this.name = name
        }
      } as any
    }
  })
  
  afterEach(() => {
    // Clean up any blob URLs
    global.URL.revokeObjectURL = vi.fn()
  })
  
  // Helper to create mock files with arrayBuffer method
  const createMockFile = (content: string, name: string, type: string) => {
    const encoder = new TextEncoder()
    const buffer = encoder.encode(content).buffer
    
    // Create a real File object if available, otherwise a mock
    if (typeof File !== 'undefined') {
      const file = new File([content], name, { type })
      // Override arrayBuffer method to return synchronously in tests
      Object.defineProperty(file, 'arrayBuffer', {
        value: vi.fn().mockResolvedValue(buffer)
      })
      return file
    }
    
    // Fallback mock
    return {
      name,
      type,
      size: content.length,
      arrayBuffer: vi.fn().mockResolvedValue(buffer),
      slice: vi.fn(),
      stream: vi.fn(),
      text: vi.fn().mockResolvedValue(content),
      constructor: { name: 'File' }
    } as unknown as File
  }
  
  describe('Media Storage Operations', () => {
    describe('storeMedia', () => {
      it('should store file with proper sanitization', async () => {
        const file = createMockFile('test content', 'test.jpg', 'image/jpeg')
        mockInvoke.mockResolvedValueOnce(undefined)
        
        const result = await service.storeMedia(file, 'welcome', 'image')
        
        expect(result).toMatchObject({
          id: 'image-0-welcome',
          type: 'image',
          pageId: 'welcome',
          fileName: 'test.jpg',
          metadata: {
            uploadedAt: expect.any(String),
            mimeType: 'image/jpeg',
            size: 12,
            originalName: 'test.jpg',
            pageId: 'welcome',
            type: 'image'
          }
        })
        
        expect(mockInvoke).toHaveBeenCalledWith('store_media', {
          project_id: 'test-project',
          media_id: 'image-0-welcome',
          data: expect.any(Uint8Array),
          file_name: 'test.jpg',
          mime_type: 'image/jpeg'
        })
      })
      
      it('should handle blob input correctly', async () => {
        const content = 'blob content'
        const blob = new Blob([content], { type: 'image/png' })
        Object.assign(blob, {
          arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode(content).buffer)
        })
        
        mockInvoke.mockResolvedValueOnce(undefined)
        
        const result = await service.storeMedia(blob, 'topic-1', 'image')
        
        expect(result.fileName).toBe('image-0-topic-1.png')
        expect(result.metadata.originalName).toBe('image-0-topic-1.png')
      })
      
      it('should strip sensitive metadata', async () => {
        const file = createMockFile('test', 'test.jpg', 'image/jpeg')
        const metadata = {
          width: 800,
          height: 600,
          apiKey: 'secret-key',
          password: 'should-not-store'
        }
        
        mockInvoke.mockResolvedValueOnce(undefined)
        
        const result = await service.storeMedia(file, 'welcome', 'image', metadata)
        
        expect(result.metadata.width).toBe(800)
        expect(result.metadata.height).toBe(600)
        expect(result.metadata).not.toHaveProperty('apiKey')
        expect(result.metadata).not.toHaveProperty('password')
      })
      
      it('should reject mismatched file types', async () => {
        const file = createMockFile('audio', 'song.mp3', 'audio/mpeg')
        
        await expect(
          service.storeMedia(file, 'welcome', 'image')
        ).rejects.toThrow('File type mismatch')
      })
      
      it('should handle storage errors', async () => {
        const file = createMockFile('test', 'test.jpg', 'image/jpeg')
        mockInvoke.mockRejectedValueOnce(new Error('Storage failed'))
        
        await expect(
          service.storeMedia(file, 'welcome', 'image')
        ).rejects.toThrow('Failed to store media')
      })
    })
    
    describe('getMedia', () => {
      it('should retrieve media successfully', async () => {
        const mediaId = 'image-0-welcome'
        const mockData = [1, 2, 3, 4, 5]
        
        mockInvoke.mockResolvedValueOnce({
          data: mockData,
          metadata: {
            type: 'image',
            pageId: 'welcome',
            mimeType: 'image/jpeg'
          }
        })
        
        const result = await service.getMedia(mediaId)
        
        expect(result).not.toBeNull()
        expect(result!.data).toBeInstanceOf(Uint8Array)
        expect(result!.data).toEqual(new Uint8Array(mockData))
        expect(result!.metadata.type).toBe('image')
      })
      
      it('should use cached metadata when backend returns none', async () => {
        const file = createMockFile('test', 'test.jpg', 'image/jpeg')
        mockInvoke.mockResolvedValueOnce(undefined) // store_media
        
        const stored = await service.storeMedia(file, 'welcome', 'image')
        
        mockInvoke.mockResolvedValueOnce({
          data: [1, 2, 3],
          metadata: null
        })
        
        const result = await service.getMedia(stored.id)
        
        expect(result!.metadata).toEqual(stored.metadata)
      })
      
      it('should handle missing media gracefully', async () => {
        mockInvoke.mockRejectedValueOnce(new Error('Not found'))
        
        const result = await service.getMedia('non-existent')
        
        expect(result).toBeNull()
      })
    })
    
    describe('deleteMedia', () => {
      it('should delete media and update cache', async () => {
        const file = createMockFile('test', 'test.jpg', 'image/jpeg')
        mockInvoke.mockResolvedValueOnce(undefined) // store_media
        
        const stored = await service.storeMedia(file, 'welcome', 'image')
        
        expect(service.getStats().totalItems).toBe(1)
        
        mockInvoke.mockResolvedValueOnce(undefined) // delete_media
        
        const result = await service.deleteMedia(stored.id)
        
        expect(result).toBe(true)
        expect(service.getStats().totalItems).toBe(0)
      })
      
      it('should handle deletion errors', async () => {
        mockInvoke.mockRejectedValueOnce(new Error('Delete failed'))
        
        const result = await service.deleteMedia('some-id')
        
        expect(result).toBe(false)
      })
    })
  })
  
  describe('Media Listing Operations', () => {
    describe('listMediaForPage', () => {
      it('should filter media by page ID', async () => {
        // Mock the backend response - empty array as no actual media stored
        mockInvoke.mockResolvedValueOnce([])
        
        // First store some media to populate the cache
        const file1 = createMockFile('content1', 'welcome1.jpg', 'image/jpeg')
        const file2 = createMockFile('content2', 'welcome2.mp3', 'audio/mpeg')
        const file3 = createMockFile('content3', 'topic1.jpg', 'image/jpeg')
        
        mockInvoke.mockResolvedValue(undefined) // All store operations succeed
        
        await service.storeMedia(file1, 'welcome', 'image')
        await service.storeMedia(file2, 'welcome', 'audio') 
        await service.storeMedia(file3, 'topic-1', 'image')
        
        // Now mock the list response with the stored items
        mockInvoke.mockResolvedValueOnce([
          { id: 'image-0-welcome', fileName: 'welcome1.jpg', mimeType: 'image/jpeg' },
          { id: 'audio-0-welcome', fileName: 'welcome2.mp3', mimeType: 'audio/mpeg' },
          { id: 'image-0-topic-1', fileName: 'topic1.jpg', mimeType: 'image/jpeg' }
        ])
        
        const result = await service.listMediaForPage('welcome')
        
        expect(result).toHaveLength(2)
        expect(result.every(item => item.pageId === 'welcome')).toBe(true)
      })
      
      it('should handle empty results', async () => {
        mockInvoke.mockResolvedValueOnce([])
        
        const result = await service.listMediaForPage('empty-page')
        
        expect(result).toEqual([])
      })
      
      it('should handle listing errors', async () => {
        mockInvoke.mockRejectedValueOnce(new Error('List failed'))
        
        const result = await service.listMediaForPage('error-page')
        
        expect(result).toEqual([])
      })
    })
    
    describe('listAllMedia', () => {
      it('should list all media with proper typing', async () => {
        const mockMediaList = [
          { id: 'image-0-welcome', fileName: 'welcome.jpg', mimeType: 'image/jpeg' },
          { id: 'audio-0-objectives', fileName: 'objectives.mp3', mimeType: 'audio/mpeg' },
          { id: 'video-0-topic-0', fileName: 'topic.mp4', mimeType: 'video/mp4' }
        ]
        
        mockInvoke.mockResolvedValueOnce(mockMediaList)
        
        const result = await service.listAllMedia()
        
        expect(result).toHaveLength(3)
        expect(result[0].type).toBe('image')
        expect(result[1].type).toBe('audio')
        expect(result[2].type).toBe('video')
      })
    })
  })
  
  describe('YouTube Video Support', () => {
    it('should store YouTube video without backend call', async () => {
      const youtubeUrl = 'https://youtube.com/watch?v=test123'
      const embedUrl = 'https://youtube.com/embed/test123'
      
      const result = await service.storeYouTubeVideo(
        youtubeUrl,
        embedUrl,
        'topic-0',
        { thumbnail: 'https://img.youtube.com/vi/test123/0.jpg' }
      )
      
      expect(result).toMatchObject({
        id: 'video-0-topic-0',
        type: 'video',
        pageId: 'topic-0',
        fileName: youtubeUrl,
        metadata: {
          youtubeUrl,
          embedUrl,
          thumbnail: 'https://img.youtube.com/vi/test123/0.jpg',
          type: 'video',
          pageId: 'topic-0'
        }
      })
      
      expect(mockInvoke).not.toHaveBeenCalled()
    })
    
    it('should reject invalid YouTube URLs', async () => {
      await expect(
        service.storeYouTubeVideo(
          'javascript:alert("XSS")',
          'https://youtube.com/embed/test',
          'page'
        )
      ).rejects.toThrow('Invalid or unsafe YouTube URL')
    })
    
    it('should strip sensitive data from YouTube metadata', async () => {
      const metadata = {
        title: 'Test Video',
        apiKey: 'secret',
        description: 'Safe description'
      }
      
      const result = await service.storeYouTubeVideo(
        'https://youtube.com/watch?v=test',
        'https://youtube.com/embed/test',
        'page',
        metadata
      )
      
      expect(result.metadata.title).toBe('Test Video')
      expect(result.metadata.description).toBe('Safe description')
      expect(result.metadata).not.toHaveProperty('apiKey')
    })
  })
  
  describe('Blob URL Management', () => {
    it('should create blob URL from media', async () => {
      const mockData = [1, 2, 3, 4, 5]
      mockInvoke.mockResolvedValueOnce({
        data: mockData,
        metadata: { mimeType: 'image/jpeg' }
      })
      
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
      
      const result = await service.createBlobUrl('image-0-welcome')
      
      expect(result).toBe('blob:mock-url')
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 5,
          type: 'image/jpeg'
        })
      )
    })
    
    it('should return null for non-existent media', async () => {
      mockInvoke.mockResolvedValueOnce(null)
      
      const result = await service.createBlobUrl('non-existent')
      
      expect(result).toBeNull()
    })
  })
  
  describe('Cache Management', () => {
    it('should track statistics accurately', async () => {
      const files = [
        { content: '1', name: '1.jpg', type: 'image/jpeg', pageId: 'welcome', mediaType: 'image' as MediaType },
        { content: '2', name: '2.jpg', type: 'image/jpeg', pageId: 'welcome', mediaType: 'image' as MediaType },
        { content: '3', name: '3.mp3', type: 'audio/mpeg', pageId: 'welcome', mediaType: 'audio' as MediaType },
        { content: '4', name: '4.jpg', type: 'image/jpeg', pageId: 'topic-1', mediaType: 'image' as MediaType }
      ]
      
      for (const { content, name, type, pageId, mediaType } of files) {
        const file = createMockFile(content, name, type)
        mockInvoke.mockResolvedValueOnce(undefined)
        await service.storeMedia(file, pageId, mediaType)
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
    
    it('should clear cache completely', async () => {
      // Store some data
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      mockInvoke.mockResolvedValueOnce(undefined)
      await service.storeMedia(file, 'welcome', 'image')
      
      await service.storeYouTubeVideo(
        'https://youtube.com/watch?v=test',
        'https://youtube.com/embed/test',
        'page'
      )
      
      expect(service.getStats().totalItems).toBe(2)
      
      service.clearCache()
      
      expect(service.getStats()).toEqual({
        totalItems: 0,
        itemsByType: {},
        itemsByPage: {}
      })
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle concurrent operations', async () => {
      const promises: Promise<any>[] = []
      
      for (let i = 0; i < 5; i++) {
        const file = createMockFile(`content-${i}`, `file-${i}.jpg`, 'image/jpeg')
        mockInvoke.mockResolvedValueOnce(undefined)
        promises.push(service.storeMedia(file, `page-${i}`, 'image'))
      }
      
      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(5)
      expect(service.getStats().totalItems).toBe(5)
    })
    
    it('should handle special characters in filenames', async () => {
      const specialNames = [
        'file with spaces.jpg',
        'file-with-dashes.jpg',
        'file_with_underscores.jpg',
        'file.multiple.dots.jpg',
        'UPPERCASE.JPG'
      ]
      
      for (const name of specialNames) {
        const file = createMockFile('content', name, 'image/jpeg')
        mockInvoke.mockResolvedValueOnce(undefined)
        
        const result = await service.storeMedia(file, 'test', 'image')
        
        expect(result.fileName).toBe(name)
        expect(result.metadata.originalName).toBe(name)
      }
    })
    
    it('should handle empty files', async () => {
      const file = createMockFile('', 'empty.jpg', 'image/jpeg')
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const result = await service.storeMedia(file, 'test', 'image')
      
      expect(result.metadata.size).toBe(0)
    })
    
    it('should handle large files', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024) // 10MB
      const file = createMockFile(largeContent, 'large.jpg', 'image/jpeg')
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const result = await service.storeMedia(file, 'test', 'image')
      
      expect(result.metadata.size).toBe(largeContent.length)
    })
  })
  
  describe('Security Features', () => {
    it('should sanitize malicious filenames', async () => {
      const maliciousNames = [
        '../../../etc/passwd.jpg',
        '..\\..\\windows\\system32.jpg',
        '/etc/hosts.jpg',
        'C:\\Windows\\System32\\config.jpg'
      ]
      
      for (const name of maliciousNames) {
        const file = createMockFile('content', name, 'image/jpeg')
        mockInvoke.mockResolvedValueOnce(undefined)
        
        const result = await service.storeMedia(file, 'test', 'image')
        
        // Filename should be sanitized
        expect(result.fileName).not.toContain('..')
        expect(result.fileName).not.toMatch(/^[/\\]/)
        expect(result.fileName).not.toMatch(/^[A-Za-z]:[/\\]/)
      }
    })
    
    it('should validate external URLs', async () => {
      const dangerousUrls = [
        'http://localhost/video',
        'file:///etc/passwd',
        'javascript:alert("XSS")'
      ]
      
      for (const url of dangerousUrls) {
        await expect(
          service.storeYouTubeVideo(url, url, 'page')
        ).rejects.toThrow('Invalid or unsafe YouTube URL')
      }
    })
  })
})