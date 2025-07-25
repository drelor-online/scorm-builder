import { describe, it, expect, beforeEach } from 'vitest'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'
import JSZip from 'jszip'

describe('SCORM Package Media Loading', () => {
  let mockCourseContent: EnhancedCourseContent

  beforeEach(() => {
    // Create test blobs with recognizable content
    const createImageBlob = (content: string) => new Blob([content], { type: 'image/png' })
    const createAudioBlob = (content: string) => new Blob([content], { type: 'audio/mp3' })
    const createCaptionBlob = (content: string) => new Blob([content], { type: 'text/vtt' })

    mockCourseContent = {
      title: 'Media Test Course',
      duration: 30,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome to the course',
        startButtonText: 'Start',
        audioFile: 'welcome-narration.mp3',
        audioBlob: createAudioBlob('welcome-audio-content'),
        captionFile: 'welcome-captions.vtt',
        captionBlob: createCaptionBlob('WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nWelcome to the course'),
        media: [
          {
            id: 'welcome-img-1',
            url: 'welcome-image.png',
            title: 'Welcome Image',
            type: 'image',
            blob: createImageBlob('welcome-image-data')
          }
        ]
      },
      objectives: ['Learn about media handling'],
      objectivesPage: {
        title: 'Learning Objectives',
        objectives: ['Understand media in SCORM'],
        audioFile: 'objectives-narration.mp3',
        audioBlob: createAudioBlob('objectives-audio-content'),
        captionFile: 'objectives-captions.vtt',
        captionBlob: createCaptionBlob('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nLearning objectives'),
        media: [
          {
            id: 'objectives-img-1',
            url: 'objectives-diagram.png',
            title: 'Objectives Diagram',
            type: 'image',
            blob: createImageBlob('objectives-diagram-data')
          }
        ]
      },
      topics: [
        {
          id: 'topic-1',
          title: 'First Topic',
          content: 'Topic content with media',
          duration: 5,
          audioFile: 'topic-1-narration.mp3',
          audioBlob: createAudioBlob('topic-1-audio-content'),
          captionFile: 'topic-1-captions.vtt',
          captionBlob: createCaptionBlob('WEBVTT\n\n00:00:00.000 --> 00:00:10.000\nFirst topic narration'),
          media: [
            {
              id: 'topic-1-img-1',
              url: 'topic-1-screenshot.png',
              title: 'Screenshot 1',
              type: 'image',
              blob: createImageBlob('topic-1-screenshot-data')
            },
            {
              id: 'topic-1-img-2',
              url: 'topic-1-diagram.png',
              title: 'Diagram 1',
              type: 'image',
              blob: createImageBlob('topic-1-diagram-data')
            }
          ]
        },
        {
          id: 'topic-2',
          title: 'Second Topic',
          content: 'Another topic with video',
          duration: 5,
          audioFile: 'topic-2-narration.mp3',
          audioBlob: createAudioBlob('topic-2-audio-content'),
          media: [
            {
              id: 'topic-2-video-1',
              url: 'https://youtube.com/watch?v=123',
              title: 'Demo Video',
              type: 'video',
              embedUrl: 'https://youtube.com/embed/123'
              // Videos don't have blobs as they're embedded
            }
          ]
        }
      ],
      assessment: {
        questions: [],
        passMark: 80,
        narration: ''
      }
    }
  })

  describe('Media File Structure', () => {
    it('should create proper media folder structure', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check folder structure
      expect(zip.folder('media')).toBeTruthy()
      expect(zip.folder('media/images')).toBeTruthy()
      expect(zip.folder('media/audio')).toBeTruthy()
      expect(zip.folder('media/captions')).toBeTruthy()
    })
  })

  describe('Image Media Loading', () => {
    it('should include all image files from welcome page', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const welcomeImg = zip.file('media/images/welcome-img-1.png')
      expect(welcomeImg).toBeTruthy()
      
      const content = await welcomeImg?.async('string')
      expect(content).toBe('welcome-image-data')
    })

    it('should include all image files from objectives page', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const objectivesImg = zip.file('media/images/objectives-img-1.png')
      expect(objectivesImg).toBeTruthy()
      
      const content = await objectivesImg?.async('string')
      expect(content).toBe('objectives-diagram-data')
    })

    it('should include all image files from topic pages', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Topic 1 images
      const topic1Img1 = zip.file('media/images/topic-1-img-1.png')
      const topic1Img2 = zip.file('media/images/topic-1-img-2.png')
      
      expect(topic1Img1).toBeTruthy()
      expect(topic1Img2).toBeTruthy()
      
      const content1 = await topic1Img1?.async('string')
      const content2 = await topic1Img2?.async('string')
      
      expect(content1).toBe('topic-1-screenshot-data')
      expect(content2).toBe('topic-1-diagram-data')
    })

    it('should handle missing image blobs gracefully', async () => {
      // Remove blob from one image
      delete mockCourseContent.topics[0].media![0].blob
      
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Should not include the image without blob
      const missingImg = zip.file('media/images/topic-1-img-1.png')
      expect(missingImg).toBeNull()
      
      // But should still include other images
      const existingImg = zip.file('media/images/topic-1-img-2.png')
      expect(existingImg).toBeTruthy()
    })
  })

  describe('Audio Media Loading', () => {
    it('should include all audio files with correct content', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check all audio files
      const welcomeAudio = await zip.file('media/audio/welcome-narration.mp3')?.async('string')
      const objectivesAudio = await zip.file('media/audio/objectives-narration.mp3')?.async('string')
      const topic1Audio = await zip.file('media/audio/topic-1-narration.mp3')?.async('string')
      const topic2Audio = await zip.file('media/audio/topic-2-narration.mp3')?.async('string')
      
      expect(welcomeAudio).toBe('welcome-audio-content')
      expect(objectivesAudio).toBe('objectives-audio-content')
      expect(topic1Audio).toBe('topic-1-audio-content')
      expect(topic2Audio).toBe('topic-2-audio-content')
    })

    it('should create placeholder audio for missing blobs', async () => {
      // Remove audio blob but keep filename
      delete mockCourseContent.topics[0].audioBlob
      
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Should still have the file with placeholder content
      const placeholderAudio = zip.file('media/audio/topic-1-narration.mp3')
      expect(placeholderAudio).toBeTruthy()
      
      const content = await placeholderAudio?.async('uint8array')
      // Check for MP3 header bytes
      expect(content?.[0]).toBe(0xFF)
      expect(content?.[1]).toBe(0xFB)
    })
  })

  describe('Caption Media Loading', () => {
    it('should include all caption files with VTT content', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check caption files
      const welcomeCaptions = await zip.file('media/captions/welcome-captions.vtt')?.async('string')
      const objectivesCaptions = await zip.file('media/captions/objectives-captions.vtt')?.async('string')
      const topic1Captions = await zip.file('media/captions/topic-1-captions.vtt')?.async('string')
      
      expect(welcomeCaptions).toContain('WEBVTT')
      expect(welcomeCaptions).toContain('Welcome to the course')
      
      expect(objectivesCaptions).toContain('WEBVTT')
      expect(objectivesCaptions).toContain('Learning objectives')
      
      expect(topic1Captions).toContain('WEBVTT')
      expect(topic1Captions).toContain('First topic narration')
    })

    it('should generate default captions for missing caption blobs', async () => {
      // Remove caption blob but keep filename
      delete mockCourseContent.topics[0].captionBlob
      
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const generatedCaptions = await zip.file('media/captions/topic-1-captions.vtt')?.async('string')
      
      expect(generatedCaptions).toContain('WEBVTT')
      expect(generatedCaptions).toContain('00:00:00.000 --> 00:00:05.000')
      expect(generatedCaptions).toContain('Topic content with media') // Uses topic content
    })

    it('should not create caption files when not specified', async () => {
      // Remove caption references entirely
      delete mockCourseContent.topics[1].captionFile
      delete mockCourseContent.topics[1].captionBlob
      
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const missingCaptions = zip.file('media/captions/topic-2-captions.vtt')
      expect(missingCaptions).toBeNull()
    })
  })

  describe('HTML Media References', () => {
    it('should reference correct image paths in topic HTML', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topic1Html = await zip.file('pages/topic-1.html')?.async('string')
      
      // Check image references
      expect(topic1Html).toContain('src="../media/images/topic-1-img-1.png"')
      expect(topic1Html).toContain('src="../media/images/topic-1-img-2.png"')
      expect(topic1Html).toContain('alt="Screenshot 1"')
      expect(topic1Html).toContain('alt="Diagram 1"')
    })

    it('should reference correct audio paths in HTML', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const welcomeHtml = await zip.file('pages/welcome.html')?.async('string')
      const topic1Html = await zip.file('pages/topic-1.html')?.async('string')
      
      expect(welcomeHtml).toContain('src="media/audio/welcome-narration.mp3"')
      expect(topic1Html).toContain('src="../media/audio/topic-1-narration.mp3"')
    })

    it('should reference correct caption paths in HTML', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const welcomeHtml = await zip.file('pages/welcome.html')?.async('string')
      const topic1Html = await zip.file('pages/topic-1.html')?.async('string')
      
      expect(welcomeHtml).toContain('src="media/captions/welcome-captions.vtt"')
      expect(topic1Html).toContain('src="../media/captions/topic-1-captions.vtt"')
    })

    it('should handle video embeds correctly', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topic2Html = await zip.file('pages/topic-2.html')?.async('string')
      
      // Videos should use embed URLs, not local files
      expect(topic2Html).toContain('src="https://youtube.com/embed/123"')
      expect(topic2Html).toContain('<iframe')
      expect(topic2Html).not.toContain('media/videos') // No local video files
    })
  })

  describe('Media with Special Characters', () => {
    it('should handle media IDs with special characters', async () => {
      mockCourseContent.topics[0].media!.push({
        id: 'topic-1-special_chars',
        url: 'special-image.png',
        title: 'Image with Special Characters',
        type: 'image',
        blob: createImageBlob('special-chars-data')
      })
      
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const specialImg = zip.file('media/images/topic-1-special_chars.png')
      expect(specialImg).toBeTruthy()
      
      const content = await specialImg?.async('string')
      expect(content).toBe('special-chars-data')
    })
  })

  describe('Large Media Handling', () => {
    it('should handle large media blobs', async () => {
      // Create a larger blob (1MB)
      const largeData = new Array(1024 * 1024).fill('a').join('')
      const largeBlob = new Blob([largeData], { type: 'image/png' })
      
      mockCourseContent.topics[0].media!.push({
        id: 'large-image',
        url: 'large.png',
        title: 'Large Image',
        type: 'image',
        blob: largeBlob
      })
      
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const largeImg = await zip.file('media/images/large-image.png')?.async('string')
      expect(largeImg?.length).toBe(1024 * 1024)
    })
  })

  function createImageBlob(content: string): Blob {
    return new Blob([content], { type: 'image/png' })
  }

  function createAudioBlob(content: string): Blob {
    return new Blob([content], { type: 'audio/mp3' })
  }

  function createCaptionBlob(content: string): Blob {
    return new Blob([content], { type: 'text/vtt' })
  }
})