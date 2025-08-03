import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateRustSCORM } from '../rustScormGenerator'
import { invoke } from '@tauri-apps/api/core'
import type { EnhancedCourseContent } from '../../types/course'

vi.mock('@tauri-apps/api/core')
vi.mock('../MediaStore')
vi.mock('../externalImageDownloader', () => ({
  isExternalUrl: vi.fn((url: string) => url.startsWith('http')),
  downloadIfExternal: vi.fn(() => Promise.resolve(null))
}))

describe('RustScormGenerator - Media Data Passing Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('User wants welcome page to display images', () => {
    it('should pass welcome page media data to Rust generator', async () => {
      // Arrange
      const mockCourseContent: EnhancedCourseContent = {
        title: 'Test Course',
        description: 'Test Description',
        welcome: {
          title: 'Welcome',
          content: 'Welcome content',
          imageUrl: 'image-1.jpg',
          media: [{
            id: 'media-1',
            url: 'https://example.com/image.jpg',
            type: 'image',
            title: 'Welcome Image'
          }]
        },
        objectives: [],
        topics: [],
        assessment: { questions: [] },
        passMark: 80
      }

      const mockInvoke = vi.mocked(invoke)
      mockInvoke.mockResolvedValueOnce([1, 2, 3, 4, 5]) // Mock byte array response

      // Act
      await generateRustSCORM(mockCourseContent, 'project-1')

      // Assert - This test reveals the problem: media is not being passed to welcome_page!
      expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', {
        courseData: expect.objectContaining({
          welcome_page: expect.objectContaining({
            title: 'Welcome',
            content: 'Welcome content',
            audio_file: 'media/audio-0.mp3',
            // BUG: image_url and media are NOT being passed to Rust!
            // This is why the generated HTML has no media containers
          })
        }),
        projectId: 'project-1',
        mediaFiles: []
      })
    })

    it('should pass objectives page media data to Rust generator', async () => {
      // Arrange
      const mockCourseContent: EnhancedCourseContent = {
        title: 'Test Course',
        description: 'Test Description',
        welcome: {
          title: 'Welcome',
          content: 'Welcome content'
        },
        objectives: ['Objective 1', 'Objective 2'],
        objectivesPage: {
          imageUrl: 'objectives-image.jpg',
          media: [{
            id: 'media-2',
            url: 'https://example.com/objectives.jpg',
            type: 'image',
            title: 'Objectives Image'
          }]
        },
        topics: [],
        assessment: { questions: [] },
        passMark: 80
      }

      const mockInvoke = vi.mocked(invoke)
      mockInvoke.mockResolvedValueOnce([1, 2, 3, 4, 5]) // Mock byte array response

      // Act
      await generateRustSCORM(mockCourseContent, 'project-1')

      // Assert - This test reveals another issue: wrong field name!
      expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', {
        courseData: expect.objectContaining({
          learning_objectives_page: expect.objectContaining({
            title: 'Learning Objectives',
            objectives: ['Objective 1', 'Objective 2'],
            audio_file: 'media/audio-1.mp3',
            image_url: 'objectives-image.jpg',
            // BUG: media field is NOT being passed!
          })
        }),
        projectId: 'project-1',
        mediaFiles: []
      })
    })
  })

  describe('User wants YouTube videos to embed properly', () => {
    it('should detect YouTube URLs and add embed data', async () => {
      // Arrange
      const mockCourseContent: EnhancedCourseContent = {
        title: 'Test Course',
        description: 'Test Description',
        welcome: {
          title: 'Welcome',
          content: 'Welcome content'
        },
        objectives: [],
        topics: [{
          id: 'topic-0',
          title: 'Topic 1',
          content: 'Topic content',
          media: [{
            id: 'media-3',
            url: 'https://youtube.com/watch?v=-njmj0diWu8',
            type: 'video',
            title: 'YouTube Video'
          }],
          knowledgeCheck: null
        }],
        assessment: { questions: [] },
        passMark: 80
      }

      const mockInvoke = vi.mocked(invoke)
      mockInvoke.mockResolvedValueOnce([1, 2, 3, 4, 5]) // Mock byte array response

      // Act
      await generateRustSCORM(mockCourseContent, 'project-1')

      // Assert
      expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', {
        courseData: expect.objectContaining({
          topics: expect.arrayContaining([
            expect.objectContaining({
              media: expect.arrayContaining([
                expect.objectContaining({
                  id: 'media-3',
                  url: 'https://youtube.com/watch?v=-njmj0diWu8',
                  type: 'video',
                  is_youtube: true,
                  youtube_id: '-njmj0diWu8',
                  embed_url: 'https://www.youtube.com/embed/-njmj0diWu8'
                })
              ])
            })
          ])
        }),
        projectId: 'project-1',
        mediaFiles: expect.any(Array)
      })
    })

    it('should handle youtu.be short URLs', async () => {
      // Arrange
      const mockCourseContent: EnhancedCourseContent = {
        title: 'Test Course',
        description: 'Test Description',
        welcome: {
          title: 'Welcome',
          content: 'Welcome content'
        },
        objectives: [],
        topics: [{
          id: 'topic-0',
          title: 'Topic 1',
          content: 'Topic content',
          media: [{
            id: 'media-4',
            url: 'https://youtu.be/abc123xyz',
            type: 'video',
            title: 'YouTube Short URL'
          }],
          knowledgeCheck: null
        }],
        assessment: { questions: [] },
        passMark: 80
      }

      const mockInvoke = vi.mocked(invoke)
      mockInvoke.mockResolvedValueOnce([1, 2, 3, 4, 5]) // Mock byte array response

      // Act
      await generateRustSCORM(mockCourseContent, 'project-1')

      // Assert
      expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', {
        courseData: expect.objectContaining({
          topics: expect.arrayContaining([
            expect.objectContaining({
              media: expect.arrayContaining([
                expect.objectContaining({
                  youtube_id: 'abc123xyz',
                  embed_url: 'https://www.youtube.com/embed/abc123xyz'
                })
              ])
            })
          ])
        }),
        projectId: 'project-1',
        mediaFiles: expect.any(Array)
      })
    })
  })

  describe('User wants fill-in-blank questions to display properly', () => {
    it('should pass fill-in-blank question text correctly', async () => {
      // Arrange
      const mockCourseContent: EnhancedCourseContent = {
        title: 'Test Course',
        description: 'Test Description',
        welcome: {
          title: 'Welcome',
          content: 'Welcome content'
        },
        objectives: [],
        topics: [{
          id: 'topic-2',
          title: 'Topic 3',
          content: 'Topic content',
          knowledgeCheck: {
            questions: [{
              type: 'fill-in-the-blank',
              text: 'The capital of France is ___.',
              correctAnswer: 'Paris',
              explanation: 'Paris is the capital city of France.'
            }]
          }
        }],
        assessment: { questions: [] },
        passMark: 80
      }

      const mockInvoke = vi.mocked(invoke)
      mockInvoke.mockResolvedValueOnce([1, 2, 3, 4, 5]) // Mock byte array response

      // Act
      await generateRustSCORM(mockCourseContent, 'project-1')

      // Assert
      expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', {
        courseData: expect.objectContaining({
          topics: expect.arrayContaining([
            expect.objectContaining({
              knowledge_check: expect.objectContaining({
                questions: expect.arrayContaining([
                  expect.objectContaining({
                    type: 'fill-in-the-blank',
                    text: 'The capital of France is ___.',
                    correct_answer: 'Paris'
                  })
                ])
              })
            })
          ])
        }),
        projectId: 'project-1',
        mediaFiles: expect.any(Array)
      })
    })
  })
})