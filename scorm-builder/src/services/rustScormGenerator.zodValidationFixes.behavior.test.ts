/**
 * Comprehensive Test Suite for Zod Validation Schema Fixes
 *
 * This test reproduces the exact validation errors reported by the user
 * when trying to generate a SCORM package, then verifies the fixes work.
 *
 * Original Error: "Course content validation failed" with 50+ validation errors
 * including missing welcome.id, topics without knowledgeCheck, YouTube validation issues
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { convertToRustFormat } from './rustScormGenerator'

describe('SCORM Generator Zod Validation Fixes', () => {
  let mockProjectId: string

  beforeEach(() => {
    mockProjectId = 'validation-fixes-test-project'
  })

  describe('Reproducing User Validation Errors (Should Pass After Fixes)', () => {
    it('should handle welcome page without id field', async () => {
      const courseContent = {
        title: 'Complex Projects - 1 - 49 CFR 192',
        welcome: {
          // Missing id field - this was causing validation error
          title: 'Welcome to the Course',
          content: 'Welcome to Complex Projects course',
          media: []
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Introduction',
            content: 'Topic content'
            // Missing knowledgeCheck - this was causing validation error
          }
        ]
      }

      // This should NOT throw validation errors after fixes
      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData).toBeDefined()
    })

    it('should handle topics without knowledgeCheck field', async () => {
      const courseContent = {
        title: 'Test Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic 1',
            content: 'Content 1'
            // No knowledgeCheck field at all
          },
          {
            id: 'topic-2',
            title: 'Topic 2',
            content: 'Content 2',
            knowledgeCheck: undefined // Explicitly undefined
          },
          {
            id: 'topic-3',
            title: 'Topic 3',
            content: 'Content 3',
            knowledgeCheck: {
              enabled: false
              // Missing questions array
            }
          }
        ]
      }

      // Should handle all these knowledgeCheck variations
      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(3)
    })

    it('should handle YouTube videos without youTubeVideoId field', async () => {
      const courseContent = {
        title: 'Course with YouTube',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic with YouTube',
            content: 'Content',
            media: [
              {
                id: 'youtube-1',
                type: 'youtube',
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                isYouTube: true
                // Missing youTubeVideoId - this was causing validation error
              },
              {
                id: 'youtube-2',
                type: 'youtube',
                url: 'https://youtu.be/dQw4w9WgXcQ',
                isYouTube: true
                // Also missing youTubeVideoId
              }
            ]
          }
        ]
      }

      // Should extract video ID from URL instead of requiring separate field
      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics[0].media).toBeDefined()
    })

    it('should handle assessment with missing question type fields', async () => {
      const courseContent = {
        title: 'Course with Assessment',
        topics: [],
        assessment: {
          enabled: true,
          passingScore: 80,
          questions: [
            {
              question: 'What is the correct procedure?',
              options: ['Option A', 'Option B', 'Option C'],
              correctAnswer: 1
              // Missing type field - this was causing validation error
            },
            {
              question: 'True or false: Safety is important?',
              correctAnswer: true
              // Missing type field and options for true/false
            }
          ]
        }
      }

      // Should provide default types or handle missing types gracefully
      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.assessment).toBeDefined()
    })

    it('should handle course structure similar to user error (Complex Projects)', async () => {
      // Simulate the course structure from the user's error log
      const courseContent = {
        title: 'Complex Projects - 1 - 49 CFR 192',
        description: 'Pipeline regulations course',
        welcome: {
          // No id field
          title: 'Welcome',
          content: 'Welcome to the course'
        },
        objectivesPage: {
          // No id field
          title: 'Learning Objectives',
          content: 'Course objectives'
        },
        topics: Array.from({ length: 20 }, (_, i) => ({
          id: `topic-${i + 1}`,
          title: `Topic ${i + 1}`,
          content: `Content for topic ${i + 1}`,
          media: []
          // No knowledgeCheck fields
        })),
        assessment: {
          enabled: true,
          passingScore: 80,
          questions: [
            {
              question: 'Assessment question 1',
              options: ['A', 'B', 'C'],
              correctAnswer: 0
              // Missing type
            }
          ]
        }
      }

      // This mirrors the user's failing course structure
      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(20)
      expect(result.courseData.assessment).toBeDefined()
    })

    it('should handle enhanced format with welcome using heading instead of title', async () => {
      const enhancedCourse = {
        title: 'Enhanced Course',
        welcome: {
          heading: 'Welcome to Enhanced Course', // Using heading instead of title
          content: 'Welcome content'
        },
        objectives: ['Learn A', 'Learn B'],
        topics: [
          {
            id: 'topic-1',
            heading: 'Topic Heading', // Using heading instead of title
            content: 'Content'
          }
        ]
      }

      // Should handle both title and heading field names
      const result = await convertToRustFormat(enhancedCourse, mockProjectId)
      expect(result).toBeDefined()
    })

    it('should handle media items with minimal required fields only', async () => {
      const courseContent = {
        title: 'Course with Minimal Media',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content',
            media: [
              {
                id: 'image-1',
                type: 'image'
                // Only id and type - minimal required fields
              },
              {
                id: 'video-1'
                // Missing type field
              }
            ]
          }
        ]
      }

      // Should handle minimal media items gracefully
      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
    })
  })

  describe('Validation Should Still Catch Truly Invalid Data', () => {
    it('should still reject course without title', async () => {
      const invalidCourse = {
        // Missing required title
        topics: []
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow(/title/i)
    })

    it('should still reject topics without id', async () => {
      const invalidCourse = {
        title: 'Test Course',
        topics: [
          {
            // Missing required id
            title: 'Topic',
            content: 'Content'
          }
        ]
      }

      await expect(convertToRustFormat(invalidCourse, mockProjectId))
        .rejects.toThrow(/id/i)
    })

    it('should still enforce reasonable limits', async () => {
      const hugeCourse = {
        title: 'Huge Course',
        topics: Array.from({ length: 1001 }, (_, i) => ({
          id: `topic-${i}`,
          title: `Topic ${i}`,
          content: 'Content'
        }))
      }

      await expect(convertToRustFormat(hugeCourse, mockProjectId))
        .rejects.toThrow(/too many topics/i)
    })
  })
})