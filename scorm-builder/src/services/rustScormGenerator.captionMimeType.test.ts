/**
 * Test for caption file MIME type handling in SCORM generation
 *
 * This test reproduces the issue where caption files are stored/loaded with
 * incorrect MIME type 'audio/*' instead of 'text/vtt', causing them to be
 * excluded from the SCORM package.
 */

import { getExtensionFromMimeType, hydrateMediaCacheById } from './rustScormGenerator'
import { vi, describe, it, expect, beforeEach } from 'vitest'

describe('Caption MIME Type Handling in SCORM Generation', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
  })

  it('should return correct extension for text/vtt MIME type', () => {
    // Act
    const extension = getExtensionFromMimeType('text/vtt')

    // Assert
    expect(extension).toBe('vtt')
  })

  it('should return empty extension for unknown MIME type audio/*', () => {
    // This test reproduces the issue: caption files with wrong MIME type get empty extension
    // Act
    const extension = getExtensionFromMimeType('audio/*')

    // Assert - this currently returns empty, causing caption files to be skipped
    expect(extension).toBe('') // This is the bug! Should handle caption files better

    // The issue is that caption files are incorrectly stored with 'audio/*' MIME type
    // Instead of 'text/vtt', so they get empty extension and are excluded from SCORM
  })

  it('should hydrate media cache with caption files', () => {
    // Test the cache hydration to see if MIME types are preserved correctly
    const preloadedMedia = new Map([
      ['caption-1', {
        data: new TextEncoder().encode('WEBVTT\n\n00:00.000 --> 00:05.000\nTest caption'),
        mimeType: 'text/vtt'
      }],
      ['caption-2', {
        data: new TextEncoder().encode('WEBVTT\n\n00:00.000 --> 00:08.000\nAnother caption'),
        mimeType: 'audio/*' // This represents the bug - wrong MIME type stored
      }]
    ])

    // Act - hydrate the cache
    hydrateMediaCacheById(preloadedMedia)

    // Assert - Both should be cached but caption-2 has wrong MIME type
    // This doesn't test the actual cache directly, but verifies the function doesn't throw
    expect(() => hydrateMediaCacheById(preloadedMedia)).not.toThrow()

    // The real issue is that getExtensionFromMimeType('audio/*') returns ''
    // causing caption files with wrong MIME type to be excluded
  })
})