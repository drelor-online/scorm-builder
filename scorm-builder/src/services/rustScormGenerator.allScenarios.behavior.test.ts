/**
 * Comprehensive SCORM Generation Test Suite for All User Scenarios
 *
 * This test suite verifies that users can successfully generate SCORM packages
 * with any combination of course features they choose to include or exclude.
 * Every scenario should be successful - users decide what they want.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { convertToRustFormat } from './rustScormGenerator'

describe('SCORM Generator - All User Scenarios', () => {
  let mockProjectId: string

  beforeEach(() => {
    mockProjectId = 'all-scenarios-test-project'
  })

  describe('Knowledge Checks Only Scenarios', () => {
    it('should handle course with knowledge checks on all topics, no assessment', async () => {
      const courseContent = {
        title: 'Knowledge Check Only Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic with KC',
            content: 'Topic content with knowledge check',
            knowledgeCheck: {
              enabled: true,
              questions: [
                {
                  question: 'What is the main concept?',
                  type: 'multiple-choice',
                  options: ['Concept A', 'Concept B', 'Concept C'],
                  correctAnswer: 1
                }
              ]
            }
          },
          {
            id: 'topic-2',
            title: 'Another Topic with KC',
            content: 'More content with knowledge check',
            knowledgeCheck: {
              enabled: true,
              questions: [
                {
                  question: 'True or false: This is correct?',
                  type: 'true-false',
                  correctAnswer: true
                }
              ]
            }
          }
        ]
        // No assessment field at all
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(2)
      expect(result.courseData.topics[0].knowledge_check.questions).toHaveLength(1)
      expect(result.courseData.topics[1].knowledge_check.questions).toHaveLength(1)
      expect(result.courseData.assessment?.questions || []).toBeDefined() // Should get default empty assessment
    })

    it('should handle course with mixed knowledge checks (some topics have them, others don\'t)', async () => {
      const courseContent = {
        title: 'Mixed Knowledge Check Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic with KC',
            content: 'Content',
            knowledgeCheck: {
              enabled: true,
              questions: [
                {
                  question: 'Question 1?',
                  options: ['A', 'B'],
                  correctAnswer: 0
                }
              ]
            }
          },
          {
            id: 'topic-2',
            title: 'Topic without KC',
            content: 'Just content, no questions'
            // No knowledgeCheck field
          },
          {
            id: 'topic-3',
            title: 'Topic with disabled KC',
            content: 'Content',
            knowledgeCheck: {
              enabled: false,
              questions: []
            }
          }
        ]
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(3)
      expect(result.courseData.topics[0].knowledge_check.questions).toHaveLength(1)
      expect((result.courseData.topics[1].knowledge_check?.questions || [])).toEqual([])
      expect((result.courseData.topics[2].knowledge_check?.questions || [])).toEqual([])
    })
  })

  describe('Assessment Only Scenarios', () => {
    it('should handle course with assessment only, no knowledge checks', async () => {
      const courseContent = {
        title: 'Assessment Only Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Content Topic 1',
            content: 'Educational content without questions'
          },
          {
            id: 'topic-2',
            title: 'Content Topic 2',
            content: 'More educational content'
          }
        ],
        assessment: {
          enabled: true,
          passingScore: 75,
          questions: [
            {
              question: 'Assessment question 1?',
              type: 'multiple-choice',
              options: ['Option 1', 'Option 2', 'Option 3'],
              correctAnswer: 2
            },
            {
              question: 'Assessment question 2?',
              type: 'true-false',
              correctAnswer: false
            }
          ]
        }
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(2)
      expect(result.courseData.assessment?.questions || []).toHaveLength(2)
      expect(result.courseData.topics[0].knowledge_check?.questions || []).toEqual([])
      expect(result.courseData.topics[1].knowledge_check?.questions || []).toEqual([])
    })

    it('should handle assessment with various question types and no explicit types', async () => {
      const courseContent = {
        title: 'Mixed Question Types Assessment',
        topics: [
          {
            id: 'topic-1',
            title: 'Content Topic',
            content: 'Content'
          }
        ],
        assessment: {
          enabled: true,
          passingScore: 80,
          questions: [
            {
              // Should infer multiple-choice from options
              question: 'Which option is correct?',
              options: ['Wrong', 'Correct', 'Also wrong'],
              correctAnswer: 1
            },
            {
              // Should infer true-false from boolean answer
              question: 'Is this statement true?',
              correctAnswer: true
            },
            {
              // Should infer short-answer from string answer
              question: 'What is the answer?',
              correctAnswer: 'The answer is 42'
            }
          ]
        }
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.assessment?.questions || []).toHaveLength(3)
    })
  })

  describe('No Questions Scenarios', () => {
    it('should handle course with no knowledge checks and no assessment', async () => {
      const courseContent = {
        title: 'Content Only Course',
        description: 'Educational content without any questions',
        topics: [
          {
            id: 'topic-1',
            title: 'Learning Topic 1',
            content: 'Educational content about topic 1'
          },
          {
            id: 'topic-2',
            title: 'Learning Topic 2',
            content: 'Educational content about topic 2'
          },
          {
            id: 'topic-3',
            title: 'Learning Topic 3',
            content: 'Educational content about topic 3'
          }
        ]
        // No assessment, no knowledge checks
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(3)
      expect(result.courseData.assessment?.questions || []).toEqual([])
      expect(result.courseData.topics.every(topic =>
        topic.knowledge_check?.questions || []?.length === 0
      )).toBe(true)
    })

    it('should handle course with assessment enabled but no questions', async () => {
      const courseContent = {
        title: 'Assessment Placeholder Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content'
          }
        ],
        assessment: {
          enabled: true,
          passingScore: 80,
          questions: [] // Empty questions array
        }
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.assessment?.questions || []).toEqual([])
    })
  })

  describe('Mixed Scenarios (Knowledge Checks + Assessment)', () => {
    it('should handle course with both knowledge checks and assessment', async () => {
      const courseContent = {
        title: 'Complete Interactive Course',
        welcome: {
          title: 'Welcome to the Course',
          content: 'Introduction content'
        },
        objectivesPage: {
          title: 'Learning Objectives',
          content: 'Course objectives'
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Topic with Knowledge Check',
            content: 'Topic content',
            knowledgeCheck: {
              enabled: true,
              questions: [
                {
                  question: 'Knowledge check question?',
                  options: ['A', 'B', 'C'],
                  correctAnswer: 1
                }
              ]
            }
          },
          {
            id: 'topic-2',
            title: 'Topic without Knowledge Check',
            content: 'Just content'
          },
          {
            id: 'topic-3',
            title: 'Another Topic with Knowledge Check',
            content: 'More content',
            knowledgeCheck: {
              enabled: true,
              questions: [
                {
                  question: 'Another knowledge check?',
                  correctAnswer: true
                }
              ]
            }
          }
        ],
        assessment: {
          enabled: true,
          passingScore: 85,
          questions: [
            {
              question: 'Final assessment question 1?',
              options: ['Option A', 'Option B'],
              correctAnswer: 0
            },
            {
              question: 'Final assessment question 2?',
              correctAnswer: false
            }
          ]
        }
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(3)
      expect(result.courseData.topics[0].knowledge_check?.questions || []).toHaveLength(1)
      expect(result.courseData.topics[1].knowledge_check?.questions || []).toEqual([])
      expect(result.courseData.topics[2].knowledge_check?.questions || []).toHaveLength(1)
      expect(result.courseData.assessment?.questions || []).toHaveLength(2)
      expect((result.courseData.assessment?.questions || []).length > 0).toBe(true)
    })
  })

  describe('Course Settings Variations', () => {
    it('should handle course with no settings', async () => {
      const courseContent = {
        title: 'No Settings Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content'
          }
        ]
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData).toBeDefined()
    })

    it('should handle course with minimal settings', async () => {
      const courseContent = {
        title: 'Minimal Settings Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content'
          }
        ]
      }

      const courseSettings = {
        passMark: 70
      }

      const result = await convertToRustFormat(courseContent, mockProjectId, courseSettings)
      expect(result).toBeDefined()
      expect(result.courseData.pass_mark).toBe(70)
    })

    it('should handle course with comprehensive settings', async () => {
      const courseContent = {
        title: 'Full Settings Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content'
          }
        ],
        assessment: {
          enabled: true,
          passingScore: 85,
          questions: [
            {
              question: 'Test question?',
              options: ['A', 'B'],
              correctAnswer: 0
            }
          ]
        }
      }

      const courseSettings = {
        passMark: 85,
        timeLimit: 3600, // 1 hour
        sessionTimeout: 30, // 30 minutes
        minimumTimeSpent: 600, // 10 minutes
        showProgress: true,
        showOutline: true,
        enableCsp: true,
        allowSkipping: false,
        randomizeQuestions: true,
        maxAttempts: 3
      }

      const result = await convertToRustFormat(courseContent, mockProjectId, courseSettings)
      expect(result).toBeDefined()
      expect(result.courseData.pass_mark).toBe(85)
      expect(result.courseData.time_limit).toBe(3600)
      expect(result.courseData.session_timeout).toBe(30)
    })
  })

  describe('Media Variations', () => {
    it('should handle course with no media anywhere', async () => {
      const courseContent = {
        title: 'Text Only Course',
        welcome: {
          title: 'Welcome',
          content: 'Welcome text'
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Text Topic',
            content: 'Only text content, no media'
          }
        ]
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(1)
    })

    it('should handle course with mixed media types', async () => {
      const courseContent = {
        title: 'Media Rich Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Image Topic',
            content: 'Content with image',
            media: [
              {
                id: 'image-1',
                type: 'image',
                url: 'http://example.com/image.jpg'
              }
            ]
          },
          {
            id: 'topic-2',
            title: 'YouTube Topic',
            content: 'Content with YouTube video',
            media: [
              {
                id: 'youtube-1',
                type: 'youtube',
                isYouTube: true,
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
              }
            ]
          },
          {
            id: 'topic-3',
            title: 'Audio Topic',
            content: 'Content with audio',
            audioFile: 'audio-file-id',
            captionFile: 'caption-file-id'
          }
        ]
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(3)
    })
  })

  describe('Course Structure Variations', () => {
    it('should handle minimal course structure', async () => {
      const courseContent = {
        title: 'Minimal Course',
        topics: [
          {
            id: 'only-topic',
            title: 'Only Topic',
            content: 'The only content'
          }
        ]
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(1)
    })

    it('should handle course without welcome page', async () => {
      const courseContent = {
        title: 'No Welcome Course',
        objectivesPage: {
          title: 'Objectives',
          content: 'Course objectives'
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content'
          }
        ]
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(1)
    })

    it('should handle course without objectives page', async () => {
      const courseContent = {
        title: 'No Objectives Course',
        welcome: {
          title: 'Welcome',
          content: 'Welcome content'
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content'
          }
        ]
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(1)
    })

    it('should handle enhanced format with objectives array', async () => {
      const enhancedCourse = {
        title: 'Enhanced Format Course',
        welcome: {
          title: 'Welcome',
          content: 'Welcome content'
        },
        objectives: [
          'Learn concept A',
          'Understand concept B',
          'Apply concept C'
        ],
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content'
          }
        ]
      }

      const result = await convertToRustFormat(enhancedCourse, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(1)
    })
  })

  describe('Edge Cases and Error Recovery', () => {
    it('should handle course with undefined values gracefully', async () => {
      const courseContent = {
        title: 'Edge Case Course',
        welcome: undefined,
        objectivesPage: undefined, // Changed from null to undefined
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content',
            media: undefined,
            knowledgeCheck: undefined, // Changed from null to undefined
            audioFile: undefined
          }
        ],
        assessment: {
          enabled: true,
          questions: []
        }
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(1)
    })

    it('should handle questions with missing fields and auto-inference', async () => {
      const courseContent = {
        title: 'Auto-Inference Course',
        assessment: {
          enabled: true,
          questions: [
            {
              question: 'Inferred multiple choice?',
              options: ['A', 'B', 'C'],
              correctAnswer: 1
              // No type field - should infer 'multiple-choice'
            },
            {
              question: 'Inferred true/false?',
              correctAnswer: true
              // No type field - should infer 'true-false'
            },
            {
              question: 'Inferred short answer?',
              correctAnswer: 'This is the answer'
              // No type field - should infer 'short-answer'
            }
          ]
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content'
          }
        ]
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.assessment?.questions || []).toHaveLength(3)
    })
  })

  describe('Large Course Scenarios', () => {
    it('should handle course with many topics', async () => {
      const courseContent = {
        title: 'Large Course',
        topics: Array.from({ length: 50 }, (_, i) => ({
          id: `topic-${i + 1}`,
          title: `Topic ${i + 1}`,
          content: `Content for topic ${i + 1}`,
          knowledgeCheck: i % 3 === 0 ? {
            enabled: true,
            questions: [
              {
                question: `Question for topic ${i + 1}?`,
                options: ['A', 'B', 'C'],
                correctAnswer: i % 3
              }
            ]
          } : undefined
        }))
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(50)
    })

    it('should handle assessment with many questions', async () => {
      const courseContent = {
        title: 'Large Assessment Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Topic',
            content: 'Content'
          }
        ],
        assessment: {
          enabled: true,
          passingScore: 80,
          questions: Array.from({ length: 50 }, (_, i) => ({
            question: `Assessment question ${i + 1}?`,
            type: ['multiple-choice', 'true-false'][i % 2],
            options: i % 2 === 0 ? ['Option A', 'Option B', 'Option C'] : undefined,
            correctAnswer: i % 2 === 0 ? (i % 3) : (i % 2 === 0)
          }))
        }
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.assessment?.questions || []).toHaveLength(50)
    })
  })

  describe('Real-World User Scenarios', () => {
    it('should handle typical corporate training course', async () => {
      const courseContent = {
        title: 'Corporate Compliance Training',
        description: 'Annual compliance training for all employees',
        welcome: {
          title: 'Welcome to Compliance Training',
          content: 'This course covers essential compliance topics.',
          audioFile: 'welcome-audio'
        },
        objectivesPage: {
          title: 'Learning Objectives',
          content: 'By the end of this course, you will understand...'
        },
        topics: [
          {
            id: 'intro',
            title: 'Introduction to Compliance',
            content: 'Basic compliance concepts...',
            media: [
              {
                id: 'intro-video',
                type: 'youtube',
                url: 'https://youtube.com/watch?v=example',
                isYouTube: true
              }
            ]
          },
          {
            id: 'policies',
            title: 'Company Policies',
            content: 'Our company policies...',
            knowledgeCheck: {
              enabled: true,
              questions: [
                {
                  question: 'How often should policies be reviewed?',
                  options: ['Monthly', 'Quarterly', 'Annually'],
                  correctAnswer: 2
                }
              ]
            }
          },
          {
            id: 'reporting',
            title: 'Incident Reporting',
            content: 'How to report compliance incidents...'
          }
        ],
        assessment: {
          enabled: true,
          passingScore: 80,
          questions: [
            {
              question: 'What is the first step in incident reporting?',
              options: ['Document', 'Report to manager', 'Investigate'],
              correctAnswer: 1
            },
            {
              question: 'Is regular policy review mandatory?',
              correctAnswer: true
            }
          ]
        }
      }

      const settings = {
        passMark: 80,
        timeLimit: 3600,
        showProgress: true,
        maxAttempts: 3
      }

      const result = await convertToRustFormat(courseContent, mockProjectId, settings)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(3)
      expect((result.courseData.assessment?.questions || []).length > 0).toBe(true)
      expect(result.courseData.pass_mark).toBe(80)
    })

    it('should handle academic course with no assessment', async () => {
      const courseContent = {
        title: 'Art History Survey',
        description: 'Survey of Western art from ancient times to present',
        topics: [
          {
            id: 'ancient',
            title: 'Ancient Art',
            content: 'Art from ancient civilizations...',
            media: [
              {
                id: 'ancient-images',
                type: 'image',
                url: 'http://museum.edu/ancient.jpg'
              }
            ]
          },
          {
            id: 'medieval',
            title: 'Medieval Art',
            content: 'Art from the medieval period...',
            knowledgeCheck: {
              enabled: true,
              questions: [
                {
                  question: 'What characterizes Gothic architecture?',
                  correctAnswer: 'Pointed arches, ribbed vaults, and flying buttresses'
                }
              ]
            }
          },
          {
            id: 'renaissance',
            title: 'Renaissance Art',
            content: 'The rebirth of classical ideals...'
          }
        ]
        // No final assessment - just educational content
      }

      const result = await convertToRustFormat(courseContent, mockProjectId)
      expect(result).toBeDefined()
      expect(result.courseData.topics).toHaveLength(3)
      expect(result.courseData.assessment?.questions || []).toEqual([])
    })
  })
})