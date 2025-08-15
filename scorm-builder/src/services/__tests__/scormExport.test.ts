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

// Mock FileStorage
vi.mock('../FileStorage', () => ({
  FileStorage: vi.fn().mockImplementation(() => ({
    getMedia: vi.fn(),
    listMedia: vi.fn(),
    getContent: vi.fn()
  }))
}))

describe('SCORM Export - End-to-End Tests', () => {
  let mockCourseContent: EnhancedCourseContent
  
  beforeEach(() => {
    vi.clearAllMocks()
    clearMediaCache()
    
    // Create mock course content
    mockCourseContent = {
      title: 'Test Course',
      duration: 30,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome to Test Course',
        content: 'This is a test course',
        startButtonText: 'Start Course'
      },
      objectives: ['Learn about testing', 'Master SCORM export'],
      learningObjectivesPage: {
        objectives: ['Learn about testing', 'Master SCORM export']
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Topic 1 content'
        },
        {
          id: 'topic-2', 
          title: 'Topic 2',
          content: 'Topic 2 content'
        }
      ],
      assessment: {
        questions: [
          {
            id: 'q-1',
            type: 'multiple-choice',
            text: 'Test question 1?',
            options: ['Option A', 'Option B', 'Option C'],
            correctAnswer: 'Option A',
            explanation: 'A is correct',
            correct_feedback: 'Correct!',
            incorrect_feedback: 'Try again!'
          }
        ]
      }
    }
  })
  
  afterEach(() => {
    clearMediaCache()
  })

  describe('Basic SCORM Package Generation', () => {
    it('should generate a SCORM package successfully', async () => {
      const mockZipData = new Uint8Array([1, 2, 3, 4, 5])
      
      mockInvoke.mockResolvedValue(Array.from(mockZipData))
      
      const result = await generateRustSCORM(
        mockCourseContent,
        'project-123'
      )
      
      expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_package', 
        expect.objectContaining({
          course_content: expect.any(Object),
          project_id: 'project-123'
        })
      )
      
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should include course metadata in the package', async () => {
      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'generate_scorm_package') {
          const content = args.course_content
          expect(content.title).toBe('Test Course')
          expect(content.welcome.title).toBe('Welcome to Test Course')
          expect(content.topics).toHaveLength(2)
          expect(content.assessment.questions).toHaveLength(1)
        }
        return Promise.resolve(new Uint8Array([1, 2, 3]))
      })
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
    })

    it('should handle empty topics gracefully', async () => {
      mockCourseContent.topics = []
      
      mockInvoke.mockResolvedValue(new Uint8Array([1, 2, 3]))
      
      const result = await generateRustSCORM(
        mockCourseContent,
        'project-123'
      )
      
      expect(result).toBeInstanceOf(Uint8Array)
    })

    it('should respect course settings', async () => {
      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'generate_scorm_package') {
          const content = args.course_content
          expect(content.passMark).toBe(80)
          expect(content.navigationMode).toBe('linear')
          expect(content.allowRetake).toBe(true)
        }
        return Promise.resolve(new Uint8Array([1, 2, 3]))
      })
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
    })
  })

  describe('Media Integration', () => {
    it('should include audio narration files', async () => {
      mockCourseContent.welcome.audioId = 'audio-0'
      mockCourseContent.learningObjectivesPage!.audioId = 'audio-1'
      mockCourseContent.topics[0].audioId = 'audio-2'
      
      mockInvoke.mockResolvedValue(new Uint8Array([1, 2, 3]))
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
    })

    it('should handle image media', async () => {
      mockCourseContent.welcome.imageUrl = 'image-welcome'
      mockCourseContent.topics[0].imageUrl = 'image-topic-1'
      
      mockInvoke.mockResolvedValue(new Uint8Array([1, 2, 3]))
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
    })

    it('should handle caption files', async () => {
      mockCourseContent.welcome.captionId = 'caption-0'
      
      mockInvoke.mockResolvedValue(new Uint8Array([1, 2, 3]))
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
    })

    it('should handle YouTube videos', async () => {
      mockCourseContent.topics[0].youtubeVideo = {
        url: 'https://youtube.com/watch?v=abc123',
        embedUrl: 'https://youtube.com/embed/abc123',
        title: 'Test Video'
      }
      
      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'generate_scorm_package') {
          const content = JSON.parse(args.request.course_content)
          expect(content.topics[0].youtubeVideo).toBeDefined()
          expect(content.topics[0].youtubeVideo.embedUrl).toBe('https://youtube.com/embed/abc123')
        }
        return Promise.resolve({ success: true })
      })
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
    })

    it('should handle missing media gracefully', async () => {
      mockCourseContent.welcomeAudio = 'audio-missing'
      mockCourseContent.topics[0].image = 'image-missing'
      
      mockInvoke.mockResolvedValue({ success: true })
      
      // Should not throw, just skip missing media
      await expect(
        generateRustSCORM(mockCourseContent, 'project-123', {})
      ).resolves.not.toThrow()
      
      expect(mockInvoke).toHaveBeenCalled()
    })

    it('should clear media cache after generation', async () => {
      const spy = vi.spyOn(console, 'log')
      
      mockInvoke.mockResolvedValue({ success: true })
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      // Media cache should be cleared
      expect(spy).toHaveBeenCalledWith('[Rust SCORM] Media cache cleared')
      
      spy.mockRestore()
    })
  })

  describe('Progress Tracking', () => {
    it('should emit progress events during generation', async () => {
      let progressHandler: any = null
      let unlistener: any = () => {}
      
      mockListen.mockImplementation((event, handler) => {
        if (event === 'scorm-generation-progress') {
          progressHandler = handler
        }
        return Promise.resolve(unlistener)
      })
      
      const onProgress = vi.fn()
      
      const promise = generateRustSCORM(
        mockCourseContent,
        'project-123',
        {},
        onProgress
      )
      
      // Simulate progress events
      if (progressHandler) {
        await progressHandler({ payload: { percent: 25, message: 'Processing media...' } })
        await progressHandler({ payload: { percent: 50, message: 'Building package...' } })
        await progressHandler({ payload: { percent: 100, message: 'Complete' } })
      }
      
      mockInvoke.mockResolvedValue({ success: true })
      
      await promise
      
      expect(onProgress).toHaveBeenCalledWith({ percent: 25, message: 'Processing media...' })
      expect(onProgress).toHaveBeenCalledWith({ percent: 50, message: 'Building package...' })
      expect(onProgress).toHaveBeenCalledWith({ percent: 100, message: 'Complete' })
    })

    it('should cleanup progress listener on completion', async () => {
      const unlistener = vi.fn()
      mockListen.mockResolvedValue(unlistener)
      mockInvoke.mockResolvedValue({ success: true })
      
      await generateRustSCORM(mockCourseContent, 'project-123', {}, vi.fn())
      
      expect(unlistener).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle generation errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Generation failed'))
      
      await expect(
        generateRustSCORM(mockCourseContent, 'project-123', {})
      ).rejects.toThrow('Failed to generate SCORM package')
    })

    it('should handle invalid course content', async () => {
      const invalidContent = null as any
      
      await expect(
        generateRustSCORM(invalidContent, 'project-123', {})
      ).rejects.toThrow()
    })

    it('should handle media loading errors', async () => {
      const errorBlob = new Blob([])
      Object.defineProperty(errorBlob, 'arrayBuffer', {
        value: () => Promise.reject(new Error('Failed to read blob'))
      })
      
      mockCourseContent.welcomeAudio = 'audio-error'
      
      const spy = vi.spyOn(console, 'error')
      mockInvoke.mockResolvedValue({ success: true })
      
      await generateRustSCORM(
        mockCourseContent,
        'project-123',
        { 'audio-error': errorBlob }
      )
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('[Rust SCORM] Failed to process blob:'),
        expect.any(Error)
      )
      
      spy.mockRestore()
    })

    it('should handle progress listener errors', async () => {
      mockListen.mockRejectedValue(new Error('Failed to listen'))
      mockInvoke.mockResolvedValue({ success: true })
      
      // Should still generate package even if progress fails
      await expect(
        generateRustSCORM(mockCourseContent, 'project-123', {}, vi.fn())
      ).resolves.not.toThrow()
    })
  })

  describe('External Resources', () => {
    it('should download external images', async () => {
      const { downloadIfExternal, isExternalUrl } = await import('../externalImageDownloader')
      
      mockCourseContent.welcomeImage = 'https://example.com/image.jpg'
      mockCourseContent.topics[0].image = 'https://example.com/topic.png'
      
      vi.mocked(isExternalUrl).mockReturnValue(true)
      vi.mocked(downloadIfExternal).mockResolvedValue('data:image/jpeg;base64,abc123')
      
      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'generate_scorm_package') {
          const content = JSON.parse(args.request.course_content)
          expect(content.welcomeImage).toBe('data:image/jpeg;base64,abc123')
          expect(content.topics[0].image).toBe('data:image/jpeg;base64,abc123')
        }
        return Promise.resolve({ success: true })
      })
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(downloadIfExternal).toHaveBeenCalledWith('https://example.com/image.jpg')
      expect(downloadIfExternal).toHaveBeenCalledWith('https://example.com/topic.png')
    })

    it('should handle external download failures', async () => {
      const { downloadIfExternal, isExternalUrl } = await import('../externalImageDownloader')
      
      mockCourseContent.welcomeImage = 'https://example.com/broken.jpg'
      
      vi.mocked(isExternalUrl).mockReturnValue(true)
      vi.mocked(downloadIfExternal).mockRejectedValue(new Error('Download failed'))
      
      const spy = vi.spyOn(console, 'error')
      mockInvoke.mockResolvedValue({ success: true })
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download external image'),
        expect.any(Error)
      )
      
      spy.mockRestore()
    })
  })

  describe('Question Types', () => {
    it('should handle multiple choice questions', async () => {
      mockCourseContent.questions = [
        {
          id: 'q-1',
          topicId: 'topic-1',
          questionText: 'What is 2 + 2?',
          answerType: 'multipleChoice',
          options: ['3', '4', '5'],
          correctAnswer: 1,
          explanation: '2 + 2 = 4'
        }
      ]
      
      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'generate_scorm_package') {
          const content = JSON.parse(args.request.course_content)
          const question = content.questions[0]
          expect(question.answerType).toBe('multipleChoice')
          expect(question.options).toEqual(['3', '4', '5'])
          expect(question.correctAnswer).toBe(1)
        }
        return Promise.resolve({ success: true })
      })
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
    })

    it('should handle text input questions', async () => {
      mockCourseContent.questions = [
        {
          id: 'q-2',
          topicId: 'topic-1',
          questionText: 'What is the capital of France?',
          answerType: 'text',
          correctAnswer: 'Paris',
          explanation: 'Paris is the capital of France'
        }
      ]
      
      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'generate_scorm_package') {
          const content = JSON.parse(args.request.course_content)
          const question = content.questions[0]
          expect(question.answerType).toBe('text')
          expect(question.correctAnswer).toBe('Paris')
        }
        return Promise.resolve({ success: true })
      })
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
    })

    it('should handle true/false questions', async () => {
      mockCourseContent.questions = [
        {
          id: 'q-3',
          topicId: 'topic-1',
          questionText: 'The sky is blue',
          answerType: 'trueFalse',
          correctAnswer: true,
          explanation: 'The sky appears blue due to Rayleigh scattering'
        }
      ]
      
      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'generate_scorm_package') {
          const content = JSON.parse(args.request.course_content)
          const question = content.questions[0]
          expect(question.answerType).toBe('trueFalse')
          expect(question.correctAnswer).toBe(true)
        }
        return Promise.resolve({ success: true })
      })
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
    })
  })

  describe('SCORM Compliance', () => {
    it('should generate SCORM 1.2 package by default', async () => {
      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'generate_scorm_package') {
          expect(args.request.scorm_version).toBeUndefined()
        }
        return Promise.resolve({ success: true })
      })
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
    })

    it('should support SCORM 2004 when specified', async () => {
      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'generate_scorm_package') {
          expect(args.request.scorm_version).toBe('2004')
        }
        return Promise.resolve({ success: true })
      })
      
      await generateRustSCORM(
        mockCourseContent,
        'project-123',
        {},
        undefined,
        { scormVersion: '2004' }
      )
      
      expect(mockInvoke).toHaveBeenCalled()
    })

    it('should include manifest metadata', async () => {
      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'generate_scorm_package') {
          const content = JSON.parse(args.request.course_content)
          expect(content.courseName).toBeDefined()
          expect(content.settings.passingScore).toBeDefined()
        }
        return Promise.resolve({ success: true })
      })
      
      await generateRustSCORM(mockCourseContent, 'project-123')
      
      expect(mockInvoke).toHaveBeenCalled()
    })
  })
})