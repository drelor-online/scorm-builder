/**
 * Behavior test for media extension consistency issue
 * 
 * This test reproduces the exact issue where:
 * 1. MediaService stores files with .bin extensions
 * 2. SCORM generator expects .jpg extensions  
 * 3. Result: 404 errors in SCORM packages
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MediaService } from './MediaService'
import { convertToRustFormat } from './rustScormGenerator'
import type { CourseContent } from '../types/project'

describe('Media Extension Consistency Fix', () => {
  const PROJECT_ID = '1756944000180'
  
  it('should store and retrieve image files with correct extensions not bin', async () => {
    console.log('[EXTENSION TEST] 🔍 Testing image file extension consistency')
    
    // Create a JPEG image blob
    const jpegBlob = new Blob(['fake-jpeg-data'], { type: 'image/jpeg' })
    const jpegFile = new File([jpegBlob], 'test-image.jpg', { type: 'image/jpeg' })
    
    // Create a PNG image blob  
    const pngBlob = new Blob(['fake-png-data'], { type: 'image/png' })
    const pngFile = new File([pngBlob], 'test-image.png', { type: 'image/png' })
    
    const { createMediaService } = await import('./MediaService')
    const mediaService = createMediaService(PROJECT_ID)
    
    // Store JPEG image
    const jpegMedia = await mediaService.storeMedia(jpegFile, 'page1', 'image')
    console.log('[EXTENSION TEST] 📸 Stored JPEG:', {
      id: jpegMedia.id,
      fileName: jpegMedia.fileName,
      mimeType: jpegMedia.metadata.mimeType
    })
    
    // Store PNG image
    const pngMedia = await mediaService.storeMedia(pngFile, 'page1', 'image')  
    console.log('[EXTENSION TEST] 📸 Stored PNG:', {
      id: pngMedia.id,
      fileName: pngMedia.fileName,
      mimeType: pngMedia.metadata.mimeType
    })
    
    // CRITICAL TEST: Filenames should have correct extensions, NOT .bin
    expect(jpegMedia.fileName).toMatch(/\.(jpg|jpeg)$/)
    expect(jpegMedia.fileName).not.toMatch(/\.bin$/)
    expect(pngMedia.fileName).toMatch(/\.png$/)
    expect(pngMedia.fileName).not.toMatch(/\.bin$/)
    
    // Verify MIME types are preserved
    expect(jpegMedia.metadata.mimeType).toBe('image/jpeg')
    expect(pngMedia.metadata.mimeType).toBe('image/png')
    
    console.log('[EXTENSION TEST] ✅ Images stored with correct extensions')
  })
  
  it('should generate SCORM with matching file extensions', async () => {
    console.log('[EXTENSION TEST] 📦 Testing SCORM generation extension consistency')
    
    // Simple course content with media
    const courseContent: CourseContent = {
      welcome: { 
        heading: 'Welcome',
        media: [{ id: 'image-3', type: 'image', url: 'image-3', title: 'Test Image' }]
      },
      objectives: { heading: 'Learning Objectives' },
      topics: [{
        heading: 'Topic 1',
        media: [
          { id: 'image-4', type: 'image', url: 'image-4', title: 'Topic Image' },
          { id: 'video-6', type: 'video', url: 'https://www.youtube.com/watch?v=test', title: 'YouTube Video' }
        ]
      }]
    }
    
    try {
      // Convert to Rust format - this is where the extension mismatch occurs
      const result = await convertToRustFormat(courseContent, PROJECT_ID)
      
      console.log('[EXTENSION TEST] 📊 SCORM conversion result:')
      console.log(`- Total mediaFiles: ${result.mediaFiles.length}`)
      result.mediaFiles.forEach(file => {
        console.log(`  - ${file.filename}`)
      })
      
      // CRITICAL TESTS: Check for extension consistency issues
      const binFiles = result.mediaFiles.filter(f => f.filename.endsWith('.bin'))
      const imageFiles = result.mediaFiles.filter(f => f.filename.match(/\.(jpg|jpeg|png|svg)$/))
      const videoFiles = result.mediaFiles.filter(f => f.filename.match(/\.(mp4|webm)$/))
      
      console.log('[EXTENSION TEST] 📋 File extension analysis:')
      console.log(`  - .bin files: ${binFiles.length} (should be 0)`) 
      console.log(`  - Image files: ${imageFiles.length}`)
      console.log(`  - Video files: ${videoFiles.length} (should be 0 for YouTube)`)
      
      // EXPECTATIONS for fixed system:
      // - No .bin files should exist (images should have proper extensions)
      // - YouTube videos should not appear as files (should be embeds)
      // - Image files should have proper extensions based on MIME type
      
      // Before fix: This will fail because we get .bin files
      // After fix: This should pass with proper extensions
      expect(binFiles.length).toBe(0) // No .bin files allowed
      expect(imageFiles.length).toBeGreaterThan(0) // Should have proper image files
      expect(videoFiles.length).toBe(0) // YouTube should not be files
      
      console.log('[EXTENSION TEST] ✅ SCORM generation uses correct extensions')
      
    } catch (error) {
      console.error('[EXTENSION TEST] ❌ SCORM conversion failed:', error)
      throw error
    }
  })
  
  it('should demonstrate the current broken state before fix', async () => {
    console.log('[EXTENSION TEST] 🚨 Demonstrating current broken behavior')
    
    // This test documents the current broken state
    // It should initially PASS (showing the problem exists)  
    // After fixes, this test should FAIL (showing problem is resolved)
    
    const courseContent: CourseContent = {
      welcome: { heading: 'Welcome' },
      objectives: { heading: 'Learning Objectives' },
      topics: [{
        heading: 'Topic 1',
        media: [{ id: 'image-3', type: 'image', url: 'image-3', title: 'Test Image' }]
      }]
    }
    
    const result = await convertToRustFormat(courseContent, PROJECT_ID)
    const binFiles = result.mediaFiles.filter(f => f.filename.endsWith('.bin'))
    
    console.log('[EXTENSION TEST] 📊 Current state analysis:')
    console.log(`- .bin files found: ${binFiles.length}`)
    if (binFiles.length > 0) {
      console.log('🚨 PROBLEM CONFIRMED: Files stored with .bin extensions')
      binFiles.forEach(file => console.log(`  - ${file.filename}`))
    }
    
    // This test DEMONSTRATES the problem - it should pass initially
    // showing that .bin files are incorrectly being created
    // TODO: Change this expectation after implementing the fix
    expect(binFiles.length).toBeGreaterThan(0) // Current broken state
    
    console.log('[EXTENSION TEST] 📝 Problem documented for fixing')
  })
})