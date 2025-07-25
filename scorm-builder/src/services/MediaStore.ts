import { invoke } from '@tauri-apps/api/core'
import { mediaUrlService } from './mediaUrl'

export interface MediaMetadata {
  page_id: string
  type: 'image' | 'video' | 'audio'
  original_name: string
  mime_type?: string
  source?: 'upload' | 'search' | 'library'
  embed_url?: string // For YouTube videos
  title?: string
}

export interface MediaData {
  id: string
  data: Uint8Array
  metadata: MediaMetadata
}

export interface CachedMedia {
  id: string
  url: string // Protocol URL: scorm-media://projectId/mediaId
  metadata: MediaMetadata
}

export class MediaStore {
  private mediaCache = new Map<string, CachedMedia>()
  private projectId: string | null = null
  private loadPromise: Promise<void> | null = null

  async loadProject(projectId: string, onProgress?: (loaded: number, total: number) => void) {
    // If already loading this project, return existing promise
    if (this.projectId === projectId && this.loadPromise) {
      return this.loadPromise
    }

    // Clean up previous project
    if (this.projectId && this.projectId !== projectId) {
      this.cleanup()
    }

    this.projectId = projectId
    
    // Create load promise that other callers can await
    this.loadPromise = this.loadMediaFromBackend(projectId, onProgress)
    
    try {
      await this.loadPromise
    } finally {
      this.loadPromise = null
    }
  }

  private async loadMediaFromBackend(projectId: string, onProgress?: (loaded: number, total: number) => void) {
    try {
      console.log('[MediaStore] Loading media for project:', projectId)
      
      // Get all media for the project
      const mediaList: MediaData[] = await invoke('get_all_project_media', { projectId })
      
      console.log('[MediaStore] Loaded', mediaList.length, 'media items')
      
      // Create blob URLs once and cache them
      let loaded = 0
      const total = mediaList.length
      
      for (const media of mediaList) {
        // Generate URL for accessing the media file
        const url = await mediaUrlService.getMediaUrl(projectId, media.id)
        
        if (!url) {
          console.error('[MediaStore] Failed to generate URL for:', media.id)
          continue
        }
        
        this.mediaCache.set(media.id, {
          id: media.id,
          url,
          metadata: media.metadata
        })
        
        console.log('[MediaStore] Cached media:', media.id, 'type:', media.metadata.type, 'url:', url)
        
        loaded++
        onProgress?.(loaded, total)
      }
    } catch (error) {
      console.error('[MediaStore] Failed to load media:', error)
      throw error
    }
  }

  getMimeType(type: string, filename?: string): string {
    // Try to determine from filename first
    if (filename) {
      const ext = filename.split('.').pop()?.toLowerCase()
      switch (ext) {
        case 'jpg':
        case 'jpeg':
          return 'image/jpeg'
        case 'png':
          return 'image/png'
        case 'gif':
          return 'image/gif'
        case 'webp':
          return 'image/webp'
        case 'svg':
          return 'image/svg+xml'
        case 'mp3':
          return 'audio/mpeg'
        case 'mp4':
          return 'video/mp4'
        case 'webm':
          return 'video/webm'
      }
    }
    
    // Fall back to type
    switch (type) {
      case 'image':
        return 'image/jpeg'
      case 'audio':
        return 'audio/mpeg'
      case 'video':
        return 'video/mp4'
      default:
        return 'application/octet-stream'
    }
  }

  async storeMedia(
    id: string,
    data: ArrayBuffer | Blob,
    metadata: MediaMetadata
  ): Promise<void> {
    if (!this.projectId) {
      throw new Error('No project loaded')
    }

    // Convert to Uint8Array for Tauri
    let uint8Array: Uint8Array
    if (data instanceof Blob) {
      const buffer = await data.arrayBuffer()
      uint8Array = new Uint8Array(buffer)
    } else {
      uint8Array = new Uint8Array(data)
    }

    // Store in backend
    await invoke('store_media', {
      id,
      projectId: this.projectId,
      data: Array.from(uint8Array), // Tauri expects regular array
      metadata
    })

    // Add to cache with file URL
    const url = await mediaUrlService.getMediaUrl(this.projectId, id)
    
    if (!url) {
      throw new Error('Failed to generate file URL')
    }
    
    this.mediaCache.set(id, {
      id,
      url,
      metadata
    })
    
    console.log('[MediaStore] Stored media:', id, 'type:', metadata.type)
  }

  async deleteMedia(id: string): Promise<void> {
    if (!this.projectId) {
      throw new Error('No project loaded')
    }

    // Delete from backend
    await invoke('delete_media', {
      projectId: this.projectId,
      mediaId: id
    })

    // Remove from cache
    this.mediaCache.delete(id)
    
    console.log('[MediaStore] Deleted media:', id)
  }

  getMedia(id: string): CachedMedia | undefined {
    return this.mediaCache.get(id)
  }

  getMediaUrl(id: string): string | undefined {
    return this.mediaCache.get(id)?.url
  }

  getMediaByPage(pageId: string): CachedMedia[] {
    const results: CachedMedia[] = []
    
    for (const media of this.mediaCache.values()) {
      if (media.metadata.page_id === pageId) {
        results.push(media)
      }
    }
    
    return results
  }

  getAllMedia(): Map<string, CachedMedia> {
    return new Map(this.mediaCache)
  }

  cleanup() {
    console.log('[MediaStore] Cleaning up', this.mediaCache.size, 'media entries')
    
    // Clear cache
    this.mediaCache.clear()
    this.projectId = null
    
    // Clear URL cache
    mediaUrlService.clearCache()
  }
}

// Singleton instance
export const mediaStore = new MediaStore()