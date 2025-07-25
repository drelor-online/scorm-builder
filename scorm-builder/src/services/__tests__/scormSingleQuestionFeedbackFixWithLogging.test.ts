import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Single Question Feedback Fix with Enhanced Logging', () => {
  it('should add enhanced error handling to catch runtime issues', async () => {
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
          explanation: customFeedback
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
    
    // The generated code should have proper error handling
    expect(topicHtml).toContain('console.log')
    expect(topicHtml).toContain('console.error')
    
    // Check that correctAnswers is defined
    expect(topicHtml).toContain('const correctAnswers = {')
    
    // Check that the explanation is properly escaped in the correctAnswers
    const correctAnswersMatch = topicHtml!.match(/const correctAnswers = \{([^}]+)\}/s)
    expect(correctAnswersMatch).toBeTruthy()
    
    // The custom feedback should be present and properly escaped
    const escapedFeedback = customFeedback.replace(/'/g, "\\'")
    expect(correctAnswersMatch![1]).toContain(escapedFeedback)
    
    // Verify feedback will be set correctly
    expect(topicHtml).toContain('feedbackText.textContent = isCorrect ?')
    expect(topicHtml).toContain("(correctAnswer.correctFeedback || 'Correct!')")
  })
})