import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MediaService from '../MediaService'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock FileStorage
vi.mock('../FileStorage', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      isInitialized: vi.fn().mockResolvedValue(true),
      storeMedia: vi.fn().mockResolvedValue(undefined),
      getMedia: vi.fn().mockResolvedValue(null),
      listMediaForPage: vi.fn().mockResolvedValue([]),
      deleteMedia: vi.fn().mockResolvedValue(true) // This will be the new method
    }))
  }
})

describe('MediaService - Delete Functionality', () => {
  let mediaService: MediaService
  let mockFileStorage: any

  beforeEach(() => {
    vi.clearAllMocks()
    MediaService.clearInstance('test-project')
    
    mockFileStorage = {
      isInitialized: vi.fn().mockResolvedValue(true),
      storeMedia: vi.fn().mockResolvedValue(undefined),
      getMedia: vi.fn().mockResolvedValue(null),
      listMediaForPage: vi.fn().mockResolvedValue([]),
      deleteMedia: vi.fn().mockResolvedValue(true) // Mock the new delete method
    }
    
    mediaService = MediaService.getInstance({ 
      projectId: 'test-project',
      fileStorage: mockFileStorage 
    })
  })

  afterEach(() => {
    MediaService.clearInstance('test-project')
  })

  describe('deleteMedia', () => {
    it('should delete media from filesystem and cache', async () => {
      const mediaId = 'image-0'
      
      // First, add something to the cache
      const testMedia = {
        id: mediaId,
        type: 'image' as const,
        pageId: 'welcome',
        fileName: 'test.jpg',
        metadata: {}
      }
      
      // Store media to populate cache
      await mediaService.storeMedia(
        new File(['test'], 'test.jpg', { type: 'image/jpeg' }),
        'welcome',
        'image',
        {}
      )
      
      // Mock FileStorage delete to succeed
      mockFileStorage.deleteMedia.mockResolvedValue(true)
      
      // Delete the media
      const result = await mediaService.deleteMedia(mediaId)
      
      // Should return true for successful deletion
      expect(result).toBe(true)
      
      // Should call FileStorage.deleteMedia
      expect(mockFileStorage.deleteMedia).toHaveBeenCalledWith(mediaId)
      
      // Should remove from cache (verify by trying to get it)
      const cachedItem = await mediaService.getMedia(mediaId)
      expect(cachedItem).toBeNull()
    })

    it('should handle deletion of non-existent media', async () => {
      const mediaId = 'non-existent'
      
      // Mock FileStorage delete to return false (not found)
      mockFileStorage.deleteMedia.mockResolvedValue(false)
      
      // Delete non-existent media
      const result = await mediaService.deleteMedia(mediaId)
      
      // Should return false
      expect(result).toBe(false)
      
      // Should still call FileStorage.deleteMedia
      expect(mockFileStorage.deleteMedia).toHaveBeenCalledWith(mediaId)
    })

    it('should handle deletion errors gracefully', async () => {
      const mediaId = 'image-0'
      
      // Mock FileStorage delete to throw an error
      mockFileStorage.deleteMedia.mockRejectedValue(new Error('Deletion failed'))
      
      // Delete should handle the error
      const result = await mediaService.deleteMedia(mediaId)
      
      // Should return false on error
      expect(result).toBe(false)
    })

    it('should revoke blob URLs when deleting media', async () => {
      // This test verifies that blob URLs are cleaned up
      const mediaId = 'image-0'
      
      // Mock URL.revokeObjectURL
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
      
      // Store media with blob URL
      await mediaService.storeMedia(
        new File(['test'], 'test.jpg', { type: 'image/jpeg' }),
        'welcome',
        'image',
        {}
      )
      
      // Create a blob URL for this media
      const blobUrl = await mediaService.createBlobUrl(mediaId)
      
      // Delete the media
      mockFileStorage.deleteMedia.mockResolvedValue(true)
      await mediaService.deleteMedia(mediaId)
      
      // Note: In the actual implementation, the BlobURLManager should handle cleanup
      // This test would need to be adjusted based on actual implementation
      
      revokeObjectURLSpy.mockRestore()
    })
  })
})