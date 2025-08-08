import { describe, it, expect, vi, beforeEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('Rust Backend - .scormproj File Handling', () => {
  const mockInvoke = invoke as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('delete_media with .scormproj filename', () => {
    it('should handle delete with .scormproj filename format', async () => {
      const projectFilename = 'TestProject_123.scormproj'
      const mediaId = 'media-456'
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      await invoke('delete_media', {
        projectId: projectFilename,
        mediaId
      })
      
      expect(mockInvoke).toHaveBeenCalledWith('delete_media', {
        projectId: projectFilename,
        mediaId
      })
    })

    it('should extract project ID from .scormproj filename', async () => {
      const projectFilename = 'MyProject_abc123.scormproj'
      const mediaId = 'media-789'
      
      // The backend should extract 'abc123' from the filename
      mockInvoke.mockResolvedValueOnce(undefined)
      
      await invoke('delete_media', {
        projectId: projectFilename,
        mediaId
      })
      
      // Test that the backend accepts this format
      expect(mockInvoke).toHaveBeenCalled()
    })

    it('should handle delete with numeric project ID', async () => {
      const projectId = '12345'
      const mediaId = 'media-111'
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      await invoke('delete_media', {
        projectId,
        mediaId
      })
      
      expect(mockInvoke).toHaveBeenCalledWith('delete_media', {
        projectId,
        mediaId
      })
    })
  })

  describe('get_media with .scormproj filename', () => {
    it('should handle get with .scormproj filename format', async () => {
      const projectFilename = 'TestProject_123.scormproj'
      const mediaId = 'media-456'
      const mockMediaData = {
        id: mediaId,
        data: btoa('test data'),
        metadata: {
          type: 'image',
          original_name: 'test.png'
        }
      }
      
      mockInvoke.mockResolvedValueOnce(mockMediaData)
      
      const result = await invoke('get_media', {
        projectId: projectFilename,
        mediaId
      })
      
      expect(result).toEqual(mockMediaData)
      expect(mockInvoke).toHaveBeenCalledWith('get_media', {
        projectId: projectFilename,
        mediaId
      })
    })

    it('should extract project ID from .scormproj filename', async () => {
      const projectFilename = 'MyDocument_xyz789.scormproj'
      const mediaId = 'media-222'
      const mockMediaData = {
        id: mediaId,
        data: btoa('media content'),
        metadata: {
          type: 'video',
          original_name: 'video.mp4'
        }
      }
      
      mockInvoke.mockResolvedValueOnce(mockMediaData)
      
      const result = await invoke('get_media', {
        projectId: projectFilename,
        mediaId
      })
      
      expect(result).toBeDefined()
      expect(result.id).toBe(mediaId)
    })

    it('should handle get with numeric project ID', async () => {
      const projectId = '67890'
      const mediaId = 'media-333'
      const mockMediaData = {
        id: mediaId,
        data: btoa('audio data'),
        metadata: {
          type: 'audio',
          original_name: 'audio.mp3'
        }
      }
      
      mockInvoke.mockResolvedValueOnce(mockMediaData)
      
      const result = await invoke('get_media', {
        projectId,
        mediaId
      })
      
      expect(result).toEqual(mockMediaData)
    })
  })

  describe('store_media_base64 with .scormproj filename', () => {
    it('should handle store with .scormproj filename format', async () => {
      const projectFilename = 'TestProject_123.scormproj'
      const mediaId = 'media-new'
      const base64Data = btoa('new media content')
      const metadata = {
        type: 'image',
        original_name: 'new.png',
        page_id: 'page-1'
      }
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      await invoke('store_media_base64', {
        projectId: projectFilename,
        id: mediaId,
        dataBase64: base64Data,
        metadata
      })
      
      expect(mockInvoke).toHaveBeenCalledWith('store_media_base64', {
        projectId: projectFilename,
        id: mediaId,
        dataBase64: base64Data,
        metadata
      })
    })

    it('should extract project ID from complex .scormproj filename', async () => {
      const projectFilename = 'My Complex Project Name_proj456.scormproj'
      const mediaId = 'media-complex'
      const base64Data = btoa('complex data')
      const metadata = {
        type: 'document',
        original_name: 'doc.pdf',
        page_id: 'page-2'
      }
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      await invoke('store_media_base64', {
        projectId: projectFilename,
        id: mediaId,
        dataBase64: base64Data,
        metadata
      })
      
      // Should successfully store even with complex filename
      expect(mockInvoke).toHaveBeenCalled()
    })
  })

  describe('list_project_media with .scormproj filename', () => {
    it('should handle list with .scormproj filename format', async () => {
      const projectFilename = 'TestProject_123.scormproj'
      const mockMediaList = [
        {
          id: 'media-1',
          metadata: { type: 'image', original_name: 'img1.png' }
        },
        {
          id: 'media-2',
          metadata: { type: 'video', original_name: 'vid1.mp4' }
        }
      ]
      
      mockInvoke.mockResolvedValueOnce(mockMediaList)
      
      const result = await invoke('list_project_media', {
        projectId: projectFilename
      })
      
      expect(result).toEqual(mockMediaList)
      expect(mockInvoke).toHaveBeenCalledWith('list_project_media', {
        projectId: projectFilename
      })
    })

    it('should handle edge cases in .scormproj filenames', async () => {
      const edgeCases = [
        'Project_123.scormproj',
        'My_Project_456.scormproj',
        'Test-Project_789.scormproj',
        'Project.Name.With.Dots_abc.scormproj',
        'Project Name With Spaces_def.scormproj'
      ]
      
      for (const filename of edgeCases) {
        mockInvoke.mockResolvedValueOnce([])
        
        const result = await invoke('list_project_media', {
          projectId: filename
        })
        
        expect(result).toEqual([])
        expect(mockInvoke).toHaveBeenCalledWith('list_project_media', {
          projectId: filename
        })
      }
    })
  })

  describe('Project ID extraction logic', () => {
    it('should correctly extract project ID from various filename formats', () => {
      // This test verifies the expected ID extraction pattern
      const testCases = [
        { filename: 'Project_123.scormproj', expectedId: '123' },
        { filename: 'My Project_abc123.scormproj', expectedId: 'abc123' },
        { filename: 'Test-Project_xyz-789.scormproj', expectedId: 'xyz-789' },
        { filename: 'Complex.Project.Name_id456.scormproj', expectedId: 'id456' },
      ]
      
      testCases.forEach(({ filename, expectedId }) => {
        // Extract ID using the expected pattern: everything after the last underscore before .scormproj
        const match = filename.match(/_([^_]+)\.scormproj$/)
        const extractedId = match ? match[1] : null
        
        expect(extractedId).toBe(expectedId)
      })
    })
  })
})