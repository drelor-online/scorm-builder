import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePersistentStorage } from '../usePersistentStorage'
import { fileStorage } from '../../services/FileStorage'

// Mock FileStorage
vi.mock('../../services/FileStorage', () => ({
  fileStorage: {
    initialize: vi.fn(),
    isInitialized: false,
    getCurrentProjectId: vi.fn(),
    createProject: vi.fn(),
    openProject: vi.fn(),
    openProjectFromFile: vi.fn(),
    saveProject: vi.fn(),
    saveProjectAs: vi.fn(),
    listProjects: vi.fn(),
    deleteProject: vi.fn(),
    saveCourseMetadata: vi.fn(),
    getCourseMetadata: vi.fn(),
    saveContent: vi.fn(),
    getContent: vi.fn(),
    storeMedia: vi.fn(),
    storeYouTubeVideo: vi.fn(),
    getMedia: vi.fn(),
    getMediaForTopic: vi.fn(),
    saveAiPrompt: vi.fn(),
    getAiPrompt: vi.fn(),
    saveAudioSettings: vi.fn(),
    getAudioSettings: vi.fn(),
    saveScormConfig: vi.fn(),
    getScormConfig: vi.fn(),
    exportProject: vi.fn(),
    migrateFromLocalStorage: vi.fn()
  }
}))

