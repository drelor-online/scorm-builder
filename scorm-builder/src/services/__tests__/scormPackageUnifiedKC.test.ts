import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import JSZip from 'jszip'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Package - Unified Knowledge Check Handling', () => {
  const createMockContent = (knowledgeCheck: any): EnhancedCourseContent => ({
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
      knowledgeCheck
    }],
    assessment: {
      title: 'Assessment',
      questions: []
    }
  })

  describe('Consistent handling for any number of questions', () => {
    it('should use the same submitAnswer approach for 1 question', async () => {
      const mockCourseContent = createMockContent({
        question: 'What is 2+2?',
        options: ['3', '4', '5'],
        correctAnswer: 1,
        type: 'multiple-choice',
        explanation: 'The answer is 4'
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Should use submitAnswer function, not checkAnswer
      expect(topicHtml).toContain('onclick="submitAnswer()"')
      expect(topicHtml).not.toContain('onclick="checkAnswer')
      expect(topicHtml).not.toContain('onclick="parent.checkAnswer')
      
      // Should have the question structure with data attributes
      expect(topicHtml).toContain('class="question"')
      expect(topicHtml).toContain('data-question-id=')
      
      // Should have submitAnswer function defined
      expect(topicHtml).toContain('function submitAnswer()')
    })

    it('should use the same submitAnswer approach for 2 questions', async () => {
      const mockCourseContent = createMockContent({
        questions: [
          {
            type: 'multiple-choice',
            question: 'What is 2+2?',
            options: ['3', '4', '5'],
            correctAnswer: 1,
            explanation: 'The answer is 4'
          },
          {
            type: 'multiple-choice',
            question: 'What is 3+3?',
            options: ['5', '6', '7'],
            correctAnswer: 1,
            explanation: 'The answer is 6'
          }
        ]
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Should use submitAnswer function
      expect(topicHtml).toContain('onclick="submitAnswer()"')
      
      // Should have 2 questions with proper structure
      const questionMatches = topicHtml.match(/class="question"/g)
      expect(questionMatches).toHaveLength(2)
      
      // Should have submitAnswer function defined
      expect(topicHtml).toContain('function submitAnswer()')
    })

    it('should use the same submitAnswer approach for 3 questions', async () => {
      const mockCourseContent = createMockContent({
        questions: [
          {
            type: 'multiple-choice',
            question: 'What is 2+2?',
            options: ['3', '4', '5'],
            correctAnswer: 1,
            explanation: 'The answer is 4'
          },
          {
            type: 'fill-in-the-blank',
            blank: 'The capital of France is ___',
            correctAnswer: 'Paris',
            explanation: 'Paris is the capital'
          },
          {
            type: 'multiple-choice',
            question: 'What is 5+5?',
            options: ['9', '10', '11'],
            correctAnswer: 1,
            explanation: 'The answer is 10'
          }
        ]
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Should use submitAnswer function
      expect(topicHtml).toContain('onclick="submitAnswer()"')
      
      // Should have 3 questions with proper structure
      const questionMatches = topicHtml.match(/class="question"/g)
      expect(questionMatches).toHaveLength(3)
      
      // Should have submitAnswer function defined
      expect(topicHtml).toContain('function submitAnswer()')
    })

    it('should properly mark knowledge checks as attempted for navigation', async () => {
      const mockCourseContent = createMockContent({
        question: 'What is 2+2?',
        options: ['3', '4', '5'],
        correctAnswer: 1,
        type: 'multiple-choice',
        explanation: 'The answer is 4'
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Should have logic to mark knowledge check as attempted
      expect(topicHtml).toContain('knowledgeCheckAttempts')
      expect(topicHtml).toContain('window.parent.checkKnowledgeCheckCompletion')
    })

    it('should handle mixed question types uniformly', async () => {
      const mockCourseContent = createMockContent({
        questions: [
          {
            type: 'multiple-choice',
            question: 'What is 2+2?',
            options: ['3', '4', '5'],
            correctAnswer: 1,
            explanation: 'The answer is 4'
          },
          {
            type: 'fill-in-the-blank',
            blank: 'The capital of France is ___',
            correctAnswer: 'Paris',
            explanation: 'Paris is the capital'
          }
        ]
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Should handle both question types
      expect(topicHtml).toContain('type="radio"')
      expect(topicHtml).toContain('type="text"')
      
      // Both should use the same submitAnswer approach
      expect(topicHtml).toContain('onclick="submitAnswer()"')
      
      // Should have correct answer structure for both types
      expect(topicHtml).toContain("type: 'multiple-choice'")
      expect(topicHtml).toContain("type: 'fill-in-the-blank'")
    })
  })
})