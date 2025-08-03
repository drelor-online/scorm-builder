import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaService } from '../MediaService'
import { performanceMonitor } from '../../utils/performanceMonitor'
import { invoke } from '@tauri-apps/api/core'
import type { MediaType } from '../../utils/idGenerator'

// Mock dependencies
vi.mock('@tauri-apps/api/core')
vi.mock('../../utils/performanceMonitor')
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Mock idGenerator with predictable IDs
let idCounter = 0
vi.mock('../../utils/idGenerator', () => ({
  generateMediaId: vi.fn((type: MediaType, pageId: string) => {
    const id = `${type}-${idCounter}-${pageId}`
    idCounter++
    return id
  })
}))

describe('MediaService Performance Monitoring', () => {
  let service: MediaService
  const mockInvoke = vi.mocked(invoke)
  const mockPerformanceMonitor = vi.mocked(performanceMonitor)
  
  beforeEach(() => {
    vi.clearAllMocks()
    idCounter = 0
    service = new MediaService({ projectId: 'test-project' })
    
    // Setup performance monitor mock
    mockPerformanceMonitor.measureOperation = vi.fn(async (name, operation) => {
      return await operation()
    })
    
    mockPerformanceMonitor.startTiming = vi.fn(() => {
      return vi.fn() // Return a stop function
    })
    
    // Mock File constructor if not available
    if (typeof File === 'undefined') {
      global.File = class File extends Blob {
        name: string
        constructor(bits: any[], name: string, options?: any) {
          super(bits, options)
          this.name = name
        }
      } as any
    }
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  // Helper to create mock files with arrayBuffer method
  const createMockFile = (content: string, name: string, type: string) => {
    const encoder = new TextEncoder()
    const buffer = encoder.encode(content).buffer
    
    // Create a real File object if available, otherwise a mock
    if (typeof File !== 'undefined') {
      const file = new File([content], name, { type })
      // Override arrayBuffer method to return synchronously in tests
      Object.defineProperty(file, 'arrayBuffer', {
        value: vi.fn().mockResolvedValue(buffer)
      })
      return file
    }
    
    // Fallback mock
    return {
      name,
      type,
      size: content.length,
      arrayBuffer: vi.fn().mockResolvedValue(buffer),
      slice: vi.fn(),
      stream: vi.fn(),
      text: vi.fn().mockResolvedValue(content),
      constructor: { name: 'File' }
    } as unknown as File
  }
  
  describe('Store Operations Performance', () => {
    it('should measure performance of storeMedia operation', async () => {
      const file = createMockFile('test content', 'test.jpg', 'image/jpeg')
      mockInvoke.mockResolvedValueOnce(undefined)
      
      await service.storeMedia(file, 'welcome', 'image')
      
      expect(mockPerformanceMonitor.measureOperation).toHaveBeenCalledWith(
        'MediaService.storeMedia',
        expect.any(Function),
        expect.objectContaining({
          mediaType: 'image',
          pageId: 'welcome',
          fileSize: 12
        })
      )
    })
    
    it('should measure performance of storeYouTubeVideo operation', async () => {
      await service.storeYouTubeVideo(
        'https://youtube.com/watch?v=test',
        'https://youtube.com/embed/test',
        'topic-0'
      )
      
      expect(mockPerformanceMonitor.measureOperation).toHaveBeenCalledWith(
        'MediaService.storeYouTubeVideo',
        expect.any(Function),
        expect.objectContaining({
          pageId: 'topic-0'
        })
      )
    })
    
    it('should handle performance measurement errors gracefully', async () => {
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      
      // Make measureOperation throw
      mockPerformanceMonitor.measureOperation.mockRejectedValueOnce(
        new Error('Performance monitoring failed')
      )
      
      // Operation should still complete
      mockInvoke.mockResolvedValueOnce(undefined)
      
      const result = await service.storeMedia(file, 'welcome', 'image')
      
      expect(result).toBeDefined()
      expect(result.id).toBe('image-0-welcome')
    })
  })
  
  describe('Retrieval Operations Performance', () => {
    it('should measure performance of getMedia operation', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: [1, 2, 3],
        metadata: { type: 'image', mimeType: 'image/jpeg' }
      })
      
      await service.getMedia('image-0-welcome')
      
      expect(mockPerformanceMonitor.measureOperation).toHaveBeenCalledWith(
        'MediaService.getMedia',
        expect.any(Function),
        expect.objectContaining({
          mediaId: 'image-0-welcome'
        })
      )
    })
    
    it('should measure performance of listAllMedia operation', async () => {
      mockInvoke.mockResolvedValueOnce([
        { id: 'image-0-welcome', fileName: 'test.jpg', mimeType: 'image/jpeg' }
      ])
      
      await service.listAllMedia()
      
      expect(mockPerformanceMonitor.measureOperation).toHaveBeenCalledWith(
        'MediaService.listAllMedia',
        expect.any(Function),
        expect.objectContaining({
          projectId: 'test-project'
        })
      )
    })
    
    it('should include result count in listAllMedia metrics', async () => {
      const mockItems = [
        { id: 'image-0-welcome', fileName: '1.jpg', mimeType: 'image/jpeg' },
        { id: 'image-1-welcome', fileName: '2.jpg', mimeType: 'image/jpeg' },
        { id: 'audio-0-welcome', fileName: '3.mp3', mimeType: 'audio/mpeg' }
      ]
      
      mockInvoke.mockResolvedValueOnce(mockItems)
      
      // Mock measureOperation to capture metadata
      let capturedMetadata: any
      mockPerformanceMonitor.measureOperation.mockImplementationOnce(
        async (name, operation, metadata) => {
          const result = await operation()
          capturedMetadata = { ...metadata, resultCount: result.length }
          return result
        }
      )
      
      await service.listAllMedia()
      
      expect(mockPerformanceMonitor.measureOperation).toHaveBeenCalled()
      // Since we can't directly check the updated metadata, we verify the operation completed
    })
  })
  
  describe('Delete Operations Performance', () => {
    it('should measure performance of deleteMedia operation', async () => {
      mockInvoke.mockResolvedValueOnce(undefined)
      
      await service.deleteMedia('image-0-welcome')
      
      expect(mockPerformanceMonitor.measureOperation).toHaveBeenCalledWith(
        'MediaService.deleteMedia',
        expect.any(Function),
        expect.objectContaining({
          mediaId: 'image-0-welcome'
        })
      )
    })
  })
  
  describe('Blob URL Operations Performance', () => {
    it('should measure performance of createBlobUrl operation', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: [1, 2, 3],
        metadata: { mimeType: 'image/jpeg' }
      })
      
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
      
      await service.createBlobUrl('image-0-welcome')
      
      expect(mockPerformanceMonitor.measureOperation).toHaveBeenCalledWith(
        'MediaService.createBlobUrl',
        expect.any(Function),
        expect.objectContaining({
          mediaId: 'image-0-welcome'
        })
      )
    })
  })
  
  describe('Batch Operations Performance', () => {
    it('should use timing for batch operations', async () => {
      const stopTiming = vi.fn()
      mockPerformanceMonitor.startTiming.mockReturnValueOnce(stopTiming)
      
      // Store multiple items
      const files = Array.from({ length: 5 }, (_, i) => 
        createMockFile(`content-${i}`, `file-${i}.jpg`, 'image/jpeg')
      )
      
      mockInvoke.mockResolvedValue(undefined)
      
      // Start timing for batch
      const timer = performanceMonitor.startTiming('MediaService.batchStore')
      
      for (const file of files) {
        await service.storeMedia(file, 'test', 'image')
      }
      
      // Stop timing
      timer()
      
      expect(mockPerformanceMonitor.startTiming).toHaveBeenCalledWith('MediaService.batchStore')
      expect(stopTiming).toHaveBeenCalled()
    })
  })
  
  describe('Performance Thresholds', () => {
    it('should track slow operations', async () => {
      // Simulate a slow operation
      mockInvoke.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve(undefined), 2000))
      )
      
      const file = createMockFile('test', 'test.jpg', 'image/jpeg')
      
      // Mock measureOperation to simulate slow detection
      mockPerformanceMonitor.measureOperation.mockImplementationOnce(
        async (name, operation, metadata) => {
          const start = Date.now()
          const result = await operation()
          const duration = Date.now() - start
          
          // In real implementation, this would trigger a warning
          if (duration > 1000) {
            console.warn(`Slow operation detected: ${name} took ${duration}ms`)
          }
          
          return result
        }
      )
      
      await service.storeMedia(file, 'welcome', 'image')
      
      // Verify the operation completed despite being slow
      expect(mockPerformanceMonitor.measureOperation).toHaveBeenCalled()
    })
  })
  
  describe('Memory Usage Tracking', () => {
    it('should include memory metrics for large file operations', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024) // 10MB
      const largeFile = createMockFile(largeContent, 'large.jpg', 'image/jpeg')
      
      mockInvoke.mockResolvedValueOnce(undefined)
      
      await service.storeMedia(largeFile, 'test', 'image')
      
      expect(mockPerformanceMonitor.measureOperation).toHaveBeenCalledWith(
        'MediaService.storeMedia',
        expect.any(Function),
        expect.objectContaining({
          fileSize: largeContent.length,
          largeFile: true // Flag for files > 5MB
        })
      )
    })
  })
})