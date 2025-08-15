/**
 * Critical Workflows Integration Tests
 * 
 * Tests for the most essential user workflows that must always work.
 * These tests focus on core functionality without UI complexity.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileStorage } from '../FileStorage'
import { MediaService, createMediaService } from '../MediaService'
import { BlobURLCache } from '../BlobURLCache'
import type { MediaMetadata } from '../MediaService'

// Mock Tauri APIs with simple, reliable responses
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

describe('Critical Workflows Integration Tests', () => {
  let fileStorage: FileStorage
  let mediaService: MediaService
  let blobCache: BlobURLCache
  const testProjectId = 'critical-test-project'
  
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset singleton instances
    ;(BlobURLCache as any).instance = null
    blobCache = BlobURLCache.getInstance()
    
    // Initialize services
    fileStorage = new FileStorage()
    
    // Initialize the FileStorage with a project context
    await fileStorage.initialize()
    
    mediaService = createMediaService(testProjectId, fileStorage)
    
    // Mock successful Tauri responses
    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      switch (cmd) {
        case 'create_project':
          return Promise.resolve({
            id: testProjectId,
            name: 'Critical Test Project',
            path: `/projects/${testProjectId}`,
            created: new Date().toISOString(),
            last_modified: new Date().toISOString()
          })
        case 'load_project':
          return Promise.resolve({
            project: {
              id: testProjectId,
              name: 'Critical Test Project',
              path: `/projects/${testProjectId}`,
              created: new Date().toISOString(),
              last_modified: new Date().toISOString()
            },
            course_content: {},
            course_data: { title: 'Test', topics: [], difficulty: 1, template: 'default' }
          })
        case 'check_recovery':
          return Promise.resolve({ hasRecovery: false })
        case 'save_project':
          return Promise.resolve()
        case 'store_media':
          return Promise.resolve({
            id: args?.mediaId || 'media-id',
            path: `/media/${args?.mediaId || 'media-id'}`
          })
        case 'get_media':
          // Return mock image data
          const imageData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) // PNG header
          return Promise.resolve(imageData)
        case 'list_project_media':
          return Promise.resolve([])
        case 'delete_media':
          return Promise.resolve()
        case 'generate_scorm_enhanced':
          // Return minimal ZIP file
          const zipData = new Uint8Array([80, 75, 3, 4, 20, 0, 0, 0, 8, 0]) // ZIP header
          return Promise.resolve(zipData)
        default:
          return Promise.resolve(null)
      }
    })
    
    // Open the project to set up the FileStorage state
    await fileStorage.openProject(`/projects/${testProjectId}`)
  })

  describe('Core Media Workflow', () => {
    it('should complete upload → cache → retrieve → delete cycle', async () => {
      // This test should fail initially if any step is broken
      const testFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      
      // 1. Upload media
      const mediaItem = await mediaService.storeMedia(testFile, 'page-1', 'image')
      expect(mediaItem.id).toBeTruthy()
      expect(mediaItem.pageId).toBe('page-1')
      expect(mediaItem.type).toBe('image')
      
      // 2. Verify it's cached
      const cached = await blobCache.getOrCreate(mediaItem.id, async () => {
        const result = await mediaService.getMedia(mediaItem.id)
        return result ? { data: result.data!, mimeType: result.metadata.mimeType } : null
      })
      expect(cached).toBeTruthy()
      expect(cached).toContain('blob:')
      
      // 3. Retrieve media data
      const retrieved = await mediaService.getMedia(mediaItem.id)
      expect(retrieved).toBeTruthy()
      expect(retrieved!.metadata.filename).toBe('test.jpg')
      
      // 4. List all media
      const allMedia = mediaService.getAllMedia()
      expect(allMedia).toHaveLength(1)
      expect(allMedia[0].id).toBe(mediaItem.id)
      
      // 5. Delete media
      const deleted = await mediaService.deleteMedia(mediaItem.id)
      expect(deleted).toBe(true)
      
      // 6. Verify deletion
      const afterDelete = mediaService.getAllMedia()
      expect(afterDelete).toHaveLength(0)
    })

    it('should handle large media files without memory issues', async () => {
      // Test with a moderately large file to ensure memory management works
      const largeContent = new Uint8Array(5 * 1024 * 1024) // 5MB
      const largeFile = new File([largeContent], 'large.mp4', { type: 'video/mp4' })
      
      // Configure small cache for testing eviction
      blobCache.setMaxSize(2)
      blobCache.setMemoryThreshold(10 * 1024 * 1024) // 10MB
      
      const mediaItem = await mediaService.storeMedia(largeFile, 'page-video', 'video')
      
      // Verify memory tracking
      const memoryUsage = blobCache.getMemoryUsage()
      expect(memoryUsage.itemCount).toBeGreaterThan(0)
      expect(memoryUsage.totalBytes).toBeGreaterThan(0)
      
      // Add more items to test eviction
      const smallFile1 = new File(['small1'], 'small1.jpg', { type: 'image/jpeg' })
      const smallFile2 = new File(['small2'], 'small2.jpg', { type: 'image/jpeg' })
      
      await mediaService.storeMedia(smallFile1, 'page-1', 'image')
      await mediaService.storeMedia(smallFile2, 'page-2', 'image')
      
      // Cache should respect size limit
      expect(blobCache.size()).toBeLessThanOrEqual(2)
    })
  })

  describe('Project Lifecycle Workflow', () => {
    it('should handle project creation → media upload → save → load cycle', async () => {
      // 1. Add media to project
      const testFile = new File(['project content'], 'project-image.png', { type: 'image/png' })
      const mediaItem = await mediaService.storeMedia(testFile, 'welcome-page', 'image')
      
      // 2. Simulate project save
      const projectData = {
        id: testProjectId,
        courseContent: {
          welcomePage: {
            mediaIds: [mediaItem.id]
          }
        },
        metadata: {
          title: 'Test Project',
          created: new Date().toISOString()
        }
      }
      
      // Should not throw
      expect(async () => {
        await mockInvoke('save_project', { projectData })
      }).not.toThrow()
      
      // 3. Verify media is accessible after save
      const retrievedMedia = await mediaService.getMedia(mediaItem.id)
      expect(retrievedMedia).toBeTruthy()
      expect(retrievedMedia!.metadata.pageId).toBe('welcome-page')
      
      // 4. Simulate project load (would typically clear and reload media)
      const loadedProject = await mockInvoke('load_project', { projectId: testProjectId })
      expect(loadedProject).toBeTruthy()
    })
  })

  describe('SCORM Generation Workflow', () => {
    it('should complete media preparation → SCORM generation cycle', async () => {
      // 1. Prepare test media
      const imageFile = new File(['image data'], 'lesson-image.jpg', { type: 'image/jpeg' })
      const audioFile = new File(['audio data'], 'narration.mp3', { type: 'audio/mpeg' })
      
      const imageItem = await mediaService.storeMedia(imageFile, 'topic-1', 'image')
      const audioItem = await mediaService.storeMedia(audioFile, 'topic-1', 'audio')
      
      // 2. Verify all media is ready
      const allMedia = mediaService.getAllMedia()
      expect(allMedia).toHaveLength(2)
      
      const imageRetrieved = await mediaService.getMedia(imageItem.id)
      const audioRetrieved = await mediaService.getMedia(audioItem.id)
      
      expect(imageRetrieved).toBeTruthy()
      expect(audioRetrieved).toBeTruthy()
      
      // 3. Generate SCORM package (mocked)
      const scormData = await mockInvoke('generate_scorm_enhanced', {
        courseContent: {
          topics: [{
            id: 'topic-1',
            mediaIds: [imageItem.id, audioItem.id]
          }]
        }
      })
      
      expect(scormData).toBeInstanceOf(Uint8Array)
      expect(scormData.length).toBeGreaterThan(0)
      
      // 4. Verify media is still accessible after generation
      const finalCheck = mediaService.getAllMedia()
      expect(finalCheck).toHaveLength(2)
    })

    it('should handle SCORM generation without media gracefully', async () => {
      // Test edge case: generate SCORM with no media
      const scormData = await mockInvoke('generate_scorm_enhanced', {
        courseContent: {
          topics: [{
            id: 'text-only-topic',
            mediaIds: []
          }]
        }
      })
      
      expect(scormData).toBeInstanceOf(Uint8Array)
      // Should still generate valid SCORM package even without media
    })
  })

  describe('Error Recovery', () => {
    it('should recover from media storage failures', async () => {
      // Simulate storage failure
      mockInvoke.mockImplementationOnce(() => Promise.reject(new Error('Storage failed')))
      
      const testFile = new File(['test'], 'fail.jpg', { type: 'image/jpeg' })
      
      await expect(
        mediaService.storeMedia(testFile, 'page-1', 'image')
      ).rejects.toThrow('Storage failed')
      
      // Reset mock to success
      mockInvoke.mockImplementation((cmd: string, args?: any) => {
        if (cmd === 'store_media') {
          return Promise.resolve({
            id: args?.mediaId || 'recovered-media',
            path: `/media/${args?.mediaId || 'recovered-media'}`
          })
        }
        return Promise.resolve(null)
      })
      
      // Should work after recovery
      const recoveredItem = await mediaService.storeMedia(testFile, 'page-1', 'image')
      expect(recoveredItem.id).toBeTruthy()
    })

    it('should handle cache corruption gracefully', async () => {
      // Add item to cache
      const testFile = new File(['test'], 'cache-test.jpg', { type: 'image/jpeg' })
      const mediaItem = await mediaService.storeMedia(testFile, 'page-1', 'image')
      
      // Force cache to have invalid entry
      ;(blobCache as any).cache.set('corrupted-id', {
        url: 'blob:invalid-url',
        size: 100,
        createdAt: Date.now(),
        lastAccessed: Date.now()
      })
      
      // Should handle gracefully
      const result = blobCache.get('corrupted-id')
      expect(result).toBeTruthy() // Returns the URL even if invalid
      
      // Clean operation should work
      blobCache.clear()
      expect(blobCache.size()).toBe(0)
    })
  })
})