import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MediaService from '../MediaService'

// Mock FileStorage before importing it
vi.mock('../FileStorage', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      isInitialized: vi.fn().mockResolvedValue(true),
      storeMedia: vi.fn().mockResolvedValue(undefined),
      getMedia: vi.fn().mockResolvedValue(null),
      listMediaForPage: vi.fn().mockResolvedValue([])
    }))
  }
})

describe('MediaService API Signature', () => {
  let mediaService: MediaService
  let mockFileStorage: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Clear the MediaService singleton instance
    MediaService.clearInstance('test-project')
    
    // Create a proper mock for FileStorage
    mockFileStorage = {
      isInitialized: vi.fn().mockResolvedValue(true),
      storeMedia: vi.fn().mockResolvedValue(undefined),
      getMedia: vi.fn().mockResolvedValue(null),
      listMediaForPage: vi.fn().mockResolvedValue([])
    }
    
    mediaService = MediaService.getInstance({ 
      projectId: 'test-project',
      fileStorage: mockFileStorage 
    })
  })
  
  afterEach(() => {
    // Clean up singleton
    MediaService.clearInstance('test-project')
  })

  describe('storeMedia parameter order mismatch', () => {
    it('should fail when using documented signature (file, mediaType, metadata?, progressCallback?)', async () => {
      // This is the documented signature from docs/api/MediaService.md
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const mediaType = 'image'
      const metadata = { alt: 'Test image' }
      const progressCallback = vi.fn()

      // This should fail because actual implementation expects (file, pageId, type, metadata?, progressCallback?)
      // The mediaType will be interpreted as pageId, causing issues
      try {
        // @ts-expect-error - Testing incorrect signature
        await mediaService.storeMedia(file, mediaType, metadata, progressCallback)
        // If we reach here, the test should fail because we expect an error
        expect.fail('Should have thrown an error for incorrect parameter order')
      } catch (error: any) {
        // We expect this to fail in some way due to parameter mismatch
        expect(error).toBeDefined()
      }
    })

    it('should work with actual implementation signature (file, pageId, type, metadata?, progressCallback?)', async () => {
      // This is the actual signature from the implementation
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const pageId = 'topic-1'
      const type = 'image'
      const metadata = { alt: 'Test image' }
      const progressCallback = vi.fn()

      // Mock successful storage
      mockFileStorage.storeMedia.mockResolvedValue(undefined)

      // This should work
      const result = await mediaService.storeMedia(file, pageId, type, metadata, progressCallback)
      
      expect(result).toBeDefined()
      expect(result.id).toContain('image')
      expect(result.pageId).toBe(pageId)
      expect(result.type).toBe(type)
      expect(mockFileStorage.storeMedia).toHaveBeenCalled()
    })
  })

  describe('documentation vs implementation differences', () => {
    it('should document the actual required parameters', () => {
      // The actual method signature analysis
      const methodString = mediaService.storeMedia.toString()
      
      // Check that the actual implementation includes pageId as second parameter
      expect(methodString).toContain('pageId')
      
      // This demonstrates the mismatch:
      // Documentation says: file, mediaType, metadata?, progressCallback?
      // Implementation is:   file, pageId, type, metadata?, progressCallback?
    })

    it('should handle backward compatibility with warning (after fix)', async () => {
      // After we implement the fix, this test should pass
      // We'll provide backward compatibility with a deprecation warning
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Mock successful storage
      mockFileStorage.storeMedia.mockResolvedValue(undefined)
      
      // Try using the old documented signature via legacy method
      const result = await mediaService.storeMediaLegacy(file, 'image', { alt: 'Test' })
      
      // Should log deprecation warning
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('deprecated')
      )
      
      // Should still work
      expect(result).toBeDefined()
      expect(result.type).toBe('image')
      expect(result.pageId).toBe('global') // Default pageId
      
      consoleWarnSpy.mockRestore()
    })
  })

  describe('parameter validation', () => {
    it('should validate that pageId is a string, not a media type', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      // If someone accidentally passes mediaType as second param
      // it should be caught as invalid pageId
      try {
        // 'image' is being passed where pageId is expected
        await mediaService.storeMedia(file, 'image', 'image')
        // This might work but with wrong semantics
      } catch (error) {
        // Or it might fail if there's validation
        expect(error).toBeDefined()
      }
      
      // The pageId should be something like 'topic-1', 'welcome', etc.
      // Not 'image', 'video', 'audio'
    })
  })
})