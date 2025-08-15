import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileStorage } from '../FileStorage'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock MediaService
vi.mock('../MediaService', () => ({
  MediaService: vi.fn().mockImplementation(() => ({
    cleanup: vi.fn()
  }))
}))

// Mock debugLogger
vi.mock('../../utils/debugLogger', () => ({
  debugLogger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

describe('deleteProject API Consistency Tests', () => {
  let fileStorage: FileStorage
  const mockInvoke = invoke as any

  beforeEach(() => {
    vi.clearAllMocks()
    fileStorage = new FileStorage()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('deleteProject with different input formats', () => {
    it('should accept a full project path', async () => {
      const projectPath = '/path/to/project.scormproj'
      
      // Path is already a path, so no list_projects call needed
      mockInvoke
        .mockResolvedValueOnce(undefined) // delete_project
      
      await fileStorage.deleteProject(projectPath)
      
      // Should call delete_project with the file path
      expect(mockInvoke).toHaveBeenCalledWith('delete_project', {
        filePath: projectPath
      })
    })

    it('should accept a project ID and resolve to path', async () => {
      const projectId = 'project-123'
      const projectPath = `/path/to/project_${projectId}.scormproj`
      
      // Mock list_projects for ID resolution
      mockInvoke
        .mockResolvedValueOnce([
          { id: projectId, path: projectPath, name: 'Test Project' }
        ]) // list_projects
        .mockResolvedValueOnce(undefined) // delete_project
      
      await fileStorage.deleteProject(projectId)
      
      // Should call list_projects to resolve the ID
      expect(mockInvoke).toHaveBeenNthCalledWith(1, 'list_projects')
      
      // Then call delete_project with the resolved path
      expect(mockInvoke).toHaveBeenNthCalledWith(2, 'delete_project', {
        filePath: projectPath
      })
    })

    it('should accept a relative project path', async () => {
      const relativePath = 'projects/my-project.scormproj'
      const absolutePath = '/absolute/path/to/projects/my-project.scormproj'
      
      // Relative path is still a path (has .scormproj), so no list_projects call
      mockInvoke
        .mockResolvedValueOnce(undefined) // delete_project
      
      await fileStorage.deleteProject(relativePath)
      
      expect(mockInvoke).toHaveBeenCalledWith('delete_project', {
        filePath: relativePath
      })
    })

    it('should handle .scormproj filename with underscore format', async () => {
      const filename = 'MyProject_abc123.scormproj'
      const fullPath = `/projects/${filename}`
      
      // Filename with .scormproj is a path, no list_projects call
      mockInvoke
        .mockResolvedValueOnce(undefined) // delete_project
      
      await fileStorage.deleteProject(filename)
      
      expect(mockInvoke).toHaveBeenCalledWith('delete_project', {
        filePath: filename
      })
    })
  })

  describe('deleteProject state management', () => {
    it('should clear current project if it matches the deleted project (by path)', async () => {
      const projectPath = '/path/to/current-project.scormproj'
      const projectId = 'current-123'
      
      // Set current project
      ;(fileStorage as any)._currentProjectPath = projectPath
      ;(fileStorage as any)._currentProjectId = projectId
      
      // Path input - no list_projects needed
      mockInvoke
        .mockResolvedValueOnce(undefined) // delete_project
      
      await fileStorage.deleteProject(projectPath)
      
      // Should clear current project references
      expect((fileStorage as any)._currentProjectPath).toBeNull()
      expect((fileStorage as any)._currentProjectId).toBeNull()
    })

    it('should clear current project if it matches the deleted project (by ID)', async () => {
      const projectPath = '/path/to/current-project.scormproj'
      const projectId = 'current-456'
      
      // Set current project
      ;(fileStorage as any)._currentProjectPath = projectPath
      ;(fileStorage as any)._currentProjectId = projectId
      
      // ID input - needs list_projects
      mockInvoke
        .mockResolvedValueOnce([
          { id: projectId, path: projectPath, name: 'Current Project' }
        ]) // list_projects
        .mockResolvedValueOnce(undefined) // delete_project
      
      await fileStorage.deleteProject(projectId)
      
      // Should clear current project references
      expect((fileStorage as any)._currentProjectPath).toBeNull()
      expect((fileStorage as any)._currentProjectId).toBeNull()
    })

    it('should not clear current project if it does not match', async () => {
      const currentPath = '/path/to/current-project.scormproj'
      const currentId = 'current-789'
      const otherPath = '/path/to/other-project.scormproj'
      const otherId = 'other-123'
      
      // Set current project
      ;(fileStorage as any)._currentProjectPath = currentPath
      ;(fileStorage as any)._currentProjectId = currentId
      
      // ID input - needs list_projects
      mockInvoke
        .mockResolvedValueOnce([
          { id: otherId, path: otherPath, name: 'Other Project' }
        ]) // list_projects
        .mockResolvedValueOnce(undefined) // delete_project
      
      await fileStorage.deleteProject(otherId)
      
      // Should NOT clear current project references
      expect((fileStorage as any)._currentProjectPath).toBe(currentPath)
      expect((fileStorage as any)._currentProjectId).toBe(currentId)
    })

    it('should clear project state when deleting current project', async () => {
      const projectPath = '/path/to/current-project.scormproj'
      const projectId = 'cleanup-test'
      
      // Set current project
      ;(fileStorage as any)._currentProjectPath = projectPath
      ;(fileStorage as any)._currentProjectId = projectId
      
      // Path input - no list_projects needed
      mockInvoke
        .mockResolvedValueOnce(undefined) // delete_project
      
      await fileStorage.deleteProject(projectPath)
      
      // Should clear project state
      expect((fileStorage as any)._currentProjectPath).toBeNull()
      expect((fileStorage as any)._currentProjectId).toBeNull()
    })
  })

  describe('deleteProject error handling', () => {
    it('should handle deletion errors gracefully', async () => {
      const projectPath = '/path/to/project.scormproj'
      
      // Path input - no list_projects needed
      mockInvoke
        .mockRejectedValueOnce(new Error('Permission denied')) // delete_project
      
      await expect(fileStorage.deleteProject(projectPath))
        .rejects.toThrow('Permission denied')
    })

    it('should handle invalid project ID', async () => {
      const invalidId = 'not-a-project-file.txt'
      
      // ID that doesn't exist in list_projects
      mockInvoke
        .mockResolvedValueOnce([]) // list_projects returns empty array
      
      await expect(fileStorage.deleteProject(invalidId))
        .rejects.toThrow('Project not found')
    })

    it('should handle non-existent project', async () => {
      const nonExistentId = 'non-existent-123'
      
      // ID input - needs list_projects
      mockInvoke
        .mockResolvedValueOnce([]) // list_projects returns empty array
      
      await expect(fileStorage.deleteProject(nonExistentId))
        .rejects.toThrow('Project not found')
    })
  })

  describe('deleteProject API contract', () => {
    it('should always use filePath parameter for delete_project command', async () => {
      const testCases = [
        { 
          input: 'project-123', 
          resolved: '/path/to/project-123.scormproj',
          isId: true
        },
        { 
          input: '/full/path/project.scormproj', 
          resolved: '/full/path/project.scormproj',
          isId: false
        },
        { 
          input: 'MyProject_456.scormproj', 
          resolved: 'MyProject_456.scormproj',
          isId: false
        },
        { 
          input: 'relative/path/project.scormproj', 
          resolved: 'relative/path/project.scormproj',
          isId: false
        }
      ]
      
      for (const testCase of testCases) {
        vi.clearAllMocks()
        
        if (testCase.isId) {
          // ID input - needs list_projects
          mockInvoke
            .mockResolvedValueOnce([
              { id: testCase.input, path: testCase.resolved, name: 'Test Project' }
            ]) // list_projects
            .mockResolvedValueOnce(undefined) // delete_project
        } else {
          // Path input - no list_projects needed
          mockInvoke
            .mockResolvedValueOnce(undefined) // delete_project
        }
        
        await fileStorage.deleteProject(testCase.input)
        
        // Verify the API contract: always uses 'filePath' parameter
        expect(mockInvoke).toHaveBeenCalledWith('delete_project', {
          filePath: testCase.resolved
        })
        
        // Should never use 'projectId' parameter
        expect(mockInvoke).not.toHaveBeenCalledWith('delete_project', 
          expect.objectContaining({ projectId: expect.anything() })
        )
      }
    })

    it('should maintain backwards compatibility with both path and ID inputs', async () => {
      // This test ensures that existing code using either format continues to work
      const fileStorage1 = new FileStorage()
      const fileStorage2 = new FileStorage()
      
      // Test with path
      const path = '/path/to/project.scormproj'
      mockInvoke
        .mockResolvedValueOnce(undefined) // delete_project
      
      await expect(fileStorage1.deleteProject(path)).resolves.not.toThrow()
      
      // Test with ID
      const id = 'project-789'
      const resolvedPath = `/path/to/project_${id}.scormproj`
      mockInvoke
        .mockResolvedValueOnce([
          { id: id, path: resolvedPath, name: 'Test Project' }
        ]) // list_projects
        .mockResolvedValueOnce(undefined) // delete_project
      
      await expect(fileStorage2.deleteProject(id)).resolves.not.toThrow()
    })
  })
})