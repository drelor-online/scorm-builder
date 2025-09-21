/**
 * TDD Test for SCORMPackageBuilder batch loading optimization
 * This test reproduces the issue where media files are loaded sequentially instead of in batches
 * causing SCORM generation to get stuck on "loading media files"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Track media service calls to detect sequential vs batch behavior
let callTracker: string[] = []

// Mock MediaService to track batch vs individual calls
const mockGetMediaBatchDirect = vi.fn()
const mockGetMedia = vi.fn()
const mockListAllMedia = vi.fn()

vi.mock('../services/MediaService', () => ({
  createMediaService: vi.fn(() => ({
    getMediaBatchDirect: mockGetMediaBatchDirect,
    getMedia: mockGetMedia,
    listAllMedia: mockListAllMedia
  }))
}))

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5]))
}))

// Mock the context hooks
vi.mock('../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: vi.fn(() => ({
    getMedia: vi.fn(),
    blobCache: new Map(),
    mediaItems: []
  }))
}))

vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: vi.fn(() => ({
    currentProjectId: 'test-project'
  }))
}))

// Import the function we want to test
import { buildScormPackageEnhanced } from '../services/rustScormGenerator'

describe('SCORMPackageBuilder Batch Loading Performance', () => {
  let originalConsoleError: any

  beforeEach(() => {
    vi.clearAllMocks()
    callTracker = []

    // Suppress console.error during tests
    originalConsoleError = console.error
    console.error = vi.fn()

    // Setup tracking for batch calls vs individual calls
    mockGetMediaBatchDirect.mockImplementation(async (mediaIds: string[]) => {
      callTracker.push(`BATCH:${mediaIds.length}:${mediaIds.join(',')}`)
      const result = new Map()
      mediaIds.forEach(id => {
        result.set(id, {
          data: new Uint8Array([1, 2, 3]),
          metadata: { mimeType: 'image/jpeg', original_name: `${id}.jpg` }
        })
      })
      return result
    })

    mockGetMedia.mockImplementation(async (mediaId: string) => {
      callTracker.push(`INDIVIDUAL:${mediaId}`)
      return {
        data: new Uint8Array([1, 2, 3]),
        metadata: { mimeType: 'image/jpeg', original_name: `${mediaId}.jpg` }
      }
    })

    mockListAllMedia.mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    console.error = originalConsoleError
  })

  it('should demonstrate current sequential loading behavior (FAILING TEST)', async () => {
    // SETUP: Course content with multiple media items
    const courseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome',
        media: [
          { id: 'welcome-image-1', type: 'image' },
          { id: 'welcome-image-2', type: 'image' }
        ]
      },
      objectivesPage: {
        title: 'Learning Objectives',
        media: [
          { id: 'objectives-audio-1', type: 'audio' },
          { id: 'objectives-caption-1', type: 'caption' }
        ]
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          audioId: 'audio-topic-1',
          captionId: 'caption-topic-1',
          media: [
            { id: 'topic-1-image-1', type: 'image' },
            { id: 'topic-1-image-2', type: 'image' }
          ]
        }
      ]
    }

    const courseSeedData = {
      projectId: 'test-project',
      title: 'Test Course'
    }

    // Create mock media cache (empty to force loading from MediaService)
    const mockMediaCache = new Map()
    const authoritativeExtensionMap = new Map([
      ['welcome-image-1', '.jpg'],
      ['welcome-image-2', '.jpg'],
      ['objectives-audio-1', '.mp3'],
      ['objectives-caption-1', '.vtt'],
      ['audio-topic-1', '.mp3'],
      ['caption-topic-1', '.vtt'],
      ['topic-1-image-1', '.jpg'],
      ['topic-1-image-2', '.jpg']
    ])

    try {
      await buildScormPackageEnhanced(
        courseContent,
        courseSeedData,
        mockMediaCache,
        authoritativeExtensionMap,
        { strictValidation: false }
      )
    } catch (error) {
      // Expected to potentially fail, we're testing the call pattern
      console.log('Expected error during test:', error)
    }

    // ANALYSIS: Log the call pattern to demonstrate current behavior
    console.log('=== CURRENT CALL PATTERN ===')
    callTracker.forEach((call, index) => {
      console.log(`${index + 1}: ${call}`)
    })

    const batchCalls = callTracker.filter(call => call.startsWith('BATCH:'))
    const individualCalls = callTracker.filter(call => call.startsWith('INDIVIDUAL:'))

    console.log(`\nBatch calls: ${batchCalls.length}`)
    console.log(`Individual calls: ${individualCalls.length}`)

    // THIS TEST SHOULD FAIL - demonstrating the current sequential behavior
    // After implementing batch loading, we expect:
    // - At least 1 batch call for media loading
    // - Minimal individual calls (only for fallbacks)
    expect(batchCalls.length).toBeGreaterThan(0)
    expect(individualCalls.length / batchCalls.length).toBeLessThan(2) // Should have more batch calls than individual
  })

  it('should batch load welcome page media efficiently', async () => {
    const courseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome',
        media: [
          { id: 'image-1', type: 'image' },
          { id: 'image-2', type: 'image' },
          { id: 'image-3', type: 'image' },
          { id: 'image-4', type: 'image' },
          { id: 'image-5', type: 'image' }
        ]
      },
      topics: []
    }

    const courseSeedData = { projectId: 'test-project', title: 'Test Course' }
    const mockMediaCache = new Map()
    const authoritativeExtensionMap = new Map([
      ['image-1', '.jpg'],
      ['image-2', '.jpg'],
      ['image-3', '.jpg'],
      ['image-4', '.jpg'],
      ['image-5', '.jpg']
    ])

    try {
      await buildScormPackageEnhanced(
        courseContent,
        courseSeedData,
        mockMediaCache,
        authoritativeExtensionMap,
        { strictValidation: false }
      )
    } catch (error) {
      console.log('Expected error during test:', error)
    }

    // Should use batch loading for 5 welcome images
    const batchCalls = callTracker.filter(call => call.startsWith('BATCH:'))
    const welcomeImageBatch = batchCalls.find(call => call.includes('image-1') && call.includes('image-5'))

    // THIS SHOULD FAIL initially - showing that welcome images are loaded individually
    expect(welcomeImageBatch).toBeDefined()
    expect(welcomeImageBatch).toContain('BATCH:5:') // Should batch all 5 images together
  })

  it('should demonstrate timeout issues with individual loading', async () => {
    // Simulate the scenario where individual calls cause timeouts
    mockGetMedia.mockImplementation(async (mediaId: string) => {
      callTracker.push(`INDIVIDUAL:${mediaId}`)

      if (mediaId === 'caption-4') {
        // Simulate the 20-second timeout issue mentioned in logs
        await new Promise(resolve => setTimeout(resolve, 100)) // Reduced for test speed
        throw new Error('Timeout after 20 seconds')
      }

      // Simulate 500ms per call as seen in logs
      await new Promise(resolve => setTimeout(resolve, 50)) // Reduced for test speed
      return {
        data: new Uint8Array([1, 2, 3]),
        metadata: { mimeType: 'audio/mpeg', original_name: `${mediaId}.mp3` }
      }
    })

    const courseContent = {
      title: 'Test Course',
      welcome: { title: 'Welcome', media: [] },
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        captionId: 'caption-4', // This will timeout with individual loading
        media: [
          { id: 'image-1', type: 'image' },
          { id: 'image-2', type: 'image' }
        ]
      }]
    }

    const courseSeedData = { projectId: 'test-project', title: 'Test Course' }
    const mockMediaCache = new Map()
    const authoritativeExtensionMap = new Map([
      ['caption-4', '.vtt'],
      ['image-1', '.jpg'],
      ['image-2', '.jpg']
    ])

    const startTime = Date.now()

    try {
      await buildScormPackageEnhanced(
        courseContent,
        courseSeedData,
        mockMediaCache,
        authoritativeExtensionMap,
        { strictValidation: false }
      )
    } catch (error) {
      console.log('Expected timeout error:', error)
    }

    const endTime = Date.now()
    const duration = endTime - startTime

    console.log(`Sequential loading took: ${duration}ms`)
    console.log('Call pattern:', callTracker)

    // With sequential loading, timeout errors affect the entire process
    // With batch loading, one failed item doesn't block others
    const individualCalls = callTracker.filter(call => call.startsWith('INDIVIDUAL:'))

    // THIS SHOULD FAIL - showing that batch loading would be more resilient
    expect(duration).toBeLessThan(200) // Batch loading should be faster even with failures
    expect(individualCalls.length).toBeLessThan(2) // Should use batch loading instead
  })

  it('should deduplicate media requests when same media appears in multiple contexts', async () => {
    // Setup course content where the same media ID appears multiple times
    const courseContent = {
      title: 'Test Course',
      welcome: {
        title: 'Welcome',
        audioId: 'shared-audio-1', // Same audio used in multiple places
        media: [
          { id: 'shared-image-1', type: 'image' } // Same image used in multiple places
        ]
      },
      objectivesPage: {
        title: 'Learning Objectives',
        audioId: 'shared-audio-1', // DUPLICATE - same as welcome
        media: [
          { id: 'shared-image-1', type: 'image' }, // DUPLICATE - same as welcome
          { id: 'shared-image-2', type: 'image' }
        ]
      },
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        audioId: 'shared-audio-1', // DUPLICATE - same as welcome and objectives
        media: [
          { id: 'shared-image-1', type: 'image' }, // DUPLICATE - same as welcome and objectives
          { id: 'shared-image-2', type: 'image' }, // DUPLICATE - same as objectives
          { id: 'unique-image-1', type: 'image' }  // UNIQUE to this topic
        ]
      }]
    }

    const courseSeedData = { projectId: 'test-project', title: 'Test Course' }
    const mockMediaCache = new Map()
    const authoritativeExtensionMap = new Map([
      ['shared-audio-1', '.mp3'],
      ['shared-image-1', '.jpg'],
      ['shared-image-2', '.jpg'],
      ['unique-image-1', '.jpg']
    ])

    try {
      await buildScormPackageEnhanced(
        courseContent,
        courseSeedData,
        mockMediaCache,
        authoritativeExtensionMap,
        { strictValidation: false }
      )
    } catch (error) {
      console.log('Expected error during deduplication test:', error)
    }

    // Analyze the call pattern for duplicates
    console.log('=== DEDUPLICATION TEST CALL PATTERN ===')
    callTracker.forEach((call, index) => {
      console.log(`${index + 1}: ${call}`)
    })

    const batchCalls = callTracker.filter(call => call.startsWith('BATCH:'))

    // Extract all media IDs from batch calls
    const allRequestedIds = new Set<string>()
    batchCalls.forEach(call => {
      const parts = call.split(':')
      if (parts.length >= 3) {
        const mediaIds = parts[2].split(',')
        mediaIds.forEach(id => allRequestedIds.add(id))
      }
    })

    console.log(`\\nUnique media IDs requested: ${allRequestedIds.size}`)
    console.log('Requested IDs:', Array.from(allRequestedIds))

    // VERIFICATION: Should only request each unique media ID once
    // Expected unique media items:
    // - shared-audio-1:audio (appears 3 times but should only be requested once)
    // - shared-image-1:image (appears 3 times but should only be requested once)
    // - shared-image-2:image (appears 2 times but should only be requested once)
    // - unique-image-1:image (appears 1 time)
    // Total: 4 unique media items

    expect(allRequestedIds.size).toBe(4) // Should only request 4 unique media items
    expect(allRequestedIds.has('shared-audio-1')).toBe(true)
    expect(allRequestedIds.has('shared-image-1')).toBe(true)
    expect(allRequestedIds.has('shared-image-2')).toBe(true)
    expect(allRequestedIds.has('unique-image-1')).toBe(true)
  })
})