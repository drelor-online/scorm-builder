/**
 * @file rustScormGenerator.prefetchCacheIntegration.behavior.test.ts
 *
 * TDD Behavior Test: Validates that prefetched media cache prevents backend calls during SCORM generation
 *
 * PURPOSE: This test reproduces the performance issue where despite prefetching media,
 * the SCORM generator still makes individual backend calls for each media item.
 *
 * EXPECTED BEHAVIOR:
 * 1. When media is prefetched into a cache before generation
 * 2. The generator should use the prefetched cache
 * 3. No additional backend calls should be made during generation
 *
 * CURRENT ISSUE:
 * - Prefetch creates filename→Blob map
 * - Generator needs mediaId→{Uint8Array,mimeType} map
 * - Cache shape mismatch causes cache misses and backend calls
 *
 * This test should FAIL initially, demonstrating the problem, then PASS after fixes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateRustSCORM } from './rustScormGenerator'
import type { EnhancedCourseContent } from '../types/scorm'

// Mock the MediaService to track calls
const mockGetMedia = vi.fn()
const mockCreateMediaService = vi.fn(() => ({
  getMedia: mockGetMedia,
}))

// Mock the MediaService module
vi.mock('./MediaService', () => ({
  createMediaService: mockCreateMediaService,
}))

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

describe('SCORM Generator Prefetch Cache Integration', () => {
  const mockProjectId = '1234567890123'

  // Sample course content with multiple media items
  const sampleCourseContent: EnhancedCourseContent = {
    metadata: {
      title: 'Test Course',
      duration: '60 minutes',
      courseSeed: 'test course',
    },
    welcome: {
      content: 'Welcome to the test course',
      audioId: 'audio-0',
    },
    objectives: {
      content: 'Course objectives',
      audioId: 'audio-1',
    },
    topics: [
      {
        title: 'Topic 1',
        content: 'Topic 1 content',
        audioId: 'audio-2',
        media: [
          { id: 'image-0', type: 'image', url: 'image-0' },
          { id: 'image-1', type: 'image', url: 'image-1' },
        ]
      },
      {
        title: 'Topic 2',
        content: 'Topic 2 content',
        audioId: 'audio-3',
        media: [
          { id: 'image-2', type: 'image', url: 'image-2' },
          { id: 'audio-4', type: 'audio', url: 'audio-4' },
        ]
      }
    ],
    knowledgeCheck: {
      questions: [
        {
          question: 'Test question',
          type: 'multiple-choice',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 0,
        }
      ]
    }
  }

  // Helper to create mock media data
  const createMockMediaData = (mediaId: string) => {
    const data = new Uint8Array([1, 2, 3, 4]) // Mock binary data
    const mimeType = mediaId.startsWith('audio-') ? 'audio/mpeg' : 'image/jpeg'
    return { data, mimeType }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Configure MediaService mock to return realistic data
    mockGetMedia.mockImplementation(async (mediaId: string) => {
      console.log(`[TEST] MediaService.getMedia called for: ${mediaId}`)
      return {
        data: new Uint8Array([1, 2, 3, 4]),
        metadata: {
          mimeType: mediaId.startsWith('audio-') ? 'audio/mpeg' : 'image/jpeg'
        }
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Performance Issue Reproduction', () => {
    it('should demonstrate the cache miss issue with filename-keyed prefetch map', async () => {
      // ARRANGE: Create a filename-keyed prefetch map (current implementation)
      const filenamePrefetchMap = new Map<string, Blob>()

      // Add media with filename keys (current format)
      filenamePrefetchMap.set('audio-0.mp3', new Blob([1, 2, 3, 4], { type: 'audio/mpeg' }))
      filenamePrefetchMap.set('audio-1.mp3', new Blob([1, 2, 3, 4], { type: 'audio/mpeg' }))
      filenamePrefetchMap.set('audio-2.mp3', new Blob([1, 2, 3, 4], { type: 'audio/mpeg' }))
      filenamePrefetchMap.set('audio-3.mp3', new Blob([1, 2, 3, 4], { type: 'audio/mpeg' }))
      filenamePrefetchMap.set('audio-4.mp3', new Blob([1, 2, 3, 4], { type: 'audio/mpeg' }))
      filenamePrefetchMap.set('image-0-image.jpg', new Blob([1, 2, 3, 4], { type: 'image/jpeg' }))
      filenamePrefetchMap.set('image-1-image.jpg', new Blob([1, 2, 3, 4], { type: 'image/jpeg' }))
      filenamePrefetchMap.set('image-2-image.jpg', new Blob([1, 2, 3, 4], { type: 'image/jpeg' }))

      console.log(`[TEST] Created prefetch map with ${filenamePrefetchMap.size} items`)

      // ACT: Generate SCORM with filename-keyed prefetch
      const mockOnProgress = vi.fn()

      try {
        await generateRustSCORM(
          sampleCourseContent,
          mockProjectId,
          mockOnProgress,
          filenamePrefetchMap // This should prevent backend calls but doesn't
        )
      } catch (error) {
        // Ignore generation errors, we're only testing cache behavior
        console.log('[TEST] Generation error (expected in test):', error)
      }

      // ASSERT: This should fail - backend calls are still made despite prefetch
      const mediaServiceCallCount = mockGetMedia.mock.calls.length
      console.log(`[TEST] MediaService.getMedia was called ${mediaServiceCallCount} times`)
      console.log('[TEST] MediaService calls:', mockGetMedia.mock.calls.map(call => call[0]))

      // This assertion should FAIL initially, demonstrating the problem
      expect(mediaServiceCallCount).toBe(0)  // We expect NO backend calls with prefetch
    }, 10000)
  })

  describe('Expected Behavior After Fix', () => {
    it('should use ID-keyed prefetch cache to prevent backend calls', async () => {
      // ARRANGE: Create an ID-keyed prefetch map (target implementation)
      const idPrefetchMap = new Map<string, { data: Uint8Array; mimeType: string }>()

      // Add media with ID keys (target format)
      idPrefetchMap.set('audio-0', createMockMediaData('audio-0'))
      idPrefetchMap.set('audio-1', createMockMediaData('audio-1'))
      idPrefetchMap.set('audio-2', createMockMediaData('audio-2'))
      idPrefetchMap.set('audio-3', createMockMediaData('audio-3'))
      idPrefetchMap.set('audio-4', createMockMediaData('audio-4'))
      idPrefetchMap.set('image-0', createMockMediaData('image-0'))
      idPrefetchMap.set('image-1', createMockMediaData('image-1'))
      idPrefetchMap.set('image-2', createMockMediaData('image-2'))

      console.log(`[TEST] Created ID-keyed prefetch map with ${idPrefetchMap.size} items`)

      // ACT: Generate SCORM with ID-keyed prefetch (after fix)
      const mockOnProgress = vi.fn()

      try {
        // Note: This will fail until we implement the fix to accept ID-keyed map
        await generateRustSCORM(
          sampleCourseContent,
          mockProjectId,
          mockOnProgress,
          idPrefetchMap as any // Type assertion needed until we update signature
        )
      } catch (error) {
        console.log('[TEST] Generation error (expected in test):', error)
      }

      // ASSERT: After fix, no backend calls should be made
      const mediaServiceCallCount = mockGetMedia.mock.calls.length
      console.log(`[TEST] MediaService.getMedia was called ${mediaServiceCallCount} times`)

      expect(mediaServiceCallCount).toBe(0)  // Perfect cache hit rate
    }, 10000)

    it('should use generation mode to batch any remaining requests', async () => {
      // ARRANGE: Create partial prefetch (some items missing)
      const partialPrefetchMap = new Map<string, { data: Uint8Array; mimeType: string }>()
      partialPrefetchMap.set('audio-0', createMockMediaData('audio-0'))
      partialPrefetchMap.set('audio-1', createMockMediaData('audio-1'))
      // Intentionally missing other media to test batching

      // ACT: Generate with partial prefetch
      const mockOnProgress = vi.fn()

      try {
        await generateRustSCORM(
          sampleCourseContent,
          mockProjectId,
          mockOnProgress,
          partialPrefetchMap as any
        )
      } catch (error) {
        console.log('[TEST] Generation error (expected in test):', error)
      }

      // ASSERT: Verify MediaService was created with generation mode
      expect(mockCreateMediaService).toHaveBeenCalledWith(
        mockProjectId,
        undefined,  // fileStorage
        true        // generationMode
      )

      // Any backend calls should be minimal and batched
      const mediaServiceCallCount = mockGetMedia.mock.calls.length
      console.log(`[TEST] MediaService.getMedia was called ${mediaServiceCallCount} times for missing items`)

      // Should be less than total media count due to partial prefetch
      expect(mediaServiceCallCount).toBeLessThan(8)  // Less than total media items
    }, 10000)
  })

  describe('Cache Monitoring', () => {
    it('should log cache hit/miss statistics', async () => {
      // ARRANGE: Spy on console.log to capture cache statistics
      const consoleSpy = vi.spyOn(console, 'log')

      const mockPrefetch = new Map<string, { data: Uint8Array; mimeType: string }>()
      mockPrefetch.set('audio-0', createMockMediaData('audio-0'))

      // ACT: Generate SCORM
      try {
        await generateRustSCORM(
          sampleCourseContent,
          mockProjectId,
          undefined,
          mockPrefetch as any
        )
      } catch (error) {
        // Ignore generation errors
      }

      // ASSERT: Look for cache monitoring logs
      const cacheHitLogs = consoleSpy.mock.calls.filter(call =>
        call.some(arg => typeof arg === 'string' && arg.includes('Cache HIT'))
      )

      const cacheMissLogs = consoleSpy.mock.calls.filter(call =>
        call.some(arg => typeof arg === 'string' && arg.includes('Cache MISS'))
      )

      console.log(`[TEST] Found ${cacheHitLogs.length} cache HIT logs`)
      console.log(`[TEST] Found ${cacheMissLogs.length} cache MISS logs`)

      // After fix, we should see cache hit logs
      expect(cacheHitLogs.length).toBeGreaterThan(0)

      consoleSpy.mockRestore()
    }, 10000)
  })
})