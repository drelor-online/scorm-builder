import { describe, it, expect } from 'vitest'
import { convertToEnhancedCourseContent } from '../courseContentConverter'
import type { CourseContent } from '../../types/aiPrompt'
import type { CourseMetadata } from '../../types/metadata'

describe('courseContentConverter - Knowledge Check correctAnswer conversion', () => {
  const metadata: CourseMetadata = {
    title: 'Test Course',
    description: 'Test Description',
    duration: 30,
    passMark: 80
  }

  it('should convert string correctAnswer to numeric index for knowledge checks', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        narration: 'Welcome narration',
        media: []
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<ul><li>Objective 1</li></ul>',
        narration: 'Objectives narration',
        media: []
      },
      topics: [{
        id: 'topic1',
        title: 'Topic 1',
        content: 'Topic content',
        narration: 'Topic narration',
        imagePrompts: [],
        imageKeywords: [],
        media: [],
        knowledgeCheck: {
          questions: [{
            id: 'kc1',
            type: 'multiple-choice',
            question: 'What is the answer?',
            options: ['Option A', 'Option B', 'All of the above', 'None of the above'],
            correctAnswer: 'All of the above',
            feedback: {
              correct: 'That\'s correct!',
              incorrect: 'Not quite. Try again!'
            }
          }]
        }
      }],
      assessment: {
        questions: [{
          id: 'q1',
          type: 'multiple-choice',
          question: 'Test question?',
          options: ['A', 'B', 'C'],
          correctAnswer: 'B'
        }],
        passMark: 80
      }
    }

    const result = convertToEnhancedCourseContent(courseContent, metadata)
    
    // Check that knowledge check correctAnswer is converted to numeric index
    const topic = result.topics[0]
    expect(topic.knowledgeCheck).toBeDefined()
    expect(topic.knowledgeCheck?.correctAnswer).toBe(2) // Index of 'All of the above'
    expect(topic.knowledgeCheck?.options).toEqual(['Option A', 'Option B', 'All of the above', 'None of the above'])
    
    // Check that assessment correctAnswer is also converted
    expect(result.assessment.questions[0].correctAnswer).toBe(1) // Index of 'B'
  })

  it('should handle true/false questions with string correctAnswer', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        narration: '',
        media: []
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<ul><li>Objective 1</li></ul>',
        narration: '',
        media: []
      },
      topics: [{
        id: 'topic1',
        title: 'Topic 1',
        content: 'Topic content',
        narration: '',
        imagePrompts: [],
        imageKeywords: [],
        media: [],
        knowledgeCheck: {
          questions: [{
            id: 'kc1',
            type: 'true-false',
            question: 'Is this true?',
            correctAnswer: 'true',
            feedback: {
              correct: 'Correct!',
              incorrect: 'Incorrect!'
            }
          }]
        }
      }],
      assessment: {
        questions: [{
          id: 'q1',
          type: 'true-false',
          question: 'Test true/false?',
          correctAnswer: 'false'
        }],
        passMark: 80
      }
    }

    const result = convertToEnhancedCourseContent(courseContent, metadata)
    
    // Check that true/false knowledge check is converted properly
    const topic = result.topics[0]
    expect(topic.knowledgeCheck).toBeDefined()
    expect(topic.knowledgeCheck?.correctAnswer).toBe(0) // Index 0 for 'True'
    expect(topic.knowledgeCheck?.options).toEqual(['True', 'False'])
    
    // Check assessment true/false
    expect(result.assessment.questions[0].correctAnswer).toBe(1) // Index 1 for 'False'
  })

  it('should keep correctAnswer as string when not converting to index', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        narration: '',
        media: []
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<ul><li>Objective 1</li></ul>',
        narration: '',
        media: []
      },
      topics: [{
        id: 'topic1',
        title: 'Topic 1',
        content: 'Topic content',
        narration: '',
        imagePrompts: [],
        imageKeywords: [],
        media: [],
        knowledgeCheck: {
          questions: [{
            id: 'kc1',
            type: 'fill-in-the-blank',
            question: 'The answer is _____',
            correctAnswer: 'correct answer',
            feedback: {
              correct: 'Good job!',
              incorrect: 'Try again!'
            }
          }]
        }
      }],
      assessment: {
        questions: [],
        passMark: 80
      }
    }

    const result = convertToEnhancedCourseContent(courseContent, metadata)
    
    // Fill-in-the-blank should keep string correctAnswer
    const topic = result.topics[0]
    expect(topic.knowledgeCheck).toBeDefined()
    expect(topic.knowledgeCheck?.correctAnswer).toBe('correct answer')
  })
})