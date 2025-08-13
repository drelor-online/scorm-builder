import { vi } from 'vitest'
import type { CourseContent } from '../services/types/aiPrompt'
import type { CourseMetadata } from '../services/types/metadata'

export interface MockMediaFile {
  id: string
  type: 'audio' | 'video' | 'image' | 'caption'
  data: Blob
  filename?: string
}

export interface MockCourseContent {
  welcomePage?: {
    id: string
    title: string
    content: string
    narration: string
    media?: Array<{ id: string; type: string; url?: string }>
  }
  learningObjectivesPage?: {
    id: string
    title: string
    content: string
    narration: string
    media?: Array<{ id: string; type: string; url?: string }>
  }
  topics: Array<{
    id: string
    title: string
    content: string
    narration: string
    media?: Array<{ id: string; type: string; url?: string }>
  }>
  assessment: {
    questions: any[]
    passMark: number
    narration: string | null
  }
}

export function createMockCourseContent(options: {
  hasWelcomeAudio?: boolean
  hasTopicAudio?: boolean
  recordedAudioIds?: string[]
  duplicateMediaIds?: boolean
}): MockCourseContent {
  const {
    hasWelcomeAudio = false,
    hasTopicAudio = false,
    recordedAudioIds = [],
    duplicateMediaIds = false
  } = options

  const welcomePage = {
    id: 'welcome',
    title: 'Welcome',
    content: '<h1>Welcome to the course</h1>',
    narration: 'Welcome to this training course',
    media: [] as Array<{ id: string; type: string; url?: string }>
  }

  if (hasWelcomeAudio) {
    welcomePage.media.push({
      id: recordedAudioIds[0] || 'audio-welcome-123',
      type: 'audio'
    })
  }

  const topics = [
    {
      id: 'topic-1',
      title: 'First Topic',
      content: '<h2>Topic Content</h2>',
      narration: 'This is the first topic',
      media: [] as Array<{ id: string; type: string; url?: string }>
    }
  ]

  if (hasTopicAudio) {
    topics[0].media.push({
      id: recordedAudioIds[1] || 'audio-topic-456',
      type: 'audio'
    })
  }

  if (duplicateMediaIds) {
    // Add both image and video with same ID to test collision handling
    topics[0].media.push(
      { id: 'media-duplicate', type: 'image' },
      { id: 'media-duplicate', type: 'video' }
    )
  }

  return {
    welcomePage,
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<h2>Objectives</h2>',
      narration: 'Learning objectives',
      media: []
    },
    topics,
    assessment: {
      questions: [],
      passMark: 80,
      narration: null
    }
  }
}

export function createMockMediaFiles(mediaIds: string[]): Map<string, Blob> {
  const mediaFiles = new Map<string, Blob>()
  
  mediaIds.forEach(id => {
    if (id.startsWith('audio-')) {
      mediaFiles.set(`${id}.mp3`, new Blob(['mock audio data'], { type: 'audio/mpeg' }))
    } else if (id.startsWith('image-')) {
      mediaFiles.set(`${id}.jpg`, new Blob(['mock image data'], { type: 'image/jpeg' }))
    } else if (id.startsWith('video-')) {
      mediaFiles.set(`${id}.mp4`, new Blob(['mock video data'], { type: 'video/mp4' }))
    } else if (id.startsWith('caption-')) {
      mediaFiles.set(`${id}.vtt`, new Blob(['WEBVTT\n\n00:00.000 --> 00:05.000\nMock caption'], { type: 'text/vtt' }))
    }
  })
  
  return mediaFiles
}

export function createMockNotificationContext() {
  return {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    addNotification: vi.fn(),
    removeNotification: vi.fn()
  }
}

