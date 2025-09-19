/**
 * TDD Test: Media Validation Before Loading
 *
 * Tests media validation functionality to prevent problematic media
 * from causing loading hangs or errors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaService } from './MediaService'
import { MockFileStorage } from './MockFileStorage'

describe('MediaService Media Validation', () => {
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

  it('should validate media metadata before loading binary data', async () => {
    // Arrange - Create media with various validity states
    const mockMediaData = [
      {
        id: 'valid-media',
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: 'valid-image.png',
          size: 1024
        }
      },
      {
        id: 'external-media', // External files are risky
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: 'C:\\Users\\sierr\\Desktop\\image-2.png', // External path
          size: 2048
        }
      },
      {
        id: 'missing-size',
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: 'no-size.png'
          // Missing size property
        }
      }
    ]

    ;(mockFileStorage as any).getAllProjectMedia = vi.fn().mockResolvedValue(mockMediaData)

    // Act - Load media and validate
    await mediaService.loadMediaFromDisk()

    const validationResults = await mediaService.validateAllMedia()

    // Assert - Should identify validation issues
    expect(validationResults.valid).toHaveLength(1)
    expect(validationResults.warnings).toHaveLength(1) // missing size
    expect(validationResults.risky).toHaveLength(1) // external file

    expect(validationResults.risky[0].id).toBe('external-media')
    expect(validationResults.risky[0].reason).toContain('External file path')

    expect(validationResults.warnings[0].id).toBe('missing-size')
    expect(validationResults.warnings[0].reason).toContain('Missing size')
  })

  it('should detect problematic file extensions', async () => {
    const mockMediaData = [
      {
        id: 'json-metadata',
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: 'image-2.json' // JSON files are metadata, not images
        }
      },
      {
        id: 'bin-file',
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: 'image-2.bin' // BIN files are unusual for images
        }
      }
    ]

    ;(mockFileStorage as any).getAllProjectMedia = vi.fn().mockResolvedValue(mockMediaData)

    await mediaService.loadMediaFromDisk()
    const validationResults = await mediaService.validateAllMedia()

    expect(validationResults.risky).toHaveLength(2)
    expect(validationResults.risky.find(r => r.id === 'json-metadata')?.reason).toContain('JSON file')
    expect(validationResults.risky.find(r => r.id === 'bin-file')?.reason).toContain('BIN file')
  })

  it('should validate media type consistency', async () => {
    const mockMediaData = [
      {
        id: 'type-mismatch',
        metadata: {
          page_id: 'topic-0',
          type: 'video', // Says video
          original_name: 'file.png', // But PNG extension
          mime_type: 'image/png', // And image MIME type
          size: 1024 // Include size to avoid size warning
        }
      }
    ]

    ;(mockFileStorage as any).getAllProjectMedia = vi.fn().mockResolvedValue(mockMediaData)

    await mediaService.loadMediaFromDisk()
    const validationResults = await mediaService.validateAllMedia()

    expect(validationResults.warnings).toHaveLength(1)
    expect(validationResults.warnings[0].reason).toContain('type inconsistency')
  })

  it('should detect external file paths as risky', async () => {
    const mockMediaData = [
      {
        id: 'external-accessible',
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: 'C:\\Users\\sierr\\Desktop\\good-image.png'
        }
      },
      {
        id: 'external-inaccessible',
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: 'C:\\NonExistent\\bad-image.png'
        }
      }
    ]

    ;(mockFileStorage as any).getAllProjectMedia = vi.fn().mockResolvedValue(mockMediaData)

    await mediaService.loadMediaFromDisk()
    const validationResults = await mediaService.validateAllMedia()

    // Both external files should be marked as risky
    expect(validationResults.risky).toHaveLength(2)
    expect(validationResults.risky.find(r => r.id === 'external-accessible')).toBeDefined()
    expect(validationResults.risky.find(r => r.id === 'external-inaccessible')).toBeDefined()

    // All should have the external file path detection reason
    validationResults.risky.forEach(risky => {
      expect(risky.reason).toContain('External file path detected')
    })
  })

  it('should provide recommendations for fixing validation issues', async () => {
    const mockMediaData = [
      {
        id: 'fixable-media',
        metadata: {
          page_id: 'topic-0',
          type: 'image',
          original_name: 'C:\\Users\\sierr\\Desktop\\image.png'
        }
      }
    ]

    ;(mockFileStorage as any).getAllProjectMedia = vi.fn().mockResolvedValue(mockMediaData)

    await mediaService.loadMediaFromDisk()
    const validationResults = await mediaService.validateAllMedia()

    expect(validationResults.risky[0]).toHaveProperty('recommendations')
    expect(validationResults.risky[0].recommendations).toContain('Copy file to project directory')
  })
})