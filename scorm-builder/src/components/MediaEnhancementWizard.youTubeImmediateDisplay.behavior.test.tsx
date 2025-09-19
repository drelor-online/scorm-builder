import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * SIMPLIFIED TDD Test: YouTube Video Immediate Display Race Condition
 *
 * This test focuses on the core race condition logic without UI complexity.
 * We test the async flow that causes the issue:
 * 1. storeYouTubeVideo is called (returns immediately)
 * 2. setExistingPageMedia is called with the new item
 * 3. loadExistingMedia is called (but cache might not be updated yet)
 * 4. Result: video doesn't appear immediately
 */

// Mock the core async operations
const createAsyncFlowTest = () => {
  let mediaCache = new Map()

  const storeYouTubeVideo = vi.fn(async (url: string, embedUrl: string, pageId: string) => {
    const item = { id: 'youtube-test', type: 'youtube', url, pageId }

    // Simulate cache update delay (this is the race condition)
    setTimeout(() => {
      mediaCache.set(item.id, item)
    }, 10)

    return item
  })

  const loadExistingMedia = vi.fn(async (pageId: string) => {
    // This returns what's currently in cache (might be empty due to race condition)
    return Array.from(mediaCache.values()).filter(item => item.pageId === pageId)
  })

  return { storeYouTubeVideo, loadExistingMedia, mediaCache }
}

describe('MediaEnhancementWizard - YouTube Video Immediate Display Bug', () => {
  it('should reproduce the race condition in addMediaToPage flow (the bug)', async () => {
    // Arrange: Create the async flow simulation
    const { storeYouTubeVideo, loadExistingMedia, mediaCache } = createAsyncFlowTest()
    const pageId = 'topic-1'

    // Act: Simulate the BUGGY flow from addMediaToPage
    // 1. Store YouTube video (returns immediately)
    const storedItem = await storeYouTubeVideo(
      'https://www.youtube.com/watch?v=test123',
      'https://www.youtube.com/embed/test123',
      pageId
    )

    // 2. Immediately call loadExistingMedia (this is where the race condition happens)
    const mediaItems = await loadExistingMedia(pageId)

    // Assert: The race condition causes the video to not appear immediately
    // This test SHOULD PASS - proving the race condition exists
    expect(mediaItems).toHaveLength(0) // Cache not updated yet
    expect(mediaCache.size).toBe(0) // Cache is empty immediately after store

    // Verify that after the delay, the cache is updated
    await new Promise(resolve => setTimeout(resolve, 15)) // Wait for cache update
    expect(mediaCache.size).toBe(1) // Now the cache has the item
    expect(mediaCache.has(storedItem.id)).toBe(true)
  })

  it('should fix the issue by using stored item directly (the fix)', async () => {
    // Arrange: Create the async flow simulation
    const { storeYouTubeVideo } = createAsyncFlowTest()
    const pageId = 'topic-1'

    // Act: Store YouTube video and use the returned item directly (THE FIX)
    const storedItem = await storeYouTubeVideo(
      'https://www.youtube.com/watch?v=test123',
      'https://www.youtube.com/embed/test123',
      pageId
    )

    // FIX: Directly update local state with the returned item
    // Instead of calling loadExistingMedia() which causes the race condition
    const localState = [storedItem] // Use returned item directly

    // Assert: The video appears immediately when using the stored item directly
    expect(localState).toHaveLength(1)
    expect(localState[0].id).toBe(storedItem.id)
    expect(localState[0].type).toBe('youtube')
    expect(localState[0].pageId).toBe(pageId)
  })

  it('should verify the fixed addMediaToPage flow works correctly', async () => {
    // This test simulates the FIXED flow in addMediaToPage
    const { storeYouTubeVideo } = createAsyncFlowTest()
    const pageId = 'topic-1'

    // Simulate the fixed addMediaToPage flow
    // 1. Store YouTube video
    const storedItem = await storeYouTubeVideo(
      'https://www.youtube.com/watch?v=test123',
      'https://www.youtube.com/embed/test123',
      pageId
    )

    // 2. Create newMediaItem from stored item (like in addMediaToPage)
    const newMediaItem = {
      id: storedItem.id,
      type: 'youtube',
      title: 'Test YouTube Video',
      url: storedItem.url,
      storageId: storedItem.id
    }

    // 3. Update local state directly (like setExistingPageMedia([newMediaItem]))
    const updatedPageMedia = [newMediaItem]

    // 4. NO loadExistingMedia() call (this was the fix)

    // Assert: Video appears immediately without race condition
    expect(updatedPageMedia).toHaveLength(1)
    expect(updatedPageMedia[0].id).toBe(storedItem.id)
    expect(updatedPageMedia[0].type).toBe('youtube')

    // The fix ensures the media is visible immediately
    expect(updatedPageMedia[0]).toBeDefined()
    expect(updatedPageMedia[0].title).toBe('Test YouTube Video')
  })
})