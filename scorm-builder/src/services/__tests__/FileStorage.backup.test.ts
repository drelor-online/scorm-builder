import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileStorage } from '../FileStorage'

// Mock Tauri's invoke function
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

// Mock dialog functions
const mockSave = vi.fn()
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: (options?: any) => mockSave(options)
}))

describe('FileStorage - Backup and Recovery', () => {
  let fileStorage: FileStorage
  const projectId = '1234567890'
  const projectPath = `C:\\Projects\\TestProject_${projectId}.scormproj`
  
  beforeEach(() => {
    fileStorage = new FileStorage()
    fileStorage['_currentProjectPath'] = projectPath
    fileStorage['_currentProjectId'] = projectId
    mockInvoke.mockClear()
    mockSave.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Backup Creation', () => {
    it('should create backup before saving project', async () => {
      const projectData = {
        pages: [{ id: 'page1', title: 'Test Page' }]
      }
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'create_backup') {
          return Promise.resolve()
        }
        if (cmd === 'save_project') {
          return Promise.resolve()
        }
        return Promise.resolve(undefined)
      })
      
      await fileStorage.saveProject(projectId, projectData)
      
      // Should call create_backup before save_project
      expect(mockInvoke).toHaveBeenCalledWith('create_backup', {
        projectId: projectId // FileStorage now passes just the ID
      })
      expect(mockInvoke).toHaveBeenCalledWith('save_project', expect.objectContaining({
        projectId: projectId,
        projectData: projectData
      }))
      
      // Verify backup was called before save
      const calls = mockInvoke.mock.calls
      const backupIndex = calls.findIndex(call => call[0] === 'create_backup')
      const saveIndex = calls.findIndex(call => call[0] === 'save_project')
      expect(backupIndex).toBeLessThan(saveIndex)
    })

    it('should continue save even if backup fails', async () => {
      const projectData = { pages: [] }
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'create_backup') {
          return Promise.reject(new Error('Backup failed'))
        }
        if (cmd === 'save_project') {
          return Promise.resolve()
        }
        return Promise.resolve(undefined)
      })
      
      // Should not throw even if backup fails
      await expect(fileStorage.saveProject(projectId, projectData))
        .resolves.not.toThrow()
      
      // Save should still be called
      expect(mockInvoke).toHaveBeenCalledWith('save_project', expect.any(Object))
    })
  })

  describe('Recovery Detection', () => {
    it('should detect backup files when opening project', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'check_recovery') {
          return Promise.resolve({
            hasRecovery: true,
            backupTimestamp: '2025-01-07T10:00:00Z',
            backupPath: `${projectPath}.backup`
          })
        }
        if (cmd === 'load_project') {
          return Promise.resolve({
            project: { id: projectId },
            course_content: {}
          })
        }
        return Promise.resolve(undefined)
      })
      
      const result = await fileStorage.openProject(projectPath)
      
      expect(mockInvoke).toHaveBeenCalledWith('check_recovery', {
        projectId: projectPath
      })
      expect(result.hasRecovery).toBe(true)
      expect(result.backupTimestamp).toBeDefined()
    })

    it('should return hasRecovery false when no backup exists', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'check_recovery') {
          return Promise.resolve({
            hasRecovery: false
          })
        }
        if (cmd === 'load_project') {
          return Promise.resolve({
            project: { id: projectId },
            course_content: {}
          })
        }
        return Promise.resolve(undefined)
      })
      
      const result = await fileStorage.openProject(projectPath)
      
      // openProject returns undefined for hasRecovery when false
      expect(result.hasRecovery).toBeUndefined()
    })
  })

  describe('Recovery Process', () => {
    it('should recover from backup when requested', async () => {
      const recoveredData = {
        pages: [{ id: 'recovered-page', title: 'Recovered' }],
        metadata: { recovered: true, timestamp: '2025-01-07T10:00:00Z' }
      }
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'recover_from_backup') {
          return Promise.resolve(recoveredData)
        }
        return Promise.resolve(undefined)
      })
      
      const result = await fileStorage.recoverFromBackup(projectId)
      
      expect(mockInvoke).toHaveBeenCalledWith('recover_from_backup', {
        projectId: projectId
      })
      expect(result).toEqual(recoveredData)
      expect(result.metadata.recovered).toBe(true)
    })

    it('should handle recovery failure gracefully', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'recover_from_backup') {
          return Promise.reject(new Error('No backup found'))
        }
        return Promise.resolve(undefined)
      })
      
      await expect(fileStorage.recoverFromBackup(projectId))
        .rejects.toThrow('Failed to recover from backup')
    })
  })

  describe('Backup Cleanup', () => {
    it('should cleanup old backups keeping specified count', async () => {
      const keepCount = 5
      
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'cleanup_old_backups') {
          return Promise.resolve({
            deletedCount: 3,
            keptCount: keepCount
          })
        }
        return Promise.resolve(undefined)
      })
      
      const result = await fileStorage.cleanupOldBackups(projectId, keepCount)
      
      expect(mockInvoke).toHaveBeenCalledWith('cleanup_old_backups', {
        projectId: projectId,
        keepCount: keepCount
      })
      expect(result.keptCount).toBe(keepCount)
    })

    it('should use default keep count if not specified', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'cleanup_old_backups') {
          return Promise.resolve({
            deletedCount: 2,
            keptCount: 5
          })
        }
        return Promise.resolve(undefined)
      })
      
      // Call without specifying keep count
      const result = await fileStorage.cleanupOldBackups(projectId)
      
      // Should use default of 5
      expect(mockInvoke).toHaveBeenCalledWith('cleanup_old_backups', {
        projectId: projectId,
        keepCount: 5
      })
    })
  })

  describe('CheckForRecovery method', () => {
    it('should check for recovery without opening project', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'check_recovery') {
          return Promise.resolve({
            hasRecovery: true,
            backupTimestamp: '2025-01-07T10:00:00Z'
          })
        }
        return Promise.resolve(undefined)
      })
      
      const result = await fileStorage.checkForRecovery()
      
      // Now that checkForRecovery is implemented, it should work
      expect(result.hasBackup).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('check_recovery', {
        projectId: projectPath
      })
    })
  })
})