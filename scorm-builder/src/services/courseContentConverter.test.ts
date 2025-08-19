import { describe, test, expect } from 'vitest'
import { convertToEnhancedCourseContent } from './courseContentConverter'
import { CourseContent } from '../types/aiPrompt'
import { CourseMetadata } from '../types/course'

describe('CourseContentConverter', () => {
  const mockCourseMetadata: CourseMetadata = {
    title: 'Test Course',
    description: 'Test Description',
    author: 'Test Author',
    version: '1.0',
    keywords: ['test']
  }

  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome content',
      narration: 'Welcome narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5,
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: 'Objectives content',
      narration: 'Objectives narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3,
    },
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic content',
        narration: 'Topic narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 10,
      }
    ],
    assessment: {
      questions: [],
      passMark: 80,
      narration: null,
    },
  }

  test('should handle fill-in-the-blank questions without crashing', () => {
    const courseContentWithFillBlank: CourseContent = {
      ...mockCourseContent,
      assessment: {
        questions: [
          {
            id: 'q1',
            type: 'fill-in-the-blank',
            question: 'The capital of France is _____.',
            blank: 'The capital of France is _____.',
            correctAnswer: 'Paris',
            feedback: {
              correct: 'Correct! Paris is the capital.',
              incorrect: 'Try again!'
            }
          }
        ],
        passMark: 80,
        narration: null,
      }
    }

    // This should not throw an error
    expect(() => {
      convertToEnhancedCourseContent(courseContentWithFillBlank, mockCourseMetadata)
    }).not.toThrow()
  })

  test('should handle true-false questions with null or undefined correctAnswer', () => {
    const courseContentWithBadTrueFalse: CourseContent = {
      ...mockCourseContent,
      assessment: {
        questions: [
          {
            id: 'q1',
            type: 'true-false',
            question: 'Is this true?',
            correctAnswer: undefined as any, // Simulate bad data
            feedback: {
              correct: 'Correct!',
              incorrect: 'Try again!'
            }
          }
        ],
        passMark: 80,
        narration: null,
      }
    }

    // This should not throw a "toLowerCase is not a function" error
    expect(() => {
      convertToEnhancedCourseContent(courseContentWithBadTrueFalse, mockCourseMetadata)
    }).not.toThrow()
  })

  test('should handle true-false questions with numeric correctAnswer', () => {
    const courseContentWithNumericAnswer: CourseContent = {
      ...mockCourseContent,
      assessment: {
        questions: [
          {
            id: 'q1',
            type: 'true-false',
            question: 'Is this true?',
            correctAnswer: 1 as any, // Simulate numeric data from old system
            feedback: {
              correct: 'Correct!',
              incorrect: 'Try again!'
            }
          }
        ],
        passMark: 80,
        narration: null,
      }
    }

    // This should not throw a "toLowerCase is not a function" error
    expect(() => {
      convertToEnhancedCourseContent(courseContentWithNumericAnswer, mockCourseMetadata)
    }).not.toThrow()
  })

  test('should correctly convert fill-in-the-blank question to enhanced format', () => {
    const courseContentWithFillBlank: CourseContent = {
      ...mockCourseContent,
      assessment: {
        questions: [
          {
            id: 'fill-1',
            type: 'fill-in-the-blank',
            question: 'The largest planet is _____.',
            blank: 'The largest planet is _____.',
            correctAnswer: 'Jupiter',
            feedback: {
              correct: 'Correct! Jupiter is the largest planet.',
              incorrect: 'The correct answer is Jupiter.'
            }
          }
        ],
        passMark: 80,
        narration: null,
      }
    }

    const result = convertToEnhancedCourseContent(courseContentWithFillBlank, mockCourseMetadata)
    
    expect(result.assessment.questions).toHaveLength(1)
    const question = result.assessment.questions[0]
    
    // Should preserve the correct answer as a string for fill-in-the-blank
    expect(question.correctAnswer).toBe('Jupiter')
    expect(question.blank).toBe('The largest planet is _____.')
    expect(question.options).toEqual([]) // No options for fill-in-the-blank
  })

  test('should convert true-false question correctly with valid string answer', () => {
    const courseContentWithTrueFalse: CourseContent = {
      ...mockCourseContent,
      assessment: {
        questions: [
          {
            id: 'tf-1',
            type: 'true-false',
            question: 'The Earth is round.',
            correctAnswer: 'True',
            feedback: {
              correct: 'Correct!',
              incorrect: 'Actually, the Earth is round.'
            }
          }
        ],
        passMark: 80,
        narration: null,
      }
    }

    const result = convertToEnhancedCourseContent(courseContentWithTrueFalse, mockCourseMetadata)
    
    expect(result.assessment.questions).toHaveLength(1)
    const question = result.assessment.questions[0]
    
    // Should convert string "True" to index 0
    expect(question.correctAnswer).toBe(0)
    expect(question.options).toEqual(['True', 'False'])
  })
})