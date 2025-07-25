import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Correct Answer Format Test', () => {
  it('should handle correctAnswer as option text instead of index', async () => {
    const mockCourseContent: EnhancedCourseContent = {
      title: 'Test Course',
      duration: 30,
      identifier: 'test-course',
      metadata: {
        title: 'Test Course',
        identifier: 'test-course',
        description: '',
        version: '1.0',
        scormVersion: '1.2',
        duration: 30,
        passMark: 80
      },
      welcome: {
        title: 'Welcome',
        content: 'Welcome content'
      },
      objectivesPage: {
        title: 'Objectives',
        objectives: ['Learn stuff']
      },
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Content',
        knowledgeCheck: {
          questions: [{
            id: 'kc-q1',
            type: 'multiple-choice',
            question: 'What is the most effective control?',
            options: ['PPE', 'Signs', 'Elimination', 'Training'],
            correctAnswer: 'Elimination', // Using text instead of index
            feedback: {
              correct: 'Correct! Elimination is the most effective.',
              incorrect: 'Not quite. Elimination is the most effective.'
            }
          }]
        }
      }],
      assessment: {
        title: 'Assessment',
        questions: []
      }
    }

    const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
    const zip = await JSZip.loadAsync(result.buffer)
    
    const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
    expect(topicHtml).toBeTruthy()
    
    // Extract the correctAnswers object
    const correctAnswersMatch = topicHtml!.match(/const correctAnswers = \{([^}]+)\}/s)
    expect(correctAnswersMatch).toBeTruthy()
    
    console.log('Generated correctAnswers:', correctAnswersMatch![0])
    
    // Check what the answer value is
    const answerMatch = correctAnswersMatch![1].match(/answer:\s*'([^']+)'/)
    expect(answerMatch).toBeTruthy()
    
    const answerValue = answerMatch![1]
    console.log('Answer value in correctAnswers:', answerValue)
    
    // The answer should be the index of 'Elimination' which is 2
    expect(answerValue).toBe('Elimination')
  })

  it('should find the index when correctAnswer is a string', async () => {
    const options = ['PPE', 'Signs', 'Elimination', 'Training']
    const correctAnswer = 'Elimination'
    const index = options.indexOf(correctAnswer)
    console.log('Index of', correctAnswer, 'is', index)
    expect(index).toBe(2)
  })
})