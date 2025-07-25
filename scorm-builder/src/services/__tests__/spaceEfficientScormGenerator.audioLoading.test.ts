import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'
import JSZip from 'jszip'

describe('SCORM Audio File Loading', () => {
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
        audioFile: 'welcome-audio.mp3',
        audioBlob: new Blob(['fake audio data'], { type: 'audio/mp3' }),
        media: []
      },
      objectivesPage: {
        title: 'Learning Objectives',
        objectives: ['Objective 1'],
        audioFile: 'objectives-audio.mp3',
        audioBlob: new Blob(['fake objectives audio'], { type: 'audio/mp3' }),
        media: []
      },
      topics: [
        {
          id: 'topic-1',
          title: 'First Topic',
          content: 'Topic content',
          duration: 5,
          audioFile: 'topic-1-audio.mp3',
          audioBlob: new Blob(['fake topic audio'], { type: 'audio/mp3' }),
          media: []
        }
      ],
      assessment: {
        questions: [],
        passMark: 80,
        narration: ''
      }
    }
  })

  describe('Audio Blob Storage', () => {
    it('should include audio files in the SCORM package', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check that audio files exist in the package
      expect(zip.file('media/audio/welcome-audio.mp3')).toBeTruthy()
      expect(zip.file('media/audio/objectives-audio.mp3')).toBeTruthy()
      expect(zip.file('media/audio/topic-1-audio.mp3')).toBeTruthy()
    })

    it('should store audio blobs with correct content', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Verify audio content
      const welcomeAudio = await zip.file('media/audio/welcome-audio.mp3')?.async('string')
      expect(welcomeAudio).toBe('fake audio data')
      
      const objectivesAudio = await zip.file('media/audio/objectives-audio.mp3')?.async('string')
      expect(objectivesAudio).toBe('fake objectives audio')
      
      const topicAudio = await zip.file('media/audio/topic-1-audio.mp3')?.async('string')
      expect(topicAudio).toBe('fake topic audio')
    })

    it('should handle missing audio blobs gracefully', async () => {
      // Remove audio blob but keep filename
      delete mockCourseContent.welcome.audioBlob
      
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Audio file should not exist if blob is missing
      expect(zip.file('media/audio/welcome-audio.mp3')).toBeNull()
    })
  })

  describe('Audio Player HTML Generation', () => {
    it('should generate correct audio source paths', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check welcome page HTML
      const welcomeHtml = await zip.file('pages/welcome.html')?.async('string')
      expect(welcomeHtml).toContain('src="media/audio/welcome-audio.mp3"')
      expect(welcomeHtml).toContain('<audio id="narrator"')
      expect(welcomeHtml).toContain('preload="metadata"')
    })

    it('should include duration calculation JavaScript', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const welcomeHtml = await zip.file('pages/welcome.html')?.async('string')
      
      // Should have loadedmetadata event listener
      expect(welcomeHtml).toContain('audio.addEventListener("loadedmetadata", function()')
      expect(welcomeHtml).toContain('formatTime(audio.duration)')
    })
  })

  describe('Audio File Validation', () => {
    it('should validate audio blob type', async () => {
      // Create audio with wrong mime type
      mockCourseContent.welcome.audioBlob = new Blob(['fake audio'], { type: 'text/plain' })
      
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Should still create the file but log warning
      const consoleWarnSpy = vi.spyOn(console, 'warn')
      expect(zip.file('media/audio/welcome-audio.mp3')).toBeTruthy()
      
      consoleWarnSpy.mockRestore()
    })

    it('should handle empty audio blobs', async () => {
      mockCourseContent.welcome.audioBlob = new Blob([], { type: 'audio/mp3' })
      
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Should still create the file
      expect(zip.file('media/audio/welcome-audio.mp3')).toBeTruthy()
      const content = await zip.file('media/audio/welcome-audio.mp3')?.async('arraybuffer')
      expect(content?.byteLength).toBe(0)
    })
  })

  describe('Audio Preloading', () => {
    it('should set preload attribute for better performance', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      
      // Should use preload="metadata" for faster duration display
      expect(topicHtml).toContain('preload="metadata"')
      expect(topicHtml).not.toContain('preload="none"')
      expect(topicHtml).not.toContain('preload="auto"') // Auto might be too aggressive
    })
  })

  describe('Audio Error Handling', () => {
    it('should include error handling for audio loading failures', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const welcomeHtml = await zip.file('pages/welcome.html')?.async('string')
      
      // Should have error event listener
      expect(welcomeHtml).toContain('audio.addEventListener("error"')
      expect(welcomeHtml).toContain('console.error("Audio failed to load"')
      expect(welcomeHtml).toContain('"Error"')
    })
  })
})