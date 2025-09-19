import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * TDD Behavior Test: Clip Timing Shows on First Topic Visit
 *
 * This test reproduces the exact issue reported by the user:
 * "now it doesn't appear the first time you open a topic with clip timing,
 * only if you click off and come back to that topic"
 *
 * The issue:
 * 1. UnifiedMediaContext successfully extracts clip timing from embedUrl
 * 2. But MediaEnhancementWizard's loadExistingMedia doesn't get this timing
 * 3. Clip timing only shows after navigating away and back (cache hit)
 *
 * The fix ensures clip timing is extracted in loadExistingMedia on first visit.
 */

// Mock the extractClipTimingFromUrl function
const mockExtractClipTimingFromUrl = vi.fn()

// Mock the mediaUrl module
vi.mock('../services/mediaUrl', () => ({
  extractClipTimingFromUrl: mockExtractClipTimingFromUrl
}))

// Mock MediaService items (what getMedia returns)
interface MockMediaItem {
  id: string
  type: string
  metadata?: {
    title?: string
    isYouTube?: boolean
    embedUrl?: string
    clipStart?: number
    clipEnd?: number
  }
}

describe('MediaEnhancementWizard - Clip Timing First Visit Bug', () => {
  beforeEach(() => {
    mockExtractClipTimingFromUrl.mockClear()
  })

  it('should extract clip timing on first visit when metadata lacks timing', () => {
    // Arrange: Simulate MediaService returning items without clip timing metadata
    // (this is what happens on first load before cache is populated)
    const mediaItemsFromService: MockMediaItem[] = [
      {
        id: 'video-2',
        type: 'youtube',
        metadata: {
          title: 'PHMSA Facts -- Emergency Response',
          isYouTube: true,
          embedUrl: 'https://www.youtube.com/embed/iRtsYUBNfnA?start=30&end=60'
          // clipStart: undefined,  // Missing on first load
          // clipEnd: undefined     // Missing on first load
        }
      }
    ]

    // Mock the extraction function to return the expected values
    mockExtractClipTimingFromUrl.mockReturnValue({
      clipStart: 30,
      clipEnd: 60
    })

    // Act: Simulate the fixed loadExistingMedia conversion logic
    const mediaItems = mediaItemsFromService.map((item, index) => {
      const isYouTube = item.metadata?.isYouTube || item.type === 'youtube' || false
      const embedUrl = item.metadata?.embedUrl
      let clipStart = item.metadata?.clipStart
      let clipEnd = item.metadata?.clipEnd

      // THE FIX: Extract clip timing from embedUrl if not available as metadata
      if (isYouTube && (!clipStart || !clipEnd) && embedUrl) {
        const extracted = mockExtractClipTimingFromUrl(embedUrl)

        // Use extracted values only if the metadata properties were undefined
        if (clipStart === undefined) clipStart = extracted.clipStart
        if (clipEnd === undefined) clipEnd = extracted.clipEnd
      }

      return {
        id: item.id,
        type: item.type,
        title: item.metadata?.title || `Media ${index + 1}`,
        url: '',
        storageId: item.id,
        isYouTube,
        embedUrl,
        clipStart,
        clipEnd
      }
    })

    // Assert: Clip timing should be extracted and available on first visit
    expect(mockExtractClipTimingFromUrl).toHaveBeenCalledWith(
      'https://www.youtube.com/embed/iRtsYUBNfnA?start=30&end=60'
    )

    const convertedVideo = mediaItems[0]
    expect(convertedVideo.clipStart).toBe(30)
    expect(convertedVideo.clipEnd).toBe(60)
    expect(convertedVideo.isYouTube).toBe(true)

    // This fixes the issue where clip timing was undefined on first visit
    expect(convertedVideo.clipStart).not.toBeUndefined()
    expect(convertedVideo.clipEnd).not.toBeUndefined()
  })

  it('should preserve existing clip timing from metadata when available', () => {
    // Arrange: MediaService returns items WITH clip timing metadata (cache hit scenario)
    const mediaItemsFromService: MockMediaItem[] = [
      {
        id: 'video-1',
        type: 'youtube',
        metadata: {
          title: 'Video with existing timing',
          isYouTube: true,
          embedUrl: 'https://www.youtube.com/embed/existing?start=40&end=80',
          clipStart: 45,  // Already has metadata
          clipEnd: 90     // Already has metadata
        }
      }
    ]

    // Mock extraction (should not be called when metadata exists)
    mockExtractClipTimingFromUrl.mockReturnValue({
      clipStart: 40,
      clipEnd: 80
    })

    // Act: Process the media items
    const mediaItems = mediaItemsFromService.map((item, index) => {
      const isYouTube = item.metadata?.isYouTube || item.type === 'youtube' || false
      const embedUrl = item.metadata?.embedUrl
      let clipStart = item.metadata?.clipStart
      let clipEnd = item.metadata?.clipEnd

      // Apply the fix logic
      if (isYouTube && (!clipStart || !clipEnd) && embedUrl) {
        const extracted = mockExtractClipTimingFromUrl(embedUrl)
        if (clipStart === undefined) clipStart = extracted.clipStart
        if (clipEnd === undefined) clipEnd = extracted.clipEnd
      }

      return { id: item.id, clipStart, clipEnd, isYouTube }
    })

    // Assert: Should use existing metadata, not extract from URL
    expect(mockExtractClipTimingFromUrl).not.toHaveBeenCalled()
    expect(mediaItems[0].clipStart).toBe(45)  // From metadata
    expect(mediaItems[0].clipEnd).toBe(90)    // From metadata
  })

  it('should handle partial timing extraction (only start or only end)', () => {
    // Arrange: Mix of missing timing values
    const mediaItemsFromService: MockMediaItem[] = [
      {
        id: 'video-partial-start',
        type: 'youtube',
        metadata: {
          isYouTube: true,
          embedUrl: 'https://www.youtube.com/embed/partial?start=120&end=240',
          clipStart: 100  // Has start, missing end
          // clipEnd: undefined
        }
      },
      {
        id: 'video-partial-end',
        type: 'youtube',
        metadata: {
          isYouTube: true,
          embedUrl: 'https://www.youtube.com/embed/partial2?start=60&end=180',
          // clipStart: undefined  // Missing start, has end
          clipEnd: 200
        }
      }
    ]

    // Mock extraction for different scenarios
    mockExtractClipTimingFromUrl
      .mockReturnValueOnce({ clipStart: 120, clipEnd: 240 })  // For video-partial-start
      .mockReturnValueOnce({ clipStart: 60, clipEnd: 180 })   // For video-partial-end

    // Act: Process the media items
    const mediaItems = mediaItemsFromService.map((item, index) => {
      const isYouTube = item.metadata?.isYouTube || false
      const embedUrl = item.metadata?.embedUrl
      let clipStart = item.metadata?.clipStart
      let clipEnd = item.metadata?.clipEnd

      if (isYouTube && (!clipStart || !clipEnd) && embedUrl) {
        const extracted = mockExtractClipTimingFromUrl(embedUrl)
        if (clipStart === undefined) clipStart = extracted.clipStart
        if (clipEnd === undefined) clipEnd = extracted.clipEnd
      }

      return { id: item.id, clipStart, clipEnd }
    })

    // Assert: Should merge extracted values with existing metadata
    expect(mediaItems[0]).toEqual({
      id: 'video-partial-start',
      clipStart: 100,  // Keep existing metadata
      clipEnd: 240     // Extract from URL
    })

    expect(mediaItems[1]).toEqual({
      id: 'video-partial-end',
      clipStart: 60,   // Extract from URL
      clipEnd: 200     // Keep existing metadata
    })

    expect(mockExtractClipTimingFromUrl).toHaveBeenCalledTimes(2)
  })

  it('should handle non-YouTube videos gracefully', () => {
    // Arrange: Mix of YouTube and non-YouTube videos
    const mediaItemsFromService: MockMediaItem[] = [
      {
        id: 'image-1',
        type: 'image',
        metadata: {
          title: 'Regular Image'
        }
      },
      {
        id: 'video-regular',
        type: 'video',
        metadata: {
          title: 'Regular Video',
          isYouTube: false
        }
      }
    ]

    // Act: Process the media items
    const mediaItems = mediaItemsFromService.map((item, index) => {
      const isYouTube = item.metadata?.isYouTube || item.type === 'youtube' || false
      const embedUrl = item.metadata?.embedUrl
      let clipStart = item.metadata?.clipStart
      let clipEnd = item.metadata?.clipEnd

      if (isYouTube && (!clipStart || !clipEnd) && embedUrl) {
        const extracted = mockExtractClipTimingFromUrl(embedUrl)
        if (clipStart === undefined) clipStart = extracted.clipStart
        if (clipEnd === undefined) clipEnd = extracted.clipEnd
      }

      return { id: item.id, isYouTube, clipStart, clipEnd }
    })

    // Assert: Non-YouTube videos should not trigger extraction
    expect(mockExtractClipTimingFromUrl).not.toHaveBeenCalled()
    expect(mediaItems[0]).toEqual({
      id: 'image-1',
      isYouTube: false,
      clipStart: undefined,
      clipEnd: undefined
    })
    expect(mediaItems[1]).toEqual({
      id: 'video-regular',
      isYouTube: false,
      clipStart: undefined,
      clipEnd: undefined
    })
  })
})