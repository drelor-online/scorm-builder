/**
 * MediaService - File-based media management ONLY
 * 
 * This service wraps FileStorage to ensure ALL media is stored in the file system.
 * NO IndexedDB, NO memory storage - ONLY file-based storage through Tauri.
 */

import { FileStorage } from './FileStorage'
import { generateMediaId, type MediaType } from '../utils/idGenerator'
import { logger } from '../utils/logger'
import { debugLogger } from '@/utils/ultraSimpleLogger'
import { mediaUrlService } from './mediaUrl'
import { blobUrlManager } from '../utils/blobUrlManager'

export interface MediaMetadata {
  size?: number
  uploadedAt: string
  width?: number
  height?: number
  duration?: number
  youtubeUrl?: string
  embedUrl?: string
  thumbnail?: string
  mimeType?: string
  originalName?: string
  pageId?: string
  type: MediaType
  [key: string]: any
}

export interface MediaItem {
  id: string
  type: MediaType
  pageId: string
  fileName: string
  metadata: MediaMetadata
}

export interface MediaServiceConfig {
  projectId: string
  fileStorage?: FileStorage  // Optional shared FileStorage instance
}

export interface ProgressInfo {
  loaded: number
  total: number
  percent: number
  timestamp?: number
  fileIndex?: number
}

export type ProgressCallback = (progress: ProgressInfo) => void

// Singleton instance cache
const mediaServiceInstances = new Map<string, MediaService>()

export class MediaService {
  public readonly projectId: string
  private fileStorage: FileStorage
  private mediaCache: Map<string, MediaItem> = new Map()
  
  private constructor(config: MediaServiceConfig) {
    // VERSION MARKER: v2.0.5 - MediaService with forced URL generation and fallbacks
    // Project ID should already be extracted by getInstance
    this.projectId = config.projectId
    // Use provided FileStorage or create new one
    this.fileStorage = config.fileStorage || new FileStorage()
    
    debugLogger.info('MediaService.constructor v2.0.5', 'Initialized MediaService', {
      projectId: this.projectId,
      storageType: 'FILE_STORAGE_ONLY',
      sharedInstance: !!config.fileStorage,
      version: 'v2.0.5'
    })
    console.log('[MediaService v2.0.5] Initialized with project ID:', this.projectId)
    
    logger.info('[MediaService] Initialized for project:', this.projectId, 'using FILE STORAGE ONLY', 
      config.fileStorage ? '(shared instance)' : '(new instance)')
  }
  
  // Static factory method to get singleton instance per project
  static getInstance(config: MediaServiceConfig): MediaService {
    // Extract the numeric project ID for consistent caching
    const extractedId = MediaService.extractNumericProjectId(config.projectId)
    
    const existing = mediaServiceInstances.get(extractedId)
    if (existing) {
      debugLogger.debug('MediaService.getInstance', 'Returning existing instance', {
        originalProjectId: config.projectId,
        extractedId: extractedId
      })
      return existing
    }
    
    debugLogger.debug('MediaService.getInstance', 'Creating new instance', {
      originalProjectId: config.projectId,
      extractedId: extractedId
    })
    
    // Pass the extracted ID to ensure consistency
    const instance = new MediaService({ ...config, projectId: extractedId })
    mediaServiceInstances.set(extractedId, instance)
    return instance
  }
  
  // Static method to extract numeric project ID
  private static extractNumericProjectId(projectIdOrPath: string): string {
    if (!projectIdOrPath) return ''
    
    // If it's a file path like "...\ProjectName_1234567890.scormproj"
    if (projectIdOrPath.includes('.scormproj')) {
      const match = projectIdOrPath.match(/_(\d+)\.scormproj$/)
      if (match) {
        return match[1]
      }
    }
    
    // If it's a folder path like "C:\...\SCORM Projects\1754510569416"
    if (projectIdOrPath.includes('\\') || projectIdOrPath.includes('/')) {
      const parts = projectIdOrPath.split(/[\\/]/)
      const lastPart = parts[parts.length - 1]
      // If the last part is all digits, use it
      if (/^\d+$/.test(lastPart)) {
        return lastPart
      }
    }
    
    // If it's already just a numeric ID
    if (/^\d+$/.test(projectIdOrPath)) {
      return projectIdOrPath
    }
    
    // Fallback: return as is
    debugLogger.warn('MediaService.extractNumericProjectId', 'Could not extract numeric ID from:', projectIdOrPath)
    return projectIdOrPath
  }
  
