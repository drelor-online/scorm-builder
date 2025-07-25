import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import JSZip from 'jszip'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Package - Remaining Fixes', () => {
  const createMockContent = (overrides?: Partial<EnhancedCourseContent>): EnhancedCourseContent => ({
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
    topics: [],
    assessment: {
      title: 'Assessment',
      questions: []
    },
    ...overrides
  })

  describe('Submit Answer Alert Replacement', () => {
    it('should NOT use native alert in submitAnswer function', async () => {
      const mockCourseContent = createMockContent({
        topics: [{
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content',
          knowledgeCheck: {
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
          }
        }]
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check topic HTML for submitAnswer function
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Extract the submitAnswer function (looking for the complete function including nested braces)
      const scriptMatch = topicHtml?.match(/<script>[\s\S]*?<\/script>/g)
      expect(scriptMatch).toBeTruthy()
      
      // Find the script containing submitAnswer
      const submitAnswerScript = scriptMatch?.find(script => script.includes('function submitAnswer()'))
      expect(submitAnswerScript).toBeTruthy()
      
      // Should NOT contain native alert
      expect(submitAnswerScript).not.toMatch(/\balert\s*\(/)
      
      // Should use custom alert instead (checking for parent.showCustomAlert pattern)
      expect(submitAnswerScript).toMatch(/parent\.showCustomAlert|window\.showCustomAlert/)
    })
  })

  describe('Page Title Duplication', () => {
    it('should NOT show page title in both content and top bar', async () => {
      const mockCourseContent = createMockContent({
        topics: [{
          id: 'topic-1',
          title: 'Understanding Electricity',
          content: 'Topic content'
        }]
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check topic HTML
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Should NOT have title in the content (since it's shown in top bar)
      const contentSection = topicHtml?.match(/<div class="text-section">[\s\S]*?<\/div>\s*<div class="media-panel">/)?.[0]
      expect(contentSection).toBeTruthy()
      
      // Should NOT contain an h2 with the topic title in the content
      expect(contentSection).not.toContain('<h2>Understanding Electricity</h2>')
    })
  })

  describe('Sidebar Navigation Prevention', () => {
    it('should prevent sidebar navigation when knowledge check not attempted', async () => {
      const mockCourseContent = createMockContent({
        topics: [{
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content',
          knowledgeCheck: {
            question: 'What is 2+2?',
            options: ['3', '4', '5'],
            correctAnswer: 1,
            type: 'multiple-choice',
            explanation: 'The answer is 4'
          }
        }, {
          id: 'topic-2',
          title: 'Topic 2',
          content: 'Content 2'
        }]
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check navigation.js for sidebar click handling
      const navJs = await zip.file('scripts/navigation.js')?.async('string')
      expect(navJs).toBeTruthy()
      
      // loadPage function should check shouldBlockNavigation
      expect(navJs).toContain('function loadPage(pageId)')
      
      // Should check navigation blocking in loadPage
      const loadPageFunc = navJs?.match(/function loadPage\(pageId\)\s*{[\s\S]*?^}/m)?.[0]
      expect(loadPageFunc).toBeTruthy()
      expect(loadPageFunc).toContain('shouldBlockNavigation()')
      
      // Should have proper blocking logic that applies to sidebar clicks
      expect(loadPageFunc).toMatch(/if.*shouldBlockNavigation.*showCustomAlert.*return/s)
    })
  })

  describe('Knowledge Check Button Consistency', () => {
    it('should use consistent button text for single question', async () => {
      const mockCourseContent = createMockContent({
        topics: [{
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content',
          knowledgeCheck: {
            question: 'What is 2+2?',
            options: ['3', '4', '5'],
            correctAnswer: 1,
            type: 'multiple-choice',
            explanation: 'The answer is 4'
          }
        }]
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Should have "Submit Answer" button text for single question
      expect(topicHtml).toContain('>Submit Answer</button>')
      expect(topicHtml).not.toContain('>Check Answer</button>')
    })

    it('should use consistent button text for multiple questions', async () => {
      const mockCourseContent = createMockContent({
        topics: [{
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content',
          knowledgeCheck: {
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
          }
        }]
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Should have "Submit Answer" button text for multiple questions
      expect(topicHtml).toContain('>Submit Answer</button>')
      expect(topicHtml).not.toContain('>Check Answer</button>')
    })
  })
})