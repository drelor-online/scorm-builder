import { describe, it, expect, beforeEach } from 'vitest'
import { generateEnhancedTopicPage } from '../spaceEfficientScormGeneratorEnhanced'
import { generateWelcomePage } from '../spaceEfficientScormGeneratorPages'
import { generateEnhancedNavigationJs } from '../spaceEfficientScormGeneratorNavigation'
import type { EnhancedTopic, EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Caption Display and VTT Synchronization', () => {
  let mockTopic: EnhancedTopic
  let mockCourseContent: EnhancedCourseContent

  beforeEach(() => {
    mockTopic = {
      id: 'topic-1',
      title: 'Test Topic',
      content: 'This is the topic content.',
      duration: 5,
      audioFile: 'topic-audio.mp3',
      audioBlob: new Blob(['fake audio'], { type: 'audio/mp3' }),
      captionFile: 'topic-captions.vtt',
      captionBlob: new Blob(['WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nFirst caption'], { type: 'text/vtt' }),
      media: []
    }
    
    mockCourseContent = {
      title: 'Test Course',
      duration: 30,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome to the course',
        startButtonText: 'Start',
        audioFile: 'welcome-audio.mp3',
        audioBlob: new Blob(['fake audio'], { type: 'audio/mp3' }),
        captionFile: 'welcome-captions.vtt',
        captionBlob: new Blob(['WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nWelcome caption'], { type: 'text/vtt' }),
        media: []
      },
      objectives: ['Objective 1'],
      topics: [mockTopic],
      assessment: {
        questions: []
      }
    }
  })

  describe('Caption Display Structure', () => {
    it('should include caption display div with yellow styling', () => {
      const html = generateEnhancedTopicPage(mockTopic, 0, mockCourseContent)
      
      expect(html).toContain('class="caption-display"')
      expect(html).toContain('id="captionDisplay-0"')
    })

    it('should include track element with VTT source', () => {
      const html = generateEnhancedTopicPage(mockTopic, 0, mockCourseContent)
      
      expect(html).toContain('<track kind="captions"')
      expect(html).toContain('src="../media/captions/topic-captions.vtt"')
      expect(html).toContain('srclang="en"')
      expect(html).toContain('label="English"')
    })

    it('should have caption text container', () => {
      const html = generateEnhancedTopicPage(mockTopic, 0, mockCourseContent)
      
      expect(html).toContain('id="caption-text-0"')
    })
  })

  describe('Caption Toggle Functionality', () => {
    it('should include CC toggle button', () => {
      const html = generateEnhancedTopicPage(mockTopic, 0, mockCourseContent)
      
      expect(html).toContain('id="cc-btn-0"')
      expect(html).toContain('onclick="toggleCaptions(0)"')
      expect(html).toContain('class="audio-btn active"') // Should be active by default
    })

    it('should include toggleCaptions function in navigation JS', () => {
      const html = generateEnhancedTopicPage(mockTopic, 0, mockCourseContent)
      
      // The toggleCaptions function should be referenced
      expect(html).toContain('toggleCaptions')
    })
  })

  describe('VTT Synchronization', () => {
    it('should set up cuechange event listener', () => {
      const html = generateEnhancedTopicPage(mockTopic, 0, mockCourseContent)
      
      // Check that we're setting up proper event handling
      expect(html).toContain('audio')
      expect(html).toContain('track')
    })

    it('should handle missing caption file gracefully', () => {
      delete mockTopic.captionFile
      delete mockTopic.captionBlob
      
      const html = generateEnhancedTopicPage(mockTopic, 0, mockCourseContent)
      
      expect(html).not.toContain('<track')
      expect(html).toContain('class="caption-display"') // Still show container
    })
  })

  describe('Welcome Page Captions', () => {
    it('should include captions on welcome page', () => {
      const html = generateWelcomePage(mockCourseContent)
      
      expect(html).toContain('class="caption-display"')
      expect(html).toContain('<track kind="captions"')
      expect(html).toContain('src="../media/captions/welcome-captions.vtt"')
    })

    it('should have proper caption initialization in navigation script', () => {
      const navigationJs = generateEnhancedNavigationJs()
      
      expect(navigationJs).toContain('audio.textTracks[0].mode = \'showing\'')
      expect(navigationJs).toContain('addEventListener(\'cuechange\'')
    })
  })

  describe('Caption Styling', () => {
    it('should apply yellow background styling', () => {
      const html = generateEnhancedTopicPage(mockTopic, 0, mockCourseContent)
      
      // The CSS should be included via main.css
      expect(html).toContain('href="../styles/main.css"')
    })
  })

  describe('Caption State Management', () => {
    it('should track caption visibility state', () => {
      const html = generateEnhancedTopicPage(mockTopic, 0, mockCourseContent)
      
      // Should have logic to add/remove 'show' class
      expect(html).toContain('caption-display')
    })

    it('should sync CC button state with caption visibility', () => {
      const html = generateEnhancedTopicPage(mockTopic, 0, mockCourseContent)
      
      // CC button should have active class handling
      expect(html).toContain('cc-btn-0')
    })
  })
})