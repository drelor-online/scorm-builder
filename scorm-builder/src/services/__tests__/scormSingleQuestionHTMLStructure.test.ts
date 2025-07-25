import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Single Question HTML Structure', () => {
  it('should check HTML structure and button onclick', async () => {
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
    
    // Check submit button
    const submitMatch = topicHtml!.match(/<button[^>]*class="kc-submit"[^>]*>(.*?)<\/button>/s)
    expect(submitMatch).toBeTruthy()
    console.log('\n=== Submit Button ===')
    console.log(submitMatch![0])
    
    // Check it has onclick="submitAnswer()"
    expect(submitMatch![0]).toContain('onclick="submitAnswer()"')
    
    // Check question structure
    const questionMatch = topicHtml!.match(/<div[^>]*class="question"[^>]*data-question-id="q1"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*id="kc-feedback-q1"/s)
    expect(questionMatch).toBeTruthy()
    console.log('\n=== Question Structure ===')
    console.log(questionMatch![0])
    
    // Check feedback div structure
    const feedbackMatch = topicHtml!.match(/<div[^>]*id="kc-feedback-q1"[^>]*>([\s\S]*?)<\/div>/s)
    expect(feedbackMatch).toBeTruthy()
    console.log('\n=== Feedback Structure ===')
    console.log(feedbackMatch![0])
    
    // Check radio inputs
    const radioMatches = topicHtml!.match(/<input[^>]*type="radio"[^>]*name="q1"[^>]*>/g)
    expect(radioMatches).toBeTruthy()
    expect(radioMatches!.length).toBe(3) // 3 options
    console.log('\n=== Radio Inputs ===')
    radioMatches!.forEach((radio, i) => {
      console.log(`Option ${i}: ${radio}`)
    })
  })
})