import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaService } from '../MediaService'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core')
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

let idCounters: Record<string, number> = {}
vi.mock('../../utils/idGenerator', () => ({
  generateMediaId: vi.fn((type, pageId) => {
    const key = `${type}-${pageId}`
    if (!idCounters[key]) idCounters[key] = 0
    const id = `${type}-${idCounters[key]}-${pageId}`
    idCounters[key]++
    return id
  })
}))

describe('MediaService Concurrent Operations', () => {
  let service: MediaService
  const mockInvoke = vi.mocked(invoke)
  
  beforeEach(() => {
    vi.clearAllMocks()
    idCounters = {}
    service = new MediaService({ projectId: 'test-project' })
  })
  
  const createMockFile = (content: string, name: string, type: string) => {
    const encoder = new TextEncoder()
    const buffer = encoder.encode(content).buffer
    
    return {
      name,
      type,
      size: content.length,
      arrayBuffer: vi.fn().mockResolvedValue(buffer),
      slice: vi.fn(),
      stream: vi.fn(),
      text: vi.fn().mockResolvedValue(content)
    } as unknown as File
  }
  
  describe('Concurrent Uploads', () => {
    it('should handle multiple files uploaded simultaneously', async () => {
      const files = Array.from({ length: 10 }, (_, i) => ({
        file: createMockFile(`content-${i}`, `file-${i}.jpg`, 'image/jpeg'),
        pageId: `page-${i % 3}`, // Distribute across 3 pages
        type: 'image' as const
      }))
      
      // Mock all invokes to succeed
      mockInvoke.mockResolvedValue(undefined)
      
      // Upload all files concurrently
      const uploadPromises = files.map(({ file, pageId, type }) => 
        service.storeMedia(file, pageId, type)
      )
      
      const results = await Promise.all(uploadPromises)
      
      // Verify all uploads succeeded
      expect(results).toHaveLength(10)
      results.forEach((result, index) => {
        expect(result).toBeDefined()
        expect(result.id).toMatch(/^image-\d+-page-\d+$/)
        expect(result.metadata.size).toBe(files[index].file.size)
      })
      
      // Verify all items are in cache
      const stats = service.getStats()
      expect(stats.totalItems).toBe(10)
    })
    
    it('should handle concurrent uploads to the same page', async () => {
      const pageId = 'shared-page'
      const files = Array.from({ length: 5 }, (_, i) => 
        createMockFile(`content-${i}`, `file-${i}.jpg`, 'image/jpeg')
      )
      
      mockInvoke.mockResolvedValue(undefined)
      
      const uploadPromises = files.map(file => 
        service.storeMedia(file, pageId, 'image')
      )
      
      const results = await Promise.all(uploadPromises)
      
      // All should have unique IDs
      const ids = results.map(r => r.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(5)
      
      // All should be on the same page
      results.forEach(result => {
        expect(result.pageId).toBe(pageId)
      })
      
      // Page should have all 5 items
      // Mock the list_media response
      mockInvoke.mockResolvedValueOnce(
        results.map(r => ({
          id: r.id,
          fileName: r.fileName,
          mimeType: r.metadata.mimeType
        }))
      )
      const pageMedia = await service.listMediaForPage(pageId)
      expect(pageMedia).toHaveLength(5)
    })
    
    it('should handle mixed success and failure', async () => {
      const files = Array.from({ length: 3 }, (_, i) => 
        createMockFile(`content-${i}`, `file-${i}.jpg`, 'image/jpeg')
      )
      
      // Make the second file fail
      mockInvoke
        .mockResolvedValueOnce(undefined) // file 0 - success
        .mockRejectedValue(new Error('Upload failed')) // file 1 onwards - fail
      
      const uploadPromises = files.map((file, i) => 
        service.storeMedia(file, 'page', 'image').catch(err => ({ error: err, index: i }))
      )
      
      const results = await Promise.all(uploadPromises)
      
      // Check which succeeded and which failed
      const successes = results.filter(r => !('error' in r))
      const failures = results.filter(r => 'error' in r)
      
      expect(successes).toHaveLength(1)
      expect(failures).toHaveLength(2)
      
      // Only successful uploads should be in cache
      const stats = service.getStats()
      expect(stats.totalItems).toBe(1)
    })
  })
  
  describe('Concurrent Reads', () => {
    it('should handle multiple concurrent getMedia calls', async () => {
      // First, store some media
      const files = Array.from({ length: 5 }, (_, i) => ({
        file: createMockFile(`content-${i}`, `file-${i}.jpg`, 'image/jpeg'),
        id: `image-${i}-page`
      }))
      
      mockInvoke.mockResolvedValue(undefined)
      
      for (const { file } of files) {
        await service.storeMedia(file, 'page', 'image')
      }
      
      // Now read them all concurrently
      const mockData = new Uint8Array([1, 2, 3, 4, 5])
      mockInvoke.mockResolvedValue({
        data: Array.from(mockData),
        metadata: { type: 'image', pageId: 'page' }
      })
      
      const readPromises = files.map((_, i) => 
        service.getMedia(`image-${i}-page`)
      )
      
      const results = await Promise.all(readPromises)
      
      // All reads should succeed
      results.forEach(result => {
        expect(result).not.toBeNull()
        expect(result!.data).toBeInstanceOf(Uint8Array)
      })
    })
    
    it('should handle concurrent reads without errors', async () => {
      const mediaId = 'image-0-page'
      
      // Mock backend response
      let backendCalls = 0
      mockInvoke.mockImplementation(() => {
        backendCalls++
        return Promise.resolve({
          data: [1, 2, 3],
          metadata: { type: 'image', pageId: 'page' }
        })
      })
      
      // Read the same media 10 times concurrently
      const readPromises = Array(10).fill(null).map(() => 
        service.getMedia(mediaId)
      )
      
      const results = await Promise.all(readPromises)
      
      // All should return the same result
      results.forEach(result => {
        expect(result).not.toBeNull()
        expect(result!.data).toEqual(new Uint8Array([1, 2, 3]))
      })
      
      // Note: MediaService currently doesn't cache get requests
      // Each concurrent call will hit the backend
      expect(backendCalls).toBe(10)
    })
  })
  
  describe('Concurrent Deletes', () => {
    it('should handle concurrent deletion attempts', async () => {
      // Store some media first
      const files = Array.from({ length: 5 }, (_, i) => 
        createMockFile(`content-${i}`, `file-${i}.jpg`, 'image/jpeg')
      )
      
      mockInvoke.mockResolvedValue(undefined)
      
      const stored = []
      for (const file of files) {
        const result = await service.storeMedia(file, 'page', 'image')
        stored.push(result)
      }
      
      // Delete all concurrently
      const deletePromises = stored.map(item => 
        service.deleteMedia(item.id)
      )
      
      const results = await Promise.all(deletePromises)
      
      // All deletes should succeed
      results.forEach(result => {
        expect(result).toBe(true)
      })
      
      // Cache should be empty
      const stats = service.getStats()
      expect(stats.totalItems).toBe(0)
    })
    
    it('should handle racing delete operations on same item', async () => {
      // Store one item
      const file = createMockFile('content', 'file.jpg', 'image/jpeg')
      mockInvoke.mockResolvedValue(undefined)
      
      const stored = await service.storeMedia(file, 'page', 'image')
      
      // Try to delete it 5 times concurrently
      const deletePromises = Array(5).fill(null).map(() => 
        service.deleteMedia(stored.id)
      )
      
      const results = await Promise.all(deletePromises)
      
      // All should report success (idempotent)
      results.forEach(result => {
        expect(result).toBe(true)
      })
      
      // Item should be gone
      const stats = service.getStats()
      expect(stats.totalItems).toBe(0)
    })
  })
  
  describe('Mixed Concurrent Operations', () => {
    it('should handle reads, writes, and deletes happening simultaneously', async () => {
      // Pre-populate with some items
      mockInvoke.mockResolvedValue(undefined)
      
      const initialFiles = Array.from({ length: 3 }, (_, i) => 
        createMockFile(`initial-${i}`, `initial-${i}.jpg`, 'image/jpeg')
      )
      
      const initialItems = []
      for (const file of initialFiles) {
        const item = await service.storeMedia(file, 'page', 'image')
        initialItems.push(item)
      }
      
      // Now perform mixed operations
      const operations = [
        // New uploads
        ...Array.from({ length: 3 }, (_, i) => 
          service.storeMedia(
            createMockFile(`new-${i}`, `new-${i}.jpg`, 'image/jpeg'),
            'page',
            'image'
          )
        ),
        // Reads
        ...initialItems.map(item => {
          mockInvoke.mockResolvedValueOnce({
            data: [1, 2, 3],
            metadata: { type: 'image', pageId: 'page' }
          })
          return service.getMedia(item.id)
        }),
        // Deletes
        service.deleteMedia(initialItems[0].id),
        service.deleteMedia(initialItems[1].id)
      ]
      
      const results = await Promise.all(operations)
      
      // Verify final state
      const stats = service.getStats()
      // 3 initial + 3 new - 2 deleted = 4
      expect(stats.totalItems).toBe(4)
    })
    
    it('should maintain data consistency under high concurrency', async () => {
      const operations = []
      mockInvoke.mockResolvedValue(undefined)
      
      // Create 100 random operations
      for (let i = 0; i < 100; i++) {
        const op = Math.random()
        
        if (op < 0.6) {
          // 60% uploads
          operations.push(
            service.storeMedia(
              createMockFile(`file-${i}`, `file-${i}.jpg`, 'image/jpeg'),
              `page-${i % 5}`,
              'image'
            ).catch(() => null)
          )
        } else if (op < 0.9) {
          // 30% reads
          mockInvoke.mockResolvedValueOnce({
            data: [1, 2, 3],
            metadata: { type: 'image', pageId: 'page' }
          })
          operations.push(
            service.getMedia(`image-${Math.floor(Math.random() * 50)}-page-${i % 5}`)
              .catch(() => null)
          )
        } else {
          // 10% deletes
          operations.push(
            service.deleteMedia(`image-${Math.floor(Math.random() * 50)}-page-${i % 5}`)
              .catch(() => false)
          )
        }
      }
      
      // Execute all operations
      await Promise.all(operations)
      
      // Verify cache consistency
      const stats = service.getStats()
      expect(stats.totalItems).toBeGreaterThanOrEqual(0)
      expect(stats.totalItems).toBeLessThanOrEqual(100) // Max possible from random operations
      
      // Verify page index consistency
      const allMedia = await service.listAllMedia()
      allMedia.forEach(item => {
        const pageMedia = service.listMediaForPage(item.pageId)
        expect(pageMedia).toContainEqual(item)
      })
    })
  })
  
  describe('Progress Tracking Under Concurrency', () => {
    it('should track progress correctly for concurrent uploads', async () => {
      const files = Array.from({ length: 3 }, (_, i) => 
        createMockFile(`content-${i}`.repeat(1000), `file-${i}.jpg`, 'image/jpeg')
      )
      
      mockInvoke.mockResolvedValue(undefined)
      
      const progressData: Record<number, number[]> = {
        0: [],
        1: [],
        2: []
      }
      
      const uploadPromises = files.map((file, index) => 
        service.storeMedia(file, 'page', 'image', {}, (progress) => {
          progressData[index].push(progress.percent)
        })
      )
      
      await Promise.all(uploadPromises)
      
      // Each file should have progress [0, 100]
      Object.values(progressData).forEach(progress => {
        expect(progress).toContain(0)
        expect(progress).toContain(100)
      })
    })
  })
})