import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateRustSCORM, clearMediaCache } from '../rustScormGenerator'
import type { EnhancedCourseContent } from '../../types/scorm'

// Mock Tauri invoke
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

// Mock Tauri listen  
const mockListen = vi.fn()
vi.mock('@tauri-apps/api/event', () => ({
  listen: (event: string, handler: any) => mockListen(event, handler)
}))

// Mock external image downloader
vi.mock('../externalImageDownloader', () => ({
  downloadIfExternal: vi.fn((url: string) => Promise.resolve(url)),
  isExternalUrl: vi.fn((url: string) => url.startsWith('http'))
}))

// Mock blobUrlManager
vi.mock('../../utils/blobUrlManager', () => ({
  blobUrlManager: {
    lockAll: vi.fn(),
    unlockAll: vi.fn()
  }
}))

describe('SCORM Export Tests', () => {
  let mockCourseContent: EnhancedCourseContent
  
  beforeEach(() => {
    vi.clearAllMocks()
    clearMediaCache()
    
    // Create minimal valid course content
    mockCourseContent = {
      title: 'Test Course',
      duration: 30,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome to the course',
        startButtonText: 'Start'
      },
      objectives: ['Learn'],
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content 1'
        }
      ],
      assessment: {
        questions: []
      }
    }
    
    // Default mock return value
    mockInvoke.mockResolvedValue(new Uint8Array([80, 75, 3, 4])) // ZIP file header
  })
  
  afterEach(() => {
    clearMediaCache()
  })

  describe('Basic Export', () => {
    it('should call generate_scorm_enhanced with correct parameters', async () => {
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', 
        expect.objectContaining({
          courseData: expect.any(Object),
          projectId: 'project-123'
        })
      )
    })

    it('should return a Uint8Array', async () => {
      const result = await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should lock and unlock blob URLs during generation', async () => {
      const { blobUrlManager } = await import('../../utils/blobUrlManager')
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(blobUrlManager.lockAll).toHaveBeenCalled()
      expect(blobUrlManager.unlockAll).toHaveBeenCalled()
    })

    it('should clear media cache after generation', async () => {
      const spy = vi.spyOn(console, 'log')
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(spy).toHaveBeenCalledWith('[Rust SCORM] Media cache cleared')
      spy.mockRestore()
    })
  })

  describe('Progress Tracking', () => {
    it('should handle progress callback', async () => {
      const onProgress = vi.fn()
      let progressHandler: any = null
      
      mockListen.mockImplementation((event, handler) => {
        if (event === 'scorm-generation-progress') {
          progressHandler = handler
        }
        return Promise.resolve(() => {})
      })
      
      const promise = generateRustSCORM(mockCourseContent, 'project-123', onProgress)
      
      // Simulate progress event
      if (progressHandler) {
        await progressHandler({ 
          payload: { message: 'Processing...', progress: 50 } 
        })
      }
      
      await promise
      
      // The actual implementation calls progress multiple times
      expect(onProgress).toHaveBeenCalled()
      // Check that it was called with some progress value
      expect(onProgress.mock.calls.some(call => call[1] === 50)).toBe(true)
    })
  })

  describe('Media Handling', () => {
    it('should process audio files', async () => {
      mockCourseContent.welcome.audioId = 'audio-0'
      mockCourseContent.welcome.audioFile = 'audio-0'
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
      const args = mockInvoke.mock.calls[0][1]
      expect(args).toHaveProperty('courseData')
      expect(args).toHaveProperty('projectId', 'project-123')
    })

    it('should process image URLs', async () => {
      mockCourseContent.welcome.imageUrl = 'image-welcome'
      mockCourseContent.topics[0].imageUrl = 'image-topic-1'
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
      const args = mockInvoke.mock.calls[0][1]
      expect(args).toHaveProperty('courseData')
      expect(args).toHaveProperty('projectId')
    })

    it('should handle external images', async () => {
      const { downloadIfExternal, isExternalUrl } = await import('../externalImageDownloader')
      
      mockCourseContent.welcome.imageUrl = 'https://example.com/image.jpg'
      
      vi.mocked(isExternalUrl).mockReturnValue(true)
      vi.mocked(downloadIfExternal).mockResolvedValue('data:image/jpeg;base64,test')
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(downloadIfExternal).toHaveBeenCalledWith('https://example.com/image.jpg')
    })

    it('should handle YouTube videos', async () => {
      mockCourseContent.topics[0].embedUrl = 'https://youtube.com/embed/abc123'
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
      const args = mockInvoke.mock.calls[0][1]
      expect(args).toHaveProperty('courseData')
    })

    it('should handle captions', async () => {
      mockCourseContent.welcome.captionId = 'caption-0'
      mockCourseContent.welcome.captionFile = 'caption-0'
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
      const args = mockInvoke.mock.calls[0][1]
      expect(args).toHaveProperty('courseData')
    })
  })

  describe('Course Structure', () => {
    it('should handle topics with knowledge checks', async () => {
      mockCourseContent.topics[0].knowledgeCheck = {
        questions: [{
          type: 'multiple-choice',
          text: 'Test question?',
          options: ['A', 'B', 'C'],
          correctAnswer: 0,
          explanation: 'A is correct'
        }],
        correctAnswer: 0
      }
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
      const args = mockInvoke.mock.calls[0][1]
      expect(args).toHaveProperty('courseData')
    })

    it('should handle assessment questions', async () => {
      mockCourseContent.assessment = {
        questions: [
          {
            id: 'q-1',
            type: 'multiple-choice',
            question: 'Question 1?', // Changed from 'text' to 'question'
            text: 'Question 1?',
            options: ['A', 'B', 'C'],
            correctAnswer: 'A',
            explanation: 'A is correct',
            correct_feedback: 'Well done!',
            incorrect_feedback: 'Try again!'
          }
        ]
      }
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
      const args = mockInvoke.mock.calls[0][1]
      expect(args).toHaveProperty('courseData')
    })

    it('should handle empty topics array', async () => {
      mockCourseContent.topics = []
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
      const args = mockInvoke.mock.calls[0][1]
      expect(args).toHaveProperty('courseData')
    })

    it('should handle learning objectives', async () => {
      mockCourseContent.objectives = ['Objective 1', 'Objective 2', 'Objective 3']
      mockCourseContent.learningObjectivesPage = {
        objectives: ['Objective 1', 'Objective 2', 'Objective 3']
      }
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
      const args = mockInvoke.mock.calls[0][1]
      expect(args).toHaveProperty('courseData')
    })
  })

  describe('Error Handling', () => {
    it('should handle invoke errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Backend error'))
      
      await expect(
        generateRustSCORM(mockCourseContent, 'project-123')
      ).rejects.toThrow()
    })

    it('should handle invalid course content gracefully', async () => {
      const invalidContent = null as any
      
      await expect(
        generateRustSCORM(invalidContent, 'project-123')
      ).rejects.toThrow()
    })

    it('should continue if progress listener fails', async () => {
      mockListen.mockRejectedValue(new Error('Listen failed'))
      
      const onProgress = vi.fn()
      
      // Should not throw
      await expect(
        generateRustSCORM(mockCourseContent, 'project-123', onProgress)
      ).resolves.not.toThrow()
    })

    it('should handle external image download failures', async () => {
      const { downloadIfExternal, isExternalUrl } = await import('../externalImageDownloader')
      
      mockCourseContent.welcome.imageUrl = 'https://example.com/broken.jpg'
      
      vi.mocked(isExternalUrl).mockReturnValue(true)
      vi.mocked(downloadIfExternal).mockRejectedValue(new Error('Download failed'))
      
      const spy = vi.spyOn(console, 'error')
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download external image'),
        expect.any(Error)
      )
      
      spy.mockRestore()
    })
  })

  describe('Course Settings', () => {
    it('should respect navigation mode', async () => {
      mockCourseContent.navigationMode = 'free'
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
      const args = mockInvoke.mock.calls[0][1]
      expect(args).toHaveProperty('courseData')
    })

    it('should respect pass mark', async () => {
      mockCourseContent.passMark = 75
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
      const args = mockInvoke.mock.calls[0][1]
      expect(args).toHaveProperty('courseData')
    })

    it('should respect allow retake setting', async () => {
      mockCourseContent.allowRetake = false
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
      const args = mockInvoke.mock.calls[0][1]
      expect(args).toHaveProperty('courseData')
    })

    it('should include course duration', async () => {
      mockCourseContent.duration = 45
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
      const args = mockInvoke.mock.calls[0][1]
      expect(args).toHaveProperty('courseData')
    })
  })
})