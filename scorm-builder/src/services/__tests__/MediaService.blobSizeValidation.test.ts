import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaService } from '../MediaService'
import { FileStorage } from '../FileStorage'

// Mock FileStorage
vi.mock('../FileStorage', () => ({
  FileStorage: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    saveMedia: vi.fn(),
    storeMedia: vi.fn(), // Add storeMedia
    getMedia: vi.fn(),
    deleteMedia: vi.fn(),
    listMedia: vi.fn(),
    hasMedia: vi.fn()
  }))
}))

describe('MediaService - Blob Size Validation', () => {
  let mediaService: MediaService
  let mockFileStorage: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockFileStorage = new FileStorage('test-project')
    mediaService = new MediaService({
      projectId: 'test-project',
      fileStorage: mockFileStorage
    })
  })

  it('should return media data with size > 0 when getting media', async () => {
    // Create test data with actual content
    const testImageData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) // PNG header
    const testMediaId = 'image-123'
    
    // Mock FileStorage to return actual data
    mockFileStorage.getMedia.mockResolvedValue({
      data: testImageData,
      metadata: {
        type: 'image',
        mimeType: 'image/png',
        size: testImageData.length,
        uploadedAt: new Date().toISOString()
      }
    })

    // Get media
    const result = await mediaService.getMedia(testMediaId)
    
    // Verify data exists and has size
    expect(result).toBeTruthy()
    expect(result?.data).toBeTruthy()
    expect(result?.data.length).toBeGreaterThan(0)
    expect(result?.data.length).toBe(8) // PNG header is 8 bytes
    expect(result?.metadata.size).toBe(8)
  })

  it('should store media with proper size metadata', async () => {
    // Create test blob with actual content
    const testContent = 'Test image content'
    const testBlob = new Blob([testContent], { type: 'image/jpeg' })
    
    // Add arrayBuffer method to blob if it doesn't exist (for test environment)
    if (!testBlob.arrayBuffer) {
      testBlob.arrayBuffer = async () => {
        const buffer = new ArrayBuffer(testContent.length)
        const view = new Uint8Array(buffer)
        for (let i = 0; i < testContent.length; i++) {
          view[i] = testContent.charCodeAt(i)
        }
        return buffer
      }
    }
    
    // Mock successful storage
    mockFileStorage.storeMedia.mockResolvedValue(true)
    
    // Store media - params: file, pageId, type, metadata
    const result = await mediaService.storeMedia(testBlob, 'page-1', 'image', {
      title: 'Test Image'
    })
    
    // Verify that storeMedia was called with proper data
    expect(mockFileStorage.storeMedia).toHaveBeenCalled()
    expect(result).toBeTruthy()
    
    // The method signature for FileStorage.storeMedia is:
    // storeMedia(id, blob, mediaType, metadata)
    const callArgs = mockFileStorage.storeMedia.mock.calls[0]
    expect(callArgs[0]).toMatch(/^image-\d+$/) // mediaId pattern
    expect(callArgs[1]).toBeInstanceOf(Blob) // blob
    expect(callArgs[2]).toBe('image') // type
    expect(callArgs[3]).toMatchObject({
      page_id: 'page-1',
      type: 'image'
    })
  })

  it('should fail to create blob URL when media data is empty', async () => {
    // Mock FileStorage returning empty data
    mockFileStorage.getMedia.mockResolvedValue({
      data: new Uint8Array(0), // Empty data
      metadata: {
        type: 'image',
        mimeType: 'image/jpeg',
        size: 0,
        uploadedAt: new Date().toISOString()
      }
    })

    // Get media
    const result = await mediaService.getMedia('empty-media')
    
    // Should return data but it should be empty
    expect(result).toBeTruthy()
    expect(result?.data.length).toBe(0)
    expect(result?.metadata.size).toBe(0)
  })

  it('should handle video files with proper size', async () => {
    // Create test video data (simplified MP4 header)
    const testVideoData = new Uint8Array([
      0x00, 0x00, 0x00, 0x20, // Size
      0x66, 0x74, 0x79, 0x70, // 'ftyp'
      0x69, 0x73, 0x6F, 0x6D  // 'isom'
    ])
    const testMediaId = 'video-789'
    
    // Mock FileStorage to return video data
    mockFileStorage.getMedia.mockResolvedValue({
      data: testVideoData,
      metadata: {
        type: 'video',
        mimeType: 'video/mp4',
        size: testVideoData.length,
        uploadedAt: new Date().toISOString()
      }
    })

    // Get media
    const result = await mediaService.getMedia(testMediaId)
    
    // Verify video data exists and has size
    expect(result).toBeTruthy()
    expect(result?.data).toBeTruthy()
    expect(result?.data.length).toBe(12)
    expect(result?.metadata.type).toBe('video')
    expect(result?.metadata.mimeType).toBe('video/mp4')
  })

  it('should validate blob size before creating URL in browser context', async () => {
    // This test simulates what happens in the browser when creating blob URLs
    const testData = new Uint8Array([1, 2, 3, 4, 5])
    
    mockFileStorage.getMedia.mockResolvedValue({
      data: testData,
      metadata: {
        type: 'image',
        mimeType: 'image/png',
        size: testData.length,
        uploadedAt: new Date().toISOString()
      }
    })

    const result = await mediaService.getMedia('test-media')
    
    // In browser context, this would be used to create a blob
    const blob = new Blob([result!.data], { type: result!.metadata.mimeType })
    
    // Verify blob has proper size
    expect(blob.size).toBe(5)
    expect(blob.size).toBeGreaterThan(0)
    expect(blob.type).toBe('image/png')
  })
})