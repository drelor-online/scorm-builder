/**
 * BEHAVIOR TEST: MediaService PageId Derivation Fix
 *
 * This test verifies that the derivePageIdFromMediaId method correctly maps
 * media IDs back to their corresponding page IDs when loading from file system.
 *
 * ISSUE REPRODUCTION:
 * - Images 6-19 were not showing in PageThumbnailGrid
 * - Root cause: Media loaded from file system had no pageId in metadata
 * - MediaService now uses derivePageIdFromMediaId as fallback
 *
 * EXPECTED BEHAVIOR:
 * - image-0 → "welcome"
 * - image-1 → "objectives"
 * - image-2 → "topic-1"
 * - image-3 → "topic-2"
 * - ...
 * - image-19 → "topic-18"
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MediaService } from './MediaService'
import { MockFileStorage } from './MockFileStorage'

describe('MediaService - PageId Derivation Fix', () => {
  let mockStorage: MockFileStorage
  let mediaService: MediaService

  beforeEach(async () => {
    mockStorage = new MockFileStorage()
    await mockStorage.initialize()

    const project = await mockStorage.createProject('PageId Derivation Test')
    await mockStorage.openProject(project.id)

    mediaService = new MediaService(mockStorage)
  })

  it('should derive correct pageId from mediaId using reverse generation logic', async () => {
    console.log('🧪 TESTING: PageId derivation from mediaId...')

    // Access the private method via type assertion for testing
    const derivePageId = (mediaService as any).derivePageIdFromMediaId.bind(mediaService)

    // Test the mapping logic
    const testCases = [
      { mediaId: 'image-0', expectedPageId: 'welcome' },
      { mediaId: 'image-1', expectedPageId: 'objectives' },
      { mediaId: 'image-2', expectedPageId: 'topic-1' },
      { mediaId: 'image-3', expectedPageId: 'topic-2' },
      { mediaId: 'image-5', expectedPageId: 'topic-4' },
      { mediaId: 'image-19', expectedPageId: 'topic-18' },
      { mediaId: 'audio-0', expectedPageId: 'welcome' },
      { mediaId: 'video-10', expectedPageId: 'topic-9' },
      { mediaId: 'caption-15', expectedPageId: 'topic-14' }
    ]

    console.log('📊 Testing pageId derivation for all media types...')

    for (const { mediaId, expectedPageId } of testCases) {
      const result = derivePageId(mediaId)
      console.log(`  ${mediaId} → ${result} (expected: ${expectedPageId})`)
      expect(result).toBe(expectedPageId)
    }

    console.log('✅ All pageId derivations are correct!')
  })

  it('should handle invalid mediaId formats gracefully', async () => {
    console.log('🧪 TESTING: Invalid mediaId format handling...')

    const derivePageId = (mediaService as any).derivePageIdFromMediaId.bind(mediaService)

    const invalidCases = [
      'invalid-format',
      'image',
      'image-',
      'image-abc',
      'unknown-5',
      '',
      null,
      undefined
    ]

    for (const invalidId of invalidCases) {
      const result = derivePageId(invalidId)
      console.log(`  "${invalidId}" → ${result} (expected: null)`)
      expect(result).toBeNull()
    }

    console.log('✅ Invalid formats handled correctly!')
  })

  it('should integrate pageId derivation when loading media from file system', async () => {
    console.log('🧪 TESTING: Integration with loadMediaFromProject...')

    // Create media items without pageId in metadata (simulating file system load)
    const mediaRegistryData = {
      'image-0': {
        id: 'image-0',
        type: 'image',
        fileName: 'welcome.jpg'
        // No pageId in metadata - should be derived
      },
      'image-6': {
        id: 'image-6',
        type: 'image',
        fileName: 'topic5.jpg'
        // No pageId in metadata - should be derived
      },
      'image-19': {
        id: 'image-19',
        type: 'image',
        fileName: 'topic18.jpg'
        // No pageId in metadata - should be derived
      }
    }

    console.log('📊 Loading media without pageId metadata...')
    console.log('📊 Registry data being passed:', JSON.stringify(mediaRegistryData, null, 2))

    // Load media using the fixed loadMediaFromProject method
    await mediaService.loadMediaFromProject({}, {}, mediaRegistryData)

    // Get all media and verify pageId was derived
    const allMedia = await mediaService.getAllMedia()
    console.log(`📊 Loaded ${allMedia.length} media items with derived pageIds`)

    // Access the cache directly since getAllMedia() might filter items without blob URLs
    const cache = (mediaService as any).mediaCache
    console.log('📊 Cache size:', cache.size)

    // Check that pageIds were properly derived in the cache
    const image0 = cache.get('image-0')
    const image6 = cache.get('image-6')
    const image19 = cache.get('image-19')

    console.log('📊 Cache verification:')
    console.log(`  image-0 pageId: ${image0?.metadata?.pageId} (expected: welcome)`)
    console.log(`  image-6 pageId: ${image6?.metadata?.pageId} (expected: topic-5)`)
    console.log(`  image-19 pageId: ${image19?.metadata?.pageId} (expected: topic-18)`)

    expect(image0?.metadata?.pageId).toBe('welcome')
    expect(image6?.metadata?.pageId).toBe('topic-5')
    expect(image19?.metadata?.pageId).toBe('topic-18')

    console.log('✅ PageId derivation integration working correctly!')
    console.log('  image-0 pageId:', image0?.metadata?.pageId)
    console.log('  image-6 pageId:', image6?.metadata?.pageId)
    console.log('  image-19 pageId:', image19?.metadata?.pageId)
  })
})