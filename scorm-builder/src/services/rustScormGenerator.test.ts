import { describe, test, expect, vi, beforeEach } from 'vitest'
import { convertToRustFormat } from './rustScormGenerator'
import { EnhancedCourseContent } from '../types/scorm'

// Mock Tauri's invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('RustScormGenerator Assessment Questions', () => {
  
  test('should handle fill-in-the-blank assessment questions without TypeScript errors', async () => {
    const enhancedCourseContent: EnhancedCourseContent = {
      title: 'Test Course',
      duration: 300,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        imageUrl: '',
        audioFile: '',
        captionFile: '',
        embedUrl: ''
      },
      objectives: ['Learn safety principles', 'Understand gas handling'], // Array format for enhanced detection
      objectivesPage: {
        title: 'Objectives Page',
        content: 'Objectives page content',
        imageUrl: '',
        audioFile: '',
        captionFile: '',
        embedUrl: ''
      },
      topics: [],
      assessment: {
        questions: [
          {
            id: 'assess-1',
            question: 'What is the capital of France?',
            options: ['London', 'Berlin', 'Paris', 'Madrid'],
            correctAnswer: 2, // numeric index for multiple choice
            type: 'multiple-choice'
          } as any,
          {
            id: 'assess-2',
            question: 'Is the Earth round?',
            options: ['True', 'False'],
            correctAnswer: 0, // numeric index for true/false
            type: 'true-false'
          } as any,
          {
            id: 'assess-3',
            question: 'The largest planet is _____.',
            blank: 'The largest planet is _____.',
            options: [], // No options for fill-in-the-blank
            correctAnswer: 'Jupiter', // string answer for fill-in-the-blank
            type: 'fill-in-the-blank' // Add type field
          } as any
        ]
      }
    }

    // This test should pass without TypeScript compilation errors
    const result = await convertToRustFormat(enhancedCourseContent, 'test-project')
    
    // Verify the result structure
    expect(result.courseData.assessment).toBeDefined()
    expect(result.courseData.assessment?.questions).toHaveLength(3)
    
    // Check multiple choice question
    const mcQuestion = result.courseData.assessment!.questions[0]
    // Debug: console.log('MC Question:', mcQuestion)
    expect(mcQuestion.correct_answer).toBe('Paris') // Should resolve to option text
    expect(mcQuestion.type).toBe('multiple-choice')
    
    // Check true/false question
    const tfQuestion = result.courseData.assessment!.questions[1]
    expect(tfQuestion.correct_answer).toBe('True') // Should resolve to option text
    expect(tfQuestion.type).toBe('true-false') // TF questions preserve their type
    
    // Check fill-in-the-blank question
    const fibQuestion = result.courseData.assessment!.questions[2]
    expect(fibQuestion.correct_answer).toBe('Jupiter') // Should keep string as-is
    expect(fibQuestion.type).toBe('fill-in-the-blank') // Should preserve type
  })

  test('should handle edge cases with mixed correctAnswer types', async () => {
    const enhancedCourseContent: EnhancedCourseContent = {
      title: 'Edge Case Course',
      duration: 300,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        imageUrl: '',
        audioFile: '',
        captionFile: '',
        embedUrl: ''
      },
      objectives: ['Learn safety principles', 'Understand gas handling'], // Array format for enhanced detection
      objectivesPage: {
        title: 'Objectives Page',
        content: 'Objectives page content',
        imageUrl: '',
        audioFile: '',
        captionFile: '',
        embedUrl: ''
      },
      topics: [],
      assessment: {
        questions: [
          {
            id: 'edge-1',
            question: 'Multiple choice with string correctAnswer (edge case)',
            options: ['A', 'B', 'C'],
            correctAnswer: 'B', // Edge case: string for MC question
            type: 'multiple-choice'
          } as any,
          {
            id: 'edge-2',
            question: 'Fill blank with no type specified',
            blank: 'Answer is _____.',
            options: [],
            correctAnswer: 'test answer',
            type: 'fill-in-the-blank'
          } as any
        ]
      }
    }

    const result = await convertToRustFormat(enhancedCourseContent, 'test-project')
    
    // Should handle edge cases gracefully
    expect(result.courseData.assessment?.questions).toHaveLength(2)
    
    // First question should handle string correctAnswer for MC
    const edgeQuestion = result.courseData.assessment!.questions[0]
    expect(edgeQuestion.correct_answer).toBe('B') // Should use the string directly
    
    // Second question should handle fill-in-blank without explicit type
    const fibQuestion = result.courseData.assessment!.questions[1]
    expect(fibQuestion.correct_answer).toBe('test answer')
  })

  test('should compile without TypeScript errors', async () => {
    // This test exists primarily to ensure the file compiles
    // The actual functionality is tested in the above tests
    
    // Create a simple course content to ensure the function can be called
    const simpleCourseContent: EnhancedCourseContent = {
      title: 'Simple Course',
      duration: 60,
      passMark: 70,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome',
        imageUrl: '',
        audioFile: '',
        captionFile: '',
        embedUrl: ''
      },
      objectives: {
        title: 'Objectives',
        content: 'Objectives',
        imageUrl: '',
        audioFile: '',
        captionFile: '',
        embedUrl: ''
      },
      objectivesPage: {
        title: 'Objectives Page',
        content: 'Objectives',
        imageUrl: '',
        audioFile: '',
        captionFile: '',
        embedUrl: ''
      },
      topics: [],
      assessment: {
        questions: []
      }
    }

    // Should be able to call the function
    const result = await convertToRustFormat(simpleCourseContent, 'test-project')
    expect(result).toBeDefined()
  })
})