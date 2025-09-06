import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getYouTubeDuration, extractVideoId, parseDuration, isYouTubeUrl } from './youtubeDurationService'

// Mock fetch for testing
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('YouTubeDurationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractVideoId', () => {
    it('should extract video ID from standard YouTube URLs', () => {
      expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
      expect(extractVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
      expect(extractVideoId('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('should extract video ID from short YouTube URLs', () => {
      expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
      expect(extractVideoId('http://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('should extract video ID from embed URLs', () => {
      expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
      expect(extractVideoId('https://youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('should handle URLs with additional parameters', () => {
      expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s')).toBe('dQw4w9WgXcQ')
      expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxyz&index=1')).toBe('dQw4w9WgXcQ')
    })

    it('should return null for invalid URLs', () => {
      expect(extractVideoId('https://vimeo.com/123456')).toBeNull()
      expect(extractVideoId('https://example.com')).toBeNull()
      expect(extractVideoId('not-a-url')).toBeNull()
      expect(extractVideoId('')).toBeNull()
    })
  })

  describe('isYouTubeUrl', () => {
    it('should identify valid YouTube URLs', () => {
      expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
      expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
      expect(isYouTubeUrl('https://youtube.com/embed/dQw4w9WgXcQ')).toBe(true)
    })

    it('should reject non-YouTube URLs', () => {
      expect(isYouTubeUrl('https://vimeo.com/123456')).toBe(false)
      expect(isYouTubeUrl('https://example.com')).toBe(false)
      expect(isYouTubeUrl('not-a-url')).toBe(false)
      expect(isYouTubeUrl('')).toBe(false)
    })
  })

  describe('parseDuration', () => {
    it('should parse ISO 8601 duration format', () => {
      expect(parseDuration('PT3M32S')).toBe(212) // 3:32 = 212 seconds
      expect(parseDuration('PT1M')).toBe(60) // 1:00 = 60 seconds
      expect(parseDuration('PT45S')).toBe(45) // 0:45 = 45 seconds
      expect(parseDuration('PT1H2M3S')).toBe(3723) // 1:02:03 = 3723 seconds
      expect(parseDuration('PT2H30M')).toBe(9000) // 2:30:00 = 9000 seconds
    })

    it('should handle edge cases', () => {
      expect(parseDuration('PT0S')).toBe(0)
      expect(parseDuration('PT0M0S')).toBe(0)
      expect(parseDuration('PT10M0S')).toBe(600)
    })

    it('should return null for invalid duration strings', () => {
      expect(parseDuration('invalid')).toBeNull()
      expect(parseDuration('')).toBeNull()
      expect(parseDuration('P1D')).toBeNull() // Days not supported
    })
  })

  describe('getYouTubeDuration', () => {
    it('should fetch duration for a valid YouTube video', async () => {
      // Mock oEmbed API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          title: 'Rick Astley - Never Gonna Give You Up',
          author_name: 'Rick Astley',
          duration: 212, // Some oEmbed endpoints return duration directly
          thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
        })
      })

      const result = await getYouTubeDuration('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

      expect(result).toEqual({
        duration: 212,
        title: 'Rick Astley - Never Gonna Give You Up',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        author: 'Rick Astley'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&format=json',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'User-Agent': 'SCORM-Builder/1.0'
          }),
          signal: expect.any(AbortSignal)
        })
      )
    })

    it('should handle oEmbed API failures gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await getYouTubeDuration('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

      expect(result).toBeNull()
    })

    it('should handle invalid video IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      const result = await getYouTubeDuration('https://www.youtube.com/watch?v=invalidID')

      expect(result).toBeNull()
    })

    it('should reject non-YouTube URLs', async () => {
      const result = await getYouTubeDuration('https://vimeo.com/123456')

      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should provide fallback duration when oEmbed does not include duration', async () => {
      // Reset all mocks to ensure clean state
      vi.resetAllMocks()
      
      // Mock oEmbed response without duration
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          title: 'Test Video',
          author_name: 'Test Channel',
          thumbnail_url: 'https://i.ytimg.com/vi/testID12345/hqdefault.jpg'
          // No duration field
        })
      })

      const result = await getYouTubeDuration('https://www.youtube.com/watch?v=testID12345')

      expect(result).toEqual({
        duration: null, // Should be null when not available
        title: 'Test Video',
        thumbnail: 'https://i.ytimg.com/vi/testID12345/hqdefault.jpg',
        author: 'Test Channel'
      })
    })
  })

  describe('Error handling', () => {
    it('should handle malformed JSON responses', async () => {
      // Reset all mocks to ensure clean state
      vi.resetAllMocks()
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        }
      })

      const result = await getYouTubeDuration('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

      expect(result).toBeNull()
    })

    it('should handle network timeouts gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('The operation was aborted'))

      const result = await getYouTubeDuration('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

      expect(result).toBeNull()
    })
  })
})