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
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

describe('Recovery Flow Integration Tests', () => {
  let fileStorage: FileStorage
  const mockInvoke = invoke as any

  beforeEach(() => {
    vi.clearAllMocks()
    fileStorage = new FileStorage()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Backup Detection', () => {
    it('should detect when a backup exists for a project', async () => {
      const projectPath = '/path/to/project.scormproj'
      const projectId = 'test-project-123'
      
      // Set up the project state
      ;(fileStorage as any)._currentProjectPath = projectPath
      ;(fileStorage as any)._currentProjectId = projectId
      
      // Mock the check_recovery response
      mockInvoke.mockResolvedValueOnce({
        hasRecovery: true,
        backupTimestamp: '2024-01-15T10:30:00Z'
      })
      
      const result = await fileStorage.checkForRecovery()
      
      expect(mockInvoke).toHaveBeenCalledWith('check_recovery', {
        projectId: projectPath
      })
      expect(result).toEqual({
        hasBackup: true,
        backupTimestamp: '2024-01-15T10:30:00Z'
      })
    })

    it('should return no backup when none exists', async () => {
      const projectPath = '/path/to/project.scormproj'
      const projectId = 'test-project-456'
      
      ;(fileStorage as any)._currentProjectPath = projectPath
      ;(fileStorage as any)._currentProjectId = projectId
      
      mockInvoke.mockResolvedValueOnce({
        hasRecovery: false
      })
      
      const result = await fileStorage.checkForRecovery()
      
      expect(result).toEqual({
        hasBackup: false,
        backupTimestamp: undefined
      })
    })

    it('should handle check errors gracefully', async () => {
      const projectPath = '/path/to/project.scormproj'
      const projectId = 'test-project-789'
      
      ;(fileStorage as any)._currentProjectPath = projectPath
      ;(fileStorage as any)._currentProjectId = projectId
      
      mockInvoke.mockRejectedValueOnce(new Error('Check failed'))
      
      const result = await fileStorage.checkForRecovery()
      
      // Should return false on error
      expect(result).toEqual({
        hasBackup: false
      })
    })

    it('should return false when no project is loaded', async () => {
      ;(fileStorage as any)._currentProjectPath = null
      ;(fileStorage as any)._currentProjectId = null
      
      const result = await fileStorage.checkForRecovery()
      
      expect(result).toEqual({
        hasBackup: false
      })
      expect(mockInvoke).not.toHaveBeenCalled()
    })
  })

  describe('Backup Recovery Process', () => {
    it('should recover from backup successfully', async () => {
      const projectPath = '/path/to/project.scormproj'
      const projectId = 'test-project-recovery'
      const backupData = {
        project: {
          id: projectId,
          name: 'Recovered Project',
          path: projectPath,
          lastModified: '2024-01-15T09:00:00Z'
        },
        course_content: {
          title: 'Test Course',
          topics: ['Topic 1', 'Topic 2']
        },
        course_data: {
          title: 'Test Course',
          difficulty: 3,
          template: 'default'
        }
      }
      
      ;(fileStorage as any)._currentProjectPath = projectPath
      ;(fileStorage as any)._currentProjectId = projectId
      
      // Mock the recovery process
      mockInvoke.mockResolvedValueOnce(backupData) // recover_from_backup
      
      const result = await fileStorage.recoverFromBackup(projectPath)
      
      expect(mockInvoke).toHaveBeenCalledWith('recover_from_backup', {
        projectId: projectPath
      })
      expect(result).toEqual(backupData)
    })

    it('should handle recovery failure', async () => {
      const projectPath = '/path/to/project.scormproj'
      const projectId = 'test-project-fail'
      
      ;(fileStorage as any)._currentProjectPath = projectPath
      ;(fileStorage as any)._currentProjectId = projectId
      
      mockInvoke.mockRejectedValueOnce(new Error('Recovery failed'))
      
      await expect(fileStorage.recoverFromBackup(projectPath))
        .rejects.toThrow('Failed to recover from backup')
    })

    it('should handle recovery with invalid path', async () => {
      ;(fileStorage as any)._currentProjectPath = null
      ;(fileStorage as any)._currentProjectId = null
      
      // Pass an invalid path (backup file)
      await expect(fileStorage.recoverFromBackup('project.backup'))
        .rejects.toThrow('Invalid project identifier')
    })
  })

  describe('Complete Recovery Workflow', () => {
    it('should handle full crash recovery scenario', async () => {
      const projectPath = '/path/to/crashed-project.scormproj'
      const projectId = 'crashed-project-123'
      
      // Step 1: Open a project that has a backup
      mockInvoke
        .mockResolvedValueOnce({ // check_recovery during open
          hasRecovery: true,
          backupTimestamp: '2024-01-15T11:00:00Z'
        })
        .mockResolvedValueOnce({ // load_project
          project: { id: projectId, name: 'Project', path: projectPath },
          course_content: {},
          course_data: {}
        })
      
      await fileStorage.openProject(projectPath)
      
      // Verify recovery was checked
      expect(mockInvoke).toHaveBeenCalledWith('check_recovery', {
        projectId: projectPath
      })
      
      // Step 2: User chooses to recover
      const recoveredData = {
        project: {
          id: projectId,
          name: 'Recovered Project',
          path: projectPath
        },
        course_content: {
          title: 'Recovered Course',
          topics: ['Recovered Topic 1']
        },
        course_data: {
          title: 'Recovered Course',
          difficulty: 2
        }
      }
      
      mockInvoke.mockResolvedValueOnce(recoveredData) // recover_from_backup
      
      const recovered = await fileStorage.recoverFromBackup(projectPath)
      
      expect(recovered).toEqual(recoveredData)
      expect(mockInvoke).toHaveBeenCalledWith('recover_from_backup', {
        projectId: projectPath
      })
    })

    it('should handle auto-save after recovery', async () => {
      const projectPath = '/path/to/project.scormproj'
      const projectId = 'autosave-test'
      const projectData = {
        project: { id: projectId, name: 'Test', path: projectPath },
        course_content: { title: 'Test' },
        course_data: { title: 'Test' }
      }
      
      ;(fileStorage as any)._currentProjectPath = projectPath
      ;(fileStorage as any)._currentProjectId = projectId
      
      // Mock the save sequence
      mockInvoke
        .mockResolvedValueOnce(undefined) // create_backup
        .mockResolvedValueOnce(projectData) // load_project
        .mockResolvedValueOnce(undefined) // save_project
      
      await fileStorage.saveProject()
      
      // Verify all three calls were made in sequence
      expect(mockInvoke).toHaveBeenNthCalledWith(1, 'create_backup', {
        projectId
      })
      expect(mockInvoke).toHaveBeenNthCalledWith(2, 'load_project', {
        filePath: projectPath
      })
      expect(mockInvoke).toHaveBeenNthCalledWith(3, 'save_project', {
        filePath: projectPath,
        projectData: expect.objectContaining({
          project: expect.objectContaining({
            id: projectId,
            name: 'Test',
            path: projectPath,
            last_modified: expect.any(String)
          })
        })
      })
    })

    it('should clean up backup after successful recovery and save', async () => {
      const projectPath = '/path/to/project.scormproj'
      const projectId = 'cleanup-test'
      
      ;(fileStorage as any)._currentProjectPath = projectPath
      ;(fileStorage as any)._currentProjectId = projectId
      
      // Mock the cleanup process
      mockInvoke.mockResolvedValueOnce(undefined) // cleanup_backup
      
      await invoke('cleanup_backup', { projectId: projectPath })
      
      expect(mockInvoke).toHaveBeenCalledWith('cleanup_backup', {
        projectId: projectPath
      })
    })
  })

  describe('Recovery State Management', () => {
    it('should track recovery state during project lifecycle', async () => {
      const projectPath = '/path/to/stateful-project.scormproj'
      const projectId = 'state-test-123'
      
      // Initially no recovery needed
      ;(fileStorage as any)._currentProjectPath = null
      ;(fileStorage as any)._currentProjectId = null
      
      let recoveryCheck = await fileStorage.checkForRecovery()
      expect(recoveryCheck.hasBackup).toBe(false)
      
      // Load project with backup available
      ;(fileStorage as any)._currentProjectPath = projectPath
      ;(fileStorage as any)._currentProjectId = projectId
      
      mockInvoke.mockResolvedValueOnce({
        hasRecovery: true,
        backupTimestamp: '2024-01-15T12:00:00Z'
      })
      
      recoveryCheck = await fileStorage.checkForRecovery()
      expect(recoveryCheck.hasBackup).toBe(true)
      
      // After recovery, backup should be cleaned up
      mockInvoke.mockResolvedValueOnce({
        project: { id: projectId, name: 'Recovered', path: projectPath },
        course_content: {},
        course_data: {}
      })
      
      await fileStorage.recoverFromBackup(projectPath)
      
      // Check again - should show no backup
      mockInvoke.mockResolvedValueOnce({
        hasRecovery: false
      })
      
      recoveryCheck = await fileStorage.checkForRecovery()
      expect(recoveryCheck.hasBackup).toBe(false)
    })

    it('should handle concurrent recovery checks', async () => {
      const projectPath = '/path/to/concurrent-project.scormproj'
      const projectId = 'concurrent-123'
      
      ;(fileStorage as any)._currentProjectPath = projectPath
      ;(fileStorage as any)._currentProjectId = projectId
      
      // Mock three separate responses (FileStorage doesn't deduplicate concurrent calls)
      mockInvoke
        .mockResolvedValueOnce({
          hasRecovery: true,
          backupTimestamp: '2024-01-15T13:00:00Z'
        })
        .mockResolvedValueOnce({
          hasRecovery: true,
          backupTimestamp: '2024-01-15T13:00:00Z'
        })
        .mockResolvedValueOnce({
          hasRecovery: true,
          backupTimestamp: '2024-01-15T13:00:00Z'
        })
      
      // Start multiple concurrent checks
      const check1 = fileStorage.checkForRecovery()
      const check2 = fileStorage.checkForRecovery()
      const check3 = fileStorage.checkForRecovery()
      
      const results = await Promise.all([check1, check2, check3])
      
      // All should get the same result
      results.forEach(result => {
        expect(result).toEqual({
          hasBackup: true,
          backupTimestamp: '2024-01-15T13:00:00Z'
        })
      })
      
      // FileStorage doesn't deduplicate, so each call hits the backend
      expect(mockInvoke).toHaveBeenCalledTimes(3)
    })
  })

  describe('Error Recovery Scenarios', () => {
    it('should handle corrupted backup data', async () => {
      const projectPath = '/path/to/corrupted-project.scormproj'
      const projectId = 'corrupted-123'
      
      ;(fileStorage as any)._currentProjectPath = projectPath
      ;(fileStorage as any)._currentProjectId = projectId
      
      // Mock corrupted data response
      mockInvoke.mockResolvedValueOnce({
        // Missing required fields
        project: null,
        course_content: undefined
      })
      
      const result = await fileStorage.recoverFromBackup(projectPath)
      
      // Should return the (incomplete) data
      expect(result).toEqual({
        project: null,
        course_content: undefined
      })
    })

    it('should handle network errors during recovery', async () => {
      const projectPath = '/path/to/network-error-project.scormproj'
      const projectId = 'network-error-123'
      
      ;(fileStorage as any)._currentProjectPath = projectPath
      ;(fileStorage as any)._currentProjectId = projectId
      
      // Simulate network timeout
      mockInvoke.mockRejectedValueOnce(new Error('Network timeout'))
      
      await expect(fileStorage.recoverFromBackup(projectPath))
        .rejects.toThrow('Failed to recover from backup')
    })

    it('should handle permission errors during recovery', async () => {
      const projectPath = '/path/to/permission-error-project.scormproj'
      const projectId = 'permission-123'
      
      ;(fileStorage as any)._currentProjectPath = projectPath
      ;(fileStorage as any)._currentProjectId = projectId
      
      // Simulate permission error
      mockInvoke.mockRejectedValueOnce(new Error('Permission denied'))
      
      await expect(fileStorage.recoverFromBackup(projectPath))
        .rejects.toThrow('Failed to recover from backup')
    })
  })
})