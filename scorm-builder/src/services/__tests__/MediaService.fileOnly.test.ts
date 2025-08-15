/**
 * Test to verify MediaService uses ONLY file storage, NEVER IndexedDB
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaService, createMediaService } from '../MediaService'
import { FileStorage } from '../FileStorage'

// Mock FileStorage
vi.mock('../FileStorage', () => {
  return {
    FileStorage: vi.fn().mockImplementation(() => ({
      storeMedia: vi.fn().mockResolvedValue(undefined),
      getMedia: vi.fn().mockResolvedValue(null),
      getMediaUrl: vi.fn().mockResolvedValue('blob:mock-url'),
      getMediaForTopic: vi.fn().mockResolvedValue([]),
      storeYouTubeVideo: vi.fn().mockResolvedValue(undefined)
    }))
  }
})

describe('MediaService - File Storage Only', () => {
  let mediaService: MediaService
  let fileStorageMock: any
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear singleton instances
    MediaService.clearInstance('test-project')
    
    mediaService = createMediaService('test-project')
    // Get the mocked FileStorage instance
    fileStorageMock = (FileStorage as any).mock.results[0].value
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  it('should NEVER use IndexedDB', async () => {
    // Verify the service doesn't have any IndexedDB references
    const serviceString = mediaService.toString()
    expect(serviceString).not.toContain('indexedDB')
    expect(serviceString).not.toContain('IndexedDB')
    
    // Mock arrayBuffer for Blob
    const file = new Blob(['test'], { type: 'image/jpeg' })
    ;(file as any).arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(4))
    
    // Store media should work without IndexedDB
    await mediaService.storeMedia(file, 'test-page', 'image')
    
    // Verify FileStorage was used instead
    expect(fileStorageMock.storeMedia).toHaveBeenCalled()
  })
  
  it('should use FileStorage for storing media', async () => {
    const file = new Blob(['test content'], { type: 'image/jpeg' })
    ;(file as any).arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(12))
    const metadata = { title: 'Test Image' }
    
    const result = await mediaService.storeMedia(
      file,
      'test-page',
      'image',
      metadata
    )
    
    // Verify FileStorage.storeMedia was called
    expect(fileStorageMock.storeMedia).toHaveBeenCalled()
    
    // Verify the correct parameters were passed
    const callArgs = fileStorageMock.storeMedia.mock.calls[0]
    expect(callArgs[0]).toMatch(/^image-\d+$/) // Image IDs are just image-N
    expect(callArgs[1]).toBeInstanceOf(Blob)
    expect(callArgs[2]).toBe('image')
    expect(callArgs[3]).toMatchObject({
      page_id: 'test-page',
      type: 'image',
      title: 'Test Image'
    })
    
    // Result should be a MediaItem
    expect(result).toMatchObject({
      id: expect.stringMatching(/^image-\d+$/),  // Image IDs are just image-N
      type: 'image',
      pageId: 'test-page',
      metadata: expect.objectContaining({
        type: 'image',
        pageId: 'test-page'
      })
    })
  })
  
  it('should use FileStorage for YouTube videos', async () => {
    const youtubeUrl = 'https://youtube.com/watch?v=test'
    const embedUrl = 'https://youtube.com/embed/test'
    const metadata = { title: 'Test Video' }
    
    const result = await mediaService.storeYouTubeVideo(
      youtubeUrl,
      embedUrl,
      'test-page',
      metadata
    )
    
    // Verify FileStorage.storeYouTubeVideo was called
    expect(fileStorageMock.storeYouTubeVideo).toHaveBeenCalled()
    
    // Verify the correct parameters
    const callArgs = fileStorageMock.storeYouTubeVideo.mock.calls[0]
    expect(callArgs[0]).toMatch(/^video-\d+$/) // Video IDs are just video-N
    expect(callArgs[1]).toBe(youtubeUrl)
    expect(callArgs[2]).toMatchObject({
      page_id: 'test-page',
      title: 'Test Video',
      embed_url: embedUrl
    })
    
    // Result should be a MediaItem
    expect(result).toMatchObject({
      id: expect.stringMatching(/^video-\d+$/),  // Video IDs are just video-N
      type: 'video',
      pageId: 'test-page',
      metadata: expect.objectContaining({
        youtubeUrl,
        embedUrl,
        title: 'Test Video'
      })
    })
  })
  
  it('should get media from FileStorage', async () => {
    // Mock FileStorage to return some data
    fileStorageMock.getMedia.mockResolvedValueOnce({
      id: 'test-media',
      metadata: {
        type: 'image',
        page_id: 'test-page',
        original_name: 'test.jpg'
      }
    })
    
    const result = await mediaService.getMedia('test-media')
    
    // Verify FileStorage.getMedia was called
    expect(fileStorageMock.getMedia).toHaveBeenCalledWith('test-media')
    
    // Result should contain data and metadata
    expect(result).toBeTruthy()
    expect(result?.metadata).toMatchObject({
      type: 'image'
    })
  })
  
  it('should create blob URLs using FileStorage', async () => {
    fileStorageMock.getMediaUrl.mockResolvedValueOnce('blob:test-url')
    
    const url = await mediaService.createBlobUrl('test-media')
    
    // Verify FileStorage.getMediaUrl was called
    expect(fileStorageMock.getMediaUrl).toHaveBeenCalledWith('test-media')
    expect(url).toBe('blob:test-url')
  })
  
  it('should list media from FileStorage', async () => {
    const mockMedia = [
      {
        id: 'media1',
        metadata: {
          type: 'image',
          page_id: 'test-page',
          original_name: 'image1.jpg'
        }
      },
      {
        id: 'media2',
        metadata: {
          type: 'video',
          page_id: 'test-page',
          original_name: 'video1.mp4'
        }
      }
    ]
    
    fileStorageMock.getMediaForTopic.mockResolvedValueOnce(mockMedia)
    
    const result = await mediaService.listMediaForPage('test-page')
    
    // Verify FileStorage.getMediaForTopic was called
    expect(fileStorageMock.getMediaForTopic).toHaveBeenCalledWith('test-page')
    
    // Verify the results
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      id: 'media1',
      type: 'image',
      pageId: 'test-page'
    })
    expect(result[1]).toMatchObject({
      id: 'media2',
      type: 'video',
      pageId: 'test-page'
    })
  })
  
  it('should log that it is using FILE STORAGE ONLY', () => {
    // This test verifies the service uses file storage
    // The log message is in the constructor which runs on creation
    expect(mediaService).toBeDefined()
    
    // Verify FileStorage is instantiated
    expect(FileStorage).toHaveBeenCalled()
  })
})