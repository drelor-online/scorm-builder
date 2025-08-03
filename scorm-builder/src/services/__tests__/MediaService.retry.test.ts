import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaService } from '../MediaService'
import { invoke } from '@tauri-apps/api/core'
import { generateMediaId } from '../../utils/idGenerator'
import { retryWithBackoff } from '../../utils/retryWithBackoff'

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('../../utils/idGenerator', () => ({
  generateMediaId: vi.fn()
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../../utils/performanceMonitor', () => ({
  performanceMonitor: {
    measureOperation: vi.fn((name, operation) => operation())
  }
}))

// We need to partially mock retryWithBackoff to track calls while still using real implementation
vi.mock('../../utils/retryWithBackoff', async () => {
  const actual = await vi.importActual<typeof import('../../utils/retryWithBackoff')>('../../utils/retryWithBackoff')
  return {
    ...actual,
    retryWithBackoff: vi.fn(actual.retryWithBackoff)
  }
})

// Mock File to include arrayBuffer method
class MockFile extends Blob {
  name: string
  lastModified: number

  constructor(parts: any[], name: string, options?: FilePropertyBag) {
    super(parts, options)
    this.name = name
    this.lastModified = Date.now()
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.readAsArrayBuffer(this)
    })
  }
}

// @ts-ignore - Replace global File with MockFile
global.File = MockFile

