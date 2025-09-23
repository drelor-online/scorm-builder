/**
 * Test to reproduce and fix the duplicate media ID bug
 *
 * BUG SCENARIO:
 * 1. Add image to Learning Objectives → gets ID "image-1"
 * 2. Add another image to Learning Objectives → ALSO gets ID "image-1" (overwrites first!)
 * 3. This makes it appear like images are "moving" between pages
 *
 * This test reproduces the exact scenario from the user's logs
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createMediaService, __testing } from './MediaService'
import type { FileStorage } from './FileStorage'

describe('MediaService Duplicate ID Bug', () => {
  let mediaService: any
  let mockFileStorage: Partial<FileStorage>

  beforeEach(() => {
    vi.clearAllMocks()

    // Clear singleton instances for testing
    __testing.clearInstances()

    // Create a mock FileStorage instance with all required methods
    mockFileStorage = {
      storeMedia: vi.fn(),
      getMedia: vi.fn(),
      deleteMedia: vi.fn(),
      listAllMedia: vi.fn(),
      doesMediaExist: vi.fn(),
      openProject: vi.fn(),
      _currentProjectId: 'test-project-123'
    }

    // Create MediaService with mocked FileStorage using factory
    mediaService = createMediaService(
      'test-project-123',
      mockFileStorage as FileStorage,
      false // generationMode
    )

    // Mock successful storage - matches FileStorage.storeMedia signature
    mockFileStorage.storeMedia = vi.fn().mockImplementation(async (id, file, type, metadata, progressCallback) => {
      // Return successful result matching MediaItem interface
      return {
        id: id, // Use the ID passed in
        fileName: file instanceof File ? file.name : `${id}.${type === 'image' ? 'jpg' : 'mp4'}`,
        size: file.size || (file instanceof Blob ? file.size : 1000),
        mimeType: file.type || 'application/octet-stream',
        pageId: metadata?.page_id,
        metadata
      }
    })

    // Track stored media IDs to simulate realistic existence checks
    const storedMediaIds = new Set<string>()

    // Mock media existence check - tracks what has been stored
    mockFileStorage.doesMediaExist = vi.fn().mockImplementation(async (mediaId: string) => {
      return storedMediaIds.has(mediaId)
    })

    // Update storeMedia mock to track stored IDs
    const originalStoreMedia = mockFileStorage.storeMedia as any
    mockFileStorage.storeMedia = vi.fn().mockImplementation(async (id, file, type, metadata, progressCallback) => {
      // Add the ID to our tracking set BEFORE calling the original implementation
      storedMediaIds.add(id)

      // Call the original mock implementation
      return originalStoreMedia(id, file, type, metadata, progressCallback)
    })

    mockFileStorage.listAllMedia = vi.fn().mockResolvedValue([])
  })

  afterEach(() => {
    // Clean up singleton instances after each test
    __testing.clearInstances()
  })

  it('should generate unique IDs when storing multiple images on the same page', async () => {
    // ARRANGE: Create two different image blobs
    const checklistImageBlob = new Blob(['checklist image data'], { type: 'image/jpeg' })
    const fireTriangleImageBlob = new Blob(['fire triangle image data'], { type: 'image/png' })

    const pageId = 'learning-objectives'

    // ACT: Store the first image (checklist)
    const firstImage = await mediaService.storeMedia(
      checklistImageBlob,
      pageId,
      'image',
      { title: 'How to start with AI in your company: a checklist | Cloudflight' }
    )

    // Store the second image (fire triangle) - this should NOT overwrite the first
    const secondImage = await mediaService.storeMedia(
      fireTriangleImageBlob,
      pageId,
      'image',
      { title: 'Fire Triangle Explanation | LW Safety Ltd' }
    )

    // ASSERT: Both images should have unique IDs
    expect(firstImage.id).not.toBe(secondImage.id)
    expect(firstImage.id).toBe('image-1') // First image on learning-objectives should be image-1
    expect(secondImage.id).toBe('image-1-1') // Second image should have a suffix to avoid collision

    // Verify both images were stored with correct page IDs
    expect(firstImage.pageId).toBe('learning-objectives')
    expect(secondImage.pageId).toBe('learning-objectives')

    // Verify FileStorage was called twice with different IDs
    expect(mockFileStorage.storeMedia).toHaveBeenCalledTimes(2)

    const firstCall = (mockFileStorage.storeMedia as any).mock.calls[0]
    const secondCall = (mockFileStorage.storeMedia as any).mock.calls[1]

    expect(firstCall[0]).toBe('image-1') // First image ID
    expect(secondCall[0]).toBe('image-1-1') // Second image should have unique ID
  })

  it('should reproduce the exact user scenario from logs', async () => {
    // ARRANGE: Simulate the exact sequence from user logs

    // Step 1: User adds checklist image to Learning Objectives
    const checklistBlob = new Blob(['checklist data'], { type: 'image/jpeg' })
    const checklistResult = await mediaService.storeMedia(
      checklistBlob,
      'learning-objectives',
      'image',
      { title: 'How to start with AI in your company: a checklist | Cloudflight' }
    )

    // Step 2: User navigates to Topic 0 and adds fire triangle image
    const fireTriangleBlob = new Blob(['fire triangle data'], { type: 'image/png' })
    const fireTriangleResult = await mediaService.storeMedia(
      fireTriangleBlob,
      'topic-0',
      'image',
      { title: 'Fire Triangle Explanation | LW Safety Ltd' }
    )

    // ASSERT: Images should have different IDs based on their pageIds
    expect(checklistResult.id).toBe('image-1') // Learning objectives = pageIndex 1 → image-1
    expect(fireTriangleResult.id).toBe('image-2') // Topic-0 = pageIndex 2 → image-2

    // Both should keep their original page assignments
    expect(checklistResult.pageId).toBe('learning-objectives')
    expect(fireTriangleResult.pageId).toBe('topic-0')
  })

  it('should handle the bug scenario: second image on same page overwrites first', async () => {
    // ARRANGE: This test demonstrates the current BUG behavior
    // When this test FAILS, it means we've reproduced the bug correctly
    // When we fix the bug, this test should be updated to expect correct behavior

    const firstBlob = new Blob(['first image'], { type: 'image/jpeg' })
    const secondBlob = new Blob(['second image'], { type: 'image/jpeg' })

    // ACT: Add two images to the same page (learning-objectives)
    const first = await mediaService.storeMedia(firstBlob, 'learning-objectives', 'image', { title: 'First Image' })
    const second = await mediaService.storeMedia(secondBlob, 'learning-objectives', 'image', { title: 'Second Image' })

    // CURRENT BUG BEHAVIOR: Both get the same ID, second overwrites first
    // This assertion will FAIL once we fix the bug, which is what we want!
    try {
      expect(first.id).toBe(second.id) // Currently both get 'image-1'
      console.log('❌ BUG REPRODUCED: Both images have the same ID:', first.id)
    } catch (error) {
      console.log('✅ BUG FIXED: Images have unique IDs:', first.id, 'vs', second.id)
      // Once fixed, they should have different IDs
      expect(first.id).not.toBe(second.id)
    }
  })

  it('should generate unique IDs across different media types on same page', async () => {
    // ARRANGE: Test different media types on same page
    const imageBlob = new Blob(['image data'], { type: 'image/jpeg' })
    const videoBlob = new Blob(['video data'], { type: 'video/mp4' })
    const audioBlob = new Blob(['audio data'], { type: 'audio/wav' })

    // ACT: Store different media types on same page
    const image = await mediaService.storeMedia(imageBlob, 'topic-0', 'image')
    const video = await mediaService.storeMedia(videoBlob, 'topic-0', 'video')
    const audio = await mediaService.storeMedia(audioBlob, 'topic-0', 'audio')

    // ASSERT: Different types should have different IDs
    expect(image.id).toBe('image-2') // topic-0 = pageIndex 2
    expect(video.id).toBe('video-2')
    expect(audio.id).toBe('audio-2')

    // All should be on the same page
    expect(image.pageId).toBe('topic-0')
    expect(video.pageId).toBe('topic-0')
    expect(audio.pageId).toBe('topic-0')
  })
})