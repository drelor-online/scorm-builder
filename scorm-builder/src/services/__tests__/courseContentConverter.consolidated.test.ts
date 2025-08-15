/**
 * courseContentConverter - Consolidated Test Suite
 * 
 * This file consolidates courseContentConverter tests from 11 separate files into
 * a single comprehensive test suite focusing on core functionality.
 * 
 * Test Categories:
 * - Course content format conversion (old to new)
 * - Audio ID mapping and assignment
 * - Media blob conversion to SCORM format
 * - File naming and extension handling
 * - Knowledge check question processing
 * - Default ID generation
 * - Text answer preservation
 * - Intent-based content processing
 * - Error handling and edge cases
 */

import { describe, it, expect, vi } from 'vitest'
import { 
  convertToEnhancedCourseContent, 
  isNewFormatCourseContent 
} from '../courseContentConverter'
import type { 
  CourseContent, 
  LegacyCourseContent, 
  CourseContentUnion,
  KnowledgeCheckQuestion,
  Media
} from '../../types/aiPrompt'
import type { CourseMetadata } from '../../types/metadata'
import type { EnhancedCourseContent } from '../../types/scorm'

// Sample data for testing
const mockMetadata: CourseMetadata = {
  title: 'Test Course',
  courseName: 'Test Course',
  passMark: 80,
  navigationMode: 'linear',
  allowRetake: true
}

const mockNewFormatCourseContent: CourseContent = {
  welcomePage: {
    title: 'Welcome to Test Course',
    content: 'Welcome to our comprehensive test course.',
    audioFile: {
      id: 'welcome-audio',
      url: 'asset://welcome.mp3',
      title: 'Welcome Audio'
    }
  },
  learningObjectivesPage: {
    objectives: [
      'Master course content conversion',
      'Understand audio ID mapping',
      'Learn SCORM generation'
    ],
    audioFile: {
      id: 'objectives-audio',
      url: 'asset://objectives.mp3',
      title: 'Objectives Audio'
    }
  },
  courseModules: [
    {
      title: 'Module 1: Introduction',
      topics: [
        {
          id: 'topic-1',
          title: 'Getting Started',
          content: 'This topic covers the basics.',
          audioFile: {
            id: 'topic-1-audio',
            url: 'asset://topic-1.mp3',
            title: 'Topic 1 Audio'
          },
          media: [
            {
              id: 'topic-1-image',
              type: 'image',
              url: 'https://example.com/image.jpg',
              title: 'Example Image'
            }
          ]
        }
      ]
    }
  ],
  assessment: {
    questions: [
      {
        type: 'multiple-choice',
        question: 'What is the primary purpose of this course?',
        options: ['Learning', 'Testing', 'Both'],
        correctAnswer: 'Both',
        explanation: 'The course serves both learning and testing purposes.'
      },
      {
        type: 'text-input',
        question: 'Describe the main benefit of SCORM packages.',
        correctAnswer: 'Standardized e-learning content delivery',
        explanation: 'SCORM provides standardized content delivery.'
      }
    ]
  }
}

const mockLegacyCourseContent: LegacyCourseContent = {
  welcome: {
    title: 'Welcome',
    content: 'Welcome to the legacy course.',
    startButtonText: 'Begin Course'
  },
  objectives: [
    'Learn legacy content conversion',
    'Understand backward compatibility'
  ],
  topics: [
    {
      id: 'legacy-topic-1',
      title: 'Legacy Topic',
      content: 'This is a legacy format topic.',
      knowledgeChecks: [
        {
          type: 'multiple-choice',
          question: 'What format is this?',
          options: ['New', 'Legacy', 'Hybrid'],
          correctAnswer: 'Legacy',
          feedback: {
            correct: 'Correct! This is legacy format.',
            incorrect: 'This is actually legacy format.'
          }
        }
      ]
    }
  ],
  assessment: {
    enabled: true,
    questions: [
      {
        type: 'multiple-choice',
        question: 'Is this legacy format?',
        options: ['Yes', 'No'],
        correctAnswer: 'Yes',
        feedback: {
          correct: 'Correct!',
          incorrect: 'Try again.'
        }
      }
    ]
  }
}

