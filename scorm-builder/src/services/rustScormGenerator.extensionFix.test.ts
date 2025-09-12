/**
 * Test to verify that the rustScormGenerator extension logic is fixed
 * to avoid .bin files for known media types
 */

import { describe, it, expect } from 'vitest'
import { getExtensionFromMimeType } from './rustScormGenerator'

describe('RustScormGenerator Extension Fix', () => {
  it('should map MIME types to correct extensions', () => {
    console.log('[Extension Fix Test] 🔍 Testing MIME type to extension mapping')
    
    const testCases = [
      // Images - should NOT be .bin
      { mimeType: 'image/jpeg', expected: 'jpg' },
      { mimeType: 'image/png', expected: 'png' },
      { mimeType: 'image/gif', expected: 'gif' },
      { mimeType: 'image/svg+xml', expected: 'svg' },
      { mimeType: 'image/webp', expected: 'webp' },
      
      // Audio - should NOT be .bin
      { mimeType: 'audio/mpeg', expected: 'mp3' },
      { mimeType: 'audio/wav', expected: 'wav' },
      { mimeType: 'audio/ogg', expected: 'ogg' },
      
      // Video - should NOT be .bin
      { mimeType: 'video/mp4', expected: 'mp4' },
      { mimeType: 'video/webm', expected: 'webm' },
      
      // YouTube metadata
      { mimeType: 'application/json', expected: 'json' },
      
      // Unknown MIME types - can be .bin
      { mimeType: 'unknown/type', expected: 'bin' },
      { mimeType: '', expected: 'bin' },
    ]
    
    testCases.forEach(({ mimeType, expected }) => {
      const result = getExtensionFromMimeType(mimeType)
      console.log(`[Extension Fix Test] MIME "${mimeType}" -> "${result}" (expected: "${expected}")`)
      
      expect(result).toBe(expected)
      
      // CRITICAL TEST: Known media MIME types should NOT produce .bin
      if (mimeType.startsWith('image/') || mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
        expect(result).not.toBe('bin')
        console.log(`[Extension Fix Test] ✅ ${mimeType} correctly avoided .bin extension`)
      }
    })
    
    console.log('[Extension Fix Test] ✅ All MIME type mappings correct')
  })
  
  it('should demonstrate the fix prevents bin files for user scenario', () => {
    console.log('[Extension Fix Test] 🔍 Testing user scenario: image-3, image-4, image-5')
    
    // This simulates what would happen with the user's actual media files
    const userMediaScenario = [
      { mediaId: 'image-3', mimeType: 'image/jpeg', expectedFilename: 'image-3.jpg' },
      { mediaId: 'image-4', mimeType: 'image/png', expectedFilename: 'image-4.png' },
      { mediaId: 'image-5', mimeType: 'image/gif', expectedFilename: 'image-5.gif' },
      { mediaId: 'video-6', mimeType: 'application/json', expectedFilename: 'video-6.json' }, // YouTube metadata
    ]
    
    userMediaScenario.forEach(({ mediaId, mimeType, expectedFilename }) => {
      const ext = getExtensionFromMimeType(mimeType)
      const actualFilename = `${mediaId}.${ext}`
      
      console.log(`[Extension Fix Test] Media ${mediaId}: ${actualFilename} (MIME: ${mimeType})`)
      
      // Verify correct filename generation
      expect(actualFilename).toBe(expectedFilename)
      
      // CRITICAL: Should NOT create .bin files for the user's media
      expect(actualFilename).not.toMatch(/\.bin$/)
      
      // SCORM HTML can now find these files correctly
      if (mediaId.startsWith('image-')) {
        expect(actualFilename).toMatch(/\.(jpg|png|gif|svg|webp)$/)
        console.log(`[Extension Fix Test] ✅ ${mediaId} will be found by SCORM HTML`)
      }
    })
    
    console.log('[Extension Fix Test] ✅ User scenario fixed - no more 404 errors!')
  })
  
  it('should handle edge cases gracefully', () => {
    console.log('[Extension Fix Test] 🔍 Testing edge cases')
    
    const edgeCases = [
      { mimeType: '', description: 'empty string' },
      { mimeType: '   ', description: 'whitespace only' },
      { mimeType: 'IMAGE/JPEG', description: 'uppercase MIME type' },
      { mimeType: 'image/jpeg ', description: 'trailing space' },
      { mimeType: ' image/jpeg', description: 'leading space' },
    ]
    
    edgeCases.forEach(({ mimeType, description }) => {
      const result = getExtensionFromMimeType(mimeType)
      console.log(`[Extension Fix Test] Edge case (${description}): "${mimeType}" -> "${result}"`)
      
      // Should handle gracefully without errors
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
    
    // Test case-insensitive handling
    expect(getExtensionFromMimeType('IMAGE/JPEG')).toBe('jpg')
    expect(getExtensionFromMimeType('Image/PNG')).toBe('png')
    
    console.log('[Extension Fix Test] ✅ Edge cases handled correctly')
  })
})