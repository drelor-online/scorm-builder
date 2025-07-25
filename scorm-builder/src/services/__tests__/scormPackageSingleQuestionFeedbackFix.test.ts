import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Single Question Feedback Fix', () => {
  it('should correctly use explanation field for single question feedback', async () => {
    const customFeedback = 'The answer is 4 because 2+2=4 according to basic arithmetic rules'
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
          question: 'What is 2+2?',
          options: ['3', '4', '5'],
          correctAnswer: 1,
          type: 'multiple-choice',
          explanation: customFeedback // This is where the feedback is stored
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
    
    // Check that the correctAnswers object contains the custom feedback
    const correctAnswersMatch = topicHtml!.match(/correctAnswers\s*=\s*{([^}]+)}/s)
    expect(correctAnswersMatch).toBeTruthy()
    
    const correctAnswersContent = correctAnswersMatch![0]
    console.log('correctAnswers content:', correctAnswersContent)
    
    // The custom feedback should be in the correctFeedback field
    expect(correctAnswersContent).toContain(customFeedback.replace(/'/g, "\\'"))
    
    // It should NOT just have 'Correct!' as the feedback
    expect(correctAnswersContent).not.toMatch(/correctFeedback:\s*'Correct!'/);
  })

  it('should also work for multiple questions in a single knowledge check', async () => {
    const feedback1 = 'The capital of France has been Paris since 987 AD'
    const feedback2 = 'Rome became the capital of unified Italy in 1871'
    
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
          questions: [
            {
              id: 'q1',
              type: 'multiple-choice',
              question: 'What is the capital of France?',
              options: ['London', 'Paris', 'Berlin'],
              correctAnswer: 1,
              explanation: feedback1
            },
            {
              id: 'q2',
              type: 'multiple-choice',
              question: 'What is the capital of Italy?',
              options: ['Milan', 'Venice', 'Rome'],
              correctAnswer: 2,
              explanation: feedback2
            }
          ]
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
    
    // Both custom feedbacks should be present
    expect(topicHtml).toContain(feedback1.replace(/'/g, "\\'"))
    expect(topicHtml).toContain(feedback2.replace(/'/g, "\\'"))
  })
})