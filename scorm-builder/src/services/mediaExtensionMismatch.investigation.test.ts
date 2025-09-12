import { describe, it, expect, beforeEach } from 'vitest'
import { MediaService } from './MediaService'
import { FileStorage } from './FileStorage'
import { diagnoseMedieServiceForProject } from '../utils/mediaServiceDiagnostics'

/**
 * INVESTIGATION TEST: Dig deeper into the 404 extension mismatch
 * 
 * Since the simple test showed MediaService.getExtension() works correctly,
 * let's investigate what actually happens when we store media and generate SCORM.
 */
describe('Media Extension Mismatch - Deep Investigation', () => {
  let mediaService: MediaService
  let storage: FileStorage
  
  beforeEach(async () => {
    storage = new FileStorage()
    ;(storage as any)._currentProjectPath = '/test/investigation.scorm'
    ;(storage as any)._currentProjectId = 'investigation'
    
    mediaService = new MediaService({ 
      projectId: 'investigation',
      fileStorage: storage
    })
  })
  
  it('should investigate what happens when we actually store media files', async () => {
    console.log('🔍 [Investigation] Testing actual media storage behavior...')
    
    // Create a simple mock blob
    const createMockBlob = (name: string, type: string): Blob => {
      const data = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46])
      return new Blob([data], { type })
    }
    
    try {
      // Store an image with no MIME type (problematic case)
      console.log('   Storing image-3 with empty MIME type...')
      const imageBlob = createMockBlob('image-3.jpg', '')
      await mediaService.storeMedia('image-3', 'topic-0', 'image', imageBlob, {
        title: 'Test Image 3',
        fileName: 'image-3.jpg'
      })
      
      // Store an image with binary MIME type (another problematic case)  
      console.log('   Storing image-4 with application/octet-stream MIME type...')
      const binaryBlob = createMockBlob('image-4.jpg', 'application/octet-stream')
      await mediaService.storeMedia('image-4', 'topic-1', 'image', binaryBlob, {
        title: 'Test Image 4',
        fileName: 'image-4.jpg'
      })
      
      // Store a YouTube video (should not be stored as file)
      console.log('   Storing YouTube video...')
      await mediaService.storeYouTubeVideo(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://www.youtube.com/embed/dQw4w9WgXcQ', 
        'topic-2',
        {
          title: 'Test YouTube Video'
        }
      )
      
      console.log('   ✅ All media stored successfully')
      
      // Now let's check what was actually stored
      console.log('')
      console.log('🔍 [Investigation] Checking what was actually stored...')
      
      // Get all media from MediaService
      const allMedia = await mediaService.getAllMedia()
      console.log(`   Found ${allMedia.length} media items:`)
      
      allMedia.forEach((item, index) => {
        console.log(`     ${index + 1}. ID: ${item.id}, Type: ${item.type}`)
        console.log(`        Metadata: ${JSON.stringify(item.metadata, null, 8)}`)
        if (item.metadata?.fileName) {
          console.log(`        File Name: ${item.metadata.fileName}`)
        }
        if (item.metadata?.originalName) {
          console.log(`        Original Name: ${item.metadata.originalName}`)
        }
      })
      
      // Run MediaService diagnostics
      console.log('')
      console.log('🔍 [Investigation] Running MediaService diagnostics...')
      const diagnostic = await diagnoseMedieServiceForProject('investigation')
      
      if (diagnostic.errors.length > 0) {
        console.log('   ⚠️  Diagnostic errors found:')
        diagnostic.errors.forEach(error => console.log(`     - ${error}`))
      }
      
      console.log(`   📊 Total media: ${diagnostic.totalMedia}`)
      console.log(`   📊 By type:`, diagnostic.mediaByType)
      
      // The key question: what filenames would be generated for SCORM?
      console.log('')
      console.log('🎯 [Investigation] What filenames would be generated for SCORM ZIP?')
      
      allMedia.forEach(item => {
        let expectedZipFileName = 'unknown'
        
        if (item.metadata?.fileName) {
          expectedZipFileName = item.metadata.fileName
        } else if (item.metadata?.originalName) {
          expectedZipFileName = item.metadata.originalName
        } else {
          // This is where we might find the issue
          const getExtension = (mediaService as any).getExtension.bind(mediaService)
          const extension = getExtension(item.type, item.metadata?.mimeType || '')
          expectedZipFileName = `${item.id}.${extension}`
        }
        
        console.log(`     ${item.id} -> ZIP file: ${expectedZipFileName}`)
      })
      
      // Test our hypothesis about the issue
      const imageItems = allMedia.filter(item => item.type === 'image')
      const videoItems = allMedia.filter(item => item.type === 'video' || item.type === 'youtube')
      
      expect(imageItems.length, 'Should have stored image items').toBeGreaterThan(0)
      expect(videoItems.length, 'Should have stored YouTube video').toBeGreaterThan(0)
      
      // Check that images have proper extensions
      imageItems.forEach(item => {
        const fileName = item.metadata?.fileName || item.metadata?.originalName || `${item.id}.unknown`
        console.log(`   🔍 Image ${item.id} filename: ${fileName}`)
        
        // This should pass if MediaService is working correctly
        expect(fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png'), 
          `Image ${item.id} should have proper image extension, got: ${fileName}`).toBe(true)
      })
      
      console.log('')
      console.log('✅ [Investigation] Media storage investigation completed')
      
    } catch (error) {
      console.error('❌ [Investigation] Media storage failed:', error)
      throw error
    }
  })
  
  it('should check if the issue is in filename vs ID mapping', async () => {
    console.log('🔍 [Investigation] Testing filename vs ID mapping issue...')
    
    // The user's logs show:
    // - SCORM HTML looks for: image-3.jpg, image-4.jpg, image-5.jpg, video-6.txt
    // - But ZIP might contain different filenames
    
    // Let's simulate the SCORM generation process
    const mockCourseContent = {
      welcomeMessage: "Welcome",
      objectives: ["Objective 1"],
      pages: [
        {
          id: 'topic-0',
          title: 'Topic 1',
          content: 'Content with image',
          imageUrl: 'image-3.jpg', // This is what SCORM HTML will look for
          audioFile: 'audio-2'
        },
        {
          id: 'topic-1',
          title: 'Topic 2', 
          content: 'Content with image',
          imageUrl: 'image-4.jpg', // This is what SCORM HTML will look for
          audioFile: 'audio-3'
        },
        {
          id: 'topic-2',
          title: 'Topic 3',
          content: 'Content with video',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // This becomes video-6
          audioFile: 'audio-4'
        }
      ]
    }
    
    console.log('   📄 SCORM HTML will look for these files:')
    mockCourseContent.pages.forEach(page => {
      if (page.imageUrl) {
        console.log(`     - ${page.imageUrl} (for ${page.id})`)
      }
      if (page.videoUrl) {
        // Video URLs get converted to media IDs during SCORM generation
        // This is likely where video-6.txt comes from
        console.log(`     - video-6.??? (for ${page.videoUrl} in ${page.id})`)
      }
    })
    
    // Check what the rustScormGenerator functions would produce
    const getExtensionFromMediaId = (mediaId: string): string => {
      // Copy the actual function logic
      if (mediaId.startsWith('audio-')) return 'mp3'
      if (mediaId.startsWith('caption-')) return 'vtt'
      if (mediaId.startsWith('image-')) return 'jpg'
      if (mediaId.startsWith('video-')) {
        console.warn(`Video ID "${mediaId}" should be handled as YouTube embed, not file`)
        return 'json' // But maybe this gets overridden somewhere?
      }
      if (mediaId.startsWith('youtube-')) return 'json'
      console.warn(`Unknown media ID pattern "${mediaId}", defaulting to .bin`)
      return 'bin'
    }
    
    console.log('')
    console.log('   🧮 What rustScormGenerator.getExtensionFromMediaId() would return:')
    const testIds = ['image-3', 'image-4', 'image-5', 'video-6', 'youtube-6']
    testIds.forEach(id => {
      const ext = getExtensionFromMediaId(id)
      console.log(`     ${id} -> .${ext}`)
    })
    
    // THE SMOKING GUN: video-6 should return .json, but the user sees .txt
    // This suggests there's another layer or the SCORM template is hard-coded
    const video6Extension = getExtensionFromMediaId('video-6')
    console.log('')
    console.log(`🎯 [Investigation] Key finding: video-6 should get .${video6Extension}`)
    console.log(`   But user runtime logs show: video-6.txt`)
    console.log(`   This suggests either:`)
    console.log(`     1. SCORM template has hard-coded .txt extension`)
    console.log(`     2. There's another extension mapping layer`)
    console.log(`     3. The video ID is being processed differently`)
    
    expect(video6Extension).toBe('json')
    
    console.log('✅ [Investigation] Filename mapping investigation completed')
  })
})