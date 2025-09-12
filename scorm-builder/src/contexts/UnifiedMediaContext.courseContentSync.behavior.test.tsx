/**
 * UnifiedMediaContext Course Content Sync Behavior Tests
 * 
 * Tests for the bug where UnifiedMediaContext.mediaCache is not populated
 * from course content when a project is loaded, causing getValidMediaForPage
 * to return empty arrays even when course content has media.
 * 
 * This is the root cause of why EnhancedClipTimingDisplay doesn't appear
 * after project reload - the mediaCache is empty.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'
import { UnifiedMediaProvider, useUnifiedMedia } from './UnifiedMediaContext'
import { PersistentStorageProvider } from './PersistentStorageContext'
import { NotificationProvider } from './NotificationContext'

// Mock the Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock dependencies
vi.mock('../services/MediaService', () => ({
  MediaService: class MockMediaService {
    getMediaList = vi.fn().mockResolvedValue([])
    getMedia = vi.fn().mockResolvedValue(null)
    storeMedia = vi.fn().mockResolvedValue('stored-id')
    deleteMedia = vi.fn().mockResolvedValue(true)
    clearAll = vi.fn().mockResolvedValue()
  }
}))

describe('UnifiedMediaContext Course Content Sync Bug', () => {
  let TestComponent: React.FC
  let hookResult: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Test component that uses the context
    TestComponent = () => {
      const context = useUnifiedMedia()
      
      // Expose context methods for testing
      React.useEffect(() => {
        hookResult = context
      }, [context])

      return <div>Test Component</div>
    }
  })

  function renderWithProviders(ui: React.ReactElement) {
    return render(
      <NotificationProvider>
        <PersistentStorageProvider>
          <UnifiedMediaProvider>
            {ui}
          </UnifiedMediaProvider>
        </PersistentStorageProvider>
      </NotificationProvider>
    )
  }

  test('FAILING TEST: mediaCache should be populated from course content', async () => {
    console.log('🧪 [TEST] Testing UnifiedMediaContext mediaCache population bug...')
    
    renderWithProviders(<TestComponent />)
    
    // Wait for context to initialize
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    console.log('🔍 [TEST] Context initialized, checking initial state...')
    
    // Initially, mediaCache should be empty
    expect(hookResult).toBeDefined()
    const initialMedia = hookResult.getAllMedia()
    console.log('📊 [TEST] Initial media in cache:', initialMedia.length)
    expect(initialMedia).toHaveLength(0)

    // Simulate course content being loaded with media items
    // In the real app, this would happen when a project is opened
    const mockCourseContentMedia = [
      {
        id: 'image-0',
        type: 'image',
        title: 'Test Image',
        fileName: 'test.jpg'
      },
      {
        id: 'video-1', 
        type: 'video',
        title: 'YouTube Video with Clip Timing',
        isYouTube: true,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        clipStart: 30,
        clipEnd: 60
      }
    ]

    console.log('🔄 [TEST] Simulating course content load with media...')

    // 🔧 THE BUG: There's no mechanism to populate mediaCache from course content!
    // The context should have a method like `populateFromCourseContent(media[], pageId)`
    // but it doesn't exist. This is why getValidMediaForPage returns empty arrays.

    // Check if we can get media for a page (this will return empty because cache is not populated)
    const mediaForPage = await hookResult.getValidMediaForPage('learning-objectives')
    console.log('📊 [TEST] Media found for page after "loading" course content:', mediaForPage.length)
    
    // ❌ This will FAIL because mediaCache was never populated from course content
    expect(mediaForPage).toHaveLength(2) // Should have image-0 and video-1
    expect(mediaForPage.find(m => m.id === 'image-0')).toBeDefined()
    expect(mediaForPage.find(m => m.id === 'video-1')).toBeDefined()

    console.log('✅ [TEST] Media cache populated correctly from course content')
  })

  test('WORKING TEST: mediaCache gets populated when media is explicitly stored', async () => {
    console.log('🧪 [TEST] Testing explicit media storage...')
    
    renderWithProviders(<TestComponent />)
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    // This works because storeMedia explicitly adds to cache
    const mockBlob = new Blob(['test'], { type: 'image/jpeg' })
    
    await act(async () => {
      await hookResult.storeMedia('test-image', mockBlob, {
        type: 'image',
        title: 'Test Image',
        pageId: 'learning-objectives'
      })
    })

    // Now getValidMediaForPage should find the explicitly stored media
    const mediaForPage = await hookResult.getValidMediaForPage('learning-objectives')
    console.log('📊 [TEST] Media found after explicit storage:', mediaForPage.length)
    
    expect(mediaForPage).toHaveLength(1)
    expect(mediaForPage[0].id).toBe('test-image')

    console.log('✅ [TEST] Explicit media storage works correctly')
  })

  test('DIAGNOSTIC: Show the missing functionality needed', async () => {
    console.log('🧪 [TEST] Diagnostic - identifying missing functionality...')
    
    renderWithProviders(<TestComponent />)
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    console.log('🔍 [DIAGNOSTIC] Available context methods:')
    console.log('  - storeMedia:', typeof hookResult.storeMedia)
    console.log('  - getValidMediaForPage:', typeof hookResult.getValidMediaForPage)
    console.log('  - getAllMedia:', typeof hookResult.getAllMedia)
    
    // The MISSING method that would fix the bug:
    console.log('  - populateFromCourseContent:', typeof hookResult.populateFromCourseContent) // Should exist but doesn't
    
    console.log('📋 [DIAGNOSTIC] What we need to add:')
    console.log('  1. populateFromCourseContent(mediaItems[], pageId) method')
    console.log('  2. Call this method when project loads with course content')
    console.log('  3. Convert course content media to MediaItem format')
    console.log('  4. Update mediaCache with the loaded items')

    // This test always passes - it's just for diagnostic purposes
    expect(true).toBe(true)
  })
})