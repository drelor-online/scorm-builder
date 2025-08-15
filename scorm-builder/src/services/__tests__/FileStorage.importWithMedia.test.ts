import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Tauri's invoke function
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

import { FileStorage } from '../FileStorage'

describe('FileStorage - Import with Media', () => {
  let fileStorage: FileStorage
  
  beforeEach(() => {
    fileStorage = new FileStorage()
    mockInvoke.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Import Project from ZIP with Media', () => {
    it('should import project from ZIP including media files', async () => {
      const zipBlob = new Blob(['zip content'], { type: 'application/zip' })
      const projectId = Date.now().toString()
      
      const extractedData = {
        projectData: {
          project: { id: 'original-id', name: 'Imported Project' },
          course_content: {
            pages: [{
              id: 'page1',
              media: {
                image: 'media/original-id/image.jpg',
                audio: 'media/original-id/audio.mp3'
              }
            }]
          }
        },
        mediaFiles: [
          { path: 'image.jpg', size: 1000 },
          { path: 'audio.mp3', size: 5000 }
        ]
      }
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'extract_project_zip') {
          return Promise.resolve(extractedData)
        }
        if (cmd === 'get_projects_dir') {
          return Promise.resolve('C:\\projects')
        }
        if (cmd === 'save_project_with_media') {
          return Promise.resolve({
            projectPath: `C:\\projects\\imported_${projectId}.scormproj`,
            mediaCount: 2
          })
        }
        if (cmd === 'update_imported_media_paths') {
          return Promise.resolve(undefined)
        }
        return Promise.resolve(undefined)
      })
      
      await fileStorage.importProjectFromZip(zipBlob)
      
      // Should have called extract_project_zip
      expect(mockInvoke).toHaveBeenCalledWith('extract_project_zip', {
        zipData: expect.any(ArrayBuffer)
      })
      
      // Should have called save_project_with_media
      expect(mockInvoke).toHaveBeenCalledWith('save_project_with_media', expect.objectContaining({
        projectData: expect.any(Object),
        mediaFiles: expect.any(Array),
        newProjectId: expect.any(String)
      }))
      
      // Should update current project
      expect(fileStorage['_currentProjectPath']).toContain('imported_')
    })

    it('should handle import without media files', async () => {
      const zipBlob = new Blob(['zip content'], { type: 'application/zip' })
      
      const extractedData = {
        projectData: {
          project: { id: 'original-id', name: 'Simple Project' },
          course_content: { pages: [] }
        },
        mediaFiles: []
      }
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'extract_project_zip') {
          return Promise.resolve(extractedData)
        }
        if (cmd === 'get_projects_dir') {
          return Promise.resolve('C:\\projects')
        }
        if (cmd === 'save_project_with_media') {
          return Promise.resolve({
            projectPath: `C:\\projects\\imported_${Date.now()}.scormproj`,
            mediaCount: 0
          })
        }
        return Promise.resolve(undefined)
      })
      
      await fileStorage.importProjectFromZip(zipBlob)
      
      expect(mockInvoke).toHaveBeenCalledWith('save_project_with_media', expect.objectContaining({
        mediaFiles: []
      }))
    })

    it('should update media paths after import', async () => {
      const zipBlob = new Blob(['zip content'], { type: 'application/zip' })
      const newProjectId = Date.now().toString()
      
      const extractedData = {
        projectData: {
          project: { id: 'old-id', name: 'Project' },
          course_content: {
            pages: [{
              id: 'page1',
              media: {
                image: 'media/old-id/image.jpg'
              }
            }]
          }
        },
        mediaFiles: [{ path: 'image.jpg', size: 1000 }]
      }
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'extract_project_zip') {
          return Promise.resolve(extractedData)
        }
        if (cmd === 'get_projects_dir') {
          return Promise.resolve('C:\\projects')
        }
        if (cmd === 'save_project_with_media') {
          return Promise.resolve({
            projectPath: `C:\\projects\\imported_${newProjectId}.scormproj`,
            mediaCount: 1
          })
        }
        if (cmd === 'update_imported_media_paths') {
          return Promise.resolve(undefined)
        }
        return Promise.resolve(undefined)
      })
      
      await fileStorage.importProjectFromZip(zipBlob)
      
      // Should update media paths with new project ID
      expect(mockInvoke).toHaveBeenCalledWith('update_imported_media_paths', expect.objectContaining({
        oldProjectId: 'old-id',
        newProjectId: expect.any(String)
      }))
    })

    it('should validate imported data', async () => {
      const zipBlob = new Blob(['zip content'], { type: 'application/zip' })
      
      // Invalid project data (missing required fields)
      const invalidData = {
        projectData: {
          // Missing project field
          course_content: {}
        },
        mediaFiles: []
      }
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'extract_project_zip') {
          return Promise.resolve(invalidData)
        }
        return Promise.resolve(undefined)
      })
      
      // Should throw validation error
      await expect(fileStorage.importProjectFromZip(zipBlob))
        .rejects.toThrow('Invalid project data')
    })

    it('should handle corrupted ZIP files', async () => {
      const corruptedZip = new Blob(['corrupted'], { type: 'application/zip' })
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'extract_project_zip') {
          return Promise.reject(new Error('Invalid ZIP format'))
        }
        return Promise.resolve(undefined)
      })
      
      await expect(fileStorage.importProjectFromZip(corruptedZip))
        .rejects.toThrow('Failed to import project')
    })

    it('should sanitize file paths on import', async () => {
      const zipBlob = new Blob(['zip content'], { type: 'application/zip' })
      
      const extractedData = {
        projectData: {
          project: { id: '../../../etc/passwd', name: 'Malicious' },
          course_content: {
            pages: [{
              id: 'page1',
              media: {
                image: '../../sensitive/file.jpg'
              }
            }]
          }
        },
        mediaFiles: []
      }
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'extract_project_zip') {
          return Promise.resolve(extractedData)
        }
        if (cmd === 'get_projects_dir') {
          return Promise.resolve('C:\\projects')
        }
        if (cmd === 'save_project_with_media') {
          return Promise.resolve({
            projectPath: `C:\\projects\\imported_${Date.now()}.scormproj`,
            mediaCount: 0
          })
        }
        return Promise.resolve(undefined)
      })
      
      await fileStorage.importProjectFromZip(zipBlob)
      
      // Should sanitize the project ID
      expect(mockInvoke).toHaveBeenCalledWith('save_project_with_media', expect.objectContaining({
        projectData: expect.objectContaining({
          project: expect.objectContaining({
            id: expect.not.stringContaining('..')
          })
        })
      }))
    })
  })
})