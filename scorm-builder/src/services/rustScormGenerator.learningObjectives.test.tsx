/**
 * Test for Learning Objectives caption file assignment in SCORM generation
 *
 * This test verifies that both audio_file and caption_file are properly
 * assigned to the learning_objectives_page in the SCORM package regardless
 * of whether the source uses 'objectivesPage' or 'learningObjectivesPage'.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the logger before importing rustScormGenerator
vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

// Mock FileStorage and MediaService
vi.mock('./FileStorage', () => ({
  FileStorage: vi.fn().mockImplementation(() => ({
    saveFile: vi.fn(),
    getFile: vi.fn(),
    deleteFile: vi.fn(),
    exists: vi.fn()
  }))
}))

vi.mock('./MediaService', () => ({
  createMediaService: vi.fn(() => ({
    getMediaBatchDirect: vi.fn().mockResolvedValue(new Map([
      ['audio-1', { data: new Uint8Array([1, 2, 3]), mimeType: 'audio/mp3' }],
      ['caption-1', { data: new Uint8Array([4, 5, 6]), mimeType: 'text/vtt' }],
      ['image-1', { data: new Uint8Array([7, 8, 9]), mimeType: 'image/jpeg' }]
    ])),
    listAllMedia: vi.fn().mockResolvedValue([
      { id: 'audio-1', metadata: { mimeType: 'audio/mp3' } },
      { id: 'caption-1', metadata: { mimeType: 'text/vtt' } },
      { id: 'image-1', metadata: { mimeType: 'image/jpeg' } }
    ])
  }))
}))

import { convertToRustFormat } from './rustScormGenerator'

// Mock window.__TAURI__ for tests
beforeEach(() => {
  global.window = {
    __TAURI__: {
      invoke: vi.fn().mockResolvedValue(undefined)
    }
  } as any

  // Clear all mocks before each test
  vi.clearAllMocks()
})

describe('Learning Objectives Caption File Assignment', () => {
  const projectId = 'test-project-1234'

  it('should assign both audio_file and caption_file for learningObjectivesPage variant', async () => {
    const courseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome',
        audioFile: 'audio-0',
        captionFile: 'caption-0'
      },
      learningObjectivesPage: {  // Canonical variant
        title: 'Learning Objectives',
        objectives: ['Learn objective 1', 'Learn objective 2'],
        audioFile: 'audio-1',
        captionFile: 'caption-1',
        media: [{ id: 'image-1', type: 'image' }]
      },
      topics: []
    }

    const result = await convertToRustFormat(courseContent, projectId)

    // Verify Learning Objectives page structure
    expect(result.courseData.learning_objectives_page).toBeDefined()
    expect(result.courseData.learning_objectives_page.objectives).toEqual(['Learn objective 1', 'Learn objective 2'])
    expect(result.courseData.learning_objectives_page.audio_file).toBe('media/audio-1.mp3')
    expect(result.courseData.learning_objectives_page.caption_file).toBe('media/caption-1.vtt')

    console.log('[TEST] ✅ learningObjectivesPage variant correctly assigns audio and caption files')
  })

  it('should assign both audio_file and caption_file for objectivesPage variant', async () => {
    const courseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome',
        audioFile: 'audio-0',
        captionFile: 'caption-0'
      },
      objectivesPage: {  // Legacy variant
        objectives: ['Learn objective 1', 'Learn objective 2'],
        audioFile: 'audio-1',
        captionFile: 'caption-1',
        media: [{ id: 'image-1', type: 'image' }]
      },
      topics: []
    }

    const result = await convertToRustFormat(courseContent, projectId)

    // Verify Learning Objectives page structure
    expect(result.courseData.learning_objectives_page).toBeDefined()
    expect(result.courseData.learning_objectives_page.objectives).toEqual(['Learn objective 1', 'Learn objective 2'])
    expect(result.courseData.learning_objectives_page.audio_file).toBe('media/audio-1.mp3')
    expect(result.courseData.learning_objectives_page.caption_file).toBe('media/caption-1.vtt')

    console.log('[TEST] ✅ objectivesPage variant correctly assigns audio and caption files')
  })

  it('should fallback to standard indexing when explicit files are not provided', async () => {
    const courseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome'
      },
      objectivesPage: {  // Legacy variant with no explicit audio/caption files
        objectives: ['Learn objective 1', 'Learn objective 2'],
        media: [{ id: 'image-1', type: 'image' }]
      },
      topics: []
    }

    const result = await convertToRustFormat(courseContent, projectId)

    // Verify fallback to standard indexing works
    expect(result.courseData.learning_objectives_page).toBeDefined()
    expect(result.courseData.learning_objectives_page.audio_file).toBe('media/audio-1.mp3')
    expect(result.courseData.learning_objectives_page.caption_file).toBe('media/caption-1.vtt')

    console.log('[TEST] ✅ Fallback to audio-1/caption-1 works when explicit files not provided')
  })

  it('should use audioId and captionId properties when audioFile/captionFile are not available', async () => {
    const courseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome'
      },
      objectivesPage: {
        objectives: ['Learn objective 1'],
        audioId: 'audio-1',
        captionId: 'caption-1',
        media: [{ id: 'image-1', type: 'image' }]
      },
      topics: []
    }

    const result = await convertToRustFormat(courseContent, projectId)

    // Verify audioId/captionId properties are used
    expect(result.courseData.learning_objectives_page).toBeDefined()
    expect(result.courseData.learning_objectives_page.audio_file).toBe('media/audio-1.mp3')
    expect(result.courseData.learning_objectives_page.caption_file).toBe('media/caption-1.vtt')

    console.log('[TEST] ✅ audioId/captionId properties work as fallback')
  })

  it('should detect audio and caption from media array when direct properties are missing', async () => {
    const courseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome'
      },
      learningObjectivesPage: {
        title: 'Learning Objectives',
        objectives: ['Learn objective 1'],
        media: [
          { id: 'image-1', type: 'image' },
          { id: 'audio-1', type: 'audio' },
          { id: 'caption-1', type: 'caption' }
        ]
      },
      topics: []
    }

    const result = await convertToRustFormat(courseContent, projectId)

    // Verify media array scanning works
    expect(result.courseData.learning_objectives_page).toBeDefined()
    expect(result.courseData.learning_objectives_page.audio_file).toBe('media/audio-1.mp3')
    expect(result.courseData.learning_objectives_page.caption_file).toBe('media/caption-1.vtt')

    console.log('[TEST] ✅ Media array scanning correctly identifies audio and caption files')
  })

  it('should prefer learningObjectivesPage over objectivesPage when both exist', async () => {
    const courseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome'
      },
      objectivesPage: {  // Should be ignored
        objectives: ['Old objectives'],
        audioFile: 'audio-old',
        captionFile: 'caption-old'
      },
      learningObjectivesPage: {  // Should be used
        title: 'Learning Objectives',
        objectives: ['New objectives'],
        audioFile: 'audio-1',
        captionFile: 'caption-1'
      },
      topics: []
    }

    const result = await convertToRustFormat(courseContent, projectId)

    // Verify learningObjectivesPage takes precedence
    expect(result.courseData.learning_objectives_page).toBeDefined()
    expect(result.courseData.learning_objectives_page.objectives).toEqual(['New objectives'])
    expect(result.courseData.learning_objectives_page.audio_file).toBe('media/audio-1.mp3')
    expect(result.courseData.learning_objectives_page.caption_file).toBe('media/caption-1.vtt')

    console.log('[TEST] ✅ learningObjectivesPage correctly takes precedence over objectivesPage')
  })

  it('should handle missing Learning Objectives page gracefully', async () => {
    const courseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome'
      },
      // No objectivesPage or learningObjectivesPage
      topics: []
    }

    const result = await convertToRustFormat(courseContent, projectId)

    // Verify no Learning Objectives page is created
    expect(result.courseData.learning_objectives_page).toBeUndefined()

    console.log('[TEST] ✅ Missing Learning Objectives page handled gracefully')
  })
})