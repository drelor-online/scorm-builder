import { describe, it, expect, vi } from 'vitest'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import JSZip from 'jszip'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Generator - Caption Timing Adjustment', () => {
  it('should adjust caption timing to match audio duration', async () => {
    const mockCourseContent: EnhancedCourseContent = {
      title: 'Test Course',
      duration: 60,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      audioDurations: {
        '0000-welcome.mp3': 30, // 30 second audio
        '0002-topic-1.mp3': 20  // 20 second audio
      },
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        startButtonText: 'Start',
        audioFile: '0000-welcome.mp3',
        audioBlob: new Blob(['audio'], { type: 'audio/mpeg' }),
        captionFile: '0000-welcome.vtt',
        captionBlob: new Blob([`WEBVTT

00:00:00.000 --> 00:00:05.000
Welcome to the course

00:00:05.000 --> 00:00:10.000
This is the second caption`], { type: 'text/vtt' })
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
        captionBlob: new Blob([`WEBVTT

00:00:00.000 --> 00:00:03.000
Topic introduction

00:00:03.000 --> 00:00:05.000
Topic details`], { type: 'text/vtt' })
      }],
      assessment: {
        instructions: 'Test',
        passMark: 80,
        questions: []
      }
    }

    const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
    const zip = await JSZip.loadAsync(result.buffer)
    
    // Check welcome caption file was adjusted (30 seconds / 10 seconds = 3x)
    const welcomeCaption = await zip.file('media/captions/0000-welcome.vtt')?.async('string')
    expect(welcomeCaption).toBeTruthy()
    expect(welcomeCaption).toContain('00:00:00.000 --> 00:00:15.000') // 5 * 3 = 15
    expect(welcomeCaption).toContain('00:00:15.000 --> 00:00:30.000') // 10 * 3 = 30
    expect(welcomeCaption).toContain('Welcome to the course')
    expect(welcomeCaption).toContain('This is the second caption')
    
    // Check topic caption file was adjusted (20 seconds / 5 seconds = 4x)
    const topicCaption = await zip.file('media/captions/0002-topic-1.vtt')?.async('string')
    expect(topicCaption).toBeTruthy()
    expect(topicCaption).toContain('00:00:00.000 --> 00:00:12.000') // 3 * 4 = 12
    expect(topicCaption).toContain('00:00:12.000 --> 00:00:20.000') // 5 * 4 = 20
    expect(topicCaption).toContain('Topic introduction')
    expect(topicCaption).toContain('Topic details')
  })

  it('should handle missing audio durations by not adjusting captions', async () => {
    const mockCourseContent: EnhancedCourseContent = {
      title: 'Test Course',
      duration: 60,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      // No audioDurations provided
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        startButtonText: 'Start',
        audioFile: '0000-welcome.mp3',
        audioBlob: new Blob(['audio'], { type: 'audio/mpeg' }),
        captionFile: '0000-welcome.vtt',
        captionBlob: new Blob([`WEBVTT

00:00:00.000 --> 00:00:05.000
Original caption`], { type: 'text/vtt' })
      },
      objectives: ['Learn stuff'],
      topics: [],
      assessment: {
        instructions: 'Test',
        passMark: 80,
        questions: []
      }
    }

    const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
    const zip = await JSZip.loadAsync(result.buffer)
    
    // Check caption file remains unchanged
    const welcomeCaption = await zip.file('media/captions/0000-welcome.vtt')?.async('string')
    expect(welcomeCaption).toBeTruthy()
    expect(welcomeCaption).toContain('00:00:00.000 --> 00:00:05.000')
    expect(welcomeCaption).toContain('Original caption')
  })
})