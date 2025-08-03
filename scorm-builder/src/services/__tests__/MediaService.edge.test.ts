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

describe('MediaService Edge Cases', () => {
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
  
  describe('Large File Handling', () => {
    it('should handle files over 100MB', async () => {
      const largeContent = 'x'.repeat(100 * 1024 * 1024) // 100MB
      const file = createMockFile(largeContent, 'large.jpg', 'image/jpeg')
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const result = await service.storeMedia(file, 'welcome', 'image')
      
      expect(result).toBeDefined()
      expect(result.metadata.size).toBe(100 * 1024 * 1024)
    })
    
    it('should handle empty files', async () => {
      const file = createMockFile('', 'empty.jpg', 'image/jpeg')
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const result = await service.storeMedia(file, 'welcome', 'image')
      
      expect(result).toBeDefined()
      expect(result.metadata.size).toBe(0)
    })
  })
  
  describe('Special Characters in Filenames', () => {
    it('should handle filenames with unicode characters', async () => {
      const file = createMockFile('test', '测试图片.jpg', 'image/jpeg')
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const result = await service.storeMedia(file, 'welcome', 'image')
      
      expect(result).toBeDefined()
      expect(result.fileName).toBe('image-0-welcome.jpg')
    })
    
    it('should handle filenames with spaces and special chars', async () => {
      const file = createMockFile('test', 'my file (1) [test] #2.jpg', 'image/jpeg')
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const result = await service.storeMedia(file, 'welcome', 'image')
      
      expect(result).toBeDefined()
      expect(result.fileName).toBe('image-0-welcome.jpg')
    })
    
    it('should handle filenames without extensions', async () => {
      const file = createMockFile('test', 'noextension', 'image/jpeg')
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const result = await service.storeMedia(file, 'welcome', 'image')
      
      expect(result).toBeDefined()
      expect(result.fileName).toBe('image-0-welcome.jpg')
    })
  })
  
  describe('Invalid Input Handling', () => {
    it('should reject null file', async () => {
      await expect(service.storeMedia(null as any, 'welcome', 'image'))
        .rejects.toThrow()
    })
    
    it('should reject undefined pageId', async () => {
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      
      await expect(service.storeMedia(file, undefined as any, 'image'))
        .rejects.toThrow()
    })
    
    it('should reject invalid media type', async () => {
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      
      await expect(service.storeMedia(file, 'welcome', 'invalid' as any))
        .rejects.toThrow()
    })
    
    it('should handle empty pageId gracefully', async () => {
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const result = await service.storeMedia(file, '', 'image')
      
      expect(result).toBeDefined()
      expect(result.pageId).toBe('')
    })
  })
  
  describe('Network and Backend Failures', () => {
    it('should handle backend timeout', async () => {
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      
      mockInvoke.mockRejectedValue(new Error('Timeout'))
      
      await expect(service.storeMedia(file, 'welcome', 'image'))
        .rejects.toThrow('Failed to store media')
    })
    
    it('should handle corrupted backend response', async () => {
      mockInvoke.mockResolvedValueOnce({ 
        data: null, // Invalid response
        metadata: {} 
      })
      
      const result = await service.getMedia('image-0-welcome')
      
      expect(result).toBeNull()
    })
    
    it('should handle getMedia with malformed data array', async () => {
      mockInvoke.mockResolvedValueOnce({ 
        data: 'not-an-array',
        metadata: {} 
      })
      
      const result = await service.getMedia('image-0-welcome')
      
      expect(result).toBeNull()
    })
  })
  
  describe('Memory and Resource Management', () => {
    it('should not leak memory with repeated operations', async () => {
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      
      // Store many files
      for (let i = 0; i < 100; i++) {
        mockInvoke.mockResolvedValueOnce(undefined)
        await service.storeMedia(file, `page-${i}`, 'image')
      }
      
      // Clear cache should free memory
      service.clearCache()
      
      const stats = service.getStats()
      expect(stats.totalItems).toBe(0)
    })
    
    it('should handle concurrent blob URL creation', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5])
      
      // Mock URL.createObjectURL
      let urlCounter = 0
      global.URL.createObjectURL = vi.fn(() => `blob:mock-url-${urlCounter++}`)
      
      // Mock multiple concurrent requests
      const promises = []
      for (let i = 0; i < 10; i++) {
        mockInvoke.mockResolvedValueOnce({
          data: Array.from(mockData),
          metadata: { mimeType: 'image/jpeg' }
        })
        
        promises.push(service.createBlobUrl(`image-${i}-welcome`))
      }
      
      const results = await Promise.all(promises)
      
      // All should succeed with unique URLs
      results.forEach((url, index) => {
        expect(url).toBe(`blob:mock-url-${index}`)
      })
    })
  })
  
  describe('Boundary Conditions', () => {
    it('should handle maximum allowed metadata size', async () => {
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      const largeMetadata = {
        description: 'x'.repeat(10000),
        tags: Array(100).fill('tag'),
        customData: { nested: { deep: { data: 'x'.repeat(1000) } } }
      }
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const result = await service.storeMedia(file, 'welcome', 'image', largeMetadata)
      
      expect(result).toBeDefined()
      expect(result.metadata).toMatchObject(largeMetadata)
    })
    
    it('should handle rapid deletion and recreation', async () => {
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      
      // Store
      mockInvoke.mockResolvedValueOnce(undefined)
      const stored = await service.storeMedia(file, 'welcome', 'image')
      
      // Delete
      mockInvoke.mockResolvedValueOnce(undefined)
      await service.deleteMedia(stored.id)
      
      // Immediately recreate with same ID (edge case)
      idCounters = {} // Reset to get same ID
      mockInvoke.mockResolvedValueOnce(undefined)
      const recreated = await service.storeMedia(file, 'welcome', 'image')
      
      expect(recreated.id).toBe(stored.id)
    })
  })
  
  describe('Progress Callback Edge Cases', () => {
    it('should handle progress callback that throws', async () => {
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error')
      })
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      // Should not throw despite callback error
      const result = await service.storeMedia(file, 'welcome', 'image', {}, errorCallback)
      
      expect(result).toBeDefined()
      expect(errorCallback).toHaveBeenCalled()
    })
    
    it('should handle async progress callback', async () => {
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      const asyncCallback = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const result = await service.storeMedia(file, 'welcome', 'image', {}, asyncCallback)
      
      expect(result).toBeDefined()
      expect(asyncCallback).toHaveBeenCalled()
    })
  })
  
  describe('Media Type Edge Cases', () => {
    it('should handle unusual MIME types', async () => {
      const file = createMockFile('test', 'test.webp', 'image/webp')
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const result = await service.storeMedia(file, 'welcome', 'image')
      
      expect(result).toBeDefined()
      expect(result.metadata.mimeType).toBe('image/webp')
    })
    
    it('should handle blob without type', async () => {
      const blob = {
        type: '',
        size: 100,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
        slice: vi.fn(),
        stream: vi.fn(),
        text: vi.fn()
      } as unknown as Blob
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const result = await service.storeMedia(blob, 'welcome', 'image')
      
      expect(result).toBeDefined()
      expect(result.fileName).toMatch(/\.jpg$/) // Should use type from MediaType parameter
    })
  })
})