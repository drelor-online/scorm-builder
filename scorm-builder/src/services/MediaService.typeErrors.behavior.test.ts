/**
 * TDD Test: MediaService TypeScript Error Fixes
 *
 * Tests to reproduce and validate fixes for TypeScript compilation errors
 * in MediaService related to error handling and type safety.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaService } from './MediaService'
import { MockFileStorage } from './MockFileStorage'

describe('MediaService TypeScript Error Fixes', () => {
  let mediaService: MediaService
  let mockFileStorage: MockFileStorage

  beforeEach(() => {
    // Clear any existing singleton instances
    MediaService.clearInstance('test-project')

    mockFileStorage = new MockFileStorage()
    ;(mockFileStorage as any).getAllProjectMedia = vi.fn().mockResolvedValue([])
    ;(mockFileStorage as any).getMedia = vi.fn().mockResolvedValue(null)
    mediaService = MediaService.getInstance({ projectId: 'test-project', fileStorage: mockFileStorage as any })
  })

  it('should handle various error types in error recovery without TypeScript errors', async () => {
    // Arrange - Mock media that will trigger error handling
    const mockMediaData = [
      {
        id: 'error-media',
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: 'error-image.png'
        }
      }
    ]

    ;(mockFileStorage as any).getAllProjectMedia = vi.fn().mockResolvedValue(mockMediaData)

    // Mock getMedia to throw various error types
    let errorTypeIndex = 0
    const errorTypes = [
      new Error('Standard Error object'),
      'String error message',
      { message: 'Object with message property' },
      null,
      undefined,
      42,
      { nested: { error: 'Complex object' } }
    ]

    ;(mockFileStorage as any).getMedia = vi.fn().mockImplementation(() => {
      const error = errorTypes[errorTypeIndex++ % errorTypes.length]
      return Promise.reject(error)
    })

    // Act - Load media and trigger errors
    await mediaService.loadMediaFromDisk()

    // Try to get media multiple times to trigger different error types
    for (let i = 0; i < errorTypes.length; i++) {
      await mediaService.getMedia('error-media')
    }

    // Assert - Should have tracked failed media without TypeScript errors
    const failedMedia = mediaService.getFailedMedia()
    expect(failedMedia.length).toBeGreaterThan(0)

    // All failed media should have string error messages
    failedMedia.forEach(failed => {
      expect(typeof failed.error).toBe('string')
      expect(failed.error.length).toBeGreaterThan(0)
    })
  })

  it('should handle malformed metadata with non-string properties', async () => {
    // Arrange - Mock media with problematic metadata
    const mockMediaData = [
      {
        id: 'malformed-1',
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: { nested: 'object instead of string' }, // Object instead of string
          size: 'not-a-number' // String instead of number
        }
      },
      {
        id: 'malformed-2',
        metadata: {
          page_id: ['array', 'instead', 'of', 'string'], // Array instead of string
          type: 'image',
          original_name: null, // Null instead of string
          mime_type: 42 // Number instead of string
        }
      },
      {
        id: 'missing-properties',
        metadata: {
          // Missing most properties
          type: 'image'
        }
      }
    ]

    ;(mockFileStorage as any).getAllProjectMedia = vi.fn().mockResolvedValue(mockMediaData)

    // Act - Load media and validate
    await mediaService.loadMediaFromDisk()
    const validationResults = await mediaService.validateAllMedia()

    // Assert - Should handle malformed data gracefully
    const totalResults = validationResults.valid.length +
                        validationResults.warnings.length +
                        validationResults.risky.length
    expect(totalResults).toBe(3) // All media should be processed

    // All originalName fields should be strings
    const allResults = validationResults.valid.concat(validationResults.warnings, validationResults.risky)
    allResults.forEach(result => {
      expect(typeof result.originalName).toBe('string')
    })
  })

  it('should handle fileName vs metadata.original_name type inconsistencies', async () => {
    // Arrange - Media with different type combinations
    const mockMediaData = [
      {
        id: 'string-filename',
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: 'valid-string.png'
        }
      },
      {
        id: 'object-filename',
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: { toString: () => 'object-with-toString.png' }
        }
      }
    ]

    // Mock MediaItem with different fileName types
    ;(mockFileStorage as any).getAllProjectMedia = vi.fn().mockResolvedValue(mockMediaData)

    // Act
    await mediaService.loadMediaFromDisk()
    const allMedia = await mediaService.listAllMedia()

    // Manually trigger validation to test type handling
    const validationResults = await mediaService.validateAllMedia()

    // Assert - Should handle all cases without compilation errors
    expect(allMedia.length).toBe(2)
    expect(validationResults.valid.length + validationResults.warnings.length + validationResults.risky.length).toBe(2)

    // All results should have string originalName
    const allResults = validationResults.valid.concat(validationResults.warnings, validationResults.risky)
    allResults.forEach(result => {
      expect(typeof result.originalName).toBe('string')
      expect(result.originalName.length).toBeGreaterThan(0)
    })
  })

  it('should handle empty or undefined metadata properties in validation', async () => {
    // Arrange - Media with various empty/undefined properties
    const mockMediaData = [
      {
        id: 'empty-name',
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: '' // Empty string
        }
      },
      {
        id: 'undefined-name',
        metadata: {
          page_id: 'topic-0',
          type: 'image'
          // original_name is undefined
        }
      }
    ]

    ;(mockFileStorage as any).getAllProjectMedia = vi.fn().mockResolvedValue(mockMediaData)

    // Act
    await mediaService.loadMediaFromDisk()
    const validationResults = await mediaService.validateAllMedia()

    // Assert - Should handle empty/undefined properties gracefully
    const allResults = validationResults.valid.concat(validationResults.warnings, validationResults.risky)
    expect(allResults.length).toBe(2)

    // All should have valid string originalName (fallback to 'unknown')
    allResults.forEach(result => {
      expect(typeof result.originalName).toBe('string')
      expect(result.originalName).toBeTruthy() // Should not be empty
    })
  })
})