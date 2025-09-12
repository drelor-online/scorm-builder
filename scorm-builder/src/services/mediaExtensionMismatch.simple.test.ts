import { describe, it, expect } from 'vitest'
import { MediaService } from './MediaService'
import { FileStorage } from './FileStorage'
import type { CourseSeedData } from '../types/course'

/**
 * SIMPLE TEST: Demonstrates the core media extension mismatch issue
 * 
 * This test demonstrates the fundamental problem where:
 * 1. MediaService.getExtension() defaults to '.bin' for files without clear MIME type
 * 2. SCORM HTML templates expect specific extensions like '.jpg' for images
 * 3. This mismatch causes 404 errors in the actual SCORM packages
 * 
 * This test MUST FAIL before implementing the fix.
 */
describe('MediaService Extension Mismatch - Core Issue', () => {
  it('should demonstrate MediaService storing images with .bin extension instead of proper extensions', () => {
    // Create MediaService for testing
    const storage = new FileStorage()
    ;(storage as any)._currentProjectPath = '/test/test-extension-mismatch.scorm'
    ;(storage as any)._currentProjectId = 'test-extension-mismatch'
    
    const mediaService = new MediaService({ 
      projectId: 'test-extension-mismatch',
      fileStorage: storage
    })
    
    // Get the private getExtension method for testing
    const getExtension = (mediaService as any).getExtension.bind(mediaService)
    
    // Test the core issue: MediaService defaults to .bin for unknown MIME types
    console.log('🔍 [Extension Test] Testing MediaService.getExtension() behavior...')
    
    // Case 1: Image with clear JPEG MIME type - should work correctly
    const jpegExtension = getExtension('image', 'image/jpeg')
    console.log(`   Image with 'image/jpeg' MIME type gets extension: .${jpegExtension}`)
    expect(jpegExtension).toBe('jpg')
    
    // Case 2: Image with unknown/empty MIME type - THE BUG
    const unknownImageExtension = getExtension('image', '')
    console.log(`   Image with empty MIME type gets extension: .${unknownImageExtension}`)
    
    // Case 3: Image with generic binary MIME type - THE BUG
    const binaryImageExtension = getExtension('image', 'application/octet-stream')
    console.log(`   Image with 'application/octet-stream' MIME type gets extension: .${binaryImageExtension}`)
    
    // Case 4: Video with YouTube - should not be stored as file
    const youtubeExtension = getExtension('youtube', '')
    console.log(`   YouTube video gets extension: .${youtubeExtension}`)
    
    // Case 5: Unknown media type - defaults to .bin
    const unknownExtension = getExtension('unknown' as any, '')
    console.log(`   Unknown media type gets extension: .${unknownExtension}`)
    
    console.log('')
    console.log('🚨 [Extension Test] THE CORE ISSUE:')
    console.log('   When MediaService encounters images without clear MIME types,')
    console.log('   it should default to appropriate extensions based on MediaType.')
    console.log('   Currently:')
    console.log(`     - Images with empty MIME type get: .${unknownImageExtension}`)
    console.log(`     - Images with binary MIME type get: .${binaryImageExtension}`)
    console.log('   Expected:')
    console.log('     - Images should get: .jpg (default for images)')
    console.log('')
    console.log('   This mismatch causes SCORM HTML to look for .jpg files')
    console.log('   while the ZIP contains .bin files, resulting in 404 errors.')
    
    // These assertions SHOULD FAIL before the fix is implemented
    // demonstrating the core issue
    
    // Image with empty MIME type should get .jpg, not .bin
    expect(unknownImageExtension, 'Images with empty MIME type should get .jpg extension, not .bin').toBe('jpg')
    
    // Image with binary MIME type should still get .jpg (since we know it's an image)
    expect(binaryImageExtension, 'Images with application/octet-stream should get .jpg extension when MediaType is image').toBe('jpg')
  })
  
  it('should demonstrate the filename generation issue in MediaService', () => {
    // This test shows how filenames are generated and stored
    const storage = new FileStorage()
    ;(storage as any)._currentProjectPath = '/test/test-filename.scorm'
    ;(storage as any)._currentProjectId = 'test-filename'
    
    const mediaService = new MediaService({ 
      projectId: 'test-filename',
      fileStorage: storage
    })
    
    // Get the private getExtension method for testing
    const getExtension = (mediaService as any).getExtension.bind(mediaService)
    
    // Simulate how MediaService generates filenames
    const simulateFilename = (mediaId: string, mediaType: string, mimeType: string) => {
      const extension = getExtension(mediaType, mimeType)
      return `${mediaId}.${extension}`
    }
    
    console.log('🔍 [Filename Test] Testing how MediaService generates filenames...')
    
    // Test cases that would cause 404s
    const image3Filename = simulateFilename('image-3', 'image', '')
    const image4Filename = simulateFilename('image-4', 'image', 'application/octet-stream')
    const image5Filename = simulateFilename('image-5', 'image', '')
    const video6Filename = simulateFilename('video-6', 'youtube', '')
    
    console.log(`   image-3 with empty MIME type -> stored as: ${image3Filename}`)
    console.log(`   image-4 with binary MIME type -> stored as: ${image4Filename}`)
    console.log(`   image-5 with empty MIME type -> stored as: ${image5Filename}`)
    console.log(`   video-6 (YouTube) -> stored as: ${video6Filename}`)
    
    console.log('')
    console.log('🎯 [Filename Test] SCORM HTML expectations vs MediaService storage:')
    console.log('   SCORM HTML expects: image-3.jpg, image-4.jpg, image-5.jpg')
    console.log(`   MediaService stores: ${image3Filename}, ${image4Filename}, ${image5Filename}`)
    console.log('')
    console.log('   This filename mismatch is the ROOT CAUSE of the 404 errors!')
    
    // These assertions demonstrate the issue - they SHOULD FAIL before fix
    expect(image3Filename, 'image-3 should be stored as image-3.jpg').toBe('image-3.jpg')
    expect(image4Filename, 'image-4 should be stored as image-4.jpg').toBe('image-4.jpg')
    expect(image5Filename, 'image-5 should be stored as image-5.jpg').toBe('image-5.jpg')
    
    // YouTube videos shouldn't be stored as files at all, but if they are,
    // they shouldn't get .bin extensions
    expect(video6Filename, 'YouTube videos should not be stored as .bin files').not.toContain('.bin')
  })
})