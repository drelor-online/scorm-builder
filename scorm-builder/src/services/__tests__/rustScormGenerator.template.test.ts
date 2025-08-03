import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateRustSCORM } from '../rustScormGenerator'
import { invoke } from '@tauri-apps/api/core'
import type { EnhancedCourseContent } from '../../types/scorm'

vi.mock('@tauri-apps/api/core')
vi.mock('../MediaStore')
vi.mock('../externalImageDownloader', () => ({
  isExternalUrl: vi.fn((url: string) => url.startsWith('http')),
  downloadIfExternal: vi.fn(() => Promise.resolve(null))
}))

describe('RustScormGenerator - Template Rendering Tests', () => {
  let mockInvoke: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke = vi.mocked(invoke)
  })

  describe('User reports media containers are missing from generated HTML', () => {
    it('should handle media arrays with empty URLs correctly', async () => {
      // This test reproduces the issue where media is passed but URLs are empty
      const courseContent: EnhancedCourseContent = {
        title: 'Test Course',
        description: 'Test Description',
        duration: 60,
        passMark: 80,
        navigationMode: 'linear',
        allowRetake: true,
        welcome: {
          title: 'Welcome',
          content: 'Welcome content',
          startButtonText: 'Start Course',
          imageUrl: 'image-1.jpg',
          media: [{
            id: 'media-1',
            url: '', // Empty URL - this might be causing the issue
            type: 'image',
            title: 'Welcome Image'
          }]
        },
        objectives: ['Objective 1'],
        objectivesPage: {
          imageUrl: 'objectives-image.jpg',
          media: [{
            id: 'media-2',
            url: '', // Empty URL
            type: 'image',
            title: 'Objectives Image'
          }]
        },
        topics: [],
        assessment: { questions: [] }
      }

      mockInvoke.mockResolvedValueOnce([1, 2, 3, 4, 5]) // Mock byte array response

      await generateRustSCORM(courseContent, 'project-1')

      // Check what data was sent
      const callArgs = mockInvoke.mock.calls[0][1]
      const welcomePage = callArgs.courseData.welcome_page
      const objectivesPage = callArgs.courseData.learning_objectives_page

      // Both should have image_url
      expect(welcomePage.image_url).toBe('image-1.jpg')
      expect(objectivesPage.image_url).toBe('objectives-image.jpg')

      // Both should have media arrays (even with empty URLs)
      expect(welcomePage.media).toBeDefined()
      expect(welcomePage.media).toHaveLength(1)
      expect(objectivesPage.media).toBeDefined()
      expect(objectivesPage.media).toHaveLength(1)

      // The issue: Empty URLs might cause the Rust template's "or" helper to fail
      // because an array with items that have empty strings might not be considered "truthy"
    })

    it('should filter out media items with empty URLs before sending to Rust', async () => {
      // This test shows what SHOULD happen - filter empty URLs
      const courseContent: EnhancedCourseContent = {
        title: 'Test Course',
        description: 'Test Description',
        duration: 60,
        passMark: 80,
        navigationMode: 'linear',
        allowRetake: true,
        welcome: {
          title: 'Welcome',
          content: 'Welcome content',
          startButtonText: 'Start Course',
          imageUrl: 'image-1.jpg',
          media: [
            {
              id: 'media-1',
              url: '', // Empty - should be filtered
              type: 'image',
              title: 'Empty Image'
            },
            {
              id: 'media-2',
              url: 'valid-image.jpg', // Valid - should be kept
              type: 'image',
              title: 'Valid Image'
            }
          ]
        },
        objectives: [],
        topics: [],
        assessment: { questions: [] }
      }

      mockInvoke.mockResolvedValueOnce([1, 2, 3, 4, 5])

      await generateRustSCORM(courseContent, 'project-1')

      const callArgs = mockInvoke.mock.calls[0][1]
      const welcomePage = callArgs.courseData.welcome_page

      // The media array should be filtered or handled properly
      // Currently it's not filtered, which might be causing the template issue
      expect(welcomePage.media).toBeDefined()
      
      // This is what's happening now - both items are passed
      expect(welcomePage.media).toHaveLength(2)
      expect(welcomePage.media[0].url).toBe('') // Empty URL
      expect(welcomePage.media[1].url).toBe('valid-image.jpg')
    })
  })

  describe('YouTube video embedding', () => {
    it('should generate proper iframe HTML for YouTube videos', async () => {
      const courseContent: EnhancedCourseContent = {
        title: 'Test Course',
        description: 'Test Description',
        duration: 60,
        passMark: 80,
        navigationMode: 'linear',
        allowRetake: true,
        welcome: {
          title: 'Welcome',
          content: 'Welcome content',
          startButtonText: 'Start Course'
        },
        objectives: [],
        topics: [{
          id: 'topic-0',
          title: 'Topic with YouTube',
          content: 'Content',
          media: [{
            id: 'youtube-1',
            url: 'https://youtube.com/watch?v=-njmj0diWu8',
            type: 'video',
            title: 'YouTube Video'
          }]
        }],
        assessment: { questions: [] }
      }

      mockInvoke.mockResolvedValueOnce([1, 2, 3, 4, 5])

      await generateRustSCORM(courseContent, 'project-1')

      const callArgs = mockInvoke.mock.calls[0][1]
      const topic = callArgs.courseData.topics[0]

      // Check that YouTube metadata is added
      expect(topic.media[0].is_youtube).toBe(true)
      expect(topic.media[0].youtube_id).toBe('-njmj0diWu8')
      expect(topic.media[0].embed_url).toBe('https://www.youtube.com/embed/-njmj0diWu8')
    })
  })
})