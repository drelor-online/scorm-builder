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
  [key: string]: unknown
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

/**
 * Detect if data contains SVG content
 */
function detectSvgContent(data: ArrayBuffer | Uint8Array): boolean {
  try {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 200))
    return text.includes('<svg') || text.includes('<?xml')
  } catch {
    return false
  }
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

// Export for testing purposes only
export const __testing = {
  clearInstances: () => mediaServiceInstances.clear(),
  getInstances: () => mediaServiceInstances
}

export class MediaService {
  public readonly projectId: string
  private fileStorage: FileStorage
  private mediaCache: Map<string, MediaItem> = new Map()
  private blobUrlCache: Map<string, string> = new Map() // Cache blob URLs for the session
  private loadingPromise: Promise<void> | null = null // For deduplicating concurrent loads
  private audioDataCache: Map<string, { data: Uint8Array; metadata: MediaMetadata }> = new Map() // Persistent audio cache
  private audioLoadingPromises: Map<string, Promise<{ data: Uint8Array; metadata: MediaMetadata }>> = new Map() // Deduplicate concurrent audio loads
  
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
      
      // Clear any existing blob URL for this media ID to force regeneration
      const existingBlobUrl = this.blobUrlCache.get(id)
      if (existingBlobUrl && existingBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(existingBlobUrl)
        this.blobUrlCache.delete(id)
        logger.info('[MediaService] Cleared old blob URL for replaced media:', id)
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
      
      // Detect SVG content if it's an image
      let finalMimeType = metadata?.mimeType
      if (type === 'image' && detectSvgContent(dataArray)) {
        finalMimeType = 'image/svg+xml'
        debugLogger.debug('MediaService.storeMediaInternal', 'Detected SVG content', { mediaId: id })
      }
      
      const blob = new Blob([dataArray], { type: finalMimeType || 'application/octet-stream' })
      
      // Store using FileStorage - this goes to the file system via Tauri
      await this.fileStorage.storeMedia(id, blob, type, {
        page_id: pageId,
        type,
        original_name: fileName || `${id}.${this.getExtension(type, finalMimeType)}`,
        mime_type: finalMimeType || metadata?.mimeType,
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
   * Includes persistent caching for audio files to prevent reloading
   */
  async getMedia(mediaId: string): Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null> {
    debugLogger.debug('MediaService.getMedia', 'Getting media', { mediaId })
    
    // Check if this is audio and we have it cached
    if (mediaId?.startsWith('audio-') || mediaId?.includes('audio')) {
      const cached = this.audioDataCache.get(mediaId)
      if (cached) {
        console.log('[MediaService] Returning cached audio data for:', mediaId)
        return { ...cached, url: this.blobUrlCache.get(mediaId) }
      }
      
      // Check if we're already loading this audio
      const loadingPromise = this.audioLoadingPromises.get(mediaId)
      if (loadingPromise) {
        console.log('[MediaService] Waiting for existing audio load:', mediaId)
        return loadingPromise
      }
    }
    
    // Note: We no longer return cached blob URLs here to avoid stale URL issues
    // Blob URLs will be created fresh in UnifiedMediaContext.createBlobUrl
    // This ensures that replaced media always gets fresh blob URLs
    
    // For audio files, wrap the loading in a promise to deduplicate
    if (mediaId?.startsWith('audio-') || mediaId?.includes('audio')) {
      const loadPromise = this.loadAudioWithDeduplication(mediaId)
      this.audioLoadingPromises.set(mediaId, loadPromise)
      return loadPromise
    }
    
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
      } else if (mediaInfo.data && mediaInfo.data.byteLength > 0) {
        // For regular files with data, create a blob URL
        logger.info('[MediaService v3.0.0] Creating blob URL for media', { 
          projectId: this.projectId, 
          mediaId,
          mediaType: metadata.type,
          dataSize: mediaInfo.data.byteLength
        })
        
        // Determine MIME type
        let mimeType = metadata.mimeType || metadata.mime_type || 'application/octet-stream'
        
        // Check for SVG content in images
        if (metadata.type === 'image' && detectSvgContent(mediaInfo.data)) {
          mimeType = 'image/svg+xml'
          debugLogger.debug('MediaService.createBlobUrl', 'Detected SVG content', { mediaId })
        }
        
        // Fix common MIME type issues
        if (metadata.type === 'image' && !mimeType.startsWith('image/')) {
          // Check if it's SVG first
          if (detectSvgContent(mediaInfo.data)) {
            mimeType = 'image/svg+xml'
          } else {
            mimeType = 'image/jpeg' // Default for images
          }
        } else if (metadata.type === 'audio' && !mimeType.startsWith('audio/')) {
          mimeType = 'audio/mpeg' // Default for audio
        } else if (metadata.type === 'caption' && !mimeType.startsWith('text/')) {
          mimeType = 'text/vtt' // Default for captions
        }
        
        // Create blob from the data
        const blob = new Blob([mediaInfo.data], { type: mimeType })
        
        // Create blob URL
        url = URL.createObjectURL(blob)
        
        // Cache the blob URL for this session
        this.blobUrlCache.set(mediaId, url)
        
        debugLogger.debug('MediaService.getMedia', 'Created blob URL', { 
          mediaId, 
          url,
          mimeType,
          size: blob.size
        })
        logger.info('[MediaService v3.0.0] Successfully created blob URL:', url)
      } else {
        // No data available - this shouldn't happen for valid media
        logger.error('[MediaService v3.0.0] No data available for media:', { 
          mediaId,
          hasData: !!mediaInfo.data,
          dataSize: mediaInfo.data?.byteLength || 0
        })
      }
      
      // Always provide binary data for non-YouTube media (needed for SCORM packaging)
      let data: Uint8Array | undefined
      if (mediaInfo.data && !(metadata.source === 'youtube' || metadata.isYouTube)) {
        data = new Uint8Array(mediaInfo.data)
        console.log('[MediaService] Providing binary data for SCORM packaging:', {
          mediaId,
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
      
      // Cache audio data persistently to prevent reloading
      if (mediaId?.startsWith('audio-') || mediaId?.includes('audio')) {
        if (data && metadata) {
          this.audioDataCache.set(mediaId, { data, metadata })
          console.log('[MediaService] Cached audio data for future use:', mediaId)
        }
        // Clear loading promise
        this.audioLoadingPromises.delete(mediaId)
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
   * Load audio with deduplication to prevent concurrent loads
   */
  private async loadAudioWithDeduplication(mediaId: string): Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null> {
    try {
      console.log('[MediaService] Loading audio from file system:', mediaId)
      
      const mediaInfo = await this.fileStorage.getMedia(mediaId)
      
      if (!mediaInfo) {
        console.error('[MediaService] No audio info returned from FileStorage for:', mediaId)
        this.audioLoadingPromises.delete(mediaId)
        return null
      }
      
      // Process the audio data similar to regular getMedia
      const metadata = this.processMetadata(mediaInfo)
      
      // Create blob URL for audio
      let url: string | undefined
      if (mediaInfo.data) {
        const blob = new Blob([mediaInfo.data], { 
          type: metadata.mimeType || metadata.mime_type || 'audio/mpeg'
        })
        url = URL.createObjectURL(blob)
        this.blobUrlCache.set(mediaId, url)
        console.log('[MediaService] Created blob URL for audio:', mediaId)
      }
      
      const data = mediaInfo.data ? new Uint8Array(mediaInfo.data) : undefined
      
      const result = { data, metadata, url }
      
      // Cache the audio data
      if (data && metadata) {
        this.audioDataCache.set(mediaId, { data, metadata })
        console.log('[MediaService] Cached audio data for:', mediaId)
      }
      
      // Clear loading promise
      this.audioLoadingPromises.delete(mediaId)
      
      return result
    } catch (error) {
      console.error('[MediaService] Failed to load audio:', mediaId, error)
      this.audioLoadingPromises.delete(mediaId)
      return null
    }
  }
  
  /**
   * Helper to process metadata consistently
   */
  private processMetadata(mediaInfo: any): MediaMetadata {
    return {
      type: mediaInfo.mediaType || mediaInfo.metadata?.type || 'unknown',
      pageId: mediaInfo.metadata?.pageId || mediaInfo.metadata?.page_id || '',
      mimeType: mediaInfo.metadata?.mimeType || mediaInfo.metadata?.mime_type,
      mime_type: mediaInfo.metadata?.mime_type,
      source: mediaInfo.metadata?.source,
      embedUrl: mediaInfo.metadata?.embedUrl || mediaInfo.metadata?.embed_url,
      isYouTube: mediaInfo.metadata?.source === 'youtube',
      youtubeUrl: mediaInfo.metadata?.youtubeUrl,
      title: mediaInfo.metadata?.title,
      uploadedAt: mediaInfo.metadata?.uploadedAt || new Date().toISOString()
    }
  }
  
  /**
   * Clear the audio cache - should be called when switching projects
   */
  clearAudioCache(): void {
    console.log('[MediaService] Clearing audio cache, current size:', this.audioDataCache.size)
    
    // Clear blob URLs for cached audio
    this.audioDataCache.forEach((_, mediaId) => {
      const url = this.blobUrlCache.get(mediaId)
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
    })
    
    // Clear the caches
    this.audioDataCache.clear()
    this.audioLoadingPromises.clear()
    
    console.log('[MediaService] Audio cache cleared')
  }

  /**
   * Clear audio cache for a specific media ID - use when replacing audio
   */
  clearAudioFromCache(mediaId: string): void {
    console.log('[MediaService] Clearing audio from cache:', mediaId)
    
    // Clear blob URL if exists
    const url = this.blobUrlCache.get(mediaId)
    if (url && url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url)
        console.log('[MediaService] Revoked blob URL for:', mediaId)
      } catch (e) {
        console.warn('[MediaService] Failed to revoke blob URL:', e)
      }
    }
    
    // Remove from caches
    this.audioDataCache.delete(mediaId)
    this.blobUrlCache.delete(mediaId) 
    this.audioLoadingPromises.delete(mediaId)
    
    console.log('[MediaService] Audio cleared from cache:', mediaId)
  }
  
  /**
   * Check if audio is cached
   */
  hasAudioCached(mediaId: string): boolean {
    return this.audioDataCache.has(mediaId)
  }
  
  /**
   * Get cached audio without loading from disk
   */
  getCachedAudio(mediaId: string): { data: Uint8Array; metadata: MediaMetadata } | null {
    return this.audioDataCache.get(mediaId) || null
  }
  
  /**
   * Create blob URL for media (now just returns the URL from getMedia)
   */
  async createBlobUrl(mediaId: string): Promise<string | null> {
    debugLogger.debug('MediaService.createBlobUrl', 'Getting blob URL', { mediaId })
    console.log('[MediaService v3.0.0] createBlobUrl called for:', mediaId)
    
    try {
      // Get the media which now returns blob URLs
      const media = await this.getMedia(mediaId)
      if (!media) {
        debugLogger.warn('MediaService.createBlobUrl', 'No media found', { mediaId })
        logger.warn('[MediaService v3.0.0] No media found for:', mediaId)
        return null
      }
      
      // Return the URL (which is now a blob URL for regular media)
      if (media.url) {
        debugLogger.debug('MediaService.createBlobUrl', 'Returning blob URL', { mediaId, url: media.url })
        logger.info('[MediaService v3.0.0] Returning blob URL for:', mediaId)
        return media.url
      }
      
      debugLogger.warn('MediaService.createBlobUrl', 'No URL in media response', { mediaId })
      logger.warn('[MediaService v3.0.0] No URL in media response for:', mediaId)
      return null
    } catch (error) {
      debugLogger.error('MediaService.createBlobUrl', 'Failed to get blob URL', { mediaId, error })
      logger.error('[MediaService v3.0.0] Failed to get blob URL:', error)
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
      // Start with cached items
      const cachedItems = Array.from(this.mediaCache.values())
      const itemsMap = new Map<string, MediaItem>()
      
      // Add cached items to map
      cachedItems.forEach(item => {
        itemsMap.set(item.id, item)
      })
      
      // Check if FileStorage has getAllProjectMedia method (for file system discovery)
      if (this.fileStorage && typeof (this.fileStorage as any).getAllProjectMedia === 'function') {
        try {
          debugLogger.debug('MediaService.listAllMedia', 'Fetching media from file system')
          const fileSystemMedia = await (this.fileStorage as any).getAllProjectMedia()
          
          if (Array.isArray(fileSystemMedia)) {
            // Convert file system media to MediaItem format and merge
            fileSystemMedia.forEach((fsMedia: any) => {
              if (!itemsMap.has(fsMedia.id)) {
                // Convert to MediaItem format
                const mediaItem: MediaItem = {
                  id: fsMedia.id,
                  type: fsMedia.mediaType || fsMedia.metadata?.type || 'image',
                  pageId: fsMedia.metadata?.pageId || fsMedia.metadata?.page_id || '',
                  fileName: fsMedia.metadata?.fileName || fsMedia.metadata?.original_name || '',
                  metadata: {
                    ...fsMedia.metadata,
                    uploadedAt: fsMedia.metadata?.uploadedAt || new Date().toISOString()
                  }
                }
                itemsMap.set(fsMedia.id, mediaItem)
              }
            })
            
            debugLogger.info('MediaService.listAllMedia', 'Merged file system media', {
              cachedCount: cachedItems.length,
              fileSystemCount: fileSystemMedia.length,
              totalCount: itemsMap.size
            })
          }
        } catch (error) {
          // Log error but continue with cached items
          debugLogger.error('MediaService.listAllMedia', 'Failed to fetch file system media', error)
          logger.warn('[MediaService] Failed to fetch file system media, using cache only:', error)
        }
      }
      
      const items = Array.from(itemsMap.values())
      
      debugLogger.info('MediaService.listAllMedia', 'Media listed', {
        count: items.length
      })
      
      logger.info('[MediaService] Listed all media, count:', items.length)
      return items
    } catch (error) {
      debugLogger.error('MediaService.listAllMedia', 'Failed to list media', error)
      logger.error('[MediaService] Failed to list all media:', error)
      return []
    }
  }

  /**
   * Load media from disk and rebuild cache
   * This should be called on app startup to restore media from previous sessions
   * Includes deduplication to prevent multiple concurrent backend calls
   */
  async loadMediaFromDisk(): Promise<void> {
    // If already loading, return the existing promise to deduplicate requests
    if (this.loadingPromise) {
      debugLogger.info('MediaService.loadMediaFromDisk', 'Already loading, returning existing promise')
      return this.loadingPromise
    }
    
    // Create and store the loading promise
    this.loadingPromise = this.doLoadMediaFromDisk()
    
    try {
      await this.loadingPromise
    } finally {
      // Clear the loading promise when done (success or failure)
      this.loadingPromise = null
    }
  }
  
  private async doLoadMediaFromDisk(): Promise<void> {
    debugLogger.info('MediaService.doLoadMediaFromDisk', 'Loading media from disk for project', {
      projectId: this.projectId
    })
    
    try {
      // Clear existing cache to start fresh
      this.mediaCache.clear()
      this.blobUrlCache.clear() // Clear blob URL cache as they're not valid across sessions
      
      // Check if FileStorage has getAllProjectMedia method
      if (this.fileStorage && typeof (this.fileStorage as any).getAllProjectMedia === 'function') {
        const fileSystemMedia = await (this.fileStorage as any).getAllProjectMedia()
        
        if (Array.isArray(fileSystemMedia)) {
          debugLogger.info('MediaService.loadMediaFromDisk', 'Found media on disk', {
            count: fileSystemMedia.length
          })
          
          // Convert and add each media item to cache
          fileSystemMedia.forEach((fsMedia: any) => {
            const mediaItem: MediaItem = {
              id: fsMedia.id,
              type: fsMedia.mediaType || fsMedia.metadata?.type || 'image',
              pageId: fsMedia.metadata?.pageId || fsMedia.metadata?.page_id || '',
              fileName: fsMedia.metadata?.fileName || fsMedia.metadata?.original_name || '',
              metadata: {
                ...fsMedia.metadata,
                type: fsMedia.mediaType || fsMedia.metadata?.type || 'image',
                uploadedAt: fsMedia.metadata?.uploadedAt || new Date().toISOString()
              }
            }
            this.mediaCache.set(fsMedia.id, mediaItem)
            
            debugLogger.debug('MediaService.loadMediaFromDisk', 'Loaded media item', {
              id: fsMedia.id,
              type: mediaItem.type,
              pageId: mediaItem.pageId
            })
          })
          
          logger.info('[MediaService] Loaded', fileSystemMedia.length, 'media items from disk')
        } else {
          debugLogger.info('MediaService.doLoadMediaFromDisk', 'No media found on disk')
        }
      } else {
        debugLogger.warn('MediaService.doLoadMediaFromDisk', 'FileStorage does not support getAllProjectMedia')
      }
    } catch (error) {
      debugLogger.error('MediaService.doLoadMediaFromDisk', 'Failed to load media from disk', error)
      logger.error('[MediaService] Failed to load media from disk:', error)
      throw error // Re-throw to handle in loadMediaFromDisk
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
          // For regular files, get the blob URL
          const media = await this.getMedia(item.id)
          url = media?.url || null
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
        // Clear from audio cache if it's audio media
        if (mediaId?.startsWith('audio-') || mediaId?.includes('audio')) {
          this.clearAudioFromCache(mediaId)
        }
        // Revoke blob URL if it exists
        blobUrlManager.revokeUrl(mediaId)
        
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
      blobUrlManager.clearAll()
      
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
  
  /**
   * Load media from saved project data into cache
   * This method populates the MediaService cache when a project is opened
   */
  async loadMediaFromProject(audioNarrationData: any, mediaEnhancementsData: any, mediaRegistryData?: any): Promise<void> {
    debugLogger.info('MediaService.loadMediaFromProject', 'Loading media from project data', {
      hasAudioNarration: !!audioNarrationData,
      hasMediaEnhancements: !!mediaEnhancementsData,
      hasMediaRegistry: !!mediaRegistryData
    })
    
    try {
      // Clear existing cache
      this.mediaCache.clear()
      
      let mediaCount = 0
      
      // Load audio narration data
      if (audioNarrationData && typeof audioNarrationData === 'object') {
        for (const [pageId, audioData] of Object.entries(audioNarrationData)) {
          if (audioData && typeof audioData === 'object') {
            const audioItem = audioData as any
            const mediaItem: MediaItem = {
              id: audioItem.id,
              type: 'audio',
              pageId: audioItem.pageId || pageId,
              fileName: audioItem.metadata?.fileName || audioItem.metadata?.originalName || `${audioItem.id}.mp3`,
              metadata: {
                ...audioItem.metadata,
                type: 'audio',
                pageId: audioItem.pageId || pageId,
                uploadedAt: audioItem.metadata?.uploadedAt || new Date().toISOString()
              }
            }
            this.mediaCache.set(audioItem.id, mediaItem)
            mediaCount++
            debugLogger.debug('MediaService.loadMediaFromProject', 'Loaded audio narration', {
              id: audioItem.id,
              pageId: pageId
            })
          }
        }
      }
      
      // Load media enhancements data
      if (mediaEnhancementsData && typeof mediaEnhancementsData === 'object') {
        for (const [pageId, mediaArray] of Object.entries(mediaEnhancementsData)) {
          if (Array.isArray(mediaArray)) {
            for (const mediaData of mediaArray) {
              if (mediaData && typeof mediaData === 'object') {
                const mediaItem: MediaItem = {
                  id: mediaData.id,
                  type: mediaData.type || 'image',
                  pageId: mediaData.pageId || pageId,
                  fileName: mediaData.metadata?.fileName || mediaData.metadata?.originalName || `${mediaData.id}.${this.getExtension(mediaData.type || 'image')}`,
                  metadata: {
                    ...mediaData.metadata,
                    type: mediaData.type || 'image',
                    pageId: mediaData.pageId || pageId,
                    uploadedAt: mediaData.metadata?.uploadedAt || new Date().toISOString()
                  }
                }
                this.mediaCache.set(mediaData.id, mediaItem)
                mediaCount++
                debugLogger.debug('MediaService.loadMediaFromProject', 'Loaded media enhancement', {
                  id: mediaData.id,
                  type: mediaData.type,
                  pageId: pageId
                })
              }
            }
          }
        }
      }
      
      // Load media registry data if available (for backward compatibility)
      if (mediaRegistryData && typeof mediaRegistryData === 'object') {
        for (const [mediaId, registryData] of Object.entries(mediaRegistryData)) {
          // Only add if not already in cache (avoid duplicates)
          if (!this.mediaCache.has(mediaId) && registryData && typeof registryData === 'object') {
            const regData = registryData as any
            const mediaItem: MediaItem = {
              id: mediaId,
              type: regData.type || 'image',
              pageId: regData.pageId || 'unknown',
              fileName: regData.fileName || regData.originalName || `${mediaId}.${this.getExtension(regData.type || 'image')}`,
              metadata: {
                ...regData,
                type: regData.type || 'image',
                pageId: regData.pageId || 'unknown',
                uploadedAt: regData.uploadedAt || new Date().toISOString()
              }
            }
            this.mediaCache.set(mediaId, mediaItem)
            mediaCount++
            debugLogger.debug('MediaService.loadMediaFromProject', 'Loaded from media registry', {
              id: mediaId,
              type: regData.type
            })
          }
        }
      }
      
      debugLogger.info('MediaService.loadMediaFromProject', 'Media loaded into cache', {
        totalItems: mediaCount,
        cacheSize: this.mediaCache.size
      })
      
      logger.info('[MediaService] Loaded media from project:', mediaCount, 'items into cache')
    } catch (error) {
      debugLogger.error('MediaService.loadMediaFromProject', 'Failed to load media from project', error)
      logger.error('[MediaService] Failed to load media from project:', error)
      throw error
    }
  }

  /**
   * Load media from course content structure (welcome page, objectives, topics)
   * This handles the actual course content format where media is in arrays
   */
  async loadMediaFromCourseContent(courseContent: any): Promise<void> {
    debugLogger.info('MediaService.loadMediaFromCourseContent', 'Loading media from course content', {
      hasWelcome: !!courseContent.welcomePage,
      hasObjectives: !!courseContent.learningObjectivesPage,
      hasObjectivesAlt: !!courseContent.objectivesPage,
      topicsCount: courseContent.topics?.length || 0,
      welcomePageKeys: courseContent.welcomePage ? Object.keys(courseContent.welcomePage) : [],
      welcomePageId: courseContent.welcomePage?.id,
      welcomePageHasMedia: !!(courseContent.welcomePage?.media),
      welcomePageMediaLength: courseContent.welcomePage?.media?.length || 0
    })
    
    // Log the actual structure of the first page to understand what we're dealing with
    if (courseContent.welcomePage) {
      console.log('[MediaService] Welcome page structure:', {
        id: courseContent.welcomePage.id,
        hasMedia: 'media' in courseContent.welcomePage,
        hasMediaReferences: 'mediaReferences' in courseContent.welcomePage,
        mediaLength: courseContent.welcomePage.media?.length,
        mediaReferencesLength: courseContent.welcomePage.mediaReferences?.length,
        mediaContent: courseContent.welcomePage.media?.slice(0, 2), // Log first 2 items if they exist
        allKeys: Object.keys(courseContent.welcomePage)
      })
    }
    
    try {
      let mediaCount = 0
      
      // Process welcome page media - check both media and mediaReferences properties
      const welcomeMedia = courseContent.welcomePage?.media || courseContent.welcomePage?.mediaReferences || []
      if (welcomeMedia && Array.isArray(welcomeMedia) && welcomeMedia.length > 0) {
        console.log(`[MediaService] Processing ${welcomeMedia.length} media items from welcome page`)
        for (const mediaRef of welcomeMedia) {
          if (mediaRef && typeof mediaRef === 'object' && mediaRef.id) {
            // Extract the media type - could be in different places
            const mediaType = mediaRef.type || mediaRef.metadata?.type || 'image'
            const pageId = mediaRef.pageId || courseContent.welcomePage.id || 'welcome'
            
            const mediaItem: MediaItem = {
              id: mediaRef.id,
              type: mediaType as MediaType,
              pageId: pageId,
              fileName: mediaRef.fileName || mediaRef.metadata?.fileName || `${mediaRef.id}.${this.getExtension(mediaType as MediaType)}`,
              metadata: {
                ...(mediaRef.metadata || {}),
                type: mediaType,
                pageId: pageId,
                uploadedAt: mediaRef.metadata?.uploadedAt || mediaRef.uploadedAt || new Date().toISOString(),
                // Preserve YouTube-specific fields
                isYouTube: mediaRef.isYouTube || mediaRef.metadata?.isYouTube || false,
                youtubeUrl: mediaRef.url || mediaRef.youtubeUrl || mediaRef.metadata?.youtubeUrl,
                embedUrl: mediaRef.embedUrl || mediaRef.metadata?.embedUrl,
                title: mediaRef.title || mediaRef.metadata?.title
              }
            }
            
            // Also store the URL if it exists (for YouTube videos)
            if (mediaRef.url || mediaRef.embedUrl) {
              (mediaItem as any).url = mediaRef.url || mediaRef.embedUrl
            }
            
            this.mediaCache.set(mediaRef.id, mediaItem)
            mediaCount++
            console.log('[MediaService] Loaded welcome page media:', {
              id: mediaRef.id,
              type: mediaType,
              pageId: pageId,
              isYouTube: mediaItem.metadata.isYouTube
            })
          } else {
            console.warn('[MediaService] Skipping invalid media ref:', mediaRef)
          }
        }
      }
      
      // Process objectives page media - check both possible property names
      const objectivesPage = courseContent.learningObjectivesPage || courseContent.objectivesPage
      if (objectivesPage) {
        console.log('[MediaService] Objectives page structure:', {
          id: objectivesPage.id,
          hasMedia: 'media' in objectivesPage,
          mediaLength: objectivesPage.media?.length,
          mediaContent: objectivesPage.media?.slice(0, 2)
        })
      }
      
      const objectivesMedia = objectivesPage?.media || objectivesPage?.mediaReferences || []
      if (objectivesMedia && Array.isArray(objectivesMedia) && objectivesMedia.length > 0) {
        console.log(`[MediaService] Processing ${objectivesMedia.length} media items from objectives page`)
        for (const mediaRef of objectivesMedia) {
          if (mediaRef && typeof mediaRef === 'object' && mediaRef.id) {
            const mediaType = mediaRef.type || mediaRef.metadata?.type || 'image'
            const pageId = mediaRef.pageId || objectivesPage.id || 'objectives'
            
            const mediaItem: MediaItem = {
              id: mediaRef.id,
              type: mediaType as MediaType,
              pageId: pageId,
              fileName: mediaRef.fileName || mediaRef.metadata?.fileName || `${mediaRef.id}.${this.getExtension(mediaType as MediaType)}`,
              metadata: {
                ...(mediaRef.metadata || {}),
                type: mediaType,
                pageId: pageId,
                uploadedAt: mediaRef.metadata?.uploadedAt || mediaRef.uploadedAt || new Date().toISOString(),
                isYouTube: mediaRef.isYouTube || mediaRef.metadata?.isYouTube || false,
                youtubeUrl: mediaRef.url || mediaRef.youtubeUrl || mediaRef.metadata?.youtubeUrl,
                embedUrl: mediaRef.embedUrl || mediaRef.metadata?.embedUrl,
                title: mediaRef.title || mediaRef.metadata?.title
              }
            }
            
            if (mediaRef.url || mediaRef.embedUrl) {
              (mediaItem as any).url = mediaRef.url || mediaRef.embedUrl
            }
            
            this.mediaCache.set(mediaRef.id, mediaItem)
            mediaCount++
            console.log('[MediaService] Loaded objectives page media:', {
              id: mediaRef.id,
              type: mediaType,
              pageId: pageId,
              isYouTube: mediaItem.metadata.isYouTube
            })
          } else {
            console.warn('[MediaService] Skipping invalid objectives media ref:', mediaRef)
          }
        }
      }
      
      // Process topics media
      if (courseContent.topics && Array.isArray(courseContent.topics)) {
        // Log first topic structure for debugging
        if (courseContent.topics[0]) {
          console.log('[MediaService] First topic structure:', {
            id: courseContent.topics[0].id,
            hasMedia: 'media' in courseContent.topics[0],
            mediaLength: courseContent.topics[0].media?.length,
            mediaContent: courseContent.topics[0].media?.slice(0, 2)
          })
        }
        
        for (const topic of courseContent.topics) {
          const topicMedia = topic?.media || topic?.mediaReferences || []
          if (topicMedia && Array.isArray(topicMedia) && topicMedia.length > 0) {
            console.log(`[MediaService] Processing ${topicMedia.length} media items from topic ${topic.id}`)
            for (const mediaRef of topicMedia) {
              if (mediaRef && typeof mediaRef === 'object' && mediaRef.id) {
                const mediaType = mediaRef.type || mediaRef.metadata?.type || 'image'
                const pageId = mediaRef.pageId || topic.id
                
                const mediaItem: MediaItem = {
                  id: mediaRef.id,
                  type: mediaType as MediaType,
                  pageId: pageId,
                  fileName: mediaRef.fileName || mediaRef.metadata?.fileName || `${mediaRef.id}.${this.getExtension(mediaType as MediaType)}`,
                  metadata: {
                    ...(mediaRef.metadata || {}),
                    type: mediaType,
                    pageId: pageId,
                    uploadedAt: mediaRef.metadata?.uploadedAt || mediaRef.uploadedAt || new Date().toISOString(),
                    isYouTube: mediaRef.isYouTube || mediaRef.metadata?.isYouTube || false,
                    youtubeUrl: mediaRef.url || mediaRef.youtubeUrl || mediaRef.metadata?.youtubeUrl,
                    embedUrl: mediaRef.embedUrl || mediaRef.metadata?.embedUrl,
                    title: mediaRef.title || mediaRef.metadata?.title
                  }
                }
                
                if (mediaRef.url || mediaRef.embedUrl) {
                  (mediaItem as any).url = mediaRef.url || mediaRef.embedUrl
                }
                
                this.mediaCache.set(mediaRef.id, mediaItem)
                mediaCount++
                console.log('[MediaService] Loaded topic media:', {
                  id: mediaRef.id,
                  type: mediaType,
                  pageId: pageId,
                  topicId: topic.id,
                  isYouTube: mediaItem.metadata.isYouTube
                })
              } else {
                console.warn('[MediaService] Skipping invalid topic media ref:', mediaRef)
              }
            }
          }
        }
      }
      
      debugLogger.info('MediaService.loadMediaFromCourseContent', 'Course content media loaded', {
        totalItems: mediaCount,
        cacheSize: this.mediaCache.size
      })
      
      logger.info('[MediaService] Loaded media from course content:', mediaCount, 'items into cache')
    } catch (error) {
      debugLogger.error('MediaService.loadMediaFromCourseContent', 'Failed to load media from course content', error)
      logger.error('[MediaService] Failed to load media from course content:', error)
      throw error
    }
  }
  
  private getExtension(type: MediaType, mimeType?: string): string {
    // Check MIME type first for more accurate extension
    if (mimeType) {
      const mimeToExt: Record<string, string> = {
        'image/svg+xml': 'svg',
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'text/vtt': 'vtt'
      }
      const ext = mimeToExt[mimeType]
      if (ext) return ext
    }
    
    // Fallback to type-based extension
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