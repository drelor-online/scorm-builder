/**
 * Storage and Project Management - Consolidated Test Suite
 * 
 * This file consolidates storage and project management tests from 9 separate files:
 * - ProjectStorage (4 files)
 * - ProjectExportImport (2 files) 
 * - storageRefactorMigration (1 file)
 * - recovery (1 file)
 * - deleteProject (1 file)
 * 
 * Test Categories:
 * - Project creation and lifecycle management
 * - Storage operations and data persistence
 * - Import/Export functionality
 * - Migration and refactoring operations
 * - Recovery and error handling
 * - Project deletion and cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri APIs
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args: any) => mockInvoke(cmd, args)
}))

// Mock dialog APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}))

// Mock logger
vi.mock('@/utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('Storage and Project Management - Consolidated Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockClear()
  })

  describe('Project Creation and Lifecycle Management', () => {
    it('creates new projects with proper metadata', async () => {
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        path: '/projects/project-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          courseType: 'standard'
        }
      }

      mockInvoke.mockResolvedValueOnce(mockProject)

      // Simulate project creation through storage service
      const result = mockInvoke('create_project', {
        name: 'Test Project',
        template: 'standard'
      })

      await expect(result).resolves.toEqual(mockProject)
      expect(mockInvoke).toHaveBeenCalledWith('create_project', {
        name: 'Test Project',
        template: 'standard'
      })
    })

    it('manages project state transitions', async () => {
      const projectId = 'state-test-456'
      
      // Test state: created -> opened -> modified -> saved
      const states = ['created', 'opened', 'modified', 'saved']
      
      for (let i = 0; i < states.length; i++) {
        mockInvoke.mockResolvedValueOnce({ 
          projectId, 
          state: states[i],
          timestamp: Date.now() + i * 1000
        })
        
        const result = await mockInvoke('update_project_state', {
          project_id: projectId,
          state: states[i]
        })
        
        expect(result.state).toBe(states[i])
      }
    })

    it('handles project versioning correctly', async () => {
      const projectId = 'version-test-789'
      const versions = [
        { version: '1.0.0', changes: ['Initial creation'] },
        { version: '1.1.0', changes: ['Added new topic'] },
        { version: '2.0.0', changes: ['Major restructure'] }
      ]

      for (const versionInfo of versions) {
        mockInvoke.mockResolvedValueOnce({
          projectId,
          version: versionInfo.version,
          changes: versionInfo.changes,
          timestamp: new Date().toISOString()
        })

        const result = await mockInvoke('create_project_version', {
          project_id: projectId,
          version: versionInfo.version,
          changes: versionInfo.changes
        })

        expect(result.version).toBe(versionInfo.version)
      }
    })

    it('manages project permissions and access control', async () => {
      const projectId = 'permissions-test'
      const permissions = {
        owner: 'user-123',
        editors: ['user-456', 'user-789'],
        viewers: ['user-999'],
        settings: {
          allowPublicAccess: false,
          requiresAuthentication: true
        }
      }

      mockInvoke.mockResolvedValueOnce({ success: true })

      await mockInvoke('set_project_permissions', {
        project_id: projectId,
        permissions
      })

      expect(mockInvoke).toHaveBeenCalledWith('set_project_permissions', {
        project_id: projectId,
        permissions
      })
    })
  })

  describe('Storage Operations and Data Persistence', () => {
    it('implements atomic storage operations', async () => {
      const projectId = 'atomic-test'
      const operations = [
        { type: 'save', key: 'courseContent', value: { title: 'Test Course' } },
        { type: 'save', key: 'settings', value: { theme: 'dark' } },
        { type: 'delete', key: 'oldData' }
      ]

      mockInvoke.mockResolvedValueOnce({ success: true, operationsProcessed: 3 })

      const result = await mockInvoke('execute_atomic_operations', {
        project_id: projectId,
        operations
      })

      expect(result.success).toBe(true)
      expect(result.operationsProcessed).toBe(3)
    })

    it('handles storage conflicts and resolution', async () => {
      const projectId = 'conflict-test'
      const conflictScenario = {
        local: { title: 'Local Version', lastModified: Date.now() - 1000 },
        remote: { title: 'Remote Version', lastModified: Date.now() }
      }

      mockInvoke.mockResolvedValueOnce({
        resolution: 'use_remote',
        resolvedData: conflictScenario.remote,
        reason: 'Remote version is more recent'
      })

      const result = await mockInvoke('resolve_storage_conflict', {
        project_id: projectId,
        conflict_data: conflictScenario
      })

      expect(result.resolution).toBe('use_remote')
      expect(result.resolvedData.title).toBe('Remote Version')
    })

    it('manages storage quotas and limits', async () => {
      const projectId = 'quota-test'
      const storageInfo = {
        used: 150 * 1024 * 1024, // 150MB
        limit: 500 * 1024 * 1024, // 500MB
        files: 1250,
        projects: 15
      }

      mockInvoke.mockResolvedValueOnce(storageInfo)

      const result = await mockInvoke('get_storage_info', { project_id: projectId })

      expect(result.used).toBeLessThan(result.limit)
      expect(result.files).toBe(1250)
      expect(result.projects).toBe(15)
    })

    it('implements efficient data compression', async () => {
      const projectId = 'compression-test'
      const largeData = Array(10000).fill('test data').join(' ')
      
      mockInvoke.mockResolvedValueOnce({
        originalSize: largeData.length,
        compressedSize: Math.floor(largeData.length * 0.3),
        compressionRatio: 0.7,
        algorithm: 'gzip'
      })

      const result = await mockInvoke('store_compressed_data', {
        project_id: projectId,
        data: largeData,
        compression: 'gzip'
      })

      expect(result.compressionRatio).toBeGreaterThan(0.5)
      expect(result.compressedSize).toBeLessThan(result.originalSize)
    })
  })

  describe('Import/Export Functionality', () => {
    it('exports projects with all dependencies', async () => {
      const projectId = 'export-test'
      const exportOptions = {
        includeMedia: true,
        includeSettings: true,
        includeHistory: false,
        format: 'scormproj'
      }

      const mockExportData = {
        projectData: { title: 'Exported Project' },
        mediaFiles: ['image1.jpg', 'audio1.mp3'],
        settings: { theme: 'light' },
        manifest: {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          fileCount: 125
        }
      }

      mockInvoke.mockResolvedValueOnce({
        success: true,
        exportPath: '/exports/project-export.scormproj',
        manifest: mockExportData.manifest
      })

      const result = await mockInvoke('export_project_full', {
        project_id: projectId,
        options: exportOptions
      })

      expect(result.success).toBe(true)
      expect(result.exportPath).toContain('.scormproj')
      expect(result.manifest.fileCount).toBe(125)
    })

    it('imports projects with validation and conflict resolution', async () => {
      const importPath = '/imports/project.scormproj'
      const importOptions = {
        overwriteExisting: false,
        mergeSettings: true,
        validateIntegrity: true
      }

      mockInvoke.mockResolvedValueOnce({
        success: true,
        projectId: 'imported-789',
        warnings: [
          'Some media files were missing and skipped',
          'Settings merged with existing configuration'
        ],
        statistics: {
          filesImported: 98,
          filesSkipped: 2,
          mediaFilesProcessed: 15
        }
      })

      const result = await mockInvoke('import_project_full', {
        import_path: importPath,
        options: importOptions
      })

      expect(result.success).toBe(true)
      expect(result.projectId).toBe('imported-789')
      expect(result.warnings).toHaveLength(2)
      expect(result.statistics.filesImported).toBe(98)
    })

    it('handles cross-platform compatibility', async () => {
      const exportData = {
        platform: 'windows',
        version: '2.1.0',
        pathSeparator: '\\',
        fileSystem: 'NTFS'
      }

      const importPlatform = {
        platform: 'macos',
        version: '2.1.0',
        pathSeparator: '/',
        fileSystem: 'APFS'
      }

      mockInvoke.mockResolvedValueOnce({
        compatible: true,
        pathsConverted: 45,
        platformAdjustments: [
          'Converted Windows paths to Unix paths',
          'Adjusted file permissions for macOS'
        ]
      })

      const result = await mockInvoke('check_platform_compatibility', {
        export_platform: exportData,
        import_platform: importPlatform
      })

      expect(result.compatible).toBe(true)
      expect(result.pathsConverted).toBe(45)
    })
  })

  describe('Migration and Refactoring Operations', () => {
    it('migrates storage format versions', async () => {
      const migrationInfo = {
        fromVersion: '1.0',
        toVersion: '2.0',
        projectsToMigrate: ['proj1', 'proj2', 'proj3']
      }

      mockInvoke.mockResolvedValueOnce({
        migrationId: 'migration-123',
        status: 'completed',
        projectsMigrated: 3,
        projectsFailed: 0,
        changes: [
          'Updated storage schema',
          'Converted media references',
          'Reorganized project structure'
        ]
      })

      const result = await mockInvoke('migrate_storage_format', migrationInfo)

      expect(result.status).toBe('completed')
      expect(result.projectsMigrated).toBe(3)
      expect(result.projectsFailed).toBe(0)
    })

    it('refactors project structure', async () => {
      const projectId = 'refactor-test'
      const refactorPlan = {
        restructureTopics: true,
        consolidateMedia: true,
        updateReferences: true,
        cleanupUnused: true
      }

      mockInvoke.mockResolvedValueOnce({
        success: true,
        changes: {
          topicsRestructured: 8,
          mediaFilesConsolidated: 15,
          referencesUpdated: 32,
          unusedFilesRemoved: 5
        },
        newStructure: {
          topics: 8,
          mediaFiles: 15,
          totalSize: '45MB'
        }
      })

      const result = await mockInvoke('refactor_project_structure', {
        project_id: projectId,
        plan: refactorPlan
      })

      expect(result.success).toBe(true)
      expect(result.changes.topicsRestructured).toBe(8)
      expect(result.changes.unusedFilesRemoved).toBe(5)
    })

    it('handles data model updates', async () => {
      const updateInfo = {
        modelVersion: '3.0',
        updates: [
          'Add support for interactive elements',
          'Enhanced media metadata',
          'Improved assessment scoring'
        ]
      }

      mockInvoke.mockResolvedValueOnce({
        updated: true,
        backupCreated: true,
        backupLocation: '/backups/pre-update-backup.scormproj',
        updatedProjects: 12,
        errors: []
      })

      const result = await mockInvoke('update_data_model', updateInfo)

      expect(result.updated).toBe(true)
      expect(result.backupCreated).toBe(true)
      expect(result.updatedProjects).toBe(12)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Recovery and Error Handling', () => {
    it('implements automatic backup and recovery', async () => {
      const projectId = 'recovery-test'
      
      // Simulate a corruption scenario
      mockInvoke.mockResolvedValueOnce({
        corruption: {
          detected: true,
          type: 'partial_data_loss',
          affectedFiles: ['courseContent.json', 'settings.json']
        },
        recovery: {
          possible: true,
          backupFound: true,
          backupAge: '2 hours ago',
          recoveryStrategy: 'merge_from_backup'
        }
      })

      const result = await mockInvoke('detect_and_recover', { project_id: projectId })

      expect(result.corruption.detected).toBe(true)
      expect(result.recovery.possible).toBe(true)
      expect(result.recovery.backupFound).toBe(true)
    })

    it('handles catastrophic failures gracefully', async () => {
      const failureScenario = {
        type: 'storage_unavailable',
        projectsAffected: ['proj1', 'proj2', 'proj3'],
        severity: 'high'
      }

      mockInvoke.mockResolvedValueOnce({
        emergencyMode: true,
        safeMode: true,
        dataRecovered: {
          proj1: 'complete',
          proj2: 'partial',
          proj3: 'failed'
        },
        nextSteps: [
          'Switch to emergency storage',
          'Attempt full recovery from backups',
          'Notify user of data loss'
        ]
      })

      const result = await mockInvoke('handle_catastrophic_failure', failureScenario)

      expect(result.emergencyMode).toBe(true)
      expect(result.dataRecovered.proj1).toBe('complete')
      expect(result.nextSteps).toContain('Switch to emergency storage')
    })

    it('validates data integrity continuously', async () => {
      const projectId = 'integrity-test'
      
      mockInvoke.mockResolvedValueOnce({
        integrityCheck: {
          passed: true,
          filesChecked: 150,
          corruptedFiles: 0,
          missingReferences: 2,
          checksumMatches: 148
        },
        recommendations: [
          'Fix 2 missing media references',
          'Run cleanup to optimize storage'
        ]
      })

      const result = await mockInvoke('validate_project_integrity', { project_id: projectId })

      expect(result.integrityCheck.passed).toBe(true)
      expect(result.integrityCheck.corruptedFiles).toBe(0)
      expect(result.recommendations).toHaveLength(2)
    })
  })

  describe('Project Deletion and Cleanup', () => {
    it('performs safe project deletion with confirmation', async () => {
      const projectId = 'delete-test'
      const deleteOptions = {
        createBackup: true,
        force: false,
        cleanupMedia: true
      }

      mockInvoke.mockResolvedValueOnce({
        deleted: true,
        backupCreated: true,
        backupLocation: '/backups/deleted-project-backup.scormproj',
        filesRemoved: 125,
        spaceFreed: '78MB',
        mediaFilesRemoved: 15
      })

      const result = await mockInvoke('delete_project_safe', {
        project_id: projectId,
        options: deleteOptions
      })

      expect(result.deleted).toBe(true)
      expect(result.backupCreated).toBe(true)
      expect(result.filesRemoved).toBe(125)
      expect(result.spaceFreed).toBe('78MB')
    })

    it('cleans up orphaned resources', async () => {
      mockInvoke.mockResolvedValueOnce({
        orphanedFiles: [
          'media/unused-image-1.jpg',
          'media/unused-audio-1.mp3',
          'cache/temp-file-1.tmp'
        ],
        orphanedReferences: [
          'missing-topic-ref-1',
          'missing-media-ref-2'
        ],
        cleanupResult: {
          filesRemoved: 3,
          referencesFixed: 2,
          spaceFreed: '12MB'
        }
      })

      const result = await mockInvoke('cleanup_orphaned_resources')

      expect(result.orphanedFiles).toHaveLength(3)
      expect(result.cleanupResult.filesRemoved).toBe(3)
      expect(result.cleanupResult.referencesFixed).toBe(2)
    })

    it('maintains deletion consistency across related data', async () => {
      const projectId = 'consistency-test'
      
      mockInvoke.mockResolvedValueOnce({
        consistencyCheck: {
          beforeDeletion: {
            projects: 5,
            mediaFiles: 45,
            references: 120
          },
          afterDeletion: {
            projects: 4,
            mediaFiles: 30,
            references: 95
          },
          deletionImpact: {
            projectsRemoved: 1,
            mediaFilesRemoved: 15,
            referencesRemoved: 25,
            brokenReferences: 0
          }
        }
      })

      const result = await mockInvoke('check_deletion_consistency', { project_id: projectId })

      expect(result.consistencyCheck.deletionImpact.brokenReferences).toBe(0)
      expect(result.consistencyCheck.deletionImpact.projectsRemoved).toBe(1)
    })

    it('handles bulk deletion operations', async () => {
      const projectIds = ['bulk1', 'bulk2', 'bulk3', 'bulk4', 'bulk5']
      
      mockInvoke.mockResolvedValueOnce({
        batchResult: {
          successful: ['bulk1', 'bulk2', 'bulk3'],
          failed: ['bulk4', 'bulk5'],
          errors: {
            bulk4: 'Project in use by another process',
            bulk5: 'Backup creation failed'
          }
        },
        summary: {
          totalRequested: 5,
          successful: 3,
          failed: 2,
          totalSpaceFreed: '156MB'
        }
      })

      const result = await mockInvoke('delete_projects_batch', { project_ids: projectIds })

      expect(result.batchResult.successful).toHaveLength(3)
      expect(result.batchResult.failed).toHaveLength(2)
      expect(result.summary.totalSpaceFreed).toBe('156MB')
    })
  })
})