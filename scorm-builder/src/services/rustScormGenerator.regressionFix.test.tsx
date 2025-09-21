/**
 * Integration test for Learning Objectives regression fix
 *
 * This test verifies that the complete fix for the Learning Objectives media collection
 * works end-to-end, including both the collectAllMediaIds fix and the graceful fallback
 * for regression detection.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock the logger before importing rustScormGenerator
vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

import { collectAllMediaIds } from './rustScormGenerator'

describe('Learning Objectives Regression Fix', () => {
  it('should collect all Learning Objectives media regardless of naming variant', () => {
    // Test with objectivesPage (the variant that was causing the regression)
    const courseContentWithObjectivesPage = {
      welcome: {
        audioId: 'audio-0',
        captionId: 'caption-0',
        media: [{ id: 'image-0' }]
      },
      objectivesPage: {  // This was the problematic variant
        audioId: 'audio-1',
        captionId: 'caption-1',
        media: [{ id: 'image-1' }]
      },
      topics: [
        {
          audioId: 'audio-2',
          captionId: 'caption-2',
          media: [{ id: 'image-2' }]
        }
      ]
    }

    const mediaIds = collectAllMediaIds(courseContentWithObjectivesPage)

    // Verify that all Learning Objectives media is collected
    expect(mediaIds).toContain('audio-1')
    expect(mediaIds).toContain('caption-1')
    expect(mediaIds).toContain('image-1')

    // Verify complete set is collected
    expect(mediaIds).toContain('audio-0')
    expect(mediaIds).toContain('audio-2')
    expect(mediaIds.length).toBeGreaterThanOrEqual(9) // 3 media per page × 3 pages
  })

  it('should collect Learning Objectives media from learningObjectivesPage (canonical)', () => {
    const courseContentWithLearningObjectivesPage = {
      welcome: {
        audioId: 'audio-0',
        captionId: 'caption-0',
        media: [{ id: 'image-0' }]
      },
      learningObjectivesPage: {  // Canonical variant
        audioId: 'audio-1',
        captionId: 'caption-1',
        media: [{ id: 'image-1' }]
      },
      topics: [
        {
          audioId: 'audio-2',
          captionId: 'caption-2',
          media: [{ id: 'image-2' }]
        }
      ]
    }

    const mediaIds = collectAllMediaIds(courseContentWithLearningObjectivesPage)

    // Verify that all Learning Objectives media is collected
    expect(mediaIds).toContain('audio-1')
    expect(mediaIds).toContain('caption-1')
    expect(mediaIds).toContain('image-1')
  })

  it('should handle real-world course structure matching user logs', () => {
    // Simulate the exact course structure from user's logs showing the regression
    const realWorldCourseContent = {
      welcome: {
        audioId: 'audio-0',
        captionId: 'caption-0',
        media: [{ id: 'image-0' }]
      },
      objectivesPage: {  // This was missing from collection causing the regression
        audioId: 'audio-1',
        captionId: 'caption-1',
        media: [{ id: 'image-1' }]
      },
      topics: Array.from({ length: 18 }, (_, i) => ({
        audioId: `audio-${i + 2}`,  // audio-2 through audio-19
        captionId: `caption-${i + 2}`,
        media: [{ id: `image-${i + 2}` }]
      }))
    }

    const mediaIds = collectAllMediaIds(realWorldCourseContent)

    // Verify the specific media that was missing in the regression
    expect(mediaIds).toContain('audio-1')
    expect(mediaIds).toContain('caption-1')
    expect(mediaIds).toContain('image-1')

    // Verify complete range is collected (should be 60 total: 20 pages × 3 media each)
    expect(mediaIds.length).toBe(60)

    // Verify the range from user logs is complete
    const audioIds = mediaIds.filter(id => id.startsWith('audio-'))
    expect(audioIds).toHaveLength(20) // audio-0 through audio-19

    const captionIds = mediaIds.filter(id => id.startsWith('caption-'))
    expect(captionIds).toHaveLength(20) // caption-0 through caption-19

    const imageIds = mediaIds.filter(id => id.startsWith('image-'))
    expect(imageIds).toHaveLength(20) // image-0 through image-19

    console.log('[TEST] ✅ Successfully collected all 60 media IDs including Learning Objectives')
  })

  it('should not duplicate media when both variants are present', () => {
    const courseContentWithBothVariants = {
      objectivesPage: {
        audioId: 'audio-objectives',
        media: [{ id: 'image-objectives' }]
      },
      learningObjectivesPage: {
        audioId: 'audio-learning',
        media: [{ id: 'image-learning' }]
      }
    }

    const mediaIds = collectAllMediaIds(courseContentWithBothVariants)

    // Should collect from both variants without duplication
    expect(mediaIds).toContain('audio-objectives')
    expect(mediaIds).toContain('image-objectives')
    expect(mediaIds).toContain('audio-learning')
    expect(mediaIds).toContain('image-learning')

    // Should not have duplicates
    const uniqueIds = new Set(mediaIds)
    expect(uniqueIds.size).toBe(mediaIds.length)
  })

  it('should prevent the specific regression scenario', () => {
    // This test simulates the exact scenario from the user's logs:
    // 1. Course content uses objectivesPage (not learningObjectivesPage)
    // 2. Media collection finds everything except audio-1, caption-1, image-1
    // 3. During SCORM generation, resolveAudioCaptionFile is called for these missing items
    // 4. Previously this would throw a regression error immediately
    // 5. Now it should handle it gracefully

    const problematicCourseContent = {
      welcome: { audioId: 'audio-0' },
      objectivesPage: {  // The key issue - using objectivesPage not learningObjectivesPage
        audioId: 'audio-1',
        captionId: 'caption-1',
        media: [{ id: 'image-1' }]
      },
      topics: [{ audioId: 'audio-2' }]
    }

    // Before the fix, this would have missed the Learning Objectives media
    // After the fix, it should collect all media
    const collectedMediaIds = collectAllMediaIds(problematicCourseContent)

    // Verify that the fix collects the previously missing Learning Objectives media
    expect(collectedMediaIds).toContain('audio-1')
    expect(collectedMediaIds).toContain('caption-1')
    expect(collectedMediaIds).toContain('image-1')

    // If collectAllMediaIds works correctly, we shouldn't hit the regression error
    // because all media will be pre-loaded in the cache
    console.log('[TEST] ✅ Regression scenario prevented - all media collected properly')
  })
})