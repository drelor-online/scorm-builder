import { describe, it, expect, vi } from 'vitest'
import { generateRustSCORM } from '../rustScormGenerator'
import type { CourseContent, EnhancedCourseContent } from '../../types/course'

// Mock the Tauri invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('rustScormGenerator - Audio file path handling', () => {
  it('should format audio file paths correctly for welcome page', async () => {
    const mockInvoke = vi.fn().mockResolvedValue(new Array(1000).fill(0))
    vi.mocked(await import('@tauri-apps/api/core')).invoke = mockInvoke

    const courseContent: CourseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome',
        content: 'Welcome to the course',
        audioFile: 'audio-0.bin',
        captionFile: 'caption-0.bin'
      },
      topics: []
    }

    await generateRustSCORM(courseContent, 'test-project')

    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
      courseData: expect.objectContaining({
        welcome_page: expect.objectContaining({
          audio_file: 'audio-0.bin',
          caption_file: 'caption-0.bin'
        })
      })
    }))
  })

  it('should format audio file paths correctly for objectives page', async () => {
    const mockInvoke = vi.fn().mockResolvedValue(new Array(1000).fill(0))
    vi.mocked(await import('@tauri-apps/api/core')).invoke = mockInvoke

    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      objectives: ['Objective 1', 'Objective 2'],
      objectivesPage: {
        audioFile: 'audio-1.bin',
        captionFile: 'caption-1.bin'
      },
      topics: []
    }

    await generateRustSCORM(courseContent, 'test-project')

    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
      courseData: expect.objectContaining({
        learning_objectives_page: expect.objectContaining({
          audio_file: 'audio-1.bin',
          caption_file: 'caption-1.bin'
        })
      })
    }))
  })

  it('should format audio file paths correctly for topic pages', async () => {
    const mockInvoke = vi.fn().mockResolvedValue(new Array(1000).fill(0))
    vi.mocked(await import('@tauri-apps/api/core')).invoke = mockInvoke

    const courseContent: CourseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic content',
        audioFile: 'audio-2.bin',
        captionFile: 'caption-2.bin'
      }]
    }

    await generateRustSCORM(courseContent, 'test-project')

    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
      courseData: expect.objectContaining({
        topics: expect.arrayContaining([
          expect.objectContaining({
            audio_file: 'audio-2.bin',
            caption_file: 'caption-2.bin'
          })
        ])
      })
    }))
  })

  it('should handle missing audio files gracefully', async () => {
    const mockInvoke = vi.fn().mockResolvedValue(new Array(1000).fill(0))
    vi.mocked(await import('@tauri-apps/api/core')).invoke = mockInvoke

    const courseContent: CourseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome',
        content: 'Welcome to the course'
        // No audioFile or captionFile
      },
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic content'
        // No audioFile or captionFile
      }]
    }

    await generateRustSCORM(courseContent, 'test-project')

    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
      courseData: expect.objectContaining({
        welcome_page: expect.objectContaining({
          audio_file: undefined,
          caption_file: undefined
        }),
        topics: expect.arrayContaining([
          expect.objectContaining({
            audio_file: undefined,
            caption_file: undefined
          })
        ])
      })
    }))
  })

  it('should NOT prepend media/ to audio paths', async () => {
    const mockInvoke = vi.fn().mockResolvedValue(new Array(1000).fill(0))
    vi.mocked(await import('@tauri-apps/api/core')).invoke = mockInvoke

    const courseContent: CourseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic content',
        audioFile: 'audio-0.bin'
      }]
    }

    await generateRustSCORM(courseContent, 'test-project')

    // Verify the path is passed as-is, NOT as 'media/audio-0.bin'
    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
      courseData: expect.objectContaining({
        topics: expect.arrayContaining([
          expect.objectContaining({
            audio_file: 'audio-0.bin' // Should NOT be 'media/audio-0.bin'
          })
        ])
      })
    }))
  })
})