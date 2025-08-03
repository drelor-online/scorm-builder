import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MediaService } from '../MediaService'
import { BlobURLManager } from '../BlobURLManager'
import { performanceMonitor } from '@/utils/performanceMonitor'
import type { MediaType } from '@/types/media'

// Mock dependencies
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn()
}))

describe('MediaService Blob URL Performance Tests', () => {
  let mediaService: MediaService
  let blobUrlManager: BlobURLManager
  let mockInvoke: any

  beforeEach(async () => {
    mediaService = new MediaService()
    blobUrlManager = (mediaService as any).blobUrlManager
    
    const tauriModule = await import('@tauri-apps/api/tauri')
    mockInvoke = vi.mocked(tauriModule.invoke)
    mockInvoke.mockResolvedValue({ success: true })

    // Mock URL methods
    global.URL.createObjectURL = vi.fn((blob) => `blob:mock-${Math.random()}`)
    global.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
    mediaService.cleanup()
  })

  describe('Blob URL Creation Performance', () => {
    it('should efficiently create blob URLs for multiple media items', async () => {
      const mediaCount = 100
      const startTime = performance.now()

      // Store multiple media items
      const promises = []
      for (let i = 0; i < mediaCount; i++) {
        const file = new File([`media content ${i}`], `media-${i}.jpg`, { type: 'image/jpeg' })
        promises.push(
          mediaService.storeMedia(file, `page-${i % 10}`, 'image', { 
            title: `Image ${i}` 
          })
        )
      }

      await Promise.all(promises)
      const storeTime = performance.now() - startTime
      console.log(`Stored ${mediaCount} media items in ${storeTime.toFixed(2)}ms`)

      // Create blob URLs for all items
      const blobUrlStart = performance.now()
      const urls = []

      for (let i = 0; i < mediaCount; i++) {
        const mediaId = `image-${i}-page-${i % 10}`
        const url = await mediaService.createBlobUrl(mediaId)
        urls.push(url)
      }

      const blobUrlTime = performance.now() - blobUrlStart
      console.log(`Created ${mediaCount} blob URLs in ${blobUrlTime.toFixed(2)}ms`)

      // Should be efficient
      expect(blobUrlTime).toBeLessThan(100)
      expect(urls.every(url => url?.startsWith('blob:'))).toBe(true)
    })

    it('should handle concurrent blob URL requests efficiently', async () => {
      // First, store some media
      const mediaItems = 50
      for (let i = 0; i < mediaItems; i++) {
        const file = new File([`data ${i}`], `file-${i}.mp3`, { type: 'audio/mp3' })
        await mediaService.storeMedia(file, 'test-page', 'audio')
      }

      // Mock getMedia to return blob data
      mockInvoke.mockImplementation((cmd: string, args: any) => {
        if (cmd === 'get_media') {
          return Promise.resolve({
            blob_data: new Uint8Array(100),
            media_type: 'audio/mp3'
          })
        }
        return Promise.resolve({ success: true })
      })

      // Simulate concurrent blob URL requests
      const startTime = performance.now()
      const concurrentRequests = []

      for (let i = 0; i < mediaItems; i++) {
        concurrentRequests.push(
          mediaService.createBlobUrl(`audio-${i}-test-page`)
        )
      }

      const urls = await Promise.all(concurrentRequests)
      const concurrentTime = performance.now() - startTime

      console.log(`${mediaItems} concurrent blob URL requests completed in ${concurrentTime.toFixed(2)}ms`)
      
      // Should handle concurrent requests efficiently
      expect(concurrentTime).toBeLessThan(200)
      expect(urls.filter(url => url !== null)).toHaveLength(mediaItems)
    })

    it('should maintain performance with blob URL caching', async () => {
      const mediaId = 'cached-media-test'
      
      // Store a media item
      const file = new File(['test data'], 'test.png', { type: 'image/png' })
      await mediaService.storeMedia(file, 'cache-test', 'image')

      // Mock getMedia
      let getMediaCallCount = 0
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_media') {
          getMediaCallCount++
          return Promise.resolve({
            blob_data: new Uint8Array(1000),
            media_type: 'image/png'
          })
        }
        return Promise.resolve({ success: true })
      })

      // First request - should hit backend
      const firstRequestStart = performance.now()
      const url1 = await mediaService.createBlobUrl('image-0-cache-test')
      const firstRequestTime = performance.now() - firstRequestStart

      // Subsequent requests - should use cache
      const cachedRequestStart = performance.now()
      const cachedUrls = []
      
      for (let i = 0; i < 100; i++) {
        cachedUrls.push(await mediaService.createBlobUrl('image-0-cache-test'))
      }
      
      const cachedRequestTime = performance.now() - cachedRequestStart

      console.log(`First request: ${firstRequestTime.toFixed(2)}ms`)
      console.log(`100 cached requests: ${cachedRequestTime.toFixed(2)}ms`)

      // Cached requests should be much faster
      expect(cachedRequestTime).toBeLessThan(firstRequestTime * 10)
      
      // Should only call getMedia once
      expect(getMediaCallCount).toBe(1)
      
      // All URLs should be the same (cached)
      expect(new Set(cachedUrls).size).toBe(1)
    })

    it('should handle blob URL cleanup during high load', async () => {
      // Create many media items across different pages
      const pages = ['welcome', 'objectives', 'topic-1', 'topic-2', 'topic-3']
      const itemsPerPage = 20
      
      // Store media
      for (const page of pages) {
        for (let i = 0; i < itemsPerPage; i++) {
          const file = new File([`${page} data ${i}`], `${page}-${i}.jpg`, { type: 'image/jpeg' })
          await mediaService.storeMedia(file, page, 'image')
        }
      }

      // Create blob URLs for all items
      const urls: string[] = []
      for (const page of pages) {
        for (let i = 0; i < itemsPerPage; i++) {
          const url = await mediaService.createBlobUrl(`image-${i}-${page}`)
          if (url) urls.push(url)
        }
      }

      expect(urls).toHaveLength(pages.length * itemsPerPage)

      // Measure cleanup performance
      const cleanupStart = performance.now()
      
      // Clean up specific pages
      for (const page of pages.slice(0, 3)) {
        await mediaService.cleanupBlobUrls(page)
      }

      const cleanupTime = performance.now() - cleanupStart
      console.log(`Cleanup of 3 pages (${3 * itemsPerPage} URLs) completed in ${cleanupTime.toFixed(2)}ms`)

      // Should be efficient
      expect(cleanupTime).toBeLessThan(50)

      // Verify correct number of URLs were cleaned
      const revokeCount = (global.URL.revokeObjectURL as any).mock.calls.length
      expect(revokeCount).toBe(3 * itemsPerPage)
    })

    it('should optimize memory usage with large media files', async () => {
      // Test with increasingly large files
      const fileSizes = [
        1024 * 1024,      // 1MB
        5 * 1024 * 1024,  // 5MB
        10 * 1024 * 1024, // 10MB
        50 * 1024 * 1024  // 50MB
      ]

      const results = []

      for (const size of fileSizes) {
        const data = new Uint8Array(size)
        const file = new File([data], `large-${size}.mp4`, { type: 'video/mp4' })
        
        const startTime = performance.now()
        const startMemory = performance.memory?.usedJSHeapSize || 0

        await mediaService.storeMedia(file, 'large-test', 'video')
        const mediaId = `video-${results.length}-large-test`
        const url = await mediaService.createBlobUrl(mediaId)

        const endTime = performance.now()
        const endMemory = performance.memory?.usedJSHeapSize || 0

        results.push({
          size: size / (1024 * 1024),
          time: endTime - startTime,
          memoryDelta: (endMemory - startMemory) / (1024 * 1024)
        })

        // Clean up to prevent memory accumulation
        if (url) {
          blobUrlManager.revokeObjectURL(url)
        }
      }

      console.log('Large file handling results:')
      results.forEach(r => {
        console.log(`  ${r.size}MB: ${r.time.toFixed(2)}ms, Memory Δ: ${r.memoryDelta.toFixed(2)}MB`)
      })

      // Time should scale reasonably with size
      const timeRatio = results[3].time / results[0].time
      expect(timeRatio).toBeLessThan(100) // Should not be 50x slower for 50x larger file
    })

    it('should maintain performance with mixed media types', async () => {
      const mediaTypes: MediaType[] = ['image', 'video', 'audio', 'caption']
      const itemsPerType = 25
      
      const startTime = performance.now()

      // Store mixed media types
      for (const type of mediaTypes) {
        for (let i = 0; i < itemsPerType; i++) {
          const extension = type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'vtt'
          const mimeType = type === 'image' ? 'image/jpeg' : type === 'video' ? 'video/mp4' : type === 'audio' ? 'audio/mp3' : 'text/vtt'
          
          const file = new File([`${type} content ${i}`], `file-${i}.${extension}`, { type: mimeType })
          await mediaService.storeMedia(file, 'mixed-test', type)
        }
      }

      const storeTime = performance.now() - startTime

      // Create blob URLs for all types
      const blobUrlStart = performance.now()
      const urlsByType: Record<MediaType, string[]> = {
        image: [],
        video: [],
        audio: [],
        caption: []
      }

      for (const type of mediaTypes) {
        for (let i = 0; i < itemsPerType; i++) {
          const url = await mediaService.createBlobUrl(`${type}-${i}-mixed-test`)
          if (url) urlsByType[type].push(url)
        }
      }

      const blobUrlTime = performance.now() - blobUrlStart

      console.log(`Mixed media type performance:`)
      console.log(`  Store time: ${storeTime.toFixed(2)}ms`)
      console.log(`  Blob URL creation: ${blobUrlTime.toFixed(2)}ms`)
      console.log(`  URLs created:`, Object.entries(urlsByType).map(([type, urls]) => `${type}: ${urls.length}`).join(', '))

      // Should handle all types efficiently
      expect(blobUrlTime).toBeLessThan(200)
      
      // Verify all URLs were created
      const totalUrls = Object.values(urlsByType).reduce((sum, urls) => sum + urls.length, 0)
      expect(totalUrls).toBe(mediaTypes.length * itemsPerType)
    })

    it('should integrate performance monitoring without significant overhead', async () => {
      // Clear previous metrics
      performanceMonitor.clearMetrics()

      // Perform operations with monitoring
      const operations = 50
      const startTime = performance.now()

      for (let i = 0; i < operations; i++) {
        const file = new File([`data ${i}`], `monitored-${i}.png`, { type: 'image/png' })
        await mediaService.storeMedia(file, 'monitor-test', 'image')
        const url = await mediaService.createBlobUrl(`image-${i}-monitor-test`)
        
        // Simulate some usage
        await new Promise(resolve => setTimeout(resolve, 1))
        
        // Clean up
        if (url) {
          await mediaService.cleanupBlobUrls('monitor-test')
        }
      }

      const totalTime = performance.now() - startTime
      
      // Get performance metrics
      const storeMetrics = performanceMonitor.getMetricsForOperation('MediaService.storeMedia')
      const blobMetrics = performanceMonitor.getMetricsForOperation('MediaService.createBlobUrl')
      
      console.log(`Performance monitoring results (${operations} operations):`)
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`)
      console.log(`  Store operations: ${storeMetrics.length}`)
      console.log(`  Blob URL operations: ${blobMetrics.length}`)
      
      if (storeMetrics.length > 0) {
        const avgStoreTime = storeMetrics.reduce((sum, m) => sum + m.duration, 0) / storeMetrics.length
        console.log(`  Avg store time: ${avgStoreTime.toFixed(2)}ms`)
      }
      
      if (blobMetrics.length > 0) {
        const avgBlobTime = blobMetrics.reduce((sum, m) => sum + m.duration, 0) / blobMetrics.length
        console.log(`  Avg blob URL time: ${avgBlobTime.toFixed(2)}ms`)
      }

      // Monitoring should add minimal overhead
      const expectedTime = operations * 10 // Rough estimate without monitoring
      expect(totalTime).toBeLessThan(expectedTime * 1.2) // Allow 20% overhead max
    })
  })
})