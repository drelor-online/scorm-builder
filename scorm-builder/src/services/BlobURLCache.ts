import { logger } from '../utils/logger'

/**
 * Global singleton cache for blob URLs to prevent repeated media loading
 * and improve performance across page navigation.
 */
export class BlobURLCache {
  private static instance: BlobURLCache | null = null
  private cache: Map<string, string> = new Map()
  private debugEnabled = true

  private constructor() {
    this.log('BlobURLCache initialized')
  }

  static getInstance(): BlobURLCache {
    if (!BlobURLCache.instance) {
      BlobURLCache.instance = new BlobURLCache()
    }
    return BlobURLCache.instance
  }

  private log(...args: any[]): void {
    if (this.debugEnabled) {
      console.log('[BlobURLCache]', ...args)
    }
  }

  /**
   * Get or create a blob URL for the given media ID
   * @param mediaId - The media ID to get/create URL for
   * @param fetcher - Async function to fetch media data if not cached
   * @returns The blob URL or null if creation failed
   */
  async getOrCreate(
    mediaId: string,
    fetcher: () => Promise<{ data: Uint8Array; mimeType: string } | null>
  ): Promise<string | null> {
    try {
      // Check if already cached
      const cached = this.cache.get(mediaId)
      if (cached) {
        this.log(`Cache hit for ${mediaId}:`, cached)
        return cached
      }

      // Fetch the media data
      this.log(`Cache miss for ${mediaId}, fetching data...`)
      const mediaData = await fetcher()
      
      if (!mediaData || !mediaData.data) {
        this.log(`No data available for ${mediaId}`)
        return null
      }

      // Create blob URL - ensure data is properly typed
      const blob = new Blob([new Uint8Array(mediaData.data)], { type: mediaData.mimeType })
      const url = URL.createObjectURL(blob)
      
      // Cache it
      this.cache.set(mediaId, url)
      this.log(`Created and cached blob URL for ${mediaId}:`, url, `(${blob.size} bytes)`)
      
      return url
    } catch (error) {
      logger.error('[BlobURLCache] Failed to get/create blob URL:', error)
      return null
    }
  }

  /**
   * Get a cached blob URL without creating one
   */
  get(mediaId: string): string | null {
    return this.cache.get(mediaId) || null
  }

  /**
   * Revoke a specific blob URL and remove from cache
   */
  revoke(mediaId: string): void {
    const url = this.cache.get(mediaId)
    if (url) {
      try {
        URL.revokeObjectURL(url)
        this.log(`Revoked blob URL for ${mediaId}:`, url)
      } catch (error) {
        logger.warn('[BlobURLCache] Failed to revoke URL:', error)
      }
      this.cache.delete(mediaId)
    }
  }

  /**
   * Clear all cached blob URLs
   */
  clear(): void {
    this.log(`Clearing all ${this.cache.size} cached URLs`)
    for (const [mediaId, url] of this.cache.entries()) {
      try {
        URL.revokeObjectURL(url)
      } catch (error) {
        logger.warn(`[BlobURLCache] Failed to revoke URL for ${mediaId}:`, error)
      }
    }
    this.cache.clear()
  }

  /**
   * Clear blob URLs for a specific project
   */
  clearProject(projectId: string): void {
    const prefix = `${projectId}_`
    const toDelete: string[] = []
    
    for (const [mediaId, url] of this.cache.entries()) {
      if (mediaId.startsWith(prefix)) {
        try {
          URL.revokeObjectURL(url)
          this.log(`Revoked project URL for ${mediaId}:`, url)
        } catch (error) {
          logger.warn(`[BlobURLCache] Failed to revoke URL for ${mediaId}:`, error)
        }
        toDelete.push(mediaId)
      }
    }
    
    toDelete.forEach(id => this.cache.delete(id))
    this.log(`Cleared ${toDelete.length} URLs for project ${projectId}`)
  }

  /**
   * Preload multiple media items in parallel
   */
  async preloadMedia(
    mediaIds: string[],
    fetcher: (id: string) => Promise<{ data: Uint8Array; mimeType: string } | null>
  ): Promise<(string | null)[]> {
    this.log(`Preloading ${mediaIds.length} media items...`)
    
    const promises = mediaIds.map(async (id) => {
      try {
        return await this.getOrCreate(id, () => fetcher(id))
      } catch (error) {
        logger.error(`[BlobURLCache] Failed to preload ${id}:`, error)
        return null
      }
    })
    
    const results = await Promise.all(promises)
    this.log(`Preloaded ${results.filter(r => r !== null).length}/${mediaIds.length} items successfully`)
    return results
  }

  /**
   * Get the current cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Debug method to get all cached IDs
   */
  getCachedIds(): string[] {
    return Array.from(this.cache.keys())
  }
}