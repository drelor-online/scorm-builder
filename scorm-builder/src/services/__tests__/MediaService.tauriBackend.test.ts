import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the Tauri API before importing MediaService
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}))

// Import MediaService after mocking
import { MediaService } from '../MediaService'

// Mock environment utils
vi.mock('../../utils/environment', () => ({
  hasTauriAPI: vi.fn().mockReturnValue(true),
  getStorageBackend: vi.fn().mockReturnValue('tauri')
}))

// Mock other dependencies
vi.mock('../../utils/idGenerator', () => ({
  generateMediaId: vi.fn((type, pageId) => `${type}-0-${pageId}`)
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../../utils/performanceMonitor', () => ({
  performanceMonitor: {
    measureOperation: vi.fn((name, fn) => fn())
  }
}))

describe('MediaService - Tauri Backend Integration', () => {
  let mediaService: MediaService
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear singleton instances
    MediaService.clearInstance('test-project')
    mediaService = MediaService.getInstance({ projectId: 'test-project' })
  })
  
  afterEach(() => {
    MediaService.clearInstance('test-project')
  })

  describe('Media Retrieval from Tauri Backend', () => {
    it('should properly retrieve media from Tauri backend when requested', async () => {
      const mockMediaData = {
        data: Array.from(new Uint8Array([137, 80, 78, 71])), // PNG header
        metadata: {
          mimeType: 'image/png',
          fileName: 'test.png',
          uploadedAt: '2024-01-01T00:00:00Z',
          type: 'image',
          pageId: 'welcome'
        }
      }
      
      mockInvoke.mockResolvedValueOnce(mockMediaData)
      
      const result = await mediaService.getMedia('image-0-welcome')
      
      expect(mockInvoke).toHaveBeenCalledWith('get_media', {
        project_id: 'test-project',
        media_id: 'image-0-welcome'
      })
      
      expect(result).toBeTruthy()
      expect(result?.data).toBeInstanceOf(Uint8Array)
      expect(result?.metadata.mimeType).toBe('image/png')
    })

    it('should return null when media not found in backend', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Media not found'))
      
      const result = await mediaService.getMedia('non-existent-id')
      
      expect(result).toBeNull()
    })

    it('should handle empty data from backend gracefully', async () => {
      const mockMediaData = {
        data: null,
        metadata: {}
      }
      
      mockInvoke.mockResolvedValueOnce(mockMediaData)
      
      const result = await mediaService.getMedia('image-0-welcome')
      
      expect(result).toBeNull()
    })
  })

  describe('Blob URL Creation', () => {
    it('should create valid blob URL from retrieved media data', async () => {
      const mockImageData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) // PNG header
      const mockMediaData = {
        data: Array.from(mockImageData),
        metadata: {
          mimeType: 'image/png',
          fileName: 'test.png'
        }
      }
      
      mockInvoke.mockResolvedValueOnce(mockMediaData)
      
      // Mock URL.createObjectURL
      const mockBlobUrl = 'blob:http://localhost:3000/123-456-789'
      global.URL.createObjectURL = vi.fn().mockReturnValue(mockBlobUrl)
      
      const blobUrl = await mediaService.createBlobUrl('image-0-welcome')
      
      expect(blobUrl).toBe(mockBlobUrl)
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({
          size: mockImageData.length,
          type: 'image/png'
        })
      )
    })

    it('should return null when media cannot be retrieved for blob URL', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Media not found'))
      
      const blobUrl = await mediaService.createBlobUrl('non-existent-id')
      
      expect(blobUrl).toBeNull()
      expect(global.URL.createObjectURL).not.toHaveBeenCalled()
    })

    it('should use correct MIME type when creating blob', async () => {
      const testCases = [
        { type: 'image/jpeg', extension: 'jpg' },
        { type: 'video/mp4', extension: 'mp4' },
        { type: 'audio/mpeg', extension: 'mp3' }
      ]
      
      for (const testCase of testCases) {
        const mockMediaData = {
          data: Array.from(new Uint8Array([1, 2, 3, 4])),
          metadata: {
            mimeType: testCase.type,
            fileName: `test.${testCase.extension}`
          }
        }
        
        mockInvoke.mockResolvedValueOnce(mockMediaData)
        
        const createObjectURLSpy = vi.fn().mockReturnValue('blob:test')
        global.URL.createObjectURL = createObjectURLSpy
        
        await mediaService.createBlobUrl(`test-${testCase.extension}`)
        
        expect(createObjectURLSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: testCase.type
          })
        )
      }
    })
  })

  describe('Media Storage and Retrieval Flow', () => {
    it('should complete full cycle: store -> retrieve -> create blob URL', async () => {
      // Create a mock File with arrayBuffer method
      const fileContent = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
      const file = new Blob([fileContent], { type: 'image/png' })
      Object.defineProperty(file, 'name', { value: 'test.png' })
      Object.defineProperty(file, 'arrayBuffer', {
        value: async () => fileContent.buffer
      })
      const pageId = 'welcome'
      
      // Mock store operation
      mockInvoke.mockResolvedValueOnce(undefined) // store_media returns void
      
      // Store the media
      const stored = await mediaService.storeMedia(file, pageId, 'image')
      
      expect(stored).toBeTruthy()
      expect(stored.id).toMatch(/^image-\d+-welcome$/)
      
      // Mock retrieve operation
      const mockRetrievedData = {
        data: Array.from(new Uint8Array(await file.arrayBuffer())),
        metadata: {
          mimeType: 'image/png',
          fileName: 'test.png',
          pageId: 'welcome',
          type: 'image'
        }
      }
      
      mockInvoke.mockResolvedValueOnce(mockRetrievedData)
      
      // Retrieve the media
      const retrieved = await mediaService.getMedia(stored.id)
      
      expect(retrieved).toBeTruthy()
      expect(retrieved?.metadata.mimeType).toBe('image/png')
      
      // Create blob URL
      const mockBlobUrl = 'blob:http://localhost:3000/test-blob'
      global.URL.createObjectURL = vi.fn().mockReturnValue(mockBlobUrl)
      
      mockInvoke.mockResolvedValueOnce(mockRetrievedData)
      
      const blobUrl = await mediaService.createBlobUrl(stored.id)
      
      expect(blobUrl).toBe(mockBlobUrl)
    })
  })

  describe('Backend Command Formatting', () => {
    it('should use correct command names and parameter formats for Tauri', async () => {
      // Test store_media command
      const fileContent = new Uint8Array([255, 216, 255]) // JPEG header
      const file = new Blob([fileContent], { type: 'image/jpeg' })
      Object.defineProperty(file, 'name', { value: 'test.jpg' })
      Object.defineProperty(file, 'arrayBuffer', {
        value: async () => fileContent.buffer
      })
      await mediaService.storeMedia(file as File, 'page-1', 'image')
      
      expect(mockInvoke).toHaveBeenCalledWith('store_media', {
        project_id: 'test-project',
        media_id: expect.stringMatching(/^image-\d+-page-1$/),
        data: expect.any(Array),
        file_name: 'test.jpg',
        mime_type: 'image/jpeg'
      })
      
      // Test get_media command
      mockInvoke.mockResolvedValueOnce({ data: [], metadata: {} })
      await mediaService.getMedia('test-id')
      
      expect(mockInvoke).toHaveBeenCalledWith('get_media', {
        project_id: 'test-project',
        media_id: 'test-id'
      })
      
      // Test list_media command
      mockInvoke.mockResolvedValueOnce([])
      await mediaService.listAllMedia()
      
      expect(mockInvoke).toHaveBeenCalledWith('list_media', {
        project_id: 'test-project'
      })
      
      // Test delete_media command
      mockInvoke.mockResolvedValueOnce(undefined)
      await mediaService.deleteMedia('test-id')
      
      expect(mockInvoke).toHaveBeenCalledWith('delete_media', {
        project_id: 'test-project',
        media_id: 'test-id'
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle Tauri API not being available', async () => {
      // This would need a separate test file since we're mocking the module import
      // For now, we'll test that the service handles invoke failures gracefully
      mockInvoke.mockRejectedValueOnce(new Error('Tauri API not available'))
      
      const result = await mediaService.getMedia('test-id')
      
      expect(result).toBeNull()
    })

    it('should handle corrupted data from backend', async () => {
      const mockCorruptedData = {
        data: 'not-an-array', // Should be an array
        metadata: {}
      }
      
      mockInvoke.mockResolvedValueOnce(mockCorruptedData as any)
      
      const result = await mediaService.getMedia('test-id')
      
      // Should handle gracefully and return null or throw appropriate error
      expect(result).toBeNull()
    })
  })
})