import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { UnifiedMediaProvider, useUnifiedMedia } from '../UnifiedMediaContext'
import { invoke } from '@tauri-apps/api/core'
import { blobUrlManager } from '../../utils/blobUrlManager'
import type { MediaType } from '../../utils/idGenerator'
import { ReactNode } from 'react'

// Mock dependencies
vi.mock('@tauri-apps/api/core')
vi.mock('../../utils/blobUrlManager')
import { logger } from '../../utils/logger'

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Create mock instances for tracking
let mockMediaServiceInstance: any = null

// Mock MediaService
vi.mock('../../services/MediaService', () => {
  const actualModule = vi.importActual('../../services/MediaService')
  
  class MockMediaService {
    projectId: string
    listAllMedia = vi.fn().mockResolvedValue([])
    storeMedia = vi.fn()
    getMedia = vi.fn()
    deleteMedia = vi.fn()
    storeYouTubeVideo = vi.fn()
    clearCache = vi.fn()
    getStats = vi.fn().mockReturnValue({ totalItems: 0, itemsByType: {}, itemsByPage: {} })
    
    constructor(config: any) {
      this.projectId = config.projectId
      mockMediaServiceInstance = this
    }
  }
  
  return {
    ...actualModule,
    MediaService: MockMediaService,
    createMediaService: vi.fn((projectId: string) => new MockMediaService({ projectId }))
  }
})

// Helper to get media service
const getMediaService = () => {
  expect(mockMediaServiceInstance).toBeDefined()
  return mockMediaServiceInstance
}

