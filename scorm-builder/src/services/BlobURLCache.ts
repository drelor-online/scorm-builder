import { logger } from '../utils/logger'

interface CacheEntry {
  url: string
  size: number
  createdAt: number
  lastAccessed: number
}

interface MemoryUsage {
  totalBytes: number
  itemCount: number
}

interface MemoryStats {
  itemCount: number
  totalBytes: number
  maxSize: number
  memoryThreshold: number
  averageItemSize: number
  oldestItemAge: number
  newestItemAge: number
}

interface PerformanceStats {
  hitRatio: number
  totalRequests: number
  hits: number
  misses: number
}

/**
 * Global singleton cache for blob URLs with LRU eviction and memory management
 * to prevent memory leaks in long-running sessions.
 */
export class BlobURLCache {
  private static instance: BlobURLCache | null = null
  private cache: Map<string, CacheEntry> = new Map()
  private debugEnabled = true
  private maxSize = 50 // Default max items
  private memoryThreshold = 100 * 1024 * 1024 // Default 100MB
  private maxAge = 24 * 60 * 60 * 1000 // Default 24 hours
  
  // Performance tracking
  private totalRequests = 0
  private hits = 0
  private misses = 0

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
      this.totalRequests++
      
      // Check if already cached
      const cached = this.cache.get(mediaId)
      if (cached) {
        this.hits++
        cached.lastAccessed = Date.now()
        this.log(`Cache hit for ${mediaId}:`, cached.url)
        return cached.url
      }

      this.misses++
      
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
      
      const now = Date.now()
      const entry: CacheEntry = {
        url,
        size: blob.size,
        createdAt: now,
        lastAccessed: now
      }
      
      // Check if we need to evict before adding
      this.ensureCapacity()
      
      // Cache it
      this.cache.set(mediaId, entry)
      this.log(`Created and cached blob URL for ${mediaId}:`, url, `(${blob.size} bytes)`)
      