  // Clear singleton instance for a project
  static clearInstance(projectId: string): void {
    const extractedId = MediaService.extractNumericProjectId(projectId)
    debugLogger.info('MediaService.clearInstance', 'Clearing instance', { 
      originalProjectId: projectId,
      extractedId: extractedId 
    })
    mediaServiceInstances.delete(extractedId)
  }
  
  /**
   * Store media from File/Blob - ALWAYS to file system
   * @param file - The file or blob to store
   * @param pageId - The page ID where this media belongs (e.g., 'welcome', 'topic-1')
   * @param type - The media type ('image' | 'video' | 'audio')
   * @param metadata - Optional metadata
   * @param progressCallback - Optional progress callback
   */
  async storeMedia(
    file: File | Blob,
    pageId: string,
    type: MediaType,
    metadata?: Partial<MediaMetadata>,
    progressCallback?: ProgressCallback
  ): Promise<MediaItem> {
    const id = generateMediaId(type, pageId)
    
    debugLogger.info('MediaService.storeMedia', 'Storing media', {
      mediaId: id,
      pageId,
      type,
      fileSize: file.size,
      fileName: (file as File).name || 'blob',
      mimeType: file.type
    })
    
    try {
      // Report initial progress
      if (progressCallback) {
        progressCallback({ loaded: 0, total: file.size, percent: 0 })
      }
      
      // Get filename
      const fileName = file instanceof File ? file.name : `${id}.${this.getExtension(type)}`
      
      // Store directly using FileStorage for efficiency with large files
      await this.fileStorage.storeMedia(id, file, type, {
        page_id: pageId,
        type,
        original_name: fileName,
        mime_type: file.type,
        size: file.size,
        ...metadata
      }, (progress) => {
        // Convert FileStorage progress to MediaService format
        progressCallback?.({
          loaded: Math.round(file.size * progress.percent / 100),
          total: file.size,
          percent: progress.percent
        })
      })
      
      // Report completion
      if (progressCallback) {
        progressCallback({ loaded: file.size, total: file.size, percent: 100 })
      }
      
      // Update cache
      const mediaItem: MediaItem = {
        id,
        type,
        pageId,
        fileName: fileName,
        metadata: {
          uploadedAt: new Date().toISOString(),
          type,
          pageId,
          mimeType: file.type,
          size: file.size,
          originalName: fileName,
          ...metadata
        }
      }
      this.mediaCache.set(id, mediaItem)
      
      debugLogger.info('MediaService.storeMedia', 'Media stored successfully', {
        mediaId: id,
        pageId,
        fileName,
        fileSize: file.size
      })
      
      logger.info('[MediaService] Stored media to FILE SYSTEM:', id, 'for page:', pageId)
      
      return mediaItem
    } catch (error) {
      debugLogger.error('MediaService.storeMedia', 'Failed to store media', {
        mediaId: id,
        pageId,
        error
      })
      logger.error('[MediaService] Failed to store media:', error)
      throw error
    }
  }
  
  /**
   * Legacy method for backward compatibility - DEPRECATED
   * @deprecated Use storeMedia(file, pageId, type, metadata?, progressCallback?) instead
   */
  async storeMediaLegacy(
    file: File | Blob,
    mediaType: MediaType,
    metadata?: Partial<MediaMetadata>,
    progressCallback?: ProgressCallback
  ): Promise<MediaItem> {
    console.warn(
      '[MediaService] storeMediaLegacy is deprecated. ' +
      'Please use storeMedia(file, pageId, type, metadata?, progressCallback?) instead. ' +
      'Using default pageId "global" for backward compatibility.'
    )
    
    // Use a default pageId for backward compatibility
    const pageId = metadata?.pageId || 'global'
    
    // Call the new method with corrected parameters
    return this.storeMedia(file, pageId, mediaType, metadata, progressCallback)
  }

