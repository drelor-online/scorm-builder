import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Generator - Storage Consistency', () => {
  let mockStorage: any

  beforeEach(() => {
    // Mock storage that simulates the issue
    mockStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      getAllItems: vi.fn().mockResolvedValue({})
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should not affect storage when generating SCORM package', async () => {
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
      objectives: ['Learn stuff'],
      objectivesPage: {
        audioFile: '0001-objectives.mp3',
        audioBlob: new Blob(['audio'], { type: 'audio/mpeg' }),
        captionFile: '0001-objectives.vtt',
        captionBlob: new Blob(['WEBVTT'], { type: 'text/vtt' })
      },
      topics: [],
      assessment: {
        instructions: 'Test',
        passMark: 80,
        questions: []
      }
    }

    // Generate SCORM package with storage
    await generateSpaceEfficientSCORM12Buffer(mockCourseContent, mockStorage)
    
    // Storage should not be cleared or modified
    expect(mockStorage.clear).not.toHaveBeenCalled()
    expect(mockStorage.removeItem).not.toHaveBeenCalled()
    
    // Storage should only be read, not written during SCORM generation
    expect(mockStorage.setItem).not.toHaveBeenCalled()
  })

  it('should handle media with consistent IDs', async () => {
    const mockCourseContent: EnhancedCourseContent = {
      title: 'Test Course',
      duration: 60,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        startButtonText: 'Start'
      },
      objectives: ['Learn stuff'],
      objectivesPage: {
        audioFile: '0001-objectives.mp3',
        audioBlob: new Blob(['objectives audio'], { type: 'audio/mpeg' }),
        captionFile: '0001-objectives.vtt',
        captionBlob: new Blob(['WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nObjectives'], { type: 'text/vtt' }),
        media: [{
          id: 'objectives-img-1',
          type: 'image',
          blob: new Blob(['image data'], { type: 'image/png' }),
          url: 'blob:123',
          title: 'Objectives Image'
        }]
      },
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Content',
        audioFile: '0002-topic-1.mp3',
        audioBlob: new Blob(['topic audio'], { type: 'audio/mpeg' }),
        captionFile: '0002-topic-1.vtt',
        captionBlob: new Blob(['WEBVTT'], { type: 'text/vtt' }),
        knowledgeChecks: []
      }],
      assessment: {
        instructions: 'Test',
        passMark: 80,
        questions: []
      }
    }

    const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent, mockStorage)
    
    // Verify the package was generated successfully
    expect(result.buffer).toBeTruthy()
    expect(result.buffer).toBeInstanceOf(Uint8Array)
    
    // Media should still be available in the course content after generation
    expect(mockCourseContent.objectivesPage?.audioBlob).toBeTruthy()
    expect(mockCourseContent.objectivesPage?.captionBlob).toBeTruthy()
    expect(mockCourseContent.topics[0].audioBlob).toBeTruthy()
    expect(mockCourseContent.topics[0].captionBlob).toBeTruthy()
  })
})