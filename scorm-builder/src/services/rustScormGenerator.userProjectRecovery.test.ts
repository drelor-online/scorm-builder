/**
 * User Project YouTube Recovery Test
 * 
 * This test verifies that the specific YouTube videos from the user's project
 * (Complex_Projects_-_1_-_49_CFR_192_1756944000180) would be recovered correctly
 * with the new autoPopulateYouTubeFromStorage functionality.
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

describe('User Project YouTube Recovery', () => {
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

  test('recovers all three missing YouTube videos from user project', async () => {
    // Arrange: Mock the exact MediaService data from user's project
    mockMediaService.listAllMedia.mockResolvedValue([
      { id: 'image-0' },
      { id: 'image-3' },
      { id: 'image-4' },
      { id: 'image-5' },
      { id: 'video-1' }, // Missing from SCORM
      { id: 'video-2' }, // Missing from SCORM
      { id: 'video-6' }  // Partially working (missing clipping)
    ])

    // Mock the exact video metadata from user's JSON files
    const userVideoMetadata = {
      'video-1': {
        page_id: 'learning-objectives',
        type: 'youtube',
        original_name: 'unknown',
        mime_type: 'text/plain',
        source: 'youtube',
        embed_url: 'https://www.youtube.com/watch?v=tM-Q-YvF-ns',
        title: 'TC Energy — Coastal GasLink Pipeline — Pipeline Safety',
        clip_start: 30,
        clip_end: 60
      },
      'video-2': {
        page_id: 'topic-0',
        type: 'youtube',
        original_name: 'unknown',
        mime_type: 'text/plain',
        source: 'youtube',
        embed_url: 'https://www.youtube.com/watch?v=3cB5e5tDr4k',
        title: 'PHMSA Office of Hazardous Materials Safety Recruitment Video',
        clip_start: 30,
        clip_end: 60
      },
      'video-6': {
        page_id: 'topic-4',
        type: 'youtube',
        original_name: 'unknown',
        mime_type: 'text/plain',
        source: 'youtube',
        embed_url: 'https://www.youtube.com/watch?v=TvB8QQibvco',
        title: 'Pipeline DOT Part 192 Hoop Stress',
        clip_start: 60,
        clip_end: 89
      }
    }

    mockMediaService.getMedia.mockImplementation((videoId: string) => {
      const metadata = userVideoMetadata[videoId as keyof typeof userVideoMetadata]
      if (metadata) {
        const jsonData = new TextEncoder().encode(JSON.stringify(metadata))
        return Promise.resolve({
          data: jsonData,
          metadata: { mimeType: 'text/plain' }
        })
      }
      // For images, return null or non-video data
      return Promise.resolve({
        data: new Uint8Array([1, 2, 3]),
        metadata: { mimeType: 'image/jpeg' }
      })
    })

    // Simulate the user's course structure (simplified but with correct topic count)
    const courseContent: EnhancedCourseContent = {
      title: 'Complex Projects - 1 - 49 CFR 192',
      description: 'Pipeline safety regulations course',
      objectives: ['Understand 49 CFR Part 192', 'Learn pipeline safety'],
      objectivesPage: {
        title: 'Learning Objectives',
        content: 'Course objectives...',
        // This should receive video-1 after recovery
        media: []
      },
      topics: [
        {
          id: 'topic-0',
          title: 'Scope and Applicability of Part 192',
          content: 'Introduction to Federal Pipeline Safety Standards...',
          knowledgeCheck: { questions: [] },
          // This should receive video-2 after recovery
          media: []
        },
        { id: 'topic-1', title: 'Topic 1', content: 'Content 1', knowledgeCheck: { questions: [] } },
        { id: 'topic-2', title: 'Topic 2', content: 'Content 2', knowledgeCheck: { questions: [] } },
        { id: 'topic-3', title: 'Topic 3', content: 'Content 3', knowledgeCheck: { questions: [] } },
        {
          id: 'topic-4',
          title: 'Steel Pipe Design Formula',
          content: 'Calculating Pipe Strength...',
          knowledgeCheck: { questions: [] },
          // This should receive video-6 after recovery with correct clipping
          media: []
        }
      ],
      assessment: { questions: [] }
    }

    // Act: Generate SCORM with recovery
    const { convertToRustFormat } = await import('./rustScormGenerator')
    const result = await convertToRustFormat(courseContent, '1756944000180')

    // Assert: All three videos should be recovered with correct clipping

    // 1. Check video-1 in objectives page
    expect(result.courseData.learning_objectives_page).toBeDefined()
    expect(result.courseData.learning_objectives_page.media).toBeDefined()
    expect(result.courseData.learning_objectives_page.media).toHaveLength(1)
    
    const video1 = result.courseData.learning_objectives_page.media[0]
    expect(video1.id).toBe('video-1')
    expect(video1.title).toBe('TC Energy — Coastal GasLink Pipeline — Pipeline Safety')
    expect(video1.url).toBe('https://www.youtube.com/watch?v=tM-Q-YvF-ns')
    expect(video1.is_youtube).toBe(true)
    expect(video1.youtube_id).toBe('tM-Q-YvF-ns')
    expect(video1.clipStart).toBe(30)
    expect(video1.clipEnd).toBe(60)
    expect(video1.embed_url).toBe('https://www.youtube.com/embed/tM-Q-YvF-ns?rel=0&modestbranding=1&start=30&end=60')

    // 2. Check video-2 in topic-0
    expect(result.courseData.topics).toBeDefined()
    expect(result.courseData.topics).toHaveLength(5)
    expect(result.courseData.topics[0].media).toBeDefined()
    expect(result.courseData.topics[0].media).toHaveLength(1)
    
    const video2 = result.courseData.topics[0].media[0]
    expect(video2.id).toBe('video-2')
    expect(video2.title).toBe('PHMSA Office of Hazardous Materials Safety Recruitment Video')
    expect(video2.url).toBe('https://www.youtube.com/watch?v=3cB5e5tDr4k')
    expect(video2.is_youtube).toBe(true)
    expect(video2.youtube_id).toBe('3cB5e5tDr4k')
    expect(video2.clipStart).toBe(30)
    expect(video2.clipEnd).toBe(60)
    expect(video2.embed_url).toBe('https://www.youtube.com/embed/3cB5e5tDr4k?rel=0&modestbranding=1&start=30&end=60')

    // 3. Check video-6 in topic-4
    expect(result.courseData.topics[4].media).toBeDefined()
    expect(result.courseData.topics[4].media).toHaveLength(1)
    
    const video6 = result.courseData.topics[4].media[0]
    expect(video6.id).toBe('video-6')
    expect(video6.title).toBe('Pipeline DOT Part 192 Hoop Stress')
    expect(video6.url).toBe('https://www.youtube.com/watch?v=TvB8QQibvco')
    expect(video6.is_youtube).toBe(true)
    expect(video6.youtube_id).toBe('TvB8QQibvco')
    expect(video6.clipStart).toBe(60)
    expect(video6.clipEnd).toBe(89)
    expect(video6.embed_url).toBe('https://www.youtube.com/embed/TvB8QQibvco?rel=0&modestbranding=1&start=60&end=89')

    // 4. Verify other topics have no media
    expect(result.courseData.topics[1].media).toBeUndefined()
    expect(result.courseData.topics[2].media).toBeUndefined()
    expect(result.courseData.topics[3].media).toBeUndefined()

    // 5. Verify MediaService was called correctly
    expect(mockCreateMediaService).toHaveBeenCalledWith('1756944000180')
    expect(mockMediaService.listAllMedia).toHaveBeenCalled()
    expect(mockMediaService.getMedia).toHaveBeenCalledWith('video-1')
    expect(mockMediaService.getMedia).toHaveBeenCalledWith('video-2')
    expect(mockMediaService.getMedia).toHaveBeenCalledWith('video-6')
  })

  test('handles the specific issue where video-1 appears without clipping parameters', async () => {
    // This test specifically addresses the case where video-1 was appearing
    // in the SCORM but without the start=30&end=60 parameters
    
    mockMediaService.listAllMedia.mockResolvedValue([{ id: 'video-1' }])
    
    const videoMetadata = {
      page_id: 'learning-objectives',
      type: 'youtube',
      embed_url: 'https://www.youtube.com/watch?v=tM-Q-YvF-ns',
      title: 'TC Energy Video',
      clip_start: 30,
      clip_end: 60
    }

    mockMediaService.getMedia.mockResolvedValue({
      data: new TextEncoder().encode(JSON.stringify(videoMetadata)),
      metadata: { mimeType: 'text/plain' }
    })

    // Course already has the video but WITHOUT clipping info (simulating the bug)
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      description: 'Testing clipping recovery',
      objectives: ['Test'],
      objectivesPage: {
        title: 'Objectives',
        content: 'Objectives',
        media: [
          {
            id: 'video-1',
            type: 'video',
            title: 'Existing Video',
            url: 'https://www.youtube.com/watch?v=tM-Q-YvF-ns',
            embedUrl: 'https://www.youtube.com/embed/tM-Q-YvF-ns?rel=0&modestbranding=1', // Missing timing!
            isYouTube: true,
            // Missing clipStart and clipEnd!
          }
        ]
      },
      topics: [],
      assessment: { questions: [] }
    }

    // Act
    const { convertToRustFormat } = await import('./rustScormGenerator')
    const result = await convertToRustFormat(courseContent, 'test-clipping-recovery')

    // Assert: The existing video should NOT be duplicated, but clipping should still work
    // because the conversion process will handle the clipping correctly
    expect(result.courseData.learning_objectives_page.media).toHaveLength(1)
    
    const video = result.courseData.learning_objectives_page.media[0]
    expect(video.id).toBe('video-1')
    // Even if the original had no clipping, the conversion process should apply it
    expect(video.embed_url).toContain('start=')
    expect(video.embed_url).toContain('end=')
  })
})