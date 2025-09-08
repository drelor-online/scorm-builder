import { describe, test, expect, vi, beforeEach } from 'vitest'
import { MediaService } from './MediaService'

/**
 * INTEGRATION TEST: Aggressive Contamination Cleanup
 * 
 * This test directly tests the enhanced cleanup method by creating
 * a MediaService instance with controlled data.
 */

// Create a proper mock FileStorage that actually returns data
class MockFileStorage {
  private mediaData: any[] = []
  
  setMockData(data: any[]) {
    console.log('[MOCK] Setting mock data:', data.length, 'items')
    this.mediaData = data
  }
  
  async listAllMedia() {
    console.log('[MOCK] listAllMedia returning:', this.mediaData.length, 'items')
    return this.mediaData
  }
  
  // This is the method MediaService actually calls!
  async getAllProjectMedia() {
    console.log('[MOCK] getAllProjectMedia returning:', this.mediaData.length, 'items')
    return this.mediaData.map(item => ({
      id: item.id,
      mediaType: item.type,
      metadata: {
        ...item.metadata,
        fileName: item.fileName,
        page_id: item.pageId
      }
    }))
  }
  
  async storeMedia(id: string, blob: Blob, type: string, metadata: any) {
    console.log('[MOCK] storeMedia called for:', id, 'with metadata keys:', Object.keys(metadata))
    return true
  }
  
  async getMedia() { return null }
  async deleteMedia() { return true }
  async clearAllMedia() { return true }
  async generateMediaUrl() { return null }
}

