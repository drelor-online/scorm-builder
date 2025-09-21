/**
 * Critical test coverage for Learning Objectives caption presence
 *
 * Tests the specific scenario where caption-1 exists in storage but not
 * in content structure, ensuring fallback logic works correctly.
 * Also tests production spam capping behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { convertToRustFormat } from './rustScormGenerator'
import type { EnhancedCourseContent } from '../types/contentTypes'

// Mock the media service to return specific media files
vi.mock('./MediaService', () => ({
  createMediaService: vi.fn(() => ({
    get: vi.fn((mediaId: string) => {
      // Simulate caption-1 and audio-1 being available in storage
      if (mediaId === 'caption-1') {
        return Promise.resolve({
          id: 'caption-1',
          name: 'objectives-caption.vtt',
          data: new Blob(['WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\nLearning objectives caption'], { type: 'text/vtt' }),
          mimeType: 'text/vtt'
        })
      }
      if (mediaId === 'audio-1') {
        return Promise.resolve({
          id: 'audio-1',
          name: 'objectives-audio.mp3',
          data: new Blob([], { type: 'audio/mpeg' }),
          mimeType: 'audio/mpeg'
        })
      }
      return Promise.resolve(null)
    }),
    listAllMedia: vi.fn(() => Promise.resolve(['caption-1', 'audio-1'])),
    store: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve())
  })),
  default: {
    get: vi.fn((projectId: string, mediaId: string) => {
      // Simulate caption-1 and audio-1 being available in storage
      if (mediaId === 'caption-1') {
        return Promise.resolve({
          id: 'caption-1',
          name: 'objectives-caption.vtt',
          data: new Blob(['WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\nLearning objectives caption'], { type: 'text/vtt' }),
          mimeType: 'text/vtt'
        })
      }
      if (mediaId === 'audio-1') {
        return Promise.resolve({
          id: 'audio-1',
          name: 'objectives-audio.mp3',
          data: new Blob([], { type: 'audio/mpeg' }),
          mimeType: 'audio/mpeg'
        })
      }
      return Promise.resolve(null)
    }),
    list: vi.fn(() => Promise.resolve(['caption-1', 'audio-1']))
  }
}))

describe('rustScormGenerator - LO Caption Presence', () => {
  let originalEnv: any

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...import.meta.env }
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore original environment
    Object.assign(import.meta.env, originalEnv)
  })

  describe('Learning Objectives Caption Fallback Integration', () => {
    it('should include caption-1 fallback when learning objectives page exists without explicit caption', async () => {
      // Arrange: Course content without caption in learningObjectivesPage
      const courseContent: EnhancedCourseContent = {
        title: 'Test Course',
        learningObjectivesPage: {
          id: 'learning-objectives',
          title: 'Learning Objectives',
          content: 'Test objectives content',
          // Note: NO captionId, captionFile, or media with caption type
        },
        welcomePage: {
          id: 'welcome',
          title: 'Welcome',
          content: 'Welcome content'
        },
        topics: [],
        assessmentPage: {
          id: 'assessment',
          title: 'Assessment',
          content: 'Assessment content'
        }
      }

      const projectId = 'test-project'

      // Mock console.log to capture fallback logging
      const consoleLogs: string[] = []
      vi.spyOn(console, 'log').mockImplementation((...args) => {
        consoleLogs.push(args.join(' '))
      })

      // Act: Convert to Rust format
      const result = await convertToRustFormat(courseContent, projectId)

      // Assert: Should include learning objectives in result
      expect(result).toContain('"learning_objectives_page"')

      // Verify fallback was triggered (should log about using caption-1 fallback)
      const fallbackLogs = consoleLogs.filter(log =>
        log.includes('caption-1') && (log.includes('fallback') || log.includes('FALLBACK'))
      )
      expect(fallbackLogs.length).toBeGreaterThan(0)

      // Verify audio-1 fallback is also working
      const audioFallbackLogs = consoleLogs.filter(log =>
        log.includes('audio-1') && (log.includes('fallback') || log.includes('FALLBACK'))
      )
      expect(audioFallbackLogs.length).toBeGreaterThan(0)
    })

    it('should prefer explicit caption reference over fallback', async () => {
      // Arrange: Course content WITH explicit caption reference
      const courseContent: EnhancedCourseContent = {
        title: 'Test Course',
        learningObjectivesPage: {
          id: 'learning-objectives',
          title: 'Learning Objectives',
          content: 'Test objectives content',
          captionId: 'custom-caption',
          media: [
            {
              id: 'custom-caption',
              type: 'caption',
              name: 'custom-objectives-caption.vtt'
            }
          ]
        },
        welcomePage: {
          id: 'welcome',
          title: 'Welcome',
          content: 'Welcome content'
        },
        topics: [],
        assessmentPage: {
          id: 'assessment',
          title: 'Assessment',
          content: 'Assessment content'
        }
      }

      const projectId = 'test-project'

      // Mock console.log to capture logging
      const consoleLogs: string[] = []
      vi.spyOn(console, 'log').mockImplementation((...args) => {
        consoleLogs.push(args.join(' '))
      })

      // Act
      const result = await convertToRustFormat(courseContent, projectId)

      // Assert: Should include learning objectives
      expect(result).toContain('"learning_objectives_page"')

      // Should NOT see fallback logs for this case (explicit caption provided)
      const fallbackLogs = consoleLogs.filter(log =>
        log.includes('caption-1') && log.includes('FALLBACK')
      )
      expect(fallbackLogs.length).toBe(0)

      // Should see explicit caption usage
      const explicitLogs = consoleLogs.filter(log =>
        log.includes('custom-caption') || log.includes('explicit caption')
      )
      expect(explicitLogs.length).toBeGreaterThan(0)
    })
  })

  describe('Production Spam Capping', () => {
    it('should cap validation output in production mode', async () => {
      // Arrange: Set environment to production
      vi.mocked(import.meta.env).DEV = false
      vi.mocked(import.meta.env).PROD = true

      // Create course content with many topics to trigger validation output
      const courseContent: EnhancedCourseContent = {
        title: 'Test Course',
        learningObjectivesPage: {
          id: 'learning-objectives',
          title: 'Learning Objectives',
          content: 'Test content'
        },
        welcomePage: {
          id: 'welcome',
          title: 'Welcome',
          content: 'Welcome content'
        },
        topics: Array.from({ length: 15 }, (_, i) => ({
          id: `topic-${i}`,
          title: `Topic ${i}`,
          content: `Topic ${i} content`
        })),
        assessmentPage: {
          id: 'assessment',
          title: 'Assessment',
          content: 'Assessment content'
        }
      }

      const projectId = 'test-project'

      // Mock console.log to capture validation output
      const consoleLogs: string[] = []
      vi.spyOn(console, 'log').mockImplementation((...args) => {
        consoleLogs.push(args.join(' '))
      })

      // Act
      await convertToRustFormat(courseContent, projectId)

      // Assert: In production, should see evidence of capping
      const cappingMessages = consoleLogs.filter(log =>
        log.includes('+') && log.includes('more') && log.includes('dev build')
      )

      // Should see capping when there are many items to list
      const longLists = consoleLogs.filter(log =>
        log.match(/^\s+(\d+)\./) && parseInt(log.match(/^\s+(\d+)\./)?.[1] || '0') > 10
      )

      // In production mode, no individual lists should exceed 10 items
      expect(longLists.length).toBe(0)
    })

    it('should show full output in development mode', async () => {
      // Arrange: Set environment to development
      vi.mocked(import.meta.env).DEV = true
      vi.mocked(import.meta.env).PROD = false

      // Create course content with many topics
      const courseContent: EnhancedCourseContent = {
        title: 'Test Course',
        learningObjectivesPage: {
          id: 'learning-objectives',
          title: 'Learning Objectives',
          content: 'Test content'
        },
        welcomePage: {
          id: 'welcome',
          title: 'Welcome',
          content: 'Welcome content'
        },
        topics: Array.from({ length: 15 }, (_, i) => ({
          id: `topic-${i}`,
          title: `Topic ${i}`,
          content: `Topic ${i} content`
        })),
        assessmentPage: {
          id: 'assessment',
          title: 'Assessment',
          content: 'Assessment content'
        }
      }

      const projectId = 'test-project'

      // Mock console.log to capture validation output
      const consoleLogs: string[] = []
      vi.spyOn(console, 'log').mockImplementation((...args) => {
        consoleLogs.push(args.join(' '))
      })

      // Act
      await convertToRustFormat(courseContent, projectId)

      // Assert: In development, should NOT see capping messages
      const cappingMessages = consoleLogs.filter(log =>
        log.includes('+') && log.includes('more') && log.includes('dev build')
      )

      expect(cappingMessages.length).toBe(0)
    })
  })
})