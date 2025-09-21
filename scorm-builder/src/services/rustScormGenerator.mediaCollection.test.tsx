/**
 * Test for media collection in rustScormGenerator
 *
 * This test verifies that collectAllMediaIds() properly finds all media
 * references including both objectivesPage and learningObjectivesPage variants
 * to prevent regression errors during SCORM generation.
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

describe('Media Collection', () => {
  it('should collect media from objectivesPage (legacy variant)', () => {
    const courseContent = {
      welcome: {
        audioId: 'audio-0',
        captionId: 'caption-0',
        media: [{ id: 'image-0' }]
      },
      objectivesPage: {  // Legacy variant
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

    const mediaIds = collectAllMediaIds(courseContent)

    // Should include Learning Objectives media from objectivesPage
    expect(mediaIds).toContain('audio-1')
    expect(mediaIds).toContain('caption-1')
    expect(mediaIds).toContain('image-1')

    // Should also include other media
    expect(mediaIds).toContain('audio-0')
    expect(mediaIds).toContain('audio-2')
  })

  it('should collect media from learningObjectivesPage (canonical variant)', () => {
    const courseContent = {
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

    const mediaIds = collectAllMediaIds(courseContent)

    // Should include Learning Objectives media
    expect(mediaIds).toContain('audio-1')
    expect(mediaIds).toContain('caption-1')
    expect(mediaIds).toContain('image-1')
  })

  it('should collect media from both objectivesPage and learningObjectivesPage if both exist', () => {
    const courseContent = {
      objectivesPage: {
        audioId: 'audio-legacy',
        media: [{ id: 'image-legacy' }]
      },
      learningObjectivesPage: {
        audioId: 'audio-canonical',
        media: [{ id: 'image-canonical' }]
      }
    }

    const mediaIds = collectAllMediaIds(courseContent)

    // Should include media from both variants
    expect(mediaIds).toContain('audio-legacy')
    expect(mediaIds).toContain('image-legacy')
    expect(mediaIds).toContain('audio-canonical')
    expect(mediaIds).toContain('image-canonical')
  })

  it('should handle missing learning objectives gracefully', () => {
    const courseContent = {
      welcome: {
        audioId: 'audio-0'
      },
      topics: [
        {
          audioId: 'audio-2'
        }
      ]
      // No objectivesPage or learningObjectivesPage
    }

    const mediaIds = collectAllMediaIds(courseContent)

    expect(mediaIds).toContain('audio-0')
    expect(mediaIds).toContain('audio-2')
    // Should not crash or include undefined values
    expect(mediaIds.every(id => typeof id === 'string' && id.length > 0)).toBe(true)
  })

  it('should reproduce the regression bug where objectivesPage media is missing', () => {
    // This reproduces the exact scenario from the user's logs
    const courseContent = {
      welcome: {
        audioId: 'audio-0',
        captionId: 'caption-0',
        media: [{ id: 'image-0' }]
      },
      objectivesPage: {  // This is the variant causing the issue
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

    const mediaIds = collectAllMediaIds(courseContent)

    // This test will FAIL initially because collectAllMediaIds doesn't check objectivesPage
    // After the fix, it should pass
    expect(mediaIds).toContain('audio-1')
    expect(mediaIds).toContain('caption-1')
    expect(mediaIds).toContain('image-1')

    console.log('[TEST] Collected media IDs:', mediaIds.filter(id => id.includes('1')))
  })
})