import { describe, it, expect } from 'vitest'
import { convertToEnhancedCourseContent } from '../courseContentConverter'
import type { CourseContent } from '../../types/aiPrompt'
import type { CourseMetadata } from '../../types/metadata'

describe('Course Content Converter - Preserve Text-Based Answers', () => {
  const mockMetadata: CourseMetadata = {
    title: 'Test Course',
    identifier: 'test-course',
    description: 'Test Description',
    version: '1.0',
    scormVersion: '1.2',
    duration: 30,
    passMark: 80
  }

  it('should preserve text-based correctAnswer for single questions (not convert to index)', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: '<ul><li>Objective 1</li></ul>',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Content',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5,
        knowledgeCheck: {
          questions: [{
            id: 'q1',
            type: 'multiple-choice',
            question: 'What is the best control?',
            options: ['PPE', 'Signs', 'Elimination', 'Training'],
            correctAnswer: 'Elimination', // Text-based answer
            feedback: {
              correct: 'Great! Elimination is the most effective control.',
              incorrect: 'Not quite. Elimination is the most effective control method.'
            }
          }]
        }
      }],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    const result = convertToEnhancedCourseContent(courseContent, mockMetadata)
    
    // Check that the knowledge check is preserved correctly
    const knowledgeCheck = result.topics[0].knowledgeCheck
    expect(knowledgeCheck).toBeDefined()
    
    // Should NOT convert to index (2), should keep as text
    console.log('Converted knowledgeCheck:', knowledgeCheck)
    
    // After fix, it should preserve the text
    expect(knowledgeCheck?.correctAnswer).toBe('Elimination')
  })

  it('should preserve feedback object for single questions', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: '<ul><li>Objective 1</li></ul>',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Content',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5,
        knowledgeCheck: {
          questions: [{
            id: 'q1',
            type: 'multiple-choice',
            question: 'What is 2+2?',
            options: ['3', '4', '5'],
            correctAnswer: '4',
            feedback: {
              correct: 'Custom correct feedback',
              incorrect: 'Custom incorrect feedback'
            }
          }]
        }
      }],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    const result = convertToEnhancedCourseContent(courseContent, mockMetadata)
    const knowledgeCheck = result.topics[0].knowledgeCheck
    
    console.log('Knowledge check structure:', JSON.stringify(knowledgeCheck, null, 2))
    
    // Check if feedback is preserved
    expect(knowledgeCheck?.explanation).toBeDefined()
    expect(knowledgeCheck?.explanation).toBe('Custom correct feedback')
    
    // Check that feedback object is preserved
    expect((knowledgeCheck as any)?.feedback).toBeDefined()
    expect((knowledgeCheck as any)?.feedback?.correct).toBe('Custom correct feedback')
    expect((knowledgeCheck as any)?.feedback?.incorrect).toBe('Custom incorrect feedback')
  })

  it('should also preserve text answers for multiple questions', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: '<ul><li>Objective 1</li></ul>',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Content',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5,
        knowledgeCheck: {
          questions: [
            {
              id: 'q1',
              type: 'multiple-choice',
              question: 'Question 1',
              options: ['A', 'B', 'C'],
              correctAnswer: 'B',
              feedback: { correct: 'Good!', incorrect: 'Try again' }
            },
            {
              id: 'q2',
              type: 'multiple-choice',
              question: 'Question 2',
              options: ['X', 'Y', 'Z'],
              correctAnswer: 'Y',
              feedback: { correct: 'Excellent!', incorrect: 'Not quite' }
            }
          ]
        }
      }],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    const result = convertToEnhancedCourseContent(courseContent, mockMetadata)
    const knowledgeCheck = result.topics[0].knowledgeCheck
    
    console.log('Multiple questions structure:', JSON.stringify(knowledgeCheck?.questions, null, 2))
    
    // Check that questions array exists
    expect(knowledgeCheck?.questions).toBeDefined()
    expect(knowledgeCheck?.questions?.length).toBe(2)
    
    // Should preserve text-based answers
    if (knowledgeCheck?.questions) {
      expect(knowledgeCheck.questions[0].correctAnswer).toBe('B')
      expect(knowledgeCheck.questions[1].correctAnswer).toBe('Y')
      
      // Check that feedback is preserved
      expect(knowledgeCheck.questions[0].feedback?.correct).toBe('Good!')
      expect(knowledgeCheck.questions[0].feedback?.incorrect).toBe('Try again')
      expect(knowledgeCheck.questions[1].feedback?.correct).toBe('Excellent!')
      expect(knowledgeCheck.questions[1].feedback?.incorrect).toBe('Not quite')
    }
  })
})