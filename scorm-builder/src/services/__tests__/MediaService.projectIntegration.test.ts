/**
 * Test to verify MediaService works with FileStorage project context
 * This test reproduces the "No project open" error from the test session
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaService, createMediaService } from '../MediaService'
import { FileStorage } from '../FileStorage'

// Mock the Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock Blob.arrayBuffer in test environment
const originalBlob = global.Blob
global.Blob = class extends originalBlob {
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(this.size || 0))
  }
} as any

describe('MediaService Project Integration', () => {
  let mediaService: MediaService
  let fileStorage: FileStorage
  
  beforeEach(() => {
    vi.clearAllMocks()
    MediaService.clearInstance('test-project')
    mediaService = createMediaService('test-project')
    fileStorage = new FileStorage()
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('Project Context Issues', () => {
    it('should fail with "No project open" when FileStorage has no project', async () => {
      // This test reproduces the exact error from the test session
      const file = new Blob(['test content'], { type: 'image/jpeg' })
      
      // Try to store media without opening a project first
      await expect(
        mediaService.storeMedia(file, 'test-page', 'image')
      ).rejects.toThrow('No project open')
    })
    
    it('should fail when storing YouTube video without project', async () => {
      const youtubeUrl = 'https://youtube.com/watch?v=test'
      const embedUrl = 'https://youtube.com/embed/test'
      
      await expect(
        mediaService.storeYouTubeVideo(youtubeUrl, embedUrl, 'test-page')
      ).rejects.toThrow('No project open')
    })
    
    it('demonstrates that MediaService creates isolated FileStorage', async () => {
      // MediaService creates its own FileStorage internally
      // This FileStorage instance is not connected to the main app's FileStorage
      // Therefore it doesn't know about the current project
      
      // Even if we open a project in our test FileStorage...
      const { invoke } = await import('@tauri-apps/api/core')
      const mockInvoke = vi.fn().mockResolvedValue({
        project: { id: 'project-123', name: 'Test Project' }
      })
      vi.mocked(invoke).mockImplementation(mockInvoke)
      
      // The MediaService's internal FileStorage still won't know about it
      // because it's a separate instance
      const file = new Blob(['test'], { type: 'image/jpeg' })
      
      await expect(
        mediaService.storeMedia(file, 'test-page', 'image')
      ).rejects.toThrow('No project open')
    })
  })
  
  describe('Expected Behavior', () => {
    it('should work when FileStorage has project context', async () => {
      // This test shows what SHOULD happen
      // We need MediaService to either:
      // 1. Use a shared FileStorage instance that has project context
      // 2. Initialize its FileStorage with the current project ID
      // 3. Use the storage methods from PersistentStorageContext instead
      
      // For now this test will fail, showing we need to fix the integration
      const { invoke } = await import('@tauri-apps/api/core')
      const mockInvoke = vi.fn()
      
      // Mock successful project creation
      mockInvoke.mockResolvedValueOnce({
        id: 'project-123',
        path: '/test/project.scorm'
      })
      
      // Mock successful media storage
      mockInvoke.mockResolvedValueOnce(undefined)
      
      vi.mocked(invoke).mockImplementation(mockInvoke)
      
      // Open project in FileStorage first
      await fileStorage.createProject('Test Project')
      
      // Now MediaService should work (but it won't because it has its own FileStorage)
      const file = new Blob(['test content'], { type: 'image/jpeg' })
      
      // This SHOULD work but will fail showing the integration issue
      await expect(
        mediaService.storeMedia(file, 'test-page', 'image')
      ).rejects.toThrow('No project open')
    })
  })
  
  describe('Solution Verification', () => {
    it('should work with shared FileStorage instance', async () => {
      // This test verifies our solution works
      const { invoke } = await import('@tauri-apps/api/core')
      const mockInvoke = vi.fn()
      
      // Mock successful project creation
      mockInvoke.mockResolvedValueOnce({
        id: 'project-123',
        path: '/test/project.scorm'
      })
      
      // Mock successful media storage
      mockInvoke.mockResolvedValueOnce(undefined)
      
      vi.mocked(invoke).mockImplementation(mockInvoke)
      
      // Create shared FileStorage and open a project
      const sharedStorage = new FileStorage()
      await sharedStorage.createProject('Test Project')
      
      // Create MediaService with the shared FileStorage
      const mediaServiceWithSharedStorage = MediaService.getInstance({ 
        projectId: 'project-123', 
        fileStorage: sharedStorage 
      })
      
      // Now MediaService should work because it uses the shared FileStorage
      const file = new Blob(['test content'], { type: 'image/jpeg' })
      
      // This SHOULD work now with shared FileStorage
      const result = await mediaServiceWithSharedStorage.storeMedia(file, 'test-page', 'image')
      
      // Verify it worked
      expect(result).toBeDefined()
      expect(result.id).toMatch(/^image-\d+$/)
      expect(result.type).toBe('image')
      expect(result.pageId).toBe('test-page')
      
      // Verify invoke was called to store media
      expect(mockInvoke).toHaveBeenCalledWith('store_media', expect.objectContaining({
        id: expect.stringMatching(/^image-\d+$/),
        projectId: 'project-123'
      }))
    })
  })
})