import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VideoMigrationUtility, migrateExistingVideos, generateVideoMigrationReport } from './videoMigrationUtility'
import type { MediaItem } from '../services/MediaService'

// Mock the YouTube duration service
vi.mock('../services/youtubeDurationService', () => ({
  getYouTubeDurationWithFallback: vi.fn(),
  extractVideoId: vi.fn(),
  isYouTubeUrl: vi.fn()
}))

import { getYouTubeDurationWithFallback, extractVideoId, isYouTubeUrl } from '../services/youtubeDurationService'

const mockGetYouTubeDuration = vi.mocked(getYouTubeDurationWithFallback)
const mockExtractVideoId = vi.mocked(extractVideoId)
const mockIsYouTubeUrl = vi.mocked(isYouTubeUrl)

describe('VideoMigrationUtility', () => {
  let mockMediaService: any
  let mockFileStorage: any
  let migrationUtility: VideoMigrationUtility

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock media service
    mockMediaService = {
      getAllMedia: vi.fn(),
      mediaCache: new Map()
    }

    // Mock file storage
    mockFileStorage = {
      storeYouTubeVideo: vi.fn()
    }

    migrationUtility = new VideoMigrationUtility(mockMediaService, mockFileStorage)

    // Setup default mocks
    mockIsYouTubeUrl.mockReturnValue(true)
    mockExtractVideoId.mockReturnValue('dQw4w9WgXcQ')
  })

  describe('identifyVideosNeedingMigration', () => {
    it('should identify YouTube videos without duration', async () => {
      const mockMedia: MediaItem[] = [
        // YouTube video without duration - should be identified
        {
          id: 'video-1',
          type: 'video',
          pageId: 'page-1',
          fileName: 'Rick Astley Video',
          metadata: {
            isYouTube: true,
            youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            uploadedAt: '2023-01-01T00:00:00.000Z',
            type: 'video',
            pageId: 'page-1'
            // No duration - needs migration
          }
        },
        // YouTube video with duration - should NOT be identified
        {
          id: 'video-2',
          type: 'video',
          pageId: 'page-1',
          fileName: 'Another Video',
          metadata: {
            isYouTube: true,
            youtubeUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
            duration: 252, // Has duration - doesn't need migration
            uploadedAt: '2023-01-01T00:00:00.000Z',
            type: 'video',
            pageId: 'page-1'
          }
        },
        // Non-YouTube video - should NOT be identified
        {
          id: 'image-1',
          type: 'image',
          pageId: 'page-1',
          fileName: 'Some Image',
          metadata: {
            uploadedAt: '2023-01-01T00:00:00.000Z',
            type: 'image',
            pageId: 'page-1'
          }
        },
        // YouTube video with zero duration - should be identified
        {
          id: 'video-3',
          type: 'video',
          pageId: 'page-1',
          fileName: 'Zero Duration Video',
          metadata: {
            isYouTube: true,
            youtubeUrl: 'https://www.youtube.com/watch?v=abc123',
            duration: 0, // Zero duration - needs migration
            uploadedAt: '2023-01-01T00:00:00.000Z',
            type: 'video',
            pageId: 'page-1'
          }
        }
      ]

      mockMediaService.getAllMedia.mockResolvedValue(mockMedia)

      const result = await migrationUtility.identifyVideosNeedingMigration()

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('video-1')
      expect(result[1].id).toBe('video-3')
    })

    it('should identify YouTube videos by embedUrl when youtubeUrl is missing', async () => {
      const mockMedia: MediaItem[] = [
        {
          id: 'video-1',
          type: 'video',
          pageId: 'page-1',
          fileName: 'Embed Video',
          metadata: {
            embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            // No duration and no youtubeUrl - should be identified
            uploadedAt: '2023-01-01T00:00:00.000Z',
            type: 'video',
            pageId: 'page-1'
          }
        }
      ]

      mockMediaService.getAllMedia.mockResolvedValue(mockMedia)

      const result = await migrationUtility.identifyVideosNeedingMigration()

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('video-1')
    })
  })

  describe('runCompleteMigration', () => {
    it('should successfully migrate videos with dry run', async () => {
      const mockVideoNeedingMigration: MediaItem = {
        id: 'video-1',
        type: 'video',
        pageId: 'page-1',
        fileName: 'Rick Astley Video',
        metadata: {
          isYouTube: true,
          youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          uploadedAt: '2023-01-01T00:00:00.000Z',
          type: 'video',
          pageId: 'page-1'
          // No duration
        }
      }

      mockMediaService.getAllMedia.mockResolvedValue([mockVideoNeedingMigration])
      
      mockGetYouTubeDuration.mockResolvedValue({
        duration: 212,
        title: 'Rick Astley - Never Gonna Give You Up',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        author: 'Rick Astley'
      })

      const result = await migrationUtility.runCompleteMigration({ 
        dryRun: true, 
        batchSize: 1 
      })

      expect(result.totalVideosFound).toBe(1)
      expect(result.videosUpdated).toBe(1)
      expect(result.videosFailed).toBe(0)
      expect(result.errors).toHaveLength(0)

      // In dry run mode, storage should not be updated
      expect(mockFileStorage.storeYouTubeVideo).not.toHaveBeenCalled()
    })

    it('should successfully migrate videos and update storage', async () => {
      const mockVideoNeedingMigration: MediaItem = {
        id: 'video-1',
        type: 'video',
        pageId: 'page-1',
        fileName: 'Rick Astley Video',
        metadata: {
          isYouTube: true,
          youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          uploadedAt: '2023-01-01T00:00:00.000Z',
          type: 'video',
          pageId: 'page-1'
          // No duration
        }
      }

      mockMediaService.getAllMedia.mockResolvedValue([mockVideoNeedingMigration])
      
      mockGetYouTubeDuration.mockResolvedValue({
        duration: 212,
        title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        author: 'Rick Astley'
      })

      const result = await migrationUtility.runCompleteMigration({ 
        dryRun: false, 
        batchSize: 1 
      })

      expect(result.totalVideosFound).toBe(1)
      expect(result.videosUpdated).toBe(1)
      expect(result.videosFailed).toBe(0)
      expect(result.errors).toHaveLength(0)

      // Storage should be updated with new duration
      expect(mockFileStorage.storeYouTubeVideo).toHaveBeenCalledWith(
        'video-1',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        expect.objectContaining({
          duration: 212,
          title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
          page_id: 'page-1',
          embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
        })
      )

      // Media service cache should be updated
      expect(mockMediaService.mediaCache.has('video-1')).toBe(true)
      const cachedItem = mockMediaService.mediaCache.get('video-1')
      expect(cachedItem.metadata.duration).toBe(212)
    })

    it('should handle migration failures gracefully', async () => {
      const mockVideoNeedingMigration: MediaItem = {
        id: 'video-1',
        type: 'video',
        pageId: 'page-1',
        fileName: 'Failing Video',
        metadata: {
          isYouTube: true,
          youtubeUrl: 'https://www.youtube.com/watch?v=invalid',
          uploadedAt: '2023-01-01T00:00:00.000Z',
          type: 'video',
          pageId: 'page-1'
        }
      }

      mockMediaService.getAllMedia.mockResolvedValue([mockVideoNeedingMigration])
      
      // Mock duration fetch failure
      mockGetYouTubeDuration.mockResolvedValue(null)

      const result = await migrationUtility.runCompleteMigration({ batchSize: 1 })

      expect(result.totalVideosFound).toBe(1)
      expect(result.videosUpdated).toBe(0)
      expect(result.videosFailed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].videoId).toBe('video-1')
      expect(result.errors[0].error).toContain('Failed to fetch video duration')
    })

    it('should return empty result when no videos need migration', async () => {
      // All videos have duration already
      const mockMedia: MediaItem[] = [
        {
          id: 'video-1',
          type: 'video',
          pageId: 'page-1',
          fileName: 'Complete Video',
          metadata: {
            isYouTube: true,
            youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            duration: 212, // Has duration
            uploadedAt: '2023-01-01T00:00:00.000Z',
            type: 'video',
            pageId: 'page-1'
          }
        }
      ]

      mockMediaService.getAllMedia.mockResolvedValue(mockMedia)

      const result = await migrationUtility.runCompleteMigration()

      expect(result.totalVideosFound).toBe(0)
      expect(result.videosUpdated).toBe(0)
      expect(result.videosFailed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('generateMigrationReport', () => {
    it('should generate report of videos needing migration', async () => {
      const mockMedia: MediaItem[] = [
        {
          id: 'video-1',
          type: 'video',
          pageId: 'page-1',
          fileName: 'Video Without Duration',
          metadata: {
            isYouTube: true,
            youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            uploadedAt: '2023-01-01T00:00:00.000Z',
            type: 'video',
            pageId: 'page-1'
            // No duration
          }
        },
        {
          id: 'video-2',
          type: 'video',
          pageId: 'page-2',
          fileName: 'Video With Duration',
          metadata: {
            isYouTube: true,
            youtubeUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
            duration: 252,
            uploadedAt: '2023-01-01T00:00:00.000Z',
            type: 'video',
            pageId: 'page-2'
          }
        }
      ]

      mockMediaService.getAllMedia.mockResolvedValue(mockMedia)

      const report = await migrationUtility.generateMigrationReport()

      expect(report.totalCount).toBe(1)
      expect(report.videosNeedingMigration).toHaveLength(1)
      expect(report.videosNeedingMigration[0]).toEqual({
        id: 'video-1',
        fileName: 'Video Without Duration',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        currentDuration: undefined,
        pageId: 'page-1'
      })
    })
  })

  describe('convenience functions', () => {
    it('should run migration through convenience function', async () => {
      mockMediaService.getAllMedia.mockResolvedValue([])

      const result = await migrateExistingVideos(mockMediaService, mockFileStorage, { dryRun: true })

      expect(result.totalVideosFound).toBe(0)
    })

    it('should generate report through convenience function', async () => {
      mockMediaService.getAllMedia.mockResolvedValue([])

      const report = await generateVideoMigrationReport(mockMediaService, mockFileStorage)

      expect(report.totalCount).toBe(0)
      expect(report.videosNeedingMigration).toHaveLength(0)
    })
  })
})