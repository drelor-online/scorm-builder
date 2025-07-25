import { describe, it, expect } from 'vitest'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import JSZip from 'jszip'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Generator - Caption Timing Synchronization', () => {
  it('should add proper audio preload and caption sync attributes', async () => {
    const mockCourseContent: EnhancedCourseContent = {
      title: 'Test Course',
      duration: 60,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        startButtonText: 'Start',
        audioFile: '0000-welcome.mp3',
        audioBlob: new Blob(['audio'], { type: 'audio/mpeg' }),
        captionFile: '0000-welcome.vtt',
        captionBlob: new Blob(['WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nWelcome'], { type: 'text/vtt' })
      },
      objectives: ['Learn stuff'],
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic content',
        knowledgeChecks: [],
        audioFile: '0002-topic-1.mp3',
        audioBlob: new Blob(['audio'], { type: 'audio/mpeg' }),
        captionFile: '0002-topic-1.vtt',
        captionBlob: new Blob(['WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nTopic 1'], { type: 'text/vtt' })
      }],
      assessment: {
        instructions: 'Test',
        passMark: 80,
        questions: []
      }
    }

    const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
    const zip = await JSZip.loadAsync(result.buffer)
    
    // Check navigation.js for caption sync improvements
    const navJs = await zip.file('scripts/navigation.js')?.async('string')
    expect(navJs).toBeTruthy()
    
    // Check HTML pages for proper audio preload settings
    const welcomeHtml = await zip.file('pages/welcome.html')?.async('string')
    expect(welcomeHtml).toContain('preload="metadata"')
    
    // Should handle caption timing with proper event listeners
    expect(navJs).toContain('track.mode = \'showing\'')
    expect(navJs).toContain('cuechange')
    expect(navJs).toContain('initializeAudioCaptions')
    
    // Should include timing compensation for better sync
    expect(navJs).toContain('timeupdate')
    expect(navJs).toContain('100ms lookahead') // Our caption sync improvement
  })

  it('should set crossorigin attribute for proper caption loading', async () => {
    const mockCourseContent: EnhancedCourseContent = {
      title: 'Test Course',
      duration: 60,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        startButtonText: 'Start',
        audioFile: '0000-welcome.mp3',
        audioBlob: new Blob(['audio'], { type: 'audio/mpeg' }),
        captionFile: '0000-welcome.vtt',
        captionBlob: new Blob(['WEBVTT'], { type: 'text/vtt' })
      },
      objectives: [],
      topics: [],
      assessment: {
        instructions: 'Test',
        passMark: 80,
        questions: []
      }
    }

    const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
    const zip = await JSZip.loadAsync(result.buffer)
    
    // Check that audio elements don't have crossorigin since they're local files
    const welcomeHtml = await zip.file('pages/welcome.html')?.async('string')
    expect(welcomeHtml).toBeTruthy()
    
    // Should not have crossorigin for local files
    expect(welcomeHtml).not.toContain('crossorigin')
    
    // Should have proper track element
    expect(welcomeHtml).toContain('<track kind="subtitles"')
    expect(welcomeHtml).toContain('srclang="en"')
    expect(welcomeHtml).toContain('label="English"')
    expect(welcomeHtml).toContain('default')
  })
})