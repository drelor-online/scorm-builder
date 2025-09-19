/**
 * TDD Test: MediaService Error Recovery
 *
 * Tests error recovery when loading problematic media files like
 * image-2.json/bin that cause the system to hang.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaService } from './MediaService'
import { MockFileStorage } from './MockFileStorage'

describe('MediaService Error Recovery', () => {
  let mediaService: MediaService
  let mockFileStorage: MockFileStorage

  beforeEach(() => {
    // Clear any existing singleton instances
    MediaService.clearInstance('test-project')

    mockFileStorage = new MockFileStorage()
    // Ensure getAllProjectMedia method exists and returns empty by default
    ;(mockFileStorage as any).getAllProjectMedia = vi.fn().mockResolvedValue([])
    ;(mockFileStorage as any).getMedia = vi.fn().mockResolvedValue(null)
    mediaService = MediaService.getInstance({ projectId: 'test-project', fileStorage: mockFileStorage as any })
  })

  it('should skip corrupted media files and continue loading others', async () => {
    // Arrange - Mock mix of good and corrupted media
    const mockMediaData = [
      {
        id: 'media-1',
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: 'good-image.png'
        }
      },
      {
        id: 'media-2', // This is the problematic one
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: 'image-2.png'
        }
      },
      {
        id: 'media-3',
        metadata: {
          page_id: 'topic-1',
          type: 'image',
          original_name: 'good-image-2.png'
        }
      }
    ]

    // Override the mock to return our test data
    const getAllProjectMediaMock = vi.fn().mockResolvedValue(mockMediaData)
    ;(mockFileStorage as any).getAllProjectMedia = getAllProjectMediaMock

    // Mock getMedia to fail for the problematic media
    const getMediaMock = vi.fn().mockImplementation((mediaId) => {
      console.log(`DEBUG: mockFileStorage.getMedia called with: ${mediaId}`)
      if (mediaId === 'media-2') {
        console.log(`DEBUG: Throwing error for ${mediaId}`)
        return Promise.reject(new Error('Failed to load external media file: image-2.bin not accessible'))
      }
      console.log(`DEBUG: Returning success for ${mediaId}`)
      return Promise.resolve({
        data: new Uint8Array(100),
        metadata: mockMediaData.find(m => m.id === mediaId)?.metadata
      })
    })
    ;(mockFileStorage as any).getMedia = getMediaMock

    // Debug: Check if the mock method is actually present
    console.log('DEBUG: mockFileStorage.getAllProjectMedia present?', typeof (mockFileStorage as any).getAllProjectMedia)
    console.log('DEBUG: mockFileStorage methods:', Object.getOwnPropertyNames(mockFileStorage))
    console.log('DEBUG: mockFileStorage instance:', mockFileStorage.constructor.name)
    console.log('DEBUG: MediaService fileStorage same as mock?', (mediaService as any).fileStorage === mockFileStorage)

    // Act - Load media from disk (loads metadata)
    await mediaService.loadMediaFromDisk()

    // Check if mock was called
    console.log('DEBUG: getAllProjectMediaMock called?', getAllProjectMediaMock.mock.calls.length)
    if (getAllProjectMediaMock.mock.calls.length > 0) {
      console.log('DEBUG: getAllProjectMediaMock call results:', await getAllProjectMediaMock.mock.results[0].value)
    }

    // Verify all media metadata was loaded initially
    const allMedia = await mediaService.listAllMedia()
    console.log('DEBUG: allMedia after loadMediaFromDisk:', allMedia)
    expect(allMedia).toHaveLength(3) // All should have metadata

    // Now trigger actual binary data loading (this is where errors occur)
    console.log('DEBUG: About to call getMedia for all items...')
    const results = await Promise.allSettled([
      mediaService.getMedia('media-1'),
      mediaService.getMedia('media-2'), // This should fail
      mediaService.getMedia('media-3')
    ])

    console.log('DEBUG: getMedia results:')
    results.forEach((result, index) => {
      const mediaId = ['media-1', 'media-2', 'media-3'][index]
      console.log(`  ${mediaId}: ${result.status}`, result.status === 'fulfilled' ? '✓' : result.reason)
    })

    console.log('DEBUG: getMediaMock call count:', getMediaMock.mock.calls.length)
    getMediaMock.mock.calls.forEach((call, i) => {
      console.log(`  Call ${i}: ${call[0]}`)
    })

    // Assert - Failed media should be tracked
    const failedMedia = mediaService.getFailedMedia()
    expect(failedMedia).toHaveLength(1)
    expect(failedMedia[0].id).toBe('media-2')
  })

  it('should collect error details for failed media', async () => {
    // Arrange
    const mockMediaData = [
      {
        id: 'media-corrupted',
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: 'image-2.png'
        }
      }
    ]

    mockFileStorage.getAllProjectMedia = vi.fn().mockResolvedValue(mockMediaData)
    mockFileStorage.getMedia = vi.fn().mockRejectedValue(
      new Error('File not accessible: C:\\Users\\sierr\\Desktop\\image-2.bin')
    )

    // Act - Load metadata first, then trigger binary loading
    await mediaService.loadMediaFromDisk()

    // Verify metadata was loaded
    const allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(1) // Metadata loaded

    // Trigger the actual binary data loading that will fail
    await mediaService.getMedia('media-corrupted')

    // Assert - Should have error details available
    const failedMedia = mediaService.getFailedMedia()
    expect(failedMedia).toHaveLength(1)
    expect(failedMedia[0]).toEqual({
      id: 'media-corrupted',
      originalName: 'image-2.png',
      pageId: 'topic-0',
      error: 'File not accessible: C:\\Users\\sierr\\Desktop\\image-2.bin',
      timestamp: expect.any(String)
    })
  })

  it('should continue loading if entire getAllProjectMedia fails', async () => {
    // Arrange - Make getAllProjectMedia fail completely
    mockFileStorage.getAllProjectMedia = vi.fn().mockRejectedValue(
      new Error('Project directory not accessible')
    )

    // Act - Should not throw
    await expect(mediaService.loadMediaFromDisk()).resolves.not.toThrow()

    // Assert - Should have empty media but system still works
    const allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(0)
  })

  it('should retry failed media when requested', async () => {
    // Arrange - Setup initially failing media
    const mockMediaData = [{
      id: 'retry-media',
      metadata: {
        page_id: 'topic-0',
        type: 'image',
        original_name: 'retry-image.png'
      }
    }]

    mockFileStorage.getAllProjectMedia = vi.fn().mockResolvedValue(mockMediaData)

    let shouldFail = true
    mockFileStorage.getMedia = vi.fn().mockImplementation(() => {
      if (shouldFail) {
        throw new Error('Temporary failure')
      }
      return Promise.resolve({
        data: new Uint8Array(100),
        metadata: mockMediaData[0].metadata
      })
    })

    // Act - Load metadata first
    await mediaService.loadMediaFromDisk()

    // Verify metadata was loaded
    const allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(1) // Metadata loaded

    // Trigger the binary loading that will fail initially
    await mediaService.getMedia('retry-media')

    expect(mediaService.getFailedMedia()).toHaveLength(1)

    // Now make it succeed
    shouldFail = false

    // Act - Retry failed media
    await mediaService.retryFailedMedia()

    // Assert - Should now have the media loaded successfully
    const retriedMedia = await mediaService.getMedia('retry-media')
    expect(retriedMedia).not.toBeNull()
    expect(mediaService.getFailedMedia()).toHaveLength(0)
  })

  it('should allow clearing failed media list', async () => {
    // Arrange - Create some failed media
    const mockMediaData = [{
      id: 'failed-media',
      metadata: { page_id: 'topic-0', type: 'image', original_name: 'failed.png' }
    }]

    mockFileStorage.getAllProjectMedia = vi.fn().mockResolvedValue(mockMediaData)
    mockFileStorage.getMedia = vi.fn().mockRejectedValue(new Error('Failed to load'))

    // Load metadata first
    await mediaService.loadMediaFromDisk()

    // Verify metadata was loaded
    const allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(1) // Metadata loaded

    // Trigger binary loading that will fail
    await mediaService.getMedia('failed-media')

    expect(mediaService.getFailedMedia()).toHaveLength(1)

    // Act - Clear failed media
    mediaService.clearFailedMedia()

    // Assert - Failed media list should be empty
    expect(mediaService.getFailedMedia()).toHaveLength(0)
  })
})