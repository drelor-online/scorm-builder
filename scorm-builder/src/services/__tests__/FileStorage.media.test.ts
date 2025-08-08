import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileStorage } from '../FileStorage'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock MediaService to avoid circular dependencies
vi.mock('../MediaService', () => ({
  MediaService: vi.fn().mockImplementation(() => ({
    storeMedia: vi.fn(),
    getMediaUrl: vi.fn(),
    deleteMedia: vi.fn(),
    getAllMedia: vi.fn(() => []),
    getMediaByPage: vi.fn(() => []),
    cleanup: vi.fn()
  }))
}))

// Mock debugLogger
vi.mock('../../utils/debugLogger', () => ({
  debugLogger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

describe('FileStorage - Media Operations', () => {
  let fileStorage: FileStorage
  const mockInvoke = invoke as any

  beforeEach(() => {
    vi.clearAllMocks()
    fileStorage = new FileStorage()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('storeMedia', () => {
    it('should store media with base64 encoding', async () => {
      const projectId = 'test-project'
      const mediaId = 'media-123'
      const data = new Blob(['test data'], { type: 'image/png' })
      const metadata = {
        page_id: 'page-1',
        original_name: 'test.png'
      }

      // Set current project
      ;(fileStorage as any)._currentProjectId = projectId
      ;(fileStorage as any)._currentProjectPath = '/path/to/project.scormproj'
      mockInvoke.mockResolvedValueOnce(undefined)

      await fileStorage.storeMedia(mediaId, data, 'image', metadata)

      expect(mockInvoke).toHaveBeenCalledWith('store_media_base64', {
        projectId: expect.any(String),
        id: mediaId,
        dataBase64: expect.any(String),
        metadata: expect.objectContaining({
          page_id: 'page-1',
          type: 'image',
          original_name: 'test.png',
          mime_type: 'image/png'
        })
      })
    })

    it('should handle Blob data for audio', async () => {
      const projectId = 'test-project'
      const mediaId = 'media-456'
      const data = new Blob(['audio data'], { type: 'audio/mp3' })
      const metadata = {
        page_id: 'page-2',
        original_name: 'test.mp3'
      }

      ;(fileStorage as any)._currentProjectId = projectId
      ;(fileStorage as any)._currentProjectPath = '/path/to/project.scormproj'
      mockInvoke.mockResolvedValueOnce(undefined)

      await fileStorage.storeMedia(mediaId, data, 'audio', metadata)

      expect(mockInvoke).toHaveBeenCalledWith('store_media_base64', {
        projectId: expect.any(String),
        id: mediaId,
        dataBase64: expect.any(String),
        metadata: expect.objectContaining({
          page_id: 'page-2',
          type: 'audio',
          original_name: 'test.mp3',
          mime_type: 'audio/mp3'
        })
      })
    })

    it('should throw error when no project is loaded', async () => {
      const mediaId = 'media-789'
      const data = new Blob(['test'])
      const metadata = {
        page_id: 'page-1',
        original_name: 'test.png'
      }

      ;(fileStorage as any)._currentProjectId = null

      await expect(fileStorage.storeMedia(mediaId, data, 'image', metadata))
        .rejects.toThrow('No project open')
    })

    it('should handle store errors gracefully', async () => {
      const projectId = 'test-project'
      const mediaId = 'media-error'
      const data = new Blob(['test'])
      const metadata = {
        page_id: 'page-1',
        original_name: 'test.png'
      }

      ;(fileStorage as any)._currentProjectId = projectId
      ;(fileStorage as any)._currentProjectPath = '/path/to/project.scormproj'
      mockInvoke.mockRejectedValueOnce(new Error('Storage failed'))

      await expect(fileStorage.storeMedia(mediaId, data, 'image', metadata))
        .rejects.toThrow('Storage failed')
    })
  })

  describe('deleteMedia', () => {
    it('should delete media by ID', async () => {
      const projectId = 'test-project'
      const mediaId = 'media-to-delete'

      ;(fileStorage as any)._currentProjectId = projectId
      mockInvoke.mockResolvedValueOnce(undefined)

      await fileStorage.deleteMedia(mediaId)

      expect(mockInvoke).toHaveBeenCalledWith('delete_media', {
        projectId,
        mediaId
      })
    })

    it('should throw error when no project is loaded', async () => {
      const mediaId = 'media-123'
      ;(fileStorage as any)._currentProjectId = null

      await expect(fileStorage.deleteMedia(mediaId))
        .rejects.toThrow('No project open')
    })

    it('should handle deletion of non-existent media', async () => {
      const projectId = 'test-project'
      const mediaId = 'non-existent'

      ;(fileStorage as any)._currentProjectId = projectId
      mockInvoke.mockResolvedValueOnce(undefined)

      // deleteMedia returns boolean
      const result = await fileStorage.deleteMedia(mediaId)
      expect(result).toBe(true)
    })
  })

  describe('listProjectMedia (not implemented)', () => {
    it.skip('should list all media for current project', async () => {
      const projectId = 'test-project'
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
            page_id: 'page-2',
            type: 'video',
            original_name: 'test2.mp4'
          }
        }
      ]

      ;(fileStorage as any)._currentProjectId = projectId
      mockInvoke.mockResolvedValueOnce(mockMediaList)

      const result = await fileStorage.listProjectMedia()

      expect(mockInvoke).toHaveBeenCalledWith('list_project_media', { projectId })
      expect(result).toEqual(mockMediaList)
    })

    it.skip('should return empty array when no project is loaded', async () => {
      ;(fileStorage as any)._currentProjectId = null

      const result = await fileStorage.listProjectMedia()

      expect(result).toEqual([])
      expect(mockInvoke).not.toHaveBeenCalled()
    })

    it.skip('should handle list errors gracefully', async () => {
      const projectId = 'test-project'
      ;(fileStorage as any)._currentProjectId = projectId
      mockInvoke.mockRejectedValueOnce(new Error('List failed'))

      const result = await fileStorage.listProjectMedia()

      expect(result).toEqual([])
    })
  })

  describe('getMedia', () => {
    it('should get media data by ID', async () => {
      const projectId = 'test-project'
      const projectPath = '/path/to/project.scormproj'
      const mediaId = 'media-123'
      // Use valid base64 string
      const testData = 'test data'
      const base64Data = btoa(testData)
      const mockMediaData = {
        id: mediaId,
        data: base64Data,
        metadata: {
          page_id: 'page-1',
          type: 'image',
          original_name: 'test.png'
        }
      }

      ;(fileStorage as any)._currentProjectId = projectId
      ;(fileStorage as any)._currentProjectPath = projectPath
      mockInvoke.mockResolvedValueOnce(mockMediaData)

      const result = await fileStorage.getMedia(mediaId)

      expect(mockInvoke).toHaveBeenCalledWith('get_media', {
        projectId: projectPath,
        mediaId
      })
      // Result should be a MediaInfo object with converted data
      expect(result).toMatchObject({
        id: mediaId,
        mediaType: 'image',
        size: testData.length // Size should match original data
      })
    })

    it('should return null when no project is loaded', async () => {
      const mediaId = 'media-123'
      ;(fileStorage as any)._currentProjectId = null

      const result = await fileStorage.getMedia(mediaId)
      expect(result).toBeNull()
    })

    it('should return null on get errors', async () => {
      const projectId = 'test-project'
      const mediaId = 'non-existent'
      
      ;(fileStorage as any)._currentProjectId = projectId
      mockInvoke.mockRejectedValueOnce(new Error('Media not found'))

      const result = await fileStorage.getMedia(mediaId)
      expect(result).toBeNull()
    })
  })

  describe('Media operations with saveProjectAs', () => {
    it.skip('should copy media folder when saving project as new', async () => {
      // Skip this test as it requires dialog mocking which is complex
      // The actual functionality is tested in integration tests
    })
  })

  describe('Media cleanup on project switch', () => {
    it.skip('should cleanup media service when switching projects', async () => {
      // Skip this test as MediaService is mocked and cleanup tracking
      // requires a more complex setup. Covered in integration tests.
    })
  })
})