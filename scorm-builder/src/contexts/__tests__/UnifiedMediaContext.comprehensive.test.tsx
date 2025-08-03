import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { UnifiedMediaProvider, useUnifiedMedia } from '../UnifiedMediaContext'
import { MediaService } from '../../services/MediaService'
import { logger } from '../../utils/logger'
import type { MediaItem, MediaMetadata } from '../../services/MediaService'
import type { MediaType } from '../../utils/idGenerator'

// Mock dependencies
vi.mock('../../services/MediaService', () => ({
  createMediaService: vi.fn(),
  MediaService: vi.fn()
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock('../../utils/blobUrlManager', () => ({
  blobUrlManager: {
    createObjectURL: vi.fn((blob) => `blob:mock-${Math.random()}`),
    revokeObjectURL: vi.fn(),
    hasUrl: vi.fn(() => true),
    incrementRefCount: vi.fn(),
    decrementRefCount: vi.fn()
  }
}))

describe('UnifiedMediaContext Comprehensive Tests', () => {
  let mockMediaService: any
  let mockCreateMediaService: any
  let testProjectId: string

  beforeEach(() => {
    testProjectId = 'test-project-123'
    
    // Create mock MediaService instance
    mockMediaService = {
      storeMedia: vi.fn(),
      getMedia: vi.fn(),
      deleteMedia: vi.fn(),
      storeYouTubeVideo: vi.fn(),
      listAllMedia: vi.fn(),
      listMediaForPage: vi.fn(),
      createBlobUrl: vi.fn(),
      cleanup: vi.fn(),
      getCacheStats: vi.fn()
    }

    // Mock createMediaService to return our mock instance
    mockCreateMediaService = vi.mocked(await import('../../services/MediaService').then(m => m.createMediaService))
    mockCreateMediaService.mockReturnValue(mockMediaService)

    // Default mock implementations
    mockMediaService.listAllMedia.mockResolvedValue([])
    mockMediaService.getCacheStats.mockReturnValue({ hits: 0, misses: 0, size: 0 })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <UnifiedMediaProvider projectId={testProjectId}>
      {children}
    </UnifiedMediaProvider>
  )

  describe('Context Provider', () => {
    it('should initialize with correct project ID', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current).not.toBeNull()
      })

      expect(mockCreateMediaService).toHaveBeenCalledWith(testProjectId)
    })

    it('should load media on mount', async () => {
      const mockMedia: MediaItem[] = [
        { id: 'media-1', type: 'image', pageId: 'page-1', fileName: 'test1.jpg', metadata: {} as MediaMetadata },
        { id: 'media-2', type: 'audio', pageId: 'page-2', fileName: 'test2.mp3', metadata: {} as MediaMetadata }
      ]
      mockMediaService.listAllMedia.mockResolvedValue(mockMedia)

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockMediaService.listAllMedia).toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith('[UnifiedMediaContext] Loaded', 2, 'media items')
    })

    it('should handle load errors gracefully', async () => {
      const loadError = new Error('Failed to load media')
      mockMediaService.listAllMedia.mockRejectedValue(loadError)

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.error).toBe(loadError)
      })

      expect(logger.error).toHaveBeenCalledWith('[UnifiedMediaContext] Failed to load media:', loadError)
    })
  })

  describe('Media Storage Operations', () => {
    it('should store media with progress tracking', async () => {
      const mockItem: MediaItem = {
        id: 'image-1-test',
        type: 'image',
        pageId: 'test-page',
        fileName: 'test.jpg',
        metadata: {} as MediaMetadata
      }
      mockMediaService.storeMedia.mockResolvedValue(mockItem)

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const progressCallback = vi.fn()
      
      let storedItem: MediaItem | undefined
      await act(async () => {
        storedItem = await result.current.storeMedia(
          file,
          'test-page',
          'image',
          { title: 'Test Image' },
          progressCallback
        )
      })

      expect(mockMediaService.storeMedia).toHaveBeenCalledWith(
        file,
        'test-page',
        'image',
        { title: 'Test Image' },
        progressCallback
      )
      expect(storedItem).toBe(mockItem)
      
      // Verify cache update
      const cachedItem = result.current.getMediaById('image-1-test')
      expect(cachedItem).toBe(mockItem)
    })

    it('should handle store errors and show in context', async () => {
      const storeError = new Error('Storage failed')
      mockMediaService.storeMedia.mockRejectedValue(storeError)

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      await act(async () => {
        await expect(
          result.current.storeMedia(file, 'test-page', 'image')
        ).rejects.toThrow('Storage failed')
      })

      expect(result.current.error).toBe(storeError)
    })

    it('should store YouTube videos correctly', async () => {
      const mockYouTubeItem: MediaItem = {
        id: 'youtube-1-welcome',
        type: 'video',
        pageId: 'welcome',
        fileName: 'YouTube Video',
        metadata: {
          youtubeUrl: 'https://www.youtube.com/watch?v=abc123',
          embedUrl: 'https://www.youtube.com/embed/abc123'
        } as MediaMetadata
      }
      mockMediaService.storeYouTubeVideo.mockResolvedValue(mockYouTubeItem)

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      let storedItem: MediaItem | undefined
      await act(async () => {
        storedItem = await result.current.storeYouTubeVideo(
          'https://www.youtube.com/watch?v=abc123',
          'https://www.youtube.com/embed/abc123',
          'welcome',
          { title: 'Welcome Video' }
        )
      })

      expect(mockMediaService.storeYouTubeVideo).toHaveBeenCalledWith(
        'https://www.youtube.com/watch?v=abc123',
        'https://www.youtube.com/embed/abc123',
        'welcome',
        { title: 'Welcome Video' }
      )
      expect(storedItem).toBe(mockYouTubeItem)
    })
  })

  describe('Media Retrieval Operations', () => {
    it('should get media by ID from cache first', async () => {
      const mockMedia: MediaItem[] = [
        { id: 'media-1', type: 'image', pageId: 'page-1', fileName: 'test1.jpg', metadata: {} as MediaMetadata },
        { id: 'media-2', type: 'audio', pageId: 'page-2', fileName: 'test2.mp3', metadata: {} as MediaMetadata }
      ]
      mockMediaService.listAllMedia.mockResolvedValue(mockMedia)

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Get from cache - should not call service
      const item = result.current.getMediaById('media-1')
      expect(item).toBe(mockMedia[0])
      expect(mockMediaService.getMedia).not.toHaveBeenCalled()
    })

    it('should get media for specific page', async () => {
      const mockMedia: MediaItem[] = [
        { id: 'media-1', type: 'image', pageId: 'page-1', fileName: 'test1.jpg', metadata: {} as MediaMetadata },
        { id: 'media-2', type: 'audio', pageId: 'page-1', fileName: 'test2.mp3', metadata: {} as MediaMetadata },
        { id: 'media-3', type: 'video', pageId: 'page-2', fileName: 'test3.mp4', metadata: {} as MediaMetadata }
      ]
      mockMediaService.listAllMedia.mockResolvedValue(mockMedia)

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const page1Media = result.current.getMediaForPage('page-1')
      expect(page1Media).toHaveLength(2)
      expect(page1Media[0].pageId).toBe('page-1')
      expect(page1Media[1].pageId).toBe('page-1')
    })

    it('should get all media', async () => {
      const mockMedia: MediaItem[] = [
        { id: 'media-1', type: 'image', pageId: 'page-1', fileName: 'test1.jpg', metadata: {} as MediaMetadata },
        { id: 'media-2', type: 'audio', pageId: 'page-2', fileName: 'test2.mp3', metadata: {} as MediaMetadata }
      ]
      mockMediaService.listAllMedia.mockResolvedValue(mockMedia)

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const allMedia = result.current.getAllMedia()
      expect(allMedia).toHaveLength(2)
      expect(allMedia).toEqual(mockMedia)
    })

    it('should get media data from service', async () => {
      const mockData = {
        data: new Uint8Array([1, 2, 3, 4]),
        metadata: { mimeType: 'image/jpeg' } as MediaMetadata
      }
      mockMediaService.getMedia.mockResolvedValue(mockData)

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      let mediaData: any
      await act(async () => {
        mediaData = await result.current.getMedia('media-1')
      })

      expect(mockMediaService.getMedia).toHaveBeenCalledWith('media-1')
      expect(mediaData).toBe(mockData)
    })

    it('should handle getMedia errors', async () => {
      mockMediaService.getMedia.mockRejectedValue(new Error('Media not found'))

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await act(async () => {
        await expect(result.current.getMedia('missing-id')).rejects.toThrow('Media not found')
      })
    })
  })

  describe('Media Deletion', () => {
    it('should delete media and update cache', async () => {
      const mockMedia: MediaItem[] = [
        { id: 'media-1', type: 'image', pageId: 'page-1', fileName: 'test1.jpg', metadata: {} as MediaMetadata },
        { id: 'media-2', type: 'audio', pageId: 'page-2', fileName: 'test2.mp3', metadata: {} as MediaMetadata }
      ]
      mockMediaService.listAllMedia.mockResolvedValue(mockMedia)
      mockMediaService.deleteMedia.mockResolvedValue(true)

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      let deleteResult: boolean = false
      await act(async () => {
        deleteResult = await result.current.deleteMedia('media-1')
      })

      expect(mockMediaService.deleteMedia).toHaveBeenCalledWith('media-1')
      expect(deleteResult).toBe(true)
      
      // Verify removed from cache
      expect(result.current.getMediaById('media-1')).toBeUndefined()
      expect(result.current.getAllMedia()).toHaveLength(1)
    })

    it('should handle deletion errors', async () => {
      mockMediaService.deleteMedia.mockRejectedValue(new Error('Delete failed'))

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await act(async () => {
        await expect(result.current.deleteMedia('media-1')).rejects.toThrow('Delete failed')
      })

      expect(result.current.error).toEqual(new Error('Delete failed'))
    })
  })

  describe('Blob URL Management', () => {
    it('should create blob URLs', async () => {
      const mockBlobUrl = 'blob:mock-12345'
      mockMediaService.createBlobUrl.mockResolvedValue(mockBlobUrl)

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      let blobUrl: string | null = null
      await act(async () => {
        blobUrl = await result.current.createBlobUrl('media-1')
      })

      expect(mockMediaService.createBlobUrl).toHaveBeenCalledWith('media-1')
      expect(blobUrl).toBe(mockBlobUrl)
    })

    it('should revoke blob URLs', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      act(() => {
        result.current.revokeBlobUrl('blob:mock-12345')
      })

      const { blobUrlManager } = await import('../../utils/blobUrlManager')
      expect(blobUrlManager.revokeObjectURL).toHaveBeenCalledWith('blob:mock-12345')
    })

    it('should handle blob URL creation errors', async () => {
      mockMediaService.createBlobUrl.mockRejectedValue(new Error('Blob creation failed'))

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await act(async () => {
        await expect(result.current.createBlobUrl('media-1')).rejects.toThrow('Blob creation failed')
      })
    })
  })

  describe('Error Handling', () => {
    it('should clear errors', async () => {
      const loadError = new Error('Test error')
      mockMediaService.listAllMedia.mockRejectedValue(loadError)

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.error).toBe(loadError)
      })

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('Refresh Operations', () => {
    it('should refresh media list', async () => {
      const initialMedia: MediaItem[] = [
        { id: 'media-1', type: 'image', pageId: 'page-1', fileName: 'test1.jpg', metadata: {} as MediaMetadata }
      ]
      const updatedMedia: MediaItem[] = [
        ...initialMedia,
        { id: 'media-2', type: 'audio', pageId: 'page-2', fileName: 'test2.mp3', metadata: {} as MediaMetadata }
      ]
      
      mockMediaService.listAllMedia
        .mockResolvedValueOnce(initialMedia)
        .mockResolvedValueOnce(updatedMedia)

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.getAllMedia()).toHaveLength(1)
      })

      await act(async () => {
        await result.current.refreshMedia()
      })

      expect(result.current.getAllMedia()).toHaveLength(2)
      expect(mockMediaService.listAllMedia).toHaveBeenCalledTimes(2)
    })

    it('should handle refresh errors', async () => {
      mockMediaService.listAllMedia
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Refresh failed'))

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.refreshMedia()
      })

      expect(result.current.error).toEqual(new Error('Refresh failed'))
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent store operations', async () => {
      const mockItems: MediaItem[] = []
      mockMediaService.storeMedia.mockImplementation(async (file, pageId, type) => {
        const item: MediaItem = {
          id: `${type}-${mockItems.length}-${pageId}`,
          type,
          pageId,
          fileName: (file as File).name,
          metadata: {} as MediaMetadata
        }
        mockItems.push(item)
        return item
      })

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      const files = [
        new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }),
        new File(['test3'], 'test3.jpg', { type: 'image/jpeg' })
      ]

      let results: MediaItem[] = []
      await act(async () => {
        results = await Promise.all(
          files.map(file => 
            result.current.storeMedia(file, 'concurrent-test', 'image')
          )
        )
      })

      expect(results).toHaveLength(3)
      expect(mockMediaService.storeMedia).toHaveBeenCalledTimes(3)
      
      // All items should be in cache
      results.forEach(item => {
        expect(result.current.getMediaById(item.id)).toBe(item)
      })
    })
  })

  describe('Memory Management', () => {
    it('should clean up on unmount', async () => {
      const { unmount } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => {
        expect(logger.info).toHaveBeenCalled()
      })

      unmount()

      expect(logger.info).toHaveBeenCalledWith('[UnifiedMediaContext] Cleaning up project-specific blob URLs')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty media lists', async () => {
      mockMediaService.listAllMedia.mockResolvedValue([])

      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.getAllMedia()).toEqual([])
      expect(result.current.getMediaForPage('any-page')).toEqual([])
      expect(result.current.getMediaById('any-id')).toBeUndefined()
    })

    it('should handle null/undefined inputs gracefully', async () => {
      const { result } = renderHook(() => useUnifiedMedia(), { wrapper })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // These should not throw
      expect(result.current.getMediaById('')).toBeUndefined()
      expect(result.current.getMediaForPage('')).toEqual([])
      
      act(() => {
        result.current.revokeBlobUrl('')
      })
      
      // Should handle gracefully
      expect(logger.error).not.toHaveBeenCalled()
    })
  })
})