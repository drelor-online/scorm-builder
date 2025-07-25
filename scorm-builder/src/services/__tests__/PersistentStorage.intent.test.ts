import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { PersistentStorage } from '../PersistentStorage'

describe('PersistentStorage - Intent Tests', () => {
  let storage: PersistentStorage
  
  beforeEach(async () => {
    // Clear IndexedDB
    const deleteDB = () => {
      return new Promise<void>((resolve) => {
        const deleteReq = indexedDB.deleteDatabase('SCORMBuilderDB')
        deleteReq.onsuccess = () => resolve()
        deleteReq.onerror = () => resolve()
        deleteReq.onblocked = () => resolve()
      })
    }
    await deleteDB()
    
    localStorage.clear()
    storage = new PersistentStorage()
    await storage.initialize()
  })
  
  describe('Media Persistence', () => {
    it('should persist audio files across page navigation', async () => {
      // Intent: When user uploads an audio file and navigates away, 
      // the audio should still be available when they return
      
      const audioBlob = new Blob(['audio data'], { type: 'audio/mp3' })
      const audioId = 'topic-1-audio'
      
      // Store audio
      await storage.storeMedia(audioId, audioBlob, 'audio')
      
      // Simulate navigation by creating new instance
      const newStorage = new PersistentStorage()
      await newStorage.initialize()
      
      // Audio should still be retrievable
      const retrieved = await newStorage.getMedia(audioId)
      expect(retrieved).toBeDefined()
      expect(retrieved?.type).toBe('audio/mp3')
    })
    
    it('should persist image files with metadata', async () => {
      // Intent: Images should be stored with their metadata 
      // and be retrievable by ID
      
      const imageBlob = new Blob(['image data'], { type: 'image/png' })
      const metadata = {
        title: 'Safety Equipment',
        alt: 'PPE demonstration',
        source: 'Internal'
      }
      
      await storage.storeMedia('image-1', imageBlob, 'image', metadata)
      
      const retrieved = await storage.getMedia('image-1')
      expect(retrieved).toBeDefined()
      expect(retrieved?.metadata?.title).toBe('Safety Equipment')
    })
    
    it('should handle multiple media items for same topic', async () => {
      // Intent: A topic can have multiple media items
      // and all should be retrievable
      
      const image1 = new Blob(['img1'], { type: 'image/png' })
      const image2 = new Blob(['img2'], { type: 'image/png' })
      const audio = new Blob(['audio'], { type: 'audio/mp3' })
      
      await storage.storeMedia('topic-1-img-1', image1, 'image')
      await storage.storeMedia('topic-1-img-2', image2, 'image')
      await storage.storeMedia('topic-1-audio', audio, 'audio')
      
      const allMedia = await storage.getMediaForTopic('topic-1')
      expect(allMedia).toHaveLength(3)
    })
  })
  
  describe('Content Auto-Save', () => {
    it('should auto-save text content as user types', async () => {
      // Intent: Content should be saved automatically 
      // without explicit save action
      
      const content = {
        topicId: 'topic-1',
        title: 'Natural Gas Safety',
        content: 'This is the content...',
        narration: 'This is the narration...'
      }
      
      await storage.saveContent('topic-1', content)
      
      // Content should be immediately retrievable
      const retrieved = await storage.getContent('topic-1')
      expect(retrieved).toEqual(content)
    })
    
    it('should persist course structure and metadata', async () => {
      // Intent: Overall course structure should be maintained
      // across sessions
      
      const courseData = {
        title: 'Natural Gas Safety Training',
        description: 'Comprehensive safety training',
        duration: 60,
        topics: ['topic-1', 'topic-2', 'topic-3']
      }
      
      await storage.saveCourseMetadata(courseData)
      
      const retrieved = await storage.getCourseMetadata()
      expect(retrieved).toEqual(courseData)
    })
  })
  
  describe('Project Management', () => {
    it('should track multiple projects with unique IDs', async () => {
      // Intent: User can work on multiple projects
      // and switch between them
      
      const project1 = await storage.createProject('Safety Training')
      const project2 = await storage.createProject('Compliance Course')
      
      expect(project1.id).not.toBe(project2.id)
      
      const projects = await storage.listProjects()
      expect(projects).toHaveLength(2)
    })
    
    it('should store last accessed timestamp for projects', async () => {
      // Intent: Recent projects should be shown first
      
      const project = await storage.createProject('Test Project')
      
      // Access the project
      await storage.openProject(project.id)
      
      const projects = await storage.listProjects()
      const recentProject = projects[0]
      
      expect(recentProject.lastAccessed).toBeDefined()
      expect(new Date(recentProject.lastAccessed).getTime()).toBeCloseTo(Date.now(), -2)
    })
  })
  
  describe('Data Recovery', () => {
    it('should recover from browser refresh', async () => {
      // Intent: All data should survive page refresh
      
      const audioBlob = new Blob(['audio'], { type: 'audio/mp3' })
      await storage.storeMedia('test-audio', audioBlob, 'audio')
      
      const content = { title: 'Test', content: 'Content' }
      await storage.saveContent('test-topic', content)
      
      // Simulate browser refresh
      const newStorage = new PersistentStorage()
      await newStorage.initialize()
      
      const recoveredAudio = await newStorage.getMedia('test-audio')
      const recoveredContent = await newStorage.getContent('test-topic')
      
      expect(recoveredAudio).toBeDefined()
      expect(recoveredContent).toEqual(content)
    })
    
    it('should handle storage quota gracefully', async () => {
      // Intent: Should provide meaningful error when storage is full
      
      // Try to store very large blob
      const largeBlob = new Blob([new ArrayBuffer(100 * 1024 * 1024)]) // 100MB
      
      await expect(
        storage.storeMedia('large-file', largeBlob, 'video')
      ).rejects.toThrow(/storage|quota/i)
    })
  })
})