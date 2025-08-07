import { renderHook } from '../../test/testProviders'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReactNode } from 'react'
import { PersistentStorageProvider, useStorage } from '../PersistentStorageContext'

// Mock the usePersistentStorage hook
vi.mock('../../hooks/usePersistentStorage', () => ({
  usePersistentStorage: vi.fn()
}))

import { usePersistentStorage } from '../../hooks/usePersistentStorage'

describe('PersistentStorageContext', () => {
  const mockStorage = {
    isInitialized: true,
    currentProjectId: 'test-project-123',
    error: null,
    createProject: vi.fn(),
    openProject: vi.fn(),
    openProjectFromFile: vi.fn(),
    openProjectFromPath: vi.fn(),
    saveProject: vi.fn(),
    saveProjectAs: vi.fn(),
    listProjects: vi.fn(),
    getRecentProjects: vi.fn(),
    checkForRecovery: vi.fn(),
    recoverFromBackup: vi.fn(),
    storeMedia: vi.fn(),
    storeYouTubeVideo: vi.fn(),
    getMedia: vi.fn(),
    getMediaForTopic: vi.fn(),
    saveContent: vi.fn(),
    getContent: vi.fn(),
    saveCourseMetadata: vi.fn(),
    getCourseMetadata: vi.fn(),
    saveAiPrompt: vi.fn(),
    getAiPrompt: vi.fn(),
    saveAudioSettings: vi.fn(),
    getAudioSettings: vi.fn(),
    saveScormConfig: vi.fn(),
    getScormConfig: vi.fn(),
    deleteProject: vi.fn(),
    exportProject: vi.fn(),
    importProjectFromZip: vi.fn(),
    getCurrentProjectId: vi.fn(() => 'test-project-123'),
    setProjectsDirectory: vi.fn(),
    migrateFromLocalStorage: vi.fn(),
    clearRecentFilesCache: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(usePersistentStorage as any).mockReturnValue(mockStorage)
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <PersistentStorageProvider>{children}</PersistentStorageProvider>
  )

  describe('Context Provider', () => {
    it('should provide storage context to children', () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      expect(result.current).toBeDefined()
      expect(result.current.isInitialized).toBe(true)
      expect(result.current.currentProjectId).toBe('test-project-123')
    })

    it('should throw error when used outside provider', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      expect(() => {
        renderHook(() => useStorage())
      }).toThrow('useStorage must be used within a PersistentStorageProvider')
      
      consoleErrorSpy.mockRestore()
    })

    it('should provide all storage methods', () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      // Check all methods are available
      expect(result.current.createProject).toBeDefined()
      expect(result.current.openProject).toBeDefined()
      expect(result.current.saveProject).toBeDefined()
      expect(result.current.deleteProject).toBeDefined()
      expect(result.current.listProjects).toBeDefined()
      expect(result.current.getRecentProjects).toBeDefined()
      expect(result.current.storeMedia).toBeDefined()
      expect(result.current.getMedia).toBeDefined()
      expect(result.current.saveContent).toBeDefined()
      expect(result.current.getContent).toBeDefined()
    })
  })

  describe('Project Management', () => {
    it('should create a new project', async () => {
      const newProject = { id: 'new-project-456', name: 'New Project' }
      mockStorage.createProject.mockResolvedValue(newProject)
      
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const project = await result.current.createProject('New Project', '/projects')
      
      expect(mockStorage.createProject).toHaveBeenCalledWith('New Project', '/projects')
      expect(project).toEqual(newProject)
    })

    it('should open a project', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const onProgress = vi.fn()
      await result.current.openProject('project-123', onProgress)
      
      expect(mockStorage.openProject).toHaveBeenCalledWith('project-123', onProgress)
    })

    it('should open project from file', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      await result.current.openProjectFromFile()
      
      expect(mockStorage.openProjectFromFile).toHaveBeenCalled()
    })

    it('should open project from path', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const options = { skipUnsavedCheck: true }
      await result.current.openProjectFromPath('/path/to/project.scorm', options)
      
      expect(mockStorage.openProjectFromPath).toHaveBeenCalledWith('/path/to/project.scorm', options)
    })

    it('should save current project', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      await result.current.saveProject()
      
      expect(mockStorage.saveProject).toHaveBeenCalled()
    })

    it('should save project as new file', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      await result.current.saveProjectAs()
      
      expect(mockStorage.saveProjectAs).toHaveBeenCalled()
    })

    it('should list all projects', async () => {
      const projects = [
        { id: 'project-1', name: 'Project 1' },
        { id: 'project-2', name: 'Project 2' }
      ]
      mockStorage.listProjects.mockResolvedValue(projects)
      
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const projectList = await result.current.listProjects()
      
      expect(projectList).toEqual(projects)
    })

    it('should get recent projects', async () => {
      const recentProjects = [
        { id: 'recent-1', name: 'Recent 1', lastOpened: new Date() }
      ]
      mockStorage.getRecentProjects.mockResolvedValue(recentProjects)
      
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const recent = await result.current.getRecentProjects()
      
      expect(recent).toEqual(recentProjects)
    })

    it('should delete a project', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      await result.current.deleteProject('/path/to/project.scormproj')
      
      expect(mockStorage.deleteProject).toHaveBeenCalledWith('/path/to/project.scormproj')
    })
  })

  describe('Recovery Operations', () => {
    it('should check for recovery backups', async () => {
      const recoveryInfo = { 
        hasBackup: true, 
        backupPath: '/backup/path',
        projectName: 'Recovered Project'
      }
      mockStorage.checkForRecovery.mockResolvedValue(recoveryInfo)
      
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const recovery = await result.current.checkForRecovery()
      
      expect(recovery).toEqual(recoveryInfo)
    })

    it('should recover from backup', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      await result.current.recoverFromBackup('/backup/path')
      
      expect(mockStorage.recoverFromBackup).toHaveBeenCalledWith('/backup/path')
    })
  })

  describe('Media Operations', () => {
    it('should store media blob', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const blob = new Blob(['test'], { type: 'image/png' })
      const metadata = { title: 'Test Image' }
      
      await result.current.storeMedia('media-123', blob, 'image', metadata)
      
      expect(mockStorage.storeMedia).toHaveBeenCalledWith('media-123', blob, 'image', metadata)
    })

    it('should store YouTube video', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const metadata = { title: 'YouTube Video' }
      
      await result.current.storeYouTubeVideo('yt-123', 'https://youtube.com/watch?v=123', metadata)
      
      expect(mockStorage.storeYouTubeVideo).toHaveBeenCalledWith('yt-123', 'https://youtube.com/watch?v=123', metadata)
    })

    it('should get media by id', async () => {
      const media = { id: 'media-123', type: 'image', url: 'blob:...' }
      mockStorage.getMedia.mockResolvedValue(media)
      
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const retrievedMedia = await result.current.getMedia('media-123')
      
      expect(retrievedMedia).toEqual(media)
    })

    it('should get media for topic', async () => {
      const topicMedia = [
        { id: 'media-1', type: 'image' },
        { id: 'media-2', type: 'video' }
      ]
      mockStorage.getMediaForTopic.mockResolvedValue(topicMedia)
      
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const media = await result.current.getMediaForTopic('topic-123')
      
      expect(media).toEqual(topicMedia)
    })
  })

  describe('Content Operations', () => {
    it('should save content', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const content = { title: 'Topic Title', body: 'Topic content' }
      
      await result.current.saveContent('content-123', content)
      
      expect(mockStorage.saveContent).toHaveBeenCalledWith('content-123', content)
    })

    it('should get content', async () => {
      const content = { title: 'Saved Topic', body: 'Saved content' }
      mockStorage.getContent.mockResolvedValue(content)
      
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const retrievedContent = await result.current.getContent('content-123')
      
      expect(retrievedContent).toEqual(content)
    })

    it('should save course metadata', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const metadata = { title: 'Course Title', version: '1.0' }
      
      await result.current.saveCourseMetadata(metadata)
      
      expect(mockStorage.saveCourseMetadata).toHaveBeenCalledWith(metadata)
    })

    it('should get course metadata', async () => {
      const metadata = { title: 'Course Title', version: '1.0' }
      mockStorage.getCourseMetadata.mockResolvedValue(metadata)
      
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const retrievedMetadata = await result.current.getCourseMetadata()
      
      expect(retrievedMetadata).toEqual(metadata)
    })
  })

  describe('Settings Operations', () => {
    it('should save AI prompt', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      await result.current.saveAiPrompt('Generate a course about...')
      
      expect(mockStorage.saveAiPrompt).toHaveBeenCalledWith('Generate a course about...')
    })

    it('should get AI prompt', async () => {
      mockStorage.getAiPrompt.mockResolvedValue('Saved AI prompt')
      
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const prompt = await result.current.getAiPrompt()
      
      expect(prompt).toBe('Saved AI prompt')
    })

    it('should save audio settings', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const settings = { voice: 'en-US-Standard-A', speed: 1.0 }
      
      await result.current.saveAudioSettings(settings)
      
      expect(mockStorage.saveAudioSettings).toHaveBeenCalledWith(settings)
    })

    it('should get audio settings', async () => {
      const settings = { voice: 'en-US-Standard-A', speed: 1.0 }
      mockStorage.getAudioSettings.mockResolvedValue(settings)
      
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const retrievedSettings = await result.current.getAudioSettings()
      
      expect(retrievedSettings).toEqual(settings)
    })

    it('should save SCORM config', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const config = { version: '2004', completionThreshold: 80 }
      
      await result.current.saveScormConfig(config)
      
      expect(mockStorage.saveScormConfig).toHaveBeenCalledWith(config)
    })

    it('should get SCORM config', async () => {
      const config = { version: '2004', completionThreshold: 80 }
      mockStorage.getScormConfig.mockResolvedValue(config)
      
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const retrievedConfig = await result.current.getScormConfig()
      
      expect(retrievedConfig).toEqual(config)
    })
  })

  describe('Import/Export Operations', () => {
    it('should export project', async () => {
      const blob = new Blob(['exported data'], { type: 'application/zip' })
      mockStorage.exportProject.mockResolvedValue(blob)
      
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const exported = await result.current.exportProject()
      
      expect(exported).toEqual(blob)
    })

    it('should import project from zip', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const zipBlob = new Blob(['zip data'], { type: 'application/zip' })
      
      await result.current.importProjectFromZip(zipBlob)
      
      expect(mockStorage.importProjectFromZip).toHaveBeenCalledWith(zipBlob)
    })
  })

  describe('Utility Operations', () => {
    it('should get current project ID', () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const projectId = result.current.getCurrentProjectId()
      
      expect(mockStorage.getCurrentProjectId).toHaveBeenCalled()
      expect(projectId).toBe('test-project-123')
    })

    it('should set projects directory', () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      result.current.setProjectsDirectory('/new/projects/dir')
      
      expect(mockStorage.setProjectsDirectory).toHaveBeenCalledWith('/new/projects/dir')
    })

    it('should migrate from localStorage', async () => {
      const migratedProjects = [{ id: 'migrated-1', name: 'Migrated Project' }]
      mockStorage.migrateFromLocalStorage.mockResolvedValue(migratedProjects)
      
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      const migrated = await result.current.migrateFromLocalStorage()
      
      expect(migrated).toEqual(migratedProjects)
    })

    it('should clear recent files cache', async () => {
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      await result.current.clearRecentFilesCache()
      
      expect(mockStorage.clearRecentFilesCache).toHaveBeenCalled()
    })
  })

  describe('Error States', () => {
    it('should handle storage with error state', () => {
      ;(usePersistentStorage as any).mockReturnValue({
        ...mockStorage,
        isInitialized: false,
        error: 'Failed to initialize storage'
      })
      
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      expect(result.current.isInitialized).toBe(false)
      expect(result.current.error).toBe('Failed to initialize storage')
    })

    it('should handle null currentProjectId', () => {
      ;(usePersistentStorage as any).mockReturnValue({
        ...mockStorage,
        currentProjectId: null,
        getCurrentProjectId: vi.fn(() => null)
      })
      
      const { result } = renderHook(() => useStorage(), { wrapper })
      
      expect(result.current.currentProjectId).toBeNull()
      expect(result.current.getCurrentProjectId()).toBeNull()
    })
  })
})