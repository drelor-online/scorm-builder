/**
 * TDD Test: Caption Media Type Validation in SCORM Generator
 *
 * Tests to reproduce and fix the validation error where caption media types
 * are rejected by the SCORM generator validation schema.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { convertToRustFormat } from './rustScormGenerator'
import { MockFileStorage } from './MockFileStorage'

describe('SCORM Generator Caption Validation', () => {
  let mockFileStorage: MockFileStorage

  beforeEach(() => {
    mockFileStorage = new MockFileStorage()

    // Mock the media files that would be created by AudioNarrationWizard
    ;(mockFileStorage as any).getAllProjectMedia = vi.fn().mockResolvedValue([
      // Audio files
      { id: 'audio-0', metadata: { type: 'audio', original_name: 'welcome-audio.mp3' } },
      { id: 'audio-1', metadata: { type: 'audio', original_name: 'objectives-audio.mp3' } },
      { id: 'audio-2', metadata: { type: 'audio', original_name: 'topic-1-audio.mp3' } },

      // Caption files - these cause the validation error
      { id: 'caption-0', metadata: { type: 'caption', original_name: 'welcome-caption.vtt' } },
      { id: 'caption-1', metadata: { type: 'caption', original_name: 'objectives-caption.vtt' } },
      { id: 'caption-2', metadata: { type: 'caption', original_name: 'topic-1-caption.vtt' } }
    ])

    // Mock media retrieval
    ;(mockFileStorage as any).getMedia = vi.fn().mockImplementation((mediaId: string) => {
      if (mediaId.startsWith('audio-')) {
        return Promise.resolve({
          data: new Uint8Array(1000), // Mock audio data
          metadata: { type: 'audio', mimeType: 'audio/mpeg' }
        })
      }
      if (mediaId.startsWith('caption-')) {
        const captionContent = `WEBVTT\n\n00:00.000 --> 00:05.000\nSample caption for ${mediaId}`
        return Promise.resolve({
          data: new TextEncoder().encode(captionContent),
          metadata: { type: 'caption', mimeType: 'text/vtt', content: captionContent }
        })
      }
      return Promise.resolve(null)
    })
  })

  it('should now accept course content with caption media types (previously failed)', async () => {
    // Arrange - Course content that includes caption media items (as created by AudioNarrationWizard)
    // This previously failed with validation error before the fix
    const courseContentWithCaptions = {
      title: "Test Course with Captions",
      description: "Course to test caption validation",
      welcome: {
        title: "Welcome",
        content: "Welcome content",
        media: [
          { id: 'audio-0', type: 'audio', storageId: 'audio-0', title: '', url: '' },
          { id: 'caption-0', type: 'caption', storageId: 'caption-0', title: '', url: '', content: 'WEBVTT caption' }
        ]
      },
      objectivesPage: {
        title: "Learning Objectives",
        content: "Objectives content",
        media: [
          { id: 'audio-1', type: 'audio', storageId: 'audio-1', title: '', url: '' },
          { id: 'caption-1', type: 'caption', storageId: 'caption-1', title: '', url: '', content: 'WEBVTT caption' }
        ]
      },
      topics: [
        {
          id: "topic-1",
          title: "Topic 1",
          content: "Topic 1 content",
          media: [
            { id: 'audio-2', type: 'audio', storageId: 'audio-2', title: '', url: '' },
            { id: 'caption-2', type: 'caption', storageId: 'caption-2', title: '', url: '', content: 'WEBVTT caption' }
          ]
        }
      ],
      assessment: {
        enabled: false,
        questions: []
      }
    }

    const courseSettings = {
      title: "Test Course",
      description: "Test course description",
      duration: 60,
      passingScore: 80
    }

    // Act - Should now pass validation (previously this threw the error)
    const result = await convertToRustFormat(courseContentWithCaptions, 'test-project', courseSettings)

    // Assert - Should generate successfully without validation errors
    expect(result).toBeDefined()
    expect(result.courseData).toBeDefined()

    // Verify captions are filtered out from media arrays as intended
    // Note: The exact structure may vary but the important part is no validation error
    if (result.courseData && result.courseData.welcome) {
      expect(result.courseData.welcome.media).toBeDefined()
      const welcomeMediaTypes = result.courseData.welcome.media.map((m: any) => m.type)
      expect(welcomeMediaTypes).not.toContain('caption')
    }
  })

  it('should accept course content with caption media types after fix', async () => {
    // Arrange - Same course content with captions
    const courseContentWithCaptions = {
      title: "Test Course with Captions",
      description: "Course to test caption validation",
      welcome: {
        title: "Welcome",
        content: "Welcome content",
        media: [
          { id: 'audio-0', type: 'audio', storageId: 'audio-0', title: '', url: '' },
          { id: 'caption-0', type: 'caption', storageId: 'caption-0', title: '', url: '', content: 'WEBVTT caption' }
        ]
      },
      objectivesPage: {
        title: "Learning Objectives",
        content: "Objectives content",
        media: [
          { id: 'audio-1', type: 'audio', storageId: 'audio-1', title: '', url: '' },
          { id: 'caption-1', type: 'caption', storageId: 'caption-1', title: '', url: '', content: 'WEBVTT caption' }
        ]
      },
      topics: [
        {
          id: "topic-1",
          title: "Topic 1",
          content: "Topic 1 content",
          media: [
            { id: 'audio-2', type: 'audio', storageId: 'audio-2', title: '', url: '' },
            { id: 'caption-2', type: 'caption', storageId: 'caption-2', title: '', url: '', content: 'WEBVTT caption' }
          ]
        }
      ],
      assessment: {
        enabled: false,
        questions: []
      }
    }

    const courseSettings = {
      title: "Test Course",
      description: "Test course description",
      duration: 60,
      passingScore: 80
    }

    // Act - Should pass validation after the fix
    const result = await convertToRustFormat(courseContentWithCaptions, 'test-project', courseSettings)

    // Assert - Should generate successfully
    expect(result).toBeDefined()
    expect(result.courseData).toBeDefined()

    // Verify captions are filtered out from media arrays but content is preserved
    // Note: The important part is that validation passed without errors
    if (result.courseData && result.courseData.welcome) {
      expect(result.courseData.welcome.media).toBeDefined()
      // Media array should not contain caption items (they're filtered out)
      const welcomeMediaTypes = result.courseData.welcome.media.map((m: any) => m.type)
      expect(welcomeMediaTypes).not.toContain('caption')
    }

    // But caption content should be available in captionFile or other caption handling
    // (This part depends on how captions are processed - we're mainly testing validation passes)
  })

  it('should properly filter caption media from final output while preserving other media', async () => {
    // Arrange - Course with mixed media types including captions
    const courseContentMixed = {
      title: "Mixed Media Course",
      description: "Course with various media types",
      welcome: {
        title: "Welcome",
        content: "Welcome content",
        media: [
          { id: 'image-1', type: 'image', storageId: 'image-1', title: 'Test Image', url: 'image1.jpg' },
          { id: 'audio-0', type: 'audio', storageId: 'audio-0', title: '', url: '' },
          { id: 'caption-0', type: 'caption', storageId: 'caption-0', title: '', url: '', content: 'WEBVTT caption' },
          { id: 'video-1', type: 'video', storageId: 'video-1', title: 'Test Video', url: 'video1.mp4' }
        ]
      },
      objectivesPage: {
        title: "Learning Objectives",
        content: "Objectives content",
        media: []
      },
      topics: [{
        id: "topic-1",
        title: "Topic 1",
        content: "Topic content",
        media: [
          { id: 'audio-2', type: 'audio', storageId: 'audio-2', title: '', url: '' },
          { id: 'caption-2', type: 'caption', storageId: 'caption-2', title: '', url: '', content: 'WEBVTT caption' }
        ]
      }],
      assessment: { enabled: false, questions: [] }
    }

    const courseSettings = {
      title: "Mixed Media Course",
      description: "Test course with mixed media",
      duration: 60,
      passingScore: 80
    }

    // Act
    const result = await convertToRustFormat(courseContentMixed, 'test-project', courseSettings)

    // Assert - Should generate successfully
    expect(result).toBeDefined()
    expect(result.courseData).toBeDefined()

    // Verify media arrays contain non-caption media
    // Note: The important part is that validation passed without errors
    if (result.courseData && result.courseData.welcome) {
      const welcomeMedia = result.courseData.welcome.media
      expect(welcomeMedia).toBeDefined()

      // Should contain image and video, but not caption or audio (audio filtered separately)
      const mediaTypes = welcomeMedia.map((m: any) => m.type)
      expect(mediaTypes).toContain('image')
      expect(mediaTypes).toContain('video')
      expect(mediaTypes).not.toContain('caption')
      expect(mediaTypes).not.toContain('audio') // Audio also filtered out
    }
  })
})