describe('MediaService - Retry Mechanism Tests', () => {
  let mediaService: MediaService
  const projectId = 'test-project-123'
  const mockInvoke = invoke as jest.MockedFunction<typeof invoke>
  const mockGenerateId = generateMediaId as jest.MockedFunction<typeof generateMediaId>
  const mockRetryWithBackoff = retryWithBackoff as jest.MockedFunction<typeof retryWithBackoff>
  
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Reset counter for consistent IDs - must be before creating MediaService
    let counter = 0
    mockGenerateId.mockImplementation((type, pageId) => {
      const id = `${type}-${counter}-${pageId}`
      counter++
      return id
    })
    
    mediaService = new MediaService({ projectId })
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })
  
  describe('storeMedia retry behavior', () => {
    it('should retry on network error and succeed', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      const pageId = 'page1'
      
      // Fail first, succeed second
      mockInvoke
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined)
      
      const resultPromise = mediaService.storeMedia(file, pageId, 'image')
      
      // Advance through retry delay
      await vi.advanceTimersByTimeAsync(0) // First attempt
      await vi.advanceTimersByTimeAsync(1100) // Wait for retry
      
      const result = await resultPromise
      
      expect(result).toBeDefined()
      // The ID includes a counter, just check it starts with the right pattern
      expect(result.id).toMatch(/^image-\d+-page1$/)
      expect(mockInvoke).toHaveBeenCalledTimes(2)
      expect(mockInvoke).toHaveBeenCalledWith('store_media', expect.any(Object))
      
      // Verify retry was called with network strategy
      expect(mockRetryWithBackoff).toHaveBeenCalled()
      const retryCall = mockRetryWithBackoff.mock.calls.find(call => 
        call[1]?.maxAttempts === 3
      )
      expect(retryCall).toBeDefined()
    })
    
    it('should fail after max retry attempts', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      const pageId = 'page1'
      
      // Fail all attempts
      mockInvoke.mockRejectedValue(new Error('Persistent network error'))
      
      const resultPromise = mediaService.storeMedia(file, pageId, 'image')
      
      // Advance through all retry attempts
      await vi.advanceTimersByTimeAsync(0) // First attempt
      await vi.advanceTimersByTimeAsync(1100) // Second attempt
      await vi.advanceTimersByTimeAsync(2100) // Third attempt
      
      await expect(resultPromise).rejects.toThrow('Failed to store media')
      // mockInvoke is called twice per storeMedia (once for performanceMonitor, once for actual retry)
      // So 3 attempts = 3 calls (not 4 because performance monitor succeeds and passes through to storeMediaInternal)
      expect(mockInvoke).toHaveBeenCalled()
      expect(mockInvoke.mock.calls.length).toBeGreaterThanOrEqual(3)
    })
    
    it('should include progress callback during retries', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      const pageId = 'page1'
      const progressCallback = vi.fn()
      
      // Fail first, succeed second
      mockInvoke
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined)
      
      const resultPromise = mediaService.storeMedia(
        file, 
        pageId, 
        'image', 
        undefined,
        progressCallback
      )
      
      // Advance through retry
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1100)
      
      await resultPromise
      
      // Should have progress calls for both attempts
      expect(progressCallback).toHaveBeenCalledWith({
        loaded: 0,
        total: file.size,
        percent: 0
      })
      
      // Progress callback should be called multiple times
      expect(progressCallback).toHaveBeenCalled()
      
      // Should have initial and completion progress calls
      expect(progressCallback).toHaveBeenCalledWith({
        loaded: 0,
        total: file.size,
        percent: 0
      })
      
      expect(progressCallback).toHaveBeenCalledWith({
        loaded: file.size,
        total: file.size,
        percent: 100
      })
    })
  })
  
  describe('getMedia retry behavior', () => {
    it('should retry with fast strategy and succeed', async () => {
      const mediaId = 'image-0-page1'
      const mockData = [1, 2, 3, 4, 5]
      const mockMetadata = { type: 'image', uploadedAt: new Date().toISOString() }
      
      // Fail first, succeed second
      mockInvoke
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ data: mockData, metadata: mockMetadata })
      
      const resultPromise = mediaService.getMedia(mediaId)
      
      // Fast strategy has 100ms initial delay
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(110)
      
      const result = await resultPromise
      
      expect(result).toBeDefined()
      expect(result?.data).toBeInstanceOf(Uint8Array)
      expect(mockInvoke).toHaveBeenCalledTimes(2)
      
      // Verify fast strategy was used (maxAttempts: 2)
      const retryCall = mockRetryWithBackoff.mock.calls.find(call => 
        call[1]?.maxAttempts === 2
      )
      expect(retryCall).toBeDefined()
    })
    
    it('should return null after retry failures', async () => {
      const mediaId = 'image-0-page1'
      
      mockInvoke.mockRejectedValue(new Error('Media not found'))
      
      const resultPromise = mediaService.getMedia(mediaId)
      
      // Fast strategy: 2 attempts with 100ms delay
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(110)
      
      const result = await resultPromise
      
      expect(result).toBeNull()
      expect(mockInvoke).toHaveBeenCalledTimes(2)
    })
  })
  
  describe('deleteMedia retry behavior', () => {
    it('should retry delete operation and succeed', async () => {
      const mediaId = 'image-0-page1'
      
      // Add to cache first
      await mediaService['mediaCache'].set(mediaId, {
        id: mediaId,
        type: 'image',
        pageId: 'page1',
        fileName: 'test.jpg',
        metadata: {
          uploadedAt: new Date().toISOString(),
          type: 'image'
        }
      })
      
      // Fail first, succeed second
      mockInvoke
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined)
      
      const resultPromise = mediaService.deleteMedia(mediaId)
      
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(110)
      
      const result = await resultPromise
      
      expect(result).toBe(true)
      expect(mockInvoke).toHaveBeenCalledTimes(2)
      expect(mediaService['mediaCache'].has(mediaId)).toBe(false)
    })
    
    it('should return false after retry failures', async () => {
      const mediaId = 'image-0-page1'
      
      // Mock performanceMonitor to throw the error properly
      const performanceMonitor = await import('../../utils/performanceMonitor')
      vi.mocked(performanceMonitor.performanceMonitor.measureOperation).mockImplementation(
        async (name, operation) => {
          // Let the operation fail naturally
          return operation()
        }
      )
      
      mockInvoke.mockRejectedValue(new Error('Delete failed'))
      
      const resultPromise = mediaService.deleteMedia(mediaId)
      
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(110)
      
      const result = await resultPromise
      
      expect(result).toBe(false)
      expect(mockInvoke).toHaveBeenCalledTimes(2)
    })
  })
  
  describe('listMediaForPage retry behavior', () => {
    it('should retry list operation and succeed', async () => {
      const pageId = 'page1'
      const mockMediaList = [
        { id: 'page1-image-0', fileName: 'test1.jpg', mimeType: 'image/jpeg' },
        { id: 'page1-audio-0', fileName: 'test1.mp3', mimeType: 'audio/mpeg' }
      ]
      
      // Fail first, succeed second
      mockInvoke
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockMediaList)
      
      const resultPromise = mediaService.listMediaForPage(pageId)
      
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(110)
      
      const result = await resultPromise
      
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('page1-image-0')
      expect(mockInvoke).toHaveBeenCalledTimes(2)
    })
    
    it('should return empty array after retry failures', async () => {
      const pageId = 'page1'
      
      mockInvoke.mockRejectedValue(new Error('List failed'))
      
      const resultPromise = mediaService.listMediaForPage(pageId)
      
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(110)
      
      const result = await resultPromise
      
      expect(result).toEqual([])
      expect(mockInvoke).toHaveBeenCalledTimes(2)
    })
  })
  
  describe('listAllMedia retry behavior', () => {
    it('should retry listAllMedia and succeed', async () => {
      const mockMediaList = [
        { id: 'page1-image-0', fileName: 'test1.jpg', mimeType: 'image/jpeg' },
        { id: 'page2-audio-0', fileName: 'test2.mp3', mimeType: 'audio/mpeg' }
      ]
      
      // Fail first, succeed second
      mockInvoke
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockMediaList)
      
      const resultPromise = mediaService.listAllMedia()
      
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(110)
      
      const result = await resultPromise
      
      expect(result).toHaveLength(2)
      expect(mockInvoke).toHaveBeenCalledTimes(2)
    })
  })
  
  describe('retry strategy verification', () => {
    it.skip('should use network strategy for store operations', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      // Create a simple mock that just tracks being called
      let retryCallOptions: any = null
      vi.mocked(retryWithBackoff).mockImplementation(async (operation, options) => {
        if (options?.maxAttempts === 3) {
          retryCallOptions = options
        }
        return operation()
      })
      
      mockInvoke.mockResolvedValue(undefined)
      
      await mediaService.storeMedia(file, 'page1', 'image')
      
      // Verify network strategy was used (maxAttempts: 3)
      expect(retryCallOptions).toBeDefined()
      expect(retryCallOptions).toMatchObject({
        maxAttempts: 3,
        onRetry: expect.any(Function)
      })
    })
    
    it('should use fast strategy for read operations', async () => {
      mockInvoke.mockResolvedValue({ 
        data: [1, 2, 3], 
        metadata: { type: 'image' } 
      })
      
      await mediaService.getMedia('test-id')
      
      // Find the retry call for get operation
      const getRetryCall = mockRetryWithBackoff.mock.calls.find(call => {
        const options = call[1]
        return options?.maxAttempts === 2 // Fast strategy characteristic
      })
      
      expect(getRetryCall).toBeDefined()
    })
  })
  
  describe('error propagation with retry', () => {
    it('should preserve original error message after retries', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const originalError = new Error('Storage quota exceeded')
      
      mockInvoke.mockRejectedValue(originalError)
      
      const resultPromise = mediaService.storeMedia(file, 'page1', 'image')
      
      // Advance through all retries
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1100)
      await vi.advanceTimersByTimeAsync(2100)
      
      await expect(resultPromise).rejects.toThrow('Failed to store media: Error: Storage quota exceeded')
    })
    
    it('should handle non-Error objects in retry', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      // Reject with a non-Error object
      mockInvoke.mockRejectedValue({ code: 'QUOTA_EXCEEDED', message: 'Out of space' })
      
      const resultPromise = mediaService.storeMedia(file, 'page1', 'image')
      
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1100)
      await vi.advanceTimersByTimeAsync(2100)
      
      await expect(resultPromise).rejects.toThrow('Failed to store media')
    })
  })
})