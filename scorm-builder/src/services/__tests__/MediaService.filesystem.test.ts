import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createMediaService, __testing } from '../MediaService'
import type { FileStorage } from '../FileStorage'

describe('MediaService - File System Media Discovery', () => {
  let mediaService: any
  let mockFileStorage: Partial<FileStorage>
  
  afterEach(() => {
    // Clear singleton instances between tests
    __testing.clearInstances()
  })
  
  beforeEach(() => {
    // Create mock FileStorage with proper typing
    mockFileStorage = {
      getAllProjectMedia: vi.fn().mockResolvedValue([]),
      getMedia: vi.fn(),
      storeMedia: vi.fn(),
      deleteMedia: vi.fn(),
      isProjectOpen: vi.fn().mockReturnValue(true),
      currentProjectId: 'test-project-123'
    } as any
    
    // Create MediaService instance with the mocked FileStorage using factory function
    mediaService = createMediaService('test-project-123', mockFileStorage as FileStorage)
  })
  
  describe('listAllMedia', () => {
    it('should include media files from file system scan', async () => {
      // Arrange - Mock file system media
      const fileSystemMedia = [
        {
          id: 'media-1',
          mediaType: 'image',
          metadata: {
            type: 'image',
            pageId: 'welcome',
            fileName: 'image1.jpg',
            size: 1024
          },
          data: new ArrayBuffer(1024)
        },
        {
          id: 'media-2', 
          mediaType: 'video',
          metadata: {
            type: 'video',
            pageId: 'topic-1',
            fileName: 'video1.mp4',
            size: 2048
          },
          data: new ArrayBuffer(2048)
        }
      ]
      
      // Mock the getAllProjectMedia to return file system media
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue(fileSystemMedia)
      
      // Act - List all media
      const result = await mediaService.listAllMedia()
      
      // Assert - Should include file system media
      expect(result).toHaveLength(2)
      expect(result.some(m => m.id === 'media-1')).toBe(true)
      expect(result.some(m => m.id === 'media-2')).toBe(true)
      expect(result[0].type).toBe('image')
      expect(result[1].type).toBe('video')
    })
    
    it('should merge cached and file system media without duplicates', async () => {
      // Arrange - Directly add item to media cache
      // This simulates having items already in cache from previous operations
      const cachedItem = {
        id: 'cached-media-1',
        type: 'image' as const,
        pageId: 'welcome',
        fileName: 'cached.jpg',
        metadata: {
          type: 'image',
          pageId: 'welcome',
          fileName: 'cached.jpg',
          uploadedAt: new Date().toISOString()
        }
      }
      
      // Access private cache via reflection (for testing purposes)
      // @ts-ignore - accessing private property for test
      mediaService.mediaCache.set('cached-media-1', cachedItem)
      
      // Mock file system media including same ID
      const fileSystemMedia = [
        {
          id: 'cached-media-1', // Same as cached
          mediaType: 'image',
          metadata: {
            type: 'image',
            pageId: 'welcome',
            fileName: 'cached.jpg',
            size: 1024
          },
          data: new ArrayBuffer(1024)
        },
        {
          id: 'fs-media-2', // New from file system
          mediaType: 'video',
          metadata: {
            type: 'video',
            pageId: 'topic-1',
            fileName: 'new-video.mp4',
            size: 2048
          },
          data: new ArrayBuffer(2048)
        }
      ]
      
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue(fileSystemMedia)
      
      // Act
      const result = await mediaService.listAllMedia()
      
      // Assert - Should have no duplicates
      expect(result).toHaveLength(2)
      const ids = result.map(m => m.id)
      expect(ids).toContain('cached-media-1')
      expect(ids).toContain('fs-media-2')
      // Check for no duplicates
      expect(new Set(ids).size).toBe(ids.length)
    })
    
    it('should handle when getAllProjectMedia is not available (backwards compatibility)', async () => {
      // Arrange - Remove getAllProjectMedia method
      delete mockFileStorage.getAllProjectMedia
      
      // Add item to cache directly
      const cachedItem = {
        id: 'cached-media-1',
        type: 'image' as const,
        pageId: 'welcome',
        fileName: 'cached.jpg',
        metadata: {
          type: 'image',
          pageId: 'welcome',
          fileName: 'cached.jpg',
          uploadedAt: new Date().toISOString()
        }
      }
      
      // @ts-ignore - accessing private property for test
      mediaService.mediaCache.set('cached-media-1', cachedItem)
      
      // Act
      const result = await mediaService.listAllMedia()
      
      // Assert - Should still return cached items
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('cached-media-1')
    })
    
    it('should handle errors in getAllProjectMedia gracefully', async () => {
      // Arrange
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockRejectedValue(
        new Error('File system error')
      )
      
      // Add item to cache directly
      const cachedItem = {
        id: 'cached-media-1',
        type: 'image' as const,
        pageId: 'welcome',
        fileName: 'cached.jpg',
        metadata: {
          type: 'image',
          pageId: 'welcome',
          fileName: 'cached.jpg',
          uploadedAt: new Date().toISOString()
        }
      }
      
      // @ts-ignore - accessing private property for test
      mediaService.mediaCache.set('cached-media-1', cachedItem)
      
      // Act
      const result = await mediaService.listAllMedia()
      
      // Assert - Should still return cached items
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('cached-media-1')
    })
  })
})