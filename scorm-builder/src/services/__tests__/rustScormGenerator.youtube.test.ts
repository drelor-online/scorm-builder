import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateRustSCORM } from '../rustScormGenerator'
import { invoke } from '@tauri-apps/api/core'
import type { CourseContent } from '../../types/course'
import type { EnhancedCourseContent } from '../../types/scorm'

// Mock the Tauri invoke function
vi.mock('@tauri-apps/api/core')
vi.mock('../MediaStore')
vi.mock('../externalImageDownloader', () => ({
  isExternalUrl: vi.fn((url: string) => url.startsWith('http')),
  downloadIfExternal: vi.fn(() => Promise.resolve(null))
}))

describe('rustScormGenerator - YouTube video handling', () => {
  let mockInvoke: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke = vi.mocked(invoke)
    mockInvoke.mockResolvedValue(new Array(1000).fill(0))
  })

  it('should add YouTube metadata (is_youtube, youtube_id, embed_url) for YouTube videos', async () => {

    const courseContent: CourseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Test Topic',
        content: 'Test content',
        media: [{
          id: 'video-1',
          type: 'video',
          url: 'https://youtube.com/watch?v=-njmj0diWu8',
          title: 'Test YouTube Video'
        }]
      }]
    }

    await generateRustSCORM(courseContent, 'test-project')

    // Check that YouTube metadata was added
    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
      courseData: expect.objectContaining({
        topics: expect.arrayContaining([
          expect.objectContaining({
            media: expect.arrayContaining([
              expect.objectContaining({
                type: 'video',
                url: 'https://youtube.com/watch?v=-njmj0diWu8',
                is_youtube: true,
                youtube_id: '-njmj0diWu8',
                embed_url: 'https://www.youtube.com/embed/-njmj0diWu8'
              })
            ])
          })
        ])
      })
    }))
  })

  it('should handle youtu.be URLs and extract video ID', async () => {

    const courseContent: CourseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Test Topic',
        content: 'Test content',
        media: [{
          id: 'video-2',
          type: 'video',
          url: 'https://youtu.be/abc123xyz',
          title: 'Short YouTube URL'
        }]
      }]
    }

    await generateRustSCORM(courseContent, 'test-project')

    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
      courseData: expect.objectContaining({
        topics: expect.arrayContaining([
          expect.objectContaining({
            media: expect.arrayContaining([
              expect.objectContaining({
                type: 'video',
                url: 'https://youtu.be/abc123xyz',
                is_youtube: true,
                youtube_id: 'abc123xyz',
                embed_url: 'https://www.youtube.com/embed/abc123xyz'
              })
            ])
          })
        ])
      })
    }))
  })

  it('should NOT add YouTube metadata for non-YouTube videos', async () => {

    const courseContent: CourseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Test Topic',
        content: 'Test content',
        media: [{
          id: 'video-3',
          type: 'video',
          url: 'media/video-3.mp4',
          title: 'Local Video File'
        }]
      }]
    }

    await generateRustSCORM(courseContent, 'test-project')

    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
      courseData: expect.objectContaining({
        topics: expect.arrayContaining([
          expect.objectContaining({
            media: expect.arrayContaining([
              expect.objectContaining({
                type: 'video',
                url: 'media/video-3.mp4'
              })
            ])
          })
        ])
      })
    }))
  })
})