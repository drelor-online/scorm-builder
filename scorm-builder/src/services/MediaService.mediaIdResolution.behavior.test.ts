/**
 * BEHAVIOR TEST: Media ID Resolution Issues
 *
 * This test reproduces the issue where specific media IDs fail to resolve
 * despite being present in the backend storage.
 *
 * ISSUE REPRODUCTION:
 * - Backend has all 60 media items (20 audio + 20 captions + 20 images)
 * - Frontend fails to load specific IDs: audio-18, audio-19, audio-8, audio-9
 * - Error: "No media found for ID: audio-XX"
 * - Mismatch between ID generation and storage format
 *
 * ROOT CAUSE HYPOTHESIS:
 * 1. ID padding issue (audio-8 vs audio-08)
 * 2. Race condition in ID generation vs storage
 * 3. Cache inconsistency between MediaService and FileStorage
 *
 * EXPECTED BEHAVIOR:
 * - All media IDs should resolve consistently
 * - No "No media found" errors for existing media
 * - Consistent ID format between generation and retrieval
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaService } from './MediaService'
import { MockFileStorage } from './MockFileStorage'
import { generateMediaId } from '../utils/idGenerator'

// Mock storage instance
let mockStorage: MockFileStorage
let mediaService: MediaService

const setupMediaService = async (projectId: string) => {
  mockStorage = new MockFileStorage()
  await mockStorage.initialize()

  const project = await mockStorage.createProject('Media ID Test Project')
  await mockStorage.openProject(project.id)

  mediaService = new MediaService(mockStorage)
  return project.id
}

describe('MediaService - Media ID Resolution Issues', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })

  it('should FAIL - demonstrating media ID resolution issue with double-digit IDs', async () => {
    console.log('🧪 REPRODUCING: Media ID resolution failures for audio-18, audio-19, audio-8, audio-9...')

    const projectId = await setupMediaService('Test Project')

    // Create the exact scenario from the user's logs
    // Backend has 20 audio files with IDs: audio-0 through audio-19
    const audioItems = []

    for (let i = 0; i < 20; i++) {
      const audioId = `audio-${i}`
      const pageId = i < 2 ? (i === 0 ? 'welcome' : 'objectives') : `topic-${i - 1}`

      audioItems.push({
        id: audioId,
        type: 'audio',
        pageId: pageId,
        fileName: `narration-${i}.mp3`,
        metadata: {
          type: 'audio',
          title: `Audio ${i}`,
          uploadedAt: new Date().toISOString(),
          pageId: pageId
        }
      })
    }

    console.log('💾 Storing audio items to backend...')

    // Store all audio items to the backend (simulating successful upload)
    for (const item of audioItems) {
      const blob = new Blob(['mock audio data'], { type: 'audio/mpeg' })
      await mockStorage.storeMedia(item.id, blob, item.type, item.metadata)
    }

    console.log(`✅ Stored ${audioItems.length} audio items to backend storage`)

    // Load the media into MediaService cache (simulating project load)
    await mediaService.loadMediaFromProject(
      // audioNarrationData format
      audioItems.reduce((acc, item) => {
        acc[item.pageId] = {
          id: item.id,
          pageId: item.pageId,
          metadata: item.metadata
        }
        return acc
      }, {} as any),
      // mediaEnhancementsData
      {},
      // mediaRegistryData
      {}
    )

    console.log('📊 MediaService cache loaded, testing ID resolution...')

    // Test the specific IDs that were failing in the user's logs
    const problematicIds = ['audio-18', 'audio-19', 'audio-8', 'audio-9']
    const resolutionResults: Array<{ id: string; found: boolean; error?: string }> = []

    for (const audioId of problematicIds) {
      try {
        console.log(`🔍 Testing resolution of ${audioId}...`)

        // First check if it's in the MediaService cache
        const cachedItem = mediaService.getAllMedia().find(item => item.id === audioId)
        console.log(`  - Cache: ${cachedItem ? 'FOUND' : 'NOT FOUND'}`)

        // Then try to get the actual media data
        const media = await mediaService.getMedia(audioId)
        const found = media !== null

        console.log(`  - Storage: ${found ? 'FOUND' : 'NOT FOUND'}`)

        resolutionResults.push({ id: audioId, found })

        if (!found) {
          console.error(`❌ FAILED: No media found for ID: ${audioId}`)
        } else {
          console.log(`✅ SUCCESS: Media found for ID: ${audioId}`)
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`❌ ERROR resolving ${audioId}: ${errorMsg}`)
        resolutionResults.push({ id: audioId, found: false, error: errorMsg })
      }
    }

    // Test all audio IDs to see the pattern
    console.log('📊 Testing ALL audio IDs for pattern analysis...')
    const allResults: Array<{ id: string; found: boolean }> = []

    for (let i = 0; i < 20; i++) {
      const audioId = `audio-${i}`
      try {
        const media = await mediaService.getMedia(audioId)
        const found = media !== null
        allResults.push({ id: audioId, found })

        if (!found) {
          console.log(`  ❌ ${audioId}: NOT FOUND`)
        }
      } catch (error) {
        console.log(`  ❌ ${audioId}: ERROR`)
        allResults.push({ id: audioId, found: false })
      }
    }

    const failedIds = allResults.filter(r => !r.found).map(r => r.id)
    const successfulIds = allResults.filter(r => r.found).map(r => r.id)

    console.log('📊 Resolution Summary:')
    console.log(`  - Total IDs tested: ${allResults.length}`)
    console.log(`  - Successful: ${successfulIds.length} (${successfulIds.join(', ')})`)
    console.log(`  - Failed: ${failedIds.length} (${failedIds.join(', ')})`)
    console.log(`  - Success rate: ${(successfulIds.length / allResults.length * 100).toFixed(1)}%`)

    // THIS TEST SHOULD FAIL - proving the ID resolution bug exists

    // Assertion 1: All problematic IDs should be found (this will fail)
    const failedProblematicIds = problematicIds.filter(id =>
      !resolutionResults.find(r => r.id === id && r.found)
    )
    expect(failedProblematicIds).toHaveLength(0) // Should be empty if all IDs resolve

    // Assertion 2: All audio IDs should resolve (this will fail)
    expect(failedIds).toHaveLength(0) // Should be empty if all IDs resolve

    console.log('❌ This test SHOULD FAIL, demonstrating the media ID resolution bug')
  })

  it('should identify the root cause of ID resolution failures', async () => {
    console.log('🧪 ANALYZING: ID generation vs storage format consistency...')

    const projectId = await setupMediaService('ID Analysis Project')

    // Test different ID generation patterns
    const testCases = [
      { pageId: 'welcome', expectedId: 'audio-0' },
      { pageId: 'objectives', expectedId: 'audio-1' },
      { pageId: 'topic-1', expectedId: 'audio-2' },
      { pageId: 'topic-8', expectedId: 'audio-9' },   // This might be problematic
      { pageId: 'topic-17', expectedId: 'audio-18' },  // This was failing
      { pageId: 'topic-18', expectedId: 'audio-19' }   // This was failing
    ]

    console.log('📊 Testing ID generation consistency...')

    for (const testCase of testCases) {
      const generatedId = generateMediaId('audio', testCase.pageId)
      console.log(`  ${testCase.pageId} → Generated: ${generatedId}, Expected: ${testCase.expectedId}`)

      // Store with generated ID
      const blob = new Blob(['test'], { type: 'audio/mpeg' })
      await mockStorage.storeMedia(generatedId, blob, 'audio', { pageId: testCase.pageId })

      // Try to retrieve with expected ID
      const retrievedWithExpected = await mockStorage.getMedia(testCase.expectedId)
      const retrievedWithGenerated = await mockStorage.getMedia(generatedId)

      console.log(`    - Retrieved with expected ID: ${retrievedWithExpected ? 'FOUND' : 'NOT FOUND'}`)
      console.log(`    - Retrieved with generated ID: ${retrievedWithGenerated ? 'FOUND' : 'NOT FOUND'}`)

      if (generatedId !== testCase.expectedId) {
        console.error(`    ❌ ID MISMATCH: Generated "${generatedId}" ≠ Expected "${testCase.expectedId}"`)
      }
    }

    console.log('✅ ID analysis completed - this test helps identify the root cause')
  })

  it('should handle ID padding and format consistency', async () => {
    console.log('🧪 TESTING: ID padding consistency (audio-8 vs audio-08)...')

    const projectId = await setupMediaService('Padding Test Project')

    // Test both padded and non-padded formats
    const paddingTestCases = [
      { id: 'audio-8', paddedId: 'audio-08' },
      { id: 'audio-9', paddedId: 'audio-09' },
      { id: 'audio-18', paddedId: null },  // Already double-digit
      { id: 'audio-19', paddedId: null }   // Already double-digit
    ]

    for (const testCase of paddingTestCases) {
      const blob = new Blob(['test'], { type: 'audio/mpeg' })

      // Store with original ID format
      await mockStorage.storeMedia(testCase.id, blob, 'audio', { title: `Test ${testCase.id}` })

      // Test retrieval with both formats
      const foundOriginal = await mockStorage.getMedia(testCase.id)
      const foundPadded = testCase.paddedId ? await mockStorage.getMedia(testCase.paddedId) : null

      console.log(`  ${testCase.id}:`)
      console.log(`    - Original format: ${foundOriginal ? 'FOUND' : 'NOT FOUND'}`)
      if (testCase.paddedId) {
        console.log(`    - Padded format: ${foundPadded ? 'FOUND' : 'NOT FOUND'}`)
      }

      // The original format should always work
      expect(foundOriginal).not.toBeNull()
    }

    console.log('✅ ID padding test completed')
  })
})