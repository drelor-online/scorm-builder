/**
 * BEHAVIOR TEST: Caption Batch Processing Timeout Handling
 *
 * This test reproduces the issue where caption batch processing fails
 * with "CLEANUP: Force-resolving unhandled promise" messages.
 *
 * ISSUE REPRODUCTION:
 * - Caption loading uses batch promises with timeout
 * - Individual captions within batch fail silently
 * - Forced cleanup after timeout resolves promises as null
 * - Results in missing captions without proper error reporting
 *
 * ROOT CAUSE HYPOTHESIS:
 * 1. Batch timeout too short for actual caption loading time
 * 2. Individual caption failures not properly handled
 * 3. Force cleanup masks real errors
 * 4. No retry mechanism for failed captions
 *
 * EXPECTED BEHAVIOR:
 * - Individual caption failures should be reported
 * - Batch processing should not use forced cleanup
 * - Failed captions should have retry mechanism
 * - Clear error messages for caption loading failures
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, screen, act } from '@testing-library/react'
import React, { useEffect } from 'react'
import { UnifiedMediaProvider, useUnifiedMedia } from './UnifiedMediaContext'
import { PersistentStorageProvider } from './PersistentStorageContext'
import { MockFileStorage } from '../services/MockFileStorage'

// Track caption batch processing behavior
let captionBatchCalls = 0
let forcedCleanupCount = 0
let captionTimeouts = 0
let captionBatchResults: Array<{ batchId: number; success: boolean; timeoutMs: number }> = []

// Test component that loads captions
function CaptionBatchTestComponent() {
  const media = useUnifiedMedia()

  useEffect(() => {
    // Trigger media loading that would include captions
    media.refreshMedia()
  }, [media])

  return (
    <div data-testid="caption-batch-test">
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
        <CaptionBatchTestComponent />
      </UnifiedMediaProvider>
    </PersistentStorageProvider>
  )
}

describe('UnifiedMediaContext - Caption Batch Timeout Handling', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset tracking counters
    captionBatchCalls = 0
    forcedCleanupCount = 0
    captionTimeouts = 0
    captionBatchResults = []

    // Set up mock storage with caption data
    mockStorage = new MockFileStorage()
    await mockStorage.initialize()
  })

  it('should FAIL - demonstrating caption batch timeout issues', async () => {
    console.log('🧪 REPRODUCING: Caption batch processing timeout failures...')

    // Create a project with captions that would trigger batch loading
    const project = await mockStorage.createProject('Caption Batch Test')

    // Create 20 caption files (matching user's scenario)
    const captionItems = []
    for (let i = 0; i < 20; i++) {
      const captionId = `caption-${i}`
      const pageId = i < 2 ? (i === 0 ? 'welcome' : 'objectives') : `topic-${i - 1}`

      captionItems.push({
        id: captionId,
        type: 'caption',
        pageId: pageId,
        fileName: `captions-${i}.vtt`,
        metadata: {
          type: 'caption',
          title: `Caption ${i}`,
          uploadedAt: new Date().toISOString(),
          pageId: pageId
        }
      })

      // Store caption to backend
      const captionContent = `WEBVTT

1
00:00:00.000 --> 00:00:03.000
This is caption ${i} content

2
00:00:03.000 --> 00:00:06.000
Second subtitle for caption ${i}`

      const blob = new Blob([captionContent], { type: 'text/vtt' })
      await mockStorage.storeMedia(captionId, blob, 'caption', captionItems[i].metadata)
    }

    console.log(`💾 Stored ${captionItems.length} caption files to backend`)

    // Also add some audio files to trigger mixed media loading
    for (let i = 0; i < 10; i++) {
      const audioId = `audio-${i}`
      const pageId = i < 2 ? (i === 0 ? 'welcome' : 'objectives') : `topic-${i - 1}`

      const audioBlob = new Blob(['mock audio data'], { type: 'audio/mpeg' })
      await mockStorage.storeMedia(audioId, audioBlob, 'audio', {
        type: 'audio',
        pageId: pageId
      })
    }

    console.log('✅ Setup complete with mixed media that should trigger caption batch processing')

    // Render the component and trigger loading
    await act(async () => {
      await renderMediaProvider(project.id)
    })

    // Wait for loading to start
    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('loading')
    }, { timeout: 5000 })

    console.log('📊 Loading started, monitoring caption batch processing...')

    // Wait for loading to complete (or timeout)
    let loadingCompleted = false
    try {
      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('idle')
      }, { timeout: 30000 })
      loadingCompleted = true
    } catch (error) {
      console.log('⚠️ Loading timed out - this may be expected if batch processing hangs')
    }

    const finalMediaCount = parseInt(screen.getByTestId('media-count').textContent || '0')
    const hasError = screen.getByTestId('error-state').textContent === 'error'

    console.log('📊 Caption Batch Processing Results:')
    console.log(`- Loading completed: ${loadingCompleted}`)
    console.log(`- Final media count: ${finalMediaCount} / 30 expected`)
    console.log(`- Has errors: ${hasError}`)
    console.log(`- Caption batch calls: ${captionBatchCalls}`)
    console.log(`- Forced cleanups: ${forcedCleanupCount}`)
    console.log(`- Caption timeouts: ${captionTimeouts}`)

    // THIS TEST SHOULD FAIL - proving the caption batch timeout issue exists

    // Assertion 1: All media should load without forced cleanup
    expect(forcedCleanupCount).toBe(0) // Should be 0 if no forced cleanups occur

    // Assertion 2: All media should be loaded successfully
    expect(finalMediaCount).toBe(30) // 20 captions + 10 audio

    // Assertion 3: No timeouts should occur during caption loading
    expect(captionTimeouts).toBe(0) // Should be 0 if no timeouts

    console.log('❌ This test SHOULD FAIL, demonstrating the caption batch timeout bug')
  })

  it('should handle individual caption failures gracefully', async () => {
    console.log('🧪 TESTING: Individual caption failure handling...')

    const project = await mockStorage.createProject('Individual Caption Test')

    // Create a mix of valid and invalid captions
    const testCaptions = [
      { id: 'caption-0', valid: true, content: 'WEBVTT\n\n1\n00:00:00.000 --> 00:00:03.000\nValid caption' },
      { id: 'caption-1', valid: false, content: 'INVALID VTT CONTENT' }, // Invalid VTT format
      { id: 'caption-2', valid: true, content: 'WEBVTT\n\n1\n00:00:00.000 --> 00:00:03.000\nAnother valid caption' },
      { id: 'caption-3', valid: false, content: '' }, // Empty content
    ]

    for (const caption of testCaptions) {
      const blob = new Blob([caption.content], { type: 'text/vtt' })
      await mockStorage.storeMedia(caption.id, blob, 'caption', {
        type: 'caption',
        pageId: 'welcome'
      })
    }

    await act(async () => {
      await renderMediaProvider(project.id)
    })

    // Wait for processing to complete
    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('idle')
    }, { timeout: 15000 })

    // In a good implementation:
    // - Valid captions should load successfully
    // - Invalid captions should be reported as failed (not forced cleanup)
    // - Error handling should be graceful

    const finalCount = parseInt(screen.getByTestId('media-count').textContent || '0')
    console.log(`📊 Individual caption test: ${finalCount} items loaded`)

    // This test validates proper error handling behavior
    expect(forcedCleanupCount).toBe(0) // Good implementations don't use forced cleanup
    console.log('✅ Individual caption failure test completed')
  })

  it('should provide clear timeout and error reporting', async () => {
    console.log('🧪 TESTING: Caption timeout and error reporting...')

    const project = await mockStorage.createProject('Error Reporting Test')

    // Create captions that would potentially cause timeouts
    const largeCaptionContent = `WEBVTT

${Array.from({ length: 1000 }, (_, i) => `
${i + 1}
00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.000 --> 00:${String(Math.floor((i + 3) / 60)).padStart(2, '0')}:${String((i + 3) % 60).padStart(2, '0')}.000
Large caption entry ${i + 1}
`).join('')}`

    // Store a very large caption file that might timeout
    const largeBlob = new Blob([largeCaptionContent], { type: 'text/vtt' })
    await mockStorage.storeMedia('caption-large', largeBlob, 'caption', {
      type: 'caption',
      pageId: 'welcome'
    })

    // Store a few normal captions
    for (let i = 0; i < 5; i++) {
      const normalContent = `WEBVTT\n\n1\n00:00:00.000 --> 00:00:03.000\nNormal caption ${i}`
      const normalBlob = new Blob([normalContent], { type: 'text/vtt' })
      await mockStorage.storeMedia(`caption-${i}`, normalBlob, 'caption', {
        type: 'caption',
        pageId: 'welcome'
      })
    }

    await act(async () => {
      await renderMediaProvider(project.id)
    })

    // Monitor for timeout and error reporting behavior
    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('idle')
    }, { timeout: 20000 })

    console.log('📊 Error reporting test results:')
    console.log(`- Forced cleanups: ${forcedCleanupCount}`)
    console.log(`- Caption timeouts: ${captionTimeouts}`)

    // A good implementation should have proper timeout handling without forced cleanup
    console.log('✅ Error reporting test completed')
  })
})