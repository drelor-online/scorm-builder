import { describe, it, expect, beforeEach } from 'vitest'
import { generateObjectivesPage } from '../spaceEfficientScormGeneratorPages'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Learning Objectives Page Generation', () => {
  let mockCourseContent: EnhancedCourseContent

  beforeEach(() => {
    mockCourseContent = {
      title: 'Test Course',
      duration: 30,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        startButtonText: 'Start',
        media: []
      },
      objectivesPage: {
        title: 'Learning Objectives',
        objectives: [
          'Understand the fundamentals of the subject',
          'Apply concepts in real-world scenarios',
          'Evaluate different approaches'
        ],
        audioFile: 'objectives-audio.mp3',
        captionFile: 'objectives-captions.vtt',
        media: [
          {
            id: 'img-2',
            url: 'objectives-image.jpg',
            title: 'Objectives Diagram',
            type: 'image',
            blob: new Blob(['fake image data'], { type: 'image/jpeg' })
          }
        ]
      },
      topics: [],
      assessment: {
        questions: [],
        passMark: 80,
        narration: ''
      }
    }
  })

  describe('Objectives Page Content', () => {
    it('should display the objectives title', () => {
      const html = generateObjectivesPage(mockCourseContent)
      
      expect(html).toContain('<h1>Learning Objectives</h1>')
      expect(html).not.toContain('undefined')
    })

    it('should display all objectives as a list', () => {
      const html = generateObjectivesPage(mockCourseContent)
      
      // Should have objectives list
      expect(html).toContain('<div class="objectives-list">')
      expect(html).toContain('<ul>')
      
      // Should contain all objectives
      expect(html).toContain('<li>Understand the fundamentals of the subject</li>')
      expect(html).toContain('<li>Apply concepts in real-world scenarios</li>')
      expect(html).toContain('<li>Evaluate different approaches</li>')
    })

    it('should handle empty objectives gracefully', () => {
      mockCourseContent.objectivesPage!.objectives = []
      const html = generateObjectivesPage(mockCourseContent)
      
      expect(html).toContain('<h1>Learning Objectives</h1>')
      expect(html).toContain('<p>No specific objectives defined for this course.</p>')
      expect(html).not.toContain('undefined')
    })

    it('should handle missing objectivesPage gracefully', () => {
      delete mockCourseContent.objectivesPage
      const html = generateObjectivesPage(mockCourseContent)
      
      expect(html).toContain('<h1>Learning Objectives</h1>')
      expect(html).toContain('<p>No objectives have been defined for this course.</p>')
      expect(html).not.toContain('undefined')
    })
  })

  describe('Objectives Page Audio', () => {
    it('should include audio player when audioFile is provided', () => {
      const html = generateObjectivesPage(mockCourseContent)
      
      expect(html).toContain('<div class="audio-controls">')
      expect(html).toContain('<audio id="narrator"')
      expect(html).toContain('src="media/audio/objectives-audio.mp3"')
    })

    it('should include captions when captionFile is provided', () => {
      const html = generateObjectivesPage(mockCourseContent)
      
      expect(html).toContain('<div id="captionContainer" class="caption-container">')
      expect(html).toContain('<track')
      expect(html).toContain('src="media/captions/objectives-captions.vtt"')
    })
  })

  describe('Objectives Page Media', () => {
    it('should display media images', () => {
      const html = generateObjectivesPage(mockCourseContent)
      
      expect(html).toContain('<div class="objectives-media">')
      expect(html).toContain('<img src="media/images/img-2.jpg"')
      expect(html).toContain('alt="Objectives Diagram"')
    })
  })

  describe('Objectives Page Navigation', () => {
    it('should include navigation buttons', () => {
      const html = generateObjectivesPage(mockCourseContent)
      
      expect(html).toContain('<div class="navigation-buttons">')
      expect(html).toContain('onclick="previousPage()"')
      expect(html).toContain('onclick="nextPage()"')
      expect(html).toContain('Previous')
      expect(html).toContain('Next')
    })
  })
})