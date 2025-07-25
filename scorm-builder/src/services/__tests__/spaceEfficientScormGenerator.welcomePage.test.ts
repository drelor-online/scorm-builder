import { describe, it, expect, beforeEach } from 'vitest'
import { generateWelcomePage } from '../spaceEfficientScormGeneratorPages'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Welcome Page Generation', () => {
  let mockCourseContent: EnhancedCourseContent

  beforeEach(() => {
    mockCourseContent = {
      title: 'Test Course',
      duration: 30,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome to Test Course',
        content: 'This is the welcome content.',
        startButtonText: 'Start Course',
        audioFile: 'welcome-audio.mp3',
        captionFile: 'welcome-captions.vtt',
        media: [
          {
            id: 'img-1',
            url: 'welcome-image.jpg',
            title: 'Welcome Image',
            type: 'image',
            blob: new Blob(['fake image data'], { type: 'image/jpeg' })
          }
        ]
      },
      objectivesPage: {
        title: 'Learning Objectives',
        objectives: ['Objective 1', 'Objective 2'],
        media: []
      },
      topics: [],
      assessment: {
        questions: [],
        passMark: 80,
        narration: ''
      }
    }
  })

  describe('Welcome Page Audio Player', () => {
    it('should include audio player when audioFile is provided', () => {
      const html = generateWelcomePage(mockCourseContent)
      
      // Should have audio player container
      expect(html).toContain('<div class="audio-controls">')
      expect(html).toContain('<audio id="narrator"')
      expect(html).toContain('src="media/audio/welcome-audio.mp3"')
      
      // Should have play/pause button
      expect(html).toContain('id="playPauseBtn"')
      expect(html).toContain('Play Audio')
      
      // Should have progress bar
      expect(html).toContain('class="progress-bar"')
      expect(html).toContain('id="progressBar"')
      
      // Should have time display
      expect(html).toContain('<span id="currentTime">0:00</span>')
      expect(html).toContain('<span id="totalTime">0:00</span>')
    })

    it('should not include audio player when audioFile is not provided', () => {
      delete mockCourseContent.welcome.audioFile
      const html = generateWelcomePage(mockCourseContent)
      
      expect(html).not.toContain('<div class="audio-controls">')
      expect(html).not.toContain('<audio id="narrator"')
    })
  })

  describe('Welcome Page Captions', () => {
    it('should include caption display when captionFile is provided', () => {
      const html = generateWelcomePage(mockCourseContent)
      
      // Should have caption container
      expect(html).toContain('<div id="captionContainer" class="caption-container">')
      expect(html).toContain('<div id="captionText" class="caption-text"></div>')
      
      // Should have track element for captions
      expect(html).toContain('<track')
      expect(html).toContain('kind="captions"')
      expect(html).toContain('src="media/captions/welcome-captions.vtt"')
      expect(html).toContain('default')
    })

    it('should apply yellow caption styling', () => {
      const html = generateWelcomePage(mockCourseContent)
      
      // Check for caption styling
      expect(html).toContain('.caption-container {')
      expect(html).toContain('background-color: #fffbf0')
      expect(html).toContain('border: 2px solid #f0e68c')
      expect(html).toContain('position: fixed')
      expect(html).toContain('bottom: 20px')
    })
  })

  describe('Welcome Page Media Display', () => {
    it('should display images inline with content, not in media window', () => {
      const html = generateWelcomePage(mockCourseContent)
      
      // Should have image in content area
      expect(html).toContain('<div class="welcome-media">')
      expect(html).toContain('<img src="media/images/img-1.jpg"')
      expect(html).toContain('alt="Welcome Image"')
      
      // Should NOT have media carousel/window
      expect(html).not.toContain('class="media-window"')
      expect(html).not.toContain('class="media-carousel"')
      expect(html).not.toContain('Media Viewer')
    })

    it('should handle multiple media items', () => {
      mockCourseContent.welcome.media?.push({
        id: 'img-2',
        url: 'second-image.jpg',
        title: 'Second Image',
        type: 'image',
        blob: new Blob(['fake image data 2'], { type: 'image/jpeg' })
      })

      const html = generateWelcomePage(mockCourseContent)
      
      // Should display both images
      expect(html).toContain('src="media/images/img-1.jpg"')
      expect(html).toContain('src="media/images/img-2.jpg"')
      expect(html).toContain('alt="Welcome Image"')
      expect(html).toContain('alt="Second Image"')
    })
  })

  describe('Audio Player Functionality', () => {
    it('should include JavaScript for audio player controls', () => {
      const html = generateWelcomePage(mockCourseContent)
      
      // Should have audio control functions
      expect(html).toContain('function initAudioPlayer()')
      expect(html).toContain('audio.addEventListener("loadedmetadata"')
      expect(html).toContain('audio.addEventListener("timeupdate"')
      expect(html).toContain('playPauseBtn.addEventListener("click"')
      expect(html).toContain('progressBar.addEventListener("click"')
    })

    it('should format time correctly in audio player', () => {
      const html = generateWelcomePage(mockCourseContent)
      
      expect(html).toContain('function formatTime(seconds)')
      expect(html).toContain('Math.floor(seconds / 60)')
      expect(html).toContain('Math.floor(seconds % 60)')
      expect(html).toContain('toString().padStart(2, "0")')
    })
  })

  describe('Caption Synchronization', () => {
    it('should include VTT caption parsing and display logic', () => {
      const html = generateWelcomePage(mockCourseContent)
      
      // Should have caption synchronization
      expect(html).toContain('function loadCaptions()')
      expect(html).toContain('fetch("media/captions/welcome-captions.vtt")')
      expect(html).toContain('parseVTT(')
      expect(html).toContain('function updateCaptions(currentTime)')
      expect(html).toContain('captionText.textContent')
    })

    it('should parse VTT format correctly', () => {
      const html = generateWelcomePage(mockCourseContent)
      
      expect(html).toContain('function parseVTT(vttText)')
      expect(html).toContain('WEBVTT')
      expect(html).toContain('-->')
      expect(html).toContain('parseTimestamp(')
    })
  })
})