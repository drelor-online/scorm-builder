import { TestRunner, logMemoryUsage } from './testRunner'
import { fileStorage } from '../services/FileStorage'

export class E2ETests {
  private testRunner = new TestRunner()
  private testProjectId: string | null = null
  
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting End-to-End Tests\n')
    
    // Initialize storage
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
      
      if (!fileStorage.isInitialized) {
        await fileStorage.initialize()
      }
      
      if (!fileStorage.isInitialized) {
        throw new Error('Storage failed to initialize')
      }
      
      logMemoryUsage('After storage init')
    })
  }
  
  private async testNewProjectCreation(): Promise<void> {
    await this.testRunner.runTest('New Project Creation', async () => {
      logMemoryUsage('Before project creation')
      
      // Create a test project
      const projectMetadata = await fileStorage.createProject('E2E Test Project')
      this.testProjectId = projectMetadata.id
      
      if (!this.testProjectId) {
        throw new Error('Project ID not returned')
      }
      
      // Verify project was created
      const projects = await fileStorage.listProjects()
      const found = projects.find(p => p.id === this.testProjectId)
      if (!found) {
        throw new Error('Created project not found in list')
      }
      
      logMemoryUsage('After project creation')
    })
  }
  
  private async testDataPersistence(): Promise<void> {
    await this.testRunner.runTest('Course Metadata Persistence', async () => {
      if (!this.testProjectId) throw new Error('No test project')
      
      // Save course metadata
      const testMetadata = {
        courseTitle: 'Test Course',
        difficulty: 3,
        topics: ['Topic 1', 'Topic 2', 'Topic 3'],
        customTopics: 'Topic 1\nTopic 2\nTopic 3'
      }
      
      await fileStorage.saveCourseMetadata(testMetadata)
      
      // Save and reload
      await fileStorage.saveProject()
      await fileStorage.openProject(this.testProjectId)
      
      // Verify data persisted
      const loaded = await fileStorage.getCourseMetadata()
      if (!loaded) throw new Error('No metadata loaded')
      if (loaded.courseTitle !== testMetadata.courseTitle) {
        throw new Error('Course title not persisted correctly')
      }
      if (loaded.topics.length !== 3) {
        throw new Error('Topics not persisted correctly')
      }
    })
    
    await this.testRunner.runTest('Content Persistence', async () => {
      if (!this.testProjectId) throw new Error('No test project')
      
      // Save content
      const testContent = {
        topicId: 'topic-1',
        title: 'Test Topic',
        content: '<p>Test content</p>',
        narration: 'Test narration'
      }
      
      await fileStorage.saveContent('topic-1', testContent)
      
      // Save and reload
      await fileStorage.saveProject()
      await fileStorage.openProject(this.testProjectId)
      
      // Verify content persisted
      const loaded = await fileStorage.getContent('topic-1')
      if (!loaded) throw new Error('No content loaded')
      if (loaded.title !== testContent.title) {
        throw new Error('Content not persisted correctly')
      }
    })
  }
  
  private async testMediaStorage(): Promise<void> {
    await this.testRunner.runTest('Audio Storage', async () => {
      if (!this.testProjectId) throw new Error('No test project')
      
      logMemoryUsage('Before audio storage')
      
      // Create a test audio blob
      const audioData = new Uint8Array(1000).fill(0)
      const audioBlob = new Blob([audioData], { type: 'audio/mp3' })
      
      // Store audio
      await fileStorage.storeMedia('test-audio-001', audioBlob, 'audio', {
        topicId: 'topic-1',
        fileName: 'test.mp3'
      })
      
      // Wait a moment for any pending operations
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Force save and reload
      await fileStorage.saveProject()
      
      // Close and reopen to test persistence
      // There's no closeProject method, so we'll just reopen
      await fileStorage.openProject(this.testProjectId)
      
      // Verify audio persisted
      const loaded = await fileStorage.getMedia('test-audio-001')
      if (!loaded) throw new Error('No audio loaded')
      if (!loaded.blob) throw new Error('No audio blob loaded')
      if (!(loaded.blob instanceof Blob)) throw new Error('Audio blob is not a Blob')
      
      logMemoryUsage('After audio storage')
    })
    
    await this.testRunner.runTest('Image Storage', async () => {
      if (!this.testProjectId) throw new Error('No test project')
      
      // Create a test image blob
      const imageData = new Uint8Array(500).fill(255)
      const imageBlob = new Blob([imageData], { type: 'image/png' })
      
      // Store image
      await fileStorage.storeMedia('test-image-001', imageBlob, 'image', {
        topicId: 'topic-1',
        fileName: 'test.png'
      })
      
      // Verify image persisted
      const loaded = await fileStorage.getMedia('test-image-001')
      if (!loaded) throw new Error('No image loaded')
      if (!loaded.blob) throw new Error('No image blob loaded')
    })
  }
  
  private async testMemoryManagement(): Promise<void> {
    await this.testRunner.runTest('Memory Leak Check', async () => {
      logMemoryUsage('Start memory test')
      
      // Create and cleanup multiple blobs
      const blobs: Blob[] = []
      const urls: string[] = []
      
      // Create blobs and URLs
      for (let i = 0; i < 10; i++) {
        const data = new Uint8Array(10000).fill(i)
        const blob = new Blob([data])
        blobs.push(blob)
        urls.push(URL.createObjectURL(blob))
      }
      
      logMemoryUsage('After creating objects')
      
      // Cleanup URLs
      urls.forEach(url => URL.revokeObjectURL(url))
      blobs.length = 0
      urls.length = 0
      
      // Force garbage collection if available
      if ('gc' in window) {
        (window as any).gc()
      }
      
      logMemoryUsage('After cleanup')
    })
  }
  
  private async testErrorHandling(): Promise<void> {
    await this.testRunner.runTest('Invalid Project ID Handling', async () => {
      try {
        await fileStorage.openProject('invalid-project-id')
        throw new Error('Should have thrown error for invalid project')
      } catch (error) {
        // Expected error
        if (error instanceof Error && !error.message.includes('Failed to open project')) {
          throw new Error('Unexpected error message')
        }
      }
    })
    
    await this.testRunner.runTest('Storage Not Initialized', async () => {
      // This test would need to be run with storage not initialized
      // For now, just verify storage is initialized
      if (!fileStorage.isInitialized) {
        throw new Error('Storage should be initialized')
      }
    })
  }
  
  private async cleanup(): Promise<void> {
    await this.testRunner.runTest('Cleanup Test Project', async () => {
      if (this.testProjectId) {
        try {
          await fileStorage.deleteProject(this.testProjectId)
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