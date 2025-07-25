import { describe, it, expect } from 'vitest'
import { convertToEnhancedCourseContent, isNewFormatCourseContent } from '../courseContentConverter'
import type { CourseContent, LegacyCourseContent } from '../../types/aiPrompt'
import type { CourseMetadata } from '../../types/metadata'

describe('courseContentConverter - User Intent Tests', () => {
  const mockMetadata: CourseMetadata = {
    title: 'Test Course',
    description: 'A test course for unit testing',
    version: '1.0.0',
    identifier: 'test-course-2024',
    scormVersion: '1.2',
    duration: 30,
    passMark: 80
  }

  describe('User wants to convert new format course content', () => {
    it('should convert modern course structure to SCORM format', () => {
      const modernContent: CourseContent = {
        welcomePage: {
          id: 'welcome',
          title: 'Welcome to Python Programming',
          content: '<h2>Welcome!</h2><p>Learn Python from scratch.</p>',
          narration: 'Welcome to this comprehensive Python programming course.',
          imageKeywords: ['python', 'programming'],
          imagePrompts: ['Python logo with code'],
          videoSearchTerms: ['python intro'],
          duration: 2,
          media: [{
            id: 'img1',
            url: 'https://example.com/python.jpg',
            title: 'Python Logo',
            type: 'image'
          }]
        },
        learningObjectivesPage: {
          id: 'objectives',
          title: 'Learning Objectives',
          content: '<h2>What You\'ll Learn</h2><ul><li>Variables</li><li>Functions</li><li>Classes</li></ul>',
          narration: 'By the end of this course, you will master Python basics.',
          imageKeywords: ['objectives'],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 2
        },
        topics: [
          {
            id: 'topic-1',
            title: 'Variables and Data Types',
            content: '<h2>Variables</h2><p>Variables store data values.</p>',
            narration: 'Variables are containers for storing data values.',
            imageKeywords: ['variables'],
            imagePrompts: [],
            videoSearchTerms: ['python variables'],
            duration: 10,
            knowledgeCheck: {
              questions: [{
                id: 'kc1',
                type: 'multiple-choice',
                question: 'What is a variable?',
                options: ['A container', 'A function', 'A class', 'A module'],
                correctAnswer: 'A container',
                feedback: {
                  correct: 'Correct! Variables are containers.',
                  incorrect: 'Variables are containers for data.'
                }
              }]
            }
          }
        ],
        assessment: {
          questions: [{
            id: 'q1',
            type: 'multiple-choice',
            question: 'Which is a valid Python variable?',
            options: ['my_var', '123var', 'my-var', 'class'],
            correctAnswer: 'my_var',
            feedback: {
              correct: 'Correct! my_var follows naming rules.',
              incorrect: 'Variable names must start with letter/underscore.'
            }
          }],
          passMark: 80,
          narration: null
        }
      }

      const result = convertToEnhancedCourseContent(modernContent, mockMetadata)

      // Should have correct structure
      expect(result.title).toBe('Test Course')
      expect(result.duration).toBe(14) // 2 + 2 + 10
      expect(result.passMark).toBe(80)
      
      // Should convert welcome page
      expect(result.welcome.title).toBe('Welcome to Python Programming')
      expect(result.welcome.content).toContain('Learn Python from scratch')
      expect(result.welcome.audioFile).toBe('0000-welcome.mp3')
      expect(result.welcome.media).toHaveLength(1)
      expect(result.welcome.media![0].title).toBe('Python Logo')

      // Should extract objectives from content
      expect(result.objectives).toContain('Variables')
      expect(result.objectives).toContain('Functions')
      expect(result.objectives).toContain('Classes')

      // Should convert topics
      expect(result.topics).toHaveLength(1)
      expect(result.topics[0].title).toBe('Variables and Data Types')
      expect(result.topics[0].audioFile).toBe('0001-variables-and-data-types.mp3')
      
      // Should include knowledge checks
      expect(result.topics[0].knowledgeCheck).toBeDefined()
      expect(result.topics[0].knowledgeCheck!.question).toBe('What is a variable?')

      // Should convert assessment
      expect(result.assessment.questions).toHaveLength(1)
      expect(result.assessment.questions[0].question).toBe('Which is a valid Python variable?')
    })

    it('should handle course content without media gracefully', () => {
      const contentWithoutMedia: CourseContent = {
        welcomePage: {
          id: 'welcome',
          title: 'Simple Course',
          content: '<p>Welcome</p>',
          narration: 'Welcome narration',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 1
          // No media property
        },
        learningObjectivesPage: {
          id: 'objectives',
          title: 'Objectives',
          content: '<ul><li>Learn basics</li></ul>',
          narration: 'Objectives narration',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 1
        },
        topics: [],
        assessment: {
          questions: [],
          passMark: 70,
          narration: null
        }
      }

      const result = convertToEnhancedCourseContent(contentWithoutMedia, mockMetadata)

      expect(result.welcome.media).toEqual([])
      expect(result.welcome.imageUrl).toBeUndefined()
      expect(result.welcome.embedUrl).toBeUndefined()
    })

    it('should generate unique audio filenames for narration', () => {
      const content: CourseContent = {
        welcomePage: {
          id: 'welcome',
          title: 'Welcome Page!!!', // Special characters
          content: '<p>Welcome</p>',
          narration: 'Welcome narration',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 1
        },
        learningObjectivesPage: {
          id: 'objectives',
          title: 'Learning Objectives & Goals', // Special characters
          content: '<p>Objectives</p>',
          narration: 'Objectives narration',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 1
        },
        topics: [
          {
            id: 'topic1',
            title: 'Topic #1: Introduction', // Special characters
            content: '<p>Topic content</p>',
            narration: 'Topic narration',
            imageKeywords: [],
            imagePrompts: [],
            videoSearchTerms: [],
            duration: 5
          }
        ],
        assessment: {
          questions: [],
          passMark: 80,
          narration: null
        }
      }

      const result = convertToEnhancedCourseContent(content, mockMetadata)

      // Should sanitize filenames
      expect(result.welcome.audioFile).toBe('0000-welcome.mp3')
      expect(result.objectivesPage!.audioFile).toBe('0001-objectives.mp3')
      expect(result.topics[0].audioFile).toBe('0001-topic-1-introduction.mp3')
    })
  })

  describe('User wants to convert legacy format course content', () => {
    it('should convert old format with narration blocks', () => {
      const legacyContent: LegacyCourseContent = {
        topics: [
          {
            id: 'topic1',
            title: 'Introduction',
            content: '<h2>Introduction</h2><p>Getting started</p>',
            bulletPoints: [
              'Point 1: Basics',
              'Point 2: Setup',
              'Point 3: First steps'
            ],
            narration: [
              { id: 'n1', text: 'Welcome to the introduction.', blockNumber: '1' },
              { id: 'n2', text: 'Let\'s get started with basics.', blockNumber: '2' }
            ],
            imageKeywords: ['intro'],
            imagePrompts: ['Introduction slide'],
            videoSearchTerms: ['getting started'],
            duration: 8,
            media: [{
              id: 'media1',
              url: 'https://example.com/intro.jpg',
              title: 'Intro Image',
              type: 'image'
            }]
          }
        ],
        activities: [
          {
            id: 'act1',
            type: 'multiple-choice',
            title: 'Check Your Knowledge',
            instructions: 'Select the correct answer',
            content: {
              question: 'What did you learn?',
              options: ['Option A', 'Option B', 'Option C'],
              correctAnswer: 0
            }
          }
        ],
        quiz: {
          questions: [
            {
              id: 'q1',
              type: 'true-false',
              question: 'True or false: You learned something',
              correctAnswer: 'true',
              feedback: {
                correct: 'Yes, you did!',
                incorrect: 'Think again'
              }
            }
          ],
          passMark: 75
        }
      }

      const result = convertToEnhancedCourseContent(legacyContent, mockMetadata)

      // Should create welcome page from first topic intro
      expect(result.welcome.title).toBe('Welcome to Test Course')
      expect(result.welcome.content).toContain('Test Course')

      // Should combine narration blocks
      expect(result.topics[0].audioFile).toBeDefined()
      
      // Legacy format without objectives topic returns empty objectives
      expect(result.objectives).toHaveLength(0)

      // Should convert activities to knowledge checks
      expect(result.topics[0].knowledgeCheck).toBeDefined()
      expect(result.topics[0].knowledgeCheck!.question).toBe('What did you learn?')

      // Should convert quiz to assessment
      expect(result.assessment.questions).toHaveLength(1)
      // Assessment questions don't have type property in converted format
      expect(result.assessment.questions[0].question).toBe('True or false: You learned something')
      // passMark comes from metadata, not quiz
      expect(result.passMark).toBe(80)
    })

    it('should handle legacy content without activities', () => {
      const simpleContent: LegacyCourseContent = {
        topics: [
          {
            id: 'topic1',
            title: 'Simple Topic',
            content: '<p>Simple content</p>',
            bulletPoints: ['Point 1'],
            narration: [
              { id: 'n1', text: 'Simple narration', blockNumber: '1' }
            ],
            imageKeywords: [],
            imagePrompts: [],
            duration: 5
          }
        ],
        activities: [], // No activities
        quiz: {
          questions: [],
          passMark: 80
        }
      }

      const result = convertToEnhancedCourseContent(simpleContent, mockMetadata)

      expect(result.topics[0].knowledgeCheck).toBeUndefined()
      expect(result.assessment.questions).toHaveLength(0)
    })
  })

  describe('User wants to detect content format automatically', () => {
    it('should correctly identify new format content', () => {
      const newFormat = {
        welcomePage: { id: 'welcome', title: 'Welcome' },
        learningObjectivesPage: { id: 'objectives', title: 'Objectives' },
        topics: [],
        assessment: { questions: [], passMark: 80 }
      }

      expect(isNewFormatCourseContent(newFormat)).toBe(true)
    })

    it('should correctly identify legacy format content', () => {
      const legacyFormat = {
        topics: [{ id: 'topic1', title: 'Topic 1' }],
        activities: [],
        quiz: { questions: [], passMark: 80 }
      }

      expect(isNewFormatCourseContent(legacyFormat)).toBe(false)
    })

    it('should handle malformed content gracefully', () => {
      const malformed = {
        someField: 'value',
        anotherField: 123
      }

      expect(isNewFormatCourseContent(malformed as any)).toBe(false)
    })
  })

  describe('User wants media to be preserved correctly', () => {
    it('should prioritize video embeds over images', () => {
      const content: CourseContent = {
        welcomePage: {
          id: 'welcome',
          title: 'Welcome',
          content: '<p>Welcome</p>',
          narration: 'Welcome',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 2,
          media: [
            {
              id: 'img1',
              url: 'https://example.com/image.jpg',
              title: 'Image',
              type: 'image'
            },
            {
              id: 'vid1',
              url: 'https://youtube.com/watch?v=123',
              embedUrl: 'https://youtube.com/embed/123',
              title: 'Video',
              type: 'video'
            }
          ]
        },
        learningObjectivesPage: {
          id: 'objectives',
          title: 'Objectives',
          content: '<p>Objectives</p>',
          narration: 'Objectives',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 1
        },
        topics: [],
        assessment: { questions: [], passMark: 80, narration: null }
      }

      const result = convertToEnhancedCourseContent(content, mockMetadata)

      // Should use video embed URL when available
      expect(result.welcome.embedUrl).toBe('https://youtube.com/embed/123')
      // Should still include all media
      expect(result.welcome.media).toHaveLength(2)
    })

    it('should handle audio media with captions', () => {
      const content: CourseContent = {
        welcomePage: {
          id: 'welcome',
          title: 'Welcome',
          content: '<p>Welcome</p>',
          narration: 'Welcome narration',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 2,
          media: [{
            id: 'audio1',
            url: 'https://example.com/narration.mp3',
            title: 'Narration Audio',
            type: 'audio',
            captionUrl: 'https://example.com/captions.vtt',
            captionBlob: new Blob(['WEBVTT\n\n00:00.000 --> 00:05.000\nWelcome'])
          }]
        },
        learningObjectivesPage: {
          id: 'objectives',
          title: 'Objectives',
          content: '<p>Objectives</p>',
          narration: 'Objectives',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 1
        },
        topics: [],
        assessment: { questions: [], passMark: 80, narration: null }
      }

      const result = convertToEnhancedCourseContent(content, mockMetadata)

      // Should preserve caption information
      expect(result.welcome.captionFile).toBeDefined()
      expect(result.welcome.media![0].captionUrl).toBe('https://example.com/captions.vtt')
    })
  })
})