export function createMockUnifiedMediaContext(mediaFiles: Map<string, Blob> = new Map()) {
  const mockGetMediaBlobFromRegistry = vi.fn((id: string) => {
    // Simulate some media missing
    if (id.includes('missing')) {
      return Promise.resolve(null)
    }
    // Return blob for existing media
    return Promise.resolve(mediaFiles.get(`${id}.mp3`) || mediaFiles.get(`${id}.jpg`) || mediaFiles.get(`${id}.mp4`) || new Blob(['mock data']))
  })

  const mockGetMedia = vi.fn((id: string) => {
    // Simulate some media missing
    if (id.includes('missing')) {
      return Promise.resolve(null)
    }
    
    // Check if this specific ID should fail
    const blob = mediaFiles.get(`${id}.mp3`) || mediaFiles.get(`${id}.jpg`) || mediaFiles.get(`${id}.mp4`)
    if (!blob) {
      // If no blob found, return null to simulate failure
      return Promise.resolve(null)
    }
    
    // Return media data structure that matches what getMedia returns
    return Promise.resolve({ 
      data: new Uint8Array([1, 2, 3]), 
      mimeType: blob.type || 'application/octet-stream',
      metadata: { mimeType: blob.type || 'application/octet-stream' }
    })
  })

  return {
    getMediaBlobFromRegistry: mockGetMediaBlobFromRegistry,
    getMedia: mockGetMedia,
    storeMedia: vi.fn().mockResolvedValue({ id: 'mock-stored-id' }),
    deleteMedia: vi.fn().mockResolvedValue(true),
    getAllMedia: vi.fn().mockResolvedValue([]),
    createBlobUrl: vi.fn().mockResolvedValue('blob:mock-url'),
    revokeBlobUrl: vi.fn(),
    hasAudioCached: vi.fn().mockReturnValue(false),
    getCachedAudio: vi.fn().mockReturnValue(null),
    clearAudioFromCache: vi.fn()
  }
}

export function createMockStorage() {
  return {
    currentProjectId: 'test-project-123',
    currentProjectPath: '/test/project/path',
    readFile: vi.fn(),
    writeFile: vi.fn(),
    deleteFile: vi.fn(),
    getContent: vi.fn().mockResolvedValue('{}'),
    saveContent: vi.fn().mockResolvedValue(undefined),
    isReady: true
  }
}

export function createMockCourseSeedData() {
  return {
    courseTitle: 'Test Course Title',
    courseDescription: 'Test course description',
    duration: 30,
    passMark: 80
  }
}

export async function simulateZipExtraction(packageBuffer: ArrayBuffer): Promise<string[]> {
  // Mock function to simulate extracting files from a zip
  // Returns list of filenames that would be in the package
  return [
    'index.html',
    'imsmanifest.xml',
    'media/audio-welcome-123.mp3',
    'media/audio-topic-456.mp3',
    'media/image-0.jpg'
  ]
}

export interface PackageValidationResult {
  hasManifest: boolean
  hasIndex: boolean
  mediaFiles: string[]
  missingFiles: string[]
  duplicateFiles: string[]
}

export async function validateSCORMPackage(packageBuffer: ArrayBuffer): Promise<PackageValidationResult> {
  // Mock SCORM package validation
  const extractedFiles = await simulateZipExtraction(packageBuffer)
  
  return {
    hasManifest: extractedFiles.includes('imsmanifest.xml'),
    hasIndex: extractedFiles.includes('index.html'),
    mediaFiles: extractedFiles.filter(f => f.startsWith('media/')),
    missingFiles: [],
    duplicateFiles: []
  }
}

export const MOCK_ENHANCED_CONTENT = {
  title: 'Test Course',
  duration: 30,
  passMark: 80,
  welcome: {
    title: 'Welcome',
    content: 'Welcome content',
    audioFile: 'audio-0.mp3',
    captionFile: 'caption-0.vtt'
  },
  objectives: ['Learn TDD', 'Fix bugs'],
  topics: [
    {
      id: 'topic-1',
      title: 'Topic 1',
      content: 'Topic content',
      audioFile: 'audio-2.mp3',
      captionFile: 'caption-2.vtt'
    }
  ],
  assessment: {
    questions: [],
    passMark: 80
  }
}