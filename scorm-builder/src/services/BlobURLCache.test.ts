import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BlobURLCache } from './BlobURLCache'

describe('BlobURLCache', () => {
  let cache: BlobURLCache
  let revokeObjectURLSpy: any

  beforeEach(() => {
    // Reset singleton instance
    (BlobURLCache as any).instance = null
    cache = BlobURLCache.getInstance()
    
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn((blob) => `blob:mock-url-${Math.random()}`)
    revokeObjectURLSpy = vi.spyOn(global.URL, 'revokeObjectURL')
  })

  afterEach(() => {
    cache.clear()
    vi.restoreAllMocks()
  })

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = BlobURLCache.getInstance()
      const instance2 = BlobURLCache.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('getOrCreate', () => {
    it('should create a new blob URL if not cached', async () => {
      const mediaId = 'test-media-1'
      const data = new Uint8Array([1, 2, 3])
      const mimeType = 'image/jpeg'

      const url = await cache.getOrCreate(mediaId, async () => ({
        data,
        mimeType
      }))

      expect(url).toMatch(/^blob:mock-url-/)
      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1)
    })

    it('should return cached URL on subsequent calls', async () => {
      const mediaId = 'test-media-1'
      const data = new Uint8Array([1, 2, 3])
      const mimeType = 'image/jpeg'

      const url1 = await cache.getOrCreate(mediaId, async () => ({
        data,
        mimeType
      }))

      const url2 = await cache.getOrCreate(mediaId, async () => ({
        data: new Uint8Array([4, 5, 6]), // Different data
        mimeType: 'image/png' // Different mime type
      }))

      expect(url1).toBe(url2)
      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1) // Only called once
    })

    it('should handle null data gracefully', async () => {
      const mediaId = 'test-media-1'

      const url = await cache.getOrCreate(mediaId, async () => null)

      expect(url).toBeNull()
      expect(global.URL.createObjectURL).not.toHaveBeenCalled()
    })

    it('should handle errors in data fetcher', async () => {
      const mediaId = 'test-media-1'
      const error = new Error('Failed to fetch media')

      const url = await cache.getOrCreate(mediaId, async () => {
        throw error
      })

      expect(url).toBeNull()
      expect(global.URL.createObjectURL).not.toHaveBeenCalled()
    })
  })

  describe('get', () => {
    it('should return cached URL if exists', async () => {
      const mediaId = 'test-media-1'
      const data = new Uint8Array([1, 2, 3])
      const mimeType = 'image/jpeg'

      const createdUrl = await cache.getOrCreate(mediaId, async () => ({
        data,
        mimeType
      }))

      const retrievedUrl = cache.get(mediaId)
      expect(retrievedUrl).toBe(createdUrl)
    })

    it('should return null if not cached', () => {
      const url = cache.get('non-existent')
      expect(url).toBeNull()
    })
  })

  describe('revoke', () => {
    it('should revoke and remove URL from cache', async () => {
      const mediaId = 'test-media-1'
      const data = new Uint8Array([1, 2, 3])
      const mimeType = 'image/jpeg'

      const url = await cache.getOrCreate(mediaId, async () => ({
        data,
        mimeType
      }))

      cache.revoke(mediaId)

      expect(revokeObjectURLSpy).toHaveBeenCalledWith(url)
      expect(cache.get(mediaId)).toBeNull()
    })

    it('should handle revoking non-existent media', () => {
      expect(() => cache.revoke('non-existent')).not.toThrow()
      expect(revokeObjectURLSpy).not.toHaveBeenCalled()
    })
  })

  describe('clear', () => {
    it('should revoke all URLs and clear cache', async () => {
      const media1 = await cache.getOrCreate('media-1', async () => ({
        data: new Uint8Array([1]),
        mimeType: 'image/jpeg'
      }))

      const media2 = await cache.getOrCreate('media-2', async () => ({
        data: new Uint8Array([2]),
        mimeType: 'image/png'
      }))

      cache.clear()

      expect(revokeObjectURLSpy).toHaveBeenCalledWith(media1)
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(media2)
      expect(cache.get('media-1')).toBeNull()
      expect(cache.get('media-2')).toBeNull()
    })
  })

  describe('clearProject', () => {
    it('should clear URLs for specific project', async () => {
      const projectMedia1 = await cache.getOrCreate('project1_media-1', async () => ({
        data: new Uint8Array([1]),
        mimeType: 'image/jpeg'
      }))

      const projectMedia2 = await cache.getOrCreate('project1_media-2', async () => ({
        data: new Uint8Array([2]),
        mimeType: 'image/png'
      }))

      const otherMedia = await cache.getOrCreate('project2_media-1', async () => ({
        data: new Uint8Array([3]),
        mimeType: 'image/gif'
      }))

      cache.clearProject('project1')

      expect(revokeObjectURLSpy).toHaveBeenCalledWith(projectMedia1)
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(projectMedia2)
      expect(revokeObjectURLSpy).not.toHaveBeenCalledWith(otherMedia)
      
      expect(cache.get('project1_media-1')).toBeNull()
      expect(cache.get('project1_media-2')).toBeNull()
      expect(cache.get('project2_media-1')).toBe(otherMedia)
    })
  })

  describe('preloadMedia', () => {
    it('should preload multiple media items', async () => {
      const mediaItems = [
        { id: 'media-1', data: new Uint8Array([1]), mimeType: 'image/jpeg' },
        { id: 'media-2', data: new Uint8Array([2]), mimeType: 'image/png' },
        { id: 'media-3', data: new Uint8Array([3]), mimeType: 'image/gif' }
      ]

      const fetcher = async (id: string) => {
        const item = mediaItems.find(m => m.id === id)
        return item ? { data: item.data, mimeType: item.mimeType } : null
      }

      const urls = await cache.preloadMedia(
        mediaItems.map(m => m.id),
        fetcher
      )

      expect(urls).toHaveLength(3)
      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(3)
      
      // Check all are cached
      mediaItems.forEach((item, index) => {
        expect(cache.get(item.id)).toBe(urls[index])
      })
    })

    it('should handle partial failures in preloading', async () => {
      const fetcher = async (id: string) => {
        if (id === 'media-2') {
          throw new Error('Failed to load')
        }
        return { data: new Uint8Array([1]), mimeType: 'image/jpeg' }
      }

      const urls = await cache.preloadMedia(
        ['media-1', 'media-2', 'media-3'],
        fetcher
      )

      expect(urls).toHaveLength(3)
      expect(urls[0]).toMatch(/^blob:/)
      expect(urls[1]).toBeNull() // Failed item
      expect(urls[2]).toMatch(/^blob:/)
    })
  })

  describe('memory management', () => {
    it('should track cache size', async () => {
      expect(cache.size()).toBe(0)

      await cache.getOrCreate('media-1', async () => ({
        data: new Uint8Array([1, 2, 3]),
        mimeType: 'image/jpeg'
      }))

      expect(cache.size()).toBe(1)

      await cache.getOrCreate('media-2', async () => ({
        data: new Uint8Array([4, 5, 6]),
        mimeType: 'image/png'
      }))

      expect(cache.size()).toBe(2)

      cache.revoke('media-1')
      expect(cache.size()).toBe(1)

      cache.clear()
      expect(cache.size()).toBe(0)
    })
  })
})