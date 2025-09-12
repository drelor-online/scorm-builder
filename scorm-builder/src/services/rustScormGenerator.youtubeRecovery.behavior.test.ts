/**
 * YouTube Video Recovery Behavior Tests
 * 
 * Tests for the autoPopulateYouTubeFromStorage function that recovers YouTube videos
 * with clipping parameters from MediaService storage and adds them back to course content.
 * 
 * This reproduces the exact user scenario:
 * 1. YouTube videos with clipping are stored in MediaService as JSON metadata
 * 2. Course content structure lacks these videos (after reload or recovery)
 * 3. autoPopulateYouTubeFromStorage recovers and adds videos back to appropriate pages
 * 4. SCORM generation includes recovered videos with correct clipping parameters
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import type { EnhancedCourseContent } from '../types/scorm'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn()
}))

// Mock external dependencies
vi.mock('./externalImageDownloader', () => ({
  downloadIfExternal: vi.fn(),
  isExternalUrl: vi.fn()
}))

describe('YouTube Video Recovery from MediaService', () => {
  let mockMediaService: any
  let mockCreateMediaService: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock MediaService
    mockMediaService = {
      listAllMedia: vi.fn(),
      getMedia: vi.fn()
    }

    mockCreateMediaService = vi.fn().mockReturnValue(mockMediaService)

    // Mock the MediaService module
    vi.doMock('./MediaService', () => ({
      createMediaService: mockCreateMediaService
    }))
  })

  test('recovers YouTube video with clipping from MediaService and adds to objectives page', async () => {
    // Arrange: Mock MediaService responses
    mockMediaService.listAllMedia.mockResolvedValue([
      { id: 'video-1' },
      { id: 'image-0' }, // Should be ignored
      { id: 'video-2' }
    ])

    // Mock video metadata (matching user's actual data)
    const videoMetadata = {
      page_id: 'learning-objectives',
      type: 'youtube',
      original_name: 'unknown',
      mime_type: 'text/plain',
      source: 'youtube',
      embed_url: 'https://www.youtube.com/watch?v=tM-Q-YvF-ns',
      title: 'TC Energy — Coastal GasLink Pipeline — Pipeline Safety',
      clip_start: 30,
      clip_end: 60
    }

    mockMediaService.getMedia.mockImplementation((videoId: string) => {
      if (videoId === 'video-1') {
        const jsonData = new TextEncoder().encode(JSON.stringify(videoMetadata))
        return Promise.resolve({
          data: jsonData,
          metadata: { mimeType: 'text/plain' }
        })
      }
      if (videoId === 'video-2') {
        // Non-YouTube video
        return Promise.resolve({
          data: new Uint8Array([1, 2, 3]),
          metadata: { mimeType: 'video/mp4' }
        })
      }
      return Promise.resolve(null)
    })

    // Course content without the video (simulating missing video scenario)
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      description: 'Testing YouTube recovery',
      objectives: ['Test YouTube recovery'],
      objectivesPage: {
        title: 'Learning Objectives',
        content: 'Course objectives',
        media: [] // Initially empty
      },
      topics: [],
      assessment: { questions: [] }
    }

    // Act: Import and call the recovery function
    const { convertToRustFormat } = await import('./rustScormGenerator')
    const result = await convertToRustFormat(courseContent, 'test-project-recovery')

    // Assert: Verify YouTube video was recovered and added
    expect(mockCreateMediaService).toHaveBeenCalledWith('test-project-recovery')
    expect(mockMediaService.listAllMedia).toHaveBeenCalled()
    expect(mockMediaService.getMedia).toHaveBeenCalledWith('video-1')

    // Check that the course content structure now includes the recovered video
    expect(result.courseData).toBeDefined()
    expect(result.courseData.learning_objectives_page).toBeDefined()
    expect(result.courseData.learning_objectives_page.media).toBeDefined()
    expect(result.courseData.learning_objectives_page.media).toHaveLength(1)

    // Verify the recovered video has correct properties
    const recoveredVideo = result.courseData.learning_objectives_page.media[0]
    expect(recoveredVideo.id).toBe('video-1')
    expect(recoveredVideo.title).toBe('TC Energy — Coastal GasLink Pipeline — Pipeline Safety')
    expect(recoveredVideo.url).toBe('https://www.youtube.com/watch?v=tM-Q-YvF-ns')
    expect(recoveredVideo.is_youtube).toBe(true)
    expect(recoveredVideo.youtube_id).toBe('tM-Q-YvF-ns')
    
    // Most importantly: verify clipping parameters are preserved
    expect(recoveredVideo.clipStart).toBe(30)
    expect(recoveredVideo.clipEnd).toBe(60)
    
    // Verify correct embed URL with clipping
    expect(recoveredVideo.embed_url).toBe('https://www.youtube.com/embed/tM-Q-YvF-ns?rel=0&modestbranding=1&start=30&end=60')
  })

  test('recovers YouTube video and adds to correct topic based on page_id', async () => {
    // Arrange: Mock video for topic-0
    mockMediaService.listAllMedia.mockResolvedValue([
      { id: 'video-2' }
    ])

    const topicVideoMetadata = {
      page_id: 'topic-0',
      type: 'youtube',
      embed_url: 'https://www.youtube.com/watch?v=3cB5e5tDr4k',
      title: 'PHMSA Office of Hazardous Materials Safety Recruitment Video',
      clip_start: 30,
      clip_end: 60
    }

    mockMediaService.getMedia.mockImplementation((videoId: string) => {
      if (videoId === 'video-2') {
        const jsonData = new TextEncoder().encode(JSON.stringify(topicVideoMetadata))
        return Promise.resolve({
          data: jsonData,
          metadata: { mimeType: 'application/json' }
        })
      }
      return Promise.resolve(null)
    })

    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      description: 'Testing topic recovery',
      objectives: ['Test topic recovery'],
      topics: [
        {
          id: 'topic-0',
          title: 'First Topic',
          content: 'Topic content',
          knowledgeCheck: { questions: [] },
          media: [] // Initially empty
        },
        {
          id: 'topic-1', 
          title: 'Second Topic',
          content: 'Second topic content',
          knowledgeCheck: { questions: [] }
        }
      ],
      assessment: { questions: [] }
    }

    // Act
    const { convertToRustFormat } = await import('./rustScormGenerator')
    const result = await convertToRustFormat(courseContent, 'test-project-topic-recovery')

    // Assert: Verify video was added to correct topic
    expect(result.courseData.topics).toBeDefined()
    expect(result.courseData.topics).toHaveLength(2)
    
    const firstTopic = result.courseData.topics[0]
    expect(firstTopic.media).toBeDefined()
    expect(firstTopic.media).toHaveLength(1)
    
    const recoveredVideo = firstTopic.media[0]
    expect(recoveredVideo.id).toBe('video-2')
    expect(recoveredVideo.title).toBe('PHMSA Office of Hazardous Materials Safety Recruitment Video')
    expect(recoveredVideo.url).toBe('https://www.youtube.com/watch?v=3cB5e5tDr4k')
    expect(recoveredVideo.clipStart).toBe(30)
    expect(recoveredVideo.clipEnd).toBe(60)
    
    // Verify second topic remains unaffected
    const secondTopic = result.courseData.topics[1]
    expect(secondTopic.media).toBeUndefined()
  })

  test('does not duplicate existing videos when they already exist in course content', async () => {
    // Arrange: Course content already has the video
    mockMediaService.listAllMedia.mockResolvedValue([
      { id: 'video-1' }
    ])

    const videoMetadata = {
      page_id: 'learning-objectives',
      type: 'youtube',
      embed_url: 'https://www.youtube.com/watch?v=existing',
      title: 'Existing Video',
      clip_start: 15,
      clip_end: 45
    }

    mockMediaService.getMedia.mockImplementation(() => {
      const jsonData = new TextEncoder().encode(JSON.stringify(videoMetadata))
      return Promise.resolve({
        data: jsonData,
        metadata: { mimeType: 'text/plain' }
      })
    })

    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      description: 'Testing duplication prevention',
      objectives: ['Test duplication'],
      objectivesPage: {
        title: 'Learning Objectives',
        content: 'Objectives',
        media: [
          {
            id: 'video-1', // Same ID as in storage
            type: 'video',
            title: 'Existing Video',
            url: 'https://www.youtube.com/watch?v=existing',
            isYouTube: true
          }
        ]
      },
      topics: [],
      assessment: { questions: [] }
    }

    // Act
    const { convertToRustFormat } = await import('./rustScormGenerator')
    const result = await convertToRustFormat(courseContent, 'test-project-no-duplicate')

    // Assert: Should still have only one video (no duplication)
    expect(result.courseData.learning_objectives_page.media).toHaveLength(1)
    expect(result.courseData.learning_objectives_page.media[0].id).toBe('video-1')
  })

  test('skips non-YouTube videos during recovery', async () => {
    // Arrange: Mock non-YouTube video
    mockMediaService.listAllMedia.mockResolvedValue([
      { id: 'video-3' }
    ])

    const nonYouTubeMetadata = {
      page_id: 'topic-0',
      type: 'local',
      url: 'local-video.mp4',
      title: 'Local Video File'
    }

    mockMediaService.getMedia.mockImplementation(() => {
      const jsonData = new TextEncoder().encode(JSON.stringify(nonYouTubeMetadata))
      return Promise.resolve({
        data: jsonData,
        metadata: { mimeType: 'application/json' }
      })
    })

    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      description: 'Testing non-YouTube skipping',
      objectives: ['Test skipping'],
      topics: [
        {
          id: 'topic-0',
          title: 'First Topic',
          content: 'Topic content',
          knowledgeCheck: { questions: [] }
        }
      ],
      assessment: { questions: [] }
    }

    // Act
    const { convertToRustFormat } = await import('./rustScormGenerator')
    const result = await convertToRustFormat(courseContent, 'test-project-skip-non-youtube')

    // Assert: Non-YouTube video should not be added to course content
    expect(result.courseData.topics[0].media).toBeUndefined()
  })

  test('handles MediaService errors gracefully', async () => {
    // Arrange: Mock MediaService to throw error
    mockMediaService.listAllMedia.mockRejectedValue(new Error('MediaService connection failed'))

    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      description: 'Testing error handling',
      objectives: ['Test error handling'],
      topics: [],
      assessment: { questions: [] }
    }

    // Act & Assert: Should not throw error, should handle gracefully
    const { convertToRustFormat } = await import('./rustScormGenerator')
    const result = await convertToRustFormat(courseContent, 'test-project-error-handling')

    // Should still return valid result even if recovery fails
    expect(result.courseData).toBeDefined()
    expect(result.courseData.course_title).toBe('Test Course')
  })

  test('recovers multiple YouTube videos across different pages', async () => {
    // Arrange: Multiple videos for different pages
    mockMediaService.listAllMedia.mockResolvedValue([
      { id: 'video-1' },
      { id: 'video-2' }, 
      { id: 'video-6' }
    ])

    const videoMetadataMap = {
      'video-1': {
        page_id: 'learning-objectives',
        type: 'youtube',
        embed_url: 'https://www.youtube.com/watch?v=tM-Q-YvF-ns',
        title: 'Objectives Video',
        clip_start: 30,
        clip_end: 60
      },
      'video-2': {
        page_id: 'topic-0',
        type: 'youtube', 
        embed_url: 'https://www.youtube.com/watch?v=3cB5e5tDr4k',
        title: 'Topic 0 Video',
        clip_start: 30,
        clip_end: 60
      },
      'video-6': {
        page_id: 'topic-4',
        type: 'youtube',
        embed_url: 'https://www.youtube.com/watch?v=TvB8QQibvco',
        title: 'Topic 4 Video',
        clip_start: 60,
        clip_end: 89
      }
    }

    mockMediaService.getMedia.mockImplementation((videoId: string) => {
      const metadata = videoMetadataMap[videoId as keyof typeof videoMetadataMap]
      if (metadata) {
        const jsonData = new TextEncoder().encode(JSON.stringify(metadata))
        return Promise.resolve({
          data: jsonData,
          metadata: { mimeType: 'text/plain' }
        })
      }
      return Promise.resolve(null)
    })

    const courseContent: EnhancedCourseContent = {
      title: 'Complex Course',
      description: 'Multiple YouTube videos',
      objectives: ['Test multiple recovery'],
      objectivesPage: {
        title: 'Learning Objectives',
        content: 'Objectives'
      },
      topics: [
        { id: 'topic-0', title: 'Topic 0', content: 'Content 0', knowledgeCheck: { questions: [] } },
        { id: 'topic-1', title: 'Topic 1', content: 'Content 1', knowledgeCheck: { questions: [] } },
        { id: 'topic-2', title: 'Topic 2', content: 'Content 2', knowledgeCheck: { questions: [] } },
        { id: 'topic-3', title: 'Topic 3', content: 'Content 3', knowledgeCheck: { questions: [] } },
        { id: 'topic-4', title: 'Topic 4', content: 'Content 4', knowledgeCheck: { questions: [] } }
      ],
      assessment: { questions: [] }
    }

    // Act
    const { convertToRustFormat } = await import('./rustScormGenerator')
    const result = await convertToRustFormat(courseContent, 'test-project-multiple-recovery')

    // Assert: All videos should be recovered to correct pages
    
    // Check objectives page
    expect(result.courseData.learning_objectives_page.media).toHaveLength(1)
    expect(result.courseData.learning_objectives_page.media[0].id).toBe('video-1')
    expect(result.courseData.learning_objectives_page.media[0].clipStart).toBe(30)
    expect(result.courseData.learning_objectives_page.media[0].clipEnd).toBe(60)

    // Check topic-0
    expect(result.courseData.topics[0].media).toHaveLength(1)
    expect(result.courseData.topics[0].media[0].id).toBe('video-2')
    expect(result.courseData.topics[0].media[0].clipStart).toBe(30)
    expect(result.courseData.topics[0].media[0].clipEnd).toBe(60)

    // Check topic-4  
    expect(result.courseData.topics[4].media).toHaveLength(1)
    expect(result.courseData.topics[4].media[0].id).toBe('video-6')
    expect(result.courseData.topics[4].media[0].clipStart).toBe(60)
    expect(result.courseData.topics[4].media[0].clipEnd).toBe(89)

    // Check that other topics have no media
    expect(result.courseData.topics[1].media).toBeUndefined()
    expect(result.courseData.topics[2].media).toBeUndefined()
    expect(result.courseData.topics[3].media).toBeUndefined()
  })
})