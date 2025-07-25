import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { FileStorage } from '../FileStorage'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...paths: string[]) => paths.join('/'))
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(() => Promise.resolve('/path/to/project/project.scormproj'))
}))

describe('FileStorage - File-Based Storage', () => {
  let fileStorage: FileStorage
  const mockInvoke = invoke as jest.MockedFunction<typeof invoke>

  beforeEach(() => {
    fileStorage = new FileStorage()
    vi.clearAllMocks()
    
    // Mock fetch for base64ToBlob
    global.fetch = vi.fn().mockImplementation((dataUrl: string) => {
      return Promise.resolve({
        blob: () => Promise.resolve(new Blob(['test-data'], { type: 'application/octet-stream' }))
      })
    })
    
    // Default mock implementation
    mockInvoke.mockImplementation(async (command: string) => {
      if (command === 'get_recent_projects') {
        return []
      }
      if (command === 'save_project') {
        return true
      }
      if (command === 'update_window_title') {
        return true
      }
      return null
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Intent: Store media files externally from project file', () => {
    it('should store image files in media/images directory', async () => {
      // Arrange
      const projectId = 'test-project-123'
      const imageBlob = new Blob(['fake-image-data'], { type: 'image/jpeg' })
      const imageId = 'welcome-img-1'
      
      mockInvoke.mockImplementation(async (command: string, args?: any) => {
        if (command === 'get_projects_dir') {
          return '/path/to/projects'
        }
        if (command === 'create_project') {
          return { id: projectId, name: 'Test Project', path: '/path/to/project' }
        }
        if (command === 'write_file') {
          return true
        }
        return null
      })

      // Act
      await fileStorage.initialize()
      await fileStorage.createProject('Test Project')
      await fileStorage.storeMedia(imageId, imageBlob, 'image', { 
        originalName: 'test.jpg',
        topicId: 'welcome' 
      })

      // Assert
      // Find the actual write_file call
      const writeFileCalls = mockInvoke.mock.calls.filter(call => call[0] === 'write_file')
      expect(writeFileCalls.length).toBeGreaterThan(0)
      
      const writeFileCall = writeFileCalls[0]
      expect(writeFileCall[0]).toBe('write_file')
      expect(writeFileCall[1]).toMatchObject({
        relative_path: `media/images/${imageId}.jpg`,
        content: expect.any(String)
      })
    })

    it('should store audio files in media/audio directory', async () => {
      // Arrange
      const projectId = 'test-project-123'
      const audioBlob = new Blob(['fake-audio-data'], { type: 'audio/mpeg' })
      const audioId = 'audio-0001'
      
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === 'get_projects_dir') {
          return '/path/to/projects'
        }
        if (command === 'create_project') {
          return { id: projectId, name: 'Test Project', path: '/path/to/project' }
        }
        if (command === 'write_file') {
          return true
        }
        return null
      })

      // Act
      await fileStorage.initialize()
      await fileStorage.createProject('Test Project')
      await fileStorage.storeMedia(audioId, audioBlob, 'audio', {
        blockNumber: '0001',
        topicId: 'safety-fundamentals'
      })

      // Assert
      // Find the actual write_file call
      const writeFileCalls = mockInvoke.mock.calls.filter(call => call[0] === 'write_file')
      expect(writeFileCalls.length).toBeGreaterThan(0)
      
      const writeFileCall = writeFileCalls[0]
      expect(writeFileCall[0]).toBe('write_file')
      expect(writeFileCall[1]).toMatchObject({
        relative_path: `media/audio/${audioId}.mp3`,
        content: expect.any(String)
      })
    })

    it('should store only references in the project file, not binary data', async () => {
      // Arrange
      const projectId = 'test-project-123'
      const imageBlob = new Blob(['fake-image-data'], { type: 'image/jpeg' })
      const imageId = 'topic-img-1'
      let savedProjectData: any = null
      
      mockInvoke.mockImplementation(async (command: string, args?: any) => {
        if (command === 'get_projects_dir') {
          return '/path/to/projects'
        }
        if (command === 'create_project') {
          return { id: projectId, name: 'Test Project', path: '/path/to/project' }
        }
        if (command === 'save_project' && args?.projectData) {
          // Capture the project data being saved
          savedProjectData = args.projectData
          return true
        }
        if (command === 'write_file') {
          return true
        }
        return null
      })

      // Act
      await fileStorage.initialize()
      await fileStorage.createProject('Test Project')
      await fileStorage.storeMedia(imageId, imageBlob, 'image')
      await fileStorage.saveProject()

      // Assert
      expect(savedProjectData).toBeDefined()
      const savedImage = savedProjectData.media.images[0]
      expect(savedImage).toBeDefined()
      expect(savedImage.id).toBe(imageId)
      expect(savedImage.filename).toBe(`${imageId}.jpg`)
      // Check for snake_case conversion
      expect(savedImage.relative_path || savedImage.relativePath).toBe(`media/images/${imageId}.jpg`)
      // Check that no base64 data is stored
      expect(savedImage.base64Data).toBeUndefined()
      expect(savedImage.base64_data).toBeUndefined()
    })
  })

  describe('Intent: Load media files from external storage', () => {
    it('should load image files from disk when requested', async () => {
      // Arrange
      const projectId = 'test-project-123'
      const imageId = 'welcome-img-1'
      const fakeImageData = 'fake-base64-image-data'
      
      mockInvoke.mockImplementation(async (command: string, args?: any) => {
        if (command === 'get_projects_dir') {
          return '/path/to/projects'
        }
        if (command === 'load_project') {
          return {
            project: {
              id: projectId,
              name: 'Test Project',
              created: new Date().toISOString(),
              last_modified: new Date().toISOString()
            },
            media: {
              images: [{
                id: imageId,
                filename: `${imageId}.jpg`,
                relativePath: `media/images/${imageId}.jpg`,
                type: 'image'
              }],
              videos: [],
              audio: []
            },
            course_data: {},
            course_content: {}
          }
        }
        if (command === 'read_file' && args?.relative_path === `media/images/${imageId}.jpg`) {
          return fakeImageData
        }
        return null
      })

      // Act
      await fileStorage.initialize()
      await fileStorage.openProject(projectId)
      const media = await fileStorage.getMedia(imageId)

      // Assert
      expect(media).toBeDefined()
      expect(media.blob).toBeInstanceOf(Blob)
      expect(media.id).toBe(imageId)
      expect(mockInvoke).toHaveBeenCalledWith('read_file', {
        project_id: projectId,
        relative_path: `media/images/${imageId}.jpg`
      })
    })

    it('should handle missing media files gracefully', async () => {
      // Arrange
      const projectId = 'test-project-123'
      const imageId = 'missing-img'
      
      mockInvoke.mockImplementation(async (command: string, args?: any) => {
        if (command === 'get_projects_dir') {
          return '/path/to/projects'
        }
        if (command === 'load_project') {
          return {
            project: {
              id: projectId,
              name: 'Test Project',
              created: new Date().toISOString(),
              last_modified: new Date().toISOString()
            },
            media: {
              images: [{
                id: imageId,
                filename: `${imageId}.jpg`,
                relativePath: `media/images/${imageId}.jpg`,
                type: 'image'
              }],
              videos: [],
              audio: []
            },
            course_data: {},
            course_content: {}
          }
        }
        if (command === 'read_file') {
          throw new Error('File not found')
        }
        return null
      })

      // Act
      await fileStorage.initialize()
      await fileStorage.openProject(projectId)
      const media = await fileStorage.getMedia(imageId)

      // Assert
      expect(media).toBeDefined()
      expect(media.blob).toBeUndefined()
      expect(media.error).toBe('File not found')
    })
  })

  describe('Intent: Export project with all media files', () => {
    it('should create a zip file containing project and all media', async () => {
      // Arrange
      const projectId = 'test-project-123'
      const exportPath = '/path/to/export.zip'
      let actualProjectId: string | null = null
      
      mockInvoke.mockImplementation(async (command: string, args?: any) => {
        if (command === 'get_projects_dir') {
          return '/path/to/projects'
        }
        if (command === 'create_project') {
          return { id: projectId, name: 'Test Project', path: '/path/to/project' }
        }
        if (command === 'save_project') {
          // Capture the actual project ID being used
          if (args?.projectData?.project?.id) {
            actualProjectId = args.projectData.project.id
          }
          return true
        }
        if (command === 'export_project_to_zip') {
          return exportPath
        }
        if (command === 'read_zip_file') {
          // Return valid base64 data
          return 'UEsDBAoAAAAAAIdO4kAAAAAAAAAAAAAAAAA='
        }
        return null
      })

      // Act
      await fileStorage.initialize()
      await fileStorage.createProject('Test Project')
      const result = await fileStorage.exportProject()

      // Assert
      // The export should use the actual project ID created
      expect(mockInvoke).toHaveBeenCalledWith('export_project_to_zip', {
        project_id: actualProjectId || expect.any(String)
      })
      expect(result).toBeInstanceOf(Blob)
    })
  })

  describe('Intent: Import project from zip file', () => {
    it('should extract zip and load project with all media', async () => {
      // Arrange
      const zipBlob = new Blob(['fake-zip-data'], { type: 'application/zip' })
      const projectId = 'imported-project-123'
      
      mockInvoke.mockImplementation(async (command: string, args?: any) => {
        if (command === 'get_projects_dir') {
          return '/path/to/projects'
        }
        if (command === 'import_project_from_zip') {
          return {
            project: {
              id: projectId,
              project: {
                id: projectId,
                name: 'Imported Project',
                created: new Date().toISOString(),
                last_modified: new Date().toISOString()
              },
              media: {
                images: [{
                  id: 'img-1',
                  filename: 'img-1.jpg',
                  relativePath: 'media/images/img-1.jpg',
                  type: 'image'
                }],
                videos: [],
                audio: []
              },
              course_data: {},
              course_content: {}
            }
          }
        }
        return null
      })

      // Act
      await fileStorage.initialize()
      await fileStorage.importProjectFromZip(zipBlob)

      // Assert
      expect(mockInvoke).toHaveBeenCalledWith('import_project_from_zip', {
        zip_content: expect.any(String) // Base64 zip content
      })
      expect(fileStorage.getCurrentProjectId()).toBe(projectId)
    })
  })

})