      // Check memory threshold after adding
      this.checkMemoryThreshold()
      
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
    this.totalRequests++
    const cached = this.cache.get(mediaId)
    if (cached) {
      this.hits++
      cached.lastAccessed = Date.now()
      return cached.url
    }
    this.misses++
    return null
  }

  /**
   * Revoke a specific blob URL and remove from cache
   */
  revoke(mediaId: string): void {
    const entry = this.cache.get(mediaId)
    if (entry) {
      try {
        URL.revokeObjectURL(entry.url)
        this.log(`Revoked blob URL for ${mediaId}:`, entry.url)
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
    for (const [mediaId, entry] of this.cache.entries()) {
      try {
        URL.revokeObjectURL(entry.url)
      } catch (error) {
        logger.warn(`[BlobURLCache] Failed to revoke URL for ${mediaId}:`, error)
      }
    }
    this.cache.clear()
    this.resetStats()
  }

  /**
   * Clear blob URLs for a specific project
   */
  clearProject(projectId: string): void {
    const prefix = `${projectId}_`
    const toDelete: string[] = []
    
    for (const [mediaId, entry] of this.cache.entries()) {
      if (mediaId.startsWith(prefix)) {
        try {
          URL.revokeObjectURL(entry.url)
          this.log(`Revoked project URL for ${mediaId}:`, entry.url)
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
   * Clear all blob URLs (for project switching or session reset)
   */
  clearAll(): void {
    const totalCount = this.cache.size
    
    for (const [mediaId, entry] of this.cache.entries()) {
      try {
        URL.revokeObjectURL(entry.url)
        this.log(`Revoked URL for ${mediaId}:`, entry.url)
      } catch (error) {
        logger.warn(`[BlobURLCache] Failed to revoke URL for ${mediaId}:`, error)
      }
    }
    
    this.cache.clear()
    this.resetStats()
    this.log(`Cleared all ${totalCount} blob URLs`)
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

  // Configuration methods
  setMaxSize(size: number): void {
    this.maxSize = size
    this.ensureCapacity()
  }

  setMemoryThreshold(bytes: number): void {
    this.memoryThreshold = bytes
    this.checkMemoryThreshold()
  }

  setMaxAge(milliseconds: number): void {
    this.maxAge = milliseconds
  }

  // Memory usage tracking
  getMemoryUsage(): MemoryUsage {
    let totalBytes = 0
    for (const entry of this.cache.values()) {
      totalBytes += entry.size
    }
    return {
      totalBytes,
      itemCount: this.cache.size
    }
  }

  getMemoryStats(): MemoryStats {
    const usage = this.getMemoryUsage()
    const now = Date.now()
    let oldestAge = 0
    let newestAge = 0

    if (this.cache.size > 0) {
      const ages = Array.from(this.cache.values()).map(entry => now - entry.createdAt)
      oldestAge = Math.max(...ages)
      newestAge = Math.min(...ages)
    }

    return {
      itemCount: usage.itemCount,
      totalBytes: usage.totalBytes,
      maxSize: this.maxSize,
      memoryThreshold: this.memoryThreshold,
      averageItemSize: usage.itemCount > 0 ? usage.totalBytes / usage.itemCount : 0,
      oldestItemAge: oldestAge,
      newestItemAge: newestAge
    }
  }

  getPerformanceStats(): PerformanceStats {
    return {
      hitRatio: this.totalRequests > 0 ? this.hits / this.totalRequests : 0,
      totalRequests: this.totalRequests,
      hits: this.hits,
      misses: this.misses
    }
  }

  // Cleanup methods
  cleanupExpired(): void {
    const now = Date.now()
    const toDelete: string[] = []

    for (const [mediaId, entry] of this.cache.entries()) {
      if (now - entry.createdAt > this.maxAge) {
        try {
          URL.revokeObjectURL(entry.url)
          this.log(`Cleaning up expired URL for ${mediaId}`)
        } catch (error) {
          logger.warn(`[BlobURLCache] Failed to revoke expired URL for ${mediaId}:`, error)
        }
        toDelete.push(mediaId)
      }
    }

    toDelete.forEach(id => this.cache.delete(id))
    this.log(`Cleaned up ${toDelete.length} expired URLs`)
  }

  cleanupOldest(count: number): void {
    if (count <= 0 || this.cache.size === 0) return

    // Sort by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries())
    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)

    const toDelete = entries.slice(0, Math.min(count, entries.length))

    for (const [mediaId, entry] of toDelete) {
      try {
        URL.revokeObjectURL(entry.url)
        this.log(`Cleaning up oldest URL for ${mediaId}`)
      } catch (error) {
        logger.warn(`[BlobURLCache] Failed to revoke URL for ${mediaId}:`, error)
      }
      this.cache.delete(mediaId)
    }

    this.log(`Cleaned up ${toDelete.length} oldest URLs`)
  }

  // Private helper methods
  private ensureCapacity(): void {
    while (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }
  }

  private checkMemoryThreshold(): void {
    const usage = this.getMemoryUsage()
    if (usage.totalBytes > this.memoryThreshold) {
      this.log(`Memory threshold exceeded (${usage.totalBytes} > ${this.memoryThreshold}), auto-evicting...`)
      while (this.getMemoryUsage().totalBytes > this.memoryThreshold && this.cache.size > 0) {
        this.evictLRU()
      }
    }
  }

  private evictLRU(): void {
    if (this.cache.size === 0) return

    // Find the least recently used item
    let oldestMediaId = ''
    let oldestTime = Date.now()

    for (const [mediaId, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestMediaId = mediaId
      }
    }

    if (oldestMediaId) {
      const entry = this.cache.get(oldestMediaId)!
      try {
        URL.revokeObjectURL(entry.url)
        this.log(`Evicted LRU item ${oldestMediaId}`)
      } catch (error) {
        logger.warn(`[BlobURLCache] Failed to revoke evicted URL for ${oldestMediaId}:`, error)
      }
      this.cache.delete(oldestMediaId)
    }
  }

  private resetStats(): void {
    this.totalRequests = 0
    this.hits = 0
    this.misses = 0
  }
}