describe('UnifiedMediaContext Integration Tests', () => {
  const mockInvoke = vi.mocked(invoke)
  const mockBlobUrlManager = vi.mocked(blobUrlManager)
  
  const wrapper = ({ children, projectId = 'test-project' }: { children: ReactNode; projectId?: string }) => (
    <UnifiedMediaProvider projectId={projectId}>
      {children}
    </UnifiedMediaProvider>
  )
  
  beforeEach(() => {
    vi.clearAllMocks()
    mockMediaServiceInstance = null
    
    // Setup default mocks
    mockBlobUrlManager.getUrl = vi.fn().mockReturnValue(null)
    mockBlobUrlManager.getOrCreateUrl = vi.fn().mockReturnValue('blob:mock-url')
    mockBlobUrlManager.releaseUrl = vi.fn()
    
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url')
    global.URL.revokeObjectURL = vi.fn()
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('Provider Initialization', () => {
    it('should initialize and load media on mount', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      // Should start loading
      expect(result.current.isLoading).toBe(true)
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      
      // Should have called listAllMedia
      expect(mockMediaServiceInstance).toBeDefined()
      expect(mockMediaServiceInstance.listAllMedia).toHaveBeenCalled()
    })
    
    it('should handle initialization errors gracefully', async () => {
      // Make listAllMedia fail
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      expect(mockMediaServiceInstance).toBeDefined()
      mockMediaServiceInstance.listAllMedia.mockRejectedValueOnce(new Error('Failed to load'))
      
      // Trigger refresh to cause error
      await act(async () => {
        await result.current.refreshMedia()
      })
      
      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.error?.message).toBe('Failed to load')
    })
    
    it('should clean up on unmount', () => {
      const { unmount } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      unmount()
      
      // Should log cleanup message (checked via logger mock)
      expect(logger.info).toHaveBeenCalledWith(
        '[UnifiedMediaContext] Cleaning up project-specific blob URLs'
      )
    })
  })
  
  describe('Media Storage Operations', () => {
    it('should store a file successfully', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      const mockStoredItem = {
        id: 'image-0-welcome',
        type: 'image' as MediaType,
        pageId: 'welcome',
        fileName: 'test.jpg',
        metadata: {
          uploadedAt: new Date().toISOString(),
          mimeType: 'image/jpeg',
          size: 12,
          type: 'image' as MediaType
        }
      }
      
      expect(mockMediaServiceInstance).toBeDefined()
      mockMediaServiceInstance.storeMedia.mockResolvedValueOnce(mockStoredItem)
      
      let storedItem
      await act(async () => {
        storedItem = await result.current.storeMedia(file, 'welcome', 'image')
      })
      
      expect(storedItem).toEqual(mockStoredItem)
      expect(mockMediaServiceInstance.storeMedia).toHaveBeenCalledWith(
        file,
        'welcome',
        'image',
        undefined
      )
      
      // Should update cache
      expect(result.current.getMediaById('image-0-welcome')).toEqual(mockStoredItem)
    })
    
    it('should handle storage errors and throw', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      expect(mockMediaServiceInstance).toBeDefined()
      mockMediaServiceInstance.storeMedia.mockRejectedValueOnce(new Error('Storage failed'))
      
      await expect(
        result.current.storeMedia(file, 'welcome', 'image')
      ).rejects.toThrow('Storage failed')
    })
    
    it('should store YouTube video without backend call', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      const mockYouTubeItem = {
        id: 'video-0-topic-0',
        type: 'video' as MediaType,
        pageId: 'topic-0',
        fileName: 'https://youtube.com/watch?v=test',
        metadata: {
          youtubeUrl: 'https://youtube.com/watch?v=test',
          embedUrl: 'https://youtube.com/embed/test',
          type: 'video' as MediaType
        }
      }
      
      getMediaService().storeYouTubeVideo.mockResolvedValueOnce(mockYouTubeItem)
      
      let storedItem
      await act(async () => {
        storedItem = await result.current.storeYouTubeVideo(
          'https://youtube.com/watch?v=test',
          'https://youtube.com/embed/test',
          'topic-0'
        )
      })
      
      expect(storedItem).toEqual(mockYouTubeItem)
      expect(result.current.getMediaById('video-0-topic-0')).toEqual(mockYouTubeItem)
    })
  })
  
  describe('Media Retrieval Operations', () => {
    it('should retrieve media successfully', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      const mockMediaData = {
        data: new Uint8Array([1, 2, 3]),
        metadata: { mimeType: 'image/jpeg', type: 'image' as MediaType }
      }
      
      getMediaService().getMedia.mockResolvedValueOnce(mockMediaData)
      
      let mediaData
      await act(async () => {
        mediaData = await result.current.getMedia('image-0-welcome')
      })
      
      expect(mediaData).toEqual(mockMediaData)
    })
    
    it('should handle retrieval errors gracefully', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      getMediaService().getMedia.mockRejectedValueOnce(new Error('Not found'))
      
      let mediaData
      await act(async () => {
        mediaData = await result.current.getMedia('non-existent')
      })
      
      expect(mediaData).toBeNull()
      expect(result.current.error?.message).toBe('Not found')
    })
    
    it('should filter media by page correctly', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      // Setup initial media in cache
      const mockMedia = [
        {
          id: 'image-0-welcome',
          type: 'image' as MediaType,
          pageId: 'welcome',
          fileName: 'welcome.jpg',
          metadata: { type: 'image' as MediaType }
        },
        {
          id: 'audio-0-welcome',
          type: 'audio' as MediaType,
          pageId: 'welcome',
          fileName: 'welcome.mp3',
          metadata: { type: 'audio' as MediaType }
        },
        {
          id: 'image-0-topic-1',
          type: 'image' as MediaType,
          pageId: 'topic-1',
          fileName: 'topic.jpg',
          metadata: { type: 'image' as MediaType }
        }
      ]
      
      getMediaService().listAllMedia.mockResolvedValueOnce(mockMedia)
      
      // Refresh to load media
      await act(async () => {
        await result.current.refreshMedia()
      })
      
      const welcomeMedia = result.current.getMediaForPage('welcome')
      expect(welcomeMedia).toHaveLength(2)
      expect(welcomeMedia.every(m => m.pageId === 'welcome')).toBe(true)
      
      const topicMedia = result.current.getMediaForPage('topic-1')
      expect(topicMedia).toHaveLength(1)
      expect(topicMedia[0].pageId).toBe('topic-1')
    })
  })
  
  describe('Media Deletion', () => {
    it('should delete media and update cache', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      // First store an item
      const mockItem = {
        id: 'image-0-welcome',
        type: 'image' as MediaType,
        pageId: 'welcome',
        fileName: 'test.jpg',
        metadata: { type: 'image' as MediaType }
      }
      
      getMediaService().storeMedia.mockResolvedValueOnce(mockItem)
      getMediaService().deleteMedia.mockResolvedValueOnce(true)
      
      await act(async () => {
        await result.current.storeMedia(
          new File(['test'], 'test.jpg', { type: 'image/jpeg' }),
          'welcome',
          'image'
        )
      })
      
      expect(result.current.getMediaById('image-0-welcome')).toBeDefined()
      
      // Now delete it
      let deleteResult
      await act(async () => {
        deleteResult = await result.current.deleteMedia('image-0-welcome')
      })
      
      expect(deleteResult).toBe(true)
      expect(result.current.getMediaById('image-0-welcome')).toBeUndefined()
      expect(mockBlobUrlManager.releaseUrl).toHaveBeenCalledWith('image-0-welcome')
    })
    
    it('should handle deletion errors', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      getMediaService().deleteMedia.mockRejectedValueOnce(new Error('Delete failed'))
      
      let deleteResult
      await act(async () => {
        deleteResult = await result.current.deleteMedia('some-id')
      })
      
      expect(deleteResult).toBe(false)
      expect(result.current.error?.message).toBe('Delete failed')
    })
  })
  
  describe('Blob URL Management', () => {
    it('should create blob URL from media', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      const mockMediaData = {
        data: new Uint8Array([1, 2, 3]),
        metadata: { mimeType: 'image/jpeg' }
      }
      
      getMediaService().getMedia.mockResolvedValueOnce(mockMediaData)
      
      mockBlobUrlManager.getUrl.mockReturnValueOnce(null)
      mockBlobUrlManager.getOrCreateUrl.mockReturnValueOnce('blob:new-url')
      
      let blobUrl
      await act(async () => {
        blobUrl = await result.current.createBlobUrl('image-0-welcome')
      })
      
      expect(blobUrl).toBe('blob:new-url')
      expect(mockBlobUrlManager.getOrCreateUrl).toHaveBeenCalledWith(
        'image-0-welcome',
        expect.any(Blob),
        expect.objectContaining({
          projectId: 'test-project',
          mimeType: 'image/jpeg'
        })
      )
    })
    
    it('should reuse existing blob URL', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      mockBlobUrlManager.getUrl.mockReturnValueOnce('blob:existing-url')
      
      let blobUrl
      await act(async () => {
        blobUrl = await result.current.createBlobUrl('image-0-welcome')
      })
      
      expect(blobUrl).toBe('blob:existing-url')
      expect(mockBlobUrlManager.getOrCreateUrl).not.toHaveBeenCalled()
    })
    
    it('should handle blob URL creation errors', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      getMediaService().getMedia.mockRejectedValueOnce(new Error('Media not found'))
      
      let blobUrl
      await act(async () => {
        blobUrl = await result.current.createBlobUrl('non-existent')
      })
      
      expect(blobUrl).toBeNull()
      expect(result.current.error?.message).toBe('Media not found')
    })
    
    it('should revoke blob URL correctly', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      // Setup a mock item in cache
      const mockItem = {
        id: 'image-0-welcome',
        type: 'image' as MediaType,
        pageId: 'welcome',
        fileName: 'test.jpg',
        metadata: { type: 'image' as MediaType }
      }
      
      // Store the item through the context first
      getMediaService().storeMedia.mockResolvedValueOnce(mockItem)
      await act(async () => {
        await result.current.storeMedia(
          new File(['test'], 'test.jpg', { type: 'image/jpeg' }),
          'welcome',
          'image'
        )
      })
      
      mockBlobUrlManager.getUrl.mockReturnValueOnce('blob:mock-url')
      
      act(() => {
        result.current.revokeBlobUrl('blob:mock-url')
      })
      
      expect(mockBlobUrlManager.releaseUrl).toHaveBeenCalledWith('image-0-welcome')
    })
    
    it('should handle revoking unknown blob URLs', () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      global.URL.revokeObjectURL = vi.fn()
      
      act(() => {
        result.current.revokeBlobUrl('blob:unknown-url')
      })
      
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:unknown-url')
    })
  })
  
  describe('Error Handling', () => {
    it('should clear errors', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      // Cause an error
      getMediaService().getMedia.mockRejectedValueOnce(new Error('Test error'))
      
      await act(async () => {
        await result.current.getMedia('error-id')
      })
      
      expect(result.current.error).toBeDefined()
      
      // Clear the error
      act(() => {
        result.current.clearError()
      })
      
      expect(result.current.error).toBeNull()
    })
  })
  
  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent stores', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      const files = Array.from({ length: 5 }, (_, i) => ({
        file: new File([`content-${i}`], `file-${i}.jpg`, { type: 'image/jpeg' }),
        item: {
          id: `image-${i}-page-${i}`,
          type: 'image' as MediaType,
          pageId: `page-${i}`,
          fileName: `file-${i}.jpg`,
          metadata: { type: 'image' as MediaType }
        }
      }))
      
      files.forEach(({ item }) => {
        getMediaService().storeMedia.mockResolvedValueOnce(item)
      })
      
      let results
      await act(async () => {
        results = await Promise.all(
          files.map(({ file }, i) =>
            result.current.storeMedia(file, `page-${i}`, 'image')
          )
        )
      })
      
      expect(results).toHaveLength(5)
      expect(result.current.getAllMedia()).toHaveLength(5)
    })
    
    it('should handle mixed success and failure in concurrent operations', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      // Mix of successes and failures
      getMediaService().storeMedia
        .mockResolvedValueOnce({
          id: 'image-0-page-0',
          type: 'image',
          pageId: 'page-0',
          fileName: 'success-0.jpg',
          metadata: { type: 'image' }
        })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          id: 'image-2-page-2',
          type: 'image',
          pageId: 'page-2',
          fileName: 'success-2.jpg',
          metadata: { type: 'image' }
        })
      
      const promises = [
        result.current.storeMedia(new File(['1'], '1.jpg', { type: 'image/jpeg' }), 'page-0', 'image'),
        result.current.storeMedia(new File(['2'], '2.jpg', { type: 'image/jpeg' }), 'page-1', 'image').catch(e => e),
        result.current.storeMedia(new File(['3'], '3.jpg', { type: 'image/jpeg' }), 'page-2', 'image')
      ]
      
      let results
      await act(async () => {
        results = await Promise.all(promises)
      })
      
      expect(results[0]).toHaveProperty('id', 'image-0-page-0')
      expect(results[1]).toBeInstanceOf(Error)
      expect(results[2]).toHaveProperty('id', 'image-2-page-2')
      
      // Only successful items should be in cache
      expect(result.current.getAllMedia()).toHaveLength(2)
    })
  })
  
  describe('Memory Management', () => {
    it('should not leak memory when storing many items', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      // Store many items
      for (let i = 0; i < 100; i++) {
        getMediaService().storeMedia.mockResolvedValueOnce({
          id: `image-${i}-test`,
          type: 'image',
          pageId: 'test',
          fileName: `file-${i}.jpg`,
          metadata: { type: 'image' }
        })
        
        await act(async () => {
          await result.current.storeMedia(
            new File([`content-${i}`], `file-${i}.jpg`, { type: 'image/jpeg' }),
            'test',
            'image'
          )
        })
      }
      
      expect(result.current.getAllMedia()).toHaveLength(100)
      
      // Clear cache should free all references
      act(() => {
        getMediaService().clearCache()
      })
      
      // After clearing MediaService cache, context should update
      await act(async () => {
        await result.current.refreshMedia()
      })
      
      expect(result.current.getAllMedia()).toHaveLength(0)
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle empty project ID', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), {
        wrapper: ({ children }) => (
          <UnifiedMediaProvider projectId="">
            {children}
          </UnifiedMediaProvider>
        )
      })
      
      await waitFor(() => !result.current.isLoading)
      
      // Should still initialize but with empty project ID
      expect(result.current).toBeDefined()
    })
    
    it('should throw error when used outside provider', () => {
      // This should throw
      expect(() => {
        renderHook(() => useUnifiedMedia())
      }).toThrow('useUnifiedMedia must be used within a UnifiedMediaProvider')
    })
    
    it('should handle special characters in metadata', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => !result.current.isLoading)
      
      const metadata = {
        title: 'Test <script>alert("XSS")</script>',
        description: "Test's \"special\" & characters",
        customField: '🎨 Unicode test 你好'
      }
      
      const mockItem = {
        id: 'image-0-test',
        type: 'image' as MediaType,
        pageId: 'test',
        fileName: 'test.jpg',
        metadata: {
          ...metadata,
          type: 'image' as MediaType
        }
      }
      
      getMediaService().storeMedia.mockResolvedValueOnce(mockItem)
      
      let stored
      await act(async () => {
        stored = await result.current.storeMedia(
          new File(['test'], 'test.jpg', { type: 'image/jpeg' }),
          'test',
          'image',
          metadata
        )
      })
      
      expect(stored).toEqual(mockItem)
    })
  })
})