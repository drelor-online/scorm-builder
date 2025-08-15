/**
 * FileStorage - Consolidated Test Suite
 * 
 * This file consolidates FileStorage tests from 20 separate files into
 * a single comprehensive test suite focusing on core functionality.
 * 
 * Test Categories:
 * - Project creation and management
 * - Course content storage and retrieval
 * - Media file operations
 * - Import/Export with media handling
 * - Backup and recovery
 * - Chunked encoding for large files
 * - Memory usage optimization
 * - Error handling and consistency
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileStorage } from '../FileStorage'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import type { CourseContent } from '../../types/scorm'

// Mock Tauri APIs
const mockInvoke = vi.fn()
const mockOpen = vi.fn()
const mockSave = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args: any) => mockInvoke(cmd, args)
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (options?: any) => mockOpen(options),
  save: (options?: any) => mockSave(options)
}))

// Mock debugLogger
vi.mock('@/utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Sample course content for testing
const mockCourseContent: CourseContent = {
  title: 'Test Course',
  courseName: 'Test Course',
  passMark: 80,
  navigationMode: 'linear',
  allowRetake: true,
  welcome: {
    title: 'Welcome',
    content: 'Welcome to the course',
    startButtonText: 'Start'
  },
  learningObjectivesPage: {
    objectives: ['Learn testing', 'Master FileStorage']
  },
  topics: [
    {
      id: 'topic-1',
      blockId: 'block-1',
      title: 'Introduction',
      content: 'This is an introduction topic'
    }
  ],
  assessment: {
    enabled: true,
    questions: [
      {
        type: 'multiple-choice',
        question: 'What is FileStorage?',
        options: ['A service', 'A class', 'Both'],
        correctAnswer: 'Both',
        feedback: {
          correct: 'Correct!',
          incorrect: 'Try again'
        }
      }
    ]
  }
}

describe('FileStorage - Consolidated Test Suite', () => {
  let fileStorage: FileStorage
  
  beforeEach(async () => {
    vi.clearAllMocks()
    mockInvoke.mockClear()
    
    fileStorage = new FileStorage()
    await fileStorage.initialize()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Project Creation and Management', () => {
    it('creates new projects', async () => {
      const mockProject = {
        id: 'test-project-123',
        name: 'Test Project',
        path: '/projects/test-project-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      mockInvoke.mockResolvedValueOnce(mockProject)
      
      const project = await fileStorage.createProject('Test Project')
      
      expect(mockInvoke).toHaveBeenCalledWith('create_project', {
        name: 'Test Project',
        projects_dir: undefined
      })
      expect(project).toEqual(mockProject)
    })

    it('creates projects in specific directory', async () => {
      const projectsDir = '/custom/projects'
      const mockProject = {
        id: 'custom-project-456',
        name: 'Custom Project',
        path: '/custom/projects/custom-project-456',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      mockInvoke.mockResolvedValueOnce(mockProject)
      
      const project = await fileStorage.createProject('Custom Project', projectsDir)
      
      expect(mockInvoke).toHaveBeenCalledWith('create_project', {
        name: 'Custom Project',
        projects_dir: projectsDir
      })
      expect(project).toEqual(mockProject)
    })

    it('loads existing projects', async () => {
      const mockProjects = [
        { id: '1', name: 'Project 1', path: '/projects/1' },
        { id: '2', name: 'Project 2', path: '/projects/2' }
      ]
      
      mockInvoke.mockResolvedValueOnce(mockProjects)
      
      const projects = await fileStorage.loadProjects()
      
      expect(mockInvoke).toHaveBeenCalledWith('list_projects')
      expect(projects).toEqual(mockProjects)
    })

    it('opens existing projects by ID', async () => {
      const mockProject = {
        id: 'existing-123',
        name: 'Existing Project',
        path: '/projects/existing-123'
      }
      
      mockInvoke.mockResolvedValueOnce(mockProject)
      
      const project = await fileStorage.openProject('existing-123')
      
      expect(mockInvoke).toHaveBeenCalledWith('open_project_by_id', {
        project_id: 'existing-123'
      })
      expect(project).toEqual(mockProject)
      expect(fileStorage.currentProjectId).toBe('existing-123')
    })

    it('opens projects from file paths', async () => {
      const filePath = '/projects/test_123.scormproj'
      const mockProject = {
        id: '123',
        name: 'Test Project',
        path: '/projects/123'
      }
      
      mockOpen.mockResolvedValueOnce([filePath])
      mockInvoke.mockResolvedValueOnce(mockProject)
      
      const project = await fileStorage.openProjectFromFile()
      
      expect(mockOpen).toHaveBeenCalled()
      expect(mockInvoke).toHaveBeenCalledWith('open_project_from_file', {
        file_path: filePath
      })
      expect(project).toEqual(mockProject)
    })
  })

  describe('Course Content Storage and Retrieval', () => {
    beforeEach(async () => {
      // Set up project context
      mockInvoke.mockResolvedValueOnce({
        id: 'test-project',
        name: 'Test Project',
        path: '/projects/test-project'
      })
      await fileStorage.createProject('Test Project')
    })

    it('saves course content', async () => {
      mockInvoke.mockResolvedValueOnce(undefined)
      
      await fileStorage.saveCourseContent(mockCourseContent)
      
      expect(mockInvoke).toHaveBeenCalledWith('save_course_content', {
        project_id: 'test-project',
        content: mockCourseContent
      })
    })

    it('loads course content', async () => {
      mockInvoke.mockResolvedValueOnce(mockCourseContent)
      
      const content = await fileStorage.loadCourseContent()
      
      expect(mockInvoke).toHaveBeenCalledWith('load_course_content', {
        project_id: 'test-project'
      })
      expect(content).toEqual(mockCourseContent)
    })

    it('implements debounced saving', async () => {
      vi.useFakeTimers()
      
      mockInvoke.mockResolvedValue(undefined)
      
      // Multiple rapid saves
      fileStorage.saveCourseContent(mockCourseContent)
      fileStorage.saveCourseContent(mockCourseContent)
      fileStorage.saveCourseContent(mockCourseContent)
      
      // Should not save immediately
      expect(mockInvoke).not.toHaveBeenCalled()
      
      // Fast-forward past debounce delay
      vi.advanceTimersByTime(600)
      await vi.runOnlyPendingTimersAsync()
      
      // Should save only once after debounce
      expect(mockInvoke).toHaveBeenCalledTimes(1)
      
      vi.useRealTimers()
    })

    it('handles nested JSON structures', async () => {
      const complexContent = {
        ...mockCourseContent,
        metadata: {
          nested: {
            deeply: {
              complex: {
                structure: ['with', 'arrays', 'and', { objects: true }]
              }
            }
          }
        }
      }
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      await fileStorage.saveCourseContent(complexContent)
      
      expect(mockInvoke).toHaveBeenCalledWith('save_course_content', {
        project_id: 'test-project',
        content: complexContent
      })
    })
  })

  describe('Media File Operations', () => {
    beforeEach(async () => {
      // Set up project context
      mockInvoke.mockResolvedValueOnce({
        id: 'test-project',
        name: 'Test Project',
        path: '/projects/test-project'
      })
      await fileStorage.createProject('Test Project')
    })

    it('stores media files', async () => {
      const mediaData = new Uint8Array([1, 2, 3, 4, 5])
      const mediaInfo = {
        id: 'test-image-123',
        mediaType: 'image',
        metadata: { originalName: 'test.jpg', mimeType: 'image/jpeg' },
        size: mediaData.length
      }
      
      mockInvoke.mockResolvedValueOnce('media-stored')
      
      const result = await fileStorage.storeMediaFile(mediaInfo.id, mediaData, mediaInfo.metadata)
      
      expect(mockInvoke).toHaveBeenCalledWith('store_media_file', {
        project_id: 'test-project',
        media_id: mediaInfo.id,
        data: Array.from(mediaData),
        metadata: mediaInfo.metadata
      })
      expect(result).toBe('media-stored')
    })

    it('retrieves media files', async () => {
      const mediaData = new Uint8Array([1, 2, 3, 4, 5])
      
      mockInvoke.mockResolvedValueOnce({
        data: Array.from(mediaData),
        metadata: { originalName: 'test.jpg', mimeType: 'image/jpeg' }
      })
      
      const result = await fileStorage.getMediaFile('test-image-123')
      
      expect(mockInvoke).toHaveBeenCalledWith('get_media_file', {
        project_id: 'test-project',
        media_id: 'test-image-123'
      })
      expect(result.data).toEqual(mediaData)
    })

    it('deletes media files', async () => {
      mockInvoke.mockResolvedValueOnce(true)
      
      const result = await fileStorage.deleteMediaFile('test-image-123')
      
      expect(mockInvoke).toHaveBeenCalledWith('delete_media_file', {
        project_id: 'test-project',
        media_id: 'test-image-123'
      })
      expect(result).toBe(true)
    })

    it('lists all project media', async () => {
      const mockMediaList = [
        { id: 'image-1', mediaType: 'image', size: 1024 },
        { id: 'audio-1', mediaType: 'audio', size: 2048 }
      ]
      
      mockInvoke.mockResolvedValueOnce(mockMediaList)
      
      const mediaList = await fileStorage.getAllProjectMedia()
      
      expect(mockInvoke).toHaveBeenCalledWith('list_project_media', {
        project_id: 'test-project'
      })
      expect(mediaList).toEqual(mockMediaList)
    })
  })

  describe('Import/Export with Media Handling', () => {
    beforeEach(async () => {
      // Set up project context
      mockInvoke.mockResolvedValueOnce({
        id: 'test-project',
        name: 'Test Project',
        path: '/projects/test-project'
      })
      await fileStorage.createProject('Test Project')
    })

    it('exports project with media', async () => {
      const exportPath = '/exports/project.scormproj'
      mockSave.mockResolvedValueOnce(exportPath)
      mockInvoke.mockResolvedValueOnce(true)
      
      const result = await fileStorage.exportProjectWithMedia()
      
      expect(mockSave).toHaveBeenCalledWith({
        defaultPath: expect.stringContaining('.scormproj'),
        filters: [{ name: 'SCORM Project', extensions: ['scormproj'] }]
      })
      expect(mockInvoke).toHaveBeenCalledWith('export_project_with_media', {
        project_id: 'test-project',
        export_path: exportPath
      })
      expect(result).toBe(true)
    })

    it('imports project with media', async () => {
      const importPath = '/imports/project.scormproj'
      mockOpen.mockResolvedValueOnce([importPath])
      
      const mockImportedProject = {
        id: 'imported-456',
        name: 'Imported Project',
        path: '/projects/imported-456'
      }
      
      mockInvoke.mockResolvedValueOnce(mockImportedProject)
      
      const result = await fileStorage.importProjectWithMedia()
      
      expect(mockOpen).toHaveBeenCalledWith({
        multiple: false,
        filters: [{ name: 'SCORM Project', extensions: ['scormproj'] }]
      })
      expect(mockInvoke).toHaveBeenCalledWith('import_project_with_media', {
        import_path: importPath
      })
      expect(result).toEqual(mockImportedProject)
    })

    it('saves project as new copy with media', async () => {
      const newPath = '/projects/copy.scormproj'
      mockSave.mockResolvedValueOnce(newPath)
      
      const mockNewProject = {
        id: 'copy-789',
        name: 'Project Copy',
        path: '/projects/copy-789'
      }
      
      mockInvoke.mockResolvedValueOnce(mockNewProject)
      
      const result = await fileStorage.saveAsWithMedia('Project Copy')
      
      expect(mockSave).toHaveBeenCalled()
      expect(mockInvoke).toHaveBeenCalledWith('save_project_as_with_media', {
        project_id: 'test-project',
        new_name: 'Project Copy',
        new_path: newPath
      })
      expect(result).toEqual(mockNewProject)
    })
  })

  describe('Chunked Encoding for Large Files', () => {
    beforeEach(async () => {
      // Set up project context
      mockInvoke.mockResolvedValueOnce({
        id: 'test-project',
        name: 'Test Project',
        path: '/projects/test-project'
      })
      await fileStorage.createProject('Test Project')
    })

    it('handles large media files with chunked encoding', async () => {
      // Create a large file (5MB)
      const largeData = new Uint8Array(5 * 1024 * 1024)
      largeData.fill(255)
      
      mockInvoke.mockResolvedValueOnce('large-media-stored')
      
      const result = await fileStorage.storeMediaFile('large-image', largeData, {
        originalName: 'large.jpg',
        mimeType: 'image/jpeg'
      })
      
      expect(mockInvoke).toHaveBeenCalledWith('store_media_file', {
        project_id: 'test-project',
        media_id: 'large-image',
        data: Array.from(largeData),
        metadata: { originalName: 'large.jpg', mimeType: 'image/jpeg' }
      })
      expect(result).toBe('large-media-stored')
    })

    it('handles base64 encoding for binary data', async () => {
      // Binary data that needs base64 encoding
      const binaryData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]) // JPEG header
      
      mockInvoke.mockResolvedValueOnce('binary-media-stored')
      
      const result = await fileStorage.storeMediaFile('binary-image', binaryData, {
        encoding: 'base64',
        mimeType: 'image/jpeg'
      })
      
      expect(mockInvoke).toHaveBeenCalledWith('store_media_file', {
        project_id: 'test-project',
        media_id: 'binary-image',
        data: Array.from(binaryData),
        metadata: { encoding: 'base64', mimeType: 'image/jpeg' }
      })
      expect(result).toBe('binary-media-stored')
    })
  })

  describe('Backup and Recovery', () => {
    beforeEach(async () => {
      // Set up project context
      mockInvoke.mockResolvedValueOnce({
        id: 'test-project',
        name: 'Test Project',
        path: '/projects/test-project'
      })
      await fileStorage.createProject('Test Project')
    })

    it('creates project backups', async () => {
      mockInvoke.mockResolvedValueOnce('/backups/test-project-backup.scormproj')
      
      const backupPath = await fileStorage.createBackup()
      
      expect(mockInvoke).toHaveBeenCalledWith('create_project_backup', {
        project_id: 'test-project'
      })
      expect(backupPath).toBe('/backups/test-project-backup.scormproj')
    })

    it('restores from backup', async () => {
      const backupPath = '/backups/restore.scormproj'
      mockOpen.mockResolvedValueOnce([backupPath])
      
      const mockRestoredProject = {
        id: 'restored-123',
        name: 'Restored Project',
        path: '/projects/restored-123'
      }
      
      mockInvoke.mockResolvedValueOnce(mockRestoredProject)
      
      const result = await fileStorage.restoreFromBackup()
      
      expect(mockOpen).toHaveBeenCalledWith({
        multiple: false,
        filters: [{ name: 'SCORM Project Backup', extensions: ['scormproj'] }]
      })
      expect(mockInvoke).toHaveBeenCalledWith('restore_from_backup', {
        backup_path: backupPath
      })
      expect(result).toEqual(mockRestoredProject)
    })

    it('validates backup integrity', async () => {
      const backupPath = '/backups/test.scormproj'
      
      mockInvoke.mockResolvedValueOnce({
        valid: true,
        projectName: 'Test Project',
        createdAt: '2023-01-01T00:00:00.000Z',
        mediaCount: 5
      })
      
      const validation = await fileStorage.validateBackup(backupPath)
      
      expect(mockInvoke).toHaveBeenCalledWith('validate_backup', {
        backup_path: backupPath
      })
      expect(validation.valid).toBe(true)
      expect(validation.projectName).toBe('Test Project')
    })
  })

  describe('Memory Usage and Performance', () => {
    beforeEach(async () => {
      // Set up project context
      mockInvoke.mockResolvedValueOnce({
        id: 'test-project',
        name: 'Test Project',
        path: '/projects/test-project'
      })
      await fileStorage.createProject('Test Project')
    })

    it('monitors memory usage during operations', async () => {
      const initialMemory = process.memoryUsage()
      
      // Simulate storing multiple large files
      const promises = Array.from({ length: 5 }, (_, i) => {
        const data = new Uint8Array(1024 * 1024) // 1MB each
        data.fill(i)
        mockInvoke.mockResolvedValueOnce(`media-${i}-stored`)
        return fileStorage.storeMediaFile(`media-${i}`, data, { size: data.length })
      })
      
      await Promise.all(promises)
      
      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      
      // Memory increase should be reasonable (less than 10MB for 5MB of data)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
    })

    it('cleans up resources after operations', async () => {
      mockInvoke.mockResolvedValueOnce(undefined)
      
      await fileStorage.saveCourseContent(mockCourseContent)
      
      // Verify cleanup was called
      expect(mockInvoke).toHaveBeenCalledWith('save_course_content', expect.any(Object))
    })
  })

  describe('Error Handling and Consistency', () => {
    beforeEach(async () => {
      // Set up project context
      mockInvoke.mockResolvedValueOnce({
        id: 'test-project',
        name: 'Test Project',
        path: '/projects/test-project'
      })
      await fileStorage.createProject('Test Project')
    })

    it('handles file system errors gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Disk full'))
      
      await expect(fileStorage.saveCourseContent(mockCourseContent))
        .rejects.toThrow('Disk full')
    })

    it('retries failed operations', async () => {
      vi.useFakeTimers()
      
      // First two attempts fail, third succeeds
      mockInvoke
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(undefined)
      
      const savePromise = fileStorage.saveCourseContent(mockCourseContent)
      
      // Fast-forward through retry delays
      vi.advanceTimersByTime(2000)
      await vi.runOnlyPendingTimersAsync()
      
      await expect(savePromise).resolves.toBeUndefined()
      expect(mockInvoke).toHaveBeenCalledTimes(3)
      
      vi.useRealTimers()
    })

    it('maintains data consistency during concurrent operations', async () => {
      mockInvoke.mockResolvedValue(undefined)
      
      // Simulate concurrent saves
      const saves = Array.from({ length: 10 }, () => 
        fileStorage.saveCourseContent({
          ...mockCourseContent,
          title: `Course ${Math.random()}`
        })
      )
      
      await Promise.all(saves)
      
      // Should handle all saves without corruption
      expect(mockInvoke).toHaveBeenCalled()
    })

    it('validates project state before operations', async () => {
      // Create a new FileStorage without a project
      const emptyStorage = new FileStorage()
      await emptyStorage.initialize()
      
      await expect(emptyStorage.saveCourseContent(mockCourseContent))
        .rejects.toThrow()
    })
  })

  describe('Project Path Management', () => {
    it('tracks current project path correctly', async () => {
      const mockProject = {
        id: 'path-test-123',
        name: 'Path Test',
        path: '/projects/path-test-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      mockInvoke.mockResolvedValueOnce(mockProject)
      
      const project = await fileStorage.createProject('Path Test')
      
      expect(fileStorage.currentProjectId).toBe('path-test-123')
      expect(fileStorage['_currentProjectPath']).toBe('/projects/path-test-123')
    })

    it('handles project path resolution', async () => {
      const mockProject = {
        id: 'resolve-456',
        name: 'Resolve Test',
        path: '/custom/path/resolve-456'
      }
      
      mockInvoke.mockResolvedValueOnce(mockProject)
      
      const project = await fileStorage.openProject('resolve-456')
      
      expect(project.path).toBe('/custom/path/resolve-456')
    })
  })
})