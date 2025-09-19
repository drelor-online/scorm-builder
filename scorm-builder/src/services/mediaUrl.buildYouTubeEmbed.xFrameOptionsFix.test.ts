/**
 * Specific test for the X-Frame-Options error fix
 *
 * This test verifies that the buildYouTubeEmbed function correctly handles
 * the problematic URL 'https://www.youtube.com/' that was causing the error:
 * "Refused to display 'https://www.youtube.com/' in a frame because it set 'X-Frame-Options' to 'sameorigin'"
 */
import { describe, it, expect } from 'vitest'
import { buildYouTubeEmbed } from './mediaUrl'

describe('YouTube X-Frame-Options Error Fix', () => {
  it('should never return the problematic YouTube homepage URL', () => {
    const problematicUrls = [
      'https://www.youtube.com/',
      'https://youtube.com/',
      'https://www.youtube.com',
      'https://youtube.com',
      '', // Empty string
      null as any,
      undefined as any
    ]

    problematicUrls.forEach(url => {
      const result = buildYouTubeEmbed(url)

      // Should NEVER return the problematic URLs that cause X-Frame-Options errors
      expect(result).not.toBe('https://www.youtube.com/')
      expect(result).not.toBe('https://youtube.com/')
      expect(result).not.toBe('https://www.youtube.com')
      expect(result).not.toBe('https://youtube.com')

      // Should return safe fallback
      expect(result).toBe('about:blank')
    })
  })

  it('should return proper embed URLs for valid YouTube videos', () => {
    const validUrls = [
      {
        input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        expected: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
      },
      {
        input: 'https://youtu.be/dQw4w9WgXcQ',
        expected: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
      },
      {
        input: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        expected: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
      }
    ]

    validUrls.forEach(({ input, expected }) => {
      const result = buildYouTubeEmbed(input)
      expect(result).toBe(expected)
      expect(result).toContain('/embed/')
      expect(result).toMatch(/^https:\/\/www\.youtube\.com\/embed\/[a-zA-Z0-9_-]{11}/)
    })
  })

  it('should handle clip timing without breaking URL validation', () => {
    // With clip timing
    const result = buildYouTubeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 30, 90)
    expect(result).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?start=30&end=90')
    expect(result).toContain('/embed/')

    // Invalid URL with clip timing should still be safe
    const invalidResult = buildYouTubeEmbed('https://www.youtube.com/', 30, 90)
    expect(invalidResult).toBe('about:blank')
  })
})