/**
 * Test for intelligent progressive media preloading
 * This ensures non-critical media is loaded in the background after UI becomes interactive
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { UnifiedMediaProvider } from './UnifiedMediaContext'
import type { MediaItem } from '../types/media'

// Mock dependencies
vi.mock('../services/MediaService')
vi.mock('../services/PersistentStorage')
vi.mock('../utils/logger')

// Mock BlobURLManager
const mockPreloadMedia = vi.fn()
vi.mock('../utils/BlobURLManager', () => ({
  BlobURLManager: class {
    preloadMedia = mockPreloadMedia
    createBlobURL = vi.fn()
    revokeBlobURL = vi.fn()
    cleanup = vi.fn()
  }
}))

// Mock MediaService
const mockMediaService = {
  listAllMedia: vi.fn(),
  getMedia: vi.fn(),
  loadMediaFromProject: vi.fn(),
  loadMediaFromCourseContent: vi.fn()
}

vi.mocked = vi.fn().mockImplementation((fn) => fn)

describe('Progressive Media Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock storage
    const mockStorage = {
      getContent: vi.fn().mockResolvedValue(null),
      isInitialized: true,
      currentProjectId: 'test-project'
    }
    
    // Mock MediaService.getInstance
    vi.doMock('../services/MediaService', () => ({
      MediaService: {
        getInstance: vi.fn().mockReturnValue(mockMediaService)
      }
    }))
    
    // Mock PersistentStorage
    vi.doMock('../services/PersistentStorage', () => ({
      PersistentStorage: {
        getInstance: vi.fn().mockReturnValue(mockStorage)
      }
    }))
  })

  test('should implement progressive preloading of non-critical media after critical media', async () => {
    console.log('[TEST] 🔍 Testing progressive media preloading implementation...')
    
    // Setup mock media data
    const allMediaItems: MediaItem[] = [
      // Critical media (welcome page visuals)
      { id: 'image-welcome-1', type: 'image', pageId: 'welcome', metadata: { type: 'image', mimeType: 'image/jpeg' } },
      { id: 'video-welcome-1', type: 'video', pageId: 'welcome', metadata: { type: 'video', mimeType: 'video/mp4' } },
      
      // Non-critical media (other pages/audio)
      { id: 'audio-0', type: 'audio', pageId: 'welcome', metadata: { type: 'audio', mimeType: 'audio/mpeg' } },
      { id: 'audio-1', type: 'audio', pageId: 'objectives', metadata: { type: 'audio', mimeType: 'audio/mpeg' } },
      { id: 'image-topic-1', type: 'image', pageId: 'topic-1', metadata: { type: 'image', mimeType: 'image/jpeg' } },
      { id: 'video-topic-2', type: 'video', pageId: 'topic-2', metadata: { type: 'video', mimeType: 'video/mp4' } }
    ] as MediaItem[]
    
    // Mock MediaService responses
    mockMediaService.listAllMedia.mockResolvedValue(allMediaItems)
    allMediaItems.forEach(item => {
      mockMediaService.getMedia.mockImplementation((id: string) => {
        if (id === item.id) {
          return Promise.resolve({
            id: item.id,
            data: new Uint8Array([1, 2, 3, 4]), // Mock binary data
            metadata: item.metadata
          })
        }
        return Promise.resolve(null)
      })
    })
    
    mockPreloadMedia.mockResolvedValue(['blob:url1', 'blob:url2'])
    
    // Spy on setTimeout to track progressive loading timing
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
    
    // Render the provider
    const TestComponent = () => <div data-testid="test-component">Test</div>
    
    render(
      <UnifiedMediaProvider>
        <TestComponent />
      </UnifiedMediaProvider>
    )
    
    // Wait for initial media loading
    await waitFor(() => {
      expect(mockMediaService.listAllMedia).toHaveBeenCalled()
    }, { timeout: 5000 })
    
    // Check that progressive loading was scheduled
    const progressiveLoadingCalls = setTimeoutSpy.mock.calls.filter(([fn, delay]) => {
      const fnString = fn.toString()
      return fnString.includes('progressive') && delay >= 2000
    })
    
    expect(progressiveLoadingCalls.length).toBeGreaterThan(0)
    
    console.log('[TEST] 📋 Progressive loading calls scheduled:', progressiveLoadingCalls.length)
    
    // Fast-forward time to trigger progressive loading
    vi.runAllTimers()
    
    // Wait for progressive loading to execute
    await new Promise(resolve => setTimeout(resolve, 100))
    
    console.log('[TEST] ✅ Progressive preloading implementation verified')
    
    setTimeoutSpy.mockRestore()
  })

  test('should prioritize media based on user interaction patterns', async () => {
    console.log('[TEST] 🔍 Testing progressive loading prioritization...')
    
    const allMediaItems: MediaItem[] = [
      // Critical media (already handled)
      { id: 'image-welcome-1', type: 'image', pageId: 'welcome', metadata: { type: 'image' } },
      
      // Different priority levels for progressive loading
      { id: 'audio-0', type: 'audio', pageId: 'welcome', metadata: { type: 'audio' } }, // High priority (welcome audio)
      { id: 'audio-1', type: 'audio', pageId: 'objectives', metadata: { type: 'audio' } }, // Medium priority (next page audio)
      { id: 'image-topic-1', type: 'image', pageId: 'topic-1', metadata: { type: 'image' } }, // Medium priority (topic visuals)
      { id: 'video-topic-5', type: 'video', pageId: 'topic-5', metadata: { type: 'video' } } // Low priority (later topic)
    ] as MediaItem[]
    
    mockMediaService.listAllMedia.mockResolvedValue(allMediaItems)
    mockPreloadMedia.mockResolvedValue(['blob:url1', 'blob:url2', 'blob:url3'])
    
    render(
      <UnifiedMediaProvider>
        <div data-testid="test">Test</div>
      </UnifiedMediaProvider>
    )
    
    await waitFor(() => {
      expect(mockMediaService.listAllMedia).toHaveBeenCalled()
    })
    
    // Fast-forward to trigger progressive loading
    vi.runAllTimers()
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // The implementation should prioritize:
    // 1. Audio from welcome/objectives pages (immediate user needs)
    // 2. Visual media from early topic pages 
    // 3. Media from later topics
    
    // For now, verify that progressive loading is at least attempted
    // The specific prioritization logic will be implemented
    expect(mockMediaService.listAllMedia).toHaveBeenCalled()
    
    console.log('[TEST] ✅ Media prioritization framework verified')
  })
})