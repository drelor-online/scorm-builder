import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { PersistentStorage } from '../PersistentStorage'

describe('PersistentStorage Integration - Intent Tests', () => {
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
  
  describe('Audio Narration Page Integration', () => {
    it('should persist audio files when uploaded in the audio narration page', async () => {
      // Intent: User uploads audio file in audio narration page
      // File should persist across navigation
      
      const project = await storage.createProject('Test Course')
      await storage.openProject(project.id)
      
      // Simulate audio upload
      const audioBlob = new Blob(['audio data'], { type: 'audio/mp3' })
      const topicId = 'topic-1'
      await storage.storeMedia(`${topicId}-narration`, audioBlob, 'audio', {
        duration: 120,
        fileName: 'topic1-narration.mp3'
      })
      
      // Simulate navigation away and back
      const newStorage = new PersistentStorage()
      await newStorage.initialize()
      await newStorage.openProject(project.id)
      
      // Audio should still be there
      const retrieved = await newStorage.getMedia(`${topicId}-narration`)
      expect(retrieved).toBeDefined()
      expect(retrieved?.metadata?.fileName).toBe('topic1-narration.mp3')
    })
    
    it('should auto-save narration text when user types', async () => {
      // Intent: User types narration text
      // Text should be saved automatically
      
      const project = await storage.createProject('Test Course')
      await storage.openProject(project.id)
      
      const narrationContent = {
        topicId: 'topic-1',
        narration: 'Welcome to natural gas safety training...'
      }
      
      await storage.saveContent('topic-1-narration', narrationContent)
      
      const retrieved = await storage.getContent('topic-1-narration')
      expect(retrieved?.narration).toBe(narrationContent.narration)
    })
  })
  
  describe('Media Enhancement Page Integration', () => {
    it('should persist multiple images for a topic', async () => {
      // Intent: User adds multiple images to a topic
      // All images should persist
      
      const project = await storage.createProject('Test Course')
      await storage.openProject(project.id)
      
      const image1 = new Blob(['image1'], { type: 'image/png' })
      const image2 = new Blob(['image2'], { type: 'image/jpeg' })
      
      // Use unique topic ID to avoid interference from other tests
      const uniqueTopicId = `topic-media-${Date.now()}`
      
      await storage.storeMedia(`${uniqueTopicId}-img-1`, image1, 'image', {
        title: 'Safety Equipment',
        caption: 'PPE required on site'
      })
      
      await storage.storeMedia(`${uniqueTopicId}-img-2`, image2, 'image', {
        title: 'Warning Signs',
        caption: 'Common warning signs'
      })
      
      const topicMedia = await storage.getMediaForTopic(uniqueTopicId)
      expect(topicMedia).toHaveLength(2)
      expect(topicMedia[0].metadata?.title).toBe('Safety Equipment')
    })
    
    it('should replace media when user confirms replacement', async () => {
      // Intent: User replaces existing media
      // Old media should be replaced with new
      
      const project = await storage.createProject('Test Course')
      await storage.openProject(project.id)
      
      // Store initial image
      const oldImage = new Blob(['old'], { type: 'image/png' })
      await storage.storeMedia('topic-1-main-image', oldImage, 'image')
      
      // Replace with new image
      const newImage = new Blob(['new'], { type: 'image/jpeg' })
      await storage.storeMedia('topic-1-main-image', newImage, 'image')
      
      const retrieved = await storage.getMedia('topic-1-main-image')
      expect(retrieved).toBeDefined()
      expect(retrieved?.type).toBe('image/jpeg')
      expect(retrieved?.mediaType).toBe('image')
    })
  })
  
  describe('SCORM Generation Integration', () => {
    it('should include all stored media in SCORM package', async () => {
      // Intent: When generating SCORM package
      // All stored media should be included
      
      const project = await storage.createProject('Test Course')
      await storage.openProject(project.id)
      
      // Use unique topic ID
      const uniqueTopicId = `topic-scorm-${Date.now()}`
      
      // Store various media
      const audio = new Blob(['audio'], { type: 'audio/mp3' })
      const image = new Blob(['image'], { type: 'image/png' })
      const caption = new Blob(['caption'], { type: 'text/vtt' })
      
      await storage.storeMedia(`${uniqueTopicId}-audio`, audio, 'audio')
      await storage.storeMedia(`${uniqueTopicId}-image`, image, 'image')
      await storage.storeMedia(`${uniqueTopicId}-caption`, caption, 'video', {
        isCaption: true
      })
      
      // Store content
      await storage.saveContent(uniqueTopicId, {
        topicId: uniqueTopicId,
        title: 'Topic 1',
        content: 'Topic content'
      })
      
      // All media should be retrievable for SCORM generation
      const allMedia = await storage.getMediaForTopic(uniqueTopicId)
      expect(allMedia).toHaveLength(3)
    })
  })
  
  describe('Error Recovery', () => {
    it('should handle concurrent access gracefully', async () => {
      // Intent: Multiple components accessing storage simultaneously
      // Should handle without conflicts
      
      const project = await storage.createProject('Test Course')
      await storage.openProject(project.id)
      
      // Simulate concurrent saves
      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(
          storage.saveContent(`topic-${i}`, {
            topicId: `topic-${i}`,
            title: `Topic ${i}`
          })
        )
      }
      
      await Promise.all(promises)
      
      // All should be saved
      for (let i = 0; i < 5; i++) {
        const content = await storage.getContent(`topic-${i}`)
        expect(content?.title).toBe(`Topic ${i}`)
      }
    })
  })
})