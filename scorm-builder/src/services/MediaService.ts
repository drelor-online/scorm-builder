/**
 * MediaService - Unified media management service
 * 
 * This service consolidates all media handling into a single, simple interface.
 * It replaces the complex FileStorage + FileStorageAdapter + MediaRegistry system
 * with a straightforward API that directly integrates with the Tauri backend.
 */

import { generateMediaId, type MediaType } from '../utils/idGenerator'
import { logger } from '../utils/logger'
import { performanceMonitor } from '../utils/performanceMonitor'
import { retryWithBackoff, RetryStrategies } from '../utils/retryWithBackoff'
import { validateExternalURL, validateYouTubeURL, validateImageURL } from '../utils/urlValidator'
import { sanitizePath, sanitizeFilename, PathSanitizers } from '../utils/pathSanitizerBrowser'
import { hasTauriAPI, getStorageBackend } from '../utils/environment'

// Conditionally import Tauri API only if available
let invoke: (<T = any>(cmd: string, args?: any) => Promise<T>) | null = null
if (hasTauriAPI()) {
  import('@tauri-apps/api/core').then(module => {
    invoke = module.invoke
  })
}

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

export interface ProgressInfo {
  loaded: number
  total: number
  percent: number
  timestamp?: number
  fileIndex?: number
}

export type ProgressCallback = (progress: ProgressInfo) => void

export interface MediaServiceConfig {
  projectId: string
}

// Singleton instance cache
const mediaServiceInstances = new Map<string, MediaService>()

export class MediaService {
  private projectId: string
  private mediaCache: Map<string, MediaItem> = new Map()
  private pageIndex: Map<string, Set<string>> = new Map()
  private storageBackend: 'tauri' | 'indexeddb' | 'memory'
  private indexedDB: IDBDatabase | null = null
  private memoryStorage: Map<string, { data: Uint8Array; metadata: any }> = new Map()
  
  private constructor(config: MediaServiceConfig) {
    this.projectId = config.projectId
    this.storageBackend = getStorageBackend()
    logger.info('[MediaService] Initialized for project:', this.projectId, 'using backend:', this.storageBackend)
    
    // Initialize IndexedDB if needed
    if (this.storageBackend === 'indexeddb') {
      this.initializeIndexedDB()
    }
  }
  
  // Static factory method to get singleton instance per project
  static getInstance(config: MediaServiceConfig): MediaService {
    const existing = mediaServiceInstances.get(config.projectId)
    if (existing) {
      return existing
    }
    
    const instance = new MediaService(config)
    mediaServiceInstances.set(config.projectId, instance)
    return instance
  }
  
  // Clear singleton instance for a project (useful for cleanup)
  static clearInstance(projectId: string): void {
    mediaServiceInstances.delete(projectId)
  }
  
