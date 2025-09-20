/**
 * Test for SVG filtering fix - verifies SVGs with type="image" are properly detected
 *
 * ISSUE: SVG files with type="image" and generic IDs like "image-1" were being
 * filtered out because the original logic only checked for 'svg' in ID/URL/type fields.
 *
 * FIX: Added isSvgMedia() helper that checks MIME type from cache to detect SVGs
 * regardless of their type classification.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { isSvgMedia, mediaCache } from './rustScormGenerator'

describe('SVG Filtering Fix', () => {
  beforeEach(() => {
    mediaCache.clear()
  })

  it('should detect SVG with type="image" and generic ID using MIME type', () => {
    // Setup: Add SVG to cache with type="image" and MIME type="image/svg+xml"
    mediaCache.set('image-1', {
      data: new Uint8Array([60, 115, 118, 103]), // <svg
      mimeType: 'image/svg+xml'
    })

    // Test the problematic case: SVG with type="image" and generic ID
    const svgMedia = {
      id: 'image-1',
      type: 'image',
      url: 'media/image-1.png' // Note: URL doesn't contain 'svg'
    }

    // Before fix: This would return false
    // After fix: This should return true due to MIME type check
    const result = isSvgMedia(svgMedia)

    expect(result).toBe(true)
  })

  it('should still detect SVG with svg in ID (backward compatibility)', () => {
    const svgMedia = {
      id: 'logo-svg-1',
      type: 'image',
      url: 'media/logo.png'
    }

    const result = isSvgMedia(svgMedia)
    expect(result).toBe(true)
  })

  it('should still detect SVG with svg in URL (backward compatibility)', () => {
    const svgMedia = {
      id: 'image-1',
      type: 'image',
      url: 'media/logo.svg'
    }

    const result = isSvgMedia(svgMedia)
    expect(result).toBe(true)
  })

  it('should still detect SVG with type="svg" (backward compatibility)', () => {
    const svgMedia = {
      id: 'image-1',
      type: 'svg',
      url: 'media/image.png'
    }

    const result = isSvgMedia(svgMedia)
    expect(result).toBe(true)
  })

  it('should not detect non-SVG image', () => {
    // Setup: Add regular image to cache
    mediaCache.set('image-2', {
      data: new Uint8Array([255, 216, 255]), // JPEG header
      mimeType: 'image/jpeg'
    })

    const jpegMedia = {
      id: 'image-2',
      type: 'image',
      url: 'media/image-2.jpg'
    }

    const result = isSvgMedia(jpegMedia)
    expect(result).toBe(false)
  })

  it('should handle missing cache entry gracefully', () => {
    const unknownMedia = {
      id: 'image-999',
      type: 'image',
      url: 'media/unknown.png'
    }

    const result = isSvgMedia(unknownMedia)
    expect(result).toBe(false)
  })
})