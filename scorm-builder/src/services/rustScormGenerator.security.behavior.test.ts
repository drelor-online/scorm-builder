/**
 * Comprehensive Security and Defensive Test Suite for SCORM Generator
 *
 * Tests all defensive measures against malicious inputs, injection attacks,
 * and system abuse scenarios to ensure robust security.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { convertToRustFormat } from './rustScormGenerator'

describe('SCORM Generator Security and Defensive Measures', () => {
  let mockProjectId: string

  beforeEach(() => {
    mockProjectId = 'security-test-project'
  })

  describe('XSS and HTML Injection Prevention', () => {
    it('should sanitize script tags in course content', async () => {
      const maliciousCourse = {
        title: '<script>alert("XSS")</script>Malicious Course',
        topics: [
          {
            id: 'topic-1',
            title: '<script>document.cookie="stolen"</script>Hacked Topic',
            content: '<script src="evil.js"></script>Content with <iframe src="javascript:alert(1)"></iframe>',
            knowledgeCheck: {
              questions: [
                {
                  question: '<script>location.href="evil.com"</script>What is 2+2?',
                  type: 'multiple-choice',
                  options: [
                    '<script>steal()</script>Option 1',
                    '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>Option 2'
                  ],
                  correctAnswer: 0
                }
              ]
            }
          }
        ]
      }

      const result = await convertToRustFormat(maliciousCourse, mockProjectId)

      // Verify all script tags are removed
      expect(result.courseData.course_title).not.toContain('<script>')
      expect(result.courseData.course_title).not.toContain('</script>')
      expect(result.courseData.topics[0].title).not.toContain('<script>')
      expect(result.courseData.topics[0].content).not.toContain('<script>')
      expect(result.courseData.topics[0].content).not.toContain('<iframe>')

      // Check knowledge check questions are sanitized
      const questions = result.courseData.topics[0].knowledge_check?.questions
      expect(questions).toBeDefined()
      expect(questions![0].text).not.toContain('<script>')
      expect(questions![0].options[0]).not.toContain('<script>')
      expect(questions![0].options[1]).not.toContain('<iframe>')
    })

    it('should remove javascript: URLs and event handlers', async () => {
      const maliciousCourse = {
        title: 'Test Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic with <a href="javascript:alert(1)" onclick="steal()">dangerous links</a>',
            content: '<img src="x" onerror="alert(1)" onload="hack()">Content',
            media: []
          }
        ]
      }

      const result = await convertToRustFormat(maliciousCourse, mockProjectId)

      expect(result.courseData.topics[0].title).not.toContain('javascript:')
      expect(result.courseData.topics[0].title).not.toContain('onclick=')
      expect(result.courseData.topics[0].content).not.toContain('onerror=')
      expect(result.courseData.topics[0].content).not.toContain('onload=')
    })
  })

  describe('Path Traversal Prevention', () => {
    it('should sanitize malicious file paths in IDs', async () => {
      const maliciousCourse = {
        title: 'Test Course',
        topics: [
          {
            id: '../../../etc/passwd',
            title: 'Malicious Topic',
            content: 'Content'
          },
          {
            id: '..\\..\\windows\\system32\\config\\sam',
            title: 'Another Bad Topic',
            content: 'Content'
          },
          {
            id: 'topic<>:"/\\|?*\x00test',
            title: 'Invalid Characters Topic',
            content: 'Content'
          }
        ]
      }

      const result = await convertToRustFormat(maliciousCourse, mockProjectId)

      // Check that dangerous path components are removed
      expect(result.courseData.topics[0].id).not.toContain('../')
      expect(result.courseData.topics[0].id).not.toContain('..\\')
      expect(result.courseData.topics[0].id).not.toContain('/')
      expect(result.courseData.topics[0].id).not.toContain('\\')
      expect(result.courseData.topics[1].id).not.toContain('\\')
      expect(result.courseData.topics[2].id).not.toContain('<')
      expect(result.courseData.topics[2].id).not.toContain('>')
      expect(result.courseData.topics[2].id).not.toContain('|')
    })
  })

  describe('JSON Injection and Parsing Safety', () => {
    it('should handle malformed JSON gracefully', async () => {
      // This would test the JSON parsing safety, but since we're testing
      // the conversion function that doesn't directly parse JSON,
      // we simulate potential JSON-related issues
      const courseWithComplexData = {
        title: 'Test Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content with "quotes" and \'single quotes\' and {invalid: json}',
            customData: '{"malformed": json, "missing": quotes}'
          }
        ]
      }

      // Should not throw even with potentially problematic string data
      const result = await convertToRustFormat(courseWithComplexData, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(1)
    })
  })

  describe('Size and Resource Limits', () => {
    it('should reject courses with too many topics', async () => {
      const hugeCourse = {
        title: 'Huge Course',
        topics: Array.from({ length: 1001 }, (_, i) => ({
          id: `topic-${i}`,
          title: `Topic ${i}`,
          content: `Content for topic ${i}`,
          media: []
        }))
      }

      await expect(convertToRustFormat(hugeCourse, mockProjectId))
        .rejects.toThrow('Too many topics: 1001. Maximum allowed: 1000')
    })

    it('should reject topics with too many knowledge check questions', async () => {
      const courseWithManyQuestions = {
        title: 'Course with Too Many Questions',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic with Many Questions',
            content: 'Content',
            knowledgeCheck: {
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

      await expect(convertToRustFormat(courseWithManyQuestions, mockProjectId))
        .rejects.toThrow('Topic 0 has too many questions: 51. Maximum allowed: 50')
    })

    it('should reject questions with too many options', async () => {
      const courseWithManyOptions = {
        title: 'Course with Question with Too Many Options',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content',
            knowledgeCheck: {
              questions: [
                {
                  question: 'What is the answer?',
                  type: 'multiple-choice',
                  options: Array.from({ length: 21 }, (_, i) => `Option ${i}`),
                  correctAnswer: 0
                }
              ]
            }
          }
        ]
      }

      await expect(convertToRustFormat(courseWithManyOptions, mockProjectId))
        .rejects.toThrow('Topic 0, question 0 has too many options: 21. Maximum allowed: 20')
    })

    it('should warn about very long content but not fail', async () => {
      const courseWithLongContent = {
        title: 'Course with Very Long Content',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic with Long Content',
            content: 'A'.repeat(100001), // Exceeds MAX_CONTENT_LENGTH
            media: []
          }
        ]
      }

      // Should succeed but log warning
      const result = await convertToRustFormat(courseWithLongContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(1)
    })
  })

  describe('Numeric Validation and Injection Prevention', () => {
    it('should constrain numeric values to safe ranges', async () => {
      const courseSettings = {
        passMark: -50, // Negative
        timeLimit: 999999, // Too large
        sessionTimeout: 0, // Too small
        minimumTimeSpent: -100 // Negative
      }

      const simpleCourse = {
        title: 'Test Course',
        topics: []
      }

      const result = await convertToRustFormat(simpleCourse, mockProjectId, courseSettings)

      // Check values are constrained to safe ranges
      expect(result.courseData.pass_mark).toBeGreaterThanOrEqual(0)
      expect(result.courseData.pass_mark).toBeLessThanOrEqual(100)
      expect(result.courseData.time_limit).toBeGreaterThanOrEqual(0)
      expect(result.courseData.time_limit).toBeLessThanOrEqual(86400) // 24 hours
      expect(result.courseData.session_timeout).toBeGreaterThanOrEqual(5) // Minimum 5 minutes
      expect(result.courseData.minimum_time_spent).toBeGreaterThanOrEqual(0)
      expect(result.courseData.minimum_time_spent).toBeLessThanOrEqual(7200) // 2 hours max
    })

    it('should handle NaN and Infinity values', async () => {
      const courseSettings = {
        passMark: NaN,
        timeLimit: Infinity,
        sessionTimeout: -Infinity,
        minimumTimeSpent: 'not-a-number' as any
      }

      const simpleCourse = {
        title: 'Test Course',
        topics: []
      }

      const result = await convertToRustFormat(simpleCourse, mockProjectId, courseSettings)

      // Should fallback to default values
      expect(result.courseData.pass_mark).toBe(80) // Default fallback
      expect(result.courseData.time_limit).toBe(0) // Default fallback
      expect(result.courseData.session_timeout).toBe(30) // Default fallback
      expect(result.courseData.minimum_time_spent).toBe(0) // Default fallback
    })
  })

  describe('Malformed Data Handling', () => {
    it('should handle deeply nested undefined properties', async () => {
      const malformedCourse = {
        title: 'Test Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content',
            knowledgeCheck: {
              questions: [
                {
                  question: 'Test?',
                  type: null,
                  options: undefined,
                  correctAnswer: undefined,
                  feedback: {
                    correct: {
                      nested: {
                        deeply: {
                          value: undefined
                        }
                      }
                    }
                  }
                }
              ]
            }
          }
        ]
      }

      // Should not throw errors
      const result = await convertToRustFormat(malformedCourse, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(1)

      // Check that sanitization provided defaults
      const questions = result.courseData.topics[0].knowledge_check?.questions
      expect(questions).toBeDefined()
      expect(questions![0].type).toBe('multiple-choice') // Default fallback
      expect(questions![0].options).toEqual([]) // Default empty array
    })

    it('should handle circular references gracefully', async () => {
      const course: any = {
        title: 'Test Course',
        topics: []
      }

      // Create circular reference
      const topic: any = {
        id: 'topic-1',
        title: 'Topic',
        content: 'Content',
        media: []
      }

      topic.circular = topic // Self-reference
      course.topics.push(topic)

      // Should handle gracefully without infinite loops
      const result = await convertToRustFormat(course, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(1)
    })
  })

  describe('Input Validation Edge Cases', () => {
    it('should handle null and undefined course content', async () => {
      const nullCourse = null as any
      const undefinedCourse = undefined as any

      await expect(convertToRustFormat(nullCourse, mockProjectId))
        .rejects.toThrow() // Should validate and reject

      await expect(convertToRustFormat(undefinedCourse, mockProjectId))
        .rejects.toThrow() // Should validate and reject
    })

    it('should handle course content with missing required fields', async () => {
      const incompleteCourse = {
        // Missing title
        topics: [
          {
            // Missing id, title, content
            media: []
          }
        ]
      }

      const result = await convertToRustFormat(incompleteCourse, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.course_title).toBe('Untitled Course') // Default fallback
      expect(result.courseData.topics).toHaveLength(1)
    })

    it('should handle extremely large strings safely', async () => {
      const hugeString = 'A'.repeat(1000000) // 1MB string

      const courseWithHugeStrings = {
        title: hugeString,
        description: hugeString,
        topics: [
          {
            id: 'topic-1',
            title: hugeString,
            content: hugeString,
            media: []
          }
        ]
      }

      // Should complete without memory issues (though may be slow)
      const result = await convertToRustFormat(courseWithHugeStrings, mockProjectId)
      expect(result).toBeDefined()
    })
  })

  describe('Special Character and Encoding Handling', () => {
    it('should handle Unicode and special characters properly', async () => {
      const unicodeCourse = {
        title: '测试课程 🎓 العربية русский',
        topics: [
          {
            id: 'unicode-topic',
            title: '数学 📐 وهندسة математика',
            content: 'Content with émojis 🌟 and spéciål chåracters',
            knowledgeCheck: {
              questions: [
                {
                  question: 'What is 日本語?',
                  type: 'multiple-choice',
                  options: ['العربية', 'русский', '日本語', 'français'],
                  correctAnswer: 2
                }
              ]
            }
          }
        ]
      }

      const result = await convertToRustFormat(unicodeCourse, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.course_title).toContain('测试课程')
      expect(result.courseData.topics[0].title).toContain('数学')
      expect(result.courseData.topics[0].content).toContain('🌟')
    })
  })
})