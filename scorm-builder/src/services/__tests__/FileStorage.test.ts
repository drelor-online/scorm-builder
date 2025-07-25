import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'

// Set up mocks before any imports
vi.mock('@tauri-apps/api/core')
vi.mock('@tauri-apps/plugin-dialog')
vi.mock('@tauri-apps/api/path')

// Import the mocked modules
import { invoke } from '@tauri-apps/api/core'
import * as dialog from '@tauri-apps/plugin-dialog'
import { join } from '@tauri-apps/api/path'

// Import after mocks
import { FileStorage } from '../FileStorage'
import type { ProjectFile, MediaItem } from '../FileStorage'

// Get mock functions
const mockInvoke = vi.mocked(invoke)
const mockSave = vi.mocked(dialog.save)
const mockOpen = vi.mocked(dialog.open)
const mockJoin = vi.mocked(join)

describe('FileStorage', () => {
  let storage: FileStorage
  
  beforeEach(() => {
    storage = new FileStorage()
    vi.clearAllMocks()
    // Mock join to return Windows-style paths for tests
    mockJoin.mockImplementation(async (...paths) => paths.join('\\'))
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('initialization', () => {
    it('should initialize and get projects directory', async () => {
      mockInvoke.mockResolvedValueOnce('C:\\Users\\Test\\Documents\\SCORM Projects')
      
      await storage.initialize()
      
      expect(mockInvoke).toHaveBeenCalledWith('get_projects_dir')
      expect(storage.isInitialized).toBe(true)
    })
    
    it('should handle initialization errors gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed to get directory'))
      
      await expect(storage.initialize()).rejects.toThrow('Failed to get directory')
      expect(storage.isInitialized).toBe(false)
    })
  })
  
  describe('project management', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce('C:\\Users\\Test\\Documents\\SCORM Projects')
      await storage.initialize()
    })
    
    it('should create a new project', async () => {
      const projectName = 'Test Project'
      const expectedProject = {
        id: expect.stringMatching(/^project_\d+_\w+$/),
        name: projectName,
        created: expect.any(String),
        lastAccessed: expect.any(String)
      }
      
      const project = await storage.createProject(projectName)
      
      expect(project).toMatchObject({
        name: projectName,
        id: expect.stringMatching(/^project_\d+_\w+$/)
      })
      expect(storage.getCurrentProjectId()).toBe(project.id)
    })
    
    it('should save project data to file', async () => {
      mockInvoke.mockResolvedValueOnce(undefined) // save_project response
      
      const project = await storage.createProject('Save Test')
      await storage.saveCourseMetadata({
        courseTitle: 'Test Course',
        difficulty: 3,
        topics: ['Topic 1', 'Topic 2']
      })
      
      expect(mockInvoke).toHaveBeenCalledWith('save_project', {
        projectData: expect.objectContaining({
          version: '1.0',
          project: expect.objectContaining({
            name: 'Save Test'
          }),
          courseData: expect.objectContaining({
            title: 'Test Course',
            difficulty: 3
          })
        }),
        filePath: expect.stringContaining('.scormproj')
      })
    })
    
    it('should load project from file', async () => {
      const mockProjectData: ProjectFile = {
        version: '1.0',
        project: {
          id: 'project_123',
          name: 'Loaded Project',
          created: new Date().toISOString(),
          lastModified: new Date().toISOString()
        },
        courseData: {
          title: 'Loaded Course',
          difficulty: 2,
          template: 'standard',
          topics: ['Topic A'],
          customTopics: null
        },
        aiPrompt: null,
        courseContent: null,
        media: {
          images: [],
          videos: [],
          audio: []
        },
        audioSettings: {
          voice: 'en-US-JennyNeural',
          speed: 1.0,
          pitch: 1.0
        },
        scormConfig: {
          version: '2004',
          completionCriteria: 'all_pages',
          passingScore: 80
        }
      }
      
      mockOpen.mockResolvedValueOnce('C:\\test\\project.scormproj' as any)
      mockInvoke.mockResolvedValueOnce(mockProjectData)
      
      await storage.openProjectFromFile()
      
      expect(mockOpen).toHaveBeenCalled()
      expect(mockInvoke).toHaveBeenCalledWith('load_project', {
        filePath: 'C:\\test\\project.scormproj'
      })
      expect(storage.getCurrentProjectId()).toBe('project_123')
    })
    
    it('should list all projects', async () => {
      const mockProject1: ProjectFile = {
        version: '1.0',
        project: {
          id: 'project1',
          name: 'Project 1',
          created: new Date().toISOString(),
          lastModified: new Date().toISOString()
        },
        courseData: {
          title: 'Course 1',
          difficulty: 2,
          template: 'standard',
          topics: [],
          customTopics: null
        },
        aiPrompt: null,
        courseContent: null,
        media: { images: [], videos: [], audio: [] },
        audioSettings: { voice: 'en-US-JennyNeural', speed: 1.0, pitch: 1.0 },
        scormConfig: { version: '2004', completionCriteria: 'all_pages', passingScore: 80 }
      }
      
      const mockProject2: ProjectFile = {
        version: '1.0',
        project: {
          id: 'project2',
          name: 'Project 2',
          created: new Date().toISOString(),
          lastModified: new Date().toISOString()
        },
        courseData: {
          title: 'Course 2',
          difficulty: 3,
          template: 'standard',
          topics: [],
          customTopics: null
        },
        aiPrompt: null,
        courseContent: null,
        media: { images: [], videos: [], audio: [] },
        audioSettings: { voice: 'en-US-JennyNeural', speed: 1.0, pitch: 1.0 },
        scormConfig: { version: '2004', completionCriteria: 'all_pages', passingScore: 80 }
      }
      
      mockInvoke
        .mockResolvedValueOnce([
          'C:\\Projects\\project1.scormproj',
          'C:\\Projects\\project2.scormproj'
        ])
        .mockResolvedValueOnce(mockProject1)
        .mockResolvedValueOnce(mockProject2)
      
      const projects = await storage.listProjects()
      
      expect(mockInvoke).toHaveBeenCalledWith('list_projects')
      expect(mockInvoke).toHaveBeenCalledWith('load_project', { filePath: 'C:\\Projects\\project1.scormproj' })
      expect(mockInvoke).toHaveBeenCalledWith('load_project', { filePath: 'C:\\Projects\\project2.scormproj' })
      expect(projects).toHaveLength(2)
      expect(projects[0].name).toBe('Project 1')
      expect(projects[1].name).toBe('Project 2')
    })
    
    it('should delete a project', async () => {
      mockInvoke.mockResolvedValueOnce(undefined)
      
      await storage.deleteProject('project_123')
      
      expect(mockInvoke).toHaveBeenCalledWith('delete_project', {
        filePath: expect.stringContaining('project_123.scormproj')
      })
    })
  })
  
  describe('data persistence', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce('C:\\Users\\Test\\Documents\\SCORM Projects')
      await storage.initialize()
      await storage.createProject('Data Test')
    })
    
    it('should save and retrieve course metadata', async () => {
      const metadata = {
        courseTitle: 'Advanced Course',
        difficulty: 4,
        topics: ['Advanced Topic 1', 'Advanced Topic 2']
      }
      
      await storage.saveCourseMetadata(metadata)
      const retrieved = await storage.getCourseMetadata()
      
      expect(retrieved).toEqual(metadata)
    })
    
    it('should save and retrieve content items', async () => {
      const contentItem = {
        topicId: 'topic_1',
        title: 'Introduction',
        content: '<p>Welcome to the course</p>',
        narration: 'Welcome narration text'
      }
      
      await storage.saveContent('intro', contentItem)
      const retrieved = await storage.getContent('intro')
      
      expect(retrieved).toEqual(contentItem)
    })
    
    it('should handle media storage', async () => {
      const blob = new Blob(['test image data'], { type: 'image/jpeg' })
      const mediaId = 'img_123'
      
      await storage.storeMedia(mediaId, blob, 'image', { alt: 'Test image' })
      
      // Check that the media was added to the project data
      const projectData = storage.getCurrentProjectData()
      expect(projectData?.media.images).toHaveLength(1)
      expect(projectData?.media.images[0]).toMatchObject({
        id: mediaId,
        filename: expect.stringContaining('.jpg'),
        base64Data: expect.any(String),
        metadata: { alt: 'Test image' }
      })
    })
    
    it('should store YouTube URLs instead of downloading videos', async () => {
      const videoUrl = 'https://youtube.com/watch?v=abc123'
      const videoId = 'vid_123'
      
      await storage.storeYouTubeVideo(videoId, videoUrl, { title: 'Test Video' })
      
      const projectData = storage.getCurrentProjectData()
      expect(projectData?.media.videos).toHaveLength(1)
      expect(projectData?.media.videos[0]).toMatchObject({
        id: videoId,
        youtubeUrl: videoUrl,
        metadata: { title: 'Test Video' }
      })
    })
  })
  
  describe('auto-save functionality', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce('C:\\Users\\Test\\Documents\\SCORM Projects')
      await storage.initialize()
      await storage.createProject('AutoSave Test')
    })
    
    it('should auto-save after data changes', async () => {
      vi.useFakeTimers()
      
      // Reset mocks after project creation
      mockInvoke.mockClear()
      
      // Make a change
      await storage.saveCourseMetadata({ courseTitle: 'Changed Title' })
      
      // Auto-save should NOT be triggered immediately
      expect(mockInvoke).not.toHaveBeenCalledWith('save_project', expect.anything())
      
      // Fast forward past debounce time (1500ms)
      vi.advanceTimersByTime(1500)
      
      // Now auto-save should have been triggered
      expect(mockInvoke).toHaveBeenCalledWith('save_project', expect.objectContaining({
        projectData: expect.objectContaining({
          courseData: expect.objectContaining({
            title: 'Changed Title'
          })
        })
      }))
      
      vi.useRealTimers()
    })
    
    it('should debounce multiple rapid saves', async () => {
      vi.useFakeTimers()
      
      // Reset mocks after project creation
      mockInvoke.mockClear()
      
      // Make multiple rapid changes
      await storage.saveCourseMetadata({ courseTitle: 'Title 1' })
      await storage.saveCourseMetadata({ courseTitle: 'Title 2' })
      await storage.saveCourseMetadata({ courseTitle: 'Title 3' })
      
      // Should not save immediately
      expect(mockInvoke).not.toHaveBeenCalledWith('save_project', expect.anything())
      
      // Fast forward past debounce time (1500ms)
      vi.advanceTimersByTime(1500)
      
      // Should only save once with the latest data
      const saveCalls = mockInvoke.mock.calls.filter(call => call[0] === 'save_project')
      expect(saveCalls).toHaveLength(1)
      expect(saveCalls[0][1].projectData.courseData.title).toBe('Title 3')
      
      vi.useRealTimers()
    })
  })
  
  describe('error handling', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce('C:\\Users\\Test\\Documents\\SCORM Projects')
      await storage.initialize()
    })
    
    it('should handle save errors gracefully', async () => {
      const project = await storage.createProject('Error Test')
      
      // Clear mocks and setup error for next save
      mockInvoke.mockClear()
      mockInvoke.mockRejectedValueOnce(new Error('Disk full'))
      
      await expect(storage.saveProject()).rejects.toThrow('Disk full')
    })
    
    it('should handle load errors gracefully', async () => {
      mockOpen.mockResolvedValueOnce('C:\\test\\corrupt.scormproj' as any)
      mockInvoke.mockRejectedValueOnce(new Error('Invalid JSON'))
      
      await expect(storage.openProjectFromFile()).rejects.toThrow('Invalid JSON')
    })
  })
  
  describe('migration from old storage', () => {
    it('should detect and migrate localStorage data', async () => {
      // Mock localStorage data
      const oldData = {
        'scorm_project_old123': JSON.stringify({
          id: 'old123',
          name: 'Old Project',
          created: '2024-01-01',
          lastAccessed: '2024-01-01'
        }),
        'scorm_course_metadata_old123': JSON.stringify({
          courseTitle: 'Old Course',
          difficulty: 2
        })
      }
      
      Object.entries(oldData).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })
      
      mockInvoke.mockResolvedValueOnce('C:\\Users\\Test\\Documents\\SCORM Projects')
      
      await storage.initialize()
      const migrated = await storage.migrateFromLocalStorage()
      
      expect(migrated).toHaveLength(1)
      expect(mockInvoke).toHaveBeenCalledWith('save_project', {
        projectData: expect.objectContaining({
          project: expect.objectContaining({
            name: 'Old Project'
          }),
          courseData: expect.objectContaining({
            title: 'Old Course'
          })
        }),
        filePath: expect.stringContaining('old123.scormproj')
      })
    })
  })
})