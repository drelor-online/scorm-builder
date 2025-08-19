import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MediaService, { __testing, createMediaService } from './MediaService'
import { FileStorage } from '../services/FileStorage'

// Mock FileStorage
vi.mock('../services/FileStorage', () => ({
  FileStorage: vi.fn()
}))

describe('MediaService Request Deduplication', () => {
  let mediaService: MediaService
  let mockFileStorage: any
  const projectId = 'test-project-123'
  let callCount = 0
  
  beforeEach(() => {
    vi.clearAllMocks()
    __testing.clearInstances()
    callCount = 0
    
    // Create mock FileStorage instance
    mockFileStorage = {
      getAllProjectMedia: vi.fn().mockImplementation(async () => {
        callCount++
        // Simulate a slow backend call
        await new Promise(resolve => setTimeout(resolve, 100))
        return [
          { id: 'media-1', mediaType: 'audio', metadata: { page_id: 'page-1' } },
          { id: 'media-2', mediaType: 'image', metadata: { page_id: 'page-2' } }
        ]
      }),
      getMedia: vi.fn(),
      storeMedia: vi.fn(),
      deleteMedia: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
      openProject: vi.fn().mockResolvedValue(undefined),
      isProjectOpen: vi.fn().mockReturnValue(true),
      getCurrentProjectId: vi.fn().mockReturnValue(projectId)
    }
    
    // Mock FileStorage constructor
    vi.mocked(FileStorage).mockImplementation(() => mockFileStorage as any)
    
    // Create MediaService
    mediaService = createMediaService(projectId)
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
    __testing.clearInstances()
  })
  
  it('should deduplicate concurrent loadMediaFromDisk calls', async () => {
    // Make multiple concurrent calls to loadMediaFromDisk
    const promises = [
      mediaService.loadMediaFromDisk(),
      mediaService.loadMediaFromDisk(),
      mediaService.loadMediaFromDisk(),
      mediaService.loadMediaFromDisk(),
      mediaService.loadMediaFromDisk()
    ]
    
    // Wait for all to complete
    await Promise.all(promises)
    
    // Should only call backend once despite 5 concurrent requests
    expect(callCount).toBe(1)
    expect(mockFileStorage.getAllProjectMedia).toHaveBeenCalledTimes(1)
    
    // All promises should resolve with the same data
    const allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(2)
  })
  
  it('should allow new calls after the first completes', async () => {
    // First call
    await mediaService.loadMediaFromDisk()
    expect(callCount).toBe(1)
    
    // Second call after first completes should trigger a new backend call
    await mediaService.loadMediaFromDisk()
    expect(callCount).toBe(2)
    
    // Backend should be called twice total
    expect(mockFileStorage.getAllProjectMedia).toHaveBeenCalledTimes(2)
  })
  
  it('should handle errors without breaking deduplication', async () => {
    // Make getAllProjectMedia fail
    mockFileStorage.getAllProjectMedia.mockRejectedValueOnce(new Error('Backend error'))
    
    // First call should fail
    await expect(mediaService.loadMediaFromDisk()).rejects.toThrow('Backend error')
    
    // Fix the mock to succeed
    mockFileStorage.getAllProjectMedia.mockResolvedValueOnce([
      { id: 'media-1', mediaType: 'audio', metadata: { page_id: 'page-1' } }
    ])
    
    // Second call should work
    await mediaService.loadMediaFromDisk()
    
    // Should have made 2 backend calls total
    expect(mockFileStorage.getAllProjectMedia).toHaveBeenCalledTimes(2)
  })
})