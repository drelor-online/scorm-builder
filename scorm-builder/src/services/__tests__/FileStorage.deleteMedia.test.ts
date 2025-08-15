import { describe, it, expect, vi, beforeEach } from 'vitest'
import FileStorage from '../FileStorage'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('FileStorage - Delete Media', () => {
  let fileStorage: FileStorage

  beforeEach(() => {
    vi.clearAllMocks()
    fileStorage = new FileStorage()
    // Mock initialization
    vi.mocked(invoke).mockResolvedValue(true)
  })

  describe('deleteMedia', () => {
    it('should delete media file from Tauri backend', async () => {
      const mediaId = 'image-0'
      const projectId = 'test-project'
      
      // Set up FileStorage with project
      fileStorage['_currentProjectId'] = projectId
      fileStorage['_currentProjectPath'] = '/path/to/project.scormproj'
      
      // Mock successful deletion
      vi.mocked(invoke).mockResolvedValue(true)
      
      // Delete media
      const result = await fileStorage.deleteMedia(mediaId)
      
      // Should call Tauri delete_media command
      expect(invoke).toHaveBeenCalledWith('delete_media', {
        projectId,
        mediaId
      })
      
      // Should return true for success
      expect(result).toBe(true)
    })

    it('should handle deletion when no project is open', async () => {
      const mediaId = 'image-0'
      
      // No project open
      fileStorage['_currentProjectId'] = null
      
      // Should throw or return false
      try {
        const result = await fileStorage.deleteMedia(mediaId)
        expect(result).toBe(false)
      } catch (error: any) {
        expect(error.message).toContain('No project open')
      }
    })

    it('should handle deletion errors from Tauri', async () => {
      const mediaId = 'image-0'
      const projectId = 'test-project'
      
      fileStorage['_currentProjectId'] = projectId
      fileStorage['_currentProjectPath'] = '/path/to/project.scormproj'
      
      // Mock Tauri error
      vi.mocked(invoke).mockRejectedValue(new Error('File not found'))
      
      // Delete should handle error
      const result = await fileStorage.deleteMedia(mediaId)
      
      // Should return false on error
      expect(result).toBe(false)
    })

    it('should delete both media file and metadata', async () => {
      const mediaId = 'image-0'
      const projectId = 'test-project'
      
      fileStorage['_currentProjectId'] = projectId
      fileStorage['_currentProjectPath'] = '/path/to/project.scormproj'
      
      // Mock successful deletion
      vi.mocked(invoke).mockResolvedValue(true)
      
      // Delete media
      await fileStorage.deleteMedia(mediaId)
      
      // Should delete both the media file and its metadata
      expect(invoke).toHaveBeenCalledWith('delete_media', {
        projectId,
        mediaId
      })
    })
  })
})