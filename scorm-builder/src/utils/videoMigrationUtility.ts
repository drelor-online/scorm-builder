import { logger } from './logger'
import { getYouTubeDurationWithFallback, extractVideoId, isYouTubeUrl } from '../services/youtubeDurationService'
import type { MediaItem } from '../services/MediaService'

export interface MigrationResult {
  totalVideosFound: number
  videosUpdated: number
  videosFailed: number
  errors: Array<{ videoId: string; error: string }>
}

export interface VideoMigrationOptions {
  dryRun?: boolean // If true, only report what would be updated without making changes
  batchSize?: number // Process videos in batches to avoid overwhelming the API
}

/**
 * Migrate existing YouTube videos to include real duration metadata
 * This utility identifies videos without duration information and updates them
 */
export class VideoMigrationUtility {
  private mediaService: any
  private fileStorage: any

  constructor(mediaService: any, fileStorage: any) {
    this.mediaService = mediaService
    this.fileStorage = fileStorage
  }

  /**
   * Identify videos that need migration
   * Returns videos that are YouTube videos but don't have duration metadata
   */
  async identifyVideosNeedingMigration(): Promise<MediaItem[]> {
    logger.info('[VideoMigration] Identifying videos needing migration')
    
    try {
      // Get all media items from the media service
      const allMedia = await this.mediaService.getAllMedia()
      
      const youtubeVideosNeedingMigration = allMedia.filter((item: MediaItem) => {
        // Check if it's a YouTube video
        const isYoutube = item.type === 'video' && (
          item.metadata?.isYouTube ||
          item.metadata?.youtubeUrl ||
          item.metadata?.embedUrl?.includes('youtube.com/embed') ||
          (item.metadata?.youtubeUrl && isYouTubeUrl(item.metadata.youtubeUrl))
        )
        
        // Check if it's missing duration
        const missingDuration = !item.metadata?.duration || item.metadata.duration === 0
        
        return isYoutube && missingDuration
      })
      
      logger.info('[VideoMigration] Found videos needing migration:', {
        total: allMedia.length,
        youtubeVideos: allMedia.filter((item: MediaItem) => 
          item.type === 'video' && item.metadata?.isYouTube
        ).length,
        needingMigration: youtubeVideosNeedingMigration.length
      })
      
      return youtubeVideosNeedingMigration
    } catch (error) {
      logger.error('[VideoMigration] Failed to identify videos for migration:', error)
      throw error
    }
  }

  /**
   * Migrate a batch of YouTube videos to include duration metadata
   */
  async migrateBatch(videos: MediaItem[], options: VideoMigrationOptions = {}): Promise<MigrationResult> {
    const { dryRun = false, batchSize = 5 } = options
    
    logger.info('[VideoMigration] Starting batch migration:', {
      videoCount: videos.length,
      dryRun,
      batchSize
    })

    const result: MigrationResult = {
      totalVideosFound: videos.length,
      videosUpdated: 0,
      videosFailed: 0,
      errors: []
    }

    // Process videos in batches to avoid overwhelming the YouTube API
    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize)
      
      logger.info('[VideoMigration] Processing batch:', {
        batchNumber: Math.floor(i / batchSize) + 1,
        totalBatches: Math.ceil(videos.length / batchSize),
        videosInBatch: batch.length
      })

      // Process batch in parallel
      const batchPromises = batch.map(video => this.migrateVideo(video, dryRun))
      const batchResults = await Promise.allSettled(batchPromises)

      // Collect results
      for (const batchResult of batchResults) {
        if (batchResult.status === 'fulfilled') {
          if (batchResult.value.success) {
            result.videosUpdated++
          } else {
            result.videosFailed++
            result.errors.push(batchResult.value.error!)
          }
        } else {
          result.videosFailed++
          result.errors.push({
            videoId: 'unknown',
            error: batchResult.reason?.message || 'Unknown error'
          })
        }
      }

      // Small delay between batches to be respectful to the YouTube API
      if (i + batchSize < videos.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    logger.info('[VideoMigration] Batch migration completed:', result)
    return result
  }

