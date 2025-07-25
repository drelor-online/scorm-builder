import { describe, it, expect, beforeEach } from 'vitest'
import { generateEnhancedTopicPage } from '../spaceEfficientScormGeneratorEnhanced'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent, EnhancedTopic } from '../spaceEfficientScormGenerator'
import JSZip from 'jszip'

describe('SCORM Caption Display and VTT Timing', () => {
  let mockTopic: EnhancedTopic
  let mockCourseContent: EnhancedCourseContent
  const mockVTTContent = `WEBVTT

00:00:00.000 --> 00:00:03.000
Welcome to this course on natural gas safety.

00:00:03.500 --> 00:00:07.000
In this section, we'll cover the fundamental principles.

00:00:07.500 --> 00:00:12.000
Safety is our top priority when working with natural gas.`

  beforeEach(() => {
    mockTopic = {
      id: 'topic-1',
      title: 'Test Topic',
      content: 'Topic content',
      duration: 5,
      audioFile: 'topic-1-audio.mp3',
      audioBlob: new Blob(['fake audio'], { type: 'audio/mp3' }),
      captionFile: 'topic-1-captions.vtt',
      captionBlob: new Blob([mockVTTContent], { type: 'text/vtt' }),
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
        content: 'Welcome content',
        startButtonText: 'Start',
        media: []
      },
      objectivesPage: {
        title: 'Objectives',
        objectives: [],
        media: []
      },
      topics: [mockTopic],
      assessment: {
        questions: [],
        passMark: 80,
        narration: ''
      }
    }
  })

  describe('Caption Container Display', () => {
    it('should display captions in yellow window below audio player', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, 10)
      
      // Should have caption container
      expect(html).toContain('<div id="captionContainer" class="caption-container">')
      expect(html).toContain('<div id="captionText" class="caption-text"></div>')
      
      // Should have proper styling
      expect(html).toContain('.caption-container {')
      expect(html).toContain('background-color: #fffbf0') // Light yellow background
      expect(html).toContain('border: 2px solid #f0e68c') // Yellow border
      expect(html).toContain('position: fixed')
      expect(html).toContain('bottom: 20px')
      expect(html).toContain('left: 50%')
      expect(html).toContain('transform: translateX(-50%)')
      expect(html).toContain('max-width: 80%')
      expect(html).toContain('z-index: 1000')
    })

    it('should not display media viewer for captions', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, 10)
      
      // Should NOT have "Narration" in media viewer
      expect(html).not.toContain('>Narration<')
      expect(html).not.toContain('class="media-item-title">Narration')
    })

    it('should hide caption container when no captions are available', () => {
      delete mockTopic.captionFile
      delete mockTopic.captionBlob
      
      const html = generateEnhancedTopicPage(mockTopic, 3, 10)
      
      expect(html).not.toContain('<div id="captionContainer"')
      expect(html).not.toContain('caption-container')
    })
  })

  describe('VTT File Handling', () => {
    it('should include VTT files in SCORM package', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check that VTT file exists
      expect(zip.file('media/captions/topic-1-captions.vtt')).toBeTruthy()
      
      // Verify VTT content
      const vttContent = await zip.file('media/captions/topic-1-captions.vtt')?.async('string')
      expect(vttContent).toBe(mockVTTContent)
    })

    it('should handle missing caption blobs', async () => {
      delete mockTopic.captionBlob
      
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // VTT file should not exist if blob is missing
      expect(zip.file('media/captions/topic-1-captions.vtt')).toBeNull()
    })
  })

  describe('Caption Synchronization JavaScript', () => {
    it('should include VTT parsing and synchronization code', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, 10)
      
      // Should have caption loading function
      expect(html).toContain('function loadCaptions()')
      expect(html).toContain('fetch("media/captions/topic-1-captions.vtt")')
      expect(html).toContain('.then(response => response.text())')
      expect(html).toContain('parseVTT(vttText)')
      
      // Should have VTT parser
      expect(html).toContain('function parseVTT(vttText)')
      expect(html).toContain('const lines = vttText.trim().split("\\n")')
      expect(html).toContain('if (lines[0] !== "WEBVTT")')
      expect(html).toContain('-->')
      
      // Should parse timestamps
      expect(html).toContain('function parseTimestamp(timestamp)')
      expect(html).toContain('split(":")')
      expect(html).toContain('parseFloat')
    })

    it('should update captions based on audio time', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, 10)
      
      // Should have caption update function
      expect(html).toContain('function updateCaptions(currentTime)')
      expect(html).toContain('captions.find(caption =>')
      expect(html).toContain('currentTime >= caption.start && currentTime <= caption.end')
      expect(html).toContain('captionText.textContent = currentCaption.text')
      expect(html).toContain('captionContainer.style.display = "block"')
    })

    it('should sync captions with audio timeupdate event', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, 10)
      
      // Should connect to audio player
      expect(html).toContain('audio.addEventListener("timeupdate", function()')
      expect(html).toContain('updateCaptions(audio.currentTime)')
    })
  })

  describe('Caption Styling', () => {
    it('should style caption text for readability', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, 10)
      
      expect(html).toContain('.caption-text {')
      expect(html).toContain('color: #333') // Dark text on light background
      expect(html).toContain('font-size: 16px')
      expect(html).toContain('line-height: 1.5')
      expect(html).toContain('padding: 15px 20px')
      expect(html).toContain('text-align: center')
    })

    it('should include smooth transitions for caption changes', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, 10)
      
      expect(html).toContain('transition: opacity 0.3s ease')
    })
  })

  describe('Caption Error Handling', () => {
    it('should handle VTT loading errors gracefully', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, 10)
      
      expect(html).toContain('.catch(error =>')
      expect(html).toContain('console.error("Failed to load captions:", error)')
      expect(html).toContain('captionContainer.style.display = "none"')
    })

    it('should handle malformed VTT files', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, 10)
      
      expect(html).toContain('console.error("Invalid VTT file")')
      expect(html).toContain('return []') // Return empty captions array
    })
  })

  describe('Accessibility', () => {
    it('should include proper ARIA attributes for captions', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, 10)
      
      expect(html).toContain('role="complementary"')
      expect(html).toContain('aria-live="polite"')
      expect(html).toContain('aria-label="Captions"')
    })

    it('should include track element for native caption support', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, 10)
      
      expect(html).toContain('<track')
      expect(html).toContain('kind="captions"')
      expect(html).toContain('srclang="en"')
      expect(html).toContain('label="English"')
      expect(html).toContain('default')
    })
  })
})