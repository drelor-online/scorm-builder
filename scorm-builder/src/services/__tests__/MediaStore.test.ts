import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaStore } from '../MediaStore'

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock mediaUrl service
vi.mock('../mediaUrl', () => ({
  mediaUrlService: {
    registerMediaUrl: vi.fn(),
    revokeMediaUrl: vi.fn(),
    revokeAll: vi.fn(),
    getMediaUrl: vi.fn((projectId: string, mediaId: string) => 
      `scorm-media://${projectId}/${mediaId}`
    )
  }
}))

import { invoke } from '@tauri-apps/api/core'
import { mediaUrlService } from '../mediaUrl'

describe('MediaStore', () => {
  let mediaStore: MediaStore

  beforeEach(() => {
    vi.clearAllMocks()
    mediaStore = new MediaStore()
  })

  afterEach(() => {
    mediaStore.cleanup()
  })

  describe('Project Loading', () => {
    it('should load media from backend', async () => {
      const projectId = 'test-project-123'
      const mockMediaList = [
        {
          id: 'media-1',
          metadata: {
            page_id: 'page-1',
            type: 'image',
            original_name: 'test.png'
          }
        },
        {
          id: 'media-2',
          metadata: {
            page_id: 'page-1',
            type: 'video',
            original_name: 'test.mp4'
          }
        }
      ]

      ;(invoke as any).mockResolvedValueOnce(mockMediaList)

      await mediaStore.loadProject(projectId)

      expect(invoke).toHaveBeenCalledWith('list_project_media', { projectId })
      expect(mediaUrlService.registerMediaUrl).toHaveBeenCalledTimes(2)
      expect(mediaUrlService.registerMediaUrl).toHaveBeenCalledWith(
        'media-1',
        expect.stringContaining('scorm-media://test-project-123/media-1')
      )
    })

    it('should handle progress callback during loading', async () => {
      const projectId = 'test-project'
      const onProgress = vi.fn()
      const mockMediaList = Array(5).fill(null).map((_, i) => ({
        id: `media-${i}`,
        metadata: {
          page_id: 'page-1',
          type: 'image',
          original_name: `test-${i}.png`
        }
      }))

      ;(invoke as any).mockResolvedValueOnce(mockMediaList)

      await mediaStore.loadProject(projectId, onProgress)

      // Progress should be called for each media item
      expect(onProgress).toHaveBeenCalledWith(1, 5)
      expect(onProgress).toHaveBeenCalledWith(2, 5)
      expect(onProgress).toHaveBeenCalledWith(3, 5)
      expect(onProgress).toHaveBeenCalledWith(4, 5)
      expect(onProgress).toHaveBeenCalledWith(5, 5)
    })

    it('should cleanup previous project when loading new one', async () => {
      const project1 = 'project-1'
      const project2 = 'project-2'
      
      ;(invoke as any).mockResolvedValueOnce([
        { id: 'media-1', metadata: { page_id: 'page-1', type: 'image', original_name: 'test.png' } }
      ])

      await mediaStore.loadProject(project1)
      
      // Reset mocks
      vi.clearAllMocks()
      ;(invoke as any).mockResolvedValueOnce([])

      await mediaStore.loadProject(project2)

      expect(mediaUrlService.revokeAll).toHaveBeenCalled()
    })

    it('should return existing promise if already loading', async () => {
      const projectId = 'test-project'
      
      ;(invoke as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 100))
      )

      const promise1 = mediaStore.loadProject(projectId)
      const promise2 = mediaStore.loadProject(projectId)

      expect(promise1).toBe(promise2)
      expect(invoke).toHaveBeenCalledTimes(1)

      await Promise.all([promise1, promise2])
    })

    it('should handle loading errors', async () => {
      const projectId = 'test-project'
      const error = new Error('Failed to load media')
      
      ;(invoke as any).mockRejectedValueOnce(error)

      await expect(mediaStore.loadProject(projectId)).rejects.toThrow('Failed to load media')
    })
  })

  describe('Media Retrieval', () => {
    beforeEach(async () => {
      const mockMediaList = [
        {
          id: 'media-1',
          metadata: {
            page_id: 'page-1',
            type: 'image',
            original_name: 'test1.png'
          }
        },
        {
          id: 'media-2',
          metadata: {
            page_id: 'page-1',
            type: 'video',
            original_name: 'test2.mp4'
          }
        },
        {
          id: 'media-3',
          metadata: {
            page_id: 'page-2',
            type: 'audio',
            original_name: 'test3.mp3'
          }
        }
      ]

      ;(invoke as any).mockResolvedValueOnce(mockMediaList)
      await mediaStore.loadProject('test-project')
    })

    it('should get media URL by id', () => {
      const url = mediaStore.getMediaUrl('media-1')
      
      expect(url).toBe('scorm-media://test-project/media-1')
    })

    it('should return undefined for non-existent media', () => {
      const url = mediaStore.getMediaUrl('non-existent')
      
      expect(url).toBeUndefined()
    })

    it('should get all media for a page', () => {
      const pageMedia = mediaStore.getMediaByPage('page-1')
      
      expect(pageMedia).toHaveLength(2)
      expect(pageMedia[0].id).toBe('media-1')
      expect(pageMedia[1].id).toBe('media-2')
    })

    it('should return empty array for page with no media', () => {
      const pageMedia = mediaStore.getMediaByPage('page-999')
      
      expect(pageMedia).toEqual([])
    })

    it('should get all cached media', () => {
      const allMedia = mediaStore.getAllMedia()
      
      expect(allMedia).toHaveLength(3)
      expect(allMedia.map(m => m.id)).toEqual(['media-1', 'media-2', 'media-3'])
    })

    it('should check if media exists', () => {
      expect(mediaStore.hasMedia('media-1')).toBe(true)
      expect(mediaStore.hasMedia('non-existent')).toBe(false)
    })
  })

  describe('Media Storage', () => {
    beforeEach(async () => {
      ;(invoke as any).mockResolvedValueOnce([])
      await mediaStore.loadProject('test-project')
    })

    it('should store media with Blob data', async () => {
      const blob = new Blob(['test data'], { type: 'image/png' })
      const metadata = {
        page_id: 'page-1',
        type: 'image' as const,
        original_name: 'test.png'
      }

      ;(invoke as any).mockResolvedValueOnce(undefined)

      await mediaStore.storeMedia('new-media-1', blob, metadata)

      expect(invoke).toHaveBeenCalledWith('store_media', {
        projectId: 'test-project',
        mediaId: 'new-media-1',
        data: expect.any(Uint8Array),
        metadata
      })

      expect(mediaStore.hasMedia('new-media-1')).toBe(true)
    })

    it('should store media with ArrayBuffer data', async () => {
      const buffer = new ArrayBuffer(8)
      const metadata = {
        page_id: 'page-1',
        type: 'audio' as const,
        original_name: 'test.mp3'
      }

      ;(invoke as any).mockResolvedValueOnce(undefined)

      await mediaStore.storeMedia('new-media-2', buffer, metadata)

      expect(invoke).toHaveBeenCalledWith('store_media', {
        projectId: 'test-project',
        mediaId: 'new-media-2',
        data: new Uint8Array(buffer),
        metadata
      })
    })

    it('should update cache after storing media', async () => {
      const blob = new Blob(['test'])
      const metadata = {
        page_id: 'page-1',
        type: 'video' as const,
        original_name: 'test.mp4'
      }

      ;(invoke as any).mockResolvedValueOnce(undefined)

      await mediaStore.storeMedia('new-media', blob, metadata)

      const url = mediaStore.getMediaUrl('new-media')
      expect(url).toBeDefined()
      expect(mediaUrlService.registerMediaUrl).toHaveBeenCalled()
    })

    it('should throw error when storing without project', async () => {
      mediaStore.cleanup() // Clear project
      
      const blob = new Blob(['test'])
      const metadata = {
        page_id: 'page-1',
        type: 'image' as const,
        original_name: 'test.png'
      }

      await expect(mediaStore.storeMedia('id', blob, metadata)).rejects.toThrow('No project loaded')
    })
  })

  describe('Media Deletion', () => {
    beforeEach(async () => {
      const mockMediaList = [
        {
          id: 'media-1',
          metadata: {
            page_id: 'page-1',
            type: 'image',
            original_name: 'test.png'
          }
        }
      ]

      ;(invoke as any).mockResolvedValueOnce(mockMediaList)
      await mediaStore.loadProject('test-project')
    })

    it('should delete media by id', async () => {
      ;(invoke as any).mockResolvedValueOnce(undefined)

      await mediaStore.deleteMedia('media-1')

      expect(invoke).toHaveBeenCalledWith('delete_media', {
        projectId: 'test-project',
        mediaId: 'media-1'
      })
      expect(mediaUrlService.revokeMediaUrl).toHaveBeenCalledWith('media-1')
      expect(mediaStore.hasMedia('media-1')).toBe(false)
    })

    it('should handle deletion of non-existent media', async () => {
      ;(invoke as any).mockResolvedValueOnce(undefined)

      await mediaStore.deleteMedia('non-existent')

      expect(invoke).toHaveBeenCalledWith('delete_media', {
        projectId: 'test-project',
        mediaId: 'non-existent'
      })
    })

    it('should throw error when deleting without project', async () => {
      mediaStore.cleanup()

      await expect(mediaStore.deleteMedia('media-1')).rejects.toThrow('No project loaded')
    })
  })

  describe('Cleanup', () => {
    it('should cleanup all resources', async () => {
      ;(invoke as any).mockResolvedValueOnce([
        { id: 'media-1', metadata: { page_id: 'page-1', type: 'image', original_name: 'test.png' } }
      ])
      
      await mediaStore.loadProject('test-project')
      
      mediaStore.cleanup()

      expect(mediaUrlService.revokeAll).toHaveBeenCalled()
      expect(mediaStore.getAllMedia()).toEqual([])
      expect(mediaStore.getMediaUrl('media-1')).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty media list', async () => {
      ;(invoke as any).mockResolvedValueOnce([])

      await mediaStore.loadProject('empty-project')

      expect(mediaStore.getAllMedia()).toEqual([])
    })

    it('should handle media with missing metadata fields', async () => {
      const mockMediaList = [
        {
          id: 'media-1',
          metadata: {
            page_id: 'page-1',
            type: 'image',
            original_name: 'test.png'
            // Missing optional fields
          }
        }
      ]

      ;(invoke as any).mockResolvedValueOnce(mockMediaList)

      await mediaStore.loadProject('test-project')

      const media = mediaStore.getAllMedia()
      expect(media[0].metadata.mime_type).toBeUndefined()
      expect(media[0].metadata.source).toBeUndefined()
    })

    it('should handle YouTube videos with embed URLs', async () => {
      const mockMediaList = [
        {
          id: 'youtube-1',
          metadata: {
            page_id: 'page-1',
            type: 'video',
            original_name: 'YouTube Video',
            embed_url: 'https://youtube.com/embed/123'
          }
        }
      ]

      ;(invoke as any).mockResolvedValueOnce(mockMediaList)

      await mediaStore.loadProject('test-project')

      const media = mediaStore.getAllMedia()
      expect(media[0].metadata.embed_url).toBe('https://youtube.com/embed/123')
    })

    it('should convert blob to Uint8Array correctly', async () => {
      ;(invoke as any).mockResolvedValueOnce([])
      await mediaStore.loadProject('test-project')

      const textData = 'Hello, World!'
      const blob = new Blob([textData], { type: 'text/plain' })
      
      let capturedData: Uint8Array | null = null
      ;(invoke as any).mockImplementation((cmd, args) => {
        if (cmd === 'store_media') {
          capturedData = args.data
        }
        return Promise.resolve()
      })

      await mediaStore.storeMedia('text-1', blob, {
        page_id: 'page-1',
        type: 'image',
        original_name: 'test.txt'
      })

      // Verify the data was converted correctly
      expect(capturedData).toBeInstanceOf(Uint8Array)
      const decoder = new TextDecoder()
      expect(decoder.decode(capturedData!)).toBe(textData)
    })
  })
})