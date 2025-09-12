/**
 * Test suite for MediaService batch optimization to fix the inefficiency 
 * identified in MediaEnhancementWizard where it was "loading all audio again"
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import { MediaService } from './MediaService'
import { invoke } from '@tauri-apps/api/core'
import type { MediaMetadata, MediaInfo } from '../types/media'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const mockInvoke = vi.mocked(invoke)

describe('MediaService Batch Optimization', () => {
  let mediaService: MediaService
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create MediaService instance with proper configuration
    const config = {
      projectId: 'test-project',
      debugEnabled: true,
    }
    mediaService = MediaService.getInstance(config)
    
    // Clear any existing state
    ;(mediaService as any).mediaCache.clear()
    ;(mediaService as any).mediaLoadingPromises.clear()
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should use batch operations to prevent duplicate media loading like in MediaEnhancementWizard', async () => {
    // SETUP: Simulate the scenario that causes "loading all audio again"
    const projectId = 'test-project'
    const mediaIds = [
      'audio-0', 'audio-1', 'audio-2', 'audio-3', 'audio-4',
      'image-0', 'image-1', 'video-0'
    ]
    
    // Mock successful batch existence check (all media exists)
    mockInvoke.mockImplementation((command: string, args: any) => {
      if (command === 'media_exists_batch') {
        console.log('[TEST] 🚀 BATCH EXISTS CHECK called for', args.mediaIds.length, 'items')
        return Promise.resolve(new Array(args.mediaIds.length).fill(true))
      }
      
      if (command === 'get_media_batch') {
        console.log('[TEST] 🚀 BATCH GET MEDIA called for', args.mediaIds.length, 'items')
        return Promise.resolve(args.mediaIds.map((id: string) => ({
          id,
          data: [1, 2, 3, 4], // Array instead of Uint8Array
          metadata: {
            page_id: 'test-page',
            type: id.startsWith('audio') ? 'audio' : id.startsWith('image') ? 'image' : 'video',
            original_name: `${id}.test`,
            mime_type: `${id.split('-')[0]}/test`,
            source: null,
            embed_url: null,
            title: null,
            clip_start: null,
            clip_end: null,
          } as MediaMetadata
        })))
      }
      
      // Individual fallback - return null to simulate "not found" in test environment
      if (command === 'get_media') {
        console.log('[TEST] ⚠️ INDIVIDUAL get_media called for', args.mediaId, '(fallback in test env)')
        // Return null to simulate media not found (this is what was happening)
        return Promise.resolve(null) 
      }
      
      return Promise.reject(new Error(`Unexpected command: ${command}`))
    })
    
    // Mock window.invoke to trigger Tauri batch processing
    Object.defineProperty(window, 'invoke', {
      value: mockInvoke,
      writable: true
    })
    
    // REPLICATE THE ISSUE: Multiple calls to getMedia like MediaEnhancementWizard does
    console.log('[TEST] Simulating MediaEnhancementWizard loading pattern...')
    
    // This simulates the inefficient pattern: loading all media one by one
    const startTime = Date.now()
    
    // ACT: Load multiple media items simultaneously (like MediaEnhancementWizard)
    const mediaPromises = mediaIds.map(id => mediaService.getMedia(id))
    const results = await Promise.all(mediaPromises)
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    // ASSERT: Verify all media was loaded successfully
    expect(results).toHaveLength(mediaIds.length)
    results.forEach((result, index) => {
      expect(result).toBeTruthy()
      expect(result?.metadata.type).toBeTruthy()
      expect(result?.data).toBeTruthy()
    })
    
    console.log(`[TEST] ✅ Loaded ${mediaIds.length} media items in ${duration}ms`)
    
    // CRITICAL: Verify that batch operations were used instead of individual calls
    const existsCheckCalls = mockInvoke.mock.calls.filter(([command]) => command === 'media_exists_batch')
    const batchGetCalls = mockInvoke.mock.calls.filter(([command]) => command === 'get_media_batch')
    const individualGetCalls = mockInvoke.mock.calls.filter(([command]) => command === 'get_media')
    
    console.log(`[TEST] Backend call analysis:`)
    console.log(`  - media_exists_batch calls: ${existsCheckCalls.length}`)
    console.log(`  - get_media_batch calls: ${batchGetCalls.length}`) 
    console.log(`  - get_media individual calls: ${individualGetCalls.length}`)
    
    // EXPECTATIONS FOR EFFICIENCY:
    // We should use batch operations, not individual calls
    expect(existsCheckCalls.length).toBeGreaterThan(0)
    expect(batchGetCalls.length).toBeGreaterThan(0)
    
    // Individual calls should be minimal or zero (only for fallbacks)
    expect(individualGetCalls.length).toBeLessThanOrEqual(mediaIds.length / 2) // Allow some individual calls for edge cases
    
    console.log('[TEST] ✅ Batch optimization working - reduced individual backend calls')
  })

  test('should handle mixed batch scenarios (some exist, some dont) like real MediaEnhancementWizard workflow', async () => {
    const mediaIds = ['audio-0', 'audio-1', 'missing-audio', 'image-0']
    
    mockInvoke.mockImplementation((command: string, args: any) => {
      if (command === 'media_exists_batch') {
        // Simulate: first 2 exist, third is missing, fourth exists
        return Promise.resolve([true, true, false, true])
      }
      
      if (command === 'get_media_batch') {
        // Only return existing items
        const existingIds = ['audio-0', 'audio-1', 'image-0']
        return Promise.resolve(existingIds.map(id => ({
          id,
          data: new Uint8Array([1, 2, 3]),
          metadata: {
            page_id: 'test-page',
            type: 'audio',
            original_name: `${id}.mp3`,
          }
        })))
      }
      
      if (command === 'get_media') {
        if (args.mediaId === 'missing-audio') {
          return Promise.resolve(null) // Return null instead of throwing
        }
        return Promise.resolve({
          id: args.mediaId,
          data: [1, 2, 3],
          metadata: { page_id: 'test-page', type: 'audio', original_name: `${args.mediaId}.mp3` }
        })
      }
      
      return Promise.reject(new Error(`Unexpected command: ${command}`))
    })
    
    // Mock window.invoke to trigger Tauri batch processing
    Object.defineProperty(window, 'invoke', {
      value: mockInvoke,
      writable: true
    })
    
    // Load all media (including missing one)
    const results = await Promise.allSettled(
      mediaIds.map(id => mediaService.getMedia(id))
    )
    
    // Verify results
    expect(results[0].status).toBe('fulfilled') // audio-0 exists
    expect(results[1].status).toBe('fulfilled') // audio-1 exists  
    expect(results[2].status).toBe('fulfilled') // missing-audio returns null (not rejected)
    if (results[2].status === 'fulfilled') {
      expect((results[2] as any).value).toBeNull() // Should be null for missing media
    }
    expect(results[3].status).toBe('fulfilled') // image-0 exists
    
    // Verify batch operations were used
    const existsCheckCalls = mockInvoke.mock.calls.filter(([command]) => command === 'media_exists_batch')
    expect(existsCheckCalls.length).toBeGreaterThan(0)
    
    console.log('[TEST] ✅ Mixed batch scenario handled correctly')
  })

  test('should cache batch results to prevent redundant operations', async () => {
    const mediaIds = ['audio-0', 'audio-1']
    
    mockInvoke.mockImplementation((command: string, args: any) => {
      if (command === 'media_exists_batch') {
        return Promise.resolve([true, true])
      }
      if (command === 'get_media_batch') {
        return Promise.resolve(args.mediaIds.map((id: string) => ({
          id,
          data: new Uint8Array([1, 2, 3]),
          metadata: { page_id: 'test-page', type: 'audio', original_name: `${id}.mp3` }
        })))
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`))
    })
    
    // Mock window.invoke to trigger Tauri batch processing
    Object.defineProperty(window, 'invoke', {
      value: mockInvoke,
      writable: true
    })
    
    // FIRST BATCH: Should hit backend
    await Promise.all(mediaIds.map(id => mediaService.getMedia(id)))
    const firstCallCount = mockInvoke.mock.calls.length
    
    // SECOND BATCH: Should use cache
    await Promise.all(mediaIds.map(id => mediaService.getMedia(id)))
    const secondCallCount = mockInvoke.mock.calls.length
    
    // Should not make additional backend calls due to caching
    expect(secondCallCount).toBe(firstCallCount)
    
    console.log('[TEST] ✅ Caching prevents redundant batch operations')
  })
})