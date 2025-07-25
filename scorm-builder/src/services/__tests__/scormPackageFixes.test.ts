import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import JSZip from 'jszip'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Package Fixes', () => {
  // Create a base mock content that all tests can extend
  const createBaseMockContent = (overrides?: Partial<EnhancedCourseContent>): EnhancedCourseContent => ({
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

  describe('Caption Timing Issues', () => {
    it('should NOT apply caption offset that causes timing drift', async () => {
      const mockCourseContent = createBaseMockContent({
        duration: 120,
        metadata: {
          title: 'Test Course',
          identifier: 'test-course',
          description: '',
          version: '1.0',
          scormVersion: '1.2',
          duration: 120,
          passMark: 80
        },
        welcome: {
          title: 'Welcome',
          content: 'Welcome content',
          audioFile: 'welcome.mp3',
          captionFile: 'welcome.vtt',
          captionBlob: new Blob([`WEBVTT

00:00:00.000 --> 00:00:05.000
Line 1: This should appear at exactly 0 seconds

00:00:05.000 --> 00:00:10.000
Line 2: This should appear at exactly 5 seconds

00:01:50.000 --> 00:01:53.000
Line 3: This should appear at exactly 1:50, not 10 seconds off`], { type: 'text/vtt' })
        }
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check navigation.js for caption timing implementation
      const navJs = await zip.file('scripts/navigation.js')?.async('string')
      expect(navJs).toBeTruthy()
      
      // Should NOT contain CAPTION_OFFSET that causes drift
      expect(navJs).not.toContain('CAPTION_OFFSET = 0.2')
      
      // Should use actual current time without lookahead
      expect(navJs).toContain('const currentTime = audio.currentTime;')
      expect(navJs).toContain('Use actual time to prevent drift')
    })
  })

  describe('Single Question Knowledge Check', () => {
    it('should allow submission with only one question', async () => {
      const mockCourseContent = createBaseMockContent({
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
      
      // Check topic HTML for proper single question handling
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Should have the submit button for single question (now uses unified submitAnswer)
      expect(topicHtml).toContain('<button class="kc-submit" onclick="submitAnswer()"')
      
      // Should have proper single question structure
      expect(topicHtml).toContain('Question (1 total)')
      expect(topicHtml).toContain('What is 2+2?')
      
      // Should have the correct answer stored in the correctAnswers object
      expect(topicHtml).toContain("answer: '1'")
    })
  })

  describe('Image Enlargement on Click', () => {
    it('should make images clickable with enlargement functionality', async () => {
      const mockCourseContent = createBaseMockContent({
        welcome: {
          title: 'Welcome',
          content: 'Welcome',
          media: [{
            id: 'img1',
            type: 'image',
            url: 'test.jpg',
            title: 'Test Image',
            blob: new Blob(['fake image data'], { type: 'image/jpeg' })
          }]
        }
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check navigation.js for enlargeImage function
      const navJs = await zip.file('scripts/navigation.js')?.async('string')
      expect(navJs).toBeTruthy()
      
      // Should have enlargeImage and closeLightbox functions
      expect(navJs).toContain('function enlargeImage')
      expect(navJs).toContain('function closeLightbox')
      expect(navJs).toContain('image-lightbox')
      
      // Check CSS for lightbox styles
      const mainCss = await zip.file('styles/main.css')?.async('string')
      expect(mainCss).toBeTruthy()
      expect(mainCss).toContain('.lightbox-overlay')
      expect(mainCss).toContain('.lightbox-content')
      expect(mainCss).toContain('cursor: pointer')
      
      // Check welcome HTML for clickable images
      const welcomeHtml = await zip.file('pages/welcome.html')?.async('string')
      expect(welcomeHtml).toBeTruthy()
      expect(welcomeHtml).toContain('onclick="parent.enlargeImage')
    })
  })

  describe('Fill-in-the-blank Red/Green Shading', () => {
    it('should add appropriate classes for correct/incorrect fill-in-blank answers', async () => {
      const mockCourseContent = createBaseMockContent({
        topics: [{
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content',
          knowledgeCheck: {
            question: 'The capital of France is ___',
            correctAnswer: 'Paris',
            type: 'fill-in-the-blank',
            explanation: 'Paris is the capital of France'
          }
        }]
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check CSS for fill-in-blank styling
      const mainCss = await zip.file('styles/main.css')?.async('string')
      expect(mainCss).toBeTruthy()
      
      // Should have styles for correct/incorrect text inputs
      expect(mainCss).toContain('input[type="text"].correct')
      expect(mainCss).toContain('input[type="text"].incorrect')
      expect(mainCss).toContain('background-color:')
      expect(mainCss).toContain('border-color:')
      
      // Check topic HTML for class addition logic
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Check that navigation.js has the logic to add classes
      const navJs = await zip.file('scripts/navigation.js')?.async('string')
      expect(navJs).toBeTruthy()
      expect(navJs).toContain('inputElement.classList.add')
      expect(navJs).toContain("isCorrect ? 'correct' : 'incorrect'")
    })
  })

  describe('Page Title and Logo Display', () => {
    it('should not duplicate page titles', async () => {
      const mockCourseContent = createBaseMockContent({
        welcome: {
          title: 'Welcome to the Course',
          content: 'Welcome content'
        },
        objectivesPage: {
          title: 'Learning Objectives',
          objectives: ['Learn stuff']
        },
        topics: [{
          id: 'topic-1',
          title: 'Topic One Title',
          content: 'Topic content'
        }]
      })

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check welcome page for duplicate titles
      const welcomeHtml = await zip.file('pages/welcome.html')?.async('string')
      expect(welcomeHtml).toBeTruthy()
      
      // Count occurrences of the title in h1/h2 tags (not in <title>)
      const welcomeH1Matches = (welcomeHtml.match(/<h[12]>Welcome to the Course<\/h[12]>/g) || []).length
      expect(welcomeH1Matches).toBe(1) // Should only appear once as a heading
      
      // Check topic page - title should NOT be in the content since it's shown in top bar
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      const topicH2Matches = (topicHtml.match(/<h2>Topic One Title<\/h2>/g) || []).length
      expect(topicH2Matches).toBe(0) // Should NOT appear in content (it's in the top bar)
    })

    it('should properly display Entrust logo with transparency', async () => {
      const mockCourseContent = createBaseMockContent()

      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check main CSS for logo styling
      const mainCss = await zip.file('styles/main.css')?.async('string')
      expect(mainCss).toBeTruthy()
      
      // Logo should have proper background handling for transparency
      expect(mainCss).toContain('.sidebar-logo')
      expect(mainCss).toContain('background: transparent')
      
      // Check that SVG is included
      const entrustLogoExists = zip.file('assets/entrust-logo.svg')
      expect(entrustLogoExists).toBeTruthy()
    })
  })
})