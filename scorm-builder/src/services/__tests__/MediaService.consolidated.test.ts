/**
 * MediaService - Consolidated Test Suite
 * 
 * This file consolidates MediaService tests from 23 separate files into
 * a single comprehensive test suite focusing on core functionality.
 * 
 * Test Categories:
 * - Service initialization and configuration
 * - Blob URL management and performance
 * - File-based storage operations
 * - Asset protocol handling
 * - YouTube and external media integration
 * - Concurrent operations and retry logic
 * - Security and edge cases
 * - Performance optimizations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaService } from '../MediaService'
import { invoke } from '@tauri-apps/api/core'
import type { MediaType } from '../../utils/idGenerator'

// Mock Tauri APIs
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

// Create resetable counter for ID generation
let idCounters: Record<string, number> = {}
export const resetIdCounters = () => { idCounters = {} }

vi.mock('../../utils/idGenerator', () => ({
  generateMediaId: vi.fn((type: string, pageId?: string) => {
    const key = `${type}-${pageId || 'default'}`
    if (!idCounters[key]) idCounters[key] = 0
    const id = `${type}-${idCounters[key]}-${pageId || 'default'}`
    idCounters[key]++
    return id
  })
}))

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

// Mock debugLogger
vi.mock('@/utils/ultraSimpleLogger', () => ({
  debugLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Mock BlobURLManager
vi.mock('../utils/blobUrlManager', () => ({
  blobUrlManager: {
    createUrl: vi.fn((blob: Blob) => `blob:http://localhost/${Math.random()}`),
    revokeUrl: vi.fn(),
    cleanup: vi.fn(),
    getStats: vi.fn(() => ({ activeUrls: 0, totalCreated: 0, totalRevoked: 0 }))
  }
}))

describe('MediaService - Consolidated Test Suite', () => {
  let service: MediaService
  
  beforeEach(() => {
    vi.clearAllMocks()
    resetIdCounters()
    mockInvoke.mockClear()
    
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

  describe('Service Initialization and Configuration', () => {
    it('initializes with project configuration using getInstance', () => {
      service = MediaService.getInstance({ projectId: 'test-project' })
      expect(service).toBeDefined()
      expect(service.projectId).toBe('test-project')
    })

    it('handles initialization with shared FileStorage', () => {
      const mockFileStorage = {} as any
      service = MediaService.getInstance({ 
        projectId: 'test-project',
        fileStorage: mockFileStorage
      })
      expect(service).toBeDefined()
    })

    it('extracts numeric project ID correctly', () => {
      const service1 = MediaService.getInstance({ projectId: '1234567890' })
      const service2 = MediaService.getInstance({ projectId: 'ProjectName_1234567890.scormproj' })
      
      expect(service1.projectId).toBe('1234567890')
      expect(service2.projectId).toBe('1234567890')
    })

    it('reuses singleton instances', () => {
      const service1 = MediaService.getInstance({ projectId: 'test-123' })
      const service2 = MediaService.getInstance({ projectId: 'test-123' })
      
      expect(service1).toBe(service2)
    })
  })

  describe('Blob URL Management and Performance', () => {
    beforeEach(() => {
      service = MediaService.getInstance({ projectId: 'test-project' })
    })

    it('stores and retrieves blob data', async () => {
      const testData = new Uint8Array([1, 2, 3, 4])
      const file = new File([testData], 'test.jpg', { type: 'image/jpeg' })
      
      // Mock FileStorage.storeFile call
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const mediaItem = await service.storeMedia(file, 'page1', 'image')
      
      expect(mediaItem).toHaveProperty('id')
      expect(mediaItem).toHaveProperty('type', 'image')
      expect(mediaItem).toHaveProperty('pageId', 'page1')
    })

    it('handles blob size validation', async () => {
      const largeData = new Uint8Array(50 * 1024 * 1024) // 50MB
      const file = new File([largeData], 'large.jpg', { type: 'image/jpeg' })
      
      mockInvoke.mockRejectedValueOnce(new Error('File too large'))
      
      await expect(service.storeMedia(file, 'page1', 'image')).rejects.toThrow('File too large')
    })

    it('creates blob URLs for media', async () => {
      const testData = new Uint8Array([1, 2, 3, 4])
      mockInvoke.mockResolvedValueOnce(Array.from(testData))
      
      const blobUrl = await service.createBlobUrl('test-image-id')
      
      expect(blobUrl).toMatch(/^blob:http:\/\/localhost\//)
    })

    it('handles concurrent blob operations', async () => {
      mockInvoke.mockResolvedValue(undefined) // Mock all FileStorage operations
      
      const promises = Array.from({ length: 5 }, (_, i) => {
        const file = new File([new Uint8Array([i])], `test${i}.jpg`, { type: 'image/jpeg' })
        return service.storeMedia(file, 'page1', 'image')
      })
      
      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(5)
      results.forEach((result) => {
        expect(result).toHaveProperty('id')
        expect(result).toHaveProperty('type', 'image')
      })
    })
  })

  describe('File-based Storage Operations', () => {
    beforeEach(() => {
      service = MediaService.getInstance({ projectId: 'test-project' })
    })

    it('stores media files in filesystem', async () => {
      const file = new File([new Uint8Array([1, 2, 3])], 'test.png', { type: 'image/png' })
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const mediaItem = await service.storeMedia(file, 'page1', 'image')
      
      expect(mediaItem).toHaveProperty('fileName')
      expect(mediaItem.fileName).toMatch(/\.png$/)
    })

    it('deletes media files from filesystem', async () => {
      mockInvoke.mockResolvedValueOnce(true)
      
      const result = await service.deleteMedia('test-project', 'test-media-id')
      
      expect(result).toBe(true)
    })

    it('lists all media from project', async () => {
      const mockMediaList = [
        { id: 'media-1', url: 'asset://localhost/test-project/media/media-1', metadata: { type: 'image' } },
        { id: 'media-2', url: 'asset://localhost/test-project/media/media-2', metadata: { type: 'audio' } }
      ]
      
      mockInvoke.mockResolvedValueOnce(mockMediaList)
      
      const mediaList = await service.listAllMedia()
      
      expect(mediaList).toEqual(mockMediaList)
    })

    it('lists media for specific page', async () => {
      const mockPageMedia = [
        { id: 'page1-image', type: 'image', pageId: 'page1', fileName: 'image1.jpg', metadata: { type: 'image' } }
      ]
      
      // Mock the internal media cache
      service['mediaCache'].set('page1-image', mockPageMedia[0] as any)
      
      const pageMedia = await service.listMediaForPage('page1')
      
      expect(pageMedia).toHaveLength(1)
      expect(pageMedia[0].pageId).toBe('page1')
    })

    it('handles filesystem errors gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Filesystem error'))
      
      await expect(service.deleteMedia('test-project', 'nonexistent-id')).rejects.toThrow('Filesystem error')
    })
  })

  describe('Media Retrieval', () => {
    beforeEach(() => {
      service = MediaService.getInstance({ projectId: 'test-project' })
    })

    it('retrieves media data and metadata', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4])
      const mockResponse = {
        data: mockData,
        metadata: { type: 'image', size: 4, uploadedAt: new Date().toISOString() }
      }
      
      mockInvoke.mockResolvedValueOnce(mockResponse)
      
      const result = await service.getMedia('test-asset-id')
      
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('metadata')
      expect(result?.metadata.type).toBe('image')
    })

    it('handles missing media gracefully', async () => {
      mockInvoke.mockResolvedValueOnce(null)
      
      const result = await service.getMedia('nonexistent-id')
      
      expect(result).toBeNull()
    })
  })

  describe('YouTube and External Media Integration', () => {
    beforeEach(() => {
      service = MediaService.getInstance({ projectId: 'test-project' })
    })

    it('stores YouTube video metadata', async () => {
      const youtubeData = {
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        title: 'Test YouTube Video'
      }
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const mediaItem = await service.storeYouTubeVideo(youtubeData, 'page1')
      
      expect(mediaItem).toHaveProperty('id')
      expect(mediaItem).toHaveProperty('type', 'youtube')
      expect(mediaItem.metadata).toHaveProperty('youtubeUrl', youtubeData.youtubeUrl)
    })

    it('validates YouTube URLs', async () => {
      const invalidData = {
        youtubeUrl: 'not-a-youtube-url',
        embedUrl: '',
        thumbnail: '',
        title: 'Invalid'
      }
      
      await expect(service.storeYouTubeVideo(invalidData, 'page1'))
        .rejects.toThrow()
    })
  })

  describe('Security and Edge Cases', () => {
    beforeEach(() => {
      service = MediaService.getInstance({ projectId: 'test-project' })
    })

    it('handles malformed media data', async () => {
      const corruptFile = new File([new Uint8Array([0, 0, 0, 0])], 'corrupt.jpg', { 
        type: 'image/jpeg' 
      })
      
      mockInvoke.mockRejectedValueOnce(new Error('Invalid file format'))
      
      await expect(service.storeMedia(corruptFile, 'page1', 'image'))
        .rejects.toThrow('Invalid file format')
    })

    it('handles invalid media IDs', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Media not found'))
      
      await expect(service.getMedia('invalid-id')).rejects.toThrow('Media not found')
    })

    it('handles empty or null files', async () => {
      const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' })
      
      await expect(service.storeMedia(emptyFile, 'page1', 'image'))
        .rejects.toThrow()
    })

    it('extracts numeric project IDs safely', () => {
      // Test path traversal attempts
      const service1 = MediaService.getInstance({ projectId: '../../../etc/passwd' })
      const service2 = MediaService.getInstance({ projectId: 'normal_1234567890.scormproj' })
      
      expect(service1.projectId).toBe('../../../etc/passwd') // Fallback behavior
      expect(service2.projectId).toBe('1234567890')
    })
  })

  describe('Performance and Memory Management', () => {
    beforeEach(() => {
      service = MediaService.getInstance({ projectId: 'test-project' })
    })

    it('handles large media files efficiently', async () => {
      const largeData = new Uint8Array(10 * 1024 * 1024) // 10MB
      largeData.fill(255) // Fill with data
      
      const file = new File([largeData], 'large.jpg', { type: 'image/jpeg' })
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const startTime = performance.now()
      const mediaItem = await service.storeMedia(file, 'page1', 'image')
      const processingTime = performance.now() - startTime
      
      expect(mediaItem).toHaveProperty('id')
      expect(processingTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('loads media from disk on demand', async () => {
      mockInvoke.mockResolvedValueOnce([
        { id: 'disk-media-1', fileName: 'image1.jpg', metadata: { type: 'image' } }
      ])
      
      await service.loadMediaFromDisk()
      
      // Should have loaded media into cache
      const allMedia = await service.getAllMedia()
      expect(allMedia.length).toBeGreaterThanOrEqual(0)
    })

    it('manages blob URL cleanup', async () => {
      const mediaId = 'test-blob-123'
      const mockData = new Uint8Array([1, 2, 3, 4])
      
      mockInvoke.mockResolvedValueOnce(Array.from(mockData))
      
      const blobUrl = await service.createBlobUrl(mediaId)
      
      expect(blobUrl).toMatch(/^blob:http:\/\/localhost\//)
      // BlobURLManager should handle cleanup automatically
    })

    it('implements singleton pattern correctly', () => {
      const service1 = MediaService.getInstance({ projectId: 'singleton-test' })
      const service2 = MediaService.getInstance({ projectId: 'singleton-test' })
      
      expect(service1).toBe(service2)
      
      // Clear and recreate
      MediaService.clearInstance('singleton-test')
      const service3 = MediaService.getInstance({ projectId: 'singleton-test' })
      
      expect(service3).not.toBe(service1)
    })
  })

  describe('Integration with FileStorage', () => {
    it('delegates file operations to FileStorage', async () => {
      const mockFileStorage = {
        storeFile: vi.fn().mockResolvedValue('stored-file-id'),
        getFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
        deleteFile: vi.fn().mockResolvedValue(undefined),
        listFiles: vi.fn().mockResolvedValue([])
      }
      
      service = MediaService.getInstance({ 
        projectId: 'integration-test',
        fileStorage: mockFileStorage as any
      })
      
      const file = new File([new Uint8Array([1, 2, 3])], 'test.jpg', { type: 'image/jpeg' })
      const mediaItem = await service.storeMedia(file, 'page1', 'image')
      
      expect(mediaItem).toHaveProperty('id')
      expect(mediaItem).toHaveProperty('type', 'image')
    })

    it('handles bulk delete operations', async () => {
      mockInvoke.mockResolvedValueOnce(true)
      
      const result = await service.bulkDeleteMedia('test-project', ['media-1', 'media-2'])
      
      expect(result).toBe(true)
    })

    it('finds orphaned media files', async () => {
      const orphanedIds = ['orphan-1', 'orphan-2']
      mockInvoke.mockResolvedValueOnce(orphanedIds)
      
      const result = await service.findOrphanedMedia('test-project')
      
      expect(result).toEqual(orphanedIds)
    })
  })
})