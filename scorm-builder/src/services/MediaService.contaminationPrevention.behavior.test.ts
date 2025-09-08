import { describe, test, expect, vi, beforeEach } from 'vitest'
import { MediaService } from './MediaService'

/**
 * BEHAVIOR TEST: Contamination Prevention at Storage Layer
 * 
 * This test reproduces contamination scenarios and verifies that the storage
 * layer prevents YouTube metadata from being stored with non-video media.
 */

const mockFileStorage: any = {
  storeMedia: vi.fn(),
  getMedia: vi.fn(),
  deleteMedia: vi.fn(),
  listAllMedia: vi.fn().mockResolvedValue([]),
  clearAllMedia: vi.fn(),
  generateMediaUrl: vi.fn(),
  getAllProjectMedia: vi.fn().mockResolvedValue([])
}

describe('MediaService - Contamination Prevention at Storage Layer', () => {
  let mediaService: MediaService
  
  beforeEach(() => {
    vi.clearAllMocks()
    mediaService = new MediaService(mockFileStorage, 'test-project-123')
  })

  test('PREVENTION: Should block YouTube metadata when storing image media', async () => {
    console.log('[TEST] 🛡️ Testing prevention of YouTube contamination in image storage')
    
    // Attempt to store an image with contaminated YouTube metadata
    const contaminatedImageData = new Uint8Array([255, 216, 255, 224]) // Mock JPEG header
    const contaminatedMetadata = {
      type: 'image',
      pageId: 'page-1',
      originalName: 'image.jpg',
      mimeType: 'image/jpeg',
      // These should be BLOCKED for image media
      source: 'youtube',
      youtubeUrl: 'https://youtube.com/watch?v=contamination',
      embedUrl: 'https://youtube.com/embed/contamination',
      clipStart: 30,
      clipEnd: 60,
      isYouTube: true
    }
    
    // Mock file storage to capture what actually gets stored
    const storedMetadata: any[] = []
    mockFileStorage.storeMedia.mockImplementation((id: string, blob: Blob, type: string, metadata: any) => {
      storedMetadata.push({ id, type, metadata })
      return Promise.resolve(true)
    })
    
    // Attempt to store the contaminated image
    const imageBlob = new Blob([contaminatedImageData], { type: 'image/jpeg' })
    await mediaService.storeMedia(
      imageBlob,
      'page-1',
      'image',
      contaminatedMetadata
    )
    
    expect(storedMetadata).toHaveLength(1)
    const actualMetadata = storedMetadata[0].metadata
    
    console.log('[TEST] 🧹 Metadata before prevention:', Object.keys(contaminatedMetadata))
    console.log('[TEST] 🛡️ Metadata after prevention:', Object.keys(actualMetadata))
    
    // YouTube metadata should be stripped out
    expect(actualMetadata.source).not.toBe('youtube')
    expect(actualMetadata.youtubeUrl).toBeUndefined()
    expect(actualMetadata.embedUrl).toBeUndefined()
    expect(actualMetadata.clipStart).toBeUndefined()
    expect(actualMetadata.clipEnd).toBeUndefined()
    expect(actualMetadata.isYouTube).toBeUndefined()
    
    // Legitimate metadata should remain
    expect(actualMetadata.originalName).toBe('image.jpg')
    expect(actualMetadata.mimeType).toBe('image/jpeg')
    expect(actualMetadata.type).toBe('image')
  })

  test('PREVENTION: Should block YouTube metadata when storing audio media', async () => {
    console.log('[TEST] 🛡️ Testing prevention of YouTube contamination in audio storage')
    
    const contaminatedAudioData = new Uint8Array([73, 68, 51, 3]) // Mock MP3 ID3 header
    const contaminatedMetadata = {
      type: 'audio',
      pageId: 'page-1',
      originalName: 'audio.mp3',
      mimeType: 'audio/mpeg',
      duration: 180,
      // These should be BLOCKED for audio media
      youtubeUrl: 'https://youtube.com/watch?v=audio-contamination',
      clipStart: 15,
      isYouTube: true
    }
    
    const storedMetadata: any[] = []
    mockFileStorage.storeMedia.mockImplementation((id: string, blob: Blob, type: string, metadata: any) => {
      storedMetadata.push({ id, type, metadata })
      return Promise.resolve(true)
    })
    
    const audioBlob = new Blob([contaminatedAudioData], { type: 'audio/mpeg' })
    await mediaService.storeMedia(
      audioBlob,
      'page-1',
      'audio',
      contaminatedMetadata
    )
    
    expect(storedMetadata).toHaveLength(1)
    const actualMetadata = storedMetadata[0].metadata
    
    // YouTube contamination should be removed
    expect(actualMetadata.youtubeUrl).toBeUndefined()
    expect(actualMetadata.clipStart).toBeUndefined()
    expect(actualMetadata.isYouTube).toBeUndefined()
    
    // Legitimate audio metadata should remain
    expect(actualMetadata.originalName).toBe('audio.mp3')
    expect(actualMetadata.mimeType).toBe('audio/mpeg')
    expect(actualMetadata.duration).toBe(180)
  })

  test('ALLOWED: Should preserve YouTube metadata when storing video media', async () => {
    console.log('[TEST] ✅ Testing that legitimate YouTube video metadata is preserved')
    
    const videoData = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]) // Mock MP4 header
    const legitimateVideoMetadata = {
      type: 'video',
      pageId: 'page-1',
      originalName: 'video.mp4',
      mimeType: 'video/mp4',
      // These should be ALLOWED for video media
      source: 'youtube',
      youtubeUrl: 'https://youtube.com/watch?v=legitimate-video',
      embedUrl: 'https://youtube.com/embed/legitimate-video',
      clipStart: 30,
      clipEnd: 60,
      isYouTube: true,
      title: 'Legitimate YouTube Video'
    }
    
    const storedMetadata: any[] = []
    mockFileStorage.storeMedia.mockImplementation((id: string, blob: Blob, type: string, metadata: any) => {
      storedMetadata.push({ id, type, metadata })
      return Promise.resolve(true)
    })
    
    const videoBlob = new Blob([videoData], { type: 'video/mp4' })
    await mediaService.storeMedia(
      videoBlob,
      'page-1',
      'video',
      legitimateVideoMetadata
    )
    
    expect(storedMetadata).toHaveLength(1)
    const actualMetadata = storedMetadata[0].metadata
    
    console.log('[TEST] ✅ Video metadata preserved:', Object.keys(actualMetadata))
    
    // YouTube metadata should be preserved for video
    expect(actualMetadata.source).toBe('youtube')
    expect(actualMetadata.youtubeUrl).toBe('https://youtube.com/watch?v=legitimate-video')
    expect(actualMetadata.embedUrl).toBe('https://youtube.com/embed/legitimate-video')
    expect(actualMetadata.clipStart).toBe(30)
    expect(actualMetadata.clipEnd).toBe(60)
    expect(actualMetadata.isYouTube).toBe(true)
    expect(actualMetadata.title).toBe('Legitimate YouTube Video')
  })

  test('EDGE CASE: Should handle mixed legitimate and contaminated metadata', async () => {
    console.log('[TEST] 🎯 Testing mixed metadata scenario - some legitimate, some contaminated')
    
    const imageData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) // PNG header
    const mixedMetadata = {
      type: 'image',
      pageId: 'page-1',
      originalName: 'mixed-image.png',
      mimeType: 'image/png',
      uploadedAt: '2023-01-01T00:00:00Z',
      customField: 'should-remain',
      // Contaminated fields that should be removed
      clipStart: 45,
      youtubeUrl: 'https://youtube.com/contamination',
      // Edge case: field that contains 'youtube' in name but isn't standard
      myYoutubeReference: 'should-be-removed',
      // Field that contains 'clip' but isn't timing
      paperclip: 'should-remain' // This is NOT contamination
    }
    
    const storedMetadata: any[] = []
    mockFileStorage.storeMedia.mockImplementation((id: string, blob: Blob, type: string, metadata: any) => {
      storedMetadata.push({ id, type, metadata })
      return Promise.resolve(true)
    })
    
    const imageBlob = new Blob([imageData], { type: 'image/png' })
    await mediaService.storeMedia(
      imageBlob,
      'page-1',
      'image',
      mixedMetadata
    )
    
    expect(storedMetadata).toHaveLength(1)
    const actualMetadata = storedMetadata[0].metadata
    
    // Contaminated fields should be removed
    expect(actualMetadata.clipStart).toBeUndefined()
    expect(actualMetadata.youtubeUrl).toBeUndefined()
    expect(actualMetadata.myYoutubeReference).toBeUndefined()
    
    // Legitimate fields should remain
    expect(actualMetadata.originalName).toBe('mixed-image.png')
    expect(actualMetadata.mimeType).toBe('image/png')
    expect(actualMetadata.uploadedAt).toBe('2023-01-01T00:00:00Z')
    expect(actualMetadata.customField).toBe('should-remain')
    expect(actualMetadata.paperclip).toBe('should-remain') // Not YouTube contamination
  })

  test('PERFORMANCE: Prevention should not significantly impact storage performance', async () => {
    console.log('[TEST] ⚡ Testing that contamination prevention doesn\'t slow down storage')
    
    const imageData = new Uint8Array(1000).fill(255) // 1KB of data
    const metadataWithContamination = {
      type: 'image',
      pageId: 'page-1',
      originalName: 'performance-test.jpg',
      mimeType: 'image/jpeg',
      // Add contamination to trigger prevention logic
      youtubeUrl: 'https://youtube.com/performance-test',
      clipStart: 30,
      embedUrl: 'https://youtube.com/embed/performance-test'
    }
    
    mockFileStorage.storeMedia.mockResolvedValue(true)
    
    const startTime = performance.now()
    
    // Store multiple items to test performance
    const promises = Array.from({ length: 10 }, (_, i) =>
      mediaService.storeMedia(
        new Blob([imageData], { type: 'image/jpeg' }),
        'page-1',
        'image',
        { ...metadataWithContamination, id: `perf-${i}` }
      )
    )
    
    await Promise.all(promises)
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    console.log('[TEST] ⚡ Prevention processing time for 10 items:', duration, 'ms')
    console.log('[TEST] ⚡ Average per item:', duration / 10, 'ms')
    
    expect(duration).toBeLessThan(100) // Should complete within 100ms
    expect(mockFileStorage.storeMedia).toHaveBeenCalledTimes(10)
  })

  test('VALIDATION: Should validate that prevention rules are comprehensive', async () => {
    console.log('[TEST] 🔍 Testing that all known contamination patterns are caught by prevention')
    
    const testData = new Uint8Array([1, 2, 3, 4])
    const allKnownContamination = {
      type: 'image',
      pageId: 'page-1',
      originalName: 'comprehensive-test.jpg',
      // Standard camelCase contamination
      source: 'youtube',
      youtubeUrl: 'https://youtube.com/test',
      embedUrl: 'https://youtube.com/embed/test',
      clipStart: 30,
      clipEnd: 60,
      isYouTube: true,
      // Snake case contamination
      youtube_url: 'https://youtube.com/snake-test',
      embed_url: 'https://youtube.com/embed/snake-test',
      clip_start: 45,
      clip_end: 90,
      is_youtube: true,
      // Mixed case contamination
      youTubeUrl: 'https://youtube.com/mixed-test',
      embedURL: 'https://youtube.com/embed/mixed-test',
      // Uppercase contamination
      YOUTUBE_URL: 'https://youtube.com/upper-test',
      CLIP_START: 15,
      CLIP_END: 75
    }
    
    const storedMetadata: any[] = []
    mockFileStorage.storeMedia.mockImplementation((id: string, blob: Blob, type: string, metadata: any) => {
      storedMetadata.push({ id, type, metadata })
      return Promise.resolve(true)
    })
    
    const testBlob = new Blob([testData], { type: 'image/jpeg' })
    await mediaService.storeMedia(
      testBlob,
      'page-1',
      'image',
      allKnownContamination
    )
    
    expect(storedMetadata).toHaveLength(1)
    const actualMetadata = storedMetadata[0].metadata
    
    console.log('[TEST] 🔍 Original contamination fields:', Object.keys(allKnownContamination).length)
    console.log('[TEST] 🔍 Cleaned metadata fields:', Object.keys(actualMetadata).length)
    
    // ALL contamination patterns should be removed
    const contaminationFields = [
      'source', 'youtubeUrl', 'embedUrl', 'clipStart', 'clipEnd', 'isYouTube',
      'youtube_url', 'embed_url', 'clip_start', 'clip_end', 'is_youtube',
      'youTubeUrl', 'embedURL', 'YOUTUBE_URL', 'CLIP_START', 'CLIP_END'
    ]
    
    contaminationFields.forEach(field => {
      expect(actualMetadata[field]).toBeUndefined(`Field '${field}' should be removed by prevention`)
    })
    
    // Only legitimate fields should remain
    expect(actualMetadata.type).toBe('image')
    expect(actualMetadata.pageId).toBe('page-1')
    expect(actualMetadata.originalName).toBe('comprehensive-test.jpg')
  })
})