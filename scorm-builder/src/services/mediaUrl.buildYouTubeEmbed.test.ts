/**
 * TDD Test: buildYouTubeEmbed function error handling
 *
 * This test verifies that the buildYouTubeEmbed function properly handles
 * invalid URLs and returns safe fallbacks instead of problematic iframe sources.
 */

import { describe, it, expect, vi } from 'vitest'
import { buildYouTubeEmbed, extractYouTubeId } from './mediaUrl'

// Mock console.error to capture error messages
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

describe('buildYouTubeEmbed - Error Handling', () => {
  beforeEach(() => {
    mockConsoleError.mockClear()
    mockConsoleLog.mockClear()
  })

  afterAll(() => {
    mockConsoleError.mockRestore()
    mockConsoleLog.mockRestore()
  })

  it('should return about:blank for null or undefined URLs', () => {
    expect(buildYouTubeEmbed(null as any)).toBe('about:blank')
    expect(buildYouTubeEmbed(undefined as any)).toBe('about:blank')
    expect(mockConsoleError).toHaveBeenCalledWith(
      '[mediaUrl] buildYouTubeEmbed: Invalid URL provided:',
      null
    )
  })

  it('should return about:blank for empty URLs', () => {
    expect(buildYouTubeEmbed('')).toBe('about:blank')
    expect(buildYouTubeEmbed('   ')).toBe('about:blank') // whitespace only
    expect(mockConsoleError).toHaveBeenCalledWith(
      '[mediaUrl] buildYouTubeEmbed: Invalid URL provided:',
      ''
    )
  })

  it('should return about:blank for non-YouTube URLs that cannot be parsed', () => {
    const invalidUrls = [
      'https://www.youtube.com/', // Main YouTube page - can't extract video ID
      'https://www.google.com/',
      'invalid-url',
      'not-a-url'
    ]

    invalidUrls.forEach(url => {
      const result = buildYouTubeEmbed(url)
      expect(result).toBe('about:blank')
      expect(mockConsoleError).toHaveBeenCalledWith(
        '[mediaUrl] buildYouTubeEmbed: Failed to extract YouTube ID from URL:',
        url
      )
    })
  })

  it('should generate proper embed URLs for valid YouTube URLs', () => {
    const validUrls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ'
    ]

    validUrls.forEach(url => {
      const result = buildYouTubeEmbed(url)
      expect(result).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
      expect(result).toMatch(/\/embed\//)
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[mediaUrl] buildYouTubeEmbed: Generated embed URL:',
        expect.objectContaining({
          rawUrl: url,
          embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
        })
      )
    })
  })

  it('should include clip timing parameters when provided', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const result = buildYouTubeEmbed(url, 30, 90)

    expect(result).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?start=30&end=90')
    expect(result).toMatch(/start=30/)
    expect(result).toMatch(/end=90/)
  })

  it('should handle edge cases with clip timing', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

    // Negative start time should be converted to 0
    expect(buildYouTubeEmbed(url, -10, 60)).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?start=0&end=60')

    // End time before start time should be ignored
    expect(buildYouTubeEmbed(url, 60, 30)).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?start=60')

    // Only start time
    expect(buildYouTubeEmbed(url, 30)).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?start=30')

    // Only end time (no start)
    expect(buildYouTubeEmbed(url, undefined, 90)).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?end=90')
  })
})

describe('extractYouTubeId - Edge Cases', () => {
  it('should return null for invalid URLs', () => {
    const invalidUrls = [
      '',
      null,
      undefined,
      'https://www.youtube.com/', // Main page with no video ID
      'https://www.google.com/',
      'not-a-url'
    ]

    invalidUrls.forEach(url => {
      expect(extractYouTubeId(url as any)).toBeNull()
    })
  })

  it('should extract IDs from various YouTube URL formats', () => {
    const testCases = [
      { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
      { url: 'https://youtu.be/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
      { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
      { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s', expected: 'dQw4w9WgXcQ' },
      { url: 'https://www.youtube.com/watch?list=PLrAXtmRdnEQy&v=dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' }
    ]

    testCases.forEach(({ url, expected }) => {
      expect(extractYouTubeId(url)).toBe(expected)
    })
  })
})