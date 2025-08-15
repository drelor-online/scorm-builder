import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileStorage } from '../FileStorage'

// Mock Tauri's invoke function
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

describe('FileStorage - Project Path Handling', () => {
  let fileStorage: FileStorage
  
  beforeEach(() => {
    fileStorage = new FileStorage()
    mockInvoke.mockClear()
  })

  describe('Project ID vs Path Resolution', () => {
    it('should accept a full project path for deleteProject', async () => {
      const projectPath = 'C:/Users/test/Projects/MyProject_1234567890.scormproj'
      
      mockInvoke.mockResolvedValue(undefined)
      
      await fileStorage.deleteProject(projectPath)
      
      // Should pass the path directly to the backend
      expect(mockInvoke).toHaveBeenCalledWith('delete_project', {
        filePath: projectPath
      })
    })

    it('should accept a numeric project ID and resolve to path', async () => {
      const projectId = '1234567890'
      const expectedPath = 'C:/Users/test/Projects/MyProject_1234567890.scormproj'
      
      // Mock the list_projects to return our test project
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'list_projects') {
          return Promise.resolve([{
            id: projectId,
            name: 'MyProject',
            path: expectedPath,
            lastModified: new Date().toISOString()
          }])
        }
        return Promise.resolve(undefined)
      })
      
      await fileStorage.deleteProject(projectId)
      
      // Should resolve the ID to a path and then delete
      expect(mockInvoke).toHaveBeenCalledWith('delete_project', {
        filePath: expectedPath
      })
    })

    it('should throw error if project ID cannot be resolved', async () => {
      const unknownId = '9999999999'
      
      // Mock empty project list
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'list_projects') {
          return Promise.resolve([])
        }
        return Promise.resolve(undefined)
      })
      
      await expect(fileStorage.deleteProject(unknownId))
        .rejects
        .toThrow('Project not found')
    })
  })

  describe('Helper Functions', () => {
    it('should correctly identify project paths', () => {
      expect(fileStorage.isProjectPath('C:/Projects/Test_123.scormproj')).toBe(true)
      expect(fileStorage.isProjectPath('/home/user/Test_123.scormproj')).toBe(true)
      expect(fileStorage.isProjectPath('Test_123.scormproj')).toBe(true)
      expect(fileStorage.isProjectPath('1234567890')).toBe(false)
      expect(fileStorage.isProjectPath('test-project')).toBe(false)
    })

    it('should resolve project ID to path', async () => {
      const projectId = '1234567890'
      const expectedPath = 'C:/Projects/MyProject_1234567890.scormproj'
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'list_projects') {
          return Promise.resolve([{
            id: projectId,
            name: 'MyProject',
            path: expectedPath
          }])
        }
        return Promise.resolve(undefined)
      })
      
      const resolvedPath = await fileStorage.resolveProjectPath(projectId)
      expect(resolvedPath).toBe(expectedPath)
    })

    it('should return path unchanged if already a path', async () => {
      const projectPath = 'C:/Projects/Test_123.scormproj'
      
      const resolvedPath = await fileStorage.resolveProjectPath(projectPath)
      expect(resolvedPath).toBe(projectPath)
      
      // Should not call list_projects if already a path
      expect(mockInvoke).not.toHaveBeenCalledWith('list_projects')
    })
  })

  describe('recoverFromBackup API', () => {
    it('should accept project ID and find backup automatically', async () => {
      const projectId = '1234567890'
      const projectPath = 'C:/Projects/MyProject_1234567890.scormproj'
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'list_projects') {
          return Promise.resolve([{
            id: projectId,
            path: projectPath
          }])
        }
        if (cmd === 'recover_from_backup') {
          return Promise.resolve({
            pages: [],
            metadata: { recovered: true }
          })
        }
        return Promise.resolve(undefined)
      })
      
      const result = await fileStorage.recoverFromBackup(projectId)
      
      // Should pass the resolved path to backend
      expect(mockInvoke).toHaveBeenCalledWith('recover_from_backup', {
        projectId: projectPath
      })
      expect(result.metadata.recovered).toBe(true)
    })

    it('should accept project path directly', async () => {
      const projectPath = 'C:/Projects/MyProject_1234567890.scormproj'
      
      mockInvoke.mockResolvedValue({
        pages: [],
        metadata: { recovered: true }
      })
      
      const result = await fileStorage.recoverFromBackup(projectPath)
      
      // Should pass the path directly
      expect(mockInvoke).toHaveBeenCalledWith('recover_from_backup', {
        projectId: projectPath
      })
    })

    it('should NOT accept backup file path', async () => {
      const backupPath = 'C:/Projects/MyProject_1234567890.scormproj.backup'
      
      // Should reject .backup extension
      await expect(fileStorage.recoverFromBackup(backupPath))
        .rejects
        .toThrow('Invalid project identifier: backup files cannot be specified directly')
    })
  })
})