  /**
   * Internal method to store media data - ALWAYS to file system
   */
  private async storeMediaInternal(
    data: Uint8Array,
    type: MediaType,
    pageId: string,
    fileName?: string,
    metadata?: Partial<MediaMetadata>,
    onProgress?: (progress: { percent: number }) => void
  ): Promise<string> {
    const id = generateMediaId(type, pageId)
    
    debugLogger.debug('MediaService.storeMediaInternal', 'Storing media data', {
      mediaId: id,
      type,
      pageId,
      dataSize: data.length
    })
    
    try {
      // Convert Uint8Array to Blob for FileStorage
      // Handle both Uint8Array and ArrayBuffer
      const dataArray = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data as any)
      const blob = new Blob([dataArray])
      
      // Store using FileStorage - this goes to the file system via Tauri
      await this.fileStorage.storeMedia(id, blob, type, {
        page_id: pageId,
        type,
        original_name: fileName || `${id}.${this.getExtension(type)}`,
        mime_type: metadata?.mimeType,
        ...metadata
      }, onProgress)
      
      debugLogger.debug('MediaService.storeMediaInternal', 'Media data stored to file system', {
        mediaId: id
      })
      
      logger.info('[MediaService] Stored media to FILE SYSTEM:', id, 'for page:', pageId)
      
      // Update cache
      const mediaItem: MediaItem = {
        id,
        type,
        pageId,
        fileName: fileName || id,
        metadata: {
          uploadedAt: new Date().toISOString(),
          type,
          pageId,
          originalName: fileName,
          ...metadata
        }
      }
      this.mediaCache.set(id, mediaItem)
      
      return id
    } catch (error) {
      debugLogger.error('MediaService.storeMediaInternal', 'Failed to store media', {
        mediaId: id,
        error
      })
      logger.error('[MediaService] Failed to store media to file system:', error)
      throw new Error(`Failed to store media to file system: ${error}`)
    }
  }
  
  /**
   * Store YouTube video metadata - to file system
   */
  async storeYouTubeVideo(
    youtubeUrl: string,
    embedUrl: string,
    pageId: string,
    metadata?: Partial<MediaMetadata>
  ): Promise<MediaItem> {
    const id = generateMediaId('video', pageId)
    
    debugLogger.info('MediaService.storeYouTubeVideo', 'Storing YouTube video', {
      mediaId: id,
      pageId,
      youtubeUrl,
      embedUrl
    })
    
    try {
      // Store YouTube metadata to file system
      await this.fileStorage.storeYouTubeVideo(id, youtubeUrl, {
        page_id: pageId,
        title: metadata?.title,
        thumbnail: metadata?.thumbnail,
        embed_url: embedUrl  // Use the embedUrl parameter
      })
      
      debugLogger.info('MediaService.storeYouTubeVideo', 'YouTube video stored successfully', {
        mediaId: id,
        pageId
      })
      
      logger.info('[MediaService] Stored YouTube video to FILE SYSTEM:', id)
      
      // Update cache
      const mediaItem: MediaItem = {
        id,
        type: 'video',
        pageId,
        fileName: metadata?.title || 'YouTube Video',
        metadata: {
          uploadedAt: new Date().toISOString(),
          type: 'video',
          pageId,
          youtubeUrl,
          embedUrl,  // Include embedUrl
          isYouTube: true,  // Mark as YouTube video
          ...metadata
        }
      }
      this.mediaCache.set(id, mediaItem)
      
      return mediaItem  // Return MediaItem, not just id
    } catch (error) {
      debugLogger.error('MediaService.storeYouTubeVideo', 'Failed to store YouTube video', {
        mediaId: id,
        error
      })
      logger.error('[MediaService] Failed to store YouTube video:', error)
      throw error
    }
  }
  
  /**
   * Get media from file system with asset URL
   */
  async getMedia(mediaId: string): Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null> {
    debugLogger.debug('MediaService.getMedia', 'Getting media', { mediaId })
    
    try {
      console.log('[MediaService] Getting media from file system:', mediaId)
      
      const mediaInfo = await this.fileStorage.getMedia(mediaId)
      
      debugLogger.debug('MediaService.getMedia', 'FileStorage returned', {
        found: !!mediaInfo,
        hasData: !!(mediaInfo?.data),
        dataSize: mediaInfo?.data?.byteLength || 0,
        mediaType: mediaInfo?.mediaType,
        metadataKeys: mediaInfo?.metadata ? Object.keys(mediaInfo.metadata) : []
      })
      
      console.log('[MediaService] FileStorage returned:', {
        found: !!mediaInfo,
        hasData: !!(mediaInfo?.data),
        dataSize: mediaInfo?.data?.byteLength || 0,
        mediaType: mediaInfo?.mediaType,
        metadataKeys: mediaInfo?.metadata ? Object.keys(mediaInfo.metadata) : []
      })
      
      if (!mediaInfo) {
        debugLogger.warn('MediaService.getMedia', 'Media not found', { mediaId })
        console.error('[MediaService] No media info returned from FileStorage for:', mediaId)
        return null
      }
      
      // Get cached metadata
      const cachedItem = this.mediaCache.get(mediaId)
      console.log('[MediaService] Cached item:', {
        found: !!cachedItem,
        id: cachedItem?.id,
        type: cachedItem?.type,
        pageId: cachedItem?.pageId
      })
      
      const metadata = cachedItem?.metadata || {
        uploadedAt: new Date().toISOString(),
        type: mediaInfo.mediaType as MediaType,
        pageId: mediaInfo.metadata?.page_id || '',
        size: mediaInfo.data?.byteLength || 0,
        ...mediaInfo.metadata
      }
      
      // Update cache if not already cached
      if (!cachedItem) {
        this.mediaCache.set(mediaId, {
          id: mediaId,
          type: metadata.type,
          pageId: metadata.pageId || '',
          fileName: metadata.originalName || mediaId,
          metadata
        })
      }
      
      // Generate URL based on media type
      let url: string | undefined
      
      // Log metadata to debug URL generation
      logger.info('[MediaService] Checking metadata for URL generation', {
        mediaId,
        source: metadata.source,
        embedUrl: metadata.embedUrl,
        youtubeUrl: metadata.youtubeUrl,
        hasSource: 'source' in metadata,
        hasEmbedUrl: 'embedUrl' in metadata,
        hasYoutubeUrl: 'youtubeUrl' in metadata,
        isYouTube: metadata.isYouTube,
        type: metadata.type,
        metadataKeys: Object.keys(metadata)
      })
      
      // For YouTube videos, return the embed URL directly
      if ((metadata.source === 'youtube' || metadata.isYouTube) && metadata.embedUrl) {
        url = metadata.embedUrl
        debugLogger.debug('MediaService.getMedia', 'Using YouTube embed URL', { mediaId, url })
        logger.info('[MediaService] Using YouTube embed URL:', url)
      } else if (metadata.youtubeUrl) {
        url = metadata.youtubeUrl
        debugLogger.debug('MediaService.getMedia', 'Using YouTube URL', { mediaId, url })
        logger.info('[MediaService] Using YouTube URL:', url)
      } else if (metadata.source === 'youtube' || metadata.isYouTube || metadata.embedUrl || metadata.youtubeUrl) {
        // YouTube video but missing URL - should not happen
        logger.error('[MediaService] YouTube video detected but no URL available', {
          mediaId,
          source: metadata.source,
          isYouTube: metadata.isYouTube,
          hasEmbedUrl: !!metadata.embedUrl,
          hasYoutubeUrl: !!metadata.youtubeUrl
        })
      } else {
        // For regular files, use the asset protocol via MediaUrlService
        logger.info('[MediaService v2.0.5] Processing regular media file', { 
          projectId: this.projectId, 
          mediaId,
          mediaType: metadata.type,
          hasData: !!mediaInfo.data,
          dataSize: mediaInfo.data?.byteLength || 0
        })
        
        console.log('[MediaService v2.0.5] About to generate URL for:', mediaId)
        
        try {
          logger.info('[MediaService v2.0.5] Calling mediaUrlService.getMediaUrl', { 
            projectId: this.projectId, 
            mediaId 
          })
          
          const mediaUrl = await mediaUrlService.getMediaUrl(this.projectId, mediaId)
          
          logger.info('[MediaService v2.0.5] mediaUrlService.getMediaUrl returned', { 
            mediaId,
            projectId: this.projectId,
            returnedUrl: mediaUrl,
            hasUrl: !!mediaUrl,
            urlLength: mediaUrl?.length || 0
          })
          
          console.log('[MediaService v2.0.5] mediaUrlService returned:', mediaUrl)
          
          if (mediaUrl) {
            url = mediaUrl
            debugLogger.debug('MediaService.getMedia', 'Generated asset URL', { mediaId, url })
            logger.info('[MediaService v2.0.5] Successfully generated asset URL:', url)
          } else {
            logger.error('[MediaService v2.0.5] mediaUrlService.getMediaUrl returned null!', { 
              projectId: this.projectId, 
              mediaId,
              extractedProjectId: MediaService.extractNumericProjectId(this.projectId)
            })
            // Generate fallback URL immediately
            const numericId = MediaService.extractNumericProjectId(this.projectId)
            url = `asset://localhost/${numericId}/media/${mediaId}.bin`
            logger.warn('[MediaService v2.0.5] Using direct fallback URL:', url)
          }
        } catch (urlError) {
          logger.error('[MediaService v2.0.5] Exception when calling mediaUrlService.getMediaUrl:', {
            error: urlError,
            errorMessage: (urlError as any)?.message || 'Unknown error',
            projectId: this.projectId,
            mediaId
          })
          // Don't throw - generate fallback URL instead
          const numericId = MediaService.extractNumericProjectId(this.projectId)
          url = `asset://localhost/${numericId}/media/${mediaId}.bin`
          logger.warn('[MediaService v2.0.5] Using fallback URL after error:', url)
        }
        
        // Final fallback if still no URL
        if (!url) {
          const numericId = MediaService.extractNumericProjectId(this.projectId)
          url = `asset://localhost/${numericId}/media/${mediaId}.bin`
          logger.error('[MediaService v2.0.6] No URL generated! Using final fallback:', { 
            mediaId, 
            url,
            projectId: this.projectId,
            numericId 
          })
          console.error('[MediaService v2.0.6] CRITICAL - No URL, using final fallback:', url)
        }
      }
      
      // Convert ArrayBuffer to Uint8Array if data exists (for backward compatibility)
      let data: Uint8Array | undefined
      if (mediaInfo.data && !metadata.source) {
        data = new Uint8Array(mediaInfo.data)
        console.log('[MediaService] Converted ArrayBuffer to Uint8Array:', {
          originalSize: mediaInfo.data.byteLength,
          convertedSize: data.length,
          firstBytes: data.length > 0 ? Array.from(data.slice(0, 10)) : []
        })
      }
      
      debugLogger.info('MediaService.getMedia', 'Media retrieved successfully', {
        mediaId,
        hasData: !!data,
        hasUrl: !!url,
        type: metadata.type
      })
      
      logger.info('[MediaService v2.0.6] Retrieved media from FILE SYSTEM:', mediaId, 'url:', url)
      console.log('[MediaService v2.0.6] Final result for getMedia:', { 
        mediaId, 
        url, 
        hasUrl: !!url,
        urlType: url ? (url.startsWith('asset://') ? 'asset' : url.startsWith('blob:') ? 'blob' : 'other') : 'none'
      })
      
      const result = {
        data,
        metadata,
        url
      }
      
      console.log('[MediaService] Returning media:', {
        mediaId,
        hasData: !!result.data,
        metadataType: result.metadata.type,
        metadataPageId: result.metadata.pageId,
        url: result.url
      })
      
      return result
    } catch (error) {
      debugLogger.error('MediaService.getMedia', 'Failed to get media', {
        mediaId,
        error
      })
      logger.error('[MediaService] Failed to get media from file system:', error)
      console.error('[MediaService] Error details:', error)
      return null
    }
  }
  
  /**
   * Create asset URL for media from file system
   */
  async createBlobUrl(mediaId: string): Promise<string | null> {
    debugLogger.debug('MediaService.createBlobUrl', 'Creating blob URL', { mediaId })
    console.log('[MediaService v2.0.7] createBlobUrl called for:', mediaId)
    
    try {
      // Get the media with data
      const media = await this.getMedia(mediaId)
      if (!media) {
        debugLogger.warn('MediaService.createBlobUrl', 'No media found', { mediaId })
        logger.warn('[MediaService v2.0.7] No media found for:', mediaId)
        return null
      }
      
      // If we have data, create a real blob URL
      if (media.data && media.data.length > 0) {
        console.log('[MediaService v2.0.7] Creating blob URL from data:', {
          mediaId,
          dataSize: media.data.length,
          mimeType: media.metadata?.mimeType || media.metadata?.mime_type
        })
        
        // Determine MIME type
        let mimeType = media.metadata?.mimeType || media.metadata?.mime_type || 'application/octet-stream'
        
        // Fix common MIME type issues
        if (media.metadata?.type === 'image' && !mimeType.startsWith('image/')) {
          mimeType = 'image/jpeg' // Default for images
        } else if (media.metadata?.type === 'audio' && !mimeType.startsWith('audio/')) {
          mimeType = 'audio/mpeg' // Default for audio (mp3)
        } else if (media.metadata?.type === 'video' && !mimeType.startsWith('video/')) {
          mimeType = 'video/mp4' // Default for video
        }
        
        // Create blob from Uint8Array data
        const blob = new Blob([media.data], { type: mimeType })
        const blobUrl = URL.createObjectURL(blob)
        
        debugLogger.debug('MediaService.createBlobUrl', 'Blob URL created', { mediaId, blobUrl })
        logger.info('[MediaService v2.0.7] Created blob URL:', mediaId, 'URL:', blobUrl)
        console.log('[MediaService v2.0.7] Blob URL created:', {
          mediaId,
          blobUrl,
          blobSize: blob.size,
          mimeType: blob.type
        })
        
        return blobUrl
      }
      
      // If we have a URL but no data, return the URL (might be external)
      if (media.url) {
        console.log('[MediaService v2.0.7] Using existing URL:', media.url)
        return media.url
      }
      
      debugLogger.warn('MediaService.createBlobUrl', 'No data or URL found', { mediaId })
      logger.warn('[MediaService v2.0.7] No data or URL found for media:', mediaId)
      return null
    } catch (error) {
      debugLogger.error('MediaService.createBlobUrl', 'Failed to create blob URL', { mediaId, error })
      logger.error('[MediaService v2.0.7] Failed to create blob URL:', error)
      console.error('[MediaService v2.0.7] Error creating blob URL:', error)
      return null
    }
  }
  
  /**
   * List media for a page from file system
   */
  async listMediaForPage(pageId: string): Promise<MediaItem[]> {
    debugLogger.debug('MediaService.listMediaForPage', 'Listing media for page', { pageId })
    
    try {
      const media = await this.fileStorage.getMediaForTopic(pageId)
      
      debugLogger.info('MediaService.listMediaForPage', 'Media listed', {
        pageId,
        count: media.length
      })
      
      logger.info('[MediaService] Listed media from FILE SYSTEM for page:', pageId, 'count:', media.length)
      
      return media.map(item => ({
        id: item.id,
        type: item.metadata?.type || 'image',
        pageId,
        fileName: item.metadata?.original_name || item.id,
        metadata: {
          uploadedAt: item.metadata?.uploadedAt || new Date().toISOString(),
          type: item.metadata?.type || 'image',
          pageId,
          ...item.metadata
        }
      }))
    } catch (error) {
      debugLogger.error('MediaService.listMediaForPage', 'Failed to list media', { pageId, error })
      logger.error('[MediaService] Failed to list media for page:', error)
      return []
    }
  }
  
  /**
   * List all media in the project
   */
  async listAllMedia(): Promise<MediaItem[]> {
    debugLogger.debug('MediaService.listAllMedia', 'Listing all media')
    
    try {
      // Return cached items since FileStorage doesn't have getAllMedia
      // The cache is populated when media is stored or retrieved
      const items = Array.from(this.mediaCache.values())
      
      debugLogger.info('MediaService.listAllMedia', 'Media listed from cache', {
        count: items.length
      })
      
      logger.info('[MediaService] Listed all media from cache, count:', items.length)
      return items
    } catch (error) {
      debugLogger.error('MediaService.listAllMedia', 'Failed to list media', error)
      logger.error('[MediaService] Failed to list all media:', error)
      return []
    }
  }

  /**
   * Get all media with asset URLs
   */
  async getAllMedia(): Promise<Array<{ id: string; url: string; metadata: MediaMetadata }>> {
    debugLogger.debug('MediaService.getAllMedia', 'Getting all media with URLs')
    
    try {
      const items = Array.from(this.mediaCache.values())
      const mediaWithUrls = []
      
      for (const item of items) {
        let url: string | null = null
        
        // For YouTube videos, use the embed URL
        if (item.metadata.youtubeUrl || item.metadata.embedUrl) {
          url = item.metadata.embedUrl || item.metadata.youtubeUrl || null
        } else {
          // For regular files, use the asset protocol
          url = await mediaUrlService.getMediaUrl(this.projectId, item.id)
        }
        
        if (url) {
          mediaWithUrls.push({
            id: item.id,
            url,
            metadata: item.metadata
          })
        }
      }
      
      debugLogger.info('MediaService.getAllMedia', 'Retrieved all media with URLs', {
        count: mediaWithUrls.length
      })
      
      logger.info('[MediaService] Got all media with asset URLs, count:', mediaWithUrls.length)
      return mediaWithUrls
    } catch (error) {
      debugLogger.error('MediaService.getAllMedia', 'Failed to get all media', error)
      logger.error('[MediaService] Failed to get all media:', error)
      return []
    }
  }
  
  /**
   * Delete media from file system
   */
  async deleteMedia(projectId: string, mediaId: string): Promise<boolean> {
    debugLogger.info('MediaService.deleteMedia', 'Deleting media', { projectId, mediaId })
    
    try {
      // Call FileStorage to delete from backend
      const deleted = await this.fileStorage.deleteMedia(mediaId)
      
      if (deleted) {
        // Remove from cache only if deletion succeeded
        this.mediaCache.delete(mediaId)
        // Revoke blob URL if it exists
        const blobManager = blobUrlManager
        blobManager.revokeUrl(mediaId)
        
        debugLogger.info('MediaService.deleteMedia', 'Media deleted successfully', { mediaId })
        logger.info('[MediaService] Deleted media:', mediaId)
        return true
      } else {
        debugLogger.warn('MediaService.deleteMedia', 'Media not found', { mediaId })
        logger.warn('[MediaService] Media not found:', mediaId)
        return false
      }
    } catch (error) {
      debugLogger.error('MediaService.deleteMedia', 'Failed to delete media', { mediaId, error })
      logger.error('[MediaService] Failed to delete media:', error)
      return false
    }
  }

  /**
   * Delete all media for a specific topic
   */
  async deleteMediaForTopic(projectId: string, topicId: string): Promise<void> {
    debugLogger.info('MediaService.deleteMediaForTopic', 'Deleting media for topic', { projectId, topicId })
    
    try {
      // List all media for the project
      const allMedia = await this.fileStorage.listMedia()
      
      // Filter media for this topic
      const topicMedia = allMedia.filter((media: any) => 
        media.topicId === topicId || media.metadata?.topicId === topicId
      )
      
      // Delete each media item
      for (const media of topicMedia) {
        await this.deleteMedia(projectId, media.id)
      }
      
      // Revoke all blob URLs for the topic
      // Note: blobUrlManager doesn't have per-topic cleanup, but individual media deletion handles this
      
      debugLogger.info('MediaService.deleteMediaForTopic', 'Deleted media for topic', { 
        projectId, 
        topicId, 
        count: topicMedia.length 
      })
    } catch (error) {
      debugLogger.error('MediaService.deleteMediaForTopic', 'Failed to delete media for topic', { 
        projectId, 
        topicId, 
        error 
      })
      throw error
    }
  }

  /**
   * Delete all media in a project
   */
  async deleteAllMedia(projectId: string): Promise<void> {
    debugLogger.info('MediaService.deleteAllMedia', 'Deleting all media', { projectId })
    
    try {
      // List all media
      const allMedia = await this.fileStorage.listMedia()
      
      // Delete each media item
      for (const media of allMedia) {
        await this.deleteMedia(projectId, media.id)
      }
      
      // Clear cache and revoke all blob URLs
      this.mediaCache.clear()
      const blobManager = blobUrlManager
      blobManager.clearAll()
      
      debugLogger.info('MediaService.deleteAllMedia', 'Deleted all media', { 
        projectId, 
        count: allMedia.length 
      })
    } catch (error) {
      debugLogger.error('MediaService.deleteAllMedia', 'Failed to delete all media', { projectId, error })
      throw error
    }
  }

  /**
   * Bulk delete media with error handling
   */
  async bulkDeleteMedia(
    projectId: string, 
    mediaIds: string[], 
    options: { batchSize?: number } = {}
  ): Promise<{ succeeded: string[], failed: Array<{ id: string, error: string }> }> {
    const { batchSize = 10 } = options
    const succeeded: string[] = []
    const failed: Array<{ id: string, error: string }> = []
    
    debugLogger.info('MediaService.bulkDeleteMedia', 'Starting bulk delete', { 
      projectId, 
      count: mediaIds.length,
      batchSize 
    })
    
    // Process in batches
    for (let i = 0; i < mediaIds.length; i += batchSize) {
      const batch = mediaIds.slice(i, i + batchSize)
      
      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map(mediaId => this.deleteMedia(projectId, mediaId))
      )
      
      results.forEach((result, index) => {
        const mediaId = batch[index]
        if (result.status === 'fulfilled' && result.value) {
          succeeded.push(mediaId)
        } else {
          failed.push({
            id: mediaId,
            error: result.status === 'rejected' 
              ? result.reason?.message || 'Unknown error'
              : 'Failed to delete'
          })
        }
      })
    }
    
    debugLogger.info('MediaService.bulkDeleteMedia', 'Bulk delete completed', { 
      projectId,
      succeeded: succeeded.length,
      failed: failed.length 
    })
    
    return { succeeded, failed }
  }

  /**
   * Find orphaned media (media not associated with any topic)
   */
  async findOrphanedMedia(projectId: string): Promise<string[]> {
    debugLogger.info('MediaService.findOrphanedMedia', 'Finding orphaned media', { projectId })
    
    try {
      // Get all media
      const allMedia = await this.fileStorage.listMedia()
      
      // Get all topics from content
      const content = await this.fileStorage.getContent('course-content')
      const validTopicIds = new Set(content?.topics?.map((t: any) => t.id) || [])
      
      // Find media without valid topics
      const orphaned = allMedia.filter((media: any) => {
        const topicId = media.topicId || media.metadata?.topicId
        return !topicId || !validTopicIds.has(topicId)
      }).map((media: any) => media.id)
      
      debugLogger.info('MediaService.findOrphanedMedia', 'Found orphaned media', { 
        projectId,
        count: orphaned.length 
      })
      
      return orphaned
    } catch (error) {
      debugLogger.error('MediaService.findOrphanedMedia', 'Failed to find orphaned media', { 
        projectId, 
        error 
      })
      return []
    }
  }

  /**
   * Clean up orphaned media
   */
  async cleanupOrphanedMedia(projectId: string): Promise<number> {
    debugLogger.info('MediaService.cleanupOrphanedMedia', 'Cleaning up orphaned media', { projectId })
    
    try {
      const orphaned = await this.findOrphanedMedia(projectId)
      
      for (const mediaId of orphaned) {
        await this.deleteMedia(projectId, mediaId)
      }
      
      debugLogger.info('MediaService.cleanupOrphanedMedia', 'Cleaned up orphaned media', { 
        projectId,
        count: orphaned.length 
      })
      
      return orphaned.length
    } catch (error) {
      debugLogger.error('MediaService.cleanupOrphanedMedia', 'Failed to cleanup orphaned media', { 
        projectId, 
        error 
      })
      return 0
    }
  }
  
  private getExtension(type: MediaType): string {
    switch (type) {
      case 'image': return 'jpg'
      case 'video': return 'mp4'
      case 'audio': return 'mp3'
      case 'caption': return 'vtt'
      default: return 'bin'
    }
  }
}

// Export factory function for getting singleton instances
export function createMediaService(projectId: string, fileStorage?: FileStorage): MediaService {
  return MediaService.getInstance({ projectId, fileStorage })
}

// Export as default to replace the old MediaService
export default MediaService