describe('MediaService - Aggressive Contamination Cleanup Integration', () => {
  let mockStorage: MockFileStorage
  let mediaService: MediaService
  
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage = new MockFileStorage()
    mediaService = new MediaService(mockStorage as any, 'test-project')
  })

  test('WORKING TEST: Should detect and clean contaminated image with clipStart', async () => {
    console.log('[TEST] 🧪 Testing basic contamination detection')
    
    // Set up contaminated data directly in the mock
    const contaminatedData = [
      {
        id: 'contaminated-image',
        type: 'image',
        pageId: 'page-1',
        fileName: 'image.jpg',
        metadata: {
          type: 'image',
          pageId: 'page-1',
          clipStart: 30, // This should trigger cleanup for image
          originalName: 'image.jpg',
          mimeType: 'image/jpeg'
        }
      },
      {
        id: 'clean-image',
        type: 'image', 
        pageId: 'page-1',
        fileName: 'clean.jpg',
        metadata: {
          type: 'image',
          pageId: 'page-1',
          originalName: 'clean.jpg',
          mimeType: 'image/jpeg'
        }
      },
      {
        id: 'legitimate-video',
        type: 'video',
        pageId: 'page-2',
        fileName: 'video.mp4',
        metadata: {
          type: 'video',
          pageId: 'page-2',
          isYouTube: true, // This should NOT be cleaned - legitimate YouTube video
          clipStart: 30,
          clipEnd: 60,
          youtubeUrl: 'https://youtube.com/watch?v=abc123'
        }
      }
    ]
    
    mockStorage.setMockData(contaminatedData)
    
    // Run cleanup
    const result = await mediaService.cleanContaminatedMedia()
    
    console.log('[TEST] 📊 Cleanup result:', result)
    
    // Should clean the contaminated image but not the clean image or legitimate video
    expect(result.cleaned).toContain('contaminated-image')
    expect(result.cleaned).not.toContain('clean-image')
    expect(result.cleaned).not.toContain('legitimate-video')
    expect(result.errors).toHaveLength(0)
  })

  test('EDGE CASES: Should handle all contamination patterns', async () => {
    console.log('[TEST] 🎯 Testing comprehensive contamination patterns')
    
    const complexContamination = [
      {
        id: 'snake-case-contamination',
        type: 'audio',
        pageId: 'page-1', 
        fileName: 'audio.mp3',
        metadata: {
          type: 'audio',
          pageId: 'page-1',
          // Snake case contamination
          clip_start: 45,
          clip_end: 90,
          youtube_url: 'https://youtube.com/watch?v=legacy',
          originalName: 'audio.mp3'
        }
      },
      {
        id: 'mixed-case-contamination',
        type: 'image',
        pageId: 'page-2',
        fileName: 'image.jpg',
        metadata: {
          type: 'image',
          pageId: 'page-2',
          // Mixed case contamination
          youTubeUrl: 'https://youtube.com/watch?v=mixed',
          embedURL: 'https://youtube.com/embed/mixed',
          CLIP_START: 30,
          originalName: 'image.jpg'
        }
      },
      {
        id: 'partial-contamination',
        type: 'image',
        pageId: 'page-3',
        fileName: 'partial.jpg', 
        metadata: {
          type: 'image',
          pageId: 'page-3',
          // Only one contamination field
          embedUrl: 'https://youtube.com/embed/partial',
          originalName: 'partial.jpg',
          customField: 'should remain'
        }
      }
    ]
    
    mockStorage.setMockData(complexContamination)
    
    const result = await mediaService.cleanContaminatedMedia()
    
    console.log('[TEST] 🎯 Complex cleanup result:', result)
    
    // All should be cleaned since they have contamination
    expect(result.cleaned).toHaveLength(3)
    expect(result.cleaned).toContain('snake-case-contamination')
    expect(result.cleaned).toContain('mixed-case-contamination')  
    expect(result.cleaned).toContain('partial-contamination')
    expect(result.errors).toHaveLength(0)
  })

  test('PERFORMANCE: Should handle large dataset efficiently', async () => {
    console.log('[TEST] ⚡ Testing performance with 50 contaminated items')
    
    // Generate 50 contaminated items with various patterns
    const largeDataset = Array.from({ length: 50 }, (_, index) => ({
      id: `item-${index}`,
      type: 'image',
      pageId: `page-${index % 5}`,
      fileName: `image-${index}.jpg`,
      metadata: {
        type: 'image',
        pageId: `page-${index % 5}`,
        // Rotate through different contamination patterns
        ...(index % 4 === 0 && { clipStart: 30 }),
        ...(index % 4 === 1 && { embedUrl: `https://youtube.com/embed/${index}` }),
        ...(index % 4 === 2 && { isYouTube: true }),
        ...(index % 4 === 3 && { youtubeUrl: `https://youtube.com/watch?v=${index}` }),
        originalName: `image-${index}.jpg`
      }
    }))
    
    mockStorage.setMockData(largeDataset)
    
    const startTime = performance.now()
    const result = await mediaService.cleanContaminatedMedia()
    const endTime = performance.now()
    
    const duration = endTime - startTime
    console.log('[TEST] ⚡ Performance metrics:')
    console.log('[TEST] ⚡ - Duration:', duration, 'ms')
    console.log('[TEST] ⚡ - Items cleaned:', result.cleaned.length)
    console.log('[TEST] ⚡ - Items per ms:', result.cleaned.length / duration)
    
    expect(result.cleaned).toHaveLength(50) // All should be cleaned
    expect(result.errors).toHaveLength(0)
    expect(duration).toBeLessThan(1000) // Should complete within 1 second
  })

  test('ERROR HANDLING: Should continue cleanup despite individual failures', async () => {
    console.log('[TEST] 🛡️ Testing error resilience')
    
    const mixedData = [
      {
        id: 'good-item',
        type: 'image',
        pageId: 'page-1',
        fileName: 'good.jpg',
        metadata: {
          type: 'image',
          pageId: 'page-1',
          clipStart: 30, // Should be cleaned
          originalName: 'good.jpg'
        }
      },
      {
        id: 'another-good-item',
        type: 'audio',
        pageId: 'page-1',
        fileName: 'good.mp3',
        metadata: {
          type: 'audio',
          pageId: 'page-1', 
          isYouTube: true, // Should be cleaned
          originalName: 'good.mp3'
        }
      }
    ]
    
    mockStorage.setMockData(mixedData)
    
    // Mock storage to fail on second item
    let callCount = 0
    const originalStoreMedia = mockStorage.storeMedia.bind(mockStorage)
    mockStorage.storeMedia = vi.fn().mockImplementation((id: string, blob: Blob, type: string, metadata: any) => {
      callCount++
      if (id === 'another-good-item') {
        throw new Error('Simulated storage failure')
      }
      return originalStoreMedia(id, blob, type, metadata)
    })
    
    const result = await mediaService.cleanContaminatedMedia()
    
    console.log('[TEST] 🛡️ Error handling result:', result)
    
    // Should clean the good item and report error for the failed one
    expect(result.cleaned).toContain('good-item')
    expect(result.cleaned).not.toContain('another-good-item')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('another-good-item')
  })
})