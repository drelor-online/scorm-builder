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
  mime_type?: string
  originalName?: string
  pageId: string
  type: MediaType
  source?: string
  isYouTube?: boolean
  clipStart?: number  // YouTube clip start time in seconds
  clipEnd?: number    // YouTube clip end time in seconds
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
  private audioLoadingPromises: Map<string, Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null>> = new Map() // Deduplicate concurrent audio loads
  private mediaLoadingPromises: Map<string, Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null>> = new Map() // Deduplicate ALL media loads
  
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
    
    // 🚨 CONTAMINATION DETECTION: Check for incoming metadata contamination at storage time
    const hasYouTubeMetadata = !!(
      metadata?.source === 'youtube' ||
      metadata?.youtubeUrl ||
      metadata?.embedUrl ||
      metadata?.clipStart ||
      metadata?.clipEnd ||
      metadata?.isYouTube
    )
    
    if (hasYouTubeMetadata && type !== 'video' && type !== 'youtube') {
      console.error('🚨 [MediaService] CONTAMINATION AT STORAGE TIME!')
      console.error(`   Attempting to store ${type} with YouTube metadata`)
      console.error(`   Media ID: ${id}`)
      console.error(`   Page ID: ${pageId}`)
      console.error('   Contaminated metadata fields:')
      if (metadata?.source) console.error(`     source: ${metadata.source}`)
      if (metadata?.youtubeUrl) console.error(`     youtubeUrl: ${metadata.youtubeUrl}`)
      if (metadata?.embedUrl) console.error(`     embedUrl: ${metadata.embedUrl}`)
      if (metadata?.clipStart) console.error(`     clipStart: ${metadata.clipStart}`)
      if (metadata?.clipEnd) console.error(`     clipEnd: ${metadata.clipEnd}`)
      if (metadata?.isYouTube) console.error(`     isYouTube: ${metadata.isYouTube}`)
      
      // Add stack trace to identify the caller
      const stack = new Error().stack
      console.error('   📍 Storage call stack:', stack?.split('\n').slice(1, 6).join('\n     '))
      console.error('   🔧 This contamination should be prevented at the source!')
      
      // 🔧 ENHANCED PREVENTION: Auto-clean contaminated metadata to prevent storage
      console.warn('   🧹 Auto-cleaning contaminated metadata before storage...')
      const cleanedMetadata = { ...metadata }
      delete cleanedMetadata.source
      delete cleanedMetadata.youtubeUrl
      delete cleanedMetadata.embedUrl
      delete cleanedMetadata.clipStart
      delete cleanedMetadata.clipEnd
      delete cleanedMetadata.isYouTube
      
      console.log('   ✅ Cleaned metadata:', Object.keys(cleanedMetadata))
      metadata = cleanedMetadata
    }
    
    debugLogger.info('MediaService.storeMedia', 'Storing media', {
      mediaId: id,
      pageId,
      type,
      fileSize: file.size,
      fileName: (file as File).name || 'blob',
      mimeType: file.type,
      hasYouTubeMetadata,
      isContaminationAttempt: hasYouTubeMetadata && type !== 'video'
    })
    
    try {
      // Report initial progress
      if (progressCallback) {
        progressCallback({ loaded: 0, total: file.size, percent: 0 })
      }
      
      // Get filename with proper extension based on MIME type
      const fileName = file instanceof File ? file.name : `${id}.${this.getExtension(type, file.type)}`
      
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
   * Update existing media with new content and metadata
   * This replaces the existing media file while keeping the same ID
   * @param existingId - The ID of the media to update
   * @param file - New file/blob content
   * @param metadata - Updated metadata
   * @param progressCallback - Optional progress callback
   */
  async updateMedia(
    existingId: string,
    file: File | Blob,
    metadata?: Partial<MediaMetadata>,
    progressCallback?: ProgressCallback
  ): Promise<MediaItem> {
    debugLogger.info('MediaService.updateMedia', 'Updating media', {
      mediaId: existingId,
      fileSize: file.size,
      fileName: (file as File).name || 'blob',
      mimeType: file.type
    })
    
    try {
      // Get existing media to preserve type and pageId
      const existingMedia = this.mediaCache.get(existingId)
      if (!existingMedia) {
        throw new Error(`Media with ID ${existingId} not found`)
      }
      
      // Report initial progress
      progressCallback?.({
        loaded: 0,
        total: file.size,
        percent: 0
      })
      
      // Store/overwrite using FileStorage with the existing ID
      const fileName = (file as File).name || `${existingId}.${this.getExtension(existingMedia.type, file.type)}`
      
      // Use existing type and pageId, but allow metadata updates
      await this.fileStorage.storeMedia(existingId, file, existingMedia.type, {
        page_id: existingMedia.pageId,
        type: existingMedia.type,
        original_name: fileName,
        mime_type: file.type,
        size: file.size,
        ...metadata
      }, (progress) => {
        progressCallback?.({
          loaded: Math.round(file.size * progress.percent / 100),
          total: file.size,
          percent: progress.percent
        })
      })
      
      // Create updated media item with same ID
      const updatedMediaItem: MediaItem = {
        id: existingId, // Keep the same ID
        type: existingMedia.type,
        pageId: existingMedia.pageId,
        fileName,
        metadata: {
          ...existingMedia.metadata, // Preserve existing metadata
          size: file.size,
          mimeType: file.type,
          ...metadata // Apply any new metadata updates
        }
      }
      
      // Update cache
      this.mediaCache.set(existingId, updatedMediaItem)
      
      debugLogger.info('MediaService.updateMedia', 'Media updated successfully', {
        mediaId: existingId,
        fileName,
        fileSize: file.size
      })
      
      logger.info('[MediaService] Updated media in FILE SYSTEM:', existingId)
      
      return updatedMediaItem
    } catch (error) {
      debugLogger.error('MediaService.updateMedia', 'Failed to update media', {
        mediaId: existingId,
        error
      })
      logger.error('[MediaService] Failed to update media:', error)
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
      embedUrl,
      clipStart: metadata?.clipStart,
      clipEnd: metadata?.clipEnd
    })
    
    try {
      // Store YouTube metadata to file system
      await this.fileStorage.storeYouTubeVideo(id, youtubeUrl, {
        page_id: pageId,
        title: metadata?.title,
        thumbnail: metadata?.thumbnail,
        embed_url: embedUrl,  // Use the embedUrl parameter
        duration: metadata?.duration,  // Include video duration
        clip_start: metadata?.clipStart,  // Include clip start time
        clip_end: metadata?.clipEnd       // Include clip end time
      })
      
      debugLogger.info('MediaService.storeYouTubeVideo', 'YouTube video stored successfully', {
        mediaId: id,
        pageId
      })
      
      logger.info('[MediaService] Stored YouTube video to FILE SYSTEM:', id)
      
      // Update cache
      const safePageId = typeof pageId === 'string' ? pageId : ''
      const mediaItem: MediaItem = {
        id,
        type: 'youtube',
        pageId: safePageId,
        fileName: (typeof metadata?.title === 'string' ? metadata.title : '') || 'YouTube Video',
        metadata: {
          uploadedAt: new Date().toISOString(),
          type: 'youtube',
          pageId: safePageId,
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
   * Update YouTube video metadata (clip timing, title, etc.)
   */
  async updateYouTubeVideoMetadata(
    mediaId: string,
    updates: Partial<Pick<MediaMetadata, 'clipStart' | 'clipEnd' | 'title' | 'embedUrl'>>
  ): Promise<MediaItem> {
    console.log('🔍 [CLIP DEBUG] MediaService.updateYouTubeVideoMetadata called with:', {
      mediaId,
      updates,
      clipStart: updates.clipStart,
      clipEnd: updates.clipEnd,
      updatesType: typeof updates,
      clipStartType: typeof updates.clipStart,
      clipEndType: typeof updates.clipEnd
    })
    
    debugLogger.info('MediaService.updateYouTubeVideoMetadata', 'Updating YouTube video metadata', {
      mediaId,
      updates
    })
    
    try {
      // Get existing media to validate it exists and is a YouTube video
      const existingMedia = this.mediaCache.get(mediaId)
      if (!existingMedia) {
        throw new Error(`Media with ID ${mediaId} not found`)
      }
      
      if (!existingMedia.metadata.isYouTube) {
        throw new Error(`Media ${mediaId} is not a YouTube video`)
      }
      
      // 🔒 CONTAMINATION PREVENTION: Additional validation
      if (existingMedia.type !== 'video' && existingMedia.type !== 'youtube') {
        throw new Error(`Cannot update YouTube metadata for media type '${existingMedia.type}'. Only 'video' and 'youtube' types are allowed.`)
      }
      
      console.log('🔒 [VALIDATION] YouTube metadata update validated:', {
        mediaId,
        mediaType: existingMedia.type,
        isYouTube: existingMedia.metadata.isYouTube,
        pageId: existingMedia.pageId
      })
      
      // Prepare updated metadata
      const updatedMetadata = {
        ...existingMedia.metadata,
        ...updates
      }
      
      // Update the metadata in file storage
      const metadataToStore = {
        page_id: updatedMetadata.pageId,
        title: updatedMetadata.title,
        thumbnail: updatedMetadata.thumbnail,
        embed_url: updatedMetadata.embedUrl,
        duration: updatedMetadata.duration,
        clip_start: updatedMetadata.clipStart,
        clip_end: updatedMetadata.clipEnd
      }
      
      console.log('🔍 [CLIP DEBUG] About to call storeYouTubeVideo with metadata:', {
        mediaId,
        youtubeUrl: updatedMetadata.youtubeUrl,
        metadataToStore,
        clipStart: metadataToStore.clip_start,
        clipEnd: metadataToStore.clip_end,
        clipStartType: typeof metadataToStore.clip_start,
        clipEndType: typeof metadataToStore.clip_end
      })
      
      await this.fileStorage.storeYouTubeVideo(mediaId, updatedMetadata.youtubeUrl!, metadataToStore)
      
      // Update cache with additional contamination prevention
      const updatedItem: MediaItem = {
        ...existingMedia,
        metadata: updatedMetadata
      }
      
      // 🔒 CONTAMINATION PREVENTION: Verify we're only updating the intended item
      const beforeCacheSize = this.mediaCache.size
      this.mediaCache.set(mediaId, updatedItem)
      const afterCacheSize = this.mediaCache.size
      
      if (beforeCacheSize !== afterCacheSize) {
        console.warn('🚨 [CACHE WARNING] Cache size changed during YouTube metadata update! This should not happen.')
      }
      
      console.log('🔍 [CACHE DEBUG] MediaService.updateYouTubeVideoMetadata - Cache updated for:', {
        mediaId,
        itemType: updatedItem.type,
        hasYouTubeMetadata: !!(updatedItem.metadata?.isYouTube || updatedItem.metadata?.source === 'youtube'),
        clipStart: updatedItem.metadata?.clipStart,
        clipEnd: updatedItem.metadata?.clipEnd,
        cacheSize: afterCacheSize
      })
      
      debugLogger.info('MediaService.updateYouTubeVideoMetadata', 'YouTube video metadata updated successfully', {
        mediaId,
        clipStart: updatedMetadata.clipStart,
        clipEnd: updatedMetadata.clipEnd
      })
      
      return updatedItem
    } catch (error) {
      debugLogger.error('MediaService.updateYouTubeVideoMetadata', 'Failed to update YouTube video metadata', {
        mediaId,
        error
      })
      throw error
    }
  }
  
  // 🚀 EFFICIENCY FIX: Add batch-aware media loading to prevent "loading all audio again" 
  private pendingBatchRequests = new Map<string, Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null>>()
  private batchRequestTimer: NodeJS.Timeout | null = null
  private batchResolvers = new Map<string, { resolve: Function, reject: Function }>()

  /**
   * Get media from file system with automatic batching optimization
   * Includes persistent caching for audio files to prevent reloading
   * 🚀 NEW: Automatically batches concurrent requests to reduce backend calls
   */
  async getMedia(mediaId: string): Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null> {
    debugLogger.debug('MediaService.getMedia', 'Getting media with batch optimization', { mediaId })
    
    // Enhanced debug logging to track caller context
    const stack = new Error().stack
    const caller = stack?.split('\n')[2]?.trim() || 'unknown'
    console.log(`🔍 [MediaService] getMedia called for ${mediaId} from: ${caller}`)
    
    // Check if we're already loading this media (deduplication)
    const existingPromise = this.mediaLoadingPromises.get(mediaId)
    if (existingPromise) {
      console.log(`[MediaService] 🔄 Deduplicating concurrent request for ${mediaId}`)
      return existingPromise
    }
    
    // 🚀 BATCH OPTIMIZATION: Check if this request can be batched
    const batchedPromise = this.pendingBatchRequests.get(mediaId)
    if (batchedPromise) {
      console.log(`[MediaService] ⚡ Using batched request for ${mediaId}`)
      return batchedPromise
    }
    
    // Add to pending batch and set up batch timer
    const mediaPromise = new Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null>((resolve, reject) => {
      // Store the resolver for this media ID
      this.addToBatch(mediaId, resolve, reject)
    })
    
    this.pendingBatchRequests.set(mediaId, mediaPromise)
    this.mediaLoadingPromises.set(mediaId, mediaPromise)
    
    // Clean up when done
    mediaPromise.finally(() => {
      this.pendingBatchRequests.delete(mediaId)
      this.mediaLoadingPromises.delete(mediaId)
    })
    
    return mediaPromise
  }

  // 🚀 BATCH PROCESSING: Collect requests and process in batches
  private addToBatch(mediaId: string, resolve: Function, reject: Function) {
    this.batchResolvers.set(mediaId, { resolve, reject })
    
    // Set up batch processing timer with adaptive timeout based on batch size
    if (this.batchRequestTimer) {
      clearTimeout(this.batchRequestTimer)
    }
    
    // 🚀 STARTUP OPTIMIZATION: Use longer timeout for larger batches (startup scenario)
    const currentBatchSize = this.batchResolvers.size
    const adaptiveTimeout = this.calculateBatchTimeout(currentBatchSize)
    
    console.log(`[MediaService] 📊 Batch size: ${currentBatchSize}, timeout: ${adaptiveTimeout}ms`)
    this.batchRequestTimer = setTimeout(() => this.processBatch(), adaptiveTimeout)
  }
  
  // 🚀 STARTUP OPTIMIZATION: Calculate optimal batch timeout based on request volume
  private calculateBatchTimeout(batchSize: number): number {
    if (batchSize >= 20) {
      // Startup scenario - use longer timeout to collect more requests
      console.log('[MediaService] 🚀 STARTUP DETECTED: Using extended batch timeout')
      return 100 // 100ms for startup batching
    } else if (batchSize >= 10) {
      // Medium batch - moderate timeout
      return 50 // 50ms for medium batches
    } else {
      // Small batch - quick timeout
      return 10 // 10ms for small batches (original behavior)
    }
  }
  
  // 🚀 PRODUCTION FIX: Robust Tauri environment detection
  private async detectTauriEnvironment(): Promise<boolean> {
    try {
      // Check if we're in Tauri environment by trying to import and use invoke
      const { invoke } = await import('@tauri-apps/api/core')
      
      // Test if invoke actually works by calling a simple command
      await invoke('get_cli_args')
      
      console.log('[MediaService] ✅ Tauri environment detected and working')
      return true
    } catch (error) {
      console.log('[MediaService] ❌ Tauri environment not available:', (error as Error).message)
      return false
    }
  }

  private async processBatch() {
    const batchIds = Array.from(this.batchResolvers.keys())
    if (batchIds.length === 0) return
    
    console.log(`[MediaService] 🚀 Processing batch of ${batchIds.length} media requests:`, batchIds)
    
    try {
      // 🚀 PRODUCTION FIX: Better Tauri environment detection
      const isTauriEnvironment = await this.detectTauriEnvironment()
      
      if (isTauriEnvironment) {
        console.log(`[MediaService] ✅ Using Tauri batch operations for ${batchIds.length} items`)
        await this.processBatchWithTauri(batchIds)
      } else {
        console.log(`[MediaService] ⚠️ Tauri not available, falling back to individual processing for ${batchIds.length} items`)
        // Fallback to individual processing for testing/browser-only environments
        await this.processBatchFallback(batchIds)
      }
    } catch (error) {
      console.error('[MediaService] Batch processing failed:', error)
      // Reject all pending requests
      for (const [mediaId, { reject }] of this.batchResolvers) {
        reject(error)
      }
    } finally {
      this.batchResolvers.clear()
      this.batchRequestTimer = null
    }
  }
  
  private async processBatchWithTauri(batchIds: string[]) {
    const { invoke } = await import('@tauri-apps/api/core')
    
    try {
      // Use exists check first for ultra-fast filtering
      const existenceFlags = await invoke<boolean[]>('media_exists_batch', {
        projectId: this.projectId,
        mediaIds: batchIds
      })
      
      const existingIds = batchIds.filter((_, index) => existenceFlags[index])
      const missingIds = batchIds.filter((_, index) => !existenceFlags[index])
      
      console.log(`[MediaService] ⚡ BATCH EXISTS CHECK: ${existingIds.length} exist, ${missingIds.length} missing`)
      
      // Resolve missing media as null immediately
      for (const missingId of missingIds) {
        const resolver = this.batchResolvers.get(missingId)
        if (resolver) {
          console.log(`[MediaService] ❌ Media not found: ${missingId}`)
          resolver.resolve(null)
          this.batchResolvers.delete(missingId)
        }
      }
      
      if (existingIds.length === 0) return
      
      // Load existing media in batch
      const mediaDataArray = await invoke<any[]>('get_media_batch', {
        projectId: this.projectId,
        mediaIds: existingIds
      })
      
      console.log(`[MediaService] 🚀 BATCH LOADED: ${mediaDataArray.length} media items successfully`)
      
      // Process and resolve each media item
      for (const mediaData of mediaDataArray) {
        const resolver = this.batchResolvers.get(mediaData.id)
        if (resolver) {
          const result = await this.processBatchMediaItem(mediaData)
          resolver.resolve(result)
          this.batchResolvers.delete(mediaData.id)
        }
      }
      
    } catch (error) {
      console.error('[MediaService] Tauri batch processing failed:', error)
      // Fall back to individual processing
      await this.processBatchFallback(batchIds)
    }
  }
  
  private async processBatchFallback(batchIds: string[]) {
    console.log(`[MediaService] 🔄 Falling back to individual processing for ${batchIds.length} items`)
    
    for (const mediaId of batchIds) {
      const resolver = this.batchResolvers.get(mediaId)
      if (resolver) {
        try {
          const result = await this.getMediaInternal(mediaId)
          resolver.resolve(result)
        } catch (error) {
          resolver.reject(error)
        }
        this.batchResolvers.delete(mediaId)
      }
    }
  }
  
  private async processBatchMediaItem(mediaData: any): Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null> {
    if (!mediaData) return null
    
    // Convert Rust media data to MediaService format
    const processedMetadata = this.processMetadata({
      metadata: mediaData.metadata,
      data: new Uint8Array(mediaData.data),
      mediaType: mediaData.metadata.type || mediaData.metadata.media_type
    })
    
    // Store in audio cache if it's audio
    if (mediaData.id?.startsWith('audio-') || mediaData.id?.includes('audio')) {
      this.audioDataCache.set(mediaData.id, {
        data: new Uint8Array(mediaData.data),
        metadata: processedMetadata
      })
      console.log(`[MediaService] ⚡ BATCH: Cached audio data for ${mediaData.id}`)
    }
    
    return {
      data: new Uint8Array(mediaData.data),
      metadata: processedMetadata,
      url: undefined // Will be created by UnifiedMediaContext
    }
  }
  
  /**
   * Internal method that does the actual media loading (without deduplication)
   */
  private async getMediaInternal(mediaId: string): Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null> {
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
      
      // 🔧 FIX: Use processMetadata to ensure consistent field name conversion
      const processedMetadata = this.processMetadata(mediaInfo)
      
      // 🔍 DEBUG: Log clip timing conversion for YouTube videos with actual values
      if (processedMetadata.isYouTube || processedMetadata.source === 'youtube') {
        const debugInfo = {
          rawClipStart: mediaInfo.metadata?.clip_start,
          rawClipEnd: mediaInfo.metadata?.clip_end,
          camelClipStart: mediaInfo.metadata?.clipStart,
          camelClipEnd: mediaInfo.metadata?.clipEnd,
          processedClipStart: processedMetadata.clipStart,
          processedClipEnd: processedMetadata.clipEnd,
          conversionSource: processedMetadata.clipStart !== undefined || processedMetadata.clipEnd !== undefined 
            ? (mediaInfo.metadata?.clipStart !== undefined ? 'camelCase' : 'snake_case')
            : 'none'
        }
        console.log(`[MediaService] 🎬 YouTube clip timing conversion for ${mediaId}:`)
        console.log('  Raw clip_start (snake):', debugInfo.rawClipStart)
        console.log('  Raw clip_end (snake):', debugInfo.rawClipEnd)
        console.log('  Raw clipStart (camel):', debugInfo.camelClipStart)
        console.log('  Raw clipEnd (camel):', debugInfo.camelClipEnd)
        console.log('  Processed clipStart:', debugInfo.processedClipStart)
        console.log('  Processed clipEnd:', debugInfo.processedClipEnd)
        console.log('  Conversion source:', debugInfo.conversionSource)
      }
      
      // 🔧 FIX: Always apply field conversion, even for cached items to ensure clip timing is converted
      const metadata: MediaMetadata = {
        ...processedMetadata,
        // Preserve cached values that shouldn't change (like uploadedAt)
        ...(cachedItem?.metadata || {}),
        // But always override with freshly converted values for critical fields
        clipStart: processedMetadata.clipStart,
        clipEnd: processedMetadata.clipEnd,
        embedUrl: processedMetadata.embedUrl,
        pageId: processedMetadata.pageId,
        // Override with specific fields if needed
        uploadedAt: cachedItem?.metadata?.uploadedAt || processedMetadata.uploadedAt || new Date().toISOString(),
        type: processedMetadata.type || (mediaInfo.mediaType as MediaType),
        size: cachedItem?.metadata?.size || mediaInfo.data?.byteLength || 0
      }
      
      // 🔧 FIX: Update cache with converted metadata, especially for YouTube videos with clip timing
      const shouldUpdateCache = !cachedItem || 
        (processedMetadata.isYouTube && (processedMetadata.clipStart !== undefined || processedMetadata.clipEnd !== undefined))
      
      if (shouldUpdateCache) {
        console.log(`[MediaService] 🔄 Updating cache for ${mediaId}:`, {
          wasEmpty: !cachedItem,
          isYouTube: processedMetadata.isYouTube,
          hasClipTiming: !!(processedMetadata.clipStart !== undefined || processedMetadata.clipEnd !== undefined),
          clipStart: processedMetadata.clipStart,
          clipEnd: processedMetadata.clipEnd
        })
        
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
      
      // For YouTube videos, generate embed URL with clip timing if available
      if ((metadata.source === 'youtube' || metadata.isYouTube) && metadata.embedUrl) {
        let baseUrl = metadata.embedUrl
        
        // 🔧 FIX: Dynamically add clip timing parameters to YouTube embed URL
        if (metadata.clipStart !== undefined || metadata.clipEnd !== undefined) {
          const urlObj = new URL(baseUrl)
          
          // Add start parameter if clipStart exists
          if (metadata.clipStart !== undefined && metadata.clipStart !== null) {
            urlObj.searchParams.set('start', metadata.clipStart.toString())
          }
          
          // Add end parameter if clipEnd exists  
          if (metadata.clipEnd !== undefined && metadata.clipEnd !== null) {
            urlObj.searchParams.set('end', metadata.clipEnd.toString())
          }
          
          url = urlObj.toString()
          debugLogger.debug('MediaService.getMedia', 'Generated YouTube embed URL with clip timing', { 
            mediaId, 
            baseUrl, 
            finalUrl: url, 
            clipStart: metadata.clipStart, 
            clipEnd: metadata.clipEnd 
          })
          logger.info(`[MediaService] 🎬 Generated YouTube embed URL with clip timing for ${mediaId}:`, {
            baseUrl,
            finalUrl: url,
            clipStart: metadata.clipStart,
            clipEnd: metadata.clipEnd
          })
        } else {
          url = baseUrl
          debugLogger.debug('MediaService.getMedia', 'Using YouTube embed URL without clip timing', { mediaId, url })
          logger.info('[MediaService] Using YouTube embed URL (no clip timing):', url)
        }
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
        
        // Use BlobURLManager for proper lifecycle management
        url = blobUrlManager.getOrCreateUrl(mediaId, blob, {
          type: metadata.type,
          pageId: metadata.pageId,
          mimeType,
          size: blob.size
        })
        
        // Keep backward compatibility with simple cache
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
      
      console.log(`✅ [MediaService] getMedia SUCCESS for ${mediaId}:`, {
        hasData: !!result.data,
        hasMetadata: !!result.metadata,
        hasUrl: !!result.url,
        metadataType: result.metadata?.type
      })
      return result
    } catch (error) {
      debugLogger.error('MediaService.getMedia', 'Failed to get media', {
        mediaId,
        error
      })
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('[MediaService] Failed to get media from file system:', error)
      console.error(`❌ [MediaService] getMedia FAILED for ${mediaId}:`, errorMsg)
      console.log(`🔍 [MediaService] Full error object for ${mediaId}:`, error)
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
   * Clean contaminated media metadata by removing YouTube fields from non-video media
   */
  async cleanContaminatedMedia(): Promise<{ cleaned: string[], errors: string[] }> {
    const cleaned: string[] = []
    const errors: string[] = []
    
    try {
      // Get all media in the project
      const allMedia = await this.listAllMedia()
      console.log(`[MediaService] 🧹 Starting aggressive cleanup scan of ${allMedia.length} media items`)
      console.log(`[MediaService] 🔍 DEBUG: All media IDs:`, allMedia.map(m => m.id))
      console.log(`[MediaService] 🔍 DEBUG: Sample metadata:`, allMedia.length > 0 ? allMedia[0].metadata : 'No items')
      
      for (const mediaItem of allMedia) {
        // AGGRESSIVE CONTAMINATION DETECTION
        // Check for ALL possible YouTube-related contamination patterns
        // 🔧 FIX: Get RAW metadata directly from FileStorage to see true contamination
        let metadata = mediaItem.metadata as any
        
        try {
          // Get raw metadata from FileStorage to bypass MediaService processing
          const rawMediaData = await this.fileStorage.getMedia(mediaItem.id)
          if (rawMediaData) {
            console.log(`[MediaService] 🔍 RAW METADATA from FileStorage for ${mediaItem.id}:`, {
              fileStorageMetadata: rawMediaData.metadata,
              fileStorageKeys: Object.keys(rawMediaData.metadata || {}),
              processedMetadata: metadata,
              processedKeys: Object.keys(metadata)
            })
            // Use raw metadata for contamination detection
            metadata = rawMediaData.metadata || metadata
          }
        } catch (error) {
          console.warn(`[MediaService] ⚠️ Could not get raw metadata for ${mediaItem.id}, using processed:`, error)
        }
        
        // Build comprehensive list of YouTube contamination indicators
        const contaminationFields = [
          // Standard camelCase fields
          'source', 'youtubeUrl', 'embedUrl', 'clipStart', 'clipEnd', 'isYouTube',
          // Snake case variants (legacy data)
          'youtube_url', 'embed_url', 'clip_start', 'clip_end', 'is_youtube',
          // Mixed case variants that might slip through
          'youTubeUrl', 'embedURL', 'YouTubeUrl', 'YOUTUBE_URL',
          // Uppercase variants
          'CLIP_START', 'CLIP_END', 'EMBED_URL', 'IS_YOUTUBE'
        ]
        
        // Check each contamination field for debugging
        console.log(`[MediaService] 🔬 Scanning contamination fields for ${mediaItem.id}:`, 
          contaminationFields.filter(field => field in metadata))
        
        // 🔧 FIXED CONTAMINATION DETECTION
        // For non-video/non-YouTube media, the mere PRESENCE of YouTube fields indicates contamination
        // regardless of their values (empty strings, nulls, etc. are still contamination)
        const isLegitimateYouTubeVideo = mediaItem.type === 'video' || mediaItem.type === 'youtube'
        const hasYouTubeContamination = contaminationFields.some(field => {
          const value = metadata[field]
          const exists = field in metadata
          
          // Skip fields that don't exist
          if (!exists) return false
          
          // 🔧 CRITICAL FIX: Skip contamination detection for legitimate YouTube videos
          // YouTube videos are SUPPOSED to have these fields - they're not contamination!
          if (isLegitimateYouTubeVideo) {
            return false
          }
          
          // Special handling for source field - only 'youtube' source is contamination for source field
          if (field === 'source') {
            const isYouTubeSource = value === 'youtube'
            if (isYouTubeSource) console.log(`[MediaService] ✅ CONTAMINATION: YouTube source field on non-video media`)
            return isYouTubeSource
          }
          
          // 🔧 FIX: For YouTube-specific fields, existence on non-video media IS contamination
          // These fields should not exist on image files at all
          const youtubeSpecificFields = ['embed_url', 'youtube_url', 'embedUrl', 'youtubeUrl', 
                                         'clip_start', 'clip_end', 'clipStart', 'clipEnd']
          if (youtubeSpecificFields.includes(field)) {
            console.log(`[MediaService] ✅ CONTAMINATION: YouTube-specific field ${field} exists on non-video media`)
            return true
          }
          
          // For boolean fields, any truthy value is contamination
          if (field.toLowerCase().includes('youtube') && typeof value === 'boolean') {
            return value === true
          }
          
          // For URL fields, existence is contamination
          if (field.toLowerCase().includes('url') && field !== 'source') {
            return exists
          }
          
          // For numeric fields (clip timing), existence is contamination
          if (field.toLowerCase().includes('clip') || field.toLowerCase().includes('start') || field.toLowerCase().includes('end')) {
            return exists
          }
          
          // Any other truthy value is potential contamination
          return !!value
        })
        
        // CONTAMINATION SCOPE CHECK
        // Only clean non-video/non-YouTube media that has YouTube contamination
        const shouldClean = hasYouTubeContamination && !isLegitimateYouTubeVideo
        
        console.log(`[MediaService] 🔍 CLEANUP SCAN: ${mediaItem.id} (type: ${mediaItem.type})`, {
          hasYouTubeContamination,
          isLegitimateYouTubeVideo,
          shouldClean,
          contaminatedFields: contaminationFields.filter(field => !!metadata[field]),
          metadataKeys: Object.keys(metadata),
          metadataSourceValue: metadata.source,
          metadataEmbedUrl: metadata.embed_url,
          metadataClipStart: metadata.clip_start,
          metadataClipEnd: metadata.clip_end,
          sampleValues: {
            source: metadata.source,
            embed_url: metadata.embed_url, 
            clip_start: metadata.clip_start,
            clip_end: metadata.clip_end
          }
        })
        
        if (shouldClean) {
          console.log(`[MediaService] 🧹 AGGRESSIVE: Cleaning contaminated ${mediaItem.type}: ${mediaItem.id}`)
          console.log(`[MediaService] 🔍 Detected contamination fields:`, contaminationFields.filter(field => !!metadata[field]))
          
          try {
            // AGGRESSIVE CLEANUP - Remove ALL YouTube-related fields
            const cleanMetadata = { ...metadata }
            
            // Remove all contamination fields regardless of case/format
            contaminationFields.forEach(field => {
              if (cleanMetadata.hasOwnProperty(field)) {
                console.log(`[MediaService] 🗑️ Removing contaminated field: ${field} = ${cleanMetadata[field]}`)
                delete cleanMetadata[field]
              }
            })
            
            // Also check for any field that contains 'youtube' in the name (case-insensitive)
            Object.keys(cleanMetadata).forEach(key => {
              if (key.toLowerCase().includes('youtube') || 
                  key.toLowerCase().includes('embed') ||
                  key.toLowerCase().includes('clip')) {
                console.log(`[MediaService] 🗑️ Removing suspicious field: ${key} = ${cleanMetadata[key]}`)
                delete cleanMetadata[key]
              }
            })
            
            // Preserve essential metadata
            const essentialFields = {
              type: mediaItem.type,
              pageId: mediaItem.pageId,
              page_id: mediaItem.pageId, // Keep both formats for compatibility
              originalName: cleanMetadata.originalName,
              mimeType: cleanMetadata.mimeType,
              mime_type: cleanMetadata.mime_type,
              uploadedAt: cleanMetadata.uploadedAt,
              uploaded_at: cleanMetadata.uploaded_at,
              duration: cleanMetadata.duration
            }
            
            // Merge essential fields back
            Object.keys(essentialFields).forEach(key => {
              const value = essentialFields[key as keyof typeof essentialFields]
              if (value !== undefined) {
                cleanMetadata[key] = value
              }
            })
            
            console.log(`[MediaService] 🧽 Clean metadata keys:`, Object.keys(cleanMetadata))
            
            // 🔧 CRITICAL FIX: Preserve original media data, only update metadata
            const existingMediaInfo = await this.fileStorage.getMedia(mediaItem.id)
            let mediaBlob: Blob
            
            if (existingMediaInfo?.data) {
              // Preserve original image data
              mediaBlob = new Blob([existingMediaInfo.data], { type: existingMediaInfo.mediaType || mediaItem.type })
              console.log(`[MediaService] ✅ Preserving original media data: ${existingMediaInfo.data.byteLength} bytes`)
            } else {
              // Fallback: get from cache or create empty blob (shouldn't happen for existing media)
              console.warn(`[MediaService] ⚠️ No existing data found for ${mediaItem.id}, using empty blob`)
              mediaBlob = new Blob([])
            }
            
            // Update the file storage with clean metadata BUT preserve data
            await this.fileStorage.storeMedia(mediaItem.id, mediaBlob, mediaItem.type, {
              page_id: mediaItem.pageId,
              ...cleanMetadata
            })
            
            // Update cache with clean metadata
            const cleanedItem = {
              ...mediaItem,
              metadata: cleanMetadata as MediaMetadata
            }
            this.mediaCache.set(mediaItem.id, cleanedItem)
            
            // 🔄 FORCE CACHE REFRESH: Invalidate any stale blob URLs
            blobUrlManager.revokeUrl(mediaItem.id)
            console.log(`[MediaService] 🔄 Revoked stale blob URL for cleaned media: ${mediaItem.id}`)
            
            cleaned.push(mediaItem.id)
            console.log(`[MediaService] ✅ AGGRESSIVELY cleaned contaminated media: ${mediaItem.id}`)
          } catch (error) {
            const errorMsg = `Failed to clean ${mediaItem.id}: ${error}`
            errors.push(errorMsg)
            console.error(`[MediaService] ❌ Error cleaning media:`, errorMsg)
          }
        }
      }
      
      console.log(`[MediaService] 🧹 AGGRESSIVE cleanup complete: ${cleaned.length} cleaned, ${errors.length} errors`)
      if (cleaned.length > 0) {
        console.log(`[MediaService] 🎯 Cleaned items:`, cleaned)
      }
      if (errors.length > 0) {
        console.log(`[MediaService] ❌ Cleanup errors:`, errors)
      }
      
      // Summary of all media processed
      console.log(`[MediaService] 📊 Cleanup summary: Processed ${allMedia.length} total media items`)
      const mediaByType = allMedia.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      console.log(`[MediaService] 📊 Media by type:`, mediaByType)
      
      return { cleaned, errors }
    } catch (error) {
      const errorMsg = `Failed to enumerate media for cleaning: ${error}`
      errors.push(errorMsg)
      console.error(`[MediaService] ❌ Error during cleanup:`, errorMsg)
      return { cleaned, errors }
    }
  }

  /**
   * Helper to process metadata consistently - converts snake_case to camelCase
   */
  private processMetadata(mediaInfo: any): MediaMetadata {
    const pageId = mediaInfo.metadata?.pageId || mediaInfo.metadata?.page_id || ''
    const actualMediaType = mediaInfo.mediaType || mediaInfo.metadata?.type || 'unknown'
    const source = mediaInfo.metadata?.source
    const hasYouTubeMetadata = !!(
      mediaInfo.metadata?.source === 'youtube' ||
      mediaInfo.metadata?.youtubeUrl ||
      mediaInfo.metadata?.embedUrl ||
      mediaInfo.metadata?.clipStart ||
      mediaInfo.metadata?.clip_start ||
      mediaInfo.metadata?.clipEnd ||
      mediaInfo.metadata?.clip_end
    )
    
    // 🚨 CONTAMINATION DETECTION: Check for metadata contamination
    if (hasYouTubeMetadata && actualMediaType !== 'video' && actualMediaType !== 'youtube') {
      console.warn('🚨 [MediaService] METADATA CONTAMINATION DETECTED!')
      console.warn(`   Media Type: ${actualMediaType} (should be 'video' for YouTube content)`)
      console.warn(`   Media ID: ${mediaInfo.id || 'unknown'}`)
      console.warn(`   Source: ${source}`)
      console.warn('   YouTube Metadata Fields Found:')
      if (mediaInfo.metadata?.youtubeUrl) {
        console.warn(`     youtubeUrl: ${mediaInfo.metadata.youtubeUrl}`)
      }
      if (mediaInfo.metadata?.embedUrl) {
        console.warn(`     embedUrl: ${mediaInfo.metadata.embedUrl}`)
      }
      if (mediaInfo.metadata?.clipStart || mediaInfo.metadata?.clip_start) {
        console.warn(`     clipStart: ${mediaInfo.metadata.clipStart || mediaInfo.metadata.clip_start}`)
      }
      if (mediaInfo.metadata?.clipEnd || mediaInfo.metadata?.clip_end) {
        console.warn(`     clipEnd: ${mediaInfo.metadata.clipEnd || mediaInfo.metadata.clip_end}`)
      }
      console.warn('   🔍 This contamination will cause UI rendering issues!')
      console.warn('   🔧 Root cause investigation needed in storage layer')
      
      // Add stack trace to help identify source of contamination
      const stack = new Error().stack
      console.warn('   📍 Call stack:', stack?.split('\n').slice(1, 5).join('\n     '))
    }
    
    // 🔍 ENHANCED LOGGING: Log all metadata processing for debugging
    if (actualMediaType === 'image' || actualMediaType === 'video') {
      console.log(`[MediaService] 📊 Processing metadata for ${actualMediaType}:`, {
        mediaId: mediaInfo.id,
        type: actualMediaType,
        source: source,
        hasYouTubeFields: hasYouTubeMetadata,
        isContaminated: hasYouTubeMetadata && actualMediaType !== 'video',
        metadataKeys: Object.keys(mediaInfo.metadata || {})
      })
    }
    
    return {
      type: actualMediaType,
      pageId: (typeof pageId === 'string' ? pageId : ''),
      mimeType: mediaInfo.metadata?.mimeType || mediaInfo.metadata?.mime_type,
      mime_type: mediaInfo.metadata?.mime_type,
      source: mediaInfo.metadata?.source,
      embedUrl: mediaInfo.metadata?.embedUrl || mediaInfo.metadata?.embed_url,
      isYouTube: mediaInfo.metadata?.source === 'youtube',
      youtubeUrl: mediaInfo.metadata?.youtubeUrl,
      title: mediaInfo.metadata?.title,
      uploadedAt: mediaInfo.metadata?.uploadedAt || new Date().toISOString(),
      // 🔧 FIX: Convert snake_case clip timing fields to camelCase
      clipStart: mediaInfo.metadata?.clipStart || mediaInfo.metadata?.clip_start,
      clipEnd: mediaInfo.metadata?.clipEnd || mediaInfo.metadata?.clip_end
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
      // Use getAllProjectMedia() which actually works, instead of listMedia() which doesn't exist
      const allMedia = await this.fileStorage.getAllProjectMedia()
      
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
      // Use getAllProjectMedia() which actually works, instead of listMedia() which doesn't exist
      const allMedia = await this.fileStorage.getAllProjectMedia()
      
      debugLogger.info('MediaService.deleteAllMedia', 'Found media items to delete', { 
        projectId, 
        count: allMedia.length 
      })
      
      // Delete each media item
      for (const media of allMedia) {
        const success = await this.deleteMedia(projectId, media.id)
        if (!success) {
          debugLogger.warn('MediaService.deleteAllMedia', 'Failed to delete media item', { 
            mediaId: media.id 
          })
        }
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
                // 🔍 CONTAMINATION DEBUG: Check if metadata has YouTube fields for non-YouTube media
                const hasYouTubeMetadata = !!(
                  mediaData.metadata?.source === 'youtube' ||
                  mediaData.metadata?.youtubeUrl ||
                  mediaData.metadata?.embedUrl ||
                  mediaData.metadata?.clipStart ||
                  mediaData.metadata?.clipEnd ||
                  mediaData.metadata?.isYouTube
                )
                
                if (hasYouTubeMetadata && (mediaData.type !== 'video' && mediaData.type !== 'youtube')) {
                  console.error('🔍 [CONTAMINATION SOURCE] Found contaminated metadata during project load:', {
                    mediaId: mediaData.id,
                    type: mediaData.type,
                    pageId: pageId,
                    contaminatedMetadata: mediaData.metadata,
                    youtubeFields: {
                      source: mediaData.metadata?.source,
                      isYouTube: mediaData.metadata?.isYouTube,
                      clipStart: mediaData.metadata?.clipStart,
                      clipEnd: mediaData.metadata?.clipEnd,
                      embedUrl: !!mediaData.metadata?.embedUrl
                    }
                  })
                }

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
    if (mimeType && mimeType.trim()) {
      const mimeToExt: Record<string, string> = {
        // Images
        'image/svg+xml': 'svg',
        'image/png': 'png', 
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/bmp': 'bmp',
        'image/tiff': 'tiff',
        // Audio
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
        'audio/aac': 'aac',
        'audio/m4a': 'm4a',
        // Video  
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/avi': 'avi',
        'video/mov': 'mov',
        'video/quicktime': 'mov',
        // Captions
        'text/vtt': 'vtt',
        'text/srt': 'srt',
        // Unknown MIME types should not default to bin if we know the MediaType
        'application/octet-stream': type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'bin'
      }
      const ext = mimeToExt[mimeType.toLowerCase()]
      if (ext) {
        console.log(`[MediaService] MIME type "${mimeType}" mapped to extension "${ext}"`)
        return ext
      }
      console.log(`[MediaService] Unknown MIME type "${mimeType}", falling back to MediaType-based extension`)
    }
    
    // Fallback to type-based extension (should avoid .bin for known types)
    switch (type) {
      case 'image': return 'jpg' // Default to jpg for images
      case 'video': return 'mp4' // Default to mp4 for videos
      case 'audio': return 'mp3' // Default to mp3 for audio
      case 'caption': return 'vtt' // Default to vtt for captions
      case 'youtube': return 'json' // YouTube metadata stored as JSON
      default: 
        console.warn(`[MediaService] Unknown MediaType "${type}", defaulting to .bin extension`)
        return 'bin'
    }
  }
}

// Export factory function for getting singleton instances
export function createMediaService(projectId: string, fileStorage?: FileStorage): MediaService {
  return MediaService.getInstance({ projectId, fileStorage })
}

// Export as default to replace the old MediaService
export default MediaService