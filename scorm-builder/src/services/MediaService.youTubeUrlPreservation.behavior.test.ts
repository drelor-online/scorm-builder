import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaService, __testing } from './MediaService'

describe('MediaService YouTube URL Preservation', () => {
  let mediaService: MediaService
  let mockFileStorage: any
  
  beforeEach(() => {
    // Clear singleton instances for clean testing
    __testing.clearInstances()
    
    // Mock FileStorage
    mockFileStorage = {
      getAllProjectMedia: vi.fn(),
      getMedia: vi.fn(),
      storeMedia: vi.fn()
    }
    
    // Use getInstance to create MediaService with mocked FileStorage
    mediaService = MediaService.getInstance({
      projectId: 'test-project',
      fileStorage: mockFileStorage as any
    })
  })

  it('should preserve YouTube URLs during aggressive cleanup for legitimate YouTube videos', async () => {
    // Mock storage data showing contaminated image and legitimate YouTube video
    const mockStorageMedia = [
      {
        id: 'video-1',
        mediaType: 'youtube', // FileStorage uses mediaType, not type
        metadata: {
          page_id: 'learning-objectives',
          pageId: 'learning-objectives', // Add both formats
          type: 'youtube',
          title: 'YouTube Video 1',
          source: 'youtube',
          embed_url: 'https://www.youtube.com/embed/abc123',
          clip_start: 10,
          clip_end: 60,
          uploadedAt: new Date().toISOString()
        }
      },
      {
        id: 'video-2', 
        mediaType: 'youtube',
        metadata: {
          page_id: 'topic-4',
          pageId: 'topic-4', // Add both formats
          type: 'youtube', 
          title: 'YouTube Video 2',
          source: 'youtube',
          embed_url: 'https://www.youtube.com/embed/def456',
          clip_start: 20,
          clip_end: 120,
          uploadedAt: new Date().toISOString()
        }
      },
      {
        id: 'image-0',
        mediaType: 'image',
        metadata: {
          page_id: 'welcome',
          pageId: 'welcome', // Add both formats
          type: 'image',
          title: 'Contaminated Image',
          // This image incorrectly has YouTube metadata - should be cleaned
          source: 'youtube',
          embed_url: 'https://www.youtube.com/embed/xyz789',
          clip_start: 5,
          clip_end: 30,
          uploadedAt: new Date().toISOString()
        }
      }
    ]

    // Setup mocks - getAllProjectMedia is the key method used by listAllMedia()
    mockFileStorage.getAllProjectMedia.mockResolvedValue(mockStorageMedia)
    
    // Mock getMedia to return the media as if reading from storage
    mockFileStorage.getMedia.mockImplementation(async (id: string) => {
      const item = mockStorageMedia.find(m => m.id === id)
      if (!item) throw new Error(`Media ${id} not found`)
      return {
        data: new Uint8Array(), // Mock binary data
        metadata: item.metadata
      }
    })

    // Mock storeMedia to capture what gets stored
    const storedMedia: any[] = []
    mockFileStorage.storeMedia.mockImplementation(async (id: string, data: any, metadata: any) => {
      storedMedia.push({ id, metadata })
    })

    // First verify that listAllMedia works
    const allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(3) // Should find all 3 items
    
    // Debug what types we actually get
    console.log('🔍 [TEST] Media types from listAllMedia:', allMedia.map(m => ({
      id: m.id,
      type: m.type,
      metadata: {
        type: m.metadata.type,
        embed_url: m.metadata.embed_url,
        source: m.metadata.source
      }
    })))
    
    // Run aggressive cleanup
    await mediaService.cleanContaminatedMedia()

    // Verify that YouTube videos kept their URLs but contaminated image was cleaned
    expect(storedMedia).toHaveLength(1) // Only the contaminated image should be re-stored
    
    const cleanedImage = storedMedia.find(m => m.id === 'image-0')
    expect(cleanedImage).toBeDefined()
    expect(cleanedImage.metadata).not.toHaveProperty('source')
    expect(cleanedImage.metadata).not.toHaveProperty('embed_url')
    expect(cleanedImage.metadata).not.toHaveProperty('clip_start')
    expect(cleanedImage.metadata).not.toHaveProperty('clip_end')
    
    // The YouTube videos should NOT have been re-stored (they should keep their URLs)
    expect(storedMedia.find(m => m.id === 'video-1')).toBeUndefined()
    expect(storedMedia.find(m => m.id === 'video-2')).toBeUndefined()
  })

  it('should identify contaminated vs legitimate media correctly', async () => {
    const testCases = [
      {
        id: 'legitimate-youtube',
        mediaType: 'youtube',
        metadata: { embed_url: 'https://youtube.com/embed/abc', type: 'youtube' },
        shouldClean: false,
        description: 'Legitimate YouTube video with embed URL'
      },
      {
        id: 'contaminated-image',
        mediaType: 'image', 
        metadata: { embed_url: 'https://youtube.com/embed/def', type: 'image' },
        shouldClean: true,
        description: 'Image with YouTube contamination'
      },
      {
        id: 'legitimate-video',
        mediaType: 'video',
        metadata: { embed_url: 'https://youtube.com/embed/ghi', clip_start: 10, type: 'video' },
        shouldClean: false,
        description: 'Video type with YouTube metadata (legitimate)'
      },
      {
        id: 'contaminated-audio',
        mediaType: 'audio',
        metadata: { source: 'youtube', clip_end: 60, type: 'audio' },
        shouldClean: true,
        description: 'Audio with YouTube contamination'
      }
    ]

    mockFileStorage.getAllProjectMedia.mockResolvedValue(testCases)
    
    // Mock individual getMedia calls
    mockFileStorage.getMedia.mockImplementation(async (id: string) => {
      const item = testCases.find(m => m.id === id)
      if (!item) throw new Error(`Media ${id} not found`)
      return {
        data: new Uint8Array(),
        metadata: item.metadata
      }
    })

    const storedMedia: any[] = []
    mockFileStorage.storeMedia.mockImplementation(async (id: string, data: any, metadata: any) => {
      storedMedia.push({ id, metadata })
    })

    await mediaService.cleanContaminatedMedia()

    // Only contaminated items should be cleaned and re-stored
    const cleanedIds = storedMedia.map(m => m.id)
    
    expect(cleanedIds).toContain('contaminated-image')
    expect(cleanedIds).toContain('contaminated-audio')
    expect(cleanedIds).not.toContain('legitimate-youtube')
    expect(cleanedIds).not.toContain('legitimate-video')
  })

  it('should demonstrate why YouTube videos are disappearing from UI', async () => {
    // This test reproduces the exact scenario from the logs
    const youTubeVideoWithMissingUrl = {
      id: 'video-1',
      type: 'youtube',
      pageId: 'learning-objectives',
      metadata: {
        page_id: 'learning-objectives',
        type: 'youtube',
        title: 'YouTube Video',
        // Missing embed_url - this is the problem!
        // The cleanup may have already removed it
      }
    }

    mockFileStorage.getAllProjectMedia.mockResolvedValue([youTubeVideoWithMissingUrl])
    
    // Mock getMedia for the listAllMedia call
    mockFileStorage.getMedia.mockImplementation(async (id: string) => {
      if (id === 'video-1') {
        return {
          data: new Uint8Array(),
          metadata: youTubeVideoWithMissingUrl.metadata
        }
      }
      throw new Error(`Media ${id} not found`)
    })
    
    // Simulate what happens when we try to load this media for display
    const allMedia = await mediaService.listAllMedia()
    
    expect(allMedia).toHaveLength(1)
    const video = allMedia[0]
    
    // This is what causes "Skipping YouTube item without URL" warning
    expect(video.metadata).not.toHaveProperty('embed_url')
    expect(video.metadata).not.toHaveProperty('embedUrl')
    
    // The video has type 'youtube' but no URL to display
    expect(video.type).toBe('youtube')
    
    // This demonstrates the root cause: YouTube videos lose their URLs
    console.log('🔍 [TEST] YouTube video missing URL:', {
      id: video.id,
      type: video.type,
      hasEmbedUrl: 'embed_url' in video.metadata,
      hasEmbedUrlCamel: 'embedUrl' in video.metadata,
      metadataKeys: Object.keys(video.metadata)
    })
  })
})