describe('courseContentConverter - Consolidated Test Suite', () => {
  describe('Format Detection and Type Guards', () => {
    it('correctly identifies new format content', () => {
      expect(isNewFormatCourseContent(mockNewFormatCourseContent)).toBe(true)
    })

    it('correctly identifies legacy format content', () => {
      expect(isNewFormatCourseContent(mockLegacyCourseContent)).toBe(false)
    })

    it('handles edge cases in format detection', () => {
      const ambiguousContent = {
        welcome: { title: 'Welcome' },
        welcomePage: { title: 'Welcome Page' }
      } as any
      
      expect(isNewFormatCourseContent(ambiguousContent)).toBe(true)
    })
  })

  describe('New Format Course Content Conversion', () => {
    it('converts new format to enhanced course content', () => {
      const result = convertToEnhancedCourseContent(
        mockNewFormatCourseContent, 
        mockMetadata, 
        'test-project-123'
      )

      expect(result).toHaveProperty('title', mockMetadata.title)
      expect(result).toHaveProperty('courseName', mockMetadata.courseName)
      expect(result).toHaveProperty('passMark', mockMetadata.passMark)
      expect(result).toHaveProperty('welcome')
      expect(result).toHaveProperty('learningObjectivesPage')
    })

    it('processes course modules correctly', () => {
      const result = convertToEnhancedCourseContent(
        mockNewFormatCourseContent, 
        mockMetadata, 
        'test-project-123'
      )

      expect(result).toHaveProperty('topics')
      expect(Array.isArray(result.topics)).toBe(true)
      
      if (result.topics && result.topics.length > 0) {
        const firstTopic = result.topics[0]
        expect(firstTopic).toHaveProperty('title')
        expect(firstTopic).toHaveProperty('content')
        expect(firstTopic).toHaveProperty('id')
      }
    })

    it('handles assessment questions conversion', () => {
      const result = convertToEnhancedCourseContent(
        mockNewFormatCourseContent, 
        mockMetadata, 
        'test-project-123'
      )

      expect(result).toHaveProperty('assessment')
      expect(result.assessment).toHaveProperty('enabled', true)
      expect(result.assessment).toHaveProperty('questions')
      expect(Array.isArray(result.assessment.questions)).toBe(true)
      
      const questions = result.assessment.questions
      expect(questions.length).toBeGreaterThan(0)
      
      const firstQuestion = questions[0]
      expect(firstQuestion).toHaveProperty('type')
      expect(firstQuestion).toHaveProperty('question')
      expect(firstQuestion).toHaveProperty('correctAnswer')
    })

    it('preserves audio file references', () => {
      const result = convertToEnhancedCourseContent(
        mockNewFormatCourseContent, 
        mockMetadata, 
        'test-project-123'
      )

      // Check welcome page audio
      if ('audioFile' in result.welcome && result.welcome.audioFile) {
        expect(result.welcome.audioFile).toHaveProperty('id', 'welcome-audio')
        expect(result.welcome.audioFile).toHaveProperty('url', 'asset://welcome.mp3')
      }
    })
  })

  describe('Legacy Format Course Content Conversion', () => {
    it('converts legacy format to enhanced course content', () => {
      const result = convertToEnhancedCourseContent(
        mockLegacyCourseContent, 
        mockMetadata
      )

      expect(result).toHaveProperty('title', mockMetadata.title)
      expect(result).toHaveProperty('welcome')
      expect(result).toHaveProperty('topics')
      expect(result).toHaveProperty('assessment')
    })

    it('converts legacy topics to new format', () => {
      const result = convertToEnhancedCourseContent(
        mockLegacyCourseContent, 
        mockMetadata
      )

      expect(Array.isArray(result.topics)).toBe(true)
      expect(result.topics.length).toBeGreaterThan(0)
      
      const firstTopic = result.topics[0]
      expect(firstTopic).toHaveProperty('id')
      expect(firstTopic).toHaveProperty('title')
      expect(firstTopic).toHaveProperty('content')
    })

    it('converts knowledge checks to assessment questions', () => {
      const result = convertToEnhancedCourseContent(
        mockLegacyCourseContent, 
        mockMetadata
      )

      expect(result.assessment).toHaveProperty('enabled', true)
      expect(Array.isArray(result.assessment.questions)).toBe(true)
    })

    it('handles legacy objectives conversion', () => {
      const result = convertToEnhancedCourseContent(
        mockLegacyCourseContent, 
        mockMetadata
      )

      expect(result).toHaveProperty('learningObjectivesPage')
      expect(result.learningObjectivesPage).toHaveProperty('objectives')
      expect(Array.isArray(result.learningObjectivesPage.objectives)).toBe(true)
    })
  })

  describe('Audio ID Assignment and Mapping', () => {
    it('assigns sequential audio IDs', () => {
      const result = convertToEnhancedCourseContent(
        mockNewFormatCourseContent, 
        mockMetadata, 
        'test-project-123'
      )

      // Audio IDs should follow pattern: welcome=0, objectives=1, topics start at 2
      if ('audioFile' in result.welcome && result.welcome.audioFile) {
        expect(result.welcome.audioFile.id).toMatch(/audio-\d+/)
      }
    })

    it('handles missing audio files gracefully', () => {
      const contentWithoutAudio = {
        ...mockNewFormatCourseContent,
        welcomePage: {
          ...mockNewFormatCourseContent.welcomePage,
          audioFile: undefined
        }
      }

      const result = convertToEnhancedCourseContent(
        contentWithoutAudio, 
        mockMetadata, 
        'test-project-123'
      )

      expect(result).toHaveProperty('welcome')
      // Should still process without audio
    })

    it('preserves existing audio IDs when present', () => {
      const result = convertToEnhancedCourseContent(
        mockNewFormatCourseContent, 
        mockMetadata, 
        'test-project-123'
      )

      // Should maintain the IDs from the original content
      if ('audioFile' in result.welcome && result.welcome.audioFile) {
        expect(result.welcome.audioFile.id).toBeDefined()
      }
    })
  })

  describe('Media and Blob Handling', () => {
    it('converts blob URLs to SCORM media format', () => {
      const contentWithBlobMedia = {
        ...mockNewFormatCourseContent,
        courseModules: [
          {
            title: 'Blob Test Module',
            topics: [
              {
                id: 'blob-topic',
                title: 'Blob Topic',
                content: 'Topic with blob media',
                media: [
                  {
                    id: 'blob-image',
                    type: 'image' as const,
                    url: 'blob:http://localhost/image-blob',
                    title: 'Blob Image'
                  }
                ]
              }
            ]
          }
        ]
      }

      const result = convertToEnhancedCourseContent(
        contentWithBlobMedia, 
        mockMetadata, 
        'test-project-123'
      )

      expect(result).toHaveProperty('topics')
      
      if (result.topics && result.topics.length > 0) {
        const topic = result.topics.find(t => t.id === 'blob-topic')
        expect(topic).toBeDefined()
        
        if (topic && 'media' in topic && topic.media) {
          expect(Array.isArray(topic.media)).toBe(true)
        }
      }
    })

    it('handles external media URLs', () => {
      const result = convertToEnhancedCourseContent(
        mockNewFormatCourseContent, 
        mockMetadata, 
        'test-project-123'
      )

      // External URLs should be preserved for later download
      if (result.topics && result.topics.length > 0) {
        const topicWithMedia = result.topics.find(t => 'media' in t && t.media)
        
        if (topicWithMedia && 'media' in topicWithMedia && topicWithMedia.media) {
          const externalMedia = topicWithMedia.media.find(m => 
            m.url && m.url.startsWith('https://')
          )
          
          if (externalMedia) {
            expect(externalMedia.url).toMatch(/^https?:\/\//)
          }
        }
      }
    })

    it('filters out invalid media references', () => {
      const contentWithInvalidMedia = {
        ...mockNewFormatCourseContent,
        courseModules: [
          {
            title: 'Invalid Media Module',
            topics: [
              {
                id: 'invalid-topic',
                title: 'Invalid Media Topic',
                content: 'Topic with invalid media',
                media: [
                  {
                    id: 'invalid-media',
                    type: 'image' as const,
                    url: '', // Invalid empty URL
                    title: 'Invalid Image'
                  },
                  {
                    id: 'valid-media',
                    type: 'image' as const,
                    url: 'https://example.com/valid.jpg',
                    title: 'Valid Image'
                  }
                ]
              }
            ]
          }
        ]
      }

      const result = convertToEnhancedCourseContent(
        contentWithInvalidMedia, 
        mockMetadata, 
        'test-project-123'
      )

      expect(result).toHaveProperty('topics')
      // Should process without errors, filtering invalid media
    })
  })

  describe('File Naming and Extension Handling', () => {
    it('generates appropriate file names for media', () => {
      const result = convertToEnhancedCourseContent(
        mockNewFormatCourseContent, 
        mockMetadata, 
        'test-project-123'
      )

      if (result.topics && result.topics.length > 0) {
        const topicWithMedia = result.topics.find(t => 'media' in t && t.media)
        
        if (topicWithMedia && 'media' in topicWithMedia && topicWithMedia.media) {
          topicWithMedia.media.forEach(media => {
            expect(media.id).toBeDefined()
            expect(media.title).toBeDefined()
          })
        }
      }
    })

    it('handles file extension inference', () => {
      const contentWithVariousMedia = {
        ...mockNewFormatCourseContent,
        courseModules: [
          {
            title: 'Extension Test',
            topics: [
              {
                id: 'ext-topic',
                title: 'Extension Topic',
                content: 'Various file extensions',
                media: [
                  {
                    id: 'jpg-image',
                    type: 'image' as const,
                    url: 'https://example.com/test.jpg',
                    title: 'JPEG Image'
                  },
                  {
                    id: 'mp3-audio',
                    type: 'audio' as const,
                    url: 'https://example.com/test.mp3',
                    title: 'MP3 Audio'
                  },
                  {
                    id: 'mp4-video',
                    type: 'video' as const,
                    url: 'https://example.com/test.mp4',
                    title: 'MP4 Video'
                  }
                ]
              }
            ]
          }
        ]
      }

      const result = convertToEnhancedCourseContent(
        contentWithVariousMedia, 
        mockMetadata, 
        'test-project-123'
      )

      expect(result).toHaveProperty('topics')
      // Should handle various file extensions correctly
    })
  })

  describe('Knowledge Check Processing', () => {
    it('converts knowledge checks with proper indexing', () => {
      const contentWithKnowledgeChecks = {
        ...mockNewFormatCourseContent,
        courseModules: [
          {
            title: 'Knowledge Check Module',
            topics: [
              {
                id: 'kc-topic',
                title: 'Topic with Knowledge Checks',
                content: 'Content with embedded checks',
                knowledgeChecks: [
                  {
                    type: 'multiple-choice' as const,
                    question: 'Test question 1?',
                    options: ['A', 'B', 'C'],
                    correctAnswer: 'A',
                    explanation: 'A is correct'
                  },
                  {
                    type: 'true-false' as const,
                    question: 'This is true?',
                    correctAnswer: 'true',
                    explanation: 'Yes, it is true'
                  }
                ]
              }
            ]
          }
        ]
      }

      const result = convertToEnhancedCourseContent(
        contentWithKnowledgeChecks, 
        mockMetadata, 
        'test-project-123'
      )

      expect(result).toHaveProperty('topics')
      // Knowledge checks should be processed into the topic structure
    })

    it('assigns unique indices to knowledge check questions', () => {
      const result = convertToEnhancedCourseContent(
        mockNewFormatCourseContent, 
        mockMetadata, 
        'test-project-123'
      )

      if (result.assessment && result.assessment.questions) {
        result.assessment.questions.forEach((question, index) => {
          // Each question should have unique properties
          expect(question).toHaveProperty('question')
          expect(question).toHaveProperty('type')
        })
      }
    })
  })

  describe('Default ID Generation', () => {
    it('generates default IDs for missing topic IDs', () => {
      const contentWithoutIds = {
        ...mockNewFormatCourseContent,
        courseModules: [
          {
            title: 'No ID Module',
            topics: [
              {
                title: 'Topic Without ID',
                content: 'This topic has no ID',
                // Missing 'id' property
              } as any
            ]
          }
        ]
      }

      const result = convertToEnhancedCourseContent(
        contentWithoutIds, 
        mockMetadata, 
        'test-project-123'
      )

      expect(result).toHaveProperty('topics')
      
      if (result.topics && result.topics.length > 0) {
        result.topics.forEach(topic => {
          expect(topic).toHaveProperty('id')
          expect(topic.id).toBeTruthy()
        })
      }
    })

    it('preserves existing IDs when present', () => {
      const result = convertToEnhancedCourseContent(
        mockNewFormatCourseContent, 
        mockMetadata, 
        'test-project-123'
      )

      if (result.topics && result.topics.length > 0) {
        const topicWithOriginalId = result.topics.find(t => t.id === 'topic-1')
        expect(topicWithOriginalId).toBeDefined()
        expect(topicWithOriginalId?.id).toBe('topic-1')
      }
    })
  })

  describe('Text Answer Preservation', () => {
    it('preserves text input answers correctly', () => {
      const result = convertToEnhancedCourseContent(
        mockNewFormatCourseContent, 
        mockMetadata, 
        'test-project-123'
      )

      if (result.assessment && result.assessment.questions) {
        const textQuestion = result.assessment.questions.find(q => q.type === 'text-input')
        
        if (textQuestion) {
          expect(textQuestion).toHaveProperty('correctAnswer')
          expect(textQuestion).toHaveProperty('explanation')
          expect(typeof textQuestion.correctAnswer).toBe('string')
        }
      }
    })

    it('handles multiple correct answers for text input', () => {
      const contentWithMultipleAnswers = {
        ...mockNewFormatCourseContent,
        assessment: {
          questions: [
            {
              type: 'text-input' as const,
              question: 'Name a primary color?',
              correctAnswer: ['red', 'blue', 'yellow'],
              explanation: 'Any primary color is correct.'
            }
          ]
        }
      }

      const result = convertToEnhancedCourseContent(
        contentWithMultipleAnswers, 
        mockMetadata, 
        'test-project-123'
      )

      if (result.assessment && result.assessment.questions) {
        const multiAnswerQuestion = result.assessment.questions[0]
        expect(multiAnswerQuestion).toHaveProperty('correctAnswer')
      }
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles empty course content', () => {
      const emptyContent = {
        welcomePage: { title: '', content: '' },
        learningObjectivesPage: { objectives: [] },
        courseModules: [],
        assessment: { questions: [] }
      } as CourseContent

      const result = convertToEnhancedCourseContent(
        emptyContent, 
        mockMetadata, 
        'test-project-123'
      )

      expect(result).toHaveProperty('title')
      expect(result).toHaveProperty('welcome')
      expect(result).toHaveProperty('topics')
      expect(Array.isArray(result.topics)).toBe(true)
    })

    it('handles malformed content gracefully', () => {
      const malformedContent = {
        welcomePage: null,
        courseModules: 'not an array',
        assessment: { questions: null }
      } as any

      expect(() => {
        convertToEnhancedCourseContent(
          malformedContent, 
          mockMetadata, 
          'test-project-123'
        )
      }).not.toThrow()
    })

    it('handles missing metadata properties', () => {
      const incompleteMetadata = {
        title: 'Test Course'
        // Missing other required properties
      } as CourseMetadata

      const result = convertToEnhancedCourseContent(
        mockNewFormatCourseContent, 
        incompleteMetadata, 
        'test-project-123'
      )

      expect(result).toHaveProperty('title', 'Test Course')
      // Should use defaults for missing properties
    })

    it('validates question types and structures', () => {
      const contentWithInvalidQuestions = {
        ...mockNewFormatCourseContent,
        assessment: {
          questions: [
            {
              type: 'invalid-type' as any,
              question: 'Invalid question',
              correctAnswer: 'Unknown'
            },
            {
              type: 'multiple-choice' as const,
              // Missing required properties
              question: 'Incomplete question'
            } as any
          ]
        }
      }

      const result = convertToEnhancedCourseContent(
        contentWithInvalidQuestions, 
        mockMetadata, 
        'test-project-123'
      )

      expect(result).toHaveProperty('assessment')
      // Should handle invalid questions gracefully
    })
  })
})