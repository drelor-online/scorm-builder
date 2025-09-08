import { describe, test, expect, vi, beforeEach } from 'vitest'
import { MediaService } from './MediaService'
import type { FileStorage } from './FileStorage'

/**
 * BEHAVIOR TEST: Aggressive Contamination Cleanup
 * 
 * This test reproduces scenarios where the current cleanup is insufficient
 * and verifies the enhanced aggressive cleanup handles edge cases properly.
 */

const mockFileStorage: FileStorage = {
  storeMedia: vi.fn(),
  getMedia: vi.fn(),
  deleteMedia: vi.fn(),
  listAllMedia: vi.fn(),
  clearAllMedia: vi.fn(),
  generateMediaUrl: vi.fn()
}

describe('MediaService - Aggressive Contamination Cleanup', () => {
  let mediaService: MediaService
  
  beforeEach(() => {
    vi.clearAllMocks()
    mediaService = new MediaService(mockFileStorage, 'test-project-123')
  })

  test('CURRENT LIMITATION: Should identify contaminated media with partial YouTube metadata', async () => {
    console.log('[TEST] 🔍 Testing current cleanup limitations with partial contamination')
    
    // Mock severely contaminated media - current cleanup might miss these edge cases
    const contaminatedMedia = [
      {
        id: 'image-1',
        type: 'image',
        pageId: 'page-1',
        fileName: 'image.jpg',
        metadata: {
          type: 'image',
          pageId: 'page-1',
          // Partial contamination - only some YouTube fields present
          clipStart: 30, // This alone should trigger cleanup
          originalName: 'image.jpg'
        }
      },
      {
        id: 'image-2', 
        type: 'image',
        pageId: 'page-1',
        fileName: 'image2.jpg',
        metadata: {
          type: 'image',
          pageId: 'page-1',
          // Different contamination pattern
          embedUrl: 'https://youtube.com/embed/abc123', // This alone should trigger cleanup
          mimeType: 'image/jpeg'
        }
      },
      {
        id: 'audio-3',
        type: 'audio', 
        pageId: 'page-2',
        fileName: 'audio.mp3',
        metadata: {
          type: 'audio',
          pageId: 'page-2',
          // Deep contamination - buried YouTube data
          isYouTube: true, // This should definitely trigger cleanup for audio
          source: 'local', // Mixed signals - confusing contamination
          duration: 120
        }
      },
      {
        id: 'video-4',
        type: 'video',
        pageId: 'page-3', 
        fileName: 'video.mp4',
        metadata: {
          type: 'video',
          pageId: 'page-3',
          // This should NOT be cleaned - legitimate YouTube video
          isYouTube: true,
          source: 'youtube',
          clipStart: 30,
          clipEnd: 60,
          youtubeUrl: 'https://youtube.com/watch?v=abc123'
        }
      }
    ]
    
    ;(mockFileStorage.listAllMedia as any).mockResolvedValue(contaminatedMedia)
    ;(mockFileStorage.storeMedia as any).mockResolvedValue(true)
    
    // Run current cleanup
    const result = await mediaService.cleanContaminatedMedia()
    
    console.log('[TEST] 📊 Cleanup results:', result)
    console.log('[TEST] 📊 Cleaned items:', result.cleaned)
    console.log('[TEST] 📊 Errors:', result.errors)
    
    // Current implementation should clean the first 3 items but not the video
    expect(result.cleaned).toHaveLength(3)
    expect(result.cleaned).toContain('image-1') // Has clipStart
    expect(result.cleaned).toContain('image-2') // Has embedUrl  
    expect(result.cleaned).toContain('audio-3') // Has isYouTube
    expect(result.cleaned).not.toContain('video-4') // Should remain - legitimate YouTube video
    expect(result.errors).toHaveLength(0)
  })

  test('EDGE CASE: Should handle deeply nested contamination patterns', async () => {
    console.log('[TEST] 🔍 Testing edge case: deeply nested contamination')
    
    // Complex contamination scenarios that might slip through
    const complexContamination = [
      {
        id: 'image-complex-1',
        type: 'image',
        pageId: 'page-1',
        fileName: 'complex.jpg',
        metadata: {
          type: 'image',
          pageId: 'page-1',
          // Snake case contamination (legacy data)
          clip_start: 45,
          clip_end: 90,
          youtube_url: 'https://youtube.com/watch?v=legacy123',
          originalName: 'complex.jpg'
        }
      },
      {
        id: 'audio-complex-2',
        type: 'audio',
        pageId: 'page-2',
        fileName: 'complex.mp3',
        metadata: {
          type: 'audio',
          pageId: 'page-2',
          // Mixed case and extra fields
          youTubeUrl: 'https://youtube.com/watch?v=mixed123', // camelCase variant
          CLIP_START: 30, // UPPERCASE contamination
          embedURL: 'https://youtube.com/embed/mixed123', // Different casing
          customField: 'should remain'
        }
      }
    ]
    
    ;(mockFileStorage.listAllMedia as any).mockResolvedValue(complexContamination)
    ;(mockFileStorage.storeMedia as any).mockResolvedValue(true)
    
    const result = await mediaService.cleanContaminatedMedia()
    
    console.log('[TEST] 🎯 EXPECTED: Current cleanup may miss some complex contamination patterns')
    console.log('[TEST] 🎯 ACTUAL: Cleaned', result.cleaned.length, 'items')
    
    // This test may FAIL initially - showing the need for more aggressive cleanup
    // After enhancement, it should pass
    expect(result.cleaned).toContain('image-complex-1')
    expect(result.cleaned).toContain('audio-complex-2')
  })

  test('AGGRESSIVE CLEANUP: Should detect and clean ALL YouTube-related contamination patterns', async () => {
    console.log('[TEST] 🚀 Testing aggressive cleanup for ALL contamination patterns')
    
    const allContaminationPatterns = [
      {
        id: 'test-1',
        type: 'image',
        pageId: 'page-1',
        fileName: 'test1.jpg',
        metadata: {
          type: 'image',
          // Every possible YouTube field that should be removed from non-video media
          source: 'youtube',
          youtubeUrl: 'https://youtube.com/watch?v=test1',
          embedUrl: 'https://youtube.com/embed/test1',
          clipStart: 30,
          clipEnd: 60,
          isYouTube: true,
          // Snake case variants
          clip_start: 30,
          clip_end: 60,
          youtube_url: 'https://youtube.com/watch?v=test1',
          embed_url: 'https://youtube.com/embed/test1',
          is_youtube: true,
          // Case variants
          youTubeUrl: 'https://youtube.com/watch?v=test1',
          embedURL: 'https://youtube.com/embed/test1',
          CLIP_START: 30,
          CLIP_END: 60,
          // Should keep these legitimate fields
          originalName: 'test1.jpg',
          mimeType: 'image/jpeg',
          uploadedAt: '2023-01-01T00:00:00Z'
        }
      }
    ]
    
    ;(mockFileStorage.listAllMedia as any).mockResolvedValue(allContaminationPatterns)
    
    // Mock storeMedia to capture what gets stored
    const storedData: any[] = []
    ;(mockFileStorage.storeMedia as any).mockImplementation((id: string, blob: Blob, type: string, metadata: any) => {
      storedData.push({ id, type, metadata })
      return Promise.resolve(true)
    })
    
    const result = await mediaService.cleanContaminatedMedia()
    
    expect(result.cleaned).toContain('test-1')
    expect(storedData).toHaveLength(1)
    
    const cleanedMetadata = storedData[0].metadata
    console.log('[TEST] 🧹 Cleaned metadata:', cleanedMetadata)
    
    // Verify ALL YouTube contamination is removed
    expect(cleanedMetadata.source).toBeUndefined()
    expect(cleanedMetadata.youtubeUrl).toBeUndefined()
    expect(cleanedMetadata.embedUrl).toBeUndefined()
    expect(cleanedMetadata.clipStart).toBeUndefined()
    expect(cleanedMetadata.clipEnd).toBeUndefined()
    expect(cleanedMetadata.isYouTube).toBeUndefined()
    
    // Snake case variants should also be removed
    expect(cleanedMetadata.clip_start).toBeUndefined()
    expect(cleanedMetadata.clip_end).toBeUndefined()
    expect(cleanedMetadata.youtube_url).toBeUndefined()
    expect(cleanedMetadata.embed_url).toBeUndefined()
    expect(cleanedMetadata.is_youtube).toBeUndefined()
    
    // Case variants should be removed
    expect(cleanedMetadata.youTubeUrl).toBeUndefined()
    expect(cleanedMetadata.embedURL).toBeUndefined()
    expect(cleanedMetadata.CLIP_START).toBeUndefined()
    expect(cleanedMetadata.CLIP_END).toBeUndefined()
    
    // Legitimate fields should remain
    expect(cleanedMetadata.originalName).toBe('test1.jpg')
    expect(cleanedMetadata.mimeType).toBe('image/jpeg')
    expect(cleanedMetadata.uploadedAt).toBe('2023-01-01T00:00:00Z')
  })

  test('PERFORMANCE: Should handle large numbers of contaminated items efficiently', async () => {
    console.log('[TEST] ⚡ Testing performance with large contamination dataset')
    
    // Generate 100 contaminated items
    const massContamination = Array.from({ length: 100 }, (_, index) => ({
      id: `contaminated-${index}`,
      type: 'image',
      pageId: `page-${index % 10}`,
      fileName: `image-${index}.jpg`,
      metadata: {
        type: 'image',
        pageId: `page-${index % 10}`,
        // Various contamination patterns
        ...(index % 3 === 0 && { clipStart: 30 }),
        ...(index % 3 === 1 && { embedUrl: `https://youtube.com/embed/${index}` }),
        ...(index % 3 === 2 && { isYouTube: true }),
        originalName: `image-${index}.jpg`
      }
    }))
    
    ;(mockFileStorage.listAllMedia as any).mockResolvedValue(massContamination)
    ;(mockFileStorage.storeMedia as any).mockResolvedValue(true)
    
    const startTime = performance.now()
    const result = await mediaService.cleanContaminatedMedia()
    const endTime = performance.now()
    
    const duration = endTime - startTime
    console.log('[TEST] ⚡ Cleanup duration:', duration, 'ms')
    console.log('[TEST] ⚡ Items per ms:', result.cleaned.length / duration)
    
    expect(result.cleaned).toHaveLength(100) // All should be cleaned
    expect(result.errors).toHaveLength(0)
    expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
  })

  test('ERROR HANDLING: Should gracefully handle cleanup failures and continue processing', async () => {
    console.log('[TEST] 🛡️ Testing error handling during aggressive cleanup')
    
    const mixedData = [
      {
        id: 'good-item-1',
        type: 'image',
        pageId: 'page-1',
        fileName: 'good1.jpg',
        metadata: {
          type: 'image',
          clipStart: 30, // Should be cleaned
          originalName: 'good1.jpg'
        }
      },
      {
        id: 'bad-item-2',
        type: 'image', 
        pageId: 'page-1',
        fileName: 'bad2.jpg',
        metadata: {
          type: 'image',
          embedUrl: 'https://youtube.com/embed/bad2', // Should trigger cleanup but fail
          originalName: 'bad2.jpg'
        }
      },
      {
        id: 'good-item-3',
        type: 'image',
        pageId: 'page-1', 
        fileName: 'good3.jpg',
        metadata: {
          type: 'image',
          isYouTube: true, // Should be cleaned
          originalName: 'good3.jpg'
        }
      }
    ]
    
    ;(mockFileStorage.listAllMedia as any).mockResolvedValue(mixedData)
    
    // Make the second item fail to store
    ;(mockFileStorage.storeMedia as any).mockImplementation((id: string) => {
      if (id === 'bad-item-2') {
        throw new Error('Storage failed for bad-item-2')
      }
      return Promise.resolve(true)
    })
    
    const result = await mediaService.cleanContaminatedMedia()
    
    // Should clean good items and report error for bad item
    expect(result.cleaned).toContain('good-item-1')
    expect(result.cleaned).toContain('good-item-3')
    expect(result.cleaned).not.toContain('bad-item-2')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('bad-item-2')
  })
})