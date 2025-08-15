import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// import { render, screen, waitFor } from '@testing-library/react' // TODO: Implement UI integration tests
import userEvent from '@testing-library/user-event'
import { FileStorage } from '../FileStorage'
import { MediaService } from '../MediaService'
import { generateRustSCORM } from '../rustScormGenerator'
import type { EnhancedCourseContent } from '../../types/scorm'

// Mock Tauri APIs
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {}))
}))

// Mock components
vi.mock('../../components/CourseSeedInput', () => ({
  default: ({ onNext }: any) => (
    <div data-testid="course-seed-input">
      <button onClick={() => onNext({ courseTitle: 'Test Course', topics: ['Topic 1'] })}>
        Next
      </button>
    </div>
  )
}))

vi.mock('../../components/MediaEnhancementWizard', () => ({
  default: ({ onNext }: any) => (
    <div data-testid="media-enhancement">
      <button onClick={() => onNext({ mediaAdded: true })}>
        Add Media
      </button>
    </div>
  )
}))

vi.mock('../../components/AudioNarrationWizard', () => ({
  default: ({ onNext }: any) => (
    <div data-testid="audio-narration">
      <button onClick={() => onNext({ audioGenerated: true })}>
        Generate Audio
      </button>
    </div>
  )
}))

describe('Full Workflow Integration Tests', () => {
  let fileStorage: FileStorage
  let mediaService: MediaService
  let user: ReturnType<typeof userEvent.setup>
  
  beforeEach(() => {
    vi.clearAllMocks()
    fileStorage = new FileStorage()
    // MediaService needs a config with projectId
    mediaService = new MediaService({
      projectId: 'test-project-123',
      fileStorage: fileStorage
    })
    user = userEvent.setup()
    
    // Mock project file storage
    const mockProjectFile: any = {
      project: { id: 'test-project-123', name: 'Test Project' },
      course_content: {},
      course_data: { title: 'Test', topics: [], difficulty: 1, template: 'default' }
    }
    
    // Mock successful responses
    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      switch (cmd) {
        case 'create_project':
          return Promise.resolve({
            id: 'test-project-123',
            name: 'Test Project',
            path: '/projects/test-project-123',
            created: new Date().toISOString(),
            last_modified: new Date().toISOString()
          })
        case 'load_project':
          return Promise.resolve({ ...mockProjectFile })
        case 'save_project':
          // Update the mock project file when saving
          if (args?.projectData) {
            Object.assign(mockProjectFile, args.projectData)
          }
          return Promise.resolve()
        case 'store_media':
          return Promise.resolve({
            id: args?.mediaId || 'media-123',
            path: `/media/${args?.mediaId || 'media-123'}`
          })
        case 'get_media':
          return Promise.resolve(new ArrayBuffer(1024))
        case 'generate_scorm_enhanced':
          return Promise.resolve(new Uint8Array([80, 75, 3, 4])) // ZIP header
        default:
          return Promise.resolve()
      }
    })
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Project Creation to SCORM Export', () => {
    it('should complete full workflow from project creation to SCORM export', async () => {
      // Step 1: Create project
      const project = await fileStorage.createProject('Integration Test Project')
      expect(project.id).toBe('test-project-123')
      
      // Step 2: Save course seed data
      const seedData = {
        courseTitle: 'Integration Course',
        customTopics: ['Topic 1', 'Topic 2', 'Topic 3'],
        difficulty: 2,
        template: 'interactive'
      }
      await fileStorage.saveContent('courseSeedData', seedData)
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 600))
      
      // Step 3: Add media
      const imageBlob = new Blob(['image data'], { type: 'image/png' })
      const imageId = await mediaService.storeMedia(imageBlob, 'image')
      expect(imageId).toBeDefined()
      
      // Step 4: Generate audio
      const audioBlob = new Blob(['audio data'], { type: 'audio/mp3' })
      const audioId = await mediaService.storeMedia(audioBlob, 'audio')
      expect(audioId).toBeDefined()
      
      // Step 5: Create course content
      const courseContent: EnhancedCourseContent = {
        title: seedData.courseTitle,
        duration: 30,
        passMark: 80,
        navigationMode: 'linear',
        allowRetake: true,
        welcome: {
          title: 'Welcome',
          content: 'Welcome to the course',
          startButtonText: 'Start',
          imageUrl: imageId,
          audioId: audioId
        },
        objectives: ['Learn Topic 1', 'Learn Topic 2'],
        topics: seedData.customTopics.map((topic, index) => ({
          id: `topic-${index}`,
          title: topic,
          content: `Content for ${topic}`
        })),
        assessment: {
          questions: []
        }
      }
      
      await fileStorage.saveContent('course-content', courseContent)
      
      // Wait for save
      await new Promise(resolve => setTimeout(resolve, 600))
      
      // Step 6: Generate SCORM package
      const scormPackage = await generateRustSCORM(courseContent, project.id)
      
      expect(scormPackage).toBeInstanceOf(Uint8Array)
      expect(scormPackage.length).toBeGreaterThan(0)
      
      // Verify all integration points were called
      expect(mockInvoke).toHaveBeenCalledWith('create_project', expect.any(Object))
      expect(mockInvoke).toHaveBeenCalledWith('save_project', expect.any(Object))
      expect(mockInvoke).toHaveBeenCalledWith('store_media', expect.any(Object))
      expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.any(Object))
    })

    it('should handle media persistence across workflow steps', async () => {
      const project = await fileStorage.createProject('Media Persistence Test')
      
      // Store multiple media items
      const media1 = new Blob(['media1'], { type: 'image/png' })
      const media2 = new Blob(['media2'], { type: 'audio/mp3' })
      const media3 = new Blob(['media3'], { type: 'video/mp4' })
      
      const id1 = await mediaService.storeMedia(media1, 'image')
      const id2 = await mediaService.storeMedia(media2, 'audio')
      const id3 = await mediaService.storeMedia(media3, 'video')
      
      // Verify all media was stored
      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id3).toBeDefined()
      
      // Retrieve media
      const retrieved1 = await mediaService.getMedia(id1)
      const retrieved2 = await mediaService.getMedia(id2)
      const retrieved3 = await mediaService.getMedia(id3)
      
      expect(retrieved1).toBeDefined()
      expect(retrieved2).toBeDefined()
      expect(retrieved3).toBeDefined()
    })

    it('should maintain data consistency throughout workflow', async () => {
      const project = await fileStorage.createProject('Consistency Test')
      
      // Save initial data
      const initialData = {
        courseTitle: 'Initial Title',
        topics: ['Topic A']
      }
      await fileStorage.saveContent('initial', initialData)
      await new Promise(resolve => setTimeout(resolve, 600))
      
      // Update data
      const updatedData = {
        courseTitle: 'Updated Title',
        topics: ['Topic A', 'Topic B']
      }
      await fileStorage.saveContent('initial', updatedData)
      await new Promise(resolve => setTimeout(resolve, 600))
      
      // Retrieve and verify
      const retrieved = await fileStorage.getContent('initial')
      expect(retrieved).toEqual(updatedData)
    })

    it('should handle concurrent operations gracefully', async () => {
      const project = await fileStorage.createProject('Concurrent Test')
      
      // Start multiple operations concurrently
      const operations = [
        fileStorage.saveContent('content1', { data: 'data1' }),
        fileStorage.saveContent('content2', { data: 'data2' }),
        mediaService.storeMedia(new Blob(['media'], { type: 'image/png' }), 'image'),
        fileStorage.saveContent('content3', { data: 'data3' })
      ]
      
      // All should complete without errors
      const results = await Promise.allSettled(operations)
      
      results.forEach(result => {
        expect(result.status).toBe('fulfilled')
      })
      
      // Wait for all saves to complete
      await new Promise(resolve => setTimeout(resolve, 1200))
      
      // Verify data integrity
      const content1 = await fileStorage.getContent('content1')
      const content2 = await fileStorage.getContent('content2')
      const content3 = await fileStorage.getContent('content3')
      
      expect(content1).toEqual({ data: 'data1' })
      expect(content2).toEqual({ data: 'data2' })
      expect(content3).toEqual({ data: 'data3' })
    })
  })

  describe('Error Recovery in Workflow', () => {
    it('should recover from media storage failure', async () => {
      const project = await fileStorage.createProject('Recovery Test')
      
      // Make first media store fail
      mockInvoke.mockImplementationOnce(() => 
        Promise.reject(new Error('Storage failed'))
      )
      
      const blob = new Blob(['data'], { type: 'image/png' })
      
      // First attempt should fail
      await expect(
        mediaService.storeMedia(blob, 'image')
      ).rejects.toThrow()
      
      // Second attempt should succeed
      const mediaId = await mediaService.storeMedia(blob, 'image')
      expect(mediaId).toBeDefined()
    })

    it('should handle SCORM generation failure gracefully', async () => {
      const project = await fileStorage.createProject('SCORM Failure Test')
      
      const courseContent: EnhancedCourseContent = {
        title: 'Test',
        duration: 30,
        passMark: 80,
        navigationMode: 'linear',
        allowRetake: true,
        welcome: {
          title: 'Welcome',
          content: 'Test',
          startButtonText: 'Start'
        },
        objectives: [],
        topics: [],
        assessment: { questions: [] }
      }
      
      // Make SCORM generation fail
      const originalImpl = mockInvoke.getMockImplementation()
      mockInvoke.mockImplementationOnce((cmd, args) => {
        if (cmd === 'generate_scorm_enhanced') {
          return Promise.reject(new Error('Generation failed'))
        }
        return originalImpl(cmd, args)
      })
      
      // Should throw error
      await expect(
        generateRustSCORM(courseContent, project.id)
      ).rejects.toThrow()
      
      // Retry should succeed
      const result = await generateRustSCORM(courseContent, project.id)
      expect(result).toBeInstanceOf(Uint8Array)
    })

    it('should maintain state after workflow interruption', async () => {
      const project = await fileStorage.createProject('Interruption Test')
      
      // Save partial data
      await fileStorage.saveContent('partial', { step: 1, data: 'initial' })
      await new Promise(resolve => setTimeout(resolve, 600))
      
      // Simulate interruption (error during next save)
      const originalImpl = mockInvoke.getMockImplementation()
      mockInvoke.mockImplementationOnce((cmd, args) => {
        if (cmd === 'save_project') {
          return Promise.reject(new Error('Network error'))
        }
        return originalImpl(cmd, args)
      })
      
      // Try to save more data (will fail)
      try {
        await fileStorage.saveContent('partial', { step: 2, data: 'updated' })
        await new Promise(resolve => setTimeout(resolve, 600))
      } catch (error) {
        // Expected failure
      }
      
      // Original data should still be retrievable
      const recovered = await fileStorage.getContent('partial')
      expect(recovered.step).toBe(1)
    })
  })

  describe('Workflow Performance', () => {
    it('should handle large media files efficiently', async () => {
      const project = await fileStorage.createProject('Performance Test')
      
      // Create a large blob (5MB)
      const largeData = new Uint8Array(5 * 1024 * 1024)
      const largeBlob = new Blob([largeData], { type: 'video/mp4' })
      
      const startTime = Date.now()
      const mediaId = await mediaService.storeMedia(largeBlob, 'video')
      const endTime = Date.now()
      
      expect(mediaId).toBeDefined()
      // Should complete in reasonable time (< 5 seconds for mock)
      expect(endTime - startTime).toBeLessThan(5000)
    })

    it('should batch save operations efficiently', async () => {
      const project = await fileStorage.createProject('Batch Test')
      
      const startTime = Date.now()
      
      // Queue multiple saves rapidly
      for (let i = 0; i < 10; i++) {
        fileStorage.saveContent('batch', { iteration: i })
      }
      
      // Wait for debouncing to complete
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const endTime = Date.now()
      
      // Check that only the last value was saved
      const saved = await fileStorage.getContent('batch')
      expect(saved.iteration).toBe(9)
      
      // Should complete efficiently due to debouncing
      expect(endTime - startTime).toBeLessThan(3000)
    })
  })
})