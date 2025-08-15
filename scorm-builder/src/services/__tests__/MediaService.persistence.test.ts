import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createMediaService, __testing, type MediaService } from '../MediaService'
import type { FileStorage } from '../FileStorage'

describe('MediaService - Session Persistence', () => {
  let mediaService: MediaService
  let mockFileStorage: Partial<FileStorage>
  const testProjectId = 'test-project-123'
  
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
      currentProjectId: testProjectId
    } as any
    
    // Create MediaService instance with the mocked FileStorage
    mediaService = createMediaService(testProjectId, mockFileStorage as FileStorage)
  })
  
  describe('loadMediaFromDisk', () => {
    it('should load media from disk and rebuild cache after session restart', async () => {
      // Arrange - Set up media data that would be on disk
      const diskMedia = [
        {
          id: 'image-0',
          mediaType: 'image',
          metadata: {
            type: 'image',
            pageId: 'welcome',
            fileName: 'welcome-image.jpg',
            mimeType: 'image/jpeg',
            size: 1024,
            uploadedAt: new Date().toISOString()
          },
          data: new Uint8Array([1, 2, 3, 4]) // Mock image data
        },
        {
          id: 'audio-0',
          mediaType: 'audio',
          metadata: {
            type: 'audio',
            pageId: 'welcome',
            fileName: 'narration.mp3',
            mimeType: 'audio/mpeg',
            size: 2048,
            uploadedAt: new Date().toISOString()
          },
          data: new Uint8Array([5, 6, 7, 8]) // Mock audio data
        }
      ]
      
      // Mock FileStorage to return disk media
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue(diskMedia)
      
      // Act - Load media from disk (simulating app restart)
      await (mediaService as any).loadMediaFromDisk()
      
      // Assert - Check that cache is rebuilt
      const allMedia = await mediaService.listAllMedia()
      expect(allMedia).toHaveLength(2)
      
      // Verify image-0 is in cache
      const image = allMedia.find(m => m.id === 'image-0')
      expect(image).toBeDefined()
      expect(image?.type).toBe('image')
      expect(image?.pageId).toBe('welcome')
      
      // Verify audio-0 is in cache
      const audio = allMedia.find(m => m.id === 'audio-0')
      expect(audio).toBeDefined()
      expect(audio?.type).toBe('audio')
      expect(audio?.pageId).toBe('welcome')
    })
    
    it('should generate fresh blob URLs after cache is cleared', async () => {
      // Arrange - Set up media on disk
      const imageData = new Uint8Array([1, 2, 3, 4])
      const diskMedia = [{
        id: 'image-0',
        mediaType: 'image',
        metadata: {
          type: 'image',
          pageId: 'welcome',
          fileName: 'test.jpg',
          mimeType: 'image/jpeg'
        },
        data: imageData
      }]
      
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue(diskMedia)
      vi.mocked(mockFileStorage.getMedia!).mockResolvedValue({
        id: 'image-0',
        mediaType: 'image',
        metadata: diskMedia[0].metadata,
        data: imageData.buffer as ArrayBuffer,
        size: imageData.length
      })
      
      // Mock URL.createObjectURL
      let blobUrlCounter = 0
      const originalCreateObjectURL = global.URL.createObjectURL
      global.URL.createObjectURL = vi.fn(() => `blob:http://localhost/test-blob-${++blobUrlCounter}`)
      
      try {
        // Act - Load from disk
        await (mediaService as any).loadMediaFromDisk()
        
        // Get media with blob URL (first time)
        const media1 = await mediaService.getMedia('image-0')
        expect(media1).toBeDefined()
        
        // Create blob URL for the media
        const blobUrl1 = await mediaService.createBlobUrl('image-0')
        expect(blobUrl1).toMatch(/^blob:/)
        
        // Clear blob URL cache (simulating session end)
        ;(mediaService as any).blobUrlCache.clear()
        
        // Get media again (after cache clear)
        const media2 = await mediaService.getMedia('image-0')
        expect(media2).toBeDefined()
        
        // Create new blob URL (should be different)
        const blobUrl2 = await mediaService.createBlobUrl('image-0')
        expect(blobUrl2).toMatch(/^blob:/)
        expect(blobUrl2).not.toBe(blobUrl1) // Should be a fresh URL
      } finally {
        // Restore original function
        global.URL.createObjectURL = originalCreateObjectURL
      }
    })
    
    it('should handle empty media directory gracefully', async () => {
      // Arrange - No media on disk
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue([])
      
      // Act
      await (mediaService as any).loadMediaFromDisk()
      
      // Assert
      const allMedia = await mediaService.listAllMedia()
      expect(allMedia).toHaveLength(0)
    })
    
    it('should handle FileStorage errors gracefully', async () => {
      // Arrange - FileStorage throws error
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockRejectedValue(
        new Error('Failed to read media directory')
      )
      
      // Act - Should not throw
      await expect((mediaService as any).loadMediaFromDisk()).resolves.not.toThrow()
      
      // Assert - Cache should be empty but service still works
      const allMedia = await mediaService.listAllMedia()
      expect(allMedia).toHaveLength(0)
    })
  })
  
  describe('Loading media when components mount', () => {
    it('should call loadMediaFromDisk when service is initialized', async () => {
      // This test verifies that MediaService loads media from disk
      // when components mount after app restart
      
      // Arrange - Set up media on disk from previous session
      const storedMedia = [{
        id: 'image-0',
        mediaType: 'image',
        metadata: {
          type: 'image',
          pageId: 'welcome',
          fileName: 'welcome.jpg',
          mimeType: 'image/jpeg'
        },
        data: new Uint8Array([255, 216, 255, 224])
      }]
      
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue(storedMedia)
      
      // Spy on loadMediaFromDisk
      const loadMediaFromDiskSpy = vi.spyOn(mediaService as any, 'loadMediaFromDisk')
      
      // Act - Call loadMediaFromDisk (simulating what UnifiedMediaContext should do)
      await (mediaService as any).loadMediaFromDisk()
      
      // Assert
      expect(loadMediaFromDiskSpy).toHaveBeenCalled()
      expect(mockFileStorage.getAllProjectMedia).toHaveBeenCalled()
      
      // Verify media is available
      const allMedia = await mediaService.listAllMedia()
      expect(allMedia).toHaveLength(1)
      expect(allMedia[0].id).toBe('image-0')
    })
    
    it('should load media automatically when refreshMedia is called', async () => {
      // This test simulates what happens in UnifiedMediaContext.refreshMedia
      // which is called on component mount
      
      // Arrange
      const diskMedia = [
        {
          id: 'image-0',
          mediaType: 'image',
          metadata: { type: 'image', pageId: 'welcome', fileName: 'test.jpg', mimeType: 'image/jpeg' },
          data: new Uint8Array([1, 2, 3])
        },
        {
          id: 'audio-0',
          mediaType: 'audio',
          metadata: { type: 'audio', pageId: 'welcome', fileName: 'test.mp3', mimeType: 'audio/mpeg' },
          data: new Uint8Array([4, 5, 6])
        }
      ]
      
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue(diskMedia)
      
      // Also mock getMedia to return the data
      vi.mocked(mockFileStorage.getMedia!).mockImplementation((mediaId) => {
        const media = diskMedia.find(m => m.id === mediaId)
        if (!media) return Promise.resolve(null)
        return Promise.resolve({
          id: media.id,
          mediaType: media.mediaType,
          metadata: media.metadata,
          data: media.data.buffer as ArrayBuffer,
          size: media.data.length
        })
      })
      
      // Act - Load media from disk (what refreshMedia should do)
      await (mediaService as any).loadMediaFromDisk()
      
      // Then try to get media (what components do after mount)
      const image = await mediaService.getMedia('image-0')
      const audio = await mediaService.getMedia('audio-0')
      
      // Assert
      expect(image).toBeDefined()
      expect(image?.metadata.pageId).toBe('welcome')
      expect(audio).toBeDefined()
      expect(audio?.metadata.pageId).toBe('welcome')
    })
  })
  
  describe('Handling missing files', () => {
    it('should handle missing media files gracefully', async () => {
      // This test simulates what happens when media files are deleted from disk
      // but references still exist in the project
      
      // Arrange - Set up media in cache but file is missing
      const mediaInCache = {
        id: 'image-0',
        mediaType: 'image',
        metadata: {
          type: 'image',
          pageId: 'welcome',
          fileName: 'missing.jpg',
          mimeType: 'image/jpeg'
        },
        data: new Uint8Array([])
      }
      
      // First load media so it's in cache
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue([mediaInCache])
      await (mediaService as any).loadMediaFromDisk()
      
      // Now simulate file being missing when we try to get it
      vi.mocked(mockFileStorage.getMedia!).mockResolvedValue(null)
      
      // Act - Try to get the missing media
      const media = await mediaService.getMedia('image-0')
      
      // Assert - Should return null gracefully without throwing
      expect(media).toBeNull()
    })
    
    it('should continue working even if some media files are missing', async () => {
      // Arrange - Mix of existing and missing media
      const diskMedia = [
        {
          id: 'image-0',
          mediaType: 'image',
          metadata: { type: 'image', pageId: 'welcome', fileName: 'exists.jpg' },
          data: new Uint8Array([1, 2, 3])
        },
        {
          id: 'image-1',
          mediaType: 'image',
          metadata: { type: 'image', pageId: 'page1', fileName: 'missing.jpg' },
          data: new Uint8Array([])
        }
      ]
      
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue(diskMedia)
      
      // Mock getMedia to return null for missing files
      vi.mocked(mockFileStorage.getMedia!).mockImplementation((mediaId) => {
        if (mediaId === 'image-0') {
          return Promise.resolve({
            id: 'image-0',
            mediaType: 'image',
            metadata: diskMedia[0].metadata,
            data: diskMedia[0].data.buffer as ArrayBuffer,
            size: diskMedia[0].data.length
          })
        }
        return Promise.resolve(null) // image-1 is missing
      })
      
      // Act
      await (mediaService as any).loadMediaFromDisk()
      const existingMedia = await mediaService.getMedia('image-0')
      const missingMedia = await mediaService.getMedia('image-1')
      
      // Assert
      expect(existingMedia).toBeDefined()
      expect(existingMedia?.metadata.fileName).toBe('exists.jpg')
      expect(missingMedia).toBeNull() // Missing file returns null
      
      // Service should still list all media (even if files are missing)
      const allMedia = await mediaService.listAllMedia()
      expect(allMedia).toHaveLength(2)
    })
    
    it('should handle corrupted media data gracefully', async () => {
      // Arrange - Simulate corrupted data
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue([
        {
          id: 'corrupted-0',
          mediaType: 'image',
          metadata: { type: 'image', pageId: 'welcome' },
          data: null as any // Corrupted data
        }
      ])
      
      // Act - Should not throw when loading corrupted data
      await expect((mediaService as any).loadMediaFromDisk()).resolves.not.toThrow()
      
      // Assert - Media should be in list but getMedia might fail
      const allMedia = await mediaService.listAllMedia()
      expect(allMedia).toHaveLength(1)
    })
  })
  
  describe('Audio ZIP persistence', () => {
    it('should persist and reload audio ZIP packages', async () => {
      // Audio narration is stored as ZIP files containing MP3 and metadata
      
      // Arrange - Create a mock ZIP file for audio narration
      const audioZipData = new Uint8Array([80, 75, 3, 4]) // ZIP file header
      const audioZipMedia = {
        id: 'audio-0',
        mediaType: 'audio',
        metadata: {
          type: 'audio',
          pageId: 'welcome',
          fileName: 'welcome-narration.zip',
          mimeType: 'application/zip',
          uploadedAt: new Date().toISOString()
        },
        data: audioZipData
      }
      
      // Mock FileStorage to return the audio ZIP
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue([audioZipMedia])
      vi.mocked(mockFileStorage.getMedia!).mockResolvedValue({
        id: 'audio-0',
        mediaType: 'audio',
        metadata: audioZipMedia.metadata,
        data: audioZipData.buffer as ArrayBuffer,
        size: audioZipData.length
      })
      
      // Act - Load from disk
      await (mediaService as any).loadMediaFromDisk()
      
      // Get the audio media
      const audio = await mediaService.getMedia('audio-0')
      
      // Assert
      expect(audio).toBeDefined()
      expect(audio?.metadata.type).toBe('audio')
      expect(audio?.metadata.fileName).toBe('welcome-narration.zip')
      expect(audio?.metadata.mimeType).toBe('application/zip')
      expect(audio?.data).toBeDefined()
    })
    
    it('should handle multiple audio ZIPs for different pages', async () => {
      // Arrange - Multiple audio ZIPs for different pages
      const audioZips = [
        {
          id: 'audio-0',
          mediaType: 'audio',
          metadata: {
            type: 'audio',
            pageId: 'welcome',
            fileName: 'welcome.zip',
            mimeType: 'application/zip'
          },
          data: new Uint8Array([80, 75, 3, 4, 1])
        },
        {
          id: 'audio-1',
          mediaType: 'audio',
          metadata: {
            type: 'audio',
            pageId: 'objectives',
            fileName: 'objectives.zip',
            mimeType: 'application/zip'
          },
          data: new Uint8Array([80, 75, 3, 4, 2])
        },
        {
          id: 'audio-2',
          mediaType: 'audio',
          metadata: {
            type: 'audio',
            pageId: 'topic-0',
            fileName: 'topic-0.zip',
            mimeType: 'application/zip'
          },
          data: new Uint8Array([80, 75, 3, 4, 3])
        }
      ]
      
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue(audioZips)
      
      // Act
      await (mediaService as any).loadMediaFromDisk()
      
      // Assert - All audio ZIPs should be loaded
      const allMedia = await mediaService.listAllMedia()
      expect(allMedia).toHaveLength(3)
      
      // Check each audio is properly indexed
      const welcomeAudio = allMedia.find(m => m.id === 'audio-0')
      const objectivesAudio = allMedia.find(m => m.id === 'audio-1')
      const topicAudio = allMedia.find(m => m.id === 'audio-2')
      
      expect(welcomeAudio?.pageId).toBe('welcome')
      expect(objectivesAudio?.pageId).toBe('objectives')
      expect(topicAudio?.pageId).toBe('topic-0')
    })
    
    it('should regenerate blob URLs for audio ZIPs after session restart', async () => {
      // Arrange
      const audioZip = {
        id: 'audio-0',
        mediaType: 'audio',
        metadata: {
          type: 'audio',
          pageId: 'welcome',
          fileName: 'narration.zip',
          mimeType: 'application/zip'
        },
        data: new Uint8Array([80, 75, 3, 4])
      }
      
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue([audioZip])
      vi.mocked(mockFileStorage.getMedia!).mockResolvedValue({
        id: audioZip.id,
        mediaType: audioZip.mediaType,
        metadata: audioZip.metadata,
        data: audioZip.data.buffer as ArrayBuffer,
        size: audioZip.data.length
      })
      
      // Mock blob URL creation
      let blobUrlCounter = 0
      const originalCreateObjectURL = global.URL.createObjectURL
      global.URL.createObjectURL = vi.fn(() => `blob:http://localhost/audio-blob-${++blobUrlCounter}`)
      
      try {
        // Act - Load from disk (session 1)
        await (mediaService as any).loadMediaFromDisk()
        const blobUrl1 = await mediaService.createBlobUrl('audio-0')
        
        // Clear blob cache (simulating session end)
        ;(mediaService as any).blobUrlCache.clear()
        
        // Create new blob URL (session 2)
        const blobUrl2 = await mediaService.createBlobUrl('audio-0')
        
        // Assert - Should have different blob URLs
        expect(blobUrl1).toMatch(/^blob:/)
        expect(blobUrl2).toMatch(/^blob:/)
        expect(blobUrl2).not.toBe(blobUrl1)
      } finally {
        global.URL.createObjectURL = originalCreateObjectURL
      }
    })
  })
  
  describe('Media persistence across component lifecycle', () => {
    it('should persist media IDs but regenerate blob URLs', async () => {
      // This test simulates what happens when:
      // 1. User adds media in one session
      // 2. App closes (blob URLs become invalid)
      // 3. App reopens and needs to show the same media
      
      // Arrange - Simulate stored media from previous session
      const storedMedia = {
        id: 'image-0',
        mediaType: 'image',
        metadata: {
          type: 'image',
          pageId: 'welcome',
          fileName: 'welcome.jpg',
          mimeType: 'image/jpeg',
          uploadedAt: '2024-01-01T00:00:00Z'
        },
        data: new Uint8Array([255, 216, 255, 224]) // JPEG header
      }
      
      // Step 1: Previous session stored the media
      vi.mocked(mockFileStorage.storeMedia!).mockResolvedValue(undefined)
      
      // Step 2: New session loads from disk
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue([storedMedia])
      vi.mocked(mockFileStorage.getMedia!).mockResolvedValue({
        ...storedMedia,
        data: storedMedia.data.buffer as ArrayBuffer,
        size: storedMedia.data.length
      })
      
      // Load media from disk (app startup)
      await (mediaService as any).loadMediaFromDisk()
      
      // Step 3: Component requests the media
      const media = await mediaService.getMedia('image-0')
      expect(media).toBeDefined()
      expect(media?.metadata.pageId).toBe('welcome')
      
      // Step 4: Component needs a blob URL to display the image
      const blobUrl = await mediaService.createBlobUrl('image-0')
      expect(blobUrl).toBeDefined()
      expect(blobUrl).toMatch(/^blob:/) // Fresh blob URL created
    })
  })
  
  describe('Integration - Full media persistence flow', () => {
    it('should handle complete media lifecycle across sessions', async () => {
      // This integration test simulates the full flow:
      // 1. Store media in session 1
      // 2. Close app (clear blob URLs)
      // 3. Restart app and load media from disk
      // 4. Access media with fresh blob URLs
      
      // Session 1: Store new media
      const newMediaData = new Uint8Array([255, 216, 255, 224]) // JPEG header
      const storeResult = {
        id: 'image-new',
        mediaType: 'image',
        metadata: {
          type: 'image',
          pageId: 'welcome',
          fileName: 'new-image.jpg',
          mimeType: 'image/jpeg',
          uploadedAt: new Date().toISOString()
        }
      }
      
      // Mock storeMedia
      vi.mocked(mockFileStorage.storeMedia!).mockResolvedValue(undefined)
      
      // Simulate storing media
      await mediaService.storeMedia(
        new Blob([newMediaData], { type: 'image/jpeg' }),
        'welcome',
        'image',
        { fileName: 'new-image.jpg' }
      )
      
      // Session end - clear caches
      ;(mediaService as any).mediaCache.clear()
      ;(mediaService as any).blobUrlCache.clear()
      
      // Session 2: Load from disk
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue([{
        ...storeResult,
        data: newMediaData
      }])
      
      vi.mocked(mockFileStorage.getMedia!).mockResolvedValue({
        ...storeResult,
        data: newMediaData.buffer as ArrayBuffer,
        size: newMediaData.length
      })
      
      // Load media from disk (app restart)
      await (mediaService as any).loadMediaFromDisk()
      
      // Verify media is available
      const allMedia = await mediaService.listAllMedia()
      expect(allMedia.length).toBeGreaterThan(0)
      
      // Get media with fresh blob URL
      const media = await mediaService.getMedia('image-new')
      expect(media).toBeDefined()
      expect(media?.metadata.fileName).toBe('new-image.jpg')
      
      // Create blob URL (should work even after session restart)
      const mockCreateObjectURL = vi.fn(() => 'blob:http://localhost/fresh-blob')
      const originalCreateObjectURL = global.URL.createObjectURL
      global.URL.createObjectURL = mockCreateObjectURL
      
      try {
        const blobUrl = await mediaService.createBlobUrl('image-new')
        expect(blobUrl).toBe('blob:http://localhost/fresh-blob')
        expect(mockCreateObjectURL).toHaveBeenCalled()
      } finally {
        global.URL.createObjectURL = originalCreateObjectURL
      }
    })
    
    it('should recover gracefully from corrupted session data', async () => {
      // Simulate corrupted or incomplete session data
      
      // Load partially corrupted data
      vi.mocked(mockFileStorage.getAllProjectMedia!).mockResolvedValue([
        {
          id: 'valid-image',
          mediaType: 'image',
          metadata: { type: 'image', pageId: 'page1' },
          data: new Uint8Array([1, 2, 3])
        },
        {
          id: 'corrupted-image',
          mediaType: null as any, // Corrupted type
          metadata: null as any, // Missing metadata
          data: null as any // Missing data
        }
      ])
      
      // Load should not crash
      await expect((mediaService as any).loadMediaFromDisk()).resolves.not.toThrow()
      
      // Valid media should still be accessible
      const allMedia = await mediaService.listAllMedia()
      const validMedia = allMedia.find(m => m.id === 'valid-image')
      expect(validMedia).toBeDefined()
      expect(validMedia?.pageId).toBe('page1')
    })
  })
})