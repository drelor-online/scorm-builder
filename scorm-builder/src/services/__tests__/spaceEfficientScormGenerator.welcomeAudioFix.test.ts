import { describe, it, expect, vi } from 'vitest'
import JSZip from 'jszip'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Generator - Welcome Audio Fix', () => {
  it('should rename welcome audio files from 0001- to 0000- prefix', async () => {
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
        audioFile: '0001-welcome.mp3', // Wrong prefix
        audioBlob: new Blob(['audio'], { type: 'audio/mpeg' }),
        captionFile: '0001-welcome.vtt', // Wrong prefix
        captionBlob: new Blob(['WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nWelcome'], { type: 'text/vtt' })
      },
      objectives: ['Learn stuff'],
      objectivesPage: {
        audioFile: '0001-objectives.mp3', // Correct prefix
        audioBlob: new Blob(['audio'], { type: 'audio/mpeg' }),
        captionFile: '0001-objectives.vtt', // Correct prefix
        captionBlob: new Blob(['WEBVTT'], { type: 'text/vtt' })
      },
      topics: [],
      assessment: {
        instructions: 'Test',
        passMark: 80,
        questions: []
      }
    }

    const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
    
    // Extract the zip to check files
    const zip = await JSZip.loadAsync(result.buffer)
    
    // Check that welcome files are saved with 0000- prefix
    expect(zip.file('media/audio/0000-welcome.mp3')).toBeTruthy()
    expect(zip.file('media/captions/0000-welcome.vtt')).toBeTruthy()
    
    // Check that 0001- prefix files don't exist for welcome
    expect(zip.file('media/audio/0001-welcome.mp3')).toBeFalsy()
    expect(zip.file('media/captions/0001-welcome.vtt')).toBeFalsy()
    
    // Check that objectives files keep their 0001- prefix
    expect(zip.file('media/audio/0001-objectives.mp3')).toBeTruthy()
    expect(zip.file('media/captions/0001-objectives.vtt')).toBeTruthy()
  })

  it('should handle welcome files that already have correct prefix', async () => {
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
        audioFile: '0000-welcome.mp3', // Correct prefix
        audioBlob: new Blob(['audio'], { type: 'audio/mpeg' }),
        captionFile: '0000-welcome.vtt', // Correct prefix
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
    
    // Files should exist with correct prefix
    expect(zip.file('media/audio/0000-welcome.mp3')).toBeTruthy()
    expect(zip.file('media/captions/0000-welcome.vtt')).toBeTruthy()
  })
})