/**
 * MediaService - File-based media management ONLY
 * 
 * This service wraps FileStorage to ensure ALL media is stored in the file system.
 * NO IndexedDB, NO memory storage - ONLY file-based storage through Tauri.
 */

import { FileStorage } from './FileStorage'
import { generateMediaId, type MediaType, type MediaId } from '../utils/idGenerator'
import { logger } from '../utils/logger'

// 🔧 FIX 5: ULTIMATE CIRCUIT BREAKER - Global flag declaration
declare global {
  var _scormBuilderVisualOnlyMode: boolean | undefined
}
import { debugLogger } from '@/utils/ultraSimpleLogger'
import { blobUrlManager } from '../utils/blobUrlManager'

// 🎯 CONTEXT-AWARE CACHE: Operation types for intelligent TTL selection
export type ListAllOperation = 'ui' | 'gen' | 'bg'

const shouldLogMediaServiceDebug = import.meta.env.DEV || import.meta.env.VITE_DEBUG_LOGS === 'true';
const mediaServiceDebugLog = (...args: unknown[]) => {
  if (shouldLogMediaServiceDebug) {
    console.log(...args);
  }
};

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
  generationMode?: boolean   // 🚀 PHASE 3: Enable optimized batching for SCORM generation
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

// 🚀 PHASE 3: Request Queue Types (moved outside class for TypeScript compatibility)
enum RequestPriority {
  HIGH = 3,    // Current page thumbnails
  MEDIUM = 2,  // Visible page thumbnails
  LOW = 1      // Off-screen thumbnails
}

interface QueuedRequest {
  mediaId: string
  priority: RequestPriority
  pageId?: string
  isVisible?: boolean
  isCurrent?: boolean
  timestamp: number
  cancellationToken: { cancelled: boolean }
  resolver: { resolve: (value: any) => void, reject: (reason?: any) => void }
}

// 🏗️ TYPE SAFETY: Extended MediaService interface for proper typing
export interface MediaServiceExtended {
  // Core methods
  getCacheSize(): number
  loadMediaFromDisk(): Promise<void>
  clearListAllMediaCaches(): void
  clearAudioCache(): void
  getCacheMetrics(): { hits: number; misses: number; evictions: number; timeouts: number; errors: number; hitRatio: number; memoryUsageMB: number }

  // Standard MediaService methods
  storeMedia(file: File | Blob, pageId: string, type: MediaType, metadata?: Partial<MediaMetadata>, progressCallback?: ProgressCallback): Promise<MediaItem>
  updateMedia(existingId: string, file: File | Blob, metadata?: Partial<MediaMetadata>, progressCallback?: ProgressCallback): Promise<MediaItem>
  deleteMedia(projectId: string, mediaId: string): Promise<boolean>
  listAllMedia(options?: { excludeTypes?: string[]; op?: ListAllOperation }): Promise<MediaItem[]>
  getMedia(mediaId: string): Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null>
}

export class MediaService implements MediaServiceExtended {
  public readonly projectId: string
  private fileStorage: FileStorage
  private mediaCache: Map<string, MediaItem> = new Map()
  private blobUrlCache: Map<string, string> = new Map() // Cache blob URLs for the session
  private loadingPromise: Promise<void> | null = null // For deduplicating concurrent loads
  private audioDataCache: Map<string, { data: Uint8Array; metadata: MediaMetadata }> = new Map() // Persistent audio cache
  private audioLoadingPromises: Map<string, Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null>> = new Map() // Deduplicate concurrent audio loads
  private mediaLoadingPromises: Map<string, Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null>> = new Map() // Deduplicate ALL media loads

  // 📊 PERFORMANCE: Cache listAllMedia results to prevent redundant backend calls
  private listAllMediaCache: Map<string, { result: MediaItem[]; timestamp: number }> = new Map()
  private listAllMediaPromises: Map<string, Promise<MediaItem[]>> = new Map() // Deduplicate concurrent listAllMedia calls

  // 🎯 CONTEXT-AWARE CACHE TTL: Different TTL for different operation types
  private static readonly TTL_BY_OPERATION = {
    ui: 10000,      // UI navigation: 10 seconds
    gen: 0,         // SCORM generation: bypass cache (always fresh)
    bg: 30000       // Background operations: 30 seconds
  } as const

  // 🔒 MEMORY MANAGEMENT: LRU cache bounds to prevent memory leaks
  private static readonly MAX_CACHE_ENTRIES = 16    // Max entries per project
  private static readonly MAX_CACHE_SIZE_MB = 20    // Max ~20MB of cached metadata
  private cacheMemoryUsage = 0  // Track approximate memory usage in bytes

