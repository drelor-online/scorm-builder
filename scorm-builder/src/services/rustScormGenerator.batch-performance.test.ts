/**
 * Batch Performance Test for SCORM Generator
 *
 * This test verifies that the batch optimization fixes eliminate the
 * "BATCH: Getting 1 media items" issue by using direct batch loading.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'

// Mock Tauri invoke first
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock logger
vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

import { preloadMediaCache } from './rustScormGenerator'
import { createMediaService } from './MediaService'
import { invoke } from '@tauri-apps/api/core'

const mockInvoke = invoke as Mock

describe('SCORM Generator Batch Performance', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Clear MediaService instances
    const { __testing } = await import('./MediaService')
    __testing.clearInstances()
  })

  it('should process prefetch hydration in parallel instead of sequential', async () => {
    // Create mock blob data
    const mockBlobs = new Map<string, Blob>()
    for (let i = 0; i < 10; i++) {
      const mockBlob = new Blob([`mock-data-${i}`], { type: 'image/jpeg' })
      mockBlobs.set(`image-${i}.jpg`, mockBlob)
    }

    const startTime = Date.now()
    await preloadMediaCache(mockBlobs)
    const duration = Date.now() - startTime

    // With parallel processing, 10 small blobs should complete much faster than sequential
    // This is more of a performance baseline - the real benefit is with larger files
    expect(duration).toBeLessThan(1000) // Should complete in under 1 second

    // Verify the cache was populated (checking internal state would require exports)
    // For now, we ensure no errors were thrown
  })

  it('should use direct batch API instead of timer-coalesced individual requests', async () => {
    const projectId = '1234567890'

    // Mock Tauri responses
    mockInvoke
      .mockResolvedValueOnce([true, true, true, true, true]) // media_exists_batch
      .mockResolvedValueOnce([ // get_media_batch
        { id: 'image-0', data: new Uint8Array([1, 2, 3]), metadata: { type: 'image', mimeType: 'image/jpeg' } },
        { id: 'image-1', data: new Uint8Array([4, 5, 6]), metadata: { type: 'image', mimeType: 'image/jpeg' } },
        { id: 'image-2', data: new Uint8Array([7, 8, 9]), metadata: { type: 'image', mimeType: 'image/jpeg' } },
        { id: 'video-0', data: new Uint8Array([10, 11, 12]), metadata: { type: 'video', mimeType: 'video/mp4' } },
        { id: 'audio-0', data: new Uint8Array([13, 14, 15]), metadata: { type: 'audio', mimeType: 'audio/mp3' } }
      ])

    const mediaService = createMediaService(projectId, undefined, true)
    const mediaIds = ['image-0', 'image-1', 'image-2', 'video-0', 'audio-0']

    // Use the direct batch API
    const results = await mediaService.getMediaBatchDirect(mediaIds)

    // Verify batch calls were made (not individual calls)
    expect(mockInvoke).toHaveBeenCalledTimes(2) // exists + get_media_batch
    expect(mockInvoke).toHaveBeenCalledWith('media_exists_batch', {
      projectId,
      mediaIds
    })
    expect(mockInvoke).toHaveBeenCalledWith('get_media_batch', {
      projectId,
      mediaIds
    })

    // Verify results
    expect(results.size).toBe(5)
    expect(results.get('image-0')).toBeTruthy()
    expect(results.get('image-1')).toBeTruthy()
    expect(results.get('video-0')).toBeTruthy()
    expect(results.get('audio-0')).toBeTruthy()
  })

  it('should handle batch loading with missing media items', async () => {
    const projectId = '1234567890'

    // Mock Tauri responses - some media doesn't exist
    mockInvoke
      .mockResolvedValueOnce([true, false, true]) // media_exists_batch - middle one missing
      .mockResolvedValueOnce([ // get_media_batch - only existing items
        { id: 'image-0', data: new Uint8Array([1, 2, 3]), metadata: { type: 'image', mimeType: 'image/jpeg' } },
        { id: 'image-2', data: new Uint8Array([7, 8, 9]), metadata: { type: 'image', mimeType: 'image/jpeg' } }
      ])

    const mediaService = createMediaService(projectId, undefined, true)
    const mediaIds = ['image-0', 'image-1', 'image-2']

    const results = await mediaService.getMediaBatchDirect(mediaIds)

    // Verify all IDs are in the result map
    expect(results.size).toBe(3)
    expect(results.get('image-0')).toBeTruthy()
    expect(results.get('image-1')).toBeNull() // Missing item
    expect(results.get('image-2')).toBeTruthy()

    // Should still only make 2 Tauri calls (batch operations)
    expect(mockInvoke).toHaveBeenCalledTimes(2)
  })

  it('should gracefully handle batch loading errors', async () => {
    const projectId = '1234567890'

    // Mock Tauri to throw an error
    mockInvoke.mockRejectedValueOnce(new Error('Backend error'))

    const mediaService = createMediaService(projectId, undefined, true)
    const mediaIds = ['image-0', 'image-1']

    // Should not throw, should return null values
    const results = await mediaService.getMediaBatchDirect(mediaIds)

    expect(results.size).toBe(2)
    expect(results.get('image-0')).toBeNull()
    expect(results.get('image-1')).toBeNull()
  })

  it('should log batch operation details for performance monitoring', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const projectId = '1234567890'

    // Mock successful batch operation
    mockInvoke
      .mockResolvedValueOnce([true, true, true]) // media_exists_batch
      .mockResolvedValueOnce([ // get_media_batch
        { id: 'image-0', data: new Uint8Array([1, 2, 3]), metadata: { type: 'image', mimeType: 'image/jpeg' } },
        { id: 'image-1', data: new Uint8Array([4, 5, 6]), metadata: { type: 'image', mimeType: 'image/jpeg' } },
        { id: 'image-2', data: new Uint8Array([7, 8, 9]), metadata: { type: 'image', mimeType: 'image/jpeg' } }
      ])

    const mediaService = createMediaService(projectId, undefined, true)
    const mediaIds = ['image-0', 'image-1', 'image-2']

    await mediaService.getMediaBatchDirect(mediaIds)

    // Verify batch operation logging
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[MediaService] DIRECT BATCH: Loading 3 media items directly')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[MediaService] DIRECT BATCH: 3/3 exist, loading...')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[MediaService] DIRECT BATCH: Received 3 media items from backend')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[MediaService] DIRECT BATCH: Completed, returned 3 items')
    )

    consoleSpy.mockRestore()
  })
})