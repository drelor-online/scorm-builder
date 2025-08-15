import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Tauri's invoke function
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

// Mock save dialog
const mockSave = vi.fn()
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: (options?: any) => mockSave(options),
  open: vi.fn()
}))

import { FileStorage } from '../FileStorage'

describe('FileStorage - Save As with Media', () => {
  let fileStorage: FileStorage
  
  beforeEach(() => {
    fileStorage = new FileStorage()
    mockInvoke.mockClear()
    mockSave.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Save As with Media Copying', () => {
    it('should copy media folder when saving project as', async () => {
      const originalPath = 'C:\\projects\\original.scormproj'
      const newPath = 'C:\\projects\\new.scormproj'
      
      // Setup current project
      fileStorage['_currentProjectPath'] = originalPath
      fileStorage['_currentProjectId'] = '1234567890'
      
      // Mock save dialog to return new path
      mockSave.mockResolvedValue(newPath)
      
      // Mock load_project to return project data
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'load_project') {
          return Promise.resolve({
            project: { id: '1234567890', name: 'Test Project' },
            course_content: { pages: [] }
          })
        }
        if (cmd === 'save_project') {
          return Promise.resolve(undefined)
        }
        if (cmd === 'copy_media_folder') {
          return Promise.resolve({ copiedFiles: 10 })
        }
        return Promise.resolve(undefined)
      })
      
      await fileStorage.saveProjectAs()
      
      // Should have called copy_media_folder
      expect(mockInvoke).toHaveBeenCalledWith('copy_media_folder', {
        sourceProjectId: '1234567890',
        targetPath: newPath
      })
      
      // Should update current path
      expect(fileStorage['_currentProjectPath']).toBe(newPath)
    })

    it('should handle save-as when no media exists', async () => {
      const originalPath = 'C:\\projects\\original.scormproj'
      const newPath = 'C:\\projects\\new.scormproj'
      
      fileStorage['_currentProjectPath'] = originalPath
      fileStorage['_currentProjectId'] = '1234567890'
      
      mockSave.mockResolvedValue(newPath)
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'load_project') {
          return Promise.resolve({
            project: { id: '1234567890', name: 'Test Project' },
            course_content: { pages: [] }
          })
        }
        if (cmd === 'save_project') {
          return Promise.resolve(undefined)
        }
        if (cmd === 'copy_media_folder') {
          // No media to copy
          return Promise.resolve({ copiedFiles: 0 })
        }
        return Promise.resolve(undefined)
      })
      
      await fileStorage.saveProjectAs()
      
      // Should still call copy_media_folder (even if no files)
      expect(mockInvoke).toHaveBeenCalledWith('copy_media_folder', {
        sourceProjectId: '1234567890',
        targetPath: newPath
      })
    })

    it('should continue save-as even if media copy fails', async () => {
      const originalPath = 'C:\\projects\\original.scormproj'
      const newPath = 'C:\\projects\\new.scormproj'
      
      fileStorage['_currentProjectPath'] = originalPath
      fileStorage['_currentProjectId'] = '1234567890'
      
      mockSave.mockResolvedValue(newPath)
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'load_project') {
          return Promise.resolve({
            project: { id: '1234567890', name: 'Test Project' },
            course_content: { pages: [] }
          })
        }
        if (cmd === 'save_project') {
          return Promise.resolve(undefined)
        }
        if (cmd === 'copy_media_folder') {
          return Promise.reject(new Error('Media copy failed'))
        }
        return Promise.resolve(undefined)
      })
      
      // Should not throw even if media copy fails
      await expect(fileStorage.saveProjectAs()).resolves.not.toThrow()
      
      // Should still update current path
      expect(fileStorage['_currentProjectPath']).toBe(newPath)
    })
  })

  describe('Media Path Updates', () => {
    it('should update media references in copied project', async () => {
      const originalPath = 'C:\\projects\\original.scormproj'
      const newPath = 'C:\\projects\\new.scormproj'
      
      fileStorage['_currentProjectPath'] = originalPath
      fileStorage['_currentProjectId'] = '1234567890'
      
      mockSave.mockResolvedValue(newPath)
      
      const projectData = {
        project: { id: '1234567890', name: 'Test Project' },
        course_content: {
          pages: [{
            id: 'page1',
            media: {
              image: 'media/1234567890/image.jpg',
              audio: 'media/1234567890/audio.mp3'
            }
          }]
        }
      }
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'load_project') {
          return Promise.resolve(projectData)
        }
        if (cmd === 'save_project') {
          return Promise.resolve(undefined)
        }
        if (cmd === 'copy_media_folder') {
          return Promise.resolve({ copiedFiles: 2 })
        }
        if (cmd === 'update_media_paths') {
          return Promise.resolve(undefined)
        }
        return Promise.resolve(undefined)
      })
      
      await fileStorage.saveProjectAs()
      
      // Should have called update_media_paths
      expect(mockInvoke).toHaveBeenCalledWith('update_media_paths', {
        projectData: expect.any(Object),
        oldProjectId: '1234567890',
        newPath: newPath
      })
    })
  })
})