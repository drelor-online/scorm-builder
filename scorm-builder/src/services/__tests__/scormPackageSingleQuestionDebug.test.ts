import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Single Question Debug', () => {
  it('should debug single question feedback issue', async () => {
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
    
    // Log the relevant parts
    console.log('\n=== DEBUGGING SINGLE QUESTION FEEDBACK ===')
    
    // Find the correctAnswers object
    const correctAnswersMatch = topicHtml!.match(/const correctAnswers = {([^}]+)}/s)
    if (correctAnswersMatch) {
      console.log('correctAnswers object:', correctAnswersMatch[0])
    }
    
    // Check if custom feedback is in the HTML
    const feedbackInHtml = topicHtml!.includes(customFeedback)
    console.log('Custom feedback in HTML:', feedbackInHtml)
    console.log('Searching for:', customFeedback)
    
    // Look for where the feedback might be truncated
    const feedbackMatches = topicHtml!.match(/correctFeedback:\s*'([^']+)'/g)
    if (feedbackMatches) {
      console.log('Found feedback strings:', feedbackMatches)
    }
    
    // Check for feedback element IDs
    const feedbackElementMatch = topicHtml!.match(/id="kc-feedback-[^"]+"/g)
    if (feedbackElementMatch) {
      console.log('Feedback element IDs:', feedbackElementMatch)
    }
    
    // Check the actual feedback assignment in submitAnswer
    const submitAnswerMatch = topicHtml!.match(/feedbackText\.textContent = isCorrect[\s\S]*?;/g)
    if (submitAnswerMatch) {
      console.log('Feedback assignment:', submitAnswerMatch)
    }
    
    console.log('=== END DEBUG ===\n')
    
    // The test assertion
    expect(topicHtml).toContain(customFeedback)
  })
})