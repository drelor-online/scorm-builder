import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import JSZip from 'jszip'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Package - Remaining Issues', () => {
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

  describe('Single Question Knowledge Check Feedback', () => {
    it('should display custom feedback text for single question', async () => {
      const customFeedback = 'The answer is 4 because 2+2=4 according to basic arithmetic'
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
            explanation: customFeedback
          }
        }]
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Should contain the custom feedback text in the JavaScript
      expect(topicHtml).toContain(customFeedback)
      
      // Should store it in correctAnswers object
      expect(topicHtml).toMatch(/correctFeedback:\s*['"].*2\+2=4.*['"]/);
    })

    it('should use custom feedback for fill-in-the-blank questions', async () => {
      const customFeedback = 'Paris has been the capital of France since 987 AD'
      const mockCourseContent = createMockContent({
        topics: [{
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content',
          knowledgeCheck: {
            blank: 'The capital of France is ___',
            correctAnswer: 'Paris',
            type: 'fill-in-the-blank',
            explanation: customFeedback
          }
        }]
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Should contain the custom feedback
      expect(topicHtml).toContain(customFeedback)
    })
  })

  describe('Sidebar Logo Display', () => {
    it('should include proper logo styling without background conflicts', async () => {
      const mockCourseContent = createMockContent()

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check that SVG logo is included
      const logoFile = await zip.file('assets/entrust-logo.svg')
      expect(logoFile).toBeTruthy()
      
      // Check main HTML includes logo with proper class
      const indexHtml = await zip.file('index.html')?.async('string')
      expect(indexHtml).toBeTruthy()
      expect(indexHtml).toContain('logo-img')
      expect(indexHtml).toContain('entrust-logo.svg')
      
      // Check CSS has proper styling
      const mainCss = await zip.file('styles/main.css')?.async('string')
      expect(mainCss).toBeTruthy()
      
      // Logo should not have conflicting background
      expect(mainCss).toContain('.sidebar-logo')
      // Should ensure the sidebar has proper dark background
      expect(mainCss).toMatch(/\.sidebar\s*{[^}]*background:\s*#241f20/)
    })
  })

  describe('Assessment Page Post-Submission Display', () => {
    it('should hide instructions after assessment submission', async () => {
      const mockCourseContent = createMockContent({
        assessment: {
          title: 'Final Assessment',
          questions: [
            {
              question: 'What is 2+2?',
              options: ['3', '4', '5'],
              correctAnswer: 1
            },
            {
              question: 'What is 3+3?',
              options: ['5', '6', '7'],
              correctAnswer: 1
            }
          ]
        }
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check navigation.js for assessment submission logic
      const navJs = await zip.file('scripts/navigation.js')?.async('string')
      expect(navJs).toBeTruthy()
      
      // Should hide form after submission
      expect(navJs).toContain('form.style.display = \'none\'')
      
      // Check assessment page structure
      const assessmentHtml = await zip.file('pages/assessment.html')?.async('string')
      expect(assessmentHtml).toBeTruthy()
      
      // Instructions should be inside the form that gets hidden
      expect(assessmentHtml).toMatch(/<form[^>]*id="assessment-form"[^>]*>[\s\S]*Answer all questions[\s\S]*<\/form>/)
    })

    it('should show results section after submission', async () => {
      const mockCourseContent = createMockContent({
        assessment: {
          title: 'Final Assessment',
          questions: [{
            question: 'Test question?',
            options: ['A', 'B'],
            correctAnswer: 0
          }]
        }
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const navJs = await zip.file('scripts/navigation.js')?.async('string')
      expect(navJs).toBeTruthy()
      
      // Should show feedback section
      expect(navJs).toContain('showAssessmentFeedback')
      expect(navJs).toContain('feedbackSection.style.display = \'block\'')
    })
  })
})