  /**
   * Migrate a single YouTube video
   */
  private async migrateVideo(video: MediaItem, dryRun: boolean): Promise<{ success: boolean; error?: { videoId: string; error: string } }> {
    try {
      // Extract YouTube URL from metadata
      const youtubeUrl = video.metadata?.youtubeUrl || 
                        (video.metadata?.embedUrl ? this.convertEmbedToWatchUrl(video.metadata.embedUrl) : null)
      
      if (!youtubeUrl || !isYouTubeUrl(youtubeUrl)) {
        throw new Error('Invalid or missing YouTube URL')
      }

      logger.info('[VideoMigration] Migrating video:', {
        videoId: video.id,
        fileName: video.fileName,
        youtubeUrl,
        dryRun
      })

      // Fetch real video duration
      const videoInfo = await getYouTubeDurationWithFallback(youtubeUrl)
      
      if (!videoInfo || videoInfo.duration === null) {
        throw new Error('Failed to fetch video duration')
      }

      logger.info('[VideoMigration] Fetched duration:', {
        videoId: video.id,
        duration: videoInfo.duration,
        title: videoInfo.title
      })

      if (!dryRun) {
        // Update the video metadata with the real duration
        const updatedMetadata = {
          ...video.metadata,
          duration: videoInfo.duration,
          // Also update other metadata if available
          title: videoInfo.title || video.metadata?.title,
          thumbnail: videoInfo.thumbnail || video.metadata?.thumbnail,
          author: videoInfo.author || video.metadata?.author
        }

        // Update in file storage
        await this.fileStorage.storeYouTubeVideo(video.id, youtubeUrl, {
          ...updatedMetadata,
          page_id: video.pageId,
          embed_url: video.metadata?.embedUrl
        })

        // Update in media service cache
        if (this.mediaService.mediaCache) {
          const updatedItem = {
            ...video,
            metadata: updatedMetadata
          }
          this.mediaService.mediaCache.set(video.id, updatedItem)
        }

        logger.info('[VideoMigration] Successfully updated video:', {
          videoId: video.id,
          duration: videoInfo.duration
        })
      } else {
        logger.info('[VideoMigration] DRY RUN - Would update video:', {
          videoId: video.id,
          currentDuration: video.metadata?.duration,
          newDuration: videoInfo.duration
        })
      }

      return { success: true }
    } catch (error) {
      logger.error('[VideoMigration] Failed to migrate video:', {
        videoId: video.id,
        error
      })
      
      return {
        success: false,
        error: {
          videoId: video.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  /**
   * Convert YouTube embed URL to watch URL
   */
  private convertEmbedToWatchUrl(embedUrl: string): string | null {
    try {
      const videoId = extractVideoId(embedUrl)
      return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null
    } catch {
      return null
    }
  }

  /**
   * Run complete migration for all videos needing it
   */
  async runCompleteMigration(options: VideoMigrationOptions = {}): Promise<MigrationResult> {
    logger.info('[VideoMigration] Starting complete migration')
    
    try {
      // Step 1: Identify videos needing migration
      const videosToMigrate = await this.identifyVideosNeedingMigration()
      
      if (videosToMigrate.length === 0) {
        logger.info('[VideoMigration] No videos need migration')
        return {
          totalVideosFound: 0,
          videosUpdated: 0,
          videosFailed: 0,
          errors: []
        }
      }

      // Step 2: Migrate them
      const result = await this.migrateBatch(videosToMigrate, options)
      
      logger.info('[VideoMigration] Complete migration finished:', result)
      return result
    } catch (error) {
      logger.error('[VideoMigration] Complete migration failed:', error)
      throw error
    }
  }

  /**
   * Generate a migration report without making changes
   */
  async generateMigrationReport(): Promise<{
    videosNeedingMigration: Array<{
      id: string
      fileName: string
      youtubeUrl: string | null
      currentDuration: number | undefined
      pageId: string
    }>
    totalCount: number
  }> {
    const videosToMigrate = await this.identifyVideosNeedingMigration()
    
    return {
      videosNeedingMigration: videosToMigrate.map(video => ({
        id: video.id,
        fileName: video.fileName,
        youtubeUrl: video.metadata?.youtubeUrl || 
                   (video.metadata?.embedUrl ? this.convertEmbedToWatchUrl(video.metadata.embedUrl) : null),
        currentDuration: video.metadata?.duration,
        pageId: video.pageId
      })),
      totalCount: videosToMigrate.length
    }
  }
}

/**
 * Convenience function to create and run migration
 */
export async function migrateExistingVideos(
  mediaService: any, 
  fileStorage: any, 
  options: VideoMigrationOptions = {}
): Promise<MigrationResult> {
  const migrator = new VideoMigrationUtility(mediaService, fileStorage)
  return await migrator.runCompleteMigration(options)
}

/**
 * Convenience function to generate migration report
 */
export async function generateVideoMigrationReport(
  mediaService: any, 
  fileStorage: any
): Promise<{
  videosNeedingMigration: Array<{
    id: string
    fileName: string
    youtubeUrl: string | null
    currentDuration: number | undefined
    pageId: string
  }>
  totalCount: number
}> {
  const migrator = new VideoMigrationUtility(mediaService, fileStorage)
  return await migrator.generateMigrationReport()
}