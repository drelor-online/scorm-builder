/**
 * Manages blob URLs to persist them across component lifecycles
 * This prevents blob URLs from being lost when components unmount
 */
class BlobUrlManager {
  private urls: Map<string, string> = new Map()
  private refCounts: Map<string, number> = new Map()

  /**
   * Create or retrieve a blob URL for a given key
   * @param key Unique identifier for this blob URL
   * @param blob The blob to create a URL for
   * @returns The blob URL
   */
  getOrCreateUrl(key: string, blob: Blob): string {
    const existingUrl = this.urls.get(key)
    
    if (existingUrl) {
      // Increment reference count
      const currentCount = this.refCounts.get(key) || 0
      this.refCounts.set(key, currentCount + 1)
      return existingUrl
    }

    // Create new URL
    const url = URL.createObjectURL(blob)
    this.urls.set(key, url)
    this.refCounts.set(key, 1)
    
    return url
  }

  /**
   * Release a reference to a blob URL
   * The URL is only revoked when all references are released
   * @param key The key of the URL to release
   */
  releaseUrl(key: string): void {
    const refCount = this.refCounts.get(key) || 0
    
    if (refCount <= 1) {
      // Last reference, revoke the URL
      const url = this.urls.get(key)
      if (url) {
        URL.revokeObjectURL(url)
        this.urls.delete(key)
        this.refCounts.delete(key)
      }
    } else {
      // Decrement reference count
      this.refCounts.set(key, refCount - 1)
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
   * @returns The URL if it exists, undefined otherwise
   */
  getUrl(key: string): string | undefined {
    return this.urls.get(key)
  }

  /**
   * Clear all URLs (use with caution)
   */
  clearAll(): void {
    this.urls.forEach(url => URL.revokeObjectURL(url))
    this.urls.clear()
    this.refCounts.clear()
  }
}

// Create a singleton instance
export const blobUrlManager = new BlobUrlManager()