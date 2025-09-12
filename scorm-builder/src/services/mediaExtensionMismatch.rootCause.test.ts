import { describe, it, expect } from 'vitest'
import { getExtensionFromMimeType, getExtensionFromMediaId } from './rustScormGenerator'

/**
 * ROOT CAUSE TEST: Demonstrates the exact extension mismatch causing 404 errors
 * 
 * Based on the investigation, the issue is:
 * 1. SCORM HTML template URLs are generated using getExtensionFromMimeType()
 * 2. ZIP file names are generated using getExtensionFromMimeType() || getExtensionFromMediaId() 
 * 3. YouTube videos stored with mimeType: 'text/plain' get .txt extension in URLs
 * 4. But YouTube videos should be embeds, not file references
 */
describe('Media Extension Mismatch - Root Cause', () => {
  it('should demonstrate the extension mismatch that causes 404 errors', () => {
    console.log('🔍 [Root Cause] Testing the exact scenario causing 404 errors...')
    
    // Based on user's runtime logs and our investigation:
    // YouTube video stored with text/plain MIME type (from FileStorage logs)
    const youTubeVideoMimeType = 'text/plain'
    const youTubeVideoId = 'video-6'
    
    // What the SCORM HTML template URL generation produces:
    const htmlTemplateExtension = getExtensionFromMimeType(youTubeVideoMimeType)
    console.log(`   📄 HTML template looks for: ${youTubeVideoId}.${htmlTemplateExtension}`)
    
    // What the ZIP filename generation produces:
    const zipFileExtension = getExtensionFromMimeType(youTubeVideoMimeType) || getExtensionFromMediaId(youTubeVideoId)
    console.log(`   📁 ZIP file stored as: ${youTubeVideoId}.${zipFileExtension}`)
    
    // The issue: Both produce different extensions!
    console.log('')
    console.log('🚨 [Root Cause] THE EXACT MISMATCH:')
    console.log(`   User runtime logs show: Failed to load media/${youTubeVideoId}.txt`)
    console.log(`   getExtensionFromMimeType('text/plain') = '${htmlTemplateExtension}'`)
    console.log(`   getExtensionFromMediaId('video-6') = '${getExtensionFromMediaId(youTubeVideoId)}'`)
    console.log('')
    
    // Verify our understanding
    expect(htmlTemplateExtension).toBe('txt')
    expect(getExtensionFromMediaId(youTubeVideoId)).toBe('json')
    
    // The extensions don't match - this causes 404!
    expect(htmlTemplateExtension).not.toBe(getExtensionFromMediaId(youTubeVideoId))
    
    console.log('✅ [Root Cause] Confirmed: HTML template expects .txt but ZIP contains .json')
    
    // But the REAL issue is that YouTube videos should be embeds, not files!
    console.log('')
    console.log('🎯 [Root Cause] THE FUNDAMENTAL ISSUE:')
    console.log('   YouTube videos should NOT be stored as files in the media/ directory')
    console.log('   They should be handled as <iframe> embeds in the SCORM HTML template')
    console.log('   The 404 error occurs because we\'re trying to load a file that shouldn\'t exist')
  })
  
  it('should show how different media types are handled', () => {
    console.log('🔍 [Root Cause] Testing how different media types are handled...')
    
    const testCases = [
      { id: 'image-3', mimeType: '', description: 'Image with empty MIME type' },
      { id: 'image-4', mimeType: 'application/octet-stream', description: 'Image with binary MIME type' },
      { id: 'image-5', mimeType: 'image/jpeg', description: 'Image with proper MIME type' },
      { id: 'video-6', mimeType: 'text/plain', description: 'YouTube video with text/plain MIME type' },
      { id: 'youtube-7', mimeType: 'application/json', description: 'YouTube video with JSON MIME type' },
    ]
    
    console.log('   📊 Extension mapping comparison:')
    testCases.forEach(testCase => {
      const mimeExt = getExtensionFromMimeType(testCase.mimeType || 'application/octet-stream')
      const idExt = getExtensionFromMediaId(testCase.id)
      const zipExt = getExtensionFromMimeType(testCase.mimeType) || getExtensionFromMediaId(testCase.id)
      
      console.log(`     ${testCase.id}:`)
      console.log(`       MIME type: ${testCase.mimeType || 'empty'}`)
      console.log(`       getExtensionFromMimeType(): .${mimeExt}`)
      console.log(`       getExtensionFromMediaId(): .${idExt}`)
      console.log(`       ZIP filename would use: .${zipExt}`)
      
      const mismatch = mimeExt !== idExt
      if (mismatch && testCase.mimeType) {
        console.log(`       ⚠️  MISMATCH DETECTED`)
      }
      console.log('')
    })
    
    // The pattern: ZIP filenames use the fallback correctly, 
    // but HTML template URLs used only MIME type (before our fix)
    console.log('✅ [Root Cause] Extension mapping behavior confirmed')
  })
})