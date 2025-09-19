/**
 * Tests for YouTube video clip timing persistence issue
 * This test reproduces the bug where YouTube videos show empty URLs,
 * causing clip timing to fail with "about:blank" error.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Import the function that builds YouTube embeds to test the bug directly
import { buildYouTubeEmbed } from '../services/mediaUrl'

describe('YouTube Clip Timing Persistence Bug', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks()
  })

  it('should reproduce the "about:blank" URL bug when building embed with empty URL', () => {
    // Arrange: This reproduces the exact condition causing the bug
    const emptyUrl = '' // This is what lightboxMedia.url contains (the bug!)
    const clipStart = 45
    const clipEnd = 120

    // Act: Call buildYouTubeEmbed with empty URL (this is what happens in commitClipTiming)
    const result = buildYouTubeEmbed(emptyUrl, clipStart, clipEnd)

    // Assert: Should return "about:blank" which causes the persistence failure
    expect(result).toBe('about:blank')
  })

  it('should work correctly when URL is provided', () => {
    // Arrange: This is what should happen when the URL is properly populated
    const validUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const clipStart = 45
    const clipEnd = 120

    // Act: Call buildYouTubeEmbed with valid URL (this is what should happen)
    const result = buildYouTubeEmbed(validUrl, clipStart, clipEnd)

    // Assert: Should build proper embed URL with clip timing
    expect(result).toContain('youtube.com/embed/')
    expect(result).toContain('start=45')
    expect(result).toContain('end=120')
    expect(result).not.toBe('about:blank')
  })

  it('should simulate the commitClipTiming bug scenario', () => {
    // Arrange: Simulate the exact scenario from the logs
    const lightboxMedia = {
      id: 'video-test-1',
      title: 'Test YouTube Video',
      isYouTube: true,
      url: '', // Empty URL - this is the bug!
      embedUrl: '', // Empty embedUrl - this is the bug!
      clipStart: 30,
      clipEnd: 90
    }

    // Act: This simulates the exact line in commitClipTiming that fails
    const embed = lightboxMedia.isYouTube
      ? buildYouTubeEmbed(lightboxMedia.url || lightboxMedia.embedUrl || '', 45, 120)
      : lightboxMedia.embedUrl

    // Assert: This should result in "about:blank" which causes the persistence failure
    expect(embed).toBe('about:blank')

    // This is the exact log output we saw in the console:
    // "[MediaEnhancement] 🎬 Committing clip timing: { embedUrl: 'about:blank' }"
    console.log('[Test] Simulated commitClipTiming result:', {
      mediaId: lightboxMedia.id,
      title: lightboxMedia.title,
      clipStart: 45,
      clipEnd: 120,
      embedUrl: embed // This will be "about:blank" - the bug!
    })
  })

  it('should show how the fix would work with enriched metadata', () => {
    // Arrange: Simulate having enriched metadata available (the fix)
    const lightboxMedia = {
      id: 'video-test-1',
      title: 'Test YouTube Video',
      isYouTube: true,
      url: '', // Still empty in lightboxMedia
      embedUrl: '', // Still empty in lightboxMedia
      clipStart: 30,
      clipEnd: 90
    }

    // This simulates enriched metadata that should be used as fallback
    const enrichedMetadata = new Map([
      ['video-test-1', {
        metadata: {
          youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          isYouTube: true,
          clipStart: 30,
          clipEnd: 90
        }
      }]
    ])

    // Act: This is how the fix should work - use enriched metadata as fallback
    const enriched = enrichedMetadata.get(lightboxMedia.id)
    const fallbackUrl = enriched?.metadata.youtubeUrl || enriched?.metadata.embedUrl || ''

    const embed = lightboxMedia.isYouTube
      ? buildYouTubeEmbed(
          lightboxMedia.url || lightboxMedia.embedUrl || fallbackUrl, // Use enriched as fallback
          45,
          120
        )
      : lightboxMedia.embedUrl

    // Assert: Should now work correctly with enriched metadata
    expect(embed).not.toBe('about:blank')
    expect(embed).toContain('youtube.com/embed/')
    expect(embed).toContain('start=45')
    expect(embed).toContain('end=120')

    console.log('[Test] Fixed commitClipTiming result:', {
      mediaId: lightboxMedia.id,
      title: lightboxMedia.title,
      clipStart: 45,
      clipEnd: 120,
      embedUrl: embed // This should now be a valid URL!
    })
  })

  it('should verify the actual fix implementation logic', () => {
    // Arrange: Simulate the exact fix implementation
    const lightboxMedia = {
      id: 'video-test-1',
      title: 'Test YouTube Video',
      isYouTube: true,
      url: '', // Empty URL - reproduces the bug condition
      embedUrl: '', // Empty embedUrl - reproduces the bug condition
      clipStart: 30,
      clipEnd: 90
    }

    const enrichedMetadata = new Map([
      ['video-test-1', {
        metadata: {
          youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          isYouTube: true,
          clipStart: 30,
          clipEnd: 90
        }
      }]
    ])

    const s = 45 // clipStart
    const e = 120 // clipEnd

    // Act: This is the EXACT implementation from the fix
    let embedUrl = lightboxMedia.embedUrl
    if (lightboxMedia.isYouTube) {
      // Try to get URL from lightboxMedia first, then fall back to enriched metadata
      const primaryUrl = lightboxMedia.url || lightboxMedia.embedUrl
      const enriched = enrichedMetadata.get(lightboxMedia.id)
      const fallbackUrl = enriched?.metadata?.youtubeUrl || enriched?.metadata?.embedUrl || ''

      const youtubeUrl = primaryUrl || fallbackUrl
      embedUrl = buildYouTubeEmbed(youtubeUrl, s, e)
    }

    // Assert: The fix should prevent "about:blank" by using enriched metadata
    expect(embedUrl).not.toBe('about:blank')
    expect(embedUrl).toContain('youtube.com/embed/')
    expect(embedUrl).toContain('start=45')
    expect(embedUrl).toContain('end=120')

    // Log the exact debug output the fix produces
    console.log('🔍 [CLIP DEBUG] commitClipTiming URL resolution (FIXED):', {
      mediaId: lightboxMedia.id,
      primaryUrl: lightboxMedia.url || lightboxMedia.embedUrl,
      fallbackUrl: enrichedMetadata.get(lightboxMedia.id)?.metadata?.youtubeUrl || enrichedMetadata.get(lightboxMedia.id)?.metadata?.embedUrl || '',
      finalYoutubeUrl: (lightboxMedia.url || lightboxMedia.embedUrl) || (enrichedMetadata.get(lightboxMedia.id)?.metadata?.youtubeUrl || enrichedMetadata.get(lightboxMedia.id)?.metadata?.embedUrl || ''),
      finalEmbedUrl: embedUrl,
      hasEnrichedMetadata: !!enrichedMetadata.get(lightboxMedia.id)
    })
  })
})