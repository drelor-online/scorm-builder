import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Tauri's invoke function
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

import { FileStorage } from '../FileStorage'

describe('FileStorage - Export with Media', () => {
  let fileStorage: FileStorage
  
  beforeEach(() => {
    fileStorage = new FileStorage()
    mockInvoke.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Export Project as ZIP with Media', () => {
    it('should export project as ZIP including media files', async () => {
      const projectPath = 'C:\\projects\\test.scormproj'
      const projectId = '1234567890'
      
      fileStorage['_currentProjectPath'] = projectPath
      fileStorage['_currentProjectId'] = projectId
      
      const projectData = {
        project: { id: projectId, name: 'Test Project' },
        course_content: {
          pages: [{
            id: 'page1',
            media: {
              image: `media/${projectId}/image.jpg`,
              audio: `media/${projectId}/audio.mp3`
            }
          }]
        }
      }
      
      const mediaFiles = [
        { path: 'image.jpg', data: new ArrayBuffer(1000) },
        { path: 'audio.mp3', data: new ArrayBuffer(5000) }
      ]
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'load_project') {
          return Promise.resolve(projectData)
        }
        if (cmd === 'get_media_files') {
          return Promise.resolve(mediaFiles)
        }
        if (cmd === 'create_project_zip') {
          return Promise.resolve({
            zipData: new ArrayBuffer(10000),
            fileCount: 3, // project.json + 2 media files
            totalSize: 10000
          })
        }
        return Promise.resolve(undefined)
      })
      
      const result = await fileStorage.exportProject()
      
      // Should have called create_project_zip
      expect(mockInvoke).toHaveBeenCalledWith('create_project_zip', {
        projectPath,
        projectId,
        includeMedia: true
      })
      
      // Should return a Blob
      expect(result).toBeInstanceOf(Blob)
      expect(result.type).toBe('application/zip')
    })

    it('should handle export when no media exists', async () => {
      const projectPath = 'C:\\projects\\test.scormproj'
      const projectId = '1234567890'
      
      fileStorage['_currentProjectPath'] = projectPath
      fileStorage['_currentProjectId'] = projectId
      
      const projectData = {
        project: { id: projectId, name: 'Test Project' },
        course_content: { pages: [] }
      }
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'load_project') {
          return Promise.resolve(projectData)
        }
        if (cmd === 'get_media_files') {
          return Promise.resolve([])
        }
        if (cmd === 'create_project_zip') {
          return Promise.resolve({
            zipData: new ArrayBuffer(1000),
            fileCount: 1, // just project.json
            totalSize: 1000
          })
        }
        return Promise.resolve(undefined)
      })
      
      const result = await fileStorage.exportProject()
      
      expect(mockInvoke).toHaveBeenCalledWith('create_project_zip', {
        projectPath,
        projectId,
        includeMedia: true
      })
      
      expect(result).toBeInstanceOf(Blob)
    })

    it('should handle YouTube videos in export', async () => {
      const projectPath = 'C:\\projects\\test.scormproj'
      const projectId = '1234567890'
      
      fileStorage['_currentProjectPath'] = projectPath
      fileStorage['_currentProjectId'] = projectId
      
      const projectData = {
        project: { id: projectId, name: 'Test Project' },
        course_content: {
          pages: [{
            id: 'page1',
            media: {
              video: 'https://youtube.com/watch?v=abc123'
            }
          }]
        }
      }
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'load_project') {
          return Promise.resolve(projectData)
        }
        if (cmd === 'get_media_files') {
          return Promise.resolve([])
        }
        if (cmd === 'create_project_zip') {
          return Promise.resolve({
            zipData: new ArrayBuffer(1500),
            fileCount: 1,
            totalSize: 1500,
            metadata: {
              hasYouTubeVideos: true,
              youtubeCount: 1
            }
          })
        }
        return Promise.resolve(undefined)
      })
      
      const result = await fileStorage.exportProject()
      
      expect(result).toBeInstanceOf(Blob)
      expect(result.type).toBe('application/zip')
    })

    it('should provide progress callback for large exports', async () => {
      const projectPath = 'C:\\projects\\test.scormproj'
      const projectId = '1234567890'
      
      fileStorage['_currentProjectPath'] = projectPath
      fileStorage['_currentProjectId'] = projectId
      
      const progressCallback = vi.fn()
      const projectData = {
        project: { id: projectId, name: 'Test Project' },
        course_content: { pages: [] }
      }
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'load_project') {
          return Promise.resolve(projectData)
        }
        if (cmd === 'create_project_zip_with_progress') {
          // Simulate progress updates
          progressCallback({ percent: 25, message: 'Collecting files...' })
          progressCallback({ percent: 50, message: 'Creating ZIP...' })
          progressCallback({ percent: 100, message: 'Complete' })
          
          return Promise.resolve({
            zipData: new ArrayBuffer(50000),
            fileCount: 100,
            totalSize: 50000
          })
        }
        return Promise.resolve(undefined)
      })
      
      const result = await fileStorage.exportProjectWithProgress(progressCallback)
      
      expect(progressCallback).toHaveBeenCalledTimes(3)
      expect(progressCallback).toHaveBeenCalledWith({
        percent: 100,
        message: 'Complete'
      })
      
      expect(result).toBeInstanceOf(Blob)
    })

    it('should handle missing media files gracefully', async () => {
      const projectPath = 'C:\\projects\\test.scormproj'
      const projectId = '1234567890'
      
      fileStorage['_currentProjectPath'] = projectPath
      fileStorage['_currentProjectId'] = projectId
      
      const projectData = {
        project: { id: projectId, name: 'Test Project' },
        course_content: {
          pages: [{
            id: 'page1',
            media: {
              image: `media/${projectId}/missing.jpg`
            }
          }]
        }
      }
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'load_project') {
          return Promise.resolve(projectData)
        }
        if (cmd === 'get_media_files') {
          // Return empty - file is missing
          return Promise.resolve([])
        }
        if (cmd === 'create_project_zip') {
          return Promise.resolve({
            zipData: new ArrayBuffer(1000),
            fileCount: 1,
            totalSize: 1000,
            warnings: ['Missing media file: missing.jpg']
          })
        }
        return Promise.resolve(undefined)
      })
      
      const result = await fileStorage.exportProject()
      
      // Should still export successfully
      expect(result).toBeInstanceOf(Blob)
      expect(mockInvoke).toHaveBeenCalledWith('create_project_zip', {
        projectPath,
        projectId,
        includeMedia: true
      })
    })
  })
})