describe('usePersistentStorage with FileStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize FileStorage on mount', async () => {
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.getCurrentProjectId.mockReturnValue(null)

    const { result } = renderHook(() => usePersistentStorage())

    expect(mockFileStorage.initialize).toHaveBeenCalled()
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.isInitialized).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('should handle initialization errors', async () => {
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockRejectedValueOnce(new Error('Init failed'))

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.isInitialized).toBe(false)
    expect(result.current.error).toBe('Init failed')
  })

  it('should create a new project', async () => {
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.createProject.mockResolvedValueOnce({
      id: 'project_123',
      name: 'Test Project',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString()
    })
    mockFileStorage.getCurrentProjectId.mockReturnValue('project_123')

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    let project
    await act(async () => {
      project = await result.current.createProject('Test Project')
    })

    expect(mockFileStorage.createProject).toHaveBeenCalledWith('Test Project')
    expect(project).toMatchObject({
      id: 'project_123',
      name: 'Test Project'
    })
    expect(result.current.currentProjectId).toBe('project_123')
  })

  it('should open an existing project', async () => {
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.openProject.mockResolvedValueOnce(undefined)
    mockFileStorage.getCurrentProjectId
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('project_456')

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await act(async () => {
      await result.current.openProject('project_456')
    })

    expect(mockFileStorage.openProject).toHaveBeenCalledWith('project_456')
    expect(result.current.currentProjectId).toBe('project_456')
  })

  it('should open a project from file', async () => {
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.openProjectFromFile.mockResolvedValueOnce(undefined)
    mockFileStorage.getCurrentProjectId
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('project_789')

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await act(async () => {
      await result.current.openProjectFromFile()
    })

    expect(mockFileStorage.openProjectFromFile).toHaveBeenCalled()
    expect(result.current.currentProjectId).toBe('project_789')
  })

  it('should list all projects', async () => {
    const mockProjects = [
      { id: 'p1', name: 'Project 1' },
      { id: 'p2', name: 'Project 2' }
    ]
    
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.listProjects.mockResolvedValueOnce(mockProjects)

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    let projects
    await act(async () => {
      projects = await result.current.listProjects()
    })

    expect(projects).toEqual(mockProjects)
  })

  it('should store media with proper parameters', async () => {
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.storeMedia.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const blob = new Blob(['test'], { type: 'image/jpeg' })
    const metadata = { alt: 'Test image' }

    await act(async () => {
      await result.current.storeMedia('img_123', blob, 'image', metadata)
    })

    expect(mockFileStorage.storeMedia).toHaveBeenCalledWith(
      'img_123',
      blob,
      'image',
      metadata
    )
  })

  it('should store YouTube videos', async () => {
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.storeYouTubeVideo.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const videoUrl = 'https://youtube.com/watch?v=abc123'
    const metadata = { title: 'Test Video' }

    await act(async () => {
      await result.current.storeYouTubeVideo('vid_123', videoUrl, metadata)
    })

    expect(mockFileStorage.storeYouTubeVideo).toHaveBeenCalledWith(
      'vid_123',
      videoUrl,
      metadata
    )
  })

  it('should save and retrieve course metadata', async () => {
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.saveCourseMetadata.mockResolvedValueOnce(undefined)
    mockFileStorage.getCourseMetadata.mockResolvedValueOnce({
      courseTitle: 'Test Course',
      difficulty: 3,
      topics: ['Topic 1']
    })

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const metadata = {
      courseTitle: 'Test Course',
      difficulty: 3,
      topics: ['Topic 1']
    }

    await act(async () => {
      await result.current.saveCourseMetadata(metadata)
    })

    expect(mockFileStorage.saveCourseMetadata).toHaveBeenCalledWith(metadata)

    let retrieved
    await act(async () => {
      retrieved = await result.current.getCourseMetadata()
    })

    expect(retrieved).toEqual(metadata)
  })

  it('should handle project deletion', async () => {
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.deleteProject.mockResolvedValueOnce(undefined)
    mockFileStorage.getCurrentProjectId
      .mockReturnValueOnce('project_123')
      .mockReturnValueOnce(null)

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await act(async () => {
      await result.current.deleteProject('project_123')
    })

    expect(mockFileStorage.deleteProject).toHaveBeenCalledWith('project_123')
    expect(result.current.currentProjectId).toBeNull()
  })

  it('should export project as blob', async () => {
    const mockBlob = new Blob(['project data'], { type: 'application/json' })
    
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.exportProject.mockResolvedValueOnce(mockBlob)

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    let blob
    await act(async () => {
      blob = await result.current.exportProject()
    })

    expect(blob).toBe(mockBlob)
  })

  it('should migrate data from localStorage', async () => {
    const mockMigratedProjects = [
      { id: 'old1', name: 'Migrated 1' },
      { id: 'old2', name: 'Migrated 2' }
    ]
    
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.migrateFromLocalStorage.mockResolvedValueOnce(mockMigratedProjects)

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    let migrated
    await act(async () => {
      migrated = await result.current.migrateFromLocalStorage()
    })

    expect(migrated).toEqual(mockMigratedProjects)
  })

  it('should save project data', async () => {
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.saveProject.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await act(async () => {
      await result.current.saveProject()
    })

    expect(mockFileStorage.saveProject).toHaveBeenCalled()
  })

  it('should save project as new file', async () => {
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.saveProjectAs.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await act(async () => {
      await result.current.saveProjectAs()
    })

    expect(mockFileStorage.saveProjectAs).toHaveBeenCalled()
  })

  it('should save AI prompt', async () => {
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.saveAiPrompt.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await act(async () => {
      await result.current.saveAiPrompt('Test prompt')
    })

    expect(mockFileStorage.saveAiPrompt).toHaveBeenCalledWith('Test prompt')
  })

  it('should retrieve AI prompt', async () => {
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.getAiPrompt.mockResolvedValueOnce('Test prompt')

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    let prompt
    await act(async () => {
      prompt = await result.current.getAiPrompt()
    })

    expect(prompt).toBe('Test prompt')
  })

  it('should save audio settings', async () => {
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.saveAudioSettings.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const settings = { voice: 'en-US-AvaNeural', speed: 1.2 }
    await act(async () => {
      await result.current.saveAudioSettings(settings)
    })

    expect(mockFileStorage.saveAudioSettings).toHaveBeenCalledWith(settings)
  })

  it('should retrieve audio settings', async () => {
    const mockSettings = { voice: 'en-US-AvaNeural', speed: 1.2, pitch: 1.0 }
    
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.getAudioSettings.mockResolvedValueOnce(mockSettings)

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    let settings
    await act(async () => {
      settings = await result.current.getAudioSettings()
    })

    expect(settings).toEqual(mockSettings)
  })

  it('should save SCORM config', async () => {
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.saveScormConfig.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const config = { version: '1.2', passingScore: 75 }
    await act(async () => {
      await result.current.saveScormConfig(config)
    })

    expect(mockFileStorage.saveScormConfig).toHaveBeenCalledWith(config)
  })

  it('should retrieve SCORM config', async () => {
    const mockConfig = { version: '2004', completionCriteria: 'all_pages', passingScore: 80 }
    
    const mockFileStorage = fileStorage as any
    mockFileStorage.initialize.mockResolvedValueOnce(undefined)
    mockFileStorage.isInitialized = true
    mockFileStorage.getScormConfig.mockResolvedValueOnce(mockConfig)

    const { result } = renderHook(() => usePersistentStorage())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    let config
    await act(async () => {
      config = await result.current.getScormConfig()
    })

    expect(config).toEqual(mockConfig)
  })
})