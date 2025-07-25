import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchGoogleImages, searchYouTubeVideos } from '../searchService'

// Mock fetch globally
global.fetch = vi.fn()

describe('searchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('searchGoogleImages', () => {
    it('should call Google Custom Search API when API keys are provided', async () => {
      const mockResponse = {
        items: [
          {
            cacheId: 'test-id-1',
            link: 'https://example.com/image1.jpg',
            title: 'Test Image 1',
            displayLink: 'example.com',
            image: {
              thumbnailLink: 'https://example.com/thumb1.jpg',
              width: 800,
              height: 600
            }
          }
        ]
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const results = await searchGoogleImages('test query', 1, 'test-api-key', 'test-cse-id')

      // Verify API was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/customsearch/v1?key=test-api-key&cx=test-cse-id&q=test query&searchType=image&start=1'
      )

      // Verify results are formatted correctly
      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({
        id: 'test-id-1',
        url: 'https://example.com/image1.jpg',
        thumbnail: 'https://example.com/thumb1.jpg',
        title: 'Test Image 1',
        source: 'example.com',
        dimensions: '800x600',
        photographer: undefined
      })
    })

    it('should handle API errors gracefully and return mock data', async () => {
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

      const results = await searchGoogleImages('test query', 1, 'test-api-key', 'test-cse-id')

      // Should fall back to mock data
      expect(results).toHaveLength(10)
      expect(results[0].id).toContain('img-')
    })

    it('should handle non-OK responses and return mock data', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      })

      const results = await searchGoogleImages('test query', 1, 'test-api-key', 'test-cse-id')

      // Should fall back to mock data
      expect(results).toHaveLength(10)
      expect(results[0].id).toContain('img-')
    })

    it('should handle pagination correctly', async () => {
      const mockResponse = {
        items: Array(10).fill(null).map((_, i) => ({
          cacheId: `test-id-${i}`,
          link: `https://example.com/image${i}.jpg`,
          title: `Test Image ${i}`,
          displayLink: 'example.com'
        }))
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      await searchGoogleImages('test query', 2, 'test-api-key', 'test-cse-id')

      // Verify start parameter for page 2 (should be 11)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('&start=11')
      )
    })

    it('should return mock data when no API keys are provided', async () => {
      const results = await searchGoogleImages('test query', 1)

      expect(global.fetch).not.toHaveBeenCalled()
      expect(results).toHaveLength(10)
      expect(results[0].id).toContain('img-')
    })
  })

  describe('searchYouTubeVideos', () => {
    it('should call YouTube API when API key is provided', async () => {
      const mockSearchResponse = {
        items: [
          {
            id: { videoId: 'test-video-1' },
            snippet: {
              title: 'Test Video 1',
              channelTitle: 'Test Channel',
              publishedAt: '2024-01-01T00:00:00Z',
              thumbnails: {
                medium: { url: 'https://example.com/thumb1.jpg' }
              }
            }
          }
        ]
      }

      const mockDetailsResponse = {
        items: [
          {
            id: 'test-video-1',
            contentDetails: { duration: 'PT5M30S' },
            statistics: { viewCount: '1000' }
          }
        ]
      }

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSearchResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDetailsResponse
        })

      const results = await searchYouTubeVideos('test query', 1, 'test-api-key')

      // Verify both API calls were made
      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/search?part=snippet&q=test query&type=video&maxResults=10&key=test-api-key'
      )

      // Verify results
      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({
        id: 'test-video-1',
        url: 'https://youtube.com/watch?v=test-video-1',
        embedUrl: 'https://youtube.com/embed/test-video-1',
        thumbnail: 'https://example.com/thumb1.jpg',
        title: 'Test Video 1',
        channel: 'Test Channel',
        uploadedAt: expect.any(String),
        views: '1,000 views',
        duration: '5:30'
      })
    })

    it('should handle YouTube API errors gracefully', async () => {
      ;(global.fetch as any).mockRejectedValueOnce(new Error('API Error'))

      const results = await searchYouTubeVideos('test query', 1, 'test-api-key')

      // Should fall back to mock data
      expect(results).toHaveLength(10)
      expect(results[0].id).toContain('video-')
    })
  })
})