import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Single Question Runtime Test', () => {
  it('should generate correct JavaScript for single question runtime execution', async () => {
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
    
    // Extract the JavaScript code
    const scriptMatch = topicHtml!.match(/<script>([\s\S]*?)<\/script>/g)
    expect(scriptMatch).toBeTruthy()
    
    const fullScript = scriptMatch!.join('\n')
    console.log('\n=== FULL SCRIPT FOR SINGLE QUESTION ===')
    console.log(fullScript)
    console.log('=== END SCRIPT ===\n')
    
    // Check that submitAnswer function exists
    expect(fullScript).toContain('function submitAnswer()')
    
    // Check that debug logging is present
    expect(fullScript).toContain("console.log('Feedback Debug:'")
    
    // Check the correctAnswers object specifically
    const correctAnswersMatch = fullScript.match(/const correctAnswers = {([^}]+)}/s)
    expect(correctAnswersMatch).toBeTruthy()
    console.log('\n=== correctAnswers object ===')
    console.log(correctAnswersMatch![0])
    console.log('=== END correctAnswers ===\n')
    
    // Check that the custom feedback is in the correctAnswers
    expect(correctAnswersMatch![0]).toContain(customFeedback.replace(/'/g, "\\'"))
  })
})