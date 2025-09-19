/**
 * Comprehensive Zod Runtime Validation Test Suite for SCORM Generator
 *
 * Tests the runtime validation schemas to ensure malformed data is caught
 * before processing, preventing runtime errors and security vulnerabilities.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { convertToRustFormat } from './rustScormGenerator'

describe('SCORM Generator Zod Runtime Validation', () => {
  let mockProjectId: string

  beforeEach(() => {
    mockProjectId = 'zod-validation-test-project'
  })

  describe('Course Content Structure Validation', () => {
    it('should reject course content with missing title', async () => {
      const invalidCourse = {
        // Missing required title
        topics: []
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow('Course content validation failed')
    })

    it('should reject course content with title too long', async () => {
      const invalidCourse = {
        title: 'A'.repeat(300), // Exceeds 200 character limit
        topics: []
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow(/Course content validation failed.*Title too long/)
    })

    it('should reject course with too many topics', async () => {
      const invalidCourse = {
        title: 'Test Course',
        topics: Array.from({ length: 1001 }, (_, i) => ({
          id: `topic-${i}`,
          title: `Topic ${i}`,
          content: 'Content'
        }))
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow(/Course content validation failed.*Too many topics/)
    })
  })

  describe('Topic Validation', () => {
    it('should reject topics with missing required fields', async () => {
      const invalidCourse = {
        title: 'Test Course',
        topics: [
          {
            // Missing id, title, content
            media: []
          }
        ]
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow('Course content validation failed')
    })

    it('should reject topics with content too long', async () => {
      const invalidCourse = {
        title: 'Test Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'A'.repeat(200000) // Exceeds 100k limit
          }
        ]
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow(/Course content validation failed.*content too long/i)
    })

    it('should reject topics with too many media items', async () => {
      const invalidCourse = {
        title: 'Test Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content',
            media: Array.from({ length: 101 }, (_, i) => ({
              id: `media-${i}`,
              type: 'image'
            }))
          }
        ]
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow(/Course content validation failed.*Too many media items/)
    })
  })

  describe('Media Item Validation', () => {
    it('should reject media items with missing ID', async () => {
      const invalidCourse = {
        title: 'Test Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content',
            media: [
              {
                // Missing required id
                type: 'image',
                url: 'http://example.com/image.jpg'
              }
            ]
          }
        ]
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow('Course content validation failed')
    })

    it('should reject YouTube media without video ID or URL', async () => {
      const invalidCourse = {
        title: 'Test Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content',
            media: [
              {
                id: 'youtube-1',
                type: 'youtube',
                isYouTube: true
                // Missing both youTubeVideoId AND url
              }
            ]
          }
        ]
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow(/Course content validation failed.*YouTube videos must have either a video ID or URL/)
    })

    it('should reject media with invalid dimensions', async () => {
      const invalidCourse = {
        title: 'Test Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content',
            media: [
              {
                id: 'image-1',
                type: 'image',
                width: 10000, // Exceeds 4096 limit
                height: 10000
              }
            ]
          }
        ]
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow(/Course content validation failed/)
    })
  })

  describe('Knowledge Check Question Validation', () => {
    it('should reject questions with missing text', async () => {
      const invalidCourse = {
        title: 'Test Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content',
            knowledgeCheck: {
              enabled: true,
              questions: [
                {
                  // Missing question text
                  type: 'multiple-choice',
                  options: ['A', 'B', 'C'],
                  correctAnswer: 0
                }
              ]
            }
          }
        ]
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow('Course content validation failed')
    })

    it('should reject multiple-choice questions without options', async () => {
      const invalidCourse = {
        title: 'Test Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content',
            knowledgeCheck: {
              enabled: true,
              questions: [
                {
                  question: 'What is the answer?',
                  type: 'multiple-choice',
                  // Missing options array
                  correctAnswer: 0
                }
              ]
            }
          }
        ]
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow(/Course content validation failed.*Invalid question configuration/)
    })

    it('should reject multiple-choice questions with invalid correctAnswer index', async () => {
      const invalidCourse = {
        title: 'Test Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content',
            knowledgeCheck: {
              enabled: true,
              questions: [
                {
                  question: 'What is the answer?',
                  type: 'multiple-choice',
                  options: ['A', 'B'], // Only 2 options
                  correctAnswer: 5 // Invalid index
                }
              ]
            }
          }
        ]
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow(/Course content validation failed.*Invalid question configuration/)
    })

    it('should accept true-false questions with convertible correctAnswer values', async () => {
      const validCourse = {
        title: 'Test Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content',
            knowledgeCheck: {
              enabled: true,
              questions: [
                {
                  question: 'True or false?',
                  type: 'true-false',
                  correctAnswer: 'true' // Should be convertible to boolean
                }
              ]
            }
          }
        ]
      }

      // Should now accept convertible values like 'true', 'false', 1, 0
      const result = await convertToRustFormat(validCourse, mockProjectId)
      expect(result).toBeDefined()
    })

    it('should reject knowledge checks with too many questions', async () => {
      const invalidCourse = {
        title: 'Test Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content',
            knowledgeCheck: {
              enabled: true,
              questions: Array.from({ length: 51 }, (_, i) => ({
                question: `Question ${i}?`,
                type: 'multiple-choice',
                options: ['A', 'B', 'C'],
                correctAnswer: 0
              }))
            }
          }
        ]
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow(/Course content validation failed.*Too many questions/)
    })
  })

  describe('Assessment Validation', () => {
    it('should reject assessment with invalid passing score', async () => {
      const invalidCourse = {
        title: 'Test Course',
        topics: [],
        assessment: {
          enabled: true,
          passingScore: 150, // Exceeds 100% limit
          questions: []
        }
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow(/Course content validation failed/)
    })

    it('should reject assessment with too many questions', async () => {
      const invalidCourse = {
        title: 'Test Course',
        topics: [],
        assessment: {
          enabled: true,
          passingScore: 80,
          questions: Array.from({ length: 201 }, (_, i) => ({
            question: `Assessment Question ${i}?`,
            type: 'multiple-choice',
            options: ['A', 'B', 'C'],
            correctAnswer: 0
          }))
        }
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow(/Course content validation failed.*Too many assessment questions/)
    })
  })

  describe('Course Settings Validation', () => {
    it('should reject course settings with invalid time limits', async () => {
      const validCourse = {
        title: 'Test Course',
        topics: []
      }

      const invalidSettings = {
        timeLimit: 100000, // Exceeds 24 hour limit (86400)
        sessionTimeout: 2, // Below 5 minute minimum
        passMark: 150 // Exceeds 100%
      }

      await expect(convertToRustFormat(validCourse, mockProjectId, invalidSettings))
        .rejects.toThrow(/Course settings validation failed/)
    })

    it('should reject course settings with invalid attempt limits', async () => {
      const validCourse = {
        title: 'Test Course',
        topics: []
      }

      const invalidSettings = {
        maxAttempts: 15 // Exceeds 10 attempt limit
      }

      await expect(convertToRustFormat(validCourse, mockProjectId, invalidSettings))
        .rejects.toThrow(/Course settings validation failed/)
    })
  })

  describe('Valid Data Should Pass', () => {
    it('should accept valid standard course content', async () => {
      const validCourse = {
        title: 'Valid Test Course',
        description: 'A valid course for testing',
        welcome: {
          id: 'welcome',
          title: 'Welcome',
          content: 'Welcome to the course'
        },
        objectivesPage: {
          id: 'objectives',
          title: 'Learning Objectives',
          content: 'Course objectives'
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Valid Topic',
            content: 'Topic content',
            media: [
              {
                id: 'media-1',
                type: 'image',
                url: 'http://example.com/image.jpg'
              }
            ],
            knowledgeCheck: {
              enabled: true,
              questions: [
                {
                  question: 'What is 2+2?',
                  type: 'multiple-choice',
                  options: ['3', '4', '5'],
                  correctAnswer: 1
                }
              ]
            }
          }
        ],
        assessment: {
          enabled: true,
          passingScore: 80,
          questions: [
            {
              question: 'Final question?',
              type: 'true-false',
              correctAnswer: true
            }
          ]
        }
      }

      const validSettings = {
        timeLimit: 3600, // 1 hour
        sessionTimeout: 30, // 30 minutes
        passMark: 70,
        showProgress: true,
        showOutline: true
      }

      // Should not throw any validation errors
      const result = await convertToRustFormat(validCourse, mockProjectId, validSettings)
      expect(result).toBeDefined()
      expect(result.courseData).toBeDefined()
    })

    it('should accept valid enhanced course content', async () => {
      const validEnhancedCourse = {
        title: 'Valid Enhanced Course',
        welcome: {
          id: 'welcome',
          title: 'Welcome',
          content: 'Welcome content'
        },
        objectives: [
          'Objective 1',
          'Objective 2'
        ],
        topics: [
          {
            id: 'topic-1',
            title: 'Enhanced Topic',
            content: 'Enhanced topic content'
          }
        ]
      }

      // Should not throw any validation errors
      const result = await convertToRustFormat(validEnhancedCourse, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData).toBeDefined()
    })
  })
})