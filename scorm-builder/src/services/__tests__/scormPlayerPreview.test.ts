import { describe, it, expect, vi } from 'vitest'
import { generateSCORMPlayerPreviewHTML } from '../scormPlayerPreview'
import type { CourseContent } from '../../types/aiPrompt'
import type { CourseSeedData } from '../../types/course'

// Mock sanitization
vi.mock('../../utils/sanitization', () => ({
  sanitizeHTML: (html: string) => html // Return as-is for testing
}))

describe('generateSCORMPlayerPreviewHTML', () => {
  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    courseObjective: 'Learn testing',
    targetAudience: 'Developers',
    estimatedDuration: 60,
    topics: ['Topic 1', 'Topic 2']
  }
  
  const mockCourseContent: CourseContent = {
    welcomePage: {
      content: '<h1>Welcome</h1><p>Welcome to the course</p>',
      narration: 'Welcome narration text'
    },
    learningObjectivesPage: {
      content: '<ul><li>Objective 1</li><li>Objective 2</li></ul>',
      narration: 'Objectives narration text'
    },
    topics: [
      {
        title: 'Topic 1',
        content: '<h2>Topic 1</h2><p>Topic 1 content</p>',
        narration: 'Topic 1 narration',
        media: [{ id: 'media1', type: 'image', url: 'image1.jpg' }]
      },
      {
        title: 'Topic 2',
        content: '<h2>Topic 2</h2><p>Topic 2 content</p>',
        narration: 'Topic 2 narration',
        media: []
      }
    ],
    assessment: {
      questions: [
        {
          question: 'What is 2 + 2?',
          options: ['3', '4', '5', '6'],
          correctAnswer: '4',
          explanation: 'Basic math'
        },
        {
          question: 'True or False: Testing is important',
          options: ['True', 'False'],
          correctAnswer: 'True',
          explanation: 'Testing prevents bugs'
        }
      ]
    }
  }
  
  describe('Page rendering', () => {
    it('should render welcome page by default', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData)
      
      expect(html).toContain('<title>Test Course - SCORM Player</title>')
      expect(html).toContain('Welcome to the course')
      expect(html).toContain('Welcome narration text')
      expect(html).toContain('class="nav-item active"')
    })
    
    it('should render welcome page when explicitly specified', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData, 'welcome')
      
      expect(html).toContain('Welcome to the course')
      expect(html).toContain('data-page="welcome"')
    })
    
    it('should render objectives page', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData, 'objectives')
      
      expect(html).toContain('Learning Objectives')
      expect(html).toContain('<li>Objective 1</li>')
      expect(html).toContain('<li>Objective 2</li>')
      expect(html).toContain('Objectives narration text')
    })
    
    it('should render topic pages', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData, 'topic-0')
      
      expect(html).toContain('Topic 1')
      expect(html).toContain('Topic 1 content')
      expect(html).toContain('Topic 1 narration')
    })
    
    it('should render assessment page', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData, 'assessment')
      
      expect(html).toContain('Assessment')
      expect(html).toContain('What is 2 + 2?')
      expect(html).toContain('True or False: Testing is important')
      expect(html).toContain('class="assessment-question"')
      expect(html).toContain('type="radio"')
    })
    
    it('should handle non-existent topic page', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData, 'topic-99')
      
      expect(html).toContain('Not Found')
      expect(html).toContain('Page not found')
    })
  })
  
  describe('Progress calculation', () => {
    it('should show 0% progress on welcome page', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData, 'welcome')
      
      expect(html).toContain('0%')
      expect(html).toContain('width: 0%')
    })
    
    it('should calculate correct progress for objectives page', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData, 'objectives')
      
      // With 5 total pages (welcome, objectives, 2 topics, assessment)
      // Objectives is page 1 of 4 (0-indexed), so 1/4 = 25%
      expect(html).toContain('25%')
      expect(html).toContain('width: 25%')
    })
    
    it('should show 100% progress on assessment page', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData, 'assessment')
      
      expect(html).toContain('100%')
      expect(html).toContain('width: 100%')
    })
  })
  
  describe('Navigation rendering', () => {
    it('should render all navigation items', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData)
      
      expect(html).toContain('data-page="welcome"')
      expect(html).toContain('data-page="objectives"')
      expect(html).toContain('data-page="topic-0"')
      expect(html).toContain('data-page="topic-1"')
      expect(html).toContain('data-page="assessment"')
    })
    
    it('should mark current page as active', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData, 'topic-1')
      
      // Check that topic-1 has active class
      expect(html).toContain('class="nav-item active" data-page="topic-1"')
    })
    
    it('should include correct page titles in navigation', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData)
      
      expect(html).toContain('Welcome')
      expect(html).toContain('Learning Objectives')
      expect(html).toContain('Topic 1')
      expect(html).toContain('Topic 2')
      expect(html).toContain('Assessment')
    })
  })
  
  describe('Media handling', () => {
    it('should display media if present', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData, 'topic-0')
      
      // Topic 0 has media
      expect(html).toContain('class="visual-container"')
      expect(html).toContain('<img src="image1.jpg"')
    })
    
    it('should always show audio player section', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData, 'topic-1')
      
      // Audio player is always present
      expect(html).toContain('class="audio-player"')
      expect(html).toContain('Topic 2 narration')
    })
  })
  
  describe('Edge cases', () => {
    it('should handle empty course content', () => {
      const emptyCourseContent: CourseContent = {
        welcomePage: { content: '', narration: '' },
        learningObjectivesPage: { content: '', narration: '' },
        topics: [],
        assessment: { questions: [] }
      }
      
      const html = generateSCORMPlayerPreviewHTML(emptyCourseContent, mockCourseSeedData)
      
      expect(html).toBeDefined()
      expect(html).toContain('Welcome')
      expect(html).toContain('Learning Objectives')
      expect(html).toContain('Assessment')
    })
    
    it('should handle assessment questions without options', () => {
      const courseContentNoOptions: CourseContent = {
        ...mockCourseContent,
        assessment: {
          questions: [{
            question: 'Essay question',
            correctAnswer: 'N/A',
            explanation: 'Essay'
          }]
        }
      }
      
      const html = generateSCORMPlayerPreviewHTML(courseContentNoOptions, mockCourseSeedData, 'assessment')
      
      expect(html).toContain('Essay question')
      // The options div is rendered but empty when there are no options
      expect(html).toContain('<div class="options">')
      // Check that the content between the options div tags is just whitespace
      const optionsMatch = html.match(/<div class="options">\s*<\/div>/)
      expect(optionsMatch).toBeTruthy()
    })
    
    it('should sanitize HTML content', () => {
      const maliciousCourseContent: CourseContent = {
        ...mockCourseContent,
        welcomePage: {
          content: '<script>alert("XSS")</script><p>Safe content</p>',
          narration: 'Safe narration'
        }
      }
      
      const html = generateSCORMPlayerPreviewHTML(maliciousCourseContent, mockCourseSeedData)
      
      // Since we mocked sanitizeHTML to return as-is, the script will be present
      // In real usage, sanitizeHTML would remove it
      expect(html).toContain('<script>alert("XSS")</script>')
      expect(html).toContain('Safe content')
    })
  })
  
  describe('CSS and styling', () => {
    it('should include all required CSS classes', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData)
      
      // Check for main layout classes
      expect(html).toContain('class="scorm-container"')
      expect(html).toContain('class="sidebar"')
      expect(html).toContain('class="main-area"')
      expect(html).toContain('class="top-bar"')
      expect(html).toContain('class="content-container"')
      
      // Check for navigation classes
      expect(html).toContain('class="sidebar-nav"')
      expect(html).toContain('class="nav-item')
      expect(html).toContain('class="nav-number"')
      
      // Check for progress classes
      expect(html).toContain('class="progress-bar"')
      expect(html).toContain('class="progress-fill"')
    })
    
    it('should include responsive viewport meta tag', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData)
      
      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">')
    })
  })
  
  describe('Navigation buttons', () => {
    it('should disable previous button on first page', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData, 'welcome')
      
      expect(html).toContain('<button class="nav-btn" id="prev-btn" disabled>')
    })
    
    it('should disable next button on last page', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData, 'assessment')
      
      expect(html).toContain('<button class="nav-btn" id="next-btn" disabled>')
    })
    
    it('should enable both buttons on middle pages', () => {
      const html = generateSCORMPlayerPreviewHTML(mockCourseContent, mockCourseSeedData, 'topic-0')
      
      expect(html).toContain('<button class="nav-btn" id="prev-btn" >')
      expect(html).toContain('<button class="nav-btn" id="next-btn" >')
      expect(html).not.toContain('id="prev-btn" disabled')
      expect(html).not.toContain('id="next-btn" disabled')
    })
  })
})