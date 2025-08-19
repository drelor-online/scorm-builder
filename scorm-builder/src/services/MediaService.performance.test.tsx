import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MediaService, { __testing, createMediaService } from './MediaService'
import { FileStorage } from '../services/FileStorage'

// Mock FileStorage module - don't actually mock it, we'll create mock instances
vi.mock('../services/FileStorage', () => ({
  FileStorage: vi.fn()
}))

describe('MediaService Performance Tests', () => {
  let mediaService: MediaService
  let mockFileStorage: any
  const projectId = 'test-project-123'
  
  // Create mock media data simulating 30 media items with binary data
  const createMockMediaData = (count: number) => {
    const mediaItems = []
    for (let i = 0; i < count; i++) {
      // Simulate a 2MB audio file (typical for our app)
      const largeBinaryData = new Uint8Array(2 * 1024 * 1024) // 2MB
      mediaItems.push({
        id: `media-${i}`,
        data: largeBinaryData,
        metadata: {
          page_id: `page-${i}`,
          type: i % 2 === 0 ? 'audio' : 'image',
          original_name: `file-${i}.mp3`,
          mime_type: 'audio/mpeg',
          source: null,
          embed_url: null,
          title: `Media Item ${i}`
        }
      })
    }
    return mediaItems
  }

  beforeEach(() => {
    vi.clearAllMocks()
    __testing.clearInstances() // Clear singleton instances
    
    // Create mock FileStorage instance
    mockFileStorage = {
      getAllProjectMedia: vi.fn(),
      getMedia: vi.fn(),
      storeMedia: vi.fn(),
      deleteMedia: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
      openProject: vi.fn().mockResolvedValue(undefined),
      isProjectOpen: vi.fn().mockReturnValue(true),
      getCurrentProjectId: vi.fn().mockReturnValue(projectId)
    }
    
    // Mock FileStorage constructor to return our mock
    vi.mocked(FileStorage).mockImplementation(() => mockFileStorage as any)
    
    // Create MediaService using the factory function
    mediaService = createMediaService(projectId)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    __testing.clearInstances()
  })

  it('should load 30 media items within acceptable time limit', async () => {
    // Arrange - Mock FileStorage to return 30 media items
    const mockMediaData = createMockMediaData(30)
    
    // Simulate the slow backend behavior - reading all binary data
    mockFileStorage.getAllProjectMedia.mockImplementation(async () => {
      // Simulate the 28-30 second delay we're seeing in production
      // This is what we need to fix!
      await new Promise(resolve => setTimeout(resolve, 28000)) // 28 seconds
      return mockMediaData
    })
    
    // Act - Measure the time it takes to load media
    const startTime = performance.now()
    await mediaService.loadMediaFromDisk()
    const endTime = performance.now()
    const loadTime = endTime - startTime
    
    // Assert - This test should FAIL initially (demonstrating the problem)
    // We want load time to be under 2 seconds, but it will take ~28 seconds
    expect(loadTime).toBeLessThan(2000) // Should be under 2 seconds
    
    // Also verify the media was loaded correctly
    const allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(30)
  })
  
  it('should not load binary data when listing media metadata', async () => {
    // This test demonstrates what we WANT to happen
    // We should be able to list media without loading all binary data
    
    // Arrange - Mock a more efficient implementation
    const mockMetadataOnly = Array.from({ length: 30 }, (_, i) => ({
      id: `media-${i}`,
      metadata: {
        page_id: `page-${i}`,
        type: i % 2 === 0 ? 'audio' : 'image',
        original_name: `file-${i}.mp3`,
        mime_type: 'audio/mpeg',
        source: null,
        embed_url: null,
        title: `Media Item ${i}`
      }
    }))
    
    // This is what we want - fast metadata-only loading
    mockFileStorage.getAllProjectMedia.mockResolvedValue(mockMetadataOnly)
    
    // Act
    const startTime = performance.now()
    await mediaService.loadMediaFromDisk()
    const endTime = performance.now()
    const loadTime = endTime - startTime
    
    // Assert - This should be fast
    expect(loadTime).toBeLessThan(500) // Should be under 500ms for metadata only
    
    const allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(30)
  })
  
  it('should avoid duplicate calls to getAllProjectMedia', async () => {
    // Arrange
    const mockMediaData = createMockMediaData(5)
    mockFileStorage.getAllProjectMedia.mockResolvedValue(mockMediaData)
    
    // Act - Call loadMediaFromDisk multiple times (simulating what happens in the app)
    await Promise.all([
      mediaService.loadMediaFromDisk(),
      mediaService.loadMediaFromDisk(),
      mediaService.loadMediaFromDisk()
    ])
    
    // Assert - Should only call backend once, not three times
    expect(mockFileStorage.getAllProjectMedia).toHaveBeenCalledTimes(1)
  })
  
  it('should load binary data lazily when getMedia is called', async () => {
    // Arrange - Setup metadata-only initial load
    const mockMetadata = [{
      id: 'audio-1',
      metadata: {
        page_id: 'page-1',
        type: 'audio',
        original_name: 'audio.mp3',
        mime_type: 'audio/mpeg',
        source: null,
        embed_url: null,
        title: 'Test Audio'
      }
    }]
    
    mockFileStorage.getAllProjectMedia.mockResolvedValue(mockMetadata)
    
    // Mock individual media fetch with binary data
    mockFileStorage.getMedia.mockResolvedValue({
      found: true,
      id: 'audio-1',
      data: new Uint8Array(1024), // 1KB of data
      metadata: mockMetadata[0].metadata
    } as any)
    
    // Act
    await mediaService.loadMediaFromDisk()
    
    // Initial load should not fetch binary data
    expect(mockFileStorage.getMedia).not.toHaveBeenCalled()
    
    // Now request specific media - this should fetch binary data
    const media = await mediaService.getMedia('audio-1')
    
    // Assert
    expect(mockFileStorage.getMedia).toHaveBeenCalledWith('test-project-123', 'audio-1')
    expect(media).toBeDefined()
    expect(media?.data).toBeDefined()
  })
})