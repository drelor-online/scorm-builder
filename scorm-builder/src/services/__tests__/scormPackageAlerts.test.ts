import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import JSZip from 'jszip'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Package - Custom Alert System', () => {
  const createMockContent = (): EnhancedCourseContent => ({
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
        explanation: 'The answer is 4'
      }
    }],
    assessment: {
      title: 'Assessment',
      questions: []
    }
  })

  describe('Native Alert Replacement', () => {
    it('should NOT use native alert() calls', async () => {
      const mockCourseContent = createMockContent()
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check navigation.js for alert() calls
      const navJs = await zip.file('scripts/navigation.js')?.async('string')
      expect(navJs).toBeTruthy()
      
      // Should not contain native alert calls
      expect(navJs).not.toMatch(/\balert\s*\(/)
    })

    it('should include custom alert styles in CSS', async () => {
      const mockCourseContent = createMockContent()
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check CSS for custom alert styles
      const mainCss = await zip.file('styles/main.css')?.async('string')
      expect(mainCss).toBeTruthy()
      
      // Should have custom alert/notification styles
      expect(mainCss).toContain('.scorm-alert')
      expect(mainCss).toContain('.scorm-alert.show')
      expect(mainCss).toContain('@keyframes slideIn')
    })

    it('should include showCustomAlert function in navigation.js', async () => {
      const mockCourseContent = createMockContent()
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check navigation.js for custom alert function
      const navJs = await zip.file('scripts/navigation.js')?.async('string')
      expect(navJs).toBeTruthy()
      
      // Should have custom alert function
      expect(navJs).toContain('function showCustomAlert')
      expect(navJs).toContain('scorm-alert')
    })

    it('should create alert container element in HTML pages', async () => {
      const mockCourseContent = createMockContent()
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check that pages include the alert container
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      expect(topicHtml).toContain('<div id="scorm-alert-container"')
      
      // Check main index.html
      const indexHtml = await zip.file('index.html')?.async('string')
      expect(indexHtml).toBeTruthy()
      expect(indexHtml).toContain('<div id="scorm-alert-container"')
    })

    it('should replace specific alert messages with custom alerts', async () => {
      const mockCourseContent = createMockContent()
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const navJs = await zip.file('scripts/navigation.js')?.async('string')
      expect(navJs).toBeTruthy()
      
      // Check that common alert messages are replaced
      expect(navJs).toContain('showCustomAlert')
      
      // Should handle various alert scenarios
      expect(navJs).toMatch(/showCustomAlert.*Please answer all questions/i)
      expect(navJs).toMatch(/showCustomAlert.*Please select an answer/i)
      expect(navJs).toMatch(/showCustomAlert.*Please enter an answer/i)
    })
  })
})