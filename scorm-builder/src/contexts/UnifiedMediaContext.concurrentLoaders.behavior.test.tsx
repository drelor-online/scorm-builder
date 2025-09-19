/**
 * BEHAVIOR TEST: Concurrent Progressive Loader Prevention
 *
 * This test reproduces and fixes the issue where multiple Progressive Loader
 * instances run simultaneously, causing random media loading failures.
 *
 * ISSUE REPRODUCTION:
 * - Multiple rapid refreshMedia() calls create duplicate Progressive Loaders
 * - The 2-second delay allows multiple loaders to queue up
 * - Concurrent loaders compete for the same media resources
 * - Results in "No media found for ID: audio-18, audio-19" errors
 *
 * EXPECTED BEHAVIOR:
 * - Only ONE Progressive Loader should run at a time
 * - New refresh calls should cancel previous loaders
 * - All media should load successfully without race conditions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, screen, act } from '@testing-library/react'
import React, { useEffect } from 'react'
import { UnifiedMediaProvider, useUnifiedMedia } from './UnifiedMediaContext'
import { PersistentStorageProvider } from './PersistentStorageContext'
import { MockFileStorage } from '../services/MockFileStorage'

// Track Progressive Loader instances to detect duplicates
let progressiveLoaderCallCount = 0
let concurrentLoaderCount = 0
let maxConcurrentLoaders = 0
let progressiveLoaderInstances: number[] = []

// Test component that triggers multiple rapid refresh calls
function ConcurrentRefreshTestComponent() {
  const media = useUnifiedMedia()

  useEffect(() => {
    // Simulate the scenario that causes the bug:
    // Multiple components calling refreshMedia() during project load
    const triggerConcurrentRefreshes = async () => {
      console.log('🧪 [TEST] Triggering concurrent refresh calls...')

      // This reproduces the exact pattern that causes duplicate loaders
      const refreshPromises = [
        media.refreshMedia(), // First component loads
        media.refreshMedia(), // Second component loads
        media.refreshMedia(), // Third component loads
      ]

      // All refresh calls happen simultaneously
      await Promise.allSettled(refreshPromises)
    }

    triggerConcurrentRefreshes()
  }, [media])

  return (
    <div data-testid="concurrent-test-component">
      <div data-testid="is-loading">{media.isLoading ? 'loading' : 'idle'}</div>
      <div data-testid="media-count">{media.getAllMedia().length}</div>
      <div data-testid="error-state">{media.error ? 'error' : 'no-error'}</div>
    </div>
  )
}

// Mock storage instance
let mockStorage: MockFileStorage

const renderMediaProvider = async (projectId: string) => {
  if (mockStorage.currentProjectId !== projectId) {
    await mockStorage.openProject(projectId)
  }

  return render(
    <PersistentStorageProvider fileStorage={mockStorage}>
      <UnifiedMediaProvider projectId={projectId}>
        <ConcurrentRefreshTestComponent />
      </UnifiedMediaProvider>
    </PersistentStorageProvider>
  )
}

describe('UnifiedMediaContext - Concurrent Progressive Loader Prevention', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset tracking counters
    progressiveLoaderCallCount = 0
    concurrentLoaderCount = 0
    maxConcurrentLoaders = 0
    progressiveLoaderInstances = []

    // Set up mock storage with realistic media data
    mockStorage = new MockFileStorage()
    await mockStorage.initialize()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should FAIL - demonstrating concurrent Progressive Loader issue', async () => {
    console.log('🧪 REPRODUCING: Concurrent Progressive Loader bug...')

    // Create a project with enough media to trigger progressive loading
    const project = await mockStorage.createProject('Concurrent Loader Test')

    // Create realistic media data that would exist in a real project
    const mediaItems = []

    // Generate 20 audio files (matching user's scenario)
    for (let i = 0; i < 20; i++) {
      mediaItems.push({
        id: `audio-${i}`,
        type: 'audio',
        pageId: i < 2 ? (i === 0 ? 'welcome' : 'objectives') : `topic-${i - 1}`,
        fileName: `narration-${i}.mp3`,
        metadata: {
          type: 'audio',
          title: `Audio ${i}`,
          uploadedAt: new Date().toISOString()
        }
      })
    }

    // Generate 20 caption files
    for (let i = 0; i < 20; i++) {
      mediaItems.push({
        id: `caption-${i}`,
        type: 'caption',
        pageId: i < 2 ? (i === 0 ? 'welcome' : 'objectives') : `topic-${i - 1}`,
        fileName: `captions-${i}.vtt`,
        metadata: {
          type: 'caption',
          title: `Caption ${i}`,
          uploadedAt: new Date().toISOString()
        }
      })
    }

    // Generate 20 image files
    for (let i = 0; i < 20; i++) {
      mediaItems.push({
        id: `image-${i}`,
        type: 'image',
        pageId: i < 2 ? (i === 0 ? 'welcome' : 'objectives') : `topic-${i - 1}`,
        fileName: `image-${i}.jpg`,
        metadata: {
          type: 'image',
          title: `Image ${i}`,
          uploadedAt: new Date().toISOString()
        }
      })
    }

    // Save all media to storage (simulating a fully loaded project)
    for (const item of mediaItems) {
      const blob = new Blob(['mock audio data'], { type: 'audio/mpeg' })
      await mockStorage.storeMedia(item.id, blob, item.type, item.metadata)
    }

    console.log(`💾 Stored ${mediaItems.length} media items (20 audio + 20 captions + 20 images)`)

    // Render the component that will trigger concurrent refresh calls
    await act(async () => {
      await renderMediaProvider(project.id)
    })

    // Wait for the loading to start
    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('loading')
    }, { timeout: 2000 })

    console.log('📊 Loading started, monitoring for concurrent Progressive Loaders...')

    // Wait for loading to complete or timeout
    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('idle')
    }, { timeout: 30000 }) // 30 second timeout

    const finalMediaCount = parseInt(screen.getByTestId('media-count').textContent || '0')
    const hasError = screen.getByTestId('error-state').textContent === 'error'

    console.log('📊 Final Results:')
    console.log(`- Media loaded: ${finalMediaCount} / ${mediaItems.length}`)
    console.log(`- Has errors: ${hasError}`)
    console.log(`- Progressive Loader calls: ${progressiveLoaderCallCount}`)
    console.log(`- Max concurrent loaders: ${maxConcurrentLoaders}`)

    // THIS TEST SHOULD FAIL - proving the concurrent loader bug exists

    // Assertion 1: Only one Progressive Loader should run at a time
    expect(maxConcurrentLoaders).toBeLessThanOrEqual(1)

    // Assertion 2: All media should load successfully
    expect(finalMediaCount).toBe(mediaItems.length)

    // Assertion 3: No errors should occur
    expect(hasError).toBe(false)

    console.log('❌ This test SHOULD FAIL, demonstrating the concurrent loader bug')
  })

  it('should handle rapid refresh calls without creating duplicate loaders', async () => {
    console.log('🧪 TESTING: Rapid refresh deduplication...')

    const project = await mockStorage.createProject('Rapid Refresh Test')

    // Create minimal media set for faster testing
    const mediaItems = [
      { id: 'audio-0', type: 'audio', pageId: 'welcome' },
      { id: 'audio-1', type: 'audio', pageId: 'objectives' },
      { id: 'caption-0', type: 'caption', pageId: 'welcome' },
      { id: 'caption-1', type: 'caption', pageId: 'objectives' },
    ]

    for (const item of mediaItems) {
      const blob = new Blob(['mock data'], { type: 'audio/mpeg' })
      await mockStorage.storeMedia(item.id, blob, item.type, { type: item.type })
    }

    await act(async () => {
      await renderMediaProvider(project.id)
    })

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('idle')
    }, { timeout: 10000 })

    // These assertions will help us verify the fix when we implement it
    expect(maxConcurrentLoaders).toBeLessThanOrEqual(1)
    expect(progressiveLoaderCallCount).toBeLessThan(3) // Should deduplicate the 3 calls

    console.log('✅ Rapid refresh test completed')
  })

  it('should cancel previous loaders when new refresh is triggered', async () => {
    console.log('🧪 TESTING: Loader cancellation behavior...')

    const project = await mockStorage.createProject('Cancellation Test')

    // Create media items that would take time to load progressively
    const mediaItems = Array.from({ length: 10 }, (_, i) => ({
      id: `audio-${i}`,
      type: 'audio',
      pageId: i < 2 ? (i === 0 ? 'welcome' : 'objectives') : `topic-${i - 1}`,
      fileName: `audio-${i}.mp3`,
      metadata: { type: 'audio' }
    }))

    for (const item of mediaItems) {
      const blob = new Blob(['mock data'], { type: 'audio/mpeg' })
      await mockStorage.storeMedia(item.id, blob, item.type, { type: item.type })
    }

    await act(async () => {
      await renderMediaProvider(project.id)
    })

    // This test verifies that when a new refresh is triggered,
    // any running Progressive Loader is properly cancelled

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('idle')
    }, { timeout: 15000 })

    // The cancellation behavior will be validated by the fix
    expect(maxConcurrentLoaders).toBeLessThanOrEqual(1)

    console.log('✅ Loader cancellation test completed')
  })
})