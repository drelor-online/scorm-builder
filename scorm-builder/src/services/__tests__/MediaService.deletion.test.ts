import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaService } from '../MediaService'
import { BlobURLManager } from '../../utils/BlobUrlManager'

// Mock Tauri's invoke function
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

// Mock FileStorage
vi.mock('../FileStorage', () => ({
  FileStorage: vi.fn().mockImplementation(() => ({
    deleteMedia: vi.fn(),
    getContent: vi.fn(),
    listMedia: vi.fn(),
    getMedia: vi.fn(),
    storeMedia: vi.fn()
  }))
}))

// Create mock BlobURLManager instance
const mockBlobManager = {
  createObjectURL: vi.fn((blob: Blob) => `blob:test-url-${Date.now()}`),
  revokeObjectURL: vi.fn(),
  revokeAllForTopic: vi.fn(),
  revokeAll: vi.fn()
}

// Mock BlobURLManager
vi.mock('../../utils/BlobUrlManager', () => ({
  BlobURLManager: {
    getInstance: vi.fn(() => mockBlobManager)
  }
}))

describe('MediaService - Media Deletion', () => {
  let mediaService: MediaService
  let mockFileStorage: any
  const testProjectId = 'project-456'
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock FileStorage instance
    mockFileStorage = {
      deleteMedia: vi.fn(),
      getContent: vi.fn(),
      listMedia: vi.fn(),
      getMedia: vi.fn(),
      storeMedia: vi.fn()
    }
    
    // Create MediaService with mocked FileStorage
    mediaService = new MediaService({ 
      projectId: testProjectId,
      fileStorage: mockFileStorage 
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('deleteMedia', () => {
    it('should delete a single media item by ID', async () => {
      const mediaId = 'media-123'
      const projectId = 'project-456'
      
      mockFileStorage.deleteMedia.mockResolvedValue(true)
      
      await mediaService.deleteMedia(projectId, mediaId)
      
      expect(mockFileStorage.deleteMedia).toHaveBeenCalledWith(mediaId)
    })

    it('should revoke blob URL when deleting media', async () => {
      const mediaId = 'media-123'
      const projectId = 'project-456'
      
      mockFileStorage.deleteMedia.mockResolvedValue(true)
      
      // Delete media
      await mediaService.deleteMedia(projectId, mediaId)
      
      // Should revoke the blob URL
      expect(mockBlobManager.revokeObjectURL).toHaveBeenCalledWith(mediaId)
    })

    it('should handle deletion of non-existent media gracefully', async () => {
      const mediaId = 'non-existent'
      const projectId = 'project-456'
      
      mockFileStorage.deleteMedia.mockResolvedValue(false)
      
      const result = await mediaService.deleteMedia(projectId, mediaId)
      
      expect(result).toBe(false)
    })
  })

  describe('deleteMediaForTopic', () => {
    it('should delete all media for a specific topic', async () => {
      const topicId = 'topic-789'
      const projectId = 'project-456'
      
      // Mock list media to return items for the topic
      mockFileStorage.listMedia.mockResolvedValue([
        { id: 'media-1', topicId, type: 'image' },
        { id: 'media-2', topicId, type: 'video' },
        { id: 'media-3', topicId, type: 'youtube' }
      ])
      
      mockFileStorage.deleteMedia.mockResolvedValue(true)
      
      await mediaService.deleteMediaForTopic(projectId, topicId)
      
      // Should delete each media item
      expect(mockFileStorage.deleteMedia).toHaveBeenCalledWith('media-1')
      expect(mockFileStorage.deleteMedia).toHaveBeenCalledWith('media-2')
      expect(mockFileStorage.deleteMedia).toHaveBeenCalledWith('media-3')
    })

    it('should revoke all blob URLs for the topic', async () => {
      const topicId = 'topic-789'
      const projectId = 'project-456'
      
      mockFileStorage.listMedia.mockResolvedValue([
        { id: 'media-1', topicId, type: 'image' }
      ])
      mockFileStorage.deleteMedia.mockResolvedValue(true)
      
      await mediaService.deleteMediaForTopic(projectId, topicId)
      
      // Should revoke all URLs for the topic
      expect(mockBlobManager.revokeAllForTopic).toHaveBeenCalledWith(topicId)
    })

    it('should handle empty topic gracefully', async () => {
      const topicId = 'empty-topic'
      const projectId = 'project-456'
      
      mockFileStorage.listMedia.mockResolvedValue([])
      
      await mediaService.deleteMediaForTopic(projectId, topicId)
      
      // Should not call deleteMedia
      expect(mockFileStorage.deleteMedia).not.toHaveBeenCalled()
    })
  })

  describe('deleteAllMedia', () => {
    it('should delete all media in a project', async () => {
      const projectId = 'project-456'
      
      mockFileStorage.listMedia.mockResolvedValue([
        { id: 'media-1', type: 'image' },
        { id: 'media-2', type: 'video' },
        { id: 'media-3', type: 'audio' }
      ])
      mockFileStorage.deleteMedia.mockResolvedValue(true)
      
      await mediaService.deleteAllMedia(projectId)
      
      // Should delete each item
      expect(mockFileStorage.deleteMedia).toHaveBeenCalledWith('media-1')
      expect(mockFileStorage.deleteMedia).toHaveBeenCalledWith('media-2')
      expect(mockFileStorage.deleteMedia).toHaveBeenCalledWith('media-3')
    })

    it('should revoke all blob URLs when deleting all media', async () => {
      const projectId = 'project-456'
      
      mockFileStorage.listMedia.mockResolvedValue([
        { id: 'media-1', type: 'image' }
      ])
      mockFileStorage.deleteMedia.mockResolvedValue(true)
      
      await mediaService.deleteAllMedia(projectId)
      
      // Should revoke all URLs
      expect(mockBlobManager.revokeAll).toHaveBeenCalled()
    })

    it('should handle project with no media', async () => {
      const projectId = 'empty-project'
      
      mockFileStorage.listMedia.mockResolvedValue([])
      
      await mediaService.deleteAllMedia(projectId)
      
      // Should not call deleteMedia
      expect(mockFileStorage.deleteMedia).not.toHaveBeenCalled()
      
      // Should still revoke all URLs as cleanup
      expect(mockBlobManager.revokeAll).toHaveBeenCalled()
    })
  })

  describe('Bulk deletion operations', () => {
    it('should handle bulk deletion with mixed media types', async () => {
      const projectId = 'project-456'
      const mediaIds = ['media-1', 'media-2', 'media-3']
      
      mockFileStorage.deleteMedia.mockResolvedValue(true)
      
      await mediaService.bulkDeleteMedia(projectId, mediaIds)
      
      // Should delete each item
      for (const mediaId of mediaIds) {
        expect(mockFileStorage.deleteMedia).toHaveBeenCalledWith(mediaId)
      }
    })

    it('should continue deletion even if some items fail', async () => {
      const projectId = 'project-456'
      const mediaIds = ['media-1', 'media-2', 'media-3']
      
      mockFileStorage.deleteMedia.mockImplementation((mediaId) => {
        if (mediaId === 'media-2') {
          return Promise.resolve(false)
        }
        return Promise.resolve(true)
      })
      
      const results = await mediaService.bulkDeleteMedia(projectId, mediaIds)
      
      // Should have attempted all deletions
      expect(mockFileStorage.deleteMedia).toHaveBeenCalledTimes(3)
      
      // Should return results indicating which succeeded/failed
      expect(results).toEqual({
        succeeded: ['media-1', 'media-3'],
        failed: [{
          id: 'media-2',
          error: 'Failed to delete'
        }]
      })
    })

    it('should batch large deletion operations', async () => {
      const projectId = 'project-456'
      // Create 100 media IDs
      const mediaIds = Array.from({ length: 100 }, (_, i) => `media-${i}`)
      
      mockFileStorage.deleteMedia.mockResolvedValue(true)
      
      await mediaService.bulkDeleteMedia(projectId, mediaIds, { batchSize: 10 })
      
      // Should process in batches
      // Verify all items were deleted
      expect(mockFileStorage.deleteMedia).toHaveBeenCalledTimes(100)
    })
  })

  describe('Cleanup and orphan detection', () => {
    it('should detect orphaned media files', async () => {
      const projectId = 'project-456'
      
      mockFileStorage.listMedia.mockResolvedValue([
        { id: 'media-1', topicId: 'topic-1', type: 'image' },
        { id: 'media-2', topicId: 'topic-2', type: 'video' },
        { id: 'orphan-1', topicId: null, type: 'image' },
        { id: 'orphan-2', topicId: 'deleted-topic', type: 'audio' }
      ])
      
      // Simulate that only topic-1 exists
      mockFileStorage.getContent.mockResolvedValue({
        topics: [{ id: 'topic-1' }]
      })
      
      const orphans = await mediaService.findOrphanedMedia(projectId)
      
      expect(orphans).toContain('orphan-1')
      expect(orphans).toContain('orphan-2')
      expect(orphans).toContain('media-2') // Topic doesn't exist
      expect(orphans).not.toContain('media-1') // Has valid topic
    })

    it('should clean up orphaned media', async () => {
      const projectId = 'project-456'
      
      mockFileStorage.listMedia.mockResolvedValue([
        { id: 'orphan-1', topicId: null, type: 'image' }
      ])
      
      mockFileStorage.getContent.mockResolvedValue({ topics: [] })
      mockFileStorage.deleteMedia.mockResolvedValue(true)
      
      const cleaned = await mediaService.cleanupOrphanedMedia(projectId)
      
      expect(mockFileStorage.deleteMedia).toHaveBeenCalledWith('orphan-1')
      expect(cleaned).toBe(1)
    })
  })
})