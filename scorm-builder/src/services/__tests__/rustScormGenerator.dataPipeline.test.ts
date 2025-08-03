import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateRustSCORM } from '../rustScormGenerator'
import { MediaStore } from '../MediaStore'
import type { EnhancedCourseContent } from '../../types/scorm'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock MediaStore
vi.mock('../MediaStore', () => ({
  MediaStore: {
    getMedia: vi.fn()
  }
}))

describe('rustScormGenerator - Data Pipeline Validation', () => {
  const mockProjectId = 'test-project-123'
  let mockInvoke: any
  
  beforeEach(async () => {
    mockInvoke = vi.mocked((await import('@tauri-apps/api/core')).invoke)
    vi.clearAllMocks()
    console.log = vi.fn() // Capture console logs
    console.error = vi.fn()
    console.warn = vi.fn()
  })

  describe('Data Serialization', () => {
    it('should serialize course data without losing any fields', async () => {
      const courseContent: EnhancedCourseContent = {
        title: 'Test Course',
        passMark: 75,
        navigationMode: 'free',
        allowRetake: true,
        welcome: {
          title: 'Welcome Page',
          content: 'Welcome content',
          startButtonText: 'Begin',
          audioFile: 'audio-0.bin',
          captionFile: 'caption-0.bin',
          media: [{
            id: 'welcome-img',
            type: 'image',
            url: 'https://example.com/welcome.jpg',
            title: 'Welcome Image'
          }]
        },
        objectives: ['Objective 1', 'Objective 2'],
        objectivesPage: {
          audioFile: 'audio-1.bin',
          captionFile: 'caption-1.bin',
          media: [{
            id: 'obj-img',
            type: 'image',
            url: 'blob:http://localhost/obj-image',
            title: 'Objectives Image'
          }]
        },
        topics: [{
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Topic content',
          audioFile: 'audio-2.bin',
          captionFile: 'caption-2.bin',
          media: [{
            id: 'topic-img',
            type: 'image',
            url: 'blob:http://localhost/topic-image',
            title: 'Topic Image'
          }],
          knowledgeCheck: {
            type: 'multiple-choice',
            question: 'Test question?',
            options: ['Option A', 'Option B', 'Option C'],
            correctAnswer: 1,
            feedback: {
              correct: 'Correct!',
              incorrect: 'Try again'
            }
          }
        }],
        assessment: {
          questions: [{
            question: 'Assessment Q1',
            options: ['A1', 'A2', 'A3', 'A4'],
            correctAnswer: 2
          }]
        }
      }

      // Mock MediaStore responses
      vi.mocked(MediaStore.getMedia).mockImplementation(async (id) => {
        if (id === 'obj-img') {
          return {
            id,
            projectId: mockProjectId,
            type: 'image',
            blob: new Blob(['fake-image-data'], { type: 'image/png' }),
            url: 'blob:http://localhost/obj-image',
            metadata: {}
          }
        }
        if (id === 'topic-img') {
          return {
            id,
            projectId: mockProjectId,
            type: 'image', 
            blob: new Blob(['fake-topic-image'], { type: 'image/jpeg' }),
            url: 'blob:http://localhost/topic-image',
            metadata: {}
          }
        }
        return null
      })

      // Mock successful Rust invocation
      mockInvoke.mockResolvedValue(new Array(1000).fill(0))

      await generateRustSCORM(courseContent, mockProjectId)

      // Verify the invoke was called
      expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.any(Object))
      
      // Get the actual data passed to Rust
      const [, invokeArgs] = mockInvoke.mock.calls[0]
      const { courseData, mediaFiles } = invokeArgs as any

      // Verify all fields are present in the serialized data
      expect(courseData).toMatchObject({
        course_title: 'Test Course',
        pass_mark: 75,
        navigation_mode: 'free',
        allow_retake: true
      })

      // Verify welcome page
      expect(courseData.welcome_page).toMatchObject({
        title: 'Welcome Page',
        content: 'Welcome content',
        start_button_text: 'Begin',
        audio_file: 'audio-0.bin',
        caption_file: 'caption-0.bin'
      })

      // Verify objectives
      expect(courseData.learning_objectives_page).toMatchObject({
        objectives: ['Objective 1', 'Objective 2'],
        audio_file: 'audio-1.bin',
        caption_file: 'caption-1.bin'
      })

      // Verify topics
      expect(courseData.topics).toHaveLength(1)
      expect(courseData.topics[0]).toMatchObject({
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic content',
        audio_file: 'audio-2.bin',
        caption_file: 'caption-2.bin'
      })

      // Verify knowledge check
      expect(courseData.topics[0].knowledge_check).toMatchObject({
        enabled: true,
        questions: [{
          type: 'multiple-choice',
          text: 'Test question?',
          options: ['Option A', 'Option B', 'Option C'],
          correct_answer: 'Option B',
          explanation: 'Try again'
        }]
      })

      // Verify assessment
      expect(courseData.assessment).toMatchObject({
        questions: [{
          type: 'multiple-choice',
          text: 'Assessment Q1',
          options: ['A1', 'A2', 'A3', 'A4'],
          correct_answer: 'A3'
        }]
      })
    })

    it('should include media files in the Rust invocation', async () => {
      const courseContent: EnhancedCourseContent = {
        title: 'Media Test Course',
        topics: [{
          id: 'topic-1',
          title: 'Topic with Media',
          content: 'Content',
          media: [{
            id: 'media-1',
            type: 'image',
            url: 'blob:http://localhost/image1',
            title: 'Image 1'
          }, {
            id: 'media-2',
            type: 'video',
            url: 'blob:http://localhost/video1',
            title: 'Video 1'
          }]
        }]
      }

      // Mock MediaStore with different media types
      vi.mocked(MediaStore.getMedia).mockImplementation(async (id) => {
        if (id === 'media-1') {
          return {
            id,
            projectId: mockProjectId,
            type: 'image',
            blob: new Blob(['image-data'], { type: 'image/png' }),
            url: 'blob:http://localhost/image1',
            metadata: {}
          }
        }
        if (id === 'media-2') {
          return {
            id,
            projectId: mockProjectId,
            type: 'video',
            blob: new Blob(['video-data'], { type: 'video/mp4' }),
            url: 'blob:http://localhost/video1',
            metadata: {}
          }
        }
        return null
      })

      mockInvoke.mockResolvedValue(new Array(1000).fill(0))

      await generateRustSCORM(courseContent, mockProjectId)

      const [, invokeArgs] = mockInvoke.mock.calls[0]
      const { mediaFiles } = invokeArgs as any

      // Verify media files were included
      expect(mediaFiles).toHaveLength(2)
      expect(mediaFiles[0]).toMatchObject({
        filename: 'media/image-1.png',
        content: expect.any(Uint8Array)
      })
      expect(mediaFiles[1]).toMatchObject({
        filename: 'media/video-1.mp4',
        content: expect.any(Uint8Array)
      })

      // Verify content was converted to Uint8Array
      expect(mediaFiles[0].content).toBeInstanceOf(Uint8Array)
      expect(mediaFiles[1].content).toBeInstanceOf(Uint8Array)
    })

    it('should handle missing media gracefully', async () => {
      const courseContent: EnhancedCourseContent = {
        title: 'Course with Missing Media',
        topics: [{
          id: 'topic-1',
          title: 'Topic',
          content: 'Content',
          media: [{
            id: 'missing-media',
            type: 'image',
            url: 'blob:http://localhost/missing',
            title: 'Missing Image'
          }]
        }]
      }

      // MediaStore returns null for missing media
      vi.mocked(MediaStore.getMedia).mockResolvedValue(null)

      mockInvoke.mockResolvedValue(new Array(1000).fill(0))

      await generateRustSCORM(courseContent, mockProjectId)

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[Rust SCORM] Media not found in store: missing-media'
      )

      // Verify empty URL was used
      const [, invokeArgs] = mockInvoke.mock.calls[0]
      const { courseData, mediaFiles } = invokeArgs as any

      expect(courseData.topics[0].media[0].url).toBe('')
      expect(mediaFiles).toBeUndefined() // No media files collected
    })

    it('should preserve all audio and caption file references', async () => {
      const courseContent: EnhancedCourseContent = {
        title: 'Audio Test Course',
        welcome: {
          title: 'Welcome',
          content: 'Content',
          audioFile: 'media/audio-0.bin',
          captionFile: 'media/caption-0.bin'
        },
        objectivesPage: {
          audioFile: 'media/audio-1.bin',
          captionFile: 'media/caption-1.bin'
        },
        topics: [{
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content',
          audioFile: 'media/audio-2.bin',
          captionFile: 'media/caption-2.bin'
        }, {
          id: 'topic-2',
          title: 'Topic 2',
          content: 'Content',
          audioFile: 'media/audio-3.bin',
          captionFile: 'media/caption-3.bin'
        }]
      }

      mockInvoke.mockResolvedValue(new Array(1000).fill(0))

      await generateRustSCORM(courseContent, mockProjectId)

      const [, invokeArgs] = mockInvoke.mock.calls[0]
      const { courseData } = invokeArgs as any

      // Verify all audio/caption files are preserved
      expect(courseData.welcome_page.audio_file).toBe('media/audio-0.bin')
      expect(courseData.welcome_page.caption_file).toBe('media/caption-0.bin')
      
      expect(courseData.learning_objectives_page.audio_file).toBe('media/audio-1.bin')
      expect(courseData.learning_objectives_page.caption_file).toBe('media/caption-1.bin')
      
      expect(courseData.topics[0].audio_file).toBe('media/audio-2.bin')
      expect(courseData.topics[0].caption_file).toBe('media/caption-2.bin')
      
      expect(courseData.topics[1].audio_file).toBe('media/audio-3.bin')
      expect(courseData.topics[1].caption_file).toBe('media/caption-3.bin')
    })

    it('should log data being sent to Rust for debugging', async () => {
      const courseContent: EnhancedCourseContent = {
        title: 'Debug Test',
        topics: [{
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content',
          knowledgeCheck: {
            type: 'fill-in-the-blank',
            question: 'The answer is ___',
            correctAnswer: 'test'
          }
        }]
      }

      mockInvoke.mockResolvedValue(new Array(1000).fill(0))

      await generateRustSCORM(courseContent, mockProjectId)

      // Verify debug logging
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Rust SCORM] Converting course content')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Rust SCORM] Converted data:'),
        expect.any(String)
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Rust SCORM] Media files count:'),
        0
      )
    })
  })
})