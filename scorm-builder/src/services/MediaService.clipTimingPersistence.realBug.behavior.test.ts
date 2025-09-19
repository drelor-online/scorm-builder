import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MediaService, __testing } from './MediaService'
import { MockFileStorage } from './MockFileStorage'

/**
 * TDD Behavior Test: Real Clip Timing Persistence Bug
 *
 * This test reproduces the EXACT issue reported by the user:
 * 1. User updates YouTube video with clip timing
 * 2. Values get stored as "null" instead of being normalized
 * 3. When retrieved, they remain as null causing UI display issues
 *
 * This test should FAIL before the fix and PASS after the fix.
 */
describe('MediaService - Real Clip Timing Persistence Bug', () => {
  let mediaService: MediaService
  let mockFileStorage: MockFileStorage

  beforeEach(async () => {
    mockFileStorage = new MockFileStorage()
    await mockFileStorage.initialize()
    await mockFileStorage.createProject('Test Project')

    mediaService = MediaService.getInstance({
      projectId: 'test-project',
      fileStorage: mockFileStorage as any
    })
  })

  afterEach(() => {
    __testing.clearInstances()
  })

  it('should normalize null clip timing values when saving (fixing the exact bug)', async () => {
    // Arrange: Store a YouTube video first
    const youtubeUrl = 'https://www.youtube.com/watch?v=tM-Q-YvF-ns'
    const embedUrl = 'https://www.youtube.com/embed/tM-Q-YvF-ns'
    const pageId = 'learning-objectives'

    const initialYouTubeVideo = await mediaService.storeYouTubeVideo(
      youtubeUrl,
      embedUrl,
      pageId,
      { title: 'Test Video' }
    )

    const mediaId = initialYouTubeVideo.id

    // Act: Update with NULL clip timing values (this is what caused the bug)
    // Before the fix: these null values would be stored as-is
    // After the fix: these should be normalized to undefined before storing
    await mediaService.updateYouTubeVideoMetadata(mediaId, {
      clipStart: null as any,
      clipEnd: null as any,
      embedUrl
    })

    // Check what was actually stored in the FileStorage (snake_case format)
    const storedMedia = await mockFileStorage.getMedia(mediaId)

    console.log('🔍 [BUG TEST] What was stored in FileStorage:', {
      clip_start: storedMedia?.metadata?.clip_start,
      clip_end: storedMedia?.metadata?.clip_end,
      clip_startType: typeof storedMedia?.metadata?.clip_start,
      clip_endType: typeof storedMedia?.metadata?.clip_end
    })

    // Assert: The bug was that null values were stored as null
    // After the fix, they should be stored as undefined
    expect(storedMedia?.metadata?.clip_start).toBeUndefined()
    expect(storedMedia?.metadata?.clip_end).toBeUndefined()

    // These should NOT be null (this was the bug)
    expect(storedMedia?.metadata?.clip_start).not.toBe(null)
    expect(storedMedia?.metadata?.clip_end).not.toBe(null)

    // When retrieved through MediaService, they should also be undefined
    const retrievedMedia = await (mediaService as any).getMediaInternal(mediaId)

    console.log('🔍 [BUG TEST] What was retrieved through MediaService:', {
      clipStart: retrievedMedia?.metadata?.clipStart,
      clipEnd: retrievedMedia?.metadata?.clipEnd,
      clipStartType: typeof retrievedMedia?.metadata?.clipStart,
      clipEndType: typeof retrievedMedia?.metadata?.clipEnd
    })

    expect(retrievedMedia?.metadata?.clipStart).toBeUndefined()
    expect(retrievedMedia?.metadata?.clipEnd).toBeUndefined()
    expect(retrievedMedia?.metadata?.clipStart).not.toBe(null)
    expect(retrievedMedia?.metadata?.clipEnd).not.toBe(null)
  })

  it('should preserve valid number values when normalizing', async () => {
    // Arrange
    const youtubeUrl = 'https://www.youtube.com/watch?v=test'
    const embedUrl = 'https://www.youtube.com/embed/test'
    const pageId = 'test-page'

    const youTubeVideo = await mediaService.storeYouTubeVideo(youtubeUrl, embedUrl, pageId)
    const mediaId = youTubeVideo.id

    // Act: Update with valid number values
    const clipStart = 45
    const clipEnd = 120

    await mediaService.updateYouTubeVideoMetadata(mediaId, {
      clipStart,
      clipEnd,
      embedUrl
    })

    // Assert: Numbers should be preserved as-is
    const storedMedia = await mockFileStorage.getMedia(mediaId)
    expect(storedMedia?.metadata?.clip_start).toBe(clipStart)
    expect(storedMedia?.metadata?.clip_end).toBe(clipEnd)
    expect(typeof storedMedia?.metadata?.clip_start).toBe('number')
    expect(typeof storedMedia?.metadata?.clip_end).toBe('number')

    const retrievedMedia = await (mediaService as any).getMediaInternal(mediaId)
    expect(retrievedMedia?.metadata?.clipStart).toBe(clipStart)
    expect(retrievedMedia?.metadata?.clipEnd).toBe(clipEnd)
    expect(typeof retrievedMedia?.metadata?.clipStart).toBe('number')
    expect(typeof retrievedMedia?.metadata?.clipEnd).toBe('number')
  })

  it('should convert string clip timing values to numbers', async () => {
    // Arrange
    const youtubeUrl = 'https://www.youtube.com/watch?v=test'
    const embedUrl = 'https://www.youtube.com/embed/test'
    const pageId = 'test-page'

    const youTubeVideo = await mediaService.storeYouTubeVideo(youtubeUrl, embedUrl, pageId)
    const mediaId = youTubeVideo.id

    // Act: Update with string values (common from form inputs)
    await mediaService.updateYouTubeVideoMetadata(mediaId, {
      clipStart: '45' as any,
      clipEnd: '120' as any,
      embedUrl
    })

    // Assert: Strings should be converted to numbers
    const storedMedia = await mockFileStorage.getMedia(mediaId)
    expect(storedMedia?.metadata?.clip_start).toBe(45)
    expect(storedMedia?.metadata?.clip_end).toBe(120)
    expect(typeof storedMedia?.metadata?.clip_start).toBe('number')
    expect(typeof storedMedia?.metadata?.clip_end).toBe('number')

    const retrievedMedia = await (mediaService as any).getMediaInternal(mediaId)
    expect(retrievedMedia?.metadata?.clipStart).toBe(45)
    expect(retrievedMedia?.metadata?.clipEnd).toBe(120)
    expect(typeof retrievedMedia?.metadata?.clipStart).toBe('number')
    expect(typeof retrievedMedia?.metadata?.clipEnd).toBe('number')
  })
})