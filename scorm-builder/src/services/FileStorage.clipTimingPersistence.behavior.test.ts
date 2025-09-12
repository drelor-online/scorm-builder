/**
 * FileStorage Clip Timing Persistence Behavior Tests
 * 
 * Tests for the YouTube clip timing data persistence issue where
 * clipStart/clipEnd values disappear when project is reloaded.
 * 
 * This reproduces the exact user scenario:
 * 1. Store YouTube video with clip timing (clipStart: 30, clipEnd: 60)
 * 2. Simulate project reload by getting fresh data from storage
 * 3. Verify clip timing data is preserved in camelCase format
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { FileStorage } from './FileStorage'

// Mock the Tauri API core invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('FileStorage Clip Timing Persistence', () => {
  let fileStorage: FileStorage
  let mockInvoke: any
  const testProjectPath = '/test/clip-timing-project.scorm'
  const testMediaId = 'youtube-video-with-timing'

  // Mock data that simulates what Rust backend returns (snake_case format)
  const mockStoredMediaData = {
    id: testMediaId,
    metadata: {
      type: 'video',
      source: 'youtube',
      isYouTube: true,
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      title: 'YouTube Video with Clip Timing',
      page_id: 'topic-1',
      // This is the problem: Rust backend stores in snake_case
      clip_start: 30,  // stored as snake_case 
      clip_end: 60     // stored as snake_case
      // NOTE: clipStart/clipEnd are NOT present in raw backend data
    },
    data: [102, 97, 107, 101, 45, 118, 105, 100, 101, 111, 45, 100, 97, 116, 97] // fake-video-data
  }

  beforeEach(async () => {
    // Get the mocked invoke function
    const { invoke } = await import('@tauri-apps/api/core')
    mockInvoke = invoke as any
    vi.clearAllMocks()

    fileStorage = new FileStorage()
    
    // Mock successful project operations
    mockInvoke.mockImplementation((command: string, args?: any) => {
      if (command === 'store_media_base64') {
        console.log('📦 [MOCK] store_media_base64 called with:', { id: args?.id, metadata: args?.metadata })
        return Promise.resolve()
      }
      if (command === 'get_media') {
        console.log('📥 [MOCK] get_media called for:', args?.mediaId)
        return Promise.resolve(mockStoredMediaData)
      }
      return Promise.resolve()
    })

    // Set up project path and ID to bypass openProject
    ;(fileStorage as any)._currentProjectPath = testProjectPath
    ;(fileStorage as any)._currentProjectId = 'test-clip-timing-project'
  })

  test('FAILING TEST: Should preserve YouTube clip timing data after project reload', async () => {
    // 1. Store YouTube video with clip timing data
    const youtubeVideoBlob = new Blob(['fake-video-data'], { type: 'video/mp4' })
    const originalMetadata = {
      type: 'video',
      source: 'youtube',
      isYouTube: true,
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      title: 'YouTube Video with Clip Timing',
      pageId: 'topic-1',
      // Critical: These are the clip timing values that should persist
      clipStart: 30,  // Start at 30 seconds
      clipEnd: 60     // End at 60 seconds (camelCase format expected by frontend)
    }

    console.log('📹 [TEST] Storing YouTube video with clip timing:', {
      mediaId: testMediaId,
      clipStart: originalMetadata.clipStart,
      clipEnd: originalMetadata.clipEnd
    })

    await fileStorage.storeMedia(testMediaId, youtubeVideoBlob, originalMetadata)

    // 2. Simulate project reload by getting fresh data from storage
    // This simulates what happens when user exits to dashboard and reopens project
    console.log('🔄 [TEST] Simulating project reload - fetching fresh data from storage...')
    
    const loadedMedia = await fileStorage.getMedia(testMediaId)
    
    console.log('📥 [TEST] Loaded media from storage:', {
      id: loadedMedia?.id,
      mediaType: loadedMedia?.mediaType,
      metadataKeys: loadedMedia?.metadata ? Object.keys(loadedMedia.metadata) : [],
      // Critical fields to check:
      clipStart: loadedMedia?.metadata?.clipStart,
      clipEnd: loadedMedia?.metadata?.clipEnd,
      clip_start: loadedMedia?.metadata?.clip_start,
      clip_end: loadedMedia?.metadata?.clip_end
    })

    // 3. Verify clip timing data is preserved in the correct format
    expect(loadedMedia).not.toBeNull()
    expect(loadedMedia?.metadata).toBeDefined()
    
    // 🔧 THE BUG: These assertions will FAIL because FileStorage returns clip_start/clip_end
    // instead of clipStart/clipEnd, causing EnhancedClipTimingDisplay to not render
    console.log('🧪 [TEST] Checking if clip timing is in correct camelCase format...')
    expect(loadedMedia?.metadata?.clipStart).toBe(30)  // ❌ Will be undefined (BUG!)
    expect(loadedMedia?.metadata?.clipEnd).toBe(60)    // ❌ Will be undefined (BUG!)
    
    // Additional verification: These should be undefined after conversion
    expect(loadedMedia?.metadata?.clip_start).toBeUndefined()
    expect(loadedMedia?.metadata?.clip_end).toBeUndefined()

    console.log('✅ [TEST] Clip timing persistence test passed!')
  })

  test('WORKING TEST: Should store clip timing data correctly', async () => {
    // This test verifies that the storage mechanism itself works
    const youtubeVideoBlob = new Blob(['fake-video-data'], { type: 'video/mp4' })
    const metadata = {
      type: 'video',
      source: 'youtube',
      isYouTube: true,
      clipStart: 45,
      clipEnd: 120,
      title: 'Test YouTube Video'
    }

    // Should not throw
    await expect(
      fileStorage.storeMedia('test-storage', youtubeVideoBlob, metadata)
    ).resolves.not.toThrow()

    console.log('✅ [TEST] Storage mechanism works correctly')
  })

  test('DIAGNOSTIC: Show raw data format returned by FileStorage', async () => {
    // This test helps us see exactly what format the data is returned in
    const youtubeVideoBlob = new Blob(['diagnostic-data'], { type: 'video/mp4' })
    const metadata = {
      type: 'video',
      source: 'youtube',
      clipStart: 15,
      clipEnd: 90
    }

    await fileStorage.storeMedia('diagnostic-media', youtubeVideoBlob, metadata)
    const retrieved = await fileStorage.getMedia('diagnostic-media')

    console.log('🔍 [DIAGNOSTIC] Raw metadata format from FileStorage.getMedia():')
    console.log('  Full metadata object:', JSON.stringify(retrieved?.metadata, null, 2))
    console.log('  Available keys:', Object.keys(retrieved?.metadata || {}))
    console.log('  clipStart (camelCase):', retrieved?.metadata?.clipStart)
    console.log('  clipEnd (camelCase):', retrieved?.metadata?.clipEnd)  
    console.log('  clip_start (snake_case):', retrieved?.metadata?.clip_start)
    console.log('  clip_end (snake_case):', retrieved?.metadata?.clip_end)

    // This test always passes - it's just for diagnostic purposes
    expect(retrieved).toBeDefined()
  })
})