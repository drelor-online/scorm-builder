import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import JSZip from 'jszip'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Package - Media Display and Styling Fixes', () => {
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

  describe('Media Display Issues', () => {
    it('should properly display images in topics', async () => {
      const mockCourseContent = createMockContent({
        topics: [{
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content with image',
          media: [{
            id: 'img1',
            type: 'image',
            url: 'topic-image.jpg',
            title: 'Topic Image',
            blob: new Blob(['fake image data'], { type: 'image/jpeg' })
          }]
        }]
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check that image file exists in media/images
      const imageFile = await zip.file('media/images/img1.jpg')
      expect(imageFile).toBeTruthy()
      
      // Check topic HTML includes image
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Should have visual container with image
      expect(topicHtml).toContain('class="visual-container"')
      expect(topicHtml).toContain('<img')
      expect(topicHtml).toContain('src="../media/images/img1.jpg"')
      expect(topicHtml).toContain('onclick="parent.enlargeImage')
    })

    it('should properly display videos in topics', async () => {
      const mockCourseContent = createMockContent({
        topics: [{
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content with video',
          media: [{
            id: 'vid1',
            type: 'video',
            url: 'https://www.youtube.com/watch?v=abc123',
            embedUrl: 'https://www.youtube.com/embed/abc123',
            title: 'Topic Video'
          }]
        }]
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Should have video container with iframe
      expect(topicHtml).toContain('class="video-container"')
      expect(topicHtml).toContain('<iframe')
      expect(topicHtml).toContain('youtube.com/embed/')
    })
  })

  describe('Enhanced Feedback Styling', () => {
    it('should style correct answers with green background', async () => {
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
      
      // Check CSS for correct answer styling
      const mainCss = await zip.file('styles/main.css')?.async('string')
      expect(mainCss).toBeTruthy()
      
      // Should have styles for correct answer options
      expect(mainCss).toContain('.kc-option.correct')
      expect(mainCss).toContain('background-color:')
      
      // Check JavaScript for adding correct class
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Should add 'correct' class to correct answer
      expect(topicHtml).toMatch(/correctOption.*classList\.add\(['"]correct['"]\)/)
    })

    it('should style incorrect answers with red background', async () => {
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
      
      // Check CSS for incorrect answer styling
      const mainCss = await zip.file('styles/main.css')?.async('string')
      expect(mainCss).toBeTruthy()
      
      // Should have styles for incorrect answer options
      expect(mainCss).toContain('.kc-option.incorrect')
      expect(mainCss).toContain('background-color:')
      
      // Check JavaScript for adding incorrect class
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Should add 'incorrect' class to selected wrong answer
      expect(topicHtml).toMatch(/radioInput\.parentElement.*classList\.add\(['"]incorrect['"]\)/)
    })
  })

  describe('Sidebar Styling', () => {
    it('should use bold text instead of green background for current page', async () => {
      const mockCourseContent = createMockContent()

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check CSS for active nav item styling
      const mainCss = await zip.file('styles/main.css')?.async('string')
      expect(mainCss).toBeTruthy()
      
      // Should use bold font-weight for active
      expect(mainCss).toMatch(/\.nav-item\.active\s*{[^}]*font-weight:\s*700/)
      // Should NOT use solid green background
      expect(mainCss).not.toMatch(/\.nav-item\.active\s*{[^}]*background:\s*#8fbb40/)
      
      // Should still have blue text color visible
      expect(mainCss).toMatch(/\.nav-item\.active\s*{[^}]*color:\s*#007acc/)
    })

    it('should have proper logo styling without color issues', async () => {
      const mockCourseContent = createMockContent()

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check that logo SVG is included
      const logoFile = await zip.file('assets/entrust-logo.svg')
      expect(logoFile).toBeTruthy()
      
      // Check CSS for logo styling
      const mainCss = await zip.file('styles/main.css')?.async('string')
      expect(mainCss).toBeTruthy()
      
      // Logo container should have proper background
      expect(mainCss).toContain('.sidebar-logo')
      expect(mainCss).toMatch(/\.sidebar-logo\s*{[^}]*background:\s*(transparent|#2c3e50)/)
    })
  })
})