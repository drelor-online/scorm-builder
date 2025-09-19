/**
 * BlobURLManager - Enhanced blob URL lifecycle management
 * 
 * This utility provides proper blob URL tracking and cleanup to prevent memory leaks.
 * It includes automatic cleanup on page unload and after specified timeouts.
 */

import { logger } from './logger'

interface BlobURLEntry {
  url: string
  createdAt: number
  lastAccessed: number
  refCount: number
  size?: number
  mediaId?: string
  metadata?: Record<string, any>
}

class BlobUrlManager {
  private urls: Map<string, string> = new Map() // key -> url (for backward compatibility)
  private refCounts: Map<string, number> = new Map() // key -> refCount (for backward compatibility)
  
  // Enhanced tracking
  private registry = new Map<string, BlobURLEntry>() // url -> entry
  private keyToUrl = new Map<string, string>() // key -> url
  private cleanupTimer: number | null = null
  private readonly cleanupInterval = 30 * 60 * 1000 // 30 minutes
  private readonly maxAge = 60 * 60 * 1000 // 1 hour
  private readonly maxInactiveTime = 30 * 60 * 1000 // 30 minutes
  private lockedUrls = new Set<string>() // URLs locked from cleanup

  constructor() {
    // Don't start cleanup timer until URLs are created
    // Timer will be started automatically when first URL is created

    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.cleanup)
      window.addEventListener('pagehide', this.cleanup)
    }
  }

  /**
   * Create or retrieve a blob URL for a given key
   * @param key Unique identifier for this blob URL
   * @param blob The blob to create a URL for
   * @param metadata Optional metadata to store with the URL
   * @returns The blob URL
   */
  getOrCreateUrl(key: string, blob: Blob, metadata?: Record<string, any>): string {
    const existingUrl = this.urls.get(key)
    
    if (existingUrl) {
      // Update access time
      const entry = this.registry.get(existingUrl)
      if (entry) {
        entry.lastAccessed = Date.now()
        entry.refCount++
      }
      
      // Increment reference count (backward compatibility)
      const currentCount = this.refCounts.get(key) || 0
      this.refCounts.set(key, currentCount + 1)
      
      return existingUrl
    }

    // Create new URL
    const url = URL.createObjectURL(blob)
    const now = Date.now()
    
    // Store in both old and new structures
    this.urls.set(key, url)
    this.refCounts.set(key, 1)
    
    // Enhanced tracking
    this.registry.set(url, {
      url,
      createdAt: now,
      lastAccessed: now,
      refCount: 1,
      size: blob.size,
      mediaId: key,
      metadata
    })
    this.keyToUrl.set(key, url)

    // Start cleanup timer if this is the first URL
    if (this.registry.size === 1) {
      this.startCleanupTimer()
    }

    logger.debug('[BlobURLManager] Created blob URL:', { key, url, size: blob.size })

    return url
  }

  /**
   * Public method to revoke/release a blob URL
   * @param key The key of the URL to revoke
   */
  revokeUrl(key: string): void {
    this.releaseUrl(key)
  }

  /**
   * Release a reference to a blob URL
   * The URL is only revoked when all references are released
   * @param key The key of the URL to release
   */
  releaseUrl(key: string): void {
    const refCount = this.refCounts.get(key) || 0
    const url = this.urls.get(key)
    
    if (refCount <= 1) {
      // Last reference, revoke the URL
      if (url) {
        this.revokeUrlInternal(url)
        this.urls.delete(key)
        this.refCounts.delete(key)
        this.keyToUrl.delete(key)

        // Stop cleanup timer if no URLs remain
        if (this.registry.size === 0) {
          this.stopCleanupTimer()
        }
      }
    } else {
      // Decrement reference count
      this.refCounts.set(key, refCount - 1)
      
      // Update entry if exists
      if (url) {
        const entry = this.registry.get(url)
        if (entry) {
          entry.refCount--
        }
      }
    }
  }

  /**
   * Check if a URL exists for a given key
   * @param key The key to check
   * @returns Whether a URL exists for this key
   */
  hasUrl(key: string): boolean {
    return this.urls.has(key)
  }

  /**
   * Get an existing URL without creating a new one
   * @param key The key to look up
   * @returns The URL if it exists, null otherwise
   */
  getUrl(key: string): string | null {
    const url = this.urls.get(key)
    
    // Update access time if found
    if (url) {
      const entry = this.registry.get(url)
      if (entry) {
        entry.lastAccessed = Date.now()
      }
    }
    
    return url || null
  }

  /**
   * Lock a URL to prevent it from being cleaned up
   * @param key The key of the URL to lock
   */
  lockUrl(key: string): void {
    const url = this.urls.get(key)
    if (url) {
      this.lockedUrls.add(url)
      logger.debug('[BlobURLManager] Locked blob URL:', url)
    }
  }

  /**
   * Unlock a URL to allow it to be cleaned up
   * @param key The key of the URL to unlock
   */
  unlockUrl(key: string): void {
    const url = this.urls.get(key)
    if (url) {
      this.lockedUrls.delete(url)
      logger.debug('[BlobURLManager] Unlocked blob URL:', url)
    }
  }

  /**
   * Lock all currently registered URLs (useful during critical operations)
   */
  lockAll(): void {
    this.registry.forEach((_, url) => {
      this.lockedUrls.add(url)
    })
    logger.info('[BlobURLManager] Locked all blob URLs:', this.lockedUrls.size)
  }

  /**
   * Unlock all URLs
   */
  unlockAll(): void {
    const count = this.lockedUrls.size
    this.lockedUrls.clear()
    logger.info('[BlobURLManager] Unlocked all blob URLs:', count)
  }

  /**
   * Revoke a specific blob URL
   */
  private revokeUrlInternal(url: string): void {
    // Don't revoke locked URLs
    if (this.lockedUrls.has(url)) {
      logger.debug('[BlobURLManager] Skipping revocation of locked URL:', url)
      return
    }
    
    try {
      URL.revokeObjectURL(url)
      this.registry.delete(url)
      logger.debug('[BlobURLManager] Revoked blob URL:', url)
    } catch (error) {
      logger.error('[BlobURLManager] Error revoking URL:', url, error)
    }
  }

  /**
   * Clean up old or inactive URLs
   */
  cleanupOldUrls(): void {
    const now = Date.now()
    const urlsToRevoke: string[] = []
    
    this.registry.forEach((entry, url) => {
      // Skip locked URLs
      if (this.lockedUrls.has(url)) {
        return
      }
      
      const age = now - entry.createdAt
      const inactiveTime = now - entry.lastAccessed
      
      // Clean up if too old or inactive
      if (age > this.maxAge || (inactiveTime > this.maxInactiveTime && entry.refCount === 0)) {
        urlsToRevoke.push(url)
      }
    })
    
    // Revoke old URLs
    urlsToRevoke.forEach(url => {
      const entry = this.registry.get(url)
      if (entry && entry.mediaId) {
        // Clean up from backward compatibility maps
        this.urls.delete(entry.mediaId)
        this.refCounts.delete(entry.mediaId)
        this.keyToUrl.delete(entry.mediaId)
      }
      this.revokeUrlInternal(url)
    })
    
    if (urlsToRevoke.length > 0) {
      logger.info('[BlobURLManager] Cleaned up', urlsToRevoke.length, 'old/inactive blob URLs')
    }
  }

  /**
   * Clean up all URLs (called on page unload)
   */
  cleanup = (): void => {
    logger.info('[BlobURLManager] Cleaning up all blob URLs:', this.urls.size)
    
    // Revoke all URLs
    this.registry.forEach((_, url) => {
      try {
        URL.revokeObjectURL(url)
      } catch (error) {
        // Ignore errors during cleanup
      }
    })
    
    // Clear all maps
    this.urls.clear()
    this.refCounts.clear()
    this.registry.clear()
    this.keyToUrl.clear()
    
    // Stop cleanup timer
    this.stopCleanupTimer()
  }

  /**
   * Clear all URLs (use with caution)
   */
  clearAll(): void {
    this.cleanup()
  }

  /**
   * Get statistics about blob URLs
   */
  getStats(): {
    totalUrls: number
    totalSize: number
    averageAge: number
    inactiveUrls: number
  } {
    const now = Date.now()
    let totalSize = 0
    let totalAge = 0
    let inactiveCount = 0
    
    this.registry.forEach(entry => {
      totalSize += entry.size || 0
      totalAge += now - entry.createdAt
      
      if (now - entry.lastAccessed > this.maxInactiveTime) {
        inactiveCount++
      }
    })
    
    return {
      totalUrls: this.registry.size,
      totalSize,
      averageAge: this.registry.size > 0 ? totalAge / this.registry.size : 0,
      inactiveUrls: inactiveCount
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer === null && typeof window !== 'undefined') {
      this.cleanupTimer = window.setInterval(() => {
        this.cleanupOldUrls()
      }, this.cleanupInterval)
    }
  }

  /**
   * Stop automatic cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer !== null) {
      window.clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }
}

// Create a singleton instance
export const blobUrlManager = new BlobUrlManager()