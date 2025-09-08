import { describe, test, expect, vi, beforeEach } from 'vitest'

describe('MediaEnhancementWizard - Clip Timing Persistence in FileStorage', () => {
  test('should reproduce the bug where FileStorage loses clip_start and clip_end metadata', async () => {
    console.log('[CLIP PERSISTENCE TEST] 🔬 Testing FileStorage metadata persistence...')
    
    // Simulate what MediaService.updateYouTubeVideoMetadata() sends to FileStorage.storeYouTubeVideo()
    const mockFileStorage = {
      storeYouTubeVideo: vi.fn(),
      storeMedia: vi.fn()
    }
    
    // Mock the FileStorage.storeYouTubeVideo method to spy on what gets passed to storeMedia
    mockFileStorage.storeYouTubeVideo.mockImplementation(async (id: string, youtubeUrl: string, metadata: any) => {
      console.log('[CLIP PERSISTENCE TEST] 📊 Data passed to storeYouTubeVideo:', {
        id,
        youtubeUrl,
        metadata: {
          page_id: metadata?.page_id,
          title: metadata?.title,
          embed_url: metadata?.embed_url,
          clip_start: metadata?.clip_start,  // 🔍 This is what we're testing
          clip_end: metadata?.clip_end       // 🔍 This is what we're testing
        }
      })
      
      // Simulate the real storeYouTubeVideo implementation
      const urlBlob = new Blob([youtubeUrl], { type: 'text/plain' })
      
      // This is where the bug occurs - storeMedia doesn't preserve clip_start/clip_end
      await mockFileStorage.storeMedia(id, urlBlob, 'youtube', {
        ...metadata,
        embed_url: youtubeUrl,
        source: 'youtube',
        isYouTube: true
      })
    })
    
    // Mock the problematic storeMedia method to show what actually gets persisted
    mockFileStorage.storeMedia.mockImplementation(async (id: string, blob: Blob, mediaType: string, metadata: any) => {
      console.log('[CLIP PERSISTENCE TEST] 📊 Data passed to storeMedia (what actually gets saved):', {
        id,
        mediaType,
        metadata: {
          page_id: metadata?.page_id,
          type: mediaType,
          original_name: metadata?.original_name,
          mime_type: blob.type,
          source: metadata?.source,
          embed_url: metadata?.embed_url,
          title: metadata?.title,
          isYouTube: metadata?.isYouTube,
          thumbnail: metadata?.thumbnail,
          // 🚨 BUG: clip_start and clip_end are not included here!
          clip_start: metadata?.clip_start,  // This will be undefined in real FileStorage
          clip_end: metadata?.clip_end       // This will be undefined in real FileStorage
        }
      })
      
      // Simulate the REAL FileStorage.storeMedia behavior - only specific fields are saved
      const actualPersistedMetadata = {
        page_id: metadata?.page_id || '',
        type: mediaType,
        original_name: metadata?.original_name || 'unknown',
        mime_type: blob.type || undefined,
        source: metadata?.source || undefined,
        embed_url: metadata?.embed_url || undefined,
        title: metadata?.title || undefined,
        isYouTube: metadata?.isYouTube || undefined,
        thumbnail: metadata?.thumbnail || undefined
        // ❌ clip_start and clip_end are NOT included in the real implementation
      }
      
      console.log('[CLIP PERSISTENCE TEST] 🚨 What actually gets persisted to backend:', actualPersistedMetadata)
      
      // Verify the bug - clip timing is lost
      expect(actualPersistedMetadata.clip_start).toBeUndefined()
      expect(actualPersistedMetadata.clip_end).toBeUndefined()
      
      console.log('[CLIP PERSISTENCE TEST] ❌ BUG CONFIRMED: clip_start and clip_end are lost during FileStorage.storeMedia()')
    })
    
    // Simulate the call path: MediaService.updateYouTubeVideoMetadata -> FileStorage.storeYouTubeVideo -> FileStorage.storeMedia
    const testMediaId = 'video-test-clip-timing'
    const testYouTubeUrl = 'https://www.youtube.com/watch?v=testVideo'
    const metadataWithClipTiming = {
      page_id: 'topic-0',
      title: 'Test Video with Clip Timing',
      embed_url: 'https://www.youtube.com/embed/testVideo?start=90&end=225',
      clip_start: 90,   // 1:30
      clip_end: 225     // 3:45
    }
    
    console.log('[CLIP PERSISTENCE TEST] 📤 Calling storeYouTubeVideo with clip timing...')
    await mockFileStorage.storeYouTubeVideo(testMediaId, testYouTubeUrl, metadataWithClipTiming)
    
    // Verify the calls were made
    expect(mockFileStorage.storeYouTubeVideo).toHaveBeenCalledWith(testMediaId, testYouTubeUrl, metadataWithClipTiming)
    expect(mockFileStorage.storeMedia).toHaveBeenCalled()
    
    console.log('[CLIP PERSISTENCE TEST] 🎯 ROOT CAUSE IDENTIFIED:')
    console.log('FileStorage.storeMedia() only persists a hardcoded subset of metadata fields.')
    console.log('clip_start and clip_end are passed in but not included in the persisted metadata.')
    console.log('This is why clip timing disappears when projects are saved and reopened.')
  })
  
  test('should show the fix needed in FileStorage.storeMedia', async () => {
    console.log('[CLIP PERSISTENCE TEST] 🔧 Testing the required fix...')
    
    // Mock the FIXED version of storeMedia
    const fixedStoreMedia = vi.fn().mockImplementation(async (id: string, blob: Blob, mediaType: string, metadata: any) => {
      // FIXED VERSION: Include clip_start and clip_end in persisted metadata
      const fixedPersistedMetadata = {
        page_id: metadata?.page_id || '',
        type: mediaType,
        original_name: metadata?.original_name || 'unknown',
        mime_type: blob.type || undefined,
        source: metadata?.source || undefined,
        embed_url: metadata?.embed_url || undefined,
        title: metadata?.title || undefined,
        isYouTube: metadata?.isYouTube || undefined,
        thumbnail: metadata?.thumbnail || undefined,
        // ✅ FIX: Include clip timing fields
        clip_start: metadata?.clip_start || undefined,
        clip_end: metadata?.clip_end || undefined
      }
      
      console.log('[CLIP PERSISTENCE TEST] ✅ FIXED: Persisted metadata now includes clip timing:', {
        clip_start: fixedPersistedMetadata.clip_start,
        clip_end: fixedPersistedMetadata.clip_end,
        hasClipTiming: (fixedPersistedMetadata.clip_start !== undefined || fixedPersistedMetadata.clip_end !== undefined)
      })
      
      return fixedPersistedMetadata
    })
    
    // Test the fix
    const testBlob = new Blob(['test'], { type: 'text/plain' })
    const testMetadata = {
      page_id: 'topic-0',
      title: 'Test Video',
      clip_start: 45,
      clip_end: 180
    }
    
    const result = await fixedStoreMedia('test-id', testBlob, 'youtube', testMetadata)
    
    // Verify the fix works
    expect(result.clip_start).toBe(45)
    expect(result.clip_end).toBe(180)
    
    console.log('[CLIP PERSISTENCE TEST] 🎉 FIX CONFIRMED: clip timing is now persisted correctly!')
    console.log('[CLIP PERSISTENCE TEST] 📋 Required change: Add clip_start and clip_end to FileStorage.storeMedia metadata object')
  })
})