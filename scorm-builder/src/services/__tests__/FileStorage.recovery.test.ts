import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileStorage } from '../FileStorage'

// Mock Tauri's invoke function
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

describe('FileStorage - Backup and Recovery', () => {
  let fileStorage: FileStorage
  
  beforeEach(() => {
    fileStorage = new FileStorage()
    mockInvoke.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Automatic Backup', () => {
    it('should create backup on save', async () => {
      const projectId = 'test-project'
      const content = { pages: [], metadata: {} }
      
      // Setup mock to succeed
      mockInvoke.mockResolvedValue(undefined)
      
      // Save project
      await fileStorage.saveProject(projectId, content)
      
      // Should have called create_backup
      expect(mockInvoke).toHaveBeenCalledWith('create_backup', {
        projectId
      })
    })

    it('should continue save even if backup fails', async () => {
      const projectId = 'test-project'
      const content = { pages: [], metadata: {} }
      
      // Setup mock to fail backup but succeed save
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'create_backup') {
          return Promise.reject(new Error('Backup failed'))
        }
        return Promise.resolve(undefined)
      })
      
      // Save should not throw even if backup fails
      await expect(fileStorage.saveProject(projectId, content)).resolves.not.toThrow()
      
      // Should have attempted backup
      expect(mockInvoke).toHaveBeenCalledWith('create_backup', {
        projectId
      })
      
      // Should have continued with save
      expect(mockInvoke).toHaveBeenCalledWith('save_project', expect.any(Object))
    })
  })

  describe('Recovery Detection', () => {
    it('should check for recovery on project open', async () => {
      const projectId = 'test-project'
      
      // Mock has no recovery available
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'check_recovery') {
          return Promise.resolve({ hasRecovery: false })
        }
        if (cmd === 'load_project') {
          return Promise.resolve({ pages: [], metadata: {} })
        }
        return Promise.resolve(undefined)
      })
      
      const result = await fileStorage.openProject(projectId)
      
      // Should have checked for recovery
      expect(mockInvoke).toHaveBeenCalledWith('check_recovery', {
        projectId
      })
      
      // Should return normal project data
      expect(result).toEqual({ pages: [], metadata: {} })
    })

    it('should detect available recovery', async () => {
      const projectId = 'test-project'
      
      // Mock has recovery available
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'check_recovery') {
          return Promise.resolve({ 
            hasRecovery: true,
            backupTimestamp: new Date().toISOString()
          })
        }
        if (cmd === 'load_project') {
          return Promise.resolve({ pages: [], metadata: {} })
        }
        return Promise.resolve(undefined)
      })
      
      const result = await fileStorage.openProject(projectId)
      
      // Should have checked for recovery
      expect(mockInvoke).toHaveBeenCalledWith('check_recovery', {
        projectId
      })
      
      // Result should indicate recovery is available
      expect(result).toHaveProperty('hasRecovery', true)
    })
  })

  describe('Recovery Process', () => {
    it('should recover from backup', async () => {
      const projectId = 'test-project'
      
      // Mock successful recovery
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'recover_from_backup') {
          return Promise.resolve({ 
            pages: [{ id: 'recovered' }], 
            metadata: { recovered: true } 
          })
        }
        return Promise.resolve(undefined)
      })
      
      const recovered = await fileStorage.recoverFromBackup(projectId)
      
      // Should have called recover
      expect(mockInvoke).toHaveBeenCalledWith('recover_from_backup', {
        projectId
      })
      
      // Should return recovered data
      expect(recovered).toEqual({
        pages: [{ id: 'recovered' }],
        metadata: { recovered: true }
      })
    })

    it('should handle recovery failure gracefully', async () => {
      const projectId = 'test-project'
      
      // Mock recovery failure
      mockInvoke.mockRejectedValue(new Error('Recovery failed'))
      
      // Should throw with meaningful error
      await expect(fileStorage.recoverFromBackup(projectId))
        .rejects.toThrow('Failed to recover from backup')
    })
  })

  describe('Backup Cleanup', () => {
    it('should clean up old backups', async () => {
      const projectId = 'test-project'
      
      mockInvoke.mockResolvedValue({ cleaned: 2 })
      
      const result = await fileStorage.cleanupOldBackups(projectId)
      
      // Should have called cleanup
      expect(mockInvoke).toHaveBeenCalledWith('cleanup_old_backups', {
        projectId,
        keepCount: 5 // Keep last 5 backups by default
      })
      
      expect(result).toEqual({ cleaned: 2 })
    })
  })
})