  private async initializeIndexedDB(): Promise<void> {
    try {
      const request = indexedDB.open('MediaServiceDB', 1)
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'id' })
        }
      }
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          this.indexedDB = request.result
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      logger.error('[MediaService] Failed to initialize IndexedDB:', error)
      // Fallback to memory storage
      this.storageBackend = 'memory'
    }
  }
  
  /**
   * Store a media file
   */
  async storeMedia(
    file: File | Blob, 
    pageId: string, 
    type: MediaType,
    metadata?: Partial<MediaMetadata>,
    progressCallback?: ProgressCallback
  ): Promise<MediaItem> {
    // Input validation
    if (!file) {
      throw new Error('File is required')
    }
    
    if (pageId === undefined) {
      throw new Error('Page ID is required')
    }
    
    const validTypes: MediaType[] = ['image', 'video', 'audio', 'caption']
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid media type: ${type}`)
    }
    
    try {
      return await performanceMonitor.measureOperation(
        'MediaService.storeMedia',
        async () => {
    // Validate media type matches file extension if it's a File
    if (file instanceof File) {
      if (!this.validateMediaType(file.name, type)) {
        throw new Error(`File type mismatch: ${file.name} is not a valid ${type} file`)
      }
    }
    
    // Generate consistent ID
    const id = generateMediaId(type, pageId)
    
    // Prepare metadata - strip any sensitive data
    const cleanMetadata = metadata ? this.stripSensitiveData(metadata) : {}
    
    // Sanitize filename
    const originalName = file instanceof File 
      ? this.sanitizePath(file.name) 
      : `${id}.${this.getExtension(file.type || this.getDefaultMimeType(type))}`
    
    const fullMetadata: MediaMetadata = {
      uploadedAt: new Date().toISOString(),
      mimeType: file.type,
      size: file.size,
      originalName,
      pageId,
      type,
      ...cleanMetadata
    }
    
    // Convert to array buffer for Tauri
    const buffer = await file.arrayBuffer()
    const data = new Uint8Array(buffer)
    
    try {
      // Report initial progress
      if (progressCallback) {
        try {
          progressCallback({ loaded: 0, total: file.size, percent: 0 })
        } catch (err) {
          logger.warn('[MediaService] Progress callback error:', err)
        }
      }
      
      // Store in backend based on environment
      await this.storeInBackend(id, data, originalName, file.type)
      
      // Report completion
      if (progressCallback) {
        try {
          progressCallback({ loaded: file.size, total: file.size, percent: 100 })
        } catch (err) {
          logger.warn('[MediaService] Progress callback error:', err)
        }
      }
      
      // Create media item
      const mediaItem: MediaItem = {
        id,
        type,
        pageId,
        fileName: originalName || id,
        metadata: fullMetadata
      }
      
      // Update cache
      this.mediaCache.set(id, mediaItem)
      
      // Update page index
      if (!this.pageIndex.has(pageId)) {
        this.pageIndex.set(pageId, new Set())
      }
      this.pageIndex.get(pageId)!.add(id)
      
      logger.info('[MediaService] Stored media:', id, 'for page:', pageId)
      return mediaItem
      
    } catch (error) {
      logger.error('[MediaService] Failed to store media:', error)
      throw new Error(`Failed to store media: ${error}`)
    }
      },
      {
        mediaType: type,
        pageId: pageId,
        fileSize: file.size,
        largeFile: file.size > 5 * 1024 * 1024 // Flag files > 5MB
      }
    )
    } catch (error) {
      // If performance monitoring fails, log it but continue with the operation
      logger.warn('[MediaService] Performance monitoring failed, continuing without metrics:', error)
      
      // Execute the operation without monitoring
      return this.storeMediaInternal(file, pageId, type, metadata, progressCallback)
    }
  }
  
  // Internal version without performance monitoring
  private async storeMediaInternal(
    file: File | Blob, 
    pageId: string, 
    type: MediaType,
    metadata?: Partial<MediaMetadata>,
    progressCallback?: ProgressCallback
  ): Promise<MediaItem> {
    // Validate media type matches file extension if it's a File
    if (file instanceof File) {
      if (!this.validateMediaType(file.name, type)) {
        throw new Error(`File type mismatch: ${file.name} is not a valid ${type} file`)
      }
    }
    
    // Generate consistent ID
    const id = generateMediaId(type, pageId)
    
    // Prepare metadata - strip any sensitive data
    const cleanMetadata = metadata ? this.stripSensitiveData(metadata) : {}
    
    // Sanitize filename
    const originalName = file instanceof File 
      ? this.sanitizePath(file.name) 
      : `${id}.${this.getExtension(file.type || this.getDefaultMimeType(type))}`
    
    const fullMetadata: MediaMetadata = {
      uploadedAt: new Date().toISOString(),
      mimeType: file.type,
      size: file.size,
      originalName,
      pageId,
      type,
      ...cleanMetadata
    }
    
    // Convert to array buffer for Tauri
    const buffer = await file.arrayBuffer()
    const data = new Uint8Array(buffer)
    
    try {
      // Report initial progress
      if (progressCallback) {
        try {
          progressCallback({ loaded: 0, total: file.size, percent: 0 })
        } catch (err) {
          logger.warn('[MediaService] Progress callback error:', err)
        }
      }
      
      // Store in backend with retry
      await retryWithBackoff(
        async () => {
          await this.storeInBackend(id, data, originalName, file.type)
        },
        {
          ...RetryStrategies.network,
          maxAttempts: 3,
          onRetry: (error, attempt, delay) => {
            logger.warn(`[MediaService] Store media retry attempt ${attempt} in ${delay}ms:`, error)
            if (progressCallback) {
              try {
                // Report retry to user
                progressCallback({ 
                  loaded: 0, 
                  total: file.size, 
                  percent: 0,
                  timestamp: Date.now()
                })
              } catch (err) {
                logger.warn('[MediaService] Progress callback error during retry:', err)
              }
            }
          }
        }
      )
      
      // Report completion
      if (progressCallback) {
        try {
          progressCallback({ loaded: file.size, total: file.size, percent: 100 })
        } catch (err) {
          logger.warn('[MediaService] Progress callback error:', err)
        }
      }
      
      // Create media item
      const mediaItem: MediaItem = {
        id,
        type,
        pageId,
        fileName: originalName || id,
        metadata: fullMetadata
      }
      
      // Update cache
      this.mediaCache.set(id, mediaItem)
      
      // Update page index
      if (!this.pageIndex.has(pageId)) {
        this.pageIndex.set(pageId, new Set())
      }
      this.pageIndex.get(pageId)!.add(id)
      
      logger.info('[MediaService] Stored media:', id, 'for page:', pageId)
      return mediaItem
      
    } catch (error) {
      logger.error('[MediaService] Failed to store media:', error)
      throw new Error(`Failed to store media: ${error}`)
    }
  }
  
  /**
   * Get a media file by ID
   */
  async getMedia(mediaId: string): Promise<{ data: Uint8Array; metadata: MediaMetadata } | null> {
    return performanceMonitor.measureOperation(
      'MediaService.getMedia',
      async () => {
    try {
      // Check cache first
      const cached = this.mediaCache.get(mediaId)
      
      // Get from backend with retry
      const result = await retryWithBackoff(
        async () => this.getFromBackend(mediaId),
        {
          ...RetryStrategies.fast,
          maxAttempts: 2,
          onRetry: (error, attempt, delay) => {
            logger.warn(`[MediaService] Get media retry attempt ${attempt} in ${delay}ms:`, error)
          }
        }
      )
      
      if (!result || !result.data) {
        return null
      }
      
      const data = result.data
      
      // Use cached metadata if available, otherwise use backend metadata
      const metadata = cached?.metadata || result.metadata || {
        uploadedAt: new Date().toISOString(),
        type: this.getTypeFromId(mediaId),
        pageId: this.getPageFromId(mediaId)
      }
      
      return { data, metadata }
      
    } catch (error) {
      logger.error('[MediaService] Failed to get media:', mediaId, error)
      return null
    }
      },
      { mediaId }
    )
  }
  
  /**
   * Delete a media file
   */
  async deleteMedia(mediaId: string): Promise<boolean> {
    return performanceMonitor.measureOperation(
      'MediaService.deleteMedia',
      async () => {
    try {
      await retryWithBackoff(
        async () => this.deleteFromBackend(mediaId),
        {
          ...RetryStrategies.fast,
          maxAttempts: 2,
          onRetry: (error, attempt, delay) => {
            logger.warn(`[MediaService] Delete media retry attempt ${attempt} in ${delay}ms:`, error)
          }
        }
      )
      
      // Remove from cache
      const item = this.mediaCache.get(mediaId)
      if (item) {
        this.mediaCache.delete(mediaId)
        
        // Remove from page index
        const pageSet = this.pageIndex.get(item.pageId)
        if (pageSet) {
          pageSet.delete(mediaId)
          if (pageSet.size === 0) {
            this.pageIndex.delete(item.pageId)
          }
        }
      }
      
      logger.info('[MediaService] Deleted media:', mediaId)
      return true
      
    } catch (error) {
      logger.error('[MediaService] Failed to delete media:', mediaId, error)
      return false
    }
      },
      { mediaId }
    )
  }
  
  /**
   * List all media for a specific page
   */
  async listMediaForPage(pageId: string): Promise<MediaItem[]> {
    try {
      // Get all media for project with retry
      const allMedia = await retryWithBackoff(
        async () => this.listFromBackend(),
        {
          ...RetryStrategies.fast,
          maxAttempts: 2,
          onRetry: (error, attempt, delay) => {
            logger.warn(`[MediaService] List media retry attempt ${attempt} in ${delay}ms:`, error)
          }
        }
      )
      
      // Filter by page ID
      const pageMedia = allMedia
        .filter(item => item.id.startsWith(`${pageId}-`) || this.getPageFromId(item.id) === pageId)
        .map(item => {
          // Check cache first
          const cached = this.mediaCache.get(item.id)
          if (cached) {
            return cached
          }
          
          // Create media item
          const mediaItem: MediaItem = {
            id: item.id,
            type: this.getTypeFromId(item.id),
            pageId: this.getPageFromId(item.id),
            fileName: item.fileName,
            metadata: {
              uploadedAt: new Date().toISOString(),
              mimeType: item.mimeType,
              type: this.getTypeFromId(item.id),
              pageId: this.getPageFromId(item.id)
            }
          }
          
          // Update cache
          this.mediaCache.set(item.id, mediaItem)
          return mediaItem
        })
      
      return pageMedia
      
    } catch (error) {
      logger.error('[MediaService] Failed to list media for page:', pageId, error)
      return []
    }
  }
  
  /**
   * List all media in the project
   */
  async listAllMedia(): Promise<MediaItem[]> {
    return performanceMonitor.measureOperation(
      'MediaService.listAllMedia',
      async () => {
    try {
      const allMedia = await retryWithBackoff(
        async () => this.listFromBackend(),
        {
          ...RetryStrategies.fast,
          maxAttempts: 2,
          onRetry: (error, attempt, delay) => {
            logger.warn(`[MediaService] List all media retry attempt ${attempt} in ${delay}ms:`, error)
          }
        }
      )
      
      return allMedia.map((item: any) => {
        // Check cache first
        const cached = this.mediaCache.get(item.id)
        if (cached) {
          return cached
        }
        
        // Create media item
        const mediaItem: MediaItem = {
          id: item.id,
          type: this.getTypeFromId(item.id),
          pageId: this.getPageFromId(item.id),
          fileName: item.fileName,
          metadata: {
            uploadedAt: new Date().toISOString(),
            mimeType: item.mimeType,
            type: this.getTypeFromId(item.id),
            pageId: this.getPageFromId(item.id)
          }
        }
        
        // Update cache
        this.mediaCache.set(item.id, mediaItem)
        return mediaItem
      })
      
    } catch (error) {
      logger.error('[MediaService] Failed to list all media:', error)
      return []
    }
      },
      { projectId: this.projectId }
    )
  }
  
  /**
   * Create a blob URL for media (for preview/playback)
   */
  async createBlobUrl(mediaId: string): Promise<string | null> {
    return performanceMonitor.measureOperation(
      'MediaService.createBlobUrl',
      async () => {
        const media = await this.getMedia(mediaId)
        if (!media) {
          return null
        }
        
        const blob = new Blob([media.data], { type: media.metadata.mimeType || 'application/octet-stream' })
        return URL.createObjectURL(blob)
      },
      { mediaId }
    )
  }
  
  /**
   * Store a YouTube video reference (no actual file storage)
   */
  async storeYouTubeVideo(
    youtubeUrl: string,
    embedUrl: string,
    pageId: string,
    metadata?: Partial<MediaMetadata>
  ): Promise<MediaItem> {
    return performanceMonitor.measureOperation(
      'MediaService.storeYouTubeVideo',
      async () => {
    // Validate YouTube URL for security
    const youtubeValidation = validateYouTubeURL(youtubeUrl)
    if (!youtubeValidation.valid) {
      throw new Error(`Invalid YouTube URL: ${youtubeValidation.reason}`)
    }
    
    // Also validate embed URL as general external URL
    if (!this.validateExternalUrl(embedUrl)) {
      throw new Error('Invalid or unsafe YouTube embed URL')
    }
    
    const id = generateMediaId('video', pageId)
    
    // Strip sensitive data from metadata
    const cleanMetadata = metadata ? this.stripSensitiveData(metadata) : {}
    
    const fullMetadata: MediaMetadata = {
      uploadedAt: new Date().toISOString(),
      youtubeUrl,
      embedUrl,
      type: 'video',
      pageId,
      ...cleanMetadata
    }
    
    const mediaItem: MediaItem = {
      id,
      type: 'video',
      pageId,
      fileName: youtubeUrl,
      metadata: fullMetadata
    }
    
    // Just cache it, no backend storage needed for YouTube
    this.mediaCache.set(id, mediaItem)
    
    if (!this.pageIndex.has(pageId)) {
      this.pageIndex.set(pageId, new Set())
    }
    this.pageIndex.get(pageId)!.add(id)
    
    logger.info('[MediaService] Stored YouTube video reference:', id, youtubeUrl)
    return mediaItem
      },
      { pageId }
    )
  }
  
  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.mediaCache.clear()
    this.pageIndex.clear()
    logger.info('[MediaService] Cache cleared')
  }
  
  /**
   * Get media statistics
   */
  getStats(): {
    totalItems: number
    itemsByType: Record<MediaType, number>
    itemsByPage: Record<string, number>
  } {
    const items = Array.from(this.mediaCache.values())
    
    const itemsByType = items.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1
      return acc
    }, {} as Record<MediaType, number>)
    
    const itemsByPage = items.reduce((acc, item) => {
      acc[item.pageId] = (acc[item.pageId] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      totalItems: items.length,
      itemsByType,
      itemsByPage
    }
  }
  
  /**
   * Validate an external URL for safety
   * Prevents XSS, SSRF, and other injection attacks
   */
  validateExternalUrl(url: string): boolean {
    const result = validateExternalURL(url, {
      allowedProtocols: ['https:', 'http:'],
      allowLocalhost: false
    })
    
    if (!result.valid) {
      logger.warn('[MediaService] URL validation failed:', result.reason, url)
    }
    
    return result.valid
  }
  
  /**
   * Sanitize a file path to prevent directory traversal attacks
   */
  sanitizePath(path: string): string {
    if (!path || typeof path !== 'string') {
      return ''
    }
    
    // First check if the path is safe
    const pathResult = sanitizePath(path, {
      allowAbsolute: false,
      allowDotFiles: false,
      maxDepth: 5
    })
    
    if (!pathResult.safe) {
      logger.warn('[MediaService] Path sanitization failed:', pathResult.reason)
      // If path is unsafe, just sanitize the filename
      const filename = sanitizeFilename(path)
      return `file_${Date.now()}`
    }
    
    // For safe paths, preserve the directory structure but sanitize filename
    const parts = pathResult.sanitized.split('/')
    if (parts.length > 1) {
      // Sanitize only the filename part
      const dirs = parts.slice(0, -1)
      const filename = sanitizeFilename(parts[parts.length - 1])
      return [...dirs, filename].join('/')
    }
    
    // Single filename
    return sanitizeFilename(pathResult.sanitized)
  }
  
  /**
   * Strip sensitive data from metadata before storage or export
   */
  stripSensitiveData(metadata: Record<string, any>): Record<string, any> {
    const sensitiveKeys = [
      'apikey', 'api_key', 'apiKey',
      'password', 'passwd', 'pwd',
      'token', 'accesstoken', 'access_token',
      'secret', 'secretkey', 'secret_key',
      'privatekey', 'private_key', 'privateKey',
      'credential', 'credentials',
      'auth', 'authorization'
    ]
    
    const cleaned: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase()
      
      // Check if key contains any sensitive keywords
      const isSensitive = sensitiveKeys.some(sensitive => 
        lowerKey.includes(sensitive.toLowerCase())
      )
      
      if (!isSensitive) {
        cleaned[key] = value
      } else {
        logger.warn('[MediaService] Stripped sensitive key from metadata:', key)
      }
    }
    
    return cleaned
  }
  
  /**
   * Validate that media type matches file extension
   */
  validateMediaType(filename: string, type: MediaType): boolean {
    const ext = filename.split('.').pop()?.toLowerCase()
    if (!ext) return false
    
    const typeExtensions: Record<MediaType, string[]> = {
      image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],
      video: ['mp4', 'webm', 'mov', 'avi', 'mkv'],
      audio: ['mp3', 'wav', 'ogg', 'webm', 'm4a', 'flac'],
      caption: ['vtt', 'srt', 'sbv']
    }
    
    const validExtensions = typeExtensions[type] || []
    const isValid = validExtensions.includes(ext)
    
    if (!isValid) {
      logger.warn(`[MediaService] File extension '${ext}' does not match media type '${type}'`)
    }
    
    return isValid
  }

  // Helper methods
  private getExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'text/vtt': 'vtt'
    }
    return extensions[mimeType] || 'bin'
  }
  
  private getDefaultMimeType(type: MediaType): string {
    const defaults: Record<MediaType, string> = {
      'image': 'image/jpeg',
      'video': 'video/mp4',
      'audio': 'audio/mpeg',
      'caption': 'text/vtt'
    }
    return defaults[type] || 'application/octet-stream'
  }
  
  private getTypeFromId(mediaId: string): MediaType {
    if (mediaId.includes('audio')) return 'audio'
    if (mediaId.includes('video')) return 'video'
    if (mediaId.includes('caption')) return 'caption'
    return 'image'
  }
  
  private getPageFromId(mediaId: string): string {
    // Extract page from ID format: 
    // New format: "audio-0-welcome" -> "welcome"
    // Old format: "welcome-audio-0" -> "welcome"
    const parts = mediaId.split('-')
    
    // Check for new format (type-number-page)
    if (parts.length >= 3 && ['audio', 'video', 'image', 'caption'].includes(parts[0])) {
      return parts.slice(2).join('-') // Handle page IDs with dashes like "topic-1"
    }
    
    // Fall back to old format (page-type-number)
    if (parts.length >= 2) {
      return parts[0]
    }
    
    return 'unknown'
  }
  
  /**
   * Store media in the appropriate backend
   */
  private async storeInBackend(id: string, data: Uint8Array, fileName: string, mimeType: string): Promise<void> {
    switch (this.storageBackend) {
      case 'tauri':
        if (!invoke) {
          throw new Error('Tauri API not available')
        }
        await invoke('store_media', {
          project_id: this.projectId,
          media_id: id,
          data: Array.from(data), // Convert to array for Tauri
          file_name: fileName,
          mime_type: mimeType
        })
        break
        
      case 'indexeddb':
        if (!this.indexedDB) {
          throw new Error('IndexedDB not initialized')
        }
        
        const transaction = this.indexedDB.transaction(['media'], 'readwrite')
        const store = transaction.objectStore('media')
        
        await new Promise((resolve, reject) => {
          const request = store.put({
            id: `${this.projectId}_${id}`,
            data: data,
            fileName: fileName,
            mimeType: mimeType,
            timestamp: Date.now()
          })
          
          request.onsuccess = () => resolve(undefined)
          request.onerror = () => reject(request.error)
        })
        break
        
      case 'memory':
        this.memoryStorage.set(`${this.projectId}_${id}`, {
          data: data,
          metadata: { fileName, mimeType }
        })
        break
    }
  }
  
  /**
   * Get media from the appropriate backend
   */
  private async getFromBackend(id: string): Promise<{ data: Uint8Array; metadata: any } | null> {
    switch (this.storageBackend) {
      case 'tauri':
        if (!invoke) {
          return null
        }
        
        try {
          const result = await invoke<{ data: number[]; metadata: any }>('get_media', {
            project_id: this.projectId,
            media_id: id
          })
          
          if (!result || !result.data) return null
          
          return {
            data: new Uint8Array(result.data),
            metadata: result.metadata
          }
        } catch {
          return null
        }
        
      case 'indexeddb':
        if (!this.indexedDB) return null
        
        const transaction = this.indexedDB.transaction(['media'], 'readonly')
        const store = transaction.objectStore('media')
        
        return new Promise((resolve) => {
          const request = store.get(`${this.projectId}_${id}`)
          
          request.onsuccess = () => {
            const result = request.result
            if (!result) {
              resolve(null)
            } else {
              resolve({
                data: result.data,
                metadata: { fileName: result.fileName, mimeType: result.mimeType }
              })
            }
          }
          
          request.onerror = () => resolve(null)
        })
        
      case 'memory':
        const stored = this.memoryStorage.get(`${this.projectId}_${id}`)
        return stored || null
    }
  }
  
  /**
   * Delete media from the appropriate backend
   */
  private async deleteFromBackend(id: string): Promise<void> {
    switch (this.storageBackend) {
      case 'tauri':
        if (!invoke) return
        
        try {
          await invoke('delete_media', {
            project_id: this.projectId,
            media_id: id
          })
        } catch {
          // Ignore errors
        }
        break
        
      case 'indexeddb':
        if (!this.indexedDB) return
        
        const transaction = this.indexedDB.transaction(['media'], 'readwrite')
        const store = transaction.objectStore('media')
        store.delete(`${this.projectId}_${id}`)
        break
        
      case 'memory':
        this.memoryStorage.delete(`${this.projectId}_${id}`)
        break
    }
  }
  
  /**
   * List all media from the appropriate backend
   */
  private async listFromBackend(): Promise<Array<{ id: string; fileName: string; mimeType: string }>> {
    switch (this.storageBackend) {
      case 'tauri':
        if (!invoke) return []
        
        try {
          return await invoke<Array<{ id: string; fileName: string; mimeType: string }>>('list_media', {
            project_id: this.projectId
          })
        } catch {
          return []
        }
        
      case 'indexeddb':
        if (!this.indexedDB) return []
        
        const transaction = this.indexedDB.transaction(['media'], 'readonly')
        const store = transaction.objectStore('media')
        
        return new Promise((resolve) => {
          const request = store.getAll()
          
          request.onsuccess = () => {
            const results = request.result || []
            const projectPrefix = `${this.projectId}_`
            
            resolve(
              results
                .filter(item => item.id.startsWith(projectPrefix))
                .map(item => ({
                  id: item.id.substring(projectPrefix.length),
                  fileName: item.fileName || '',
                  mimeType: item.mimeType || ''
                }))
            )
          }
          
          request.onerror = () => resolve([])
        })
        
      case 'memory':
        const projectPrefix = `${this.projectId}_`
        return Array.from(this.memoryStorage.entries())
          .filter(([key]) => key.startsWith(projectPrefix))
          .map(([key, value]) => ({
            id: key.substring(projectPrefix.length),
            fileName: value.metadata?.fileName || '',
            mimeType: value.metadata?.mimeType || ''
          }))
    }
  }
}

// Export a factory function for getting singleton instances
export function createMediaService(projectId: string): MediaService {
  return MediaService.getInstance({ projectId })
}