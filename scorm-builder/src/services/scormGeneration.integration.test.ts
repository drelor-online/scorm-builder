import { describe, test, expect, vi, beforeEach } from 'vitest'
import { convertToEnhancedCourseContent } from './courseContentConverter'
import { CourseContent } from '../types/aiPrompt'
import { CourseMetadata } from '../types/course'

// Mock Tauri's invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('SCORM Generation Integration', () => {
  const mockCourseMetadata: CourseMetadata = {
    title: 'Safety Course',
    description: 'A comprehensive safety course',
    author: 'Safety Team',
    version: '1.0',
    keywords: ['safety', 'training']
  }

  test('should convert course content with all question types without errors', () => {
    const courseContentWithAllQuestionTypes: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome to Safety Training',
        content: 'Welcome to our comprehensive safety training course.',
        narration: 'Welcome to our comprehensive safety training course.',
        imageKeywords: ['safety', 'welcome'],
        imagePrompts: ['Safety training welcome image'],
        videoSearchTerms: ['safety training intro'],
        duration: 30,
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'By the end of this course, you will understand key safety principles.',
        narration: 'By the end of this course, you will understand key safety principles.',
        imageKeywords: ['objectives'],
        imagePrompts: ['Learning objectives diagram'],
        videoSearchTerms: [],
        duration: 15,
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Gas Safety Basics',
          content: 'Gas safety is critical for workplace safety.',
          narration: 'Gas safety is critical for workplace safety.',
          imageKeywords: ['gas', 'safety'],
          imagePrompts: ['Gas safety equipment'],
          videoSearchTerms: ['gas safety basics'],
          duration: 300,
          knowledgeCheck: {
            questions: [
              {
                id: 'kc-1',
                type: 'multiple-choice',
                question: 'What is the most important gas safety rule?',
                options: ['Always wear PPE', 'Check for leaks', 'Both A and B', 'None of the above'],
                correctAnswer: 'Both A and B',
                feedback: {
                  correct: 'Correct! Both PPE and leak checking are essential.',
                  incorrect: 'Remember, multiple safety measures are important.'
                }
              },
              {
                id: 'kc-2',
                type: 'true-false',
                question: 'Gas detectors should be calibrated regularly.',
                correctAnswer: 'True',
                feedback: {
                  correct: 'Correct! Regular calibration ensures accuracy.',
                  incorrect: 'Gas detectors need regular calibration to work properly.'
                }
              }
            ]
          }
        }
      ],
      assessment: {
        questions: [
          {
            id: 'assess-1',
            type: 'multiple-choice',
            question: 'Which gas is odorless and colorless?',
            options: ['Natural Gas', 'Propane', 'Carbon Monoxide', 'Oxygen'],
            correctAnswer: 'Carbon Monoxide',
            feedback: {
              correct: 'Correct! CO is odorless and colorless, making it dangerous.',
              incorrect: 'Carbon monoxide is the odorless and colorless gas.'
            }
          },
          {
            id: 'assess-2',
            type: 'true-false',
            question: 'You can smell a gas leak from natural gas.',
            correctAnswer: 'True',
            feedback: {
              correct: 'Correct! Mercaptan is added to make gas detectable.',
              incorrect: 'Natural gas has mercaptan added for safety detection.'
            }
          },
          {
            id: 'assess-3',
            type: 'fill-in-the-blank',
            question: 'The chemical added to natural gas to make it detectable is called _____.',
            blank: 'The chemical added to natural gas to make it detectable is called _____.',
            correctAnswer: 'mercaptan',
            feedback: {
              correct: 'Correct! Mercaptan gives natural gas its distinctive smell.',
              incorrect: 'The correct answer is mercaptan.'
            }
          }
        ],
        passMark: 80,
        narration: null
      }
    }

    // This should not throw any errors
    expect(() => {
      const result = convertToEnhancedCourseContent(courseContentWithAllQuestionTypes, mockCourseMetadata)
      
      // Verify the conversion worked
      expect(result).toBeDefined()
      expect(result.assessment.questions).toHaveLength(3)
      
      // Check multiple choice question
      const mcQuestion = result.assessment.questions[0]
      expect(mcQuestion.correctAnswer).toBe(2) // Index of "Carbon Monoxide"
      expect(mcQuestion.options).toEqual(['Natural Gas', 'Propane', 'Carbon Monoxide', 'Oxygen'])
      
      // Check true-false question
      const tfQuestion = result.assessment.questions[1]
      expect(tfQuestion.correctAnswer).toBe(0) // 0 for True
      expect(tfQuestion.options).toEqual(['True', 'False'])
      
      // Check fill-in-the-blank question
      const fibQuestion = result.assessment.questions[2]
      expect(fibQuestion.correctAnswer).toBe('mercaptan') // String for fill-in-blank
      expect(fibQuestion.options).toEqual([]) // No options for fill-in-blank
      expect(fibQuestion.blank).toBe('The chemical added to natural gas to make it detectable is called _____.')
      
    }).not.toThrow()
  })

  test('should handle edge cases in question data', () => {
    const courseContentWithEdgeCases: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome',
        narration: 'Welcome',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5,
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: 'Objectives',
        narration: 'Objectives',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5,
      },
      topics: [],
      assessment: {
        questions: [
          {
            id: 'edge-1',
            type: 'true-false',
            question: 'Edge case question?',
            correctAnswer: null as any, // Null correctAnswer
            feedback: {
              correct: 'Good',
              incorrect: 'Try again'
            }
          },
          {
            id: 'edge-2',
            type: 'true-false',
            question: 'Another edge case?',
            correctAnswer: undefined as any, // Undefined correctAnswer
            feedback: {
              correct: 'Good',
              incorrect: 'Try again'
            }
          },
          {
            id: 'edge-3',
            type: 'true-false',
            question: 'Numeric edge case?',
            correctAnswer: 1 as any, // Numeric correctAnswer
            feedback: {
              correct: 'Good',
              incorrect: 'Try again'
            }
          },
          {
            id: 'edge-4',
            type: 'fill-in-the-blank',
            question: 'Fill blank with no answer?',
            correctAnswer: undefined as any, // Undefined for fill-in-blank
            feedback: {
              correct: 'Good',
              incorrect: 'Try again'
            }
          }
        ],
        passMark: 80,
        narration: null
      }
    }

    expect(() => {
      const result = convertToEnhancedCourseContent(courseContentWithEdgeCases, mockCourseMetadata)
      
      // Verify no crashes and reasonable defaults
      expect(result.assessment.questions).toHaveLength(4)
      
      // All true-false with bad data should default to 0 (False)
      expect(result.assessment.questions[0].correctAnswer).toBe(0)
      expect(result.assessment.questions[1].correctAnswer).toBe(0)
      expect(result.assessment.questions[2].correctAnswer).toBe(0)
      
      // Fill-in-blank with undefined should default to empty string
      expect(result.assessment.questions[3].correctAnswer).toBe('')
      
    }).not.toThrow()
  })
})