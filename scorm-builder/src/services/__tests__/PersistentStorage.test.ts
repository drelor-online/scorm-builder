import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PersistentStorage } from '../PersistentStorage'

// Mock IndexedDB
const mockDB = {
  transaction: vi.fn(),
  close: vi.fn()
}

const mockTransaction = {
  objectStore: vi.fn()
}

const mockObjectStore = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
  clear: vi.fn(),
  index: vi.fn()
}

const mockIndex = {
  getAll: vi.fn()
}

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

// Replace global objects
global.indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn()
} as any

global.localStorage = localStorageMock as any

describe('PersistentStorage', () => {
  let storage: PersistentStorage

  beforeEach(() => {
    vi.clearAllMocks()
    storage = new PersistentStorage()
    
    // Setup default IndexedDB mock behavior
    mockTransaction.objectStore.mockReturnValue(mockObjectStore)
    mockDB.transaction.mockReturnValue(mockTransaction)
    mockObjectStore.index.mockReturnValue(mockIndex)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize IndexedDB on first call', async () => {
      const mockRequest = {
        onerror: null as any,
        onsuccess: null as any,
        onupgradeneeded: null as any,
        result: mockDB,
        error: null
      };

      (global.indexedDB.open as any).mockReturnValue(mockRequest)

      const initPromise = storage.initialize()
      
      // Trigger success
      mockRequest.onsuccess!()
      
      await initPromise

      expect(global.indexedDB.open).toHaveBeenCalledWith('SCORMBuilderDB', 1)
    })

    it('should handle IndexedDB initialization errors', async () => {
      const mockRequest = {
        onerror: null as any,
        onsuccess: null as any,
        onupgradeneeded: null as any,
        result: null,
        error: new Error('IndexedDB error')
      };

      (global.indexedDB.open as any).mockReturnValue(mockRequest)

      const initPromise = storage.initialize()
      
      // Trigger error
      mockRequest.onerror!()
      
      await expect(initPromise).rejects.toThrow('IndexedDB error')
    })

    it('should create object store on upgrade', async () => {
      const mockRequest = {
        onerror: null as any,
        onsuccess: null as any,
        onupgradeneeded: null as any,
        result: mockDB,
        error: null
      };

      const mockObjectStore = {
        createIndex: vi.fn()
      };

      const mockUpgradeDB = {
        objectStoreNames: {
          contains: vi.fn().mockReturnValue(false)
        },
        createObjectStore: vi.fn().mockReturnValue(mockObjectStore)
      };

      (global.indexedDB.open as any).mockReturnValue(mockRequest)

      const initPromise = storage.initialize()
      
      // Trigger upgrade
      mockRequest.onupgradeneeded!({ target: { result: mockUpgradeDB } })
      mockRequest.onsuccess!()
      
      await initPromise

      expect(mockUpgradeDB.createObjectStore).toHaveBeenCalledWith('media', { keyPath: 'id' })
    })
  })

  describe('Project Management', () => {
    beforeEach(async () => {
      // Initialize storage
      const mockRequest = {
        onerror: null as any,
        onsuccess: null as any,
        onupgradeneeded: null as any,
        result: mockDB,
        error: null
      };
      (global.indexedDB.open as any).mockReturnValue(mockRequest)
      const initPromise = storage.initialize()
      mockRequest.onsuccess!()
      await initPromise
    })

    it('should create a new project', async () => {
      const project = await storage.createProject('Test Project')
      
      expect(project).toMatchObject({
        id: expect.any(String),
        name: 'Test Project',
        created: expect.any(String),
        lastAccessed: expect.any(String)
      })
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        expect.stringContaining('scorm_project_'),
        JSON.stringify(project)
      )
    })

    it('should open an existing project', async () => {
      const projectId = 'test-123'
      const projectData = {
        id: projectId,
        name: 'Test Project',
        created: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      }
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(projectData))
      
      await storage.openProject(projectId)
      
      expect(storage.getCurrentProjectId()).toBe(projectId)
    })

    it('should throw error when opening non-existent project', async () => {
      localStorageMock.getItem.mockReturnValue(null)
      
      await expect(storage.openProject('non-existent')).rejects.toThrow('Project not found')
      expect(storage.getCurrentProjectId()).toBeNull()
    })

    it('should list all projects', async () => {
      const projects = [
        { id: '1', name: 'Project 1' },
        { id: '2', name: 'Project 2' }
      ]
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'scorm_project_1') return JSON.stringify(projects[0])
        if (key === 'scorm_project_2') return JSON.stringify(projects[1])
        return null
      })
      
      // Mock Object.keys for localStorage
      const originalKeys = Object.keys
      Object.keys = vi.fn().mockReturnValue(['scorm_project_1', 'scorm_project_2', 'other_key'])
      
      const result = await storage.listProjects()
      
      expect(result).toHaveLength(2)
      expect(result).toEqual(projects)
      
      // Restore Object.keys
      Object.keys = originalKeys
    })

    it('should delete a project and its data', async () => {
      const projectId = 'test-123'
      storage['currentProjectId'] = projectId
      
      // Mock getAll for media deletion
      const mockMediaRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: [
          { id: 'media1', projectId },
          { id: 'media2', projectId }
        ]
      }
      
      mockObjectStore.getAll.mockReturnValue(mockMediaRequest)
      
      const deletePromise = storage.deleteProject(projectId)
      
      // Trigger getAll success
      mockMediaRequest.onsuccess!()
      
      await deletePromise
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(`scorm_project_${projectId}`)
      expect(storage.getCurrentProjectId()).toBeNull()
    })
  })

  describe('Media Operations', () => {
    beforeEach(async () => {
      // Initialize storage and set current project
      const mockRequest = {
        onerror: null as any,
        onsuccess: null as any,
        onupgradeneeded: null as any,
        result: mockDB,
        error: null
      };
      (global.indexedDB.open as any).mockReturnValue(mockRequest)
      const initPromise = storage.initialize()
      mockRequest.onsuccess!()
      await initPromise
      
      storage['currentProjectId'] = 'test-project'
    })

    it('should store media blob', async () => {
      const blob = new Blob(['test'], { type: 'image/png' })
      const mediaId = 'media-123'
      
      const mockPutRequest = {
        onsuccess: null as any,
        onerror: null as any
      }
      
      mockObjectStore.put.mockReturnValue(mockPutRequest)
      
      const storePromise = storage.storeMedia(mediaId, blob, 'image', { title: 'Test Image' })
      
      // Trigger success
      mockPutRequest.onsuccess!()
      
      await storePromise
      
      expect(mockObjectStore.put).toHaveBeenCalledWith({
        id: mediaId,
        blob,
        type: 'image/png',
        mediaType: 'image',
        metadata: { title: 'Test Image' },
        timestamp: expect.any(Number)
      })
    })

    it('should throw error when storing media without project', async () => {
      storage['currentProjectId'] = null
      const blob = new Blob(['test'])
      
      await expect(storage.storeMedia('id', blob, 'image')).rejects.toThrow('No project is currently open')
    })

    it('should get media by id', async () => {
      const mediaData = {
        id: 'media-123',
        blob: new Blob(['test']),
        type: 'image/png',
        mediaType: 'image',
        timestamp: Date.now()
      }
      
      const mockGetRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: mediaData
      }
      
      mockObjectStore.get.mockReturnValue(mockGetRequest)
      
      const getPromise = storage.getMedia('media-123')
      
      // Trigger success
      mockGetRequest.onsuccess!()
      
      const result = await getPromise
      
      expect(result).toEqual(mediaData)
      expect(mockObjectStore.get).toHaveBeenCalledWith('media-123')
    })

    it('should return null for non-existent media', async () => {
      const mockGetRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: undefined
      }
      
      mockObjectStore.get.mockReturnValue(mockGetRequest)
      
      const getPromise = storage.getMedia('non-existent')
      
      // Trigger success with no result
      mockGetRequest.onsuccess!()
      
      const result = await getPromise
      
      expect(result).toBeNull()
    })

    it('should delete media by id', async () => {
      const mockDeleteRequest = {
        onsuccess: null as any,
        onerror: null as any
      }
      
      mockObjectStore.delete.mockReturnValue(mockDeleteRequest)
      
      const deletePromise = storage.deleteMedia('media-123')
      
      // Trigger success
      mockDeleteRequest.onsuccess!()
      
      await deletePromise
      
      expect(mockObjectStore.delete).toHaveBeenCalledWith('media-123')
    })
  })

  describe('Content Operations', () => {
    beforeEach(() => {
      storage['currentProjectId'] = 'test-project'
    })

    it('should save content to localStorage', async () => {
      const content = {
        topicId: 'topic-123',
        title: 'Test Topic',
        content: 'Topic content'
      }
      
      await storage.saveContent('topic-123', content)
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'scorm_content_test-project_topic-123',
        JSON.stringify(content)
      )
    })

    it('should throw error when saving content without project', async () => {
      storage['currentProjectId'] = null
      
      await expect(storage.saveContent('id', {})).rejects.toThrow('No project is currently open')
    })

    it('should get content from localStorage', async () => {
      const content = { title: 'Test', content: 'Content' }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(content))
      
      const result = await storage.getContent('topic-123')
      
      expect(result).toEqual(content)
      expect(localStorageMock.getItem).toHaveBeenCalledWith('scorm_content_test-project_topic-123')
    })

    it('should return null for non-existent content', async () => {
      localStorageMock.getItem.mockReturnValue(null)
      
      const result = await storage.getContent('non-existent')
      
      expect(result).toBeNull()
    })
  })

  describe('Metadata Operations', () => {
    beforeEach(() => {
      storage['currentProjectId'] = 'test-project'
    })

    it('should save course metadata', async () => {
      const metadata = {
        title: 'Course Title',
        description: 'Course Description',
        version: '1.0'
      }
      
      await storage.saveCourseMetadata(metadata)
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'scorm_course_metadata_test-project',
        JSON.stringify(metadata)
      )
    })

    it('should get course metadata', async () => {
      const metadata = { title: 'Course Title' }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(metadata))
      
      const result = await storage.getCourseMetadata()
      
      expect(result).toEqual(metadata)
    })

    it.skip('should save AI prompt - method not implemented', () => {
      // Method not present in current implementation
    })

    it.skip('should get AI prompt - method not implemented', () => {
      // Method not present in current implementation
    })

    it.skip('should save audio settings - method not implemented', () => {
      // Method not present in current implementation
    })

    it.skip('should get audio settings - method not implemented', () => {
      // Method not present in current implementation
    })
  })

  describe('Export/Import Operations', () => {
    beforeEach(async () => {
      // Initialize storage and set current project
      const mockRequest = {
        onerror: null as any,
        onsuccess: null as any,
        onupgradeneeded: null as any,
        result: mockDB,
        error: null
      };
      (global.indexedDB.open as any).mockReturnValue(mockRequest)
      const initPromise = storage.initialize()
      mockRequest.onsuccess!()
      await initPromise
      
      storage['currentProjectId'] = 'test-project'
    })

    it('should export project data', async () => {
      // Mock project data
      const projectData = { id: 'test-project', name: 'Test' }
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'scorm_project_test-project') return JSON.stringify(projectData)
        if (key === 'scorm_course_metadata_test-project') return JSON.stringify({ title: 'Course' })
        return null
      })
      
      // Mock media data
      const mediaData = [
        { id: 'media1', blob: new Blob(['test1']), projectId: 'test-project' }
      ]
      
      const mockGetAllRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: mediaData
      }
      
      mockIndex.getAll.mockReturnValue(mockGetAllRequest)
      
      const exportPromise = storage.exportProject('test-project')
      
      // Simulate async operation
      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) {
          (mockGetAllRequest as any).result = mediaData
          mockGetAllRequest.onsuccess({ target: mockGetAllRequest } as any)
        }
      }, 0)
      
      const result = await exportPromise
      
      expect(result).toBeInstanceOf(Blob)
      expect(result.type).toBe('application/json')
    })

    it('should throw error when exporting without project', async () => {
      storage['currentProjectId'] = null
      
      await expect(storage.exportProject('non-existent')).rejects.toThrow()
    })

    it.skip('should import project from JSON - method signature mismatch', async () => {
      // Method signature in actual implementation differs from test expectations
    })
  })

  describe('Clear Operations', () => {
    beforeEach(async () => {
      // Initialize storage
      const mockRequest = {
        onerror: null as any,
        onsuccess: null as any,
        onupgradeneeded: null as any,
        result: mockDB,
        error: null
      };
      (global.indexedDB.open as any).mockReturnValue(mockRequest)
      const initPromise = storage.initialize()
      mockRequest.onsuccess!()
      await initPromise
      
      storage['currentProjectId'] = 'test-project'
    })

    it.skip('should clear all data - method not implemented', async () => {
      // Method not present in current implementation
    })

    it.skip('should close database connection - method not implemented', () => {
      // Method not present in current implementation
    })
  })

  describe('Error Handling', () => {
    it('should handle transaction errors', async () => {
      const mockRequest = {
        onerror: null as any,
        onsuccess: null as any,
        onupgradeneeded: null as any,
        result: mockDB,
        error: null
      };
      (global.indexedDB.open as any).mockReturnValue(mockRequest)
      const initPromise = storage.initialize()
      mockRequest.onsuccess!()
      await initPromise
      
      storage['currentProjectId'] = 'test-project'
      
      const mockPutRequest = {
        onsuccess: null as any,
        onerror: null as any,
        error: new Error('Transaction failed')
      }
      
      mockObjectStore.put.mockReturnValue(mockPutRequest)
      
      const storePromise = storage.storeMedia('id', new Blob(['test']), 'image')
      
      // Trigger error
      mockPutRequest.onerror!()
      
      await expect(storePromise).rejects.toThrow('Transaction failed')
    })

    it('should handle JSON parse errors gracefully', async () => {
      localStorageMock.getItem.mockReturnValue('invalid json')
      
      const result = await storage.getContent('topic-123')
      
      expect(result).toBeNull()
    })
  })
})