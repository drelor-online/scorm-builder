import { TestRunner, logMemoryUsage } from './testRunner'
import { MediaService } from '../services/MediaService'
import { PersistentStorage } from '../services/PersistentStorage'

/**
 * End-to-End tests for the SCORM Builder application
 * Updated to use the new MediaService architecture
 */
export class E2ETests {
  private testRunner = new TestRunner()
  private testProjectId: string | null = null
  private mediaService: MediaService | null = null
  private storage: PersistentStorage | null = null
  
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting End-to-End Tests\n')
    
    // Initialize services
    await this.testStorageInitialization()
    
    // Test 1: New Project Creation
    await this.testNewProjectCreation()
    
    // Test 2: Data Persistence
    await this.testDataPersistence()
    
    // Test 3: Media Storage
    await this.testMediaStorage()
    
    // Test 4: Memory Management
    await this.testMemoryManagement()
    
    // Test 5: Error Handling
    await this.testErrorHandling()
    
    // Cleanup
    await this.cleanup()
    
    // Print results
    this.testRunner.printSummary()
  }
  
  private async testStorageInitialization(): Promise<void> {
    await this.testRunner.runTest('Storage Initialization', async () => {
      logMemoryUsage('Before storage init')
      
      // Initialize PersistentStorage
      this.storage = new PersistentStorage()
      await this.storage.initialize()
      
      // Initialize MediaService with a test project
      this.mediaService = MediaService.getInstance({ projectId: 'e2e-test-project' })
      
      logMemoryUsage('After storage init')
    })
  }
  
  private async testNewProjectCreation(): Promise<void> {
    await this.testRunner.runTest('New Project Creation', async () => {
      logMemoryUsage('Before project creation')
      
      if (!this.storage) throw new Error('Storage not initialized')
      
      // Create a test project
      const project = await this.storage.createProject('E2E Test Project')
      this.testProjectId = project.id
      
      if (!this.testProjectId) {
        throw new Error('Project ID not returned')
      }
      
      // Open the project
      await this.storage.openProject(this.testProjectId)
      
      // Update MediaService with the new project ID
      this.mediaService = MediaService.getInstance({ projectId: this.testProjectId })
      
      // Verify project was created
      const projects = await this.storage.listProjects()
      const found = projects.find(p => p.id === this.testProjectId)
      if (!found) {
        throw new Error('Created project not found in list')
      }
      
      logMemoryUsage('After project creation')
    })
  }
  
  private async testDataPersistence(): Promise<void> {
    await this.testRunner.runTest('Course Metadata Persistence', async () => {
      if (!this.storage || !this.testProjectId) throw new Error('No test project')
      
      // Save course metadata
      const testMetadata = {
        courseTitle: 'Test Course',
        difficulty: 3,
        topics: ['Topic 1', 'Topic 2', 'Topic 3'],
        customTopics: 'Topic 1\nTopic 2\nTopic 3'
      }
      
      await this.storage.saveCourseMetadata(testMetadata)
      
      // Reopen project to test persistence
      await this.storage.openProject(this.testProjectId)
      
      // Verify data persisted
      const loaded = await this.storage.getCourseMetadata()
      if (!loaded) throw new Error('No metadata loaded')
      if (loaded.courseTitle !== testMetadata.courseTitle) {
        throw new Error('Course title not persisted correctly')
      }
      if (loaded.topics.length !== 3) {
        throw new Error('Topics not persisted correctly')
      }
    })
    
    await this.testRunner.runTest('Content Persistence', async () => {
      if (!this.storage || !this.testProjectId) throw new Error('No test project')
      
      // Save content
      const testContent = {
        topicId: 'topic-1',
        title: 'Test Topic',
        content: '<p>Test content</p>',
        narration: 'Test narration'
      }
      
      await this.storage.saveContent('topic-1', testContent)
      
      // Reopen project to test persistence
      await this.storage.openProject(this.testProjectId)
      
      // Verify content persisted
      const loaded = await this.storage.getContent('topic-1')
      if (!loaded) throw new Error('No content loaded')
      if (loaded.title !== testContent.title) {
        throw new Error('Content not persisted correctly')
      }
    })
  }
  
  private async testMediaStorage(): Promise<void> {
    await this.testRunner.runTest('Audio Storage', async () => {
      if (!this.mediaService || !this.storage || !this.testProjectId) {
        throw new Error('Services not initialized')
      }
      
      logMemoryUsage('Before audio storage')
      
      // Create a test audio blob
      const audioData = new Uint8Array(1000).fill(0)
      const audioBlob = new Blob([audioData], { type: 'audio/mp3' })
      const audioFile = new File([audioBlob], 'test.mp3', { type: 'audio/mp3' })
      
      // Store audio using MediaService
      const mediaItem = await this.mediaService.storeMedia(
        audioFile,
        'topic-1',
        'audio'
      )
      
      if (!mediaItem || !mediaItem.id) {
        throw new Error('Failed to store audio')
      }
      
      // Wait a moment for any pending operations
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Verify audio can be retrieved
      const mediaData = await this.mediaService.getMedia(mediaItem.id)
      if (!mediaData) throw new Error('No audio loaded')
      if (!(mediaData.data instanceof Uint8Array)) {
        throw new Error('Audio data is not Uint8Array')
      }
      
      // Create blob URL to verify it works
      const blobUrl = await this.mediaService.createBlobUrl(mediaItem.id)
      if (!blobUrl) throw new Error('Failed to create blob URL')
      
      logMemoryUsage('After audio storage')
    })
    
    await this.testRunner.runTest('Image Storage', async () => {
      if (!this.mediaService || !this.testProjectId) {
        throw new Error('Services not initialized')
      }
      
      // Create a test image blob
      const imageData = new Uint8Array(500).fill(255)
      const imageBlob = new Blob([imageData], { type: 'image/png' })
      const imageFile = new File([imageBlob], 'test.png', { type: 'image/png' })
      
      // Store image using MediaService
      const mediaItem = await this.mediaService.storeMedia(
        imageFile,
        'topic-1',
        'image'
      )
      
      if (!mediaItem || !mediaItem.id) {
        throw new Error('Failed to store image')
      }
      
      // Verify image can be retrieved
      const mediaData = await this.mediaService.getMedia(mediaItem.id)
      if (!mediaData) throw new Error('No image loaded')
      if (!(mediaData.data instanceof Uint8Array)) {
        throw new Error('Image data is not Uint8Array')
      }
    })
    
    await this.testRunner.runTest('YouTube URL Storage', async () => {
      if (!this.mediaService || !this.testProjectId) {
        throw new Error('Services not initialized')
      }
      
      // Store YouTube video
      const mediaItem = await this.mediaService.storeYouTubeVideo(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'topic-1',
        { title: 'Test YouTube Video' }
      )
      
      if (!mediaItem || !mediaItem.id) {
        throw new Error('Failed to store YouTube video')
      }
      
      // Verify YouTube URL is preserved
      if (!mediaItem.metadata.youtubeUrl || !mediaItem.metadata.youtubeUrl.includes('youtube.com')) {
        throw new Error('YouTube URL not preserved correctly')
      }
    })
  }
  
  private async testMemoryManagement(): Promise<void> {
    await this.testRunner.runTest('Memory Leak Check', async () => {
      if (!this.mediaService) throw new Error('MediaService not initialized')
      
      logMemoryUsage('Start memory test')
      
      // Create and cleanup multiple media items
      const mediaIds: string[] = []
      
      // Create media items
      for (let i = 0; i < 10; i++) {
        const data = new Uint8Array(10000).fill(i)
        const blob = new Blob([data], { type: 'image/png' })
        const file = new File([blob], `test${i}.png`, { type: 'image/png' })
        
        const mediaItem = await this.mediaService.storeMedia(file, 'topic-1', 'image')
        if (mediaItem && mediaItem.id) {
          mediaIds.push(mediaItem.id)
        }
      }
      
      logMemoryUsage('After creating objects')
      
      // Create blob URLs to test cleanup
      const blobUrls: string[] = []
      for (const id of mediaIds) {
        const url = await this.mediaService.createBlobUrl(id)
        if (url) blobUrls.push(url)
      }
      
      // Delete media items
      for (const id of mediaIds) {
        await this.mediaService.deleteMedia(id)
      }
      
      // Force garbage collection if available
      if ('gc' in window) {
        (window as any).gc()
      }
      
      logMemoryUsage('After cleanup')
    })
  }
  
  private async testErrorHandling(): Promise<void> {
    await this.testRunner.runTest('Invalid Media ID Handling', async () => {
      if (!this.mediaService) throw new Error('MediaService not initialized')
      
      const result = await this.mediaService.getMedia('invalid-media-id')
      if (result !== null) {
        throw new Error('Should return null for invalid media ID')
      }
    })
    
    // TODO: Implement these security tests once validateExternalUrl and sanitizePath are added to MediaService
    // await this.testRunner.runTest('Invalid URL Validation', async () => {
    //   if (!this.mediaService) throw new Error('MediaService not initialized')
    //   
    //   // Test malicious URL
    //   const maliciousUrl = 'javascript:alert("XSS")'
    //   const isValid = this.mediaService.validateExternalUrl(maliciousUrl)
    //   
    //   if (isValid) {
    //     throw new Error('Should reject malicious URL')
    //   }
    // })
    // 
    // await this.testRunner.runTest('Path Traversal Protection', async () => {
    //   if (!this.mediaService) throw new Error('MediaService not initialized')
    //   
    //   // Test path traversal attempt
    //   const maliciousPath = '../../../etc/passwd'
    //   const sanitized = this.mediaService.sanitizePath(maliciousPath)
    //   
    //   // sanitizePath returns a string, if it's empty it means the path was rejected
    //   if (sanitized && sanitized !== '') {
    //     throw new Error('Should reject path traversal attempt')
    //   }
    // })
  }
  
  private async cleanup(): Promise<void> {
    await this.testRunner.runTest('Cleanup Test Project', async () => {
      if (this.storage && this.testProjectId) {
        try {
          await this.storage.deleteProject(this.testProjectId)
        } catch (error) {
          console.warn('Failed to cleanup test project:', error)
        }
      }
    })
  }
}

// Export function to run tests from console
export async function runE2ETests(): Promise<void> {
  const tests = new E2ETests()
  await tests.runAllTests()
}

// Make it available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).runE2ETests = runE2ETests
}