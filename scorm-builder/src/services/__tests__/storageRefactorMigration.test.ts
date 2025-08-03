import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StorageRefactorMigration } from '../storageRefactorMigration'
import type { PersistentStorage } from '../PersistentStorage'
import type { FileMediaManager } from '../fileMediaManager'
import type { MigrationOptions, MigrationProgress } from '../storageRefactorMigration'

// Mock dependencies
vi.mock('../PersistentStorage')
vi.mock('../fileMediaManager')

describe('StorageRefactorMigration', () => {
  let migration: StorageRefactorMigration
  let mockPersistentStorage: any
  let mockFileManager: any
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock PersistentStorage
    mockPersistentStorage = {
      getMediaForTopic: vi.fn(),
      deleteMedia: vi.fn(),
      getContent: vi.fn(),
      getCourseMetadata: vi.fn()
    }
    
    // Mock FileMediaManager
    mockFileManager = {
      saveMediaFile: vi.fn(),
      scanMediaDirectory: vi.fn(),
      saveProjectFile: vi.fn(),
      getMediaDirectory: vi.fn()
    }
    
    migration = new StorageRefactorMigration(
      mockPersistentStorage as PersistentStorage,
      mockFileManager as FileMediaManager
    )
  })
  
  describe('migrateMedia', () => {
    it('should migrate all media from IndexedDB to file system', async () => {
      const mockMediaItems = [
        {
          id: 'audio-0',
          blob: new Blob(['audio data'], { type: 'audio/mp3' }),
          type: 'audio/mp3',
          mediaType: 'audio' as const,
          timestamp: Date.now()
        },
        {
          id: 'image-1',
          blob: new Blob(['image data'], { type: 'image/png' }),
          type: 'image/png',
          mediaType: 'image' as const,
          timestamp: Date.now()
        }
      ]
      
      mockPersistentStorage.getMediaForTopic.mockResolvedValue(mockMediaItems)
      mockFileManager.getMediaDirectory.mockImplementation((type: string) => `media/${type}`)
      
      const result = await migration.migrateMedia()
      
      expect(result.success).toBe(true)
      expect(result.migratedCount).toBe(2)
      expect(result.errors).toBeUndefined()
      
      // Verify getAllMedia was called
      expect(mockPersistentStorage.getMediaForTopic).toHaveBeenCalledWith('*')
      
      // Verify each media item was saved
      expect(mockFileManager.saveMediaFile).toHaveBeenCalledTimes(2)
      expect(mockFileManager.saveMediaFile).toHaveBeenCalledWith(
        mockMediaItems[0].blob,
        expect.objectContaining({
          id: 'audio-0',
          filename: 'audio-0.mp3',
          type: 'audio'
        })
      )
    })
    
    it('should report progress during migration', async () => {
      const mockMediaItems = [
        {
          id: 'audio-0',
          blob: new Blob(['data']),
          type: 'audio/mp3',
          mediaType: 'audio' as const,
          timestamp: Date.now()
        }
      ]
      
      mockPersistentStorage.getMediaForTopic.mockResolvedValue(mockMediaItems)
      mockFileManager.getMediaDirectory.mockImplementation((type: string) => `media/${type}`)
      
      const progressUpdates: MigrationProgress[] = []
      const options: MigrationOptions = {
        onProgress: (progress) => progressUpdates.push(progress)
      }
      
      await migration.migrateMedia(options)
      
      expect(progressUpdates).toHaveLength(4)
      expect(progressUpdates[0]).toMatchObject({
        phase: 'starting',
        message: 'Starting media migration...'
      })
      expect(progressUpdates[1]).toMatchObject({
        phase: 'migrating',
        current: 0,
        total: 1,
        message: 'Found 1 media items to migrate'
      })
      expect(progressUpdates[2]).toMatchObject({
        phase: 'migrating',
        current: 1,
        total: 1,
        message: 'Migrated audio-0.mp3'
      })
      expect(progressUpdates[3]).toMatchObject({
        phase: 'complete',
        current: 1,
        total: 1,
        message: 'Migration complete: 1/1 items migrated'
      })
    })
    
    it('should cleanup IndexedDB entries when cleanupAfter is true', async () => {
      const mockMediaItems = [
        {
          id: 'audio-0',
          blob: new Blob(['data']),
          type: 'audio/mp3',
          mediaType: 'audio' as const,
          timestamp: Date.now()
        }
      ]
      
      mockPersistentStorage.getMediaForTopic.mockResolvedValue(mockMediaItems)
      mockFileManager.getMediaDirectory.mockImplementation((type: string) => `media/${type}`)
      
      await migration.migrateMedia({ cleanupAfter: true })
      
      expect(mockPersistentStorage.deleteMedia).toHaveBeenCalledWith('audio-0')
    })
    
    it('should continue migration even if some items fail', async () => {
      const mockMediaItems = [
        {
          id: 'audio-0',
          blob: new Blob(['data']),
          type: 'audio/mp3',
          mediaType: 'audio' as const,
          timestamp: Date.now()
        },
        {
          id: 'image-1',
          blob: new Blob(['data']),
          type: 'image/png',
          mediaType: 'image' as const,
          timestamp: Date.now()
        }
      ]
      
      mockPersistentStorage.getMediaForTopic.mockResolvedValue(mockMediaItems)
      mockFileManager.getMediaDirectory.mockImplementation((type: string) => `media/${type}`)
      
      // Make first save fail
      mockFileManager.saveMediaFile
        .mockRejectedValueOnce(new Error('Save failed'))
        .mockResolvedValueOnce(undefined)
      
      const result = await migration.migrateMedia()
      
      expect(result.success).toBe(true)
      expect(result.migratedCount).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors![0]).toContain('Failed to migrate audio-0')
    })
    
    it('should handle complete migration failure', async () => {
      mockPersistentStorage.getMediaForTopic.mockRejectedValue(new Error('DB error'))
      
      const result = await migration.migrateMedia()
      
      expect(result.success).toBe(false)
      expect(result.migratedCount).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors![0]).toContain('Migration failed: Error: DB error')
    })
    
    it('should handle empty media list', async () => {
      mockPersistentStorage.getMediaForTopic.mockResolvedValue([])
      
      const result = await migration.migrateMedia()
      
      expect(result.success).toBe(true)
      expect(result.migratedCount).toBe(0)
      expect(mockFileManager.saveMediaFile).not.toHaveBeenCalled()
    })
  })
  
  describe('migrateProjectContent', () => {
    it('should migrate project content from localStorage to project file', async () => {
      const contentIds = ['welcomePage', 'objectives', 'topic-0']
      const mockContent = {
        welcomePage: { content: 'Welcome' },
        objectives: { content: 'Objectives' },
        'topic-0': { content: 'Topic 1' }
      }
      const mockMetadata = { title: 'Test Course' }
      
      // Mock content retrieval
      mockPersistentStorage.getContent.mockImplementation((id: string) => 
        Promise.resolve(mockContent[id as keyof typeof mockContent])
      )
      mockPersistentStorage.getCourseMetadata.mockResolvedValue(mockMetadata)
      
      // Mock media scanning
      mockFileManager.scanMediaDirectory.mockImplementation((type: string) => {
        if (type === 'audio') return Promise.resolve([{ id: 'audio-0' }])
        if (type === 'images') return Promise.resolve([{ id: 'image-1' }])
        if (type === 'video') return Promise.resolve([])
        return Promise.resolve([])
      })
      
      const result = await migration.migrateProjectContent(contentIds)
      
      expect(result.success).toBe(true)
      
      // Verify content was retrieved
      expect(mockPersistentStorage.getContent).toHaveBeenCalledTimes(3)
      
      // Verify project file was saved
      expect(mockFileManager.saveProjectFile).toHaveBeenCalledWith({
        metadata: mockMetadata,
        content: mockContent,
        mediaReferences: [{ id: 'audio-0' }, { id: 'image-1' }]
      })
    })
    
    it('should handle missing content gracefully', async () => {
      const contentIds = ['welcomePage', 'missing']
      
      mockPersistentStorage.getContent.mockImplementation((id: string) => {
        if (id === 'welcomePage') return Promise.resolve({ content: 'Welcome' })
        return Promise.resolve(null)
      })
      mockPersistentStorage.getCourseMetadata.mockResolvedValue({})
      mockFileManager.scanMediaDirectory.mockResolvedValue([])
      
      const result = await migration.migrateProjectContent(contentIds)
      
      expect(result.success).toBe(true)
      expect(mockFileManager.saveProjectFile).toHaveBeenCalledWith({
        metadata: {},
        content: { welcomePage: { content: 'Welcome' } },
        mediaReferences: []
      })
    })
    
    it('should handle project save failure', async () => {
      mockPersistentStorage.getContent.mockResolvedValue({ content: 'Test' })
      mockPersistentStorage.getCourseMetadata.mockResolvedValue({})
      mockFileManager.scanMediaDirectory.mockResolvedValue([])
      mockFileManager.saveProjectFile.mockRejectedValue(new Error('Save failed'))
      
      const result = await migration.migrateProjectContent(['page1'])
      
      expect(result.success).toBe(false)
    })
  })
  
  describe('generateFilename', () => {
    it('should generate filename for audio with block number', () => {
      const filename = migration.generateFilename(
        'audio-0',
        'audio/mp3',
        { blockNumber: 1, topicId: 'welcome' }
      )
      
      expect(filename).toBe('1-welcome.mp3')
    })
    
    it('should generate filename for image with topic ID', () => {
      const filename = migration.generateFilename(
        'image-header',
        'image/png',
        { topicId: 'topic-1' }
      )
      
      expect(filename).toBe('topic-1-header.png')
    })
    
    it('should generate filename for image without topic ID', () => {
      const filename = migration.generateFilename(
        'image-logo',
        'image/jpeg'
      )
      
      expect(filename).toBe('logo.jpg')
    })
    
    it('should handle unknown MIME types', () => {
      const filename = migration.generateFilename(
        'file-1',
        'application/octet-stream'
      )
      
      expect(filename).toBe('file-1.bin')
    })
    
    it('should handle caption files', () => {
      const filename = migration.generateFilename(
        'caption-1',
        'text/vtt'
      )
      
      expect(filename).toBe('caption-1.vtt')
    })
  })
  
  describe('createMediaReference', () => {
    it('should create media reference with correct directory', () => {
      mockFileManager.getMediaDirectory.mockImplementation((type: string) => {
        const dirs: Record<string, string> = {
          audio: 'media/audio',
          image: 'media/images',
          video: 'media/video',
          caption: 'captions'
        }
        return dirs[type]
      })
      
      const mediaItem = {
        id: 'audio-0',
        blob: new Blob(['data'], { type: 'audio/mp3' }),
        type: 'audio/mp3',
        mediaType: 'audio' as const,
        timestamp: Date.now(),
        metadata: { blockNumber: 1 }
      }
      
      // Access private method through prototype
      const createMediaReference = (migration as any).createMediaReference.bind(migration)
      const reference = createMediaReference(mediaItem)
      
      expect(reference).toMatchObject({
        id: 'audio-0',
        filename: '1-audio.mp3',
        relativePath: 'media/audio/1-audio.mp3',
        type: 'audio',
        size: 4 // 'data' blob size
      })
    })
    
    it('should handle getMediaDirectory errors with fallback', () => {
      mockFileManager.getMediaDirectory.mockImplementation(() => {
        throw new Error('Directory error')
      })
      
      const mediaItem = {
        id: 'video-1',
        blob: new Blob(['video data']),
        type: 'video/mp4',
        mediaType: 'video' as const,
        timestamp: Date.now()
      }
      
      // Access private method
      const createMediaReference = (migration as any).createMediaReference.bind(migration)
      const reference = createMediaReference(mediaItem)
      
      expect(reference.relativePath).toBe('media/video/video-1.mp4')
    })
  })
  
  describe('getMediaTypeFromId', () => {
    it('should identify media types from ID prefixes', () => {
      // Access private method
      const getMediaTypeFromId = (migration as any).getMediaTypeFromId.bind(migration)
      
      expect(getMediaTypeFromId('audio-0')).toBe('audio')
      expect(getMediaTypeFromId('image-header')).toBe('image')
      expect(getMediaTypeFromId('video-intro')).toBe('video')
      expect(getMediaTypeFromId('caption-1')).toBe('caption')
    })
    
    it('should handle caption patterns in ID', () => {
      const getMediaTypeFromId = (migration as any).getMediaTypeFromId.bind(migration)
      
      expect(getMediaTypeFromId('subtitle-vtt-1')).toBe('caption')
      expect(getMediaTypeFromId('english-caption')).toBe('caption')
    })
    
    it('should default to audio for unknown patterns', () => {
      const getMediaTypeFromId = (migration as any).getMediaTypeFromId.bind(migration)
      
      expect(getMediaTypeFromId('unknown-file')).toBe('audio')
      expect(getMediaTypeFromId('file123')).toBe('audio')
    })
  })
  
  describe('getExtensionFromMimeType', () => {
    it('should map common MIME types to extensions', () => {
      // Access private method
      const getExtensionFromMimeType = (migration as any).getExtensionFromMimeType.bind(migration)
      
      expect(getExtensionFromMimeType('audio/mpeg')).toBe('mp3')
      expect(getExtensionFromMimeType('audio/mp3')).toBe('mp3')
      expect(getExtensionFromMimeType('audio/wav')).toBe('wav')
      expect(getExtensionFromMimeType('image/jpeg')).toBe('jpg')
      expect(getExtensionFromMimeType('image/png')).toBe('png')
      expect(getExtensionFromMimeType('image/gif')).toBe('gif')
      expect(getExtensionFromMimeType('video/mp4')).toBe('mp4')
      expect(getExtensionFromMimeType('text/vtt')).toBe('vtt')
      expect(getExtensionFromMimeType('text/plain')).toBe('txt')
    })
    
    it('should default to bin for unknown MIME types', () => {
      const getExtensionFromMimeType = (migration as any).getExtensionFromMimeType.bind(migration)
      
      expect(getExtensionFromMimeType('application/octet-stream')).toBe('bin')
      expect(getExtensionFromMimeType('unknown/type')).toBe('bin')
    })
  })
  
  describe('getAllMedia', () => {
    it('should retrieve all media using wildcard topic', () => {
      const mockMedia = [{ id: 'audio-0' }, { id: 'image-1' }]
      mockPersistentStorage.getMediaForTopic.mockResolvedValue(mockMedia)
      
      // Access private method
      const getAllMedia = (migration as any).getAllMedia.bind(migration)
      
      const result = getAllMedia()
      
      expect(mockPersistentStorage.getMediaForTopic).toHaveBeenCalledWith('*')
    })
    
    it('should handle null response from storage', async () => {
      mockPersistentStorage.getMediaForTopic.mockResolvedValue(null)
      
      // Access private method
      const getAllMedia = (migration as any).getAllMedia.bind(migration)
      const result = await getAllMedia()
      
      expect(result).toEqual([])
    })
  })
})