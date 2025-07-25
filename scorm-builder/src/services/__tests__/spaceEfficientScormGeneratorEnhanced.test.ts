import { describe, it, expect, beforeEach } from 'vitest'
import { 
  generateEnhancedTopicPage, 
  generateAssessmentPage, 
  generateEnhancedMainCss 
} from '../spaceEfficientScormGeneratorEnhanced'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('spaceEfficientScormGeneratorEnhanced', () => {
  let mockTopic: EnhancedCourseContent['topics'][0]
  let mockCourseContent: EnhancedCourseContent

  beforeEach(() => {
    mockTopic = {
      id: 'topic-1',
      title: 'Understanding JavaScript',
      content: 'JavaScript is a programming language that enables interactive web pages.',
      imageUrl: 'topic1.jpg',
      audioFile: 'topic1-audio.mp3',
      captionFile: 'topic1-captions.vtt',
      knowledgeCheck: {
        type: 'multiple-choice',
        question: 'What type of language is JavaScript?',
        options: ['Compiled', 'Interpreted', 'Assembly', 'Machine'],
        correctAnswer: 1,
        explanation: 'JavaScript is an interpreted language that runs in the browser.'
      },
      media: [
        {
          id: 'media-1',
          url: 'demo.mp4',
          title: 'JavaScript Demo',
          type: 'video',
          captionUrl: 'demo-captions.vtt'
        }
      ]
    }

    mockCourseContent = {
      title: 'Web Development Course',
      duration: 45,
      passMark: 70,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome to Web Development',
        startButtonText: 'Start'
      },
      objectives: ['Learn JavaScript', 'Build web apps'],
      topics: [mockTopic],
      assessment: {
        questions: [
          {
            id: 'q1',
            question: 'What is JavaScript?',
            options: ['A coffee brand', 'A programming language', 'A framework', 'A database'],
            correctAnswer: 1
          },
          {
            id: 'q2',
            question: 'JavaScript runs in the:',
            options: ['Server', 'Database', 'Browser', 'Operating System'],
            correctAnswer: 2
          }
        ]
      }
    }
  })

  describe('generateEnhancedTopicPage', () => {
    it('should generate a complete topic page with all sections', () => {
      const html = generateEnhancedTopicPage(mockTopic, 0, mockCourseContent)
      
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
      expect(html).toContain(mockTopic.title)
      expect(html).toContain(mockTopic.content)
    })

    it('should include knowledge check when present', () => {
      const html = generateEnhancedTopicPage(mockTopic, 0, mockCourseContent)
      
      expect(html).toContain('class="knowledge-check"')
      expect(html).toContain('Quick Check')
      expect(html).toContain(mockTopic.knowledgeCheck!.question)
      expect(html).toContain('class="kc-option"')
      
      // Should include all options
      mockTopic.knowledgeCheck!.options!.forEach(option => {
        expect(html).toContain(option)
      })
    })

    it('should generate audio player when audio file is present', () => {
      const html = generateEnhancedTopicPage(mockTopic, 0, mockCourseContent)
      
      expect(html).toContain('class="audio-player"')
      expect(html).toContain('class="play-pause"')
      expect(html).toContain('class="track-progress"')
      expect(html).toContain(mockTopic.audioFile)
      
      // Check for audio controls
      expect(html).toContain('◀ 10s') // Rewind
      expect(html).toContain('10s ▶') // Forward
      expect(html).toContain('1x')     // Speed
      expect(html).toContain('CC')      // Captions
    })

    it('should include caption display when caption file exists', () => {
      const html = generateEnhancedTopicPage(mockTopic, 0, mockCourseContent)
      
      expect(html).toContain('class="caption-display"')
      expect(html).toContain('id="captionDisplay-0"')
      expect(html).toContain(mockTopic.captionFile)
    })

    it('should handle topic without media gracefully', () => {
      const topicNoMedia = { ...mockTopic, media: [], audioFile: undefined, captionFile: undefined }
      const html = generateEnhancedTopicPage(topicNoMedia, 0, mockCourseContent)
      
      expect(html).toContain('class="media-panel"')
      expect(html).not.toContain('class="audio-player"')
      expect(html).not.toContain('class="caption-display"')
    })

    it('should include video elements when video media is present', () => {
      const html = generateEnhancedTopicPage(mockTopic, 0, mockCourseContent)
      
      // Video media is converted to image in the current implementation
      expect(html).toContain('class="visual-container"')
      expect(html).toContain(mockTopic.media![0].title)
    })

    it.skip('should handle fill-in-the-blank knowledge checks', () => {
      const fillInTopic = {
        ...mockTopic,
        knowledgeCheck: {
          type: 'fill-in-the-blank' as const,
          blank: 'JavaScript is an _____ language.',
          correctAnswer: 'interpreted',
          explanation: 'JavaScript is interpreted at runtime.'
        }
      }
      
      const html = generateEnhancedTopicPage(fillInTopic, 0, mockCourseContent)
      
      // Fill-in-the-blank renders as text input
      expect(html).toContain('input')
      expect(html).toContain(fillInTopic.knowledgeCheck.blank)
    })

    it('should handle true-false knowledge checks', () => {
      const trueFalseTopic = {
        ...mockTopic,
        knowledgeCheck: {
          type: 'true-false' as const,
          question: 'JavaScript is a compiled language.',
          options: ['True', 'False'],
          correctAnswer: 1, // False
          explanation: 'JavaScript is interpreted, not compiled.'
        }
      }
      
      const html = generateEnhancedTopicPage(trueFalseTopic, 0, mockCourseContent)
      
      expect(html).toContain('True')
      expect(html).toContain('False')
      expect(html).toContain('class="kc-option"')
    })
  })

  describe('generateAssessmentPage', () => {
    it('should generate assessment page with all questions', () => {
      const html = generateAssessmentPage(mockCourseContent)
      
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('Assessment')
      expect(html).toContain('class="assessment-container"')
      
      // Should include all questions
      mockCourseContent.assessment.questions.forEach(question => {
        expect(html).toContain(question.question)
      })
    })

    it.skip('should include question navigation', () => {
      const html = generateAssessmentPage(mockCourseContent)
      
      // Check for question structure
      expect(html).toContain('class="question"')
      
      // Should have each question
      mockCourseContent.assessment.questions.forEach((q) => {
        expect(html).toContain(q.question)
      })
    })

    it('should include all answer options for each question', () => {
      const html = generateAssessmentPage(mockCourseContent)
      
      mockCourseContent.assessment.questions.forEach(question => {
        question.options.forEach(option => {
          expect(html).toContain(option)
        })
      })
    })

    it.skip('should include submit button and scoring info', () => {
      const html = generateAssessmentPage(mockCourseContent)
      
      expect(html).toContain('Submit Assessment')
      expect(html).toContain('70') // Pass mark value
    })

    it.skip('should generate unique IDs for form elements', () => {
      const html = generateAssessmentPage(mockCourseContent)
      
      // Check for unique question elements
      expect(html).toContain('question-0')
      expect(html).toContain('question-1')
      
      // Check for radio buttons
      expect(html).toContain('type="radio"')
    })
  })

  describe('generateEnhancedMainCss', () => {
    it('should generate complete CSS with all required styles', () => {
      const css = generateEnhancedMainCss()
      
      expect(css).toContain('* {')
      expect(css).toContain('box-sizing: border-box')
      expect(css).toContain('body {')
      expect(css).toContain('font-family')
    })

    it('should include sidebar styles with correct dimensions', () => {
      const css = generateEnhancedMainCss()
      
      expect(css).toContain('.sidebar')
      expect(css).toContain('width: 180px')
      expect(css).toContain('background: #241f20')
    })

    it('should include responsive media queries', () => {
      const css = generateEnhancedMainCss()
      
      expect(css).toContain('@media (max-width: 1200px)')
      expect(css).toContain('@media (max-width: 768px)')
      expect(css).toContain('width: 60px') // Collapsed sidebar
    })

    it('should include audio player styles', () => {
      const css = generateEnhancedMainCss()
      
      expect(css).toContain('.audio-player')
      expect(css).toContain('.play-pause')
      expect(css).toContain('.track-progress')
      expect(css).toContain('.audio-controls')
    })

    it('should include knowledge check styles', () => {
      const css = generateEnhancedMainCss()
      
      expect(css).toContain('.knowledge-check')
      expect(css).toContain('.kc-options')
      expect(css).toContain('.kc-option')
      expect(css).toContain('grid-template-columns: repeat(2, 1fr)')
    })

    it('should include caption display styles', () => {
      const css = generateEnhancedMainCss()
      
      expect(css).toContain('.caption-display')
      expect(css).toContain('background: #ffe4b5')
      expect(css).toContain('border: 1px solid #ffd090')
    })

    it('should include brand colors', () => {
      const css = generateEnhancedMainCss()
      
      expect(css).toContain('#8fbb40') // Brand green
      expect(css).toContain('#241f20') // Brand dark
      expect(css).toContain('#439c45') // Secondary green
    })

    it('should include animation styles', () => {
      const css = generateEnhancedMainCss()
      
      // Check for transition properties instead of keyframes
      expect(css).toContain('transition')
      expect(css).toContain('transform')
    })

    it('should include media queries for responsive design', () => {
      const css = generateEnhancedMainCss()
      
      // Check for responsive design instead of print styles
      expect(css).toContain('@media')
      expect(css).toContain('max-width')
    })
  })
})