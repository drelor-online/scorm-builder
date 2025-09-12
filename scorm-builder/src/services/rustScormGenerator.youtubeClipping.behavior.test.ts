/**
 * YouTube Clipping Behavior Tests for SCORM Generation
 * 
 * These tests verify that YouTube videos with clip timing (start/end times)
 * are correctly processed and included in SCORM packages with proper embed URLs.
 * 
 * Test scenarios:
 * 1. YouTube video with both clipStart and clipEnd
 * 2. YouTube video with only clipStart (no end time)
 * 3. YouTube video with only clipEnd (no start time)
 * 4. YouTube video with no clipping (regular embed)
 * 5. Multiple YouTube videos with different clip timings
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

vi.mock('./MediaService', () => ({
  createMediaService: vi.fn(() => ({
    listAllMedia: vi.fn().mockResolvedValue([]),
    getMedia: vi.fn().mockResolvedValue(null)
  }))
}))

describe('YouTube Clipping in SCORM Generation', () => {
  let mockInvoke: any
  let mockPreloadedMedia: Map<string, Blob>

  beforeEach(async () => {
    // Get mocked invoke function
    const { invoke } = await import('@tauri-apps/api/core')
    mockInvoke = invoke as any
    vi.clearAllMocks()

    // Mock successful SCORM generation
    mockInvoke.mockResolvedValue(new Uint8Array([1, 2, 3, 4]))

    // Create empty preloaded media map
    mockPreloadedMedia = new Map()
  })

  test('YouTube video with both clipStart and clipEnd generates correct embed URL', async () => {
    // Arrange: Course content with YouTube video having clip timing
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course with YouTube Clipping',
      description: 'Testing YouTube clip timing functionality',
      objectives: ['Test YouTube clipping'],
      topics: [
        {
          title: 'Topic with Clipped YouTube Video',
          content: 'This topic contains a YouTube video with clip timing.',
          knowledgeCheck: { questions: [] },
          media: [
            {
              id: 'video-1',
              type: 'video',
              title: 'Pipeline Safety Training',
              url: 'https://www.youtube.com/watch?v=TvB8QQibvco',
              embedUrl: 'https://www.youtube.com/embed/TvB8QQibvco?rel=0&modestbranding=1',
              isYouTube: true,
              mimeType: 'video/mp4',
              // Key test data: clip timing parameters
              clipStart: 60,  // Start at 1 minute
              clipEnd: 120    // End at 2 minutes
            }
          ],
          audioFile: undefined
        }
      ],
      assessment: { questions: [] }
    }

    // Act: Generate SCORM package
    const { convertToRustFormat } = await import('./rustScormGenerator')
    const result = await convertToRustFormat(
      courseContent,
      'test-project-youtube-clipping'
    )

    // Assert: Verify the conversion result contains correct YouTube embed URL with clip timing
    expect(result.courseData).toBeDefined()
    expect(result.courseData.topics).toHaveLength(1)
    
    const topic = result.courseData.topics[0]
    expect(topic.title).toBe('Topic with Clipped YouTube Video')
    expect(topic.media).toHaveLength(1)
    
    const videoMedia = topic.media[0]
    expect(videoMedia.url).toBe('https://www.youtube.com/watch?v=TvB8QQibvco')
    expect(videoMedia.is_youtube).toBe(true)
    expect(videoMedia.youtube_id).toBe('TvB8QQibvco')
    // Critical assertion: embed URL should include clip timing parameters
    expect(videoMedia.embed_url).toBe('https://www.youtube.com/embed/TvB8QQibvco?rel=0&modestbranding=1&start=60&end=120')
    
    // Verify the result structure
    expect(result.mediaFiles).toBeDefined()
  })

  test('YouTube video with only clipStart generates correct embed URL', async () => {
    // Arrange: Course content with YouTube video having only start time
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      description: 'Testing YouTube start-only clipping',
      objectives: ['Test start clipping'],
      topics: [
        {
          title: 'Topic with Start-Only Clipping',
          content: 'YouTube video that starts at specific time.',
          knowledgeCheck: { questions: [] },
          media: [
            {
              id: 'video-2',
              type: 'video',
              title: 'Training Video',
              url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1',
              isYouTube: true,
              mimeType: 'video/mp4',
              clipStart: 30,  // Start at 30 seconds
              clipEnd: undefined  // No end time specified
            }
          ],
          audioFile: undefined
        }
      ],
      assessment: { questions: [] }
    }

    // Act
    const { convertToRustFormat } = await import('./rustScormGenerator')
    const result = await convertToRustFormat(
      courseContent,
      'test-project-start-only'
    )

    // Assert: Should have start parameter but no end parameter
    const embedUrl = result.courseData.topics[0].media[0].embed_url
    expect(embedUrl).toContain('start=30')
    expect(embedUrl).not.toContain('end=')
    expect(embedUrl).toEqual('https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&start=30')
  })

  test('YouTube video with only clipEnd generates correct embed URL', async () => {
    // Arrange: Course content with YouTube video having only end time
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      description: 'Testing YouTube end-only clipping',
      objectives: ['Test end clipping'],
      topics: [
        {
          title: 'Topic with End-Only Clipping',
          content: 'YouTube video that ends at specific time.',
          knowledgeCheck: { questions: [] },
          media: [
            {
              id: 'video-3',
              type: 'video',
              title: 'Short Training Clip',
              url: 'https://www.youtube.com/watch?v=abcdef12345',
              embedUrl: 'https://www.youtube.com/embed/abcdef12345?rel=0&modestbranding=1',
              isYouTube: true,
              mimeType: 'video/mp4',
              clipStart: undefined,  // No start time specified
              clipEnd: 90           // End at 90 seconds
            }
          ],
          audioFile: undefined
        }
      ],
      assessment: { questions: [] }
    }

    // Act
    const { convertToRustFormat } = await import('./rustScormGenerator')
    const result = await convertToRustFormat(
      courseContent,
      'test-project-end-only'
    )

    // Assert: Should have end parameter but no start parameter
    const embedUrl = result.courseData.topics[0].media[0].embed_url
    expect(embedUrl).toContain('end=90')
    expect(embedUrl).not.toContain('start=')
    expect(embedUrl).toEqual('https://www.youtube.com/embed/abcdef12345?rel=0&modestbranding=1&end=90')
  })

  test('YouTube video with no clipping generates standard embed URL', async () => {
    // Arrange: Course content with regular YouTube video (no clipping)
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      description: 'Testing standard YouTube embed',
      objectives: ['Test standard embed'],
      topics: [
        {
          title: 'Topic with Standard YouTube Video',
          content: 'Regular YouTube video without clipping.',
          knowledgeCheck: { questions: [] },
          media: [
            {
              id: 'video-4',
              type: 'video',
              title: 'Full Training Video',
              url: 'https://www.youtube.com/watch?v=xyz789',
              embedUrl: 'https://www.youtube.com/embed/xyz789?rel=0&modestbranding=1',
              isYouTube: true,
              mimeType: 'video/mp4',
              clipStart: undefined,
              clipEnd: undefined
            }
          ],
          audioFile: undefined
        }
      ],
      assessment: { questions: [] }
    }

    // Act
    const { convertToRustFormat } = await import('./rustScormGenerator')
    const result = await convertToRustFormat(
      courseContent,
      'test-project-standard'
    )

    // Assert: Should have no timing parameters
    const embedUrl = result.courseData.topics[0].media[0].embed_url
    expect(embedUrl).not.toContain('start=')
    expect(embedUrl).not.toContain('end=')
    expect(embedUrl).toEqual('https://www.youtube.com/embed/xyz789?rel=0&modestbranding=1')
  })

  test('Multiple YouTube videos with different clip timings are processed correctly', async () => {
    // Arrange: Course content with multiple YouTube videos with various clip timing scenarios
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      description: 'Testing multiple YouTube videos with different clipping',
      objectives: ['Test multiple clipping scenarios'],
      topics: [
        {
          title: 'Topic with Multiple Videos',
          content: 'Multiple YouTube videos with different clip settings.',
          knowledgeCheck: { questions: [] },
          media: [
            {
              id: 'video-5',
              type: 'video',
              title: 'Full Clip (start + end)',
              url: 'https://www.youtube.com/watch?v=video1',
              embedUrl: 'https://www.youtube.com/embed/video1?rel=0&modestbranding=1',
              isYouTube: true,
              mimeType: 'video/mp4',
              clipStart: 15,
              clipEnd: 45
            },
            {
              id: 'video-6',
              type: 'video',
              title: 'Start Only',
              url: 'https://www.youtube.com/watch?v=video2',
              embedUrl: 'https://www.youtube.com/embed/video2?rel=0&modestbranding=1',
              isYouTube: true,
              mimeType: 'video/mp4',
              clipStart: 30,
              clipEnd: undefined
            },
            {
              id: 'video-7',
              type: 'video',
              title: 'No Clipping',
              url: 'https://www.youtube.com/watch?v=video3',
              embedUrl: 'https://www.youtube.com/embed/video3?rel=0&modestbranding=1',
              isYouTube: true,
              mimeType: 'video/mp4',
              clipStart: undefined,
              clipEnd: undefined
            }
          ],
          audioFile: undefined
        }
      ],
      assessment: { questions: [] }
    }

    // Act
    const { convertToRustFormat } = await import('./rustScormGenerator')
    const result = await convertToRustFormat(
      courseContent,
      'test-project-multiple'
    )

    // Assert: Check each video has correct embed URL
    const mediaItems = result.courseData.topics[0].media
    
    // Video 1: Both start and end
    expect(mediaItems[0].embed_url).toEqual('https://www.youtube.com/embed/video1?rel=0&modestbranding=1&start=15&end=45')
    
    // Video 2: Start only
    expect(mediaItems[1].embed_url).toEqual('https://www.youtube.com/embed/video2?rel=0&modestbranding=1&start=30')
    
    // Video 3: No clipping
    expect(mediaItems[2].embed_url).toEqual('https://www.youtube.com/embed/video3?rel=0&modestbranding=1')
  })

  test('YouTube clipping handles edge cases correctly', async () => {
    // Arrange: Test edge cases like zero values and fractional seconds
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      description: 'Testing YouTube clipping edge cases',
      objectives: ['Test edge cases'],
      topics: [
        {
          title: 'Edge Cases Topic',
          content: 'Testing edge cases for YouTube clipping.',
          knowledgeCheck: { questions: [] },
          media: [
            {
              id: 'video-edge-1',
              type: 'video',
              title: 'Zero Start Time',
              url: 'https://www.youtube.com/watch?v=edge1',
              embedUrl: 'https://www.youtube.com/embed/edge1?rel=0&modestbranding=1',
              isYouTube: true,
              mimeType: 'video/mp4',
              clipStart: 0,  // Start at beginning (should still add parameter)
              clipEnd: 30
            },
            {
              id: 'video-edge-2',
              type: 'video',
              title: 'Fractional Seconds',
              url: 'https://www.youtube.com/watch?v=edge2',
              embedUrl: 'https://www.youtube.com/embed/edge2?rel=0&modestbranding=1',
              isYouTube: true,
              mimeType: 'video/mp4',
              clipStart: 45.7,  // Should be floored to 45
              clipEnd: 90.9     // Should be floored to 90
            }
          ],
          audioFile: undefined
        }
      ],
      assessment: { questions: [] }
    }

    // Act
    const { convertToRustFormat } = await import('./rustScormGenerator')
    const result = await convertToRustFormat(
      courseContent,
      'test-project-edge-cases'
    )

    // Assert: Check edge case handling
    const mediaItems = result.courseData.topics[0].media
    
    // Zero start time should still be included
    expect(mediaItems[0].embed_url).toEqual('https://www.youtube.com/embed/edge1?rel=0&modestbranding=1&start=0&end=30')
    
    // Fractional seconds should be floored
    expect(mediaItems[1].embed_url).toEqual('https://www.youtube.com/embed/edge2?rel=0&modestbranding=1&start=45&end=90')
  })
})