  // 📊 MONITORING: Cache performance metrics
  private cacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    timeouts: 0,
    errors: 0
  }

  // 🚀 PHASE 3: Generation mode for optimized batching (made mutable for singleton updates)
  private isGenerationMode: boolean

  // 🔍 DIAGNOSTIC: Track request timing patterns
  private lastRequestTime: number = 0

  // Error recovery properties
  private failedMediaList: Array<{
    id: string
    originalName: string
    pageId: string
    error: string
    timestamp: string
  }> = []
  
  private constructor(config: MediaServiceConfig) {
    // VERSION MARKER: v2.0.5 - MediaService with forced URL generation and fallbacks
    // Project ID should already be extracted by getInstance
    this.projectId = config.projectId
    // Use provided FileStorage or create new one
    this.fileStorage = config.fileStorage || FileStorage.getInstance()

    // 🚀 PHASE 3: Initialize generation mode for optimized batching
    this.isGenerationMode = config.generationMode || false

    debugLogger.info('MediaService.constructor v2.0.5', 'Initialized MediaService', {
      projectId: this.projectId,
      storageType: 'FILE_STORAGE_ONLY',
      sharedInstance: !!config.fileStorage,
      generationMode: this.isGenerationMode,
      version: 'v2.0.5'
    })
    mediaServiceDebugLog('[MediaService v2.0.5] Initialized with project ID:', this.projectId)

    // 🚀 CRITICAL DIAGNOSTIC: Log instance creation with generation mode
    console.log(`[MediaService] instance`, { projectId: this.projectId, gen: this.isGenerationMode })

    logger.info('[MediaService] Initialized for project:', this.projectId, 'using FILE STORAGE ONLY',
      config.fileStorage ? '(shared instance)' : '(new instance)')
  }

  /**
   * Update generation mode on existing instance (for singleton pattern)
   * This enables generation mode to be activated even if the instance was created without it
   */
  setGenerationMode(enabled: boolean): void {
    const previousMode = this.isGenerationMode
    this.isGenerationMode = enabled

    if (previousMode !== enabled) {
      console.log(`[MediaService] Generation mode ${enabled ? 'ENABLED' : 'DISABLED'} for project ${this.projectId}`)
      debugLogger.info('MediaService.setGenerationMode', 'Generation mode updated', {
        projectId: this.projectId,
        previousMode,
        newMode: enabled
      })
    }
  }
  
  // Static factory method to get singleton instance per project
  static getInstance(config: MediaServiceConfig): MediaService {
    // Extract the numeric project ID for consistent caching
    const extractedId = MediaService.extractNumericProjectId(config.projectId)
    
    const existing = mediaServiceInstances.get(extractedId)
    if (existing) {
      // 🚀 CRITICAL FIX: Enable generation mode on existing instance if requested
      if (config.generationMode) {
        existing.setGenerationMode(true)
      }

      console.log(`[MediaService] Returning existing singleton instance for project ${extractedId}, generation mode: ${existing.isGenerationMode}`)
      debugLogger.debug('MediaService.getInstance', 'Returning existing instance', {
        originalProjectId: config.projectId,
        extractedId: extractedId,
        generationModeRequested: config.generationMode,
        currentGenerationMode: existing.isGenerationMode
      })
      return existing
    }
    
    mediaServiceDebugLog(`🔧 [MediaService] FIX 3: Creating NEW singleton instance for project ${extractedId}`)
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
    // 🔧 FIX: Generate unique ID by checking for existing media
    const id = await this.generateUniqueMediaId(type, pageId)
    
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
      
      mediaServiceDebugLog('   ✅ Cleaned metadata:', Object.keys(cleanedMetadata))
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

      // ✅ CACHE INVALIDATION: Clear caches after write operation
      this.clearListAllMediaCaches()

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

      // ✅ CACHE INVALIDATION: Clear caches after write operation
      this.clearListAllMediaCaches()

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
   * Generate a unique media ID by checking for existing media
   * Prevents duplicate IDs when storing multiple media items of the same type on the same page
   */
  private async generateUniqueMediaId(type: MediaType, pageId: string): Promise<MediaId> {
    // Start with the base ID from the original generator
    const baseId = generateMediaId(type, pageId)

    try {
      // Check if the base ID already exists
      const existingMedia = await this.fileStorage.doesMediaExist(baseId)

      if (!existingMedia) {
        // Base ID is available
        mediaServiceDebugLog(`[MediaService] Using base ID: ${baseId}`)
        return baseId as MediaId
      }

      // Base ID exists, find the next available suffix
      let counter = 1
      let candidateId: string

      do {
        candidateId = `${baseId}-${counter}`
        const exists = await this.fileStorage.doesMediaExist(candidateId)

        if (!exists) {
          mediaServiceDebugLog(`[MediaService] Generated unique ID: ${candidateId} (base: ${baseId}, suffix: ${counter})`)
          return candidateId as MediaId
        }

        counter++

        // Safety limit to prevent infinite loops
        if (counter > 1000) {
          console.error(`[MediaService] ERROR: Could not generate unique ID after 1000 attempts for base: ${baseId}`)
          // Fall back to UUID-based ID
          const uuid = crypto.randomUUID().slice(0, 8)
          const fallbackId = `${type}-${uuid}`
          console.log(`[MediaService] Using fallback UUID-based ID: ${fallbackId}`)
          return fallbackId as MediaId
        }
      } while (true)

    } catch (error) {
      console.warn(`[MediaService] Error checking for existing media, falling back to base ID: ${baseId}`, error)
      return baseId as MediaId
    }
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

      // ✅ CACHE INVALIDATION: Clear caches after write operation
      this.clearListAllMediaCaches()

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
    mediaServiceDebugLog('🔍 [CLIP DEBUG] MediaService.updateYouTubeVideoMetadata called with:', {
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
      
      mediaServiceDebugLog('🔒 [VALIDATION] YouTube metadata update validated:', {
        mediaId,
        mediaType: existingMedia.type,
        isYouTube: existingMedia.metadata.isYouTube,
        pageId: existingMedia.pageId
      })
      
      // 🔧 FIX: Normalize clip timing values before storing
      const normalizedClipStart = this.normalizeClipTiming(updates.clipStart)
      const normalizedClipEnd = this.normalizeClipTiming(updates.clipEnd)

      // Prepare updated metadata with normalized values
      const updatedMetadata = {
        ...existingMedia.metadata,
        ...updates,
        clipStart: normalizedClipStart,
        clipEnd: normalizedClipEnd
      }

      const metadataToStore = {
        page_id: updatedMetadata.pageId,
        title: updatedMetadata.title,
        thumbnail: updatedMetadata.thumbnail,
        embed_url: updatedMetadata.embedUrl,
        duration: updatedMetadata.duration,
        clip_start: normalizedClipStart,
        clip_end: normalizedClipEnd
      }
      
      mediaServiceDebugLog('🔍 [CLIP DEBUG] About to call storeYouTubeVideo with metadata:', {
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
      
      mediaServiceDebugLog('🔍 [CACHE DEBUG] MediaService.updateYouTubeVideoMetadata - Cache updated for:', {
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
  private batchResolvers = new Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>()
  // 🔧 FIX: Promise tracking to prevent deduplication deadlocks
  private promiseTracker = new Map<string, { promise: Promise<any>, createdAt: number, resolved: boolean }>()

  // 🚀 PHASE 3: Request Queue with Prioritization and Cancellation
  private requestQueue: QueuedRequest[] = []
  private queueProcessingTimer: NodeJS.Timeout | null = null
  private maxConcurrentRequests = 3
  private activeRequests = new Set<string>()

  // 🚀 PHASE 5: Backend Call Optimization
  private projectExistenceCache = new Map<string, boolean>() // Cache media existence checks
  private batchCoalescingTimer: NodeJS.Timeout | null = null
  private pendingCoalescedRequests = new Set<string>() // Track requests being coalesced
  private lastBatchProcessTime = 0
  private MIN_BATCH_INTERVAL = 300 // Minimum time between batch calls (300ms)

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
    mediaServiceDebugLog(`🔍 [MediaService] getMedia called for ${mediaId} from: ${caller}`)
    
    // 🔧 FIX 5: ULTIMATE CIRCUIT BREAKER - Global pattern-based blocking
    // This is a safety net to prevent audio/caption access regardless of calling context
    const isAudioOrCaption = mediaId.startsWith('audio-') || mediaId.startsWith('caption-')
    if (isAudioOrCaption) {
      // Check if we're in a context where visual-only loading should be enforced
      // Use a global flag or environment check to determine if blocking is needed
      const shouldBlock = globalThis._scormBuilderVisualOnlyMode || false
      if (shouldBlock) {
        mediaServiceDebugLog(`🚨 [MediaService] FIX 5: ULTIMATE CIRCUIT BREAKER - Blocking ${mediaId} (visual-only mode active)`)
        return null
      }
    }
    
    // 🔧 FIX: Enhanced deduplication with stale promise detection
    const existingPromise = this.mediaLoadingPromises.get(mediaId)
    if (existingPromise) {
      const tracker = this.promiseTracker.get(mediaId)
      const now = Date.now()

      // Check if promise is stale (older than 5 seconds and not resolved)
      if (tracker && (now - tracker.createdAt > 5000) && !tracker.resolved) {
        mediaServiceDebugLog(`[MediaService] ⚠️ STALE PROMISE DETECTED: ${mediaId} (${now - tracker.createdAt}ms old) - creating fresh request`)
        // Clean up stale promise
        this.mediaLoadingPromises.delete(mediaId)
        this.pendingBatchRequests.delete(mediaId)
        this.promiseTracker.delete(mediaId)
        // Continue to create fresh request below
      } else {
        mediaServiceDebugLog(`[MediaService] 🔄 Deduplicating concurrent request for ${mediaId}`)
        // 🔧 FIX: Return original promise directly to avoid timeout race conditions
        // The original promise should resolve properly when batch processing completes
        return existingPromise
      }
    }
    
    // 🚀 BATCH OPTIMIZATION: Check if this request can be batched
    const batchedPromise = this.pendingBatchRequests.get(mediaId)
    if (batchedPromise) {
      mediaServiceDebugLog(`[MediaService] ⚡ Using batched request for ${mediaId}`)
      return batchedPromise
    }
    
    // Add to pending batch and set up batch timer with deadlock prevention
    const mediaPromise = new Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null>((resolve, reject) => {
      // Store the resolver for this media ID
      this.addToBatch(mediaId, resolve, reject)

      // 🚀 PHASE 3: Enhanced timeout handling with generation mode support
      let timeoutMs: number
      if (this.isGenerationMode) {
        // In generation mode, use much longer timeouts for stability
        if (mediaId.startsWith('caption-')) {
          timeoutMs = 60000 // 60s for captions in generation mode
        } else {
          timeoutMs = 45000 // 45s for other media in generation mode
        }
        mediaServiceDebugLog(`[MediaService] 🚀 GENERATION MODE: Using ${timeoutMs}ms timeout for ${mediaId}`)
      } else {
        // Normal mode - existing logic
        if (mediaId.startsWith('caption-')) {
          // Captions need more time and retry logic
          const isBulkScenario = this.batchResolvers.size >= 10
          timeoutMs = isBulkScenario ? 30000 : 5000 // 30s during bulk ops, 5s otherwise
        } else {
          // Check if we're in a bulk loading scenario by looking at batch size
          const isBulkScenario = this.batchResolvers.size >= 10
          timeoutMs = isBulkScenario ? 15000 : 10000 // 15s during bulk ops, 10s otherwise
        }
      }

      const timeoutId = setTimeout(() => {
        const resolver = this.batchResolvers.get(mediaId)
        if (resolver) {
          if (mediaId.startsWith('caption-')) {
            // For captions, log warning but don't immediately resolve as null
            mediaServiceDebugLog(`[MediaService] ⚠️ CAPTION TIMEOUT: ${mediaId} taking longer than ${timeoutMs}ms - will retry individually`)
            this.batchResolvers.delete(mediaId)
            // Try individual loading as fallback instead of resolving as null
            this.getMediaInternal(mediaId)
              .then(result => resolve(result))
              .catch(() => {
                mediaServiceDebugLog(`[MediaService] ❌ CAPTION RETRY FAILED: ${mediaId} - resolving as null`)
                resolve(null)
              })
          } else {
            // For non-captions, use original behavior but with better logging
            mediaServiceDebugLog(`[MediaService] ⏰ TIMEOUT: Resolving ${mediaId} as null after ${timeoutMs}ms`)
            this.batchResolvers.delete(mediaId)
            resolve(null)
          }
        }
      }, timeoutMs)
    })
    
    this.pendingBatchRequests.set(mediaId, mediaPromise)
    this.mediaLoadingPromises.set(mediaId, mediaPromise)

    // 🔧 FIX: Track promise creation and resolution to prevent deadlocks
    this.promiseTracker.set(mediaId, {
      promise: mediaPromise,
      createdAt: Date.now(),
      resolved: false
    })

    // Clean up when done
    mediaPromise.finally(() => {
      this.pendingBatchRequests.delete(mediaId)
      this.mediaLoadingPromises.delete(mediaId)
      // Mark as resolved in tracker (keep for a bit to detect stale promises)
      const tracker = this.promiseTracker.get(mediaId)
      if (tracker) {
        tracker.resolved = true
        // Clean up after 10 seconds to allow stale detection
        setTimeout(() => this.promiseTracker.delete(mediaId), 10000)
      }
    })
    
    return mediaPromise
  }

  // 🔧 FIX: Wrap promises with timeout to prevent hanging deduplicated requests
  private wrapPromiseWithTimeout<T>(
    promise: Promise<T>,
    mediaId: string,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          mediaServiceDebugLog(`[MediaService] ⏰ DEDUPE TIMEOUT: ${mediaId} timed out after ${timeoutMs}ms - cleaning up`)
          // Clean up stale promise tracking
          this.mediaLoadingPromises.delete(mediaId)
          this.pendingBatchRequests.delete(mediaId)
          this.promiseTracker.delete(mediaId)
          reject(new Error(`Deduplicated request for ${mediaId} timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      })
    ])
  }

  // 🚀 BATCH PROCESSING: Collect requests and process in batches
  private addToBatch(mediaId: string, resolve: (value: any) => void, reject: (reason?: any) => void) {
    this.batchResolvers.set(mediaId, { resolve, reject })

    // 🔍 ENHANCED DIAGNOSTIC: Track batch accumulation patterns
    const currentTime = Date.now()
    const timeSinceLastRequest = this.lastRequestTime ? currentTime - this.lastRequestTime : 0
    this.lastRequestTime = currentTime

    console.log(`[MediaService] REQUEST PATTERN: ${mediaId} added to batch`, {
      currentBatchSize: this.batchResolvers.size,
      generationMode: this.isGenerationMode,
      timeSinceLastRequest: `${timeSinceLastRequest}ms`,
      projectId: this.projectId
    })

    // Set up batch processing timer with adaptive timeout based on batch size
    if (this.batchRequestTimer) {
      clearTimeout(this.batchRequestTimer)
      console.log(`[MediaService] TIMER RESET: Previous timer cleared for batch size ${this.batchResolvers.size}`)
    }

    // 🚀 STARTUP OPTIMIZATION: Use longer timeout for larger batches (startup scenario)
    const currentBatchSize = this.batchResolvers.size
    const adaptiveTimeout = this.calculateBatchTimeout(currentBatchSize)

    console.log(`[MediaService] TIMER SET: ${adaptiveTimeout}ms timeout for batch size ${currentBatchSize}, gen mode: ${this.isGenerationMode}`)
    mediaServiceDebugLog(`[MediaService] 📊 Batch size: ${currentBatchSize}, timeout: ${adaptiveTimeout}ms`)
    this.batchRequestTimer = setTimeout(() => this.processBatch(), adaptiveTimeout)
  }
  
  // 🚀 PHASE 3 & 5: Enhanced batch timeout calculation with generation mode support
  private calculateBatchTimeout(batchSize: number): number {
    // 🚀 PHASE 3: Use much longer timeouts in generation mode for maximum batching efficiency
    if (this.isGenerationMode) {
      // In generation mode, prioritize large batches over speed
      if (batchSize >= 20) {
        const timeout = 3000 // 3 seconds for very large batches
        mediaServiceDebugLog(`[MediaService] 🚀 GENERATION MODE - MEGA BATCH: Using ${timeout}ms timeout for ${batchSize} items`)
        return timeout
      } else if (batchSize >= 10) {
        const timeout = 2000 // 2 seconds for large batches
        mediaServiceDebugLog(`[MediaService] 🚀 GENERATION MODE - LARGE BATCH: Using ${timeout}ms timeout for ${batchSize} items`)
        return timeout
      } else if (batchSize >= 5) {
        const timeout = 1500 // 1.5 seconds for medium batches
        mediaServiceDebugLog(`[MediaService] 🚀 GENERATION MODE - MEDIUM BATCH: Using ${timeout}ms timeout for ${batchSize} items`)
        return timeout
      } else {
        const timeout = 1000 // 1 second minimum in generation mode
        mediaServiceDebugLog(`[MediaService] 🚀 GENERATION MODE - SMALL BATCH: Using ${timeout}ms timeout for ${batchSize} items`)
        return timeout
      }
    }

    // Normal mode - existing logic for interactive use
    const timeSinceLastBatch = Date.now() - this.lastBatchProcessTime
    const shouldExtendTimeout = timeSinceLastBatch < this.MIN_BATCH_INTERVAL

    if (batchSize >= 15) {
      // Large batch scenario - use extended timeout to collect even more requests
      const timeout = shouldExtendTimeout ? 400 : 300 // Extended for backend optimization
      mediaServiceDebugLog(`[MediaService] 🚀 LARGE BATCH: Using ${timeout}ms timeout for ${batchSize} items`)
      return timeout
    } else if (batchSize >= 8) {
      // Medium batch - longer timeout to encourage growth
      const timeout = shouldExtendTimeout ? 300 : 250 // Increased significantly
      mediaServiceDebugLog(`[MediaService] 🔄 MEDIUM BATCH: Using ${timeout}ms timeout for ${batchSize} items`)
      return timeout
    } else if (batchSize >= 3) {
      // Small-medium batch - wait for more requests
      const timeout = shouldExtendTimeout ? 250 : 200 // Increased from 150ms
      return timeout
    } else {
      // Very small batch - wait significantly longer to encourage batching
      const timeout = shouldExtendTimeout ? 200 : 150 // Increased from 100ms
      return timeout
    }
  }
  
  // 🚀 PRODUCTION FIX: Robust Tauri environment detection
  private async detectTauriEnvironment(): Promise<boolean> {
    try {
      // Check if we're in Tauri environment by trying to import and use invoke
      const { invoke } = await import('@tauri-apps/api/core')
      
      // Test if invoke actually works by calling a simple command
      await invoke('get_cli_args')
      
      mediaServiceDebugLog('[MediaService] ✅ Tauri environment detected and working')
      return true
    } catch (error) {
      mediaServiceDebugLog('[MediaService] ❌ Tauri environment not available:', (error as Error).message)
      return false
    }
  }

  private async processBatch() {
    const batchIds = Array.from(this.batchResolvers.keys())
    if (batchIds.length === 0) return

    // 🚀 CRITICAL DIAGNOSTIC: Log batch flush details for debugging
    console.log(`[MediaService] batch flush`, { size: batchIds.length, gen: this.isGenerationMode })

    // 🚀 PHASE 5: Track batch processing time for optimization
    this.lastBatchProcessTime = Date.now()

    mediaServiceDebugLog(`[MediaService] 🚀 PHASE 5: Processing optimized batch of ${batchIds.length} media requests:`, batchIds)
    
    try {
      // 🚀 PRODUCTION FIX: Better Tauri environment detection
      const isTauriEnvironment = await this.detectTauriEnvironment()
      
      if (isTauriEnvironment) {
        mediaServiceDebugLog(`[MediaService] ✅ Using Tauri batch operations for ${batchIds.length} items`)
        await this.processBatchWithTauri(batchIds)
      } else {
        mediaServiceDebugLog(`[MediaService] ⚠️ Tauri not available, falling back to individual processing for ${batchIds.length} items`)
        // Fallback to individual processing for testing/browser-only environments
        await this.processBatchFallback(batchIds)
      }
    } catch (error) {
      console.error('[MediaService] Batch processing failed:', error)
      // Only reject pending requests, don't force-resolve them
      for (const [mediaId, { reject }] of this.batchResolvers) {
        mediaServiceDebugLog(`[MediaService] ❌ BATCH ERROR: Rejecting ${mediaId} due to batch processing failure`)
        reject(error)
      }
      // Clear resolvers after handling the error
      this.batchResolvers.clear()
    } finally {
      // 🔧 ENHANCED FIX: SMART CLEANUP with RETRY for unprocessed items
      if (this.batchResolvers.size > 0) {
        mediaServiceDebugLog(`[MediaService] 📊 SMART CLEANUP: ${this.batchResolvers.size} items remaining after batch processing`)

        // Retry unprocessed items individually instead of failing them
        const unprocessedItems = Array.from(this.batchResolvers.entries())
        this.batchResolvers.clear() // Clear first to avoid infinite loops

        for (const [mediaId, resolver] of unprocessedItems) {
          mediaServiceDebugLog(`[MediaService] 🔄 RETRY: Processing ${mediaId} individually after batch failure`)

          // Retry individual loading for unprocessed items
          this.retryIndividualLoad(mediaId, resolver)
        }
      }

      this.batchRequestTimer = null
    }
  }
  
  private async processBatchWithTauri(batchIds: string[]) {
    const { invoke } = await import('@tauri-apps/api/core')

    try {
      // 🚀 PHASE 5: Use existence cache to reduce backend calls
      const cachedExistenceResults = new Map<string, boolean>()
      const uncachedIds: string[] = []

      // Check cache first
      for (const mediaId of batchIds) {
        const cached = this.projectExistenceCache.get(mediaId)
        if (cached !== undefined) {
          cachedExistenceResults.set(mediaId, cached)
        } else {
          uncachedIds.push(mediaId)
        }
      }

      let existenceFlags: boolean[]

      if (uncachedIds.length > 0) {
        // Only call backend for uncached items
        mediaServiceDebugLog(`[MediaService] 🚀 PHASE 5: Cache hit for ${cachedExistenceResults.size}/${batchIds.length} items, checking ${uncachedIds.length} uncached items`)

        const uncachedFlags = await invoke<boolean[]>('media_exists_batch', {
          projectId: this.projectId,
          mediaIds: uncachedIds
        })

        // Cache the results
        uncachedIds.forEach((mediaId, index) => {
          this.projectExistenceCache.set(mediaId, uncachedFlags[index])
        })

        // Reconstruct full existence array
        existenceFlags = batchIds.map(mediaId => {
          const cached = cachedExistenceResults.get(mediaId)
          if (cached !== undefined) return cached

          const uncachedIndex = uncachedIds.indexOf(mediaId)
          return uncachedFlags[uncachedIndex]
        })
      } else {
        // All items were cached
        mediaServiceDebugLog(`[MediaService] 🚀 PHASE 5: 100% cache hit for existence check (${batchIds.length} items)`)
        existenceFlags = batchIds.map(mediaId => cachedExistenceResults.get(mediaId)!)
      }

      const existingIds = batchIds.filter((_, index) => existenceFlags[index])
      const missingIds = batchIds.filter((_, index) => !existenceFlags[index])
      
      mediaServiceDebugLog(`[MediaService] ⚡ BATCH EXISTS CHECK: ${existingIds.length} exist, ${missingIds.length} missing`)
      
      // Resolve missing media as null immediately
      for (const missingId of missingIds) {
        const resolver = this.batchResolvers.get(missingId)
        if (resolver) {
          mediaServiceDebugLog(`[MediaService] ❌ Media not found: ${missingId}`)
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
      
      mediaServiceDebugLog(`[MediaService] 🚀 BATCH LOADED: ${mediaDataArray.length} media items successfully`)
      
      // Process and resolve each media item with error recovery
      for (const mediaData of mediaDataArray) {
        const resolver = this.batchResolvers.get(mediaData.id)
        if (resolver) {
          try {
            const result = await this.processBatchMediaItem(mediaData)
            resolver.resolve(result)
          } catch (error) {
            // ERROR RECOVERY: Add to failed list and resolve as null
            logger.warn(`[MediaService] Failed to process batch media ${mediaData.id}:`, error)

            const originalName = mediaData.metadata?.original_name || 'unknown'
            const pageId = mediaData.metadata?.page_id || 'unknown'

            this.addFailedMedia(mediaData.id, originalName, pageId, this.getErrorMessage(error))
            resolver.resolve(null)
          }
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
    mediaServiceDebugLog(`[MediaService] 🔄 Falling back to individual processing for ${batchIds.length} items`)

    for (const mediaId of batchIds) {
      const resolver = this.batchResolvers.get(mediaId)
      if (resolver) {
        try {
          const result = await this.getMediaInternal(mediaId)
          resolver.resolve(result)
        } catch (error) {
          // ERROR RECOVERY: Instead of rejecting, add to failed list and resolve as null
          logger.warn(`[MediaService] Failed to load media ${mediaId}, adding to failed list:`, error)

          // Try to get media info from cache to populate failed media details
          const cachedMedia = this.mediaCache.get(mediaId)
          const originalName = this.getStringValue(cachedMedia?.fileName || cachedMedia?.metadata?.original_name)
          const pageId = this.getStringValue(cachedMedia?.pageId || cachedMedia?.metadata?.page_id)

          this.addFailedMedia(mediaId, originalName, pageId, this.getErrorMessage(error))

          // Resolve as null instead of rejecting to prevent hanging
          resolver.resolve(null)
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
      mediaServiceDebugLog(`[MediaService] ⚡ BATCH: Cached audio data for ${mediaData.id}`)
    }
    
    return {
      data: new Uint8Array(mediaData.data),
      metadata: processedMetadata,
      url: undefined // Will be created by UnifiedMediaContext
    }
  }

  /**
   * Retry individual loading for items that failed in batch processing
   */
  private async retryIndividualLoad(mediaId: string, resolver: { resolve: (value: any) => void }): Promise<void> {
    try {
      mediaServiceDebugLog(`[MediaService] 🔄 INDIVIDUAL RETRY: Loading ${mediaId} individually`)

      const result = await this.getMediaInternal(mediaId)
      resolver.resolve(result)

      mediaServiceDebugLog(`[MediaService] ✅ INDIVIDUAL RETRY SUCCESS: ${mediaId}`)
    } catch (error) {
      mediaServiceDebugLog(`[MediaService] ❌ INDIVIDUAL RETRY FAILED: ${mediaId}`, error)

      // Add to failed media list and resolve as null
      const cachedMedia = this.mediaCache.get(mediaId)
      const originalName = this.getStringValue(cachedMedia?.fileName || cachedMedia?.metadata?.original_name) || 'unknown'
      const pageId = this.getStringValue(cachedMedia?.pageId || cachedMedia?.metadata?.page_id) || 'unknown'

      this.addFailedMedia(mediaId, originalName, pageId, this.getErrorMessage(error))
      resolver.resolve(null)
    }
  }

  /**
   * 🚀 PHASE 3: Add request to priority queue with cancellation support
   */
  private async queueMediaRequest(
    mediaId: string,
    options: {
      priority?: RequestPriority,
      pageId?: string,
      isVisible?: boolean,
      isCurrent?: boolean
    } = {}
  ): Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null> {
    return new Promise((resolve, reject) => {
      // Remove any existing requests for the same media ID
      this.requestQueue = this.requestQueue.filter(req => req.mediaId !== mediaId)

      // Determine priority based on context
      let priority = options.priority || RequestPriority.LOW
      if (options.isCurrent) {
        priority = RequestPriority.HIGH
      } else if (options.isVisible) {
        priority = RequestPriority.MEDIUM
      }

      const cancellationToken = { cancelled: false }
      const queuedRequest: QueuedRequest = {
        mediaId,
        priority,
        pageId: options.pageId,
        isVisible: options.isVisible,
        isCurrent: options.isCurrent,
        timestamp: Date.now(),
        cancellationToken,
        resolver: { resolve, reject }
      }

      this.requestQueue.push(queuedRequest)

      // Sort queue by priority (highest first), then by timestamp (oldest first)
      this.requestQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority // Higher priority first
        }
        return a.timestamp - b.timestamp // Older requests first for same priority
      })

      mediaServiceDebugLog(`[MediaService] 📋 QUEUED: ${mediaId} with priority ${priority} (queue size: ${this.requestQueue.length})`)

      // Start processing if not already running
      this.processQueue()
    })
  }

  /**
   * 🚀 PHASE 3: Process the priority queue
   */
  private processQueue(): void {
    if (this.queueProcessingTimer) {
      return // Already processing
    }

    this.queueProcessingTimer = setTimeout(async () => {
      while (this.requestQueue.length > 0 && this.activeRequests.size < this.maxConcurrentRequests) {
        const request = this.requestQueue.shift()
        if (!request) break

        // Skip cancelled requests
        if (request.cancellationToken.cancelled) {
          mediaServiceDebugLog(`[MediaService] ⏭️ SKIPPING: ${request.mediaId} (cancelled)`)
          continue
        }

        // Skip if already being processed
        if (this.activeRequests.has(request.mediaId)) {
          mediaServiceDebugLog(`[MediaService] ⏭️ SKIPPING: ${request.mediaId} (already active)`)
          continue
        }

        this.activeRequests.add(request.mediaId)
        mediaServiceDebugLog(`[MediaService] 🚀 PROCESSING: ${request.mediaId} (priority ${request.priority})`)

        // Process the request asynchronously
        this.processQueuedRequest(request).finally(() => {
          this.activeRequests.delete(request.mediaId)
          // Continue processing queue
          this.queueProcessingTimer = null
          this.processQueue()
        })
      }

      if (this.requestQueue.length === 0 || this.activeRequests.size >= this.maxConcurrentRequests) {
        this.queueProcessingTimer = null
      }
    }, 10) // Small delay to batch multiple queue additions
  }

  /**
   * 🚀 PHASE 3: Process an individual queued request
   */
  private async processQueuedRequest(request: QueuedRequest): Promise<void> {
    try {
      // Check if cancelled before processing
      if (request.cancellationToken.cancelled) {
        mediaServiceDebugLog(`[MediaService] 🚫 CANCELLED: ${request.mediaId}`)
        return
      }

      const result = await this.getMediaInternal(request.mediaId)

      // Check if cancelled after processing
      if (request.cancellationToken.cancelled) {
        mediaServiceDebugLog(`[MediaService] 🚫 CANCELLED AFTER LOAD: ${request.mediaId}`)
        return
      }

      request.resolver.resolve(result)
      mediaServiceDebugLog(`[MediaService] ✅ QUEUE SUCCESS: ${request.mediaId}`)
    } catch (error) {
      if (!request.cancellationToken.cancelled) {
        mediaServiceDebugLog(`[MediaService] ❌ QUEUE ERROR: ${request.mediaId}`, error)
        request.resolver.reject(error)
      }
    }
  }

  /**
   * 🚀 PHASE 3: Cancel all requests for a specific page
   */
  public cancelRequestsForPage(pageId: string): void {
    let cancelledCount = 0

    // Cancel queued requests
    for (const request of this.requestQueue) {
      if (request.pageId === pageId) {
        request.cancellationToken.cancelled = true
        cancelledCount++
      }
    }

    // Remove cancelled requests from queue
    this.requestQueue = this.requestQueue.filter(req => !req.cancellationToken.cancelled)

    if (cancelledCount > 0) {
      mediaServiceDebugLog(`[MediaService] 🚫 CANCELLED: ${cancelledCount} requests for page ${pageId}`)
    }
  }

  /**
   * 🚀 PHASE 3: Cancel all low priority requests to prioritize high/medium priority
   */
  public cancelLowPriorityRequests(): void {
    let cancelledCount = 0

    for (const request of this.requestQueue) {
      if (request.priority === RequestPriority.LOW) {
        request.cancellationToken.cancelled = true
        cancelledCount++
      }
    }

    // Remove cancelled requests from queue
    this.requestQueue = this.requestQueue.filter(req => !req.cancellationToken.cancelled)

    if (cancelledCount > 0) {
      mediaServiceDebugLog(`[MediaService] 🚫 CANCELLED: ${cancelledCount} low priority requests`)
    }
  }

  /**
   * 🚀 PHASE 5: Clear backend optimization caches when project changes
   */
  public clearBackendCaches(): void {
    const existenceCacheSize = this.projectExistenceCache.size
    this.projectExistenceCache.clear()
    this.lastBatchProcessTime = 0

    if (existenceCacheSize > 0) {
      mediaServiceDebugLog(`[MediaService] 🧹 PHASE 5: Cleared ${existenceCacheSize} existence cache entries for project change`)
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
        mediaServiceDebugLog('[MediaService] Returning cached audio data for:', mediaId)
        return { ...cached, url: this.blobUrlCache.get(mediaId) }
      }
      
      // Check if we're already loading this audio
      const loadingPromise = this.audioLoadingPromises.get(mediaId)
      if (loadingPromise) {
        mediaServiceDebugLog('[MediaService] Waiting for existing audio load:', mediaId)
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
      mediaServiceDebugLog('[MediaService] Getting media from file system:', mediaId)
      
      const mediaInfo = await this.fileStorage.getMedia(mediaId)
      
      debugLogger.debug('MediaService.getMedia', 'FileStorage returned', {
        found: !!mediaInfo,
        hasData: !!(mediaInfo?.data),
        dataSize: mediaInfo?.data?.byteLength || 0,
        mediaType: mediaInfo?.mediaType,
        metadataKeys: mediaInfo?.metadata ? Object.keys(mediaInfo.metadata) : []
      })
      
      mediaServiceDebugLog('[MediaService] FileStorage returned:', {
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
      mediaServiceDebugLog('[MediaService] Cached item:', {
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
        mediaServiceDebugLog(`[MediaService] 🎬 YouTube clip timing conversion for ${mediaId}:`)
        mediaServiceDebugLog('  Raw clip_start (snake):', debugInfo.rawClipStart)
        mediaServiceDebugLog('  Raw clip_end (snake):', debugInfo.rawClipEnd)
        mediaServiceDebugLog('  Raw clipStart (camel):', debugInfo.camelClipStart)
        mediaServiceDebugLog('  Raw clipEnd (camel):', debugInfo.camelClipEnd)
        mediaServiceDebugLog('  Processed clipStart:', debugInfo.processedClipStart)
        mediaServiceDebugLog('  Processed clipEnd:', debugInfo.processedClipEnd)
        mediaServiceDebugLog('  Conversion source:', debugInfo.conversionSource)
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
        mediaServiceDebugLog(`[MediaService] 🔄 Updating cache for ${mediaId}:`, {
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
      
      // For YouTube videos, get URL from metadata or blob data
      if (metadata.source === 'youtube' || metadata.isYouTube) {
        let baseUrl = metadata.embedUrl || metadata.youtubeUrl

        // 🔧 FIX: If no URL in metadata, extract from blob data (stored as text)
        if (!baseUrl && mediaInfo.data && mediaInfo.data.byteLength > 0) {
          try {
            const textDecoder = new TextDecoder()
            baseUrl = textDecoder.decode(mediaInfo.data)
            logger.info(`[MediaService] 🔧 Extracted YouTube URL from blob data for ${mediaId}:`, baseUrl)
          } catch (error) {
            logger.error(`[MediaService] Failed to extract YouTube URL from blob data for ${mediaId}:`, error)
          }
        }

        if (baseUrl) {
          // 🔧 FIX: Dynamically add clip timing parameters to YouTube embed URL
          if (metadata.clipStart !== undefined || metadata.clipEnd !== undefined) {
            try {
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
            } catch (urlError) {
              // If URL parsing fails, use baseUrl as-is
              url = baseUrl
              logger.warn(`[MediaService] Failed to parse YouTube URL for clip timing, using base URL:`, urlError)
            }
          } else {
            url = baseUrl
            debugLogger.debug('MediaService.getMedia', 'Using YouTube URL without clip timing', { mediaId, url })
            logger.info('[MediaService] Using YouTube URL (no clip timing):', url)
          }
        } else {
          // YouTube video but missing URL - provide fallback
          logger.error('[MediaService] YouTube video detected but no URL available', {
            mediaId,
            source: metadata.source,
            isYouTube: metadata.isYouTube,
            hasEmbedUrl: !!metadata.embedUrl,
            hasYoutubeUrl: !!metadata.youtubeUrl,
            hasBlobData: !!(mediaInfo.data && mediaInfo.data.byteLength > 0)
          })
          url = 'https://www.youtube.com/watch?v=invalid' // Fallback URL to prevent errors
        }
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
        mediaServiceDebugLog('[MediaService] Providing binary data for SCORM packaging:', {
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
      mediaServiceDebugLog('[MediaService v2.0.6] Final result for getMedia:', { 
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
          mediaServiceDebugLog('[MediaService] Cached audio data for future use:', mediaId)
        }
        // Clear loading promise
        this.audioLoadingPromises.delete(mediaId)
      }
      
      mediaServiceDebugLog('[MediaService] Returning media:', {
        mediaId,
        hasData: !!result.data,
        metadataType: result.metadata.type,
        metadataPageId: result.metadata.pageId,
        url: result.url
      })
      
      mediaServiceDebugLog(`✅ [MediaService] getMedia SUCCESS for ${mediaId}:`, {
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
      mediaServiceDebugLog(`🔍 [MediaService] Full error object for ${mediaId}:`, error)

      // ERROR RECOVERY: Add to failed media list
      const cachedMedia = this.mediaCache.get(mediaId)
      const originalName = this.getStringValue(cachedMedia?.fileName || cachedMedia?.metadata?.original_name)
      const pageId = this.getStringValue(cachedMedia?.pageId || cachedMedia?.metadata?.page_id)

      this.addFailedMedia(mediaId, originalName, pageId, errorMsg)
      logger.warn(`[MediaService] Added failed media to recovery list: ${mediaId} (${originalName})`)

      return null
    }
  }
  
  /**
   * Load audio with deduplication to prevent concurrent loads
   */
  private async loadAudioWithDeduplication(mediaId: string): Promise<{ data?: Uint8Array; metadata: MediaMetadata; url?: string } | null> {
    try {
      mediaServiceDebugLog('[MediaService] Loading audio from file system:', mediaId)
      
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
        mediaServiceDebugLog('[MediaService] Created blob URL for audio:', mediaId)
      }
      
      const data = mediaInfo.data ? new Uint8Array(mediaInfo.data) : undefined
      
      const result = { data, metadata, url }
      
      // Cache the audio data
      if (data && metadata) {
        this.audioDataCache.set(mediaId, { data, metadata })
        mediaServiceDebugLog('[MediaService] Cached audio data for:', mediaId)
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
      mediaServiceDebugLog(`[MediaService] 🧹 Starting aggressive cleanup scan of ${allMedia.length} media items`)
      mediaServiceDebugLog(`[MediaService] 🔍 DEBUG: All media IDs:`, allMedia.map(m => m.id))
      mediaServiceDebugLog(`[MediaService] 🔍 DEBUG: Sample metadata:`, allMedia.length > 0 ? allMedia[0].metadata : 'No items')
      
      for (const mediaItem of allMedia) {
        // AGGRESSIVE CONTAMINATION DETECTION
        // Check for ALL possible YouTube-related contamination patterns
        // 🔧 FIX: Get RAW metadata directly from FileStorage to see true contamination
        let metadata = mediaItem.metadata as any
        
        try {
          // Get raw metadata from FileStorage to bypass MediaService processing
          const rawMediaData = await this.fileStorage.getMedia(mediaItem.id)
          if (rawMediaData) {
            mediaServiceDebugLog(`[MediaService] 🔍 RAW METADATA from FileStorage for ${mediaItem.id}:`, {
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
        mediaServiceDebugLog(`[MediaService] 🔬 Scanning contamination fields for ${mediaItem.id}:`, 
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
            if (isYouTubeSource) mediaServiceDebugLog(`[MediaService] ✅ CONTAMINATION: YouTube source field on non-video media`)
            return isYouTubeSource
          }
          
          // 🔧 FIX: For YouTube-specific fields, existence on non-video media IS contamination
          // These fields should not exist on image files at all
          const youtubeSpecificFields = ['embed_url', 'youtube_url', 'embedUrl', 'youtubeUrl', 
                                         'clip_start', 'clip_end', 'clipStart', 'clipEnd']
          if (youtubeSpecificFields.includes(field)) {
            mediaServiceDebugLog(`[MediaService] ✅ CONTAMINATION: YouTube-specific field ${field} exists on non-video media`)
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
        
        mediaServiceDebugLog(`[MediaService] 🔍 CLEANUP SCAN: ${mediaItem.id} (type: ${mediaItem.type})`, {
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
          mediaServiceDebugLog(`[MediaService] 🧹 AGGRESSIVE: Cleaning contaminated ${mediaItem.type}: ${mediaItem.id}`)
          mediaServiceDebugLog(`[MediaService] 🔍 Detected contamination fields:`, contaminationFields.filter(field => !!metadata[field]))
          
          try {
            // AGGRESSIVE CLEANUP - Remove ALL YouTube-related fields
            const cleanMetadata = { ...metadata }
            
            // Remove all contamination fields regardless of case/format
            contaminationFields.forEach(field => {
              if (cleanMetadata.hasOwnProperty(field)) {
                mediaServiceDebugLog(`[MediaService] 🗑️ Removing contaminated field: ${field} = ${cleanMetadata[field]}`)
                delete cleanMetadata[field]
              }
            })
            
            // Also check for any field that contains 'youtube' in the name (case-insensitive)
            Object.keys(cleanMetadata).forEach(key => {
              if (key.toLowerCase().includes('youtube') || 
                  key.toLowerCase().includes('embed') ||
                  key.toLowerCase().includes('clip')) {
                mediaServiceDebugLog(`[MediaService] 🗑️ Removing suspicious field: ${key} = ${cleanMetadata[key]}`)
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
            
            mediaServiceDebugLog(`[MediaService] 🧽 Clean metadata keys:`, Object.keys(cleanMetadata))
            
            // 🔧 CRITICAL FIX: Preserve original media data, only update metadata
            const existingMediaInfo = await this.fileStorage.getMedia(mediaItem.id)
            let mediaBlob: Blob
            
            if (existingMediaInfo?.data) {
              // Preserve original image data
              mediaBlob = new Blob([existingMediaInfo.data], { type: existingMediaInfo.mediaType || mediaItem.type })
              mediaServiceDebugLog(`[MediaService] ✅ Preserving original media data: ${existingMediaInfo.data.byteLength} bytes`)
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
            mediaServiceDebugLog(`[MediaService] 🔄 Revoked stale blob URL for cleaned media: ${mediaItem.id}`)
            
            cleaned.push(mediaItem.id)
            mediaServiceDebugLog(`[MediaService] ✅ AGGRESSIVELY cleaned contaminated media: ${mediaItem.id}`)
          } catch (error) {
            const errorMsg = `Failed to clean ${mediaItem.id}: ${error}`
            errors.push(errorMsg)
            console.error(`[MediaService] ❌ Error cleaning media:`, errorMsg)
          }
        }
      }
      
      mediaServiceDebugLog(`[MediaService] 🧹 AGGRESSIVE cleanup complete: ${cleaned.length} cleaned, ${errors.length} errors`)
      if (cleaned.length > 0) {
        mediaServiceDebugLog(`[MediaService] 🎯 Cleaned items:`, cleaned)
      }
      if (errors.length > 0) {
        mediaServiceDebugLog(`[MediaService] ❌ Cleanup errors:`, errors)
      }
      
      // Summary of all media processed
      mediaServiceDebugLog(`[MediaService] 📊 Cleanup summary: Processed ${allMedia.length} total media items`)
      const mediaByType = allMedia.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      mediaServiceDebugLog(`[MediaService] 📊 Media by type:`, mediaByType)
      
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
      mediaServiceDebugLog(`[MediaService] 📊 Processing metadata for ${actualMediaType}:`, {
        mediaId: mediaInfo.id,
        type: actualMediaType,
        source: source,
        hasYouTubeFields: hasYouTubeMetadata,
        isContaminated: hasYouTubeMetadata && actualMediaType !== 'video',
        metadataKeys: Object.keys(mediaInfo.metadata || {})
      })
    }
    
    // 🔧 FIX: Properly extract YouTube URL from metadata fields
    const embedUrl = mediaInfo.metadata?.embedUrl || mediaInfo.metadata?.embed_url
    const youtubeUrl = mediaInfo.metadata?.youtubeUrl ||
                      (mediaInfo.metadata?.source === 'youtube' ? embedUrl : undefined)

    return {
      type: actualMediaType,
      pageId: (typeof pageId === 'string' ? pageId : ''),
      mimeType: mediaInfo.metadata?.mimeType || mediaInfo.metadata?.mime_type,
      mime_type: mediaInfo.metadata?.mime_type,
      source: mediaInfo.metadata?.source,
      embedUrl: embedUrl,
      isYouTube: mediaInfo.metadata?.source === 'youtube' || mediaInfo.metadata?.isYouTube === true,
      youtubeUrl: youtubeUrl,
      title: mediaInfo.metadata?.title,
      uploadedAt: mediaInfo.metadata?.uploadedAt || new Date().toISOString(),
      // 🔧 FIX: Convert snake_case clip timing fields to camelCase with proper null/string handling
      clipStart: this.normalizeClipTiming(mediaInfo.metadata?.clipStart || mediaInfo.metadata?.clip_start),
      clipEnd: this.normalizeClipTiming(mediaInfo.metadata?.clipEnd || mediaInfo.metadata?.clip_end)
    }
  }
  
  /**
   * Normalize clip timing values: convert null to undefined, strings to numbers
   * Handles the bug where clip timing shows as "null (type: object)"
   */
  private normalizeClipTiming(value: any): number | undefined {
    // Handle null, undefined, empty string
    if (value === null || value === undefined || value === '') {
      return undefined
    }

    // Handle string numbers - convert to number
    if (typeof value === 'string') {
      const parsed = parseFloat(value)
      return isNaN(parsed) ? undefined : parsed
    }

    // Handle actual numbers
    if (typeof value === 'number' && !isNaN(value)) {
      return value
    }

    // Handle any other invalid values
    return undefined
  }

  /**
   * Clear the audio cache - should be called when switching projects
   */
  clearAudioCache(): void {
    mediaServiceDebugLog('[MediaService] Clearing audio cache, current size:', this.audioDataCache.size)
    
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
    
    mediaServiceDebugLog('[MediaService] Audio cache cleared')
  }

  /**
   * Clear audio cache for a specific media ID - use when replacing audio
   */
  clearAudioFromCache(mediaId: string): void {
    mediaServiceDebugLog('[MediaService] Clearing audio from cache:', mediaId)
    
    // Clear blob URL if exists
    const url = this.blobUrlCache.get(mediaId)
    if (url && url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url)
        mediaServiceDebugLog('[MediaService] Revoked blob URL for:', mediaId)
      } catch (e) {
        console.warn('[MediaService] Failed to revoke blob URL:', e)
      }
    }
    
    // Remove from caches
    this.audioDataCache.delete(mediaId)
    this.blobUrlCache.delete(mediaId) 
    this.audioLoadingPromises.delete(mediaId)
    
    mediaServiceDebugLog('[MediaService] Audio cleared from cache:', mediaId)
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
    mediaServiceDebugLog('[MediaService v3.0.0] createBlobUrl called for:', mediaId)
    
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
   * @param options Options for filtering media types
   * @param options.excludeTypes Array of media types to exclude (e.g., ['audio', 'caption'])
   */
  async listAllMedia(options: { excludeTypes?: string[]; op?: ListAllOperation } = {}): Promise<MediaItem[]> {
    const { excludeTypes = [], op = 'ui' } = options
    const isVisualOnly = excludeTypes.includes('audio') && excludeTypes.includes('caption')

    // 🎯 CONTEXT-AWARE TTL: Auto-select operation type based on generation mode
    const operation: ListAllOperation = this.isGenerationMode ? 'gen' : op
    const ttl = MediaService.TTL_BY_OPERATION[operation]

    // 🔒 NORMALIZED CACHE KEY: Deterministic key generation to prevent edge cases
    const normalizedExcludes = (excludeTypes || [])
      .filter(Boolean)  // Remove null/undefined
      .map(s => s.toLowerCase().trim())
      .sort()
    const cacheKey = `${this.projectId}|${normalizedExcludes.join(',')}`
    const now = Date.now()

    // Check cache first (bypass if TTL=0 for generation mode)
    const cached = this.listAllMediaCache.get(cacheKey)
    if (cached && ttl > 0 && (now - cached.timestamp) < ttl) {
      this.cacheMetrics.hits++
      console.log(`[PERFORMANCE] 🚀 listAllMedia cache HIT [${operation}] (${now - cached.timestamp}ms old) - returning ${cached.result.length} items`)
      return cached.result
    }

    // Check for concurrent requests
    const existingPromise = this.listAllMediaPromises.get(cacheKey)
    if (existingPromise) {
      console.log(`[PERFORMANCE] 🔄 listAllMedia deduplication - reusing in-flight request`)
      return existingPromise
    }

    debugLogger.debug('MediaService.listAllMedia', 'Listing all media', {
      excludeTypes,
      visualOnlyMode: isVisualOnly,
      cacheKey,
      cacheMiss: !!cached ? 'expired' : 'not found'
    })

    this.cacheMetrics.misses++
    console.log(`[PERFORMANCE] ⚠️ listAllMedia cache MISS [${operation}] - calling backend`)

    // Create new request with deduplication and timeout protection
    const promise = Promise.race([
      this.listAllMediaInternal(options),
      new Promise<MediaItem[]>((_, reject) =>
        setTimeout(() => reject(new Error('listAllMedia timeout')), 8000)
      )
    ])
    this.listAllMediaPromises.set(cacheKey, promise)

    try {
      const result = await promise

      // Cache the result only if TTL > 0 (not in generation mode)
      if (ttl > 0) {
        // 🔒 MEMORY MANAGEMENT: Enforce cache bounds before adding new entry
        this.enforceCacheBounds()

        // Estimate memory usage (rough approximation)
        const estimatedSize = JSON.stringify(result).length * 2 // 2 bytes per char
        this.cacheMemoryUsage += estimatedSize

        this.listAllMediaCache.set(cacheKey, { result, timestamp: now })
        console.log(`[PERFORMANCE] ✅ listAllMedia cached ${result.length} items for ${ttl}ms [${operation}]`)
      } else {
        console.log(`[PERFORMANCE] ⚡ listAllMedia bypass cache [${operation}] - returned ${result.length} items`)
      }

      return result
    } catch (error) {
      // 🚨 ERROR PROPAGATION: Clean up failed promise and propagate error
      this.listAllMediaPromises.delete(cacheKey)

      // Track error metrics
      if (error instanceof Error && error.message.includes('timeout')) {
        this.cacheMetrics.timeouts++
      } else {
        this.cacheMetrics.errors++
      }

      console.error(`[PERFORMANCE] ❌ listAllMedia failed [${operation}]:`, error)
      throw error
    } finally {
      // Clean up pending request on success
      this.listAllMediaPromises.delete(cacheKey)
    }
  }

  /**
   * Internal implementation of listAllMedia without caching
   */
  private async listAllMediaInternal(options: { excludeTypes?: string[] } = {}): Promise<MediaItem[]> {
    const { excludeTypes = [] } = options
    const isVisualOnly = excludeTypes.includes('audio') && excludeTypes.includes('caption')

    // 🚀 FIX 6: SMART BACKEND CALL PREVENTION
    if (isVisualOnly) {
      mediaServiceDebugLog('[MediaService] 🚀 FIX 6: SMART BACKEND CALL PREVENTION - Visual-only mode detected')

      // Check global flag first
      const globalVisualMode = (globalThis as any)._scormBuilderVisualOnlyMode
      if (globalVisualMode) {
        mediaServiceDebugLog('[MediaService] ✅ Global visual-only flag confirmed, implementing smart filtering')
      }
    }

    try {
      // Start with cached items
      const cachedItems = Array.from(this.mediaCache.values())
      const itemsMap = new Map<string, MediaItem>()

      // Add cached items to map (with filtering if specified)
      cachedItems.forEach(item => {
        // Apply excludeTypes filter
        if (excludeTypes.length > 0 && excludeTypes.includes(item.type)) {
          debugLogger.debug('MediaService.listAllMedia', 'Excluding cached item', {
            id: item.id,
            type: item.type,
            reason: 'Type excluded'
          })
          return
        }
        itemsMap.set(item.id, item)
      })

      // 🚀 FIX 6: SMART BACKEND CALL LOGIC
      // Only call backend if we need types that aren't excluded
      const shouldCallBackend = !isVisualOnly || cachedItems.length === 0

      if (shouldCallBackend && this.fileStorage && typeof (this.fileStorage as any).getAllProjectMedia === 'function') {
        try {
          debugLogger.debug('MediaService.listAllMedia', 'Fetching media from file system', {
            reason: isVisualOnly ? 'Cache empty, need initial scan' : 'Full scan requested'
          })

          mediaServiceDebugLog(`[MediaService] 🔍 Calling backend getAllProjectMedia() - Visual-only: ${isVisualOnly}`)
          const fileSystemMedia = await (this.fileStorage as any).getAllProjectMedia()

          if (Array.isArray(fileSystemMedia)) {
            let excludedCount = 0
            let includedCount = 0

            // Convert file system media to MediaItem format and merge (with filtering)
            fileSystemMedia.forEach((fsMedia: any) => {
              if (!itemsMap.has(fsMedia.id)) {
                const mediaType = fsMedia.mediaType || fsMedia.metadata?.type || 'image'

                // Apply excludeTypes filter
                if (excludeTypes.length > 0 && excludeTypes.includes(mediaType)) {
                  excludedCount++
                  debugLogger.debug('MediaService.listAllMedia', 'Excluding file system item', {
                    id: fsMedia.id,
                    type: mediaType,
                    reason: 'Type excluded'
                  })
                  return
                }

                const item: MediaItem = {
                  id: fsMedia.id,
                  type: mediaType,
                  pageId: fsMedia.metadata?.pageId || 'unknown',
                  fileName: fsMedia.fileName || `${fsMedia.id}.${this.getExtension(mediaType as MediaType)}`,
                  metadata: fsMedia.metadata || {}
                }
                itemsMap.set(fsMedia.id, item)

                // Add to cache for future use
                this.mediaCache.set(fsMedia.id, item)
                includedCount++
              }
            })

            debugLogger.debug('MediaService.listAllMedia', 'File system scan complete', {
              totalScanned: fileSystemMedia.length,
              newItemsAdded: includedCount,
              excludedItems: excludedCount,
              finalCount: itemsMap.size
            })

            if (isVisualOnly && excludedCount > 0) {
              mediaServiceDebugLog(`[MediaService] 🚀 FIX 6: Successfully excluded ${excludedCount} audio/caption items from results`)
            }
          }
        } catch (error) {
          // Log error but continue with cached items
          debugLogger.error('MediaService.listAllMedia', 'Failed to fetch file system media', error)
          logger.warn('[MediaService] Failed to fetch file system media, using cache only:', error)
        }
      } else if (!shouldCallBackend) {
        mediaServiceDebugLog('[MediaService] 🚀 FIX 6: BACKEND CALL SKIPPED - Using cached visual media only')
        debugLogger.info('MediaService.listAllMedia', 'Skipped backend call', {
          reason: 'Visual-only mode with sufficient cache',
          cachedItems: cachedItems.length
        })
      }

      const items = Array.from(itemsMap.values())

      debugLogger.info('MediaService.listAllMedia', 'Media listed with filtering', {
        totalCount: items.length,
        excludeTypes,
        visualOnlyMode: isVisualOnly
      })

      mediaServiceDebugLog(`[MediaService] Listed media with filtering - Total: ${items.length}, Excluded types: [${excludeTypes.join(', ')}]`)
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

        // ✅ CACHE INVALIDATION: Clear caches after write operation
        this.clearListAllMediaCaches()

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
   * Derive pageId from mediaId using reverse ID generation logic
   * Maps index back to pageId: 0→"welcome", 1→"objectives", 2+→"topic-{n-1}"
   */
  private derivePageIdFromMediaId(mediaId: string): string | null {
    try {
      // Parse mediaId format (e.g., "image-5", "audio-2", "video-10")
      const match = mediaId.match(/^(image|audio|video|caption)-(\d+)$/)
      if (!match) {
        debugLogger.warn('MediaService.derivePageIdFromMediaId', 'Invalid mediaId format', { mediaId })
        return null
      }

      const index = parseInt(match[2])

      // Map index to pageId using the same logic as idGenerator
      if (index === 0) {
        return 'welcome'
      } else if (index === 1) {
        return 'objectives'
      } else {
        // Topics start at index 2, map to topic-1, topic-2, etc.
        const topicNumber = index - 1
        return `topic-${topicNumber}`
      }
    } catch (error) {
      debugLogger.error('MediaService.derivePageIdFromMediaId', 'Failed to derive pageId', { mediaId, error })
      return null
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
            // 🔧 FIX 4: MEDIA ID GENERATION - Generate ID if missing
            const mediaId = audioItem.id || generateMediaId('audio', audioItem.pageId || pageId)
            const mediaItem: MediaItem = {
              id: mediaId,
              type: 'audio',
              pageId: audioItem.pageId || pageId,
              fileName: audioItem.metadata?.fileName || audioItem.metadata?.originalName || `${mediaId}.mp3`,
              metadata: {
                ...audioItem.metadata,
                type: 'audio',
                pageId: audioItem.pageId || pageId,
                uploadedAt: audioItem.metadata?.uploadedAt || new Date().toISOString()
              }
            }
            this.mediaCache.set(mediaId, mediaItem)
            mediaCount++
            debugLogger.debug('MediaService.loadMediaFromProject', 'Loaded audio narration', {
              id: mediaId,
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

                // 🔧 FIX 4: MEDIA ID GENERATION - Generate ID if missing
                const mediaId = mediaData.id || generateMediaId(mediaData.type || 'image', mediaData.pageId || pageId)
                const mediaItem: MediaItem = {
                  id: mediaId,
                  type: mediaData.type || 'image',
                  pageId: mediaData.pageId || pageId,
                  fileName: mediaData.metadata?.fileName || mediaData.metadata?.originalName || `${mediaId}.${this.getExtension(mediaData.type || 'image')}`,
                  metadata: {
                    ...mediaData.metadata,
                    type: mediaData.type || 'image',
                    pageId: mediaData.pageId || pageId,
                    uploadedAt: mediaData.metadata?.uploadedAt || new Date().toISOString()
                  }
                }
                this.mediaCache.set(mediaId, mediaItem)
                mediaCount++
                debugLogger.debug('MediaService.loadMediaFromProject', 'Loaded media enhancement', {
                  id: mediaId,
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
            const derivedPageId = regData.pageId || this.derivePageIdFromMediaId(mediaId)
            const mediaItem: MediaItem = {
              id: mediaId,
              type: regData.type || 'image',
              pageId: derivedPageId || 'unknown',
              fileName: regData.fileName || regData.originalName || `${mediaId}.${this.getExtension(regData.type || 'image')}`,
              metadata: {
                ...regData,
                type: regData.type || 'image',
                pageId: derivedPageId || 'unknown',
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
      mediaServiceDebugLog('[MediaService] Welcome page structure:', {
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
        mediaServiceDebugLog(`[MediaService] Processing ${welcomeMedia.length} media items from welcome page`)
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
            mediaServiceDebugLog('[MediaService] Loaded welcome page media:', {
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
        mediaServiceDebugLog('[MediaService] Objectives page structure:', {
          id: objectivesPage.id,
          hasMedia: 'media' in objectivesPage,
          mediaLength: objectivesPage.media?.length,
          mediaContent: objectivesPage.media?.slice(0, 2)
        })
      }
      
      const objectivesMedia = objectivesPage?.media || objectivesPage?.mediaReferences || []
      if (objectivesMedia && Array.isArray(objectivesMedia) && objectivesMedia.length > 0) {
        mediaServiceDebugLog(`[MediaService] Processing ${objectivesMedia.length} media items from objectives page`)
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
            mediaServiceDebugLog('[MediaService] Loaded objectives page media:', {
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
          mediaServiceDebugLog('[MediaService] First topic structure:', {
            id: courseContent.topics[0].id,
            hasMedia: 'media' in courseContent.topics[0],
            mediaLength: courseContent.topics[0].media?.length,
            mediaContent: courseContent.topics[0].media?.slice(0, 2)
          })
        }
        
        for (const topic of courseContent.topics) {
          const topicMedia = topic?.media || topic?.mediaReferences || []
          if (topicMedia && Array.isArray(topicMedia) && topicMedia.length > 0) {
            mediaServiceDebugLog(`[MediaService] Processing ${topicMedia.length} media items from topic ${topic.id}`)
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
                mediaServiceDebugLog('[MediaService] Loaded topic media:', {
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
        mediaServiceDebugLog(`[MediaService] MIME type "${mimeType}" mapped to extension "${ext}"`)
        return ext
      }
      mediaServiceDebugLog(`[MediaService] Unknown MIME type "${mimeType}", falling back to MediaType-based extension`)
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

  // Error Recovery Methods

  /**
   * Get list of media that failed to load
   */
  getFailedMedia(): Array<{
    id: string
    originalName: string
    pageId: string
    error: string
    timestamp: string
  }> {
    return [...this.failedMediaList]
  }

  /**
   * Clear the failed media list
   */
  clearFailedMedia(): void {
    this.failedMediaList = []
    logger.info('[MediaService] Cleared failed media list')
  }

  /**
   * Retry loading failed media
   */
  async retryFailedMedia(): Promise<void> {
    logger.info(`[MediaService] Retrying ${this.failedMediaList.length} failed media items`)

    const failedToRetry = [...this.failedMediaList]
    this.failedMediaList = [] // Clear the list

    for (const failedItem of failedToRetry) {
      try {
        // Try to get the media again
        const media = await this.getMedia(failedItem.id)
        if (media) {
          // Successfully loaded - add to cache
          const mediaItem: MediaItem = {
            id: failedItem.id,
            type: media.metadata.type as MediaType,
            pageId: failedItem.pageId,
            fileName: failedItem.originalName,
            metadata: media.metadata
          }
          this.mediaCache.set(failedItem.id, mediaItem)
          logger.info(`[MediaService] Successfully retried loading media: ${failedItem.originalName}`)
        }
      } catch (error) {
        // Still failing - add back to failed list
        this.failedMediaList.push(failedItem)
        logger.warn(`[MediaService] Media still failing on retry: ${failedItem.originalName}`, error)
      }
    }

    logger.info(`[MediaService] Retry complete. ${failedToRetry.length - this.failedMediaList.length} items recovered`)
  }

  /**
   * Add a media item to the failed list
   */
  private addFailedMedia(id: string, originalName: string, pageId: string, error: string): void {
    this.failedMediaList.push({
      id,
      originalName,
      pageId,
      error: error.toString(),
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Safely extract error message from unknown error type
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as any).message)
    }
    if (error && typeof error === 'object' && 'toString' in error) {
      try {
        return String(error)
      } catch {
        return 'Complex error object'
      }
    }
    return 'Unknown error'
  }

  /**
   * Safely extract string value from potentially non-string metadata property
   */
  private getStringValue(value: unknown, fallback: string = 'unknown'): string {
    if (typeof value === 'string') {
      return value || fallback
    }
    if (value && typeof value === 'object' && 'toString' in value) {
      try {
        const stringValue = String(value)
        return stringValue || fallback
      } catch {
        return fallback
      }
    }
    if (value !== null && value !== undefined) {
      try {
        return String(value) || fallback
      } catch {
        return fallback
      }
    }
    return fallback
  }

  // Media Validation Methods

  /**
   * Validate all media to identify potential loading issues
   */
  async validateAllMedia(): Promise<{
    valid: Array<{ id: string; originalName: string }>
    warnings: Array<{ id: string; originalName: string; reason: string }>
    risky: Array<{ id: string; originalName: string; reason: string; recommendations?: string[] }>
  }> {
    const allMedia = await this.listAllMedia()
    const results = {
      valid: [] as Array<{ id: string; originalName: string }>,
      warnings: [] as Array<{ id: string; originalName: string; reason: string }>,
      risky: [] as Array<{ id: string; originalName: string; reason: string; recommendations?: string[] }>
    }

    for (const media of allMedia) {
      const validationResult = await this.validateMediaItem(media)

      switch (validationResult.level) {
        case 'valid':
          results.valid.push({
            id: media.id,
            originalName: this.getStringValue(media.fileName || media.metadata.original_name)
          })
          break
        case 'warning':
          results.warnings.push({
            id: media.id,
            originalName: this.getStringValue(media.fileName || media.metadata.original_name),
            reason: validationResult.reason
          })
          break
        case 'risky':
          results.risky.push({
            id: media.id,
            originalName: this.getStringValue(media.fileName || media.metadata.original_name),
            reason: validationResult.reason,
            recommendations: validationResult.recommendations
          })
          break
      }
    }

    logger.info(`[MediaService] Media validation complete: ${results.valid.length} valid, ${results.warnings.length} warnings, ${results.risky.length} risky`)
    return results
  }

  /**
   * Validate a single media item
   */
  private async validateMediaItem(media: MediaItem): Promise<{
    level: 'valid' | 'warning' | 'risky'
    reason: string
    recommendations?: string[]
  }> {
    const originalName = this.getStringValue(media.fileName || media.metadata.original_name, '')
    const metadata = media.metadata

    // Check for external file paths (high risk)
    if (originalName.includes(':\\') || originalName.includes('/') && !originalName.startsWith('./')) {
      return {
        level: 'risky',
        reason: 'External file path detected - may be inaccessible',
        recommendations: [
          'Copy file to project directory',
          'Use relative paths within project',
          'Import media using the Media Enhancement wizard'
        ]
      }
    }

    // Check for problematic file extensions
    const extension = originalName.split('.').pop()?.toLowerCase() || ''
    if (extension === 'json') {
      return {
        level: 'risky',
        reason: 'JSON file detected - likely metadata, not actual media',
        recommendations: [
          'Check if this should be a binary media file',
          'Remove if this is orphaned metadata',
          'Re-import the actual media file'
        ]
      }
    }

    if (extension === 'bin') {
      return {
        level: 'risky',
        reason: 'BIN file detected - unusual format that may cause loading issues',
        recommendations: [
          'Convert to standard format (PNG, JPG, MP4, etc.)',
          'Re-import using standard media formats',
          'Verify file integrity'
        ]
      }
    }

    // Check for missing size information
    if (!metadata.size && !metadata.fileSize) {
      return {
        level: 'warning',
        reason: 'Missing size information - may indicate incomplete upload'
      }
    }

    // Check for type consistency
    const declaredType = metadata.type || media.type
    const mimeType = metadata.mime_type || metadata.mimeType
    const fileExtension = extension

    if (this.hasTypeInconsistency(declaredType, mimeType, fileExtension)) {
      return {
        level: 'warning',
        reason: 'Media type inconsistency detected between declared type, MIME type, and file extension'
      }
    }

    return {
      level: 'valid',
      reason: 'Media appears to be valid'
    }
  }

  /**
   * Check for inconsistencies between declared type, MIME type, and file extension
   */
  private hasTypeInconsistency(declaredType: string, mimeType?: string, fileExtension?: string): boolean {
    if (!mimeType && !fileExtension) return false

    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']
    const videoExtensions = ['mp4', 'webm', 'ogg', 'avi', 'mov']
    const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'm4a']

    // Check MIME type consistency
    if (mimeType) {
      const mimeCategory = mimeType.split('/')[0]
      if (declaredType === 'image' && mimeCategory !== 'image') return true
      if (declaredType === 'video' && mimeCategory !== 'video') return true
      if (declaredType === 'audio' && mimeCategory !== 'audio') return true
    }

    // Check file extension consistency
    if (fileExtension) {
      if (declaredType === 'image' && !imageExtensions.includes(fileExtension)) return true
      if (declaredType === 'video' && !videoExtensions.includes(fileExtension)) return true
      if (declaredType === 'audio' && !audioExtensions.includes(fileExtension)) return true
    }

    return false
  }

  /**
   * Direct batch loading API that bypasses timer coalescing
   * Use this when you have a known set of media IDs to load efficiently
   */
  async getMediaBatchDirect(ids: string[]): Promise<Map<string, { data: Uint8Array; metadata: MediaMetadata } | null>> {
    if (ids.length === 0) {
      return new Map()
    }

    console.log(`[MediaService] DIRECT BATCH: Loading ${ids.length} media items directly`)

    try {
      const { invoke } = await import('@tauri-apps/api/core')

      // Check existence first
      const existenceFlags = await invoke<boolean[]>('media_exists_batch', {
        projectId: this.projectId,
        mediaIds: ids
      })

      const existingIds = ids.filter((_, index) => existenceFlags[index])
      const result = new Map<string, { data: Uint8Array; metadata: MediaMetadata } | null>()

      if (existingIds.length === 0) {
        // All missing - fill map with null values
        for (const id of ids) {
          result.set(id, null)
        }
        return result
      }

      console.log(`[MediaService] DIRECT BATCH: ${existingIds.length}/${ids.length} exist, loading...`)

      // Load existing media
      const mediaDataArray = await invoke<any[]>('get_media_batch', {
        projectId: this.projectId,
        mediaIds: existingIds
      })

      console.log(`[MediaService] DIRECT BATCH: Received ${mediaDataArray.length} media items from backend`)

      // Process results
      for (const mediaData of mediaDataArray) {
        if (mediaData && mediaData.id) {
          result.set(mediaData.id, {
            data: new Uint8Array(mediaData.data),
            metadata: this.processMetadata({
              metadata: mediaData.metadata,
              data: new Uint8Array(mediaData.data),
              mediaType: mediaData.metadata.type || mediaData.metadata.media_type
            })
          })
        }
      }

      // Fill missing items with null
      for (const id of ids) {
        if (!result.has(id)) {
          result.set(id, null)
        }
      }

      console.log(`[MediaService] DIRECT BATCH: Completed, returned ${result.size} items`)
      return result

    } catch (error) {
      console.error('[MediaService] DIRECT BATCH: Failed to load media batch:', error)
      // Return map with null values for all IDs
      const result = new Map<string, { data: Uint8Array; metadata: MediaMetadata } | null>()
      for (const id of ids) {
        result.set(id, null)
      }
      return result
    }
  }

  /**
   * 🚀 PERFORMANCE: Batch existence check for multiple media items
   * Optimized method that only checks if media exists without loading data
   * Uses single backend call instead of N individual checks
   */
  async checkMediaExistenceBatch(mediaIds: string[]): Promise<Set<string>> {
    if (mediaIds.length === 0) {
      return new Set()
    }

    console.log(`[MediaService] BATCH EXISTENCE CHECK: Checking ${mediaIds.length} media items`)

    try {
      const { invoke } = await import('@tauri-apps/api/core')

      // Use existing optimized batch existence check
      const existenceFlags = await invoke<boolean[]>('media_exists_batch', {
        projectId: this.projectId,
        mediaIds: mediaIds
      })

      // Build Set of existing media IDs for O(1) lookup
      const existingIds = new Set<string>()
      for (let i = 0; i < mediaIds.length; i++) {
        if (existenceFlags[i]) {
          existingIds.add(mediaIds[i])
        }
      }

      console.log(`[MediaService] BATCH EXISTENCE CHECK: Found ${existingIds.size}/${mediaIds.length} existing items`)
      return existingIds

    } catch (error) {
      console.error('[MediaService] BATCH EXISTENCE CHECK: Failed to check media existence:', error)
      return new Set() // Return empty set on error
    }
  }

  /**
   * 🚀 PRELOAD: Load all audio and caption media for AudioNarrationWizard
   * Optimized bulk loading to prevent 30-second wait times
   */
  async preloadAudioNarrationMedia(): Promise<{ loadedCount: number; totalCount: number; duration: number }> {
    const startTime = performance.now()
    console.log('[MediaService] 🚀 PRELOAD: Starting audio narration media preload')

    try {
      // Get all media from cache to find audio and caption files
      const allMediaItems = Array.from(this.mediaCache.values())

      // Filter for audio and caption files
      const audioAndCaptionIds = allMediaItems
        .filter((item) =>
          item.type === 'audio' || item.type === 'caption'
        )
        .map((item) => item.id)

      if (audioAndCaptionIds.length === 0) {
        console.log('[MediaService] 🚀 PRELOAD: No audio/caption media found')
        return { loadedCount: 0, totalCount: 0, duration: performance.now() - startTime }
      }

      console.log(`[MediaService] 🚀 PRELOAD: Found ${audioAndCaptionIds.length} audio/caption files to preload`)

      // Use batch loading for maximum efficiency
      const batchResult = await this.getMediaBatchDirect(audioAndCaptionIds)

      let loadedCount = 0
      for (const [id, data] of batchResult) {
        if (data) {
          loadedCount++
          // Update cache statistics
          this.cacheMetrics.hits++
        }
      }

      const duration = performance.now() - startTime
      console.log(`[MediaService] 🚀 PRELOAD: Completed in ${duration.toFixed(2)}ms - loaded ${loadedCount}/${audioAndCaptionIds.length} items`)

      return {
        loadedCount,
        totalCount: audioAndCaptionIds.length,
        duration
      }

    } catch (error) {
      console.error('[MediaService] 🚀 PRELOAD: Failed to preload audio/caption media:', error)
      return {
        loadedCount: 0,
        totalCount: 0,
        duration: performance.now() - startTime
      }
    }
  }

  /**
   * 🔒 MEMORY MANAGEMENT: Enforce cache bounds using LRU eviction
   * Removes oldest entries when cache exceeds limits
   */
  private enforceCacheBounds(): void {
    const maxSizeBytes = MediaService.MAX_CACHE_SIZE_MB * 1024 * 1024

    // Evict by entry count
    if (this.listAllMediaCache.size >= MediaService.MAX_CACHE_ENTRIES) {
      const entries = Array.from(this.listAllMediaCache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp) // Sort by timestamp (oldest first)

      // Remove oldest entries
      const toRemove = entries.slice(0, entries.length - MediaService.MAX_CACHE_ENTRIES + 1)
      for (const [key, value] of toRemove) {
        this.listAllMediaCache.delete(key)
        // Update memory usage estimate
        const estimatedSize = JSON.stringify(value.result).length * 2
        this.cacheMemoryUsage = Math.max(0, this.cacheMemoryUsage - estimatedSize)
      }
      this.cacheMetrics.evictions += toRemove.length
      console.log(`[PERFORMANCE] 🗑️ LRU evicted ${toRemove.length} cache entries by count`)
    }

    // Evict by memory usage
    if (this.cacheMemoryUsage > maxSizeBytes) {
      const entries = Array.from(this.listAllMediaCache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp) // Sort by timestamp (oldest first)

      // Remove entries until under memory limit
      let memoryEvictions = 0
      for (const [key, value] of entries) {
        if (this.cacheMemoryUsage <= maxSizeBytes) break

        this.listAllMediaCache.delete(key)
        const estimatedSize = JSON.stringify(value.result).length * 2
        this.cacheMemoryUsage = Math.max(0, this.cacheMemoryUsage - estimatedSize)
        memoryEvictions++
      }
      this.cacheMetrics.evictions += memoryEvictions
      console.log(`[PERFORMANCE] 🗑️ LRU evicted ${memoryEvictions} entries by memory usage (target: ${maxSizeBytes / 1024 / 1024}MB)`)
    }
  }

  /**
   * ✅ CACHE INVALIDATION: Clear listAllMedia caches
   * Called on write operations and project switches
   */
  clearListAllMediaCaches(): void {
    const entriesCleared = this.listAllMediaCache.size
    const promisesCleared = this.listAllMediaPromises.size

    this.listAllMediaCache.clear()
    this.listAllMediaPromises.clear()
    this.cacheMemoryUsage = 0

    if (entriesCleared > 0 || promisesCleared > 0) {
      console.log(`[PERFORMANCE] 🧹 Cleared listAllMedia caches: ${entriesCleared} entries, ${promisesCleared} promises`)
    }
  }

  /**
   * Get the current size of the media cache
   * Used for optimization decisions in component loading patterns
   */
  getCacheSize(): number {
    return this.mediaCache.size
  }

  /**
   * 📊 MONITORING: Get cache performance metrics
   */
  getCacheMetrics(): typeof this.cacheMetrics & { hitRatio: number; memoryUsageMB: number } {
    const total = this.cacheMetrics.hits + this.cacheMetrics.misses
    const hitRatio = total > 0 ? this.cacheMetrics.hits / total : 0
    const memoryUsageMB = this.cacheMemoryUsage / (1024 * 1024)

    return {
      ...this.cacheMetrics,
      hitRatio: Math.round(hitRatio * 100) / 100, // Round to 2 decimal places
      memoryUsageMB: Math.round(memoryUsageMB * 100) / 100
    }
  }
}

// Export factory function for getting singleton instances
export function createMediaService(projectId: string, fileStorage?: FileStorage, generationMode?: boolean): MediaService {
  return MediaService.getInstance({ projectId, fileStorage, generationMode })
}

// Export as default to replace the old MediaService
export default MediaService