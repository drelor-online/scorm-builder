import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MediaService } from './MediaService'
import { generateRustSCORM } from './rustScormGenerator'
import { FileStorage } from './FileStorage'
import type { CourseSeedData } from '../types/course'
import type { CourseContent, MediaItem } from '../types/project'

/**
 * BEHAVIOR TEST: Media File Extension Mismatch - 404 Errors Fix
 * 
 * This test reproduces the exact 404 errors reported in runtime logs:
 * - /pluginfile.php/7205/mod_scorm/content/221/media/image-3.jpg:1 Failed to load resource: the server responded with a status of 404
 * - image-4.jpg:1 Failed to load resource: the server responded with a status of 404  
 * - image-5.jpg:1 Failed to load resource: the server responded with a status of 404
 * - video-6.txt:1 Failed to load resource: the server responded with a status of 404
 * 
 * ROOT CAUSE: MediaService stores files with .bin extensions but SCORM HTML expects .jpg/.mp4 extensions
 * 
 * This test MUST FAIL before implementing the fix to ensure we're testing the right issue.
 */
describe('Media Extension Mismatch - 404 Errors Reproduction', () => {
  let mediaService: MediaService
  let storage: FileStorage
  
  beforeEach(async () => {
    // Initialize services
    storage = new FileStorage()
    
    // Set up project path to bypass openProject requirement
    ;(storage as any)._currentProjectPath = '/test/test-404-reproduction.scorm'
    ;(storage as any)._currentProjectId = 'test-404-reproduction'
    
    mediaService = new MediaService({ 
      projectId: 'test-404-reproduction',
      fileStorage: storage
    })
    
    // Create a test project with media that would cause 404 errors
    const courseSeedData: CourseSeedData = {
      courseTitle: "Test Course - 404 Reproduction",
      difficulty: 1,
      customTopics: [
        "Topic 1 - Image Test: This topic has an image that should cause 404",
        "Topic 2 - Multiple Images: This topic has multiple images", 
        "Topic 3 - Image and Video: Topic with image and video"
      ],
      template: "How-to Guide" as any,
      templateTopics: []
    }
    
    // Save the project
    await storage.saveCourseSeedData(courseSeedData)
  })
  
  afterEach(async () => {
    // Cleanup - for now just skip since FileStorage doesn't have project-specific deletion
  })
  
  it('should reproduce 404 errors due to MediaService extension mismatch', async () => {
    // Step 1: Store media files that will have extension mismatch
    console.log('📝 [404 Test] Step 1: Storing media files with problematic extensions...')
    
    // Create mock image blobs (these will be stored as .bin by MediaService.getExtension)
    const createMockImageBlob = (name: string): Blob => {
      // Create a simple mock JPEG blob for testing
      const byteArray = new Uint8Array([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, // JPEG header
        0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
        0xFF, 0xD9 // JPEG end marker
      ])
      return new Blob([byteArray], { type: 'image/jpeg' })
    }
    
    // Store images that will cause extension mismatch
    const imageBlob3 = createMockImageBlob('image-3.jpg')
    const imageBlob4 = createMockImageBlob('image-4.jpg') 
    const imageBlob5 = createMockImageBlob('image-5.jpg')
    
    // Store images - MediaService will store these as .bin files
    await mediaService.storeMedia('image-3', 'topic-0', 'image', imageBlob3, {
      title: 'Test Image 3',
      fileName: 'image-3.jpg'
    }, undefined) // progress callback
    
    await mediaService.storeMedia('image-4', 'topic-1', 'image', imageBlob4, {
      title: 'Test Image 4', 
      fileName: 'image-4.jpg'
    }, undefined) // progress callback
    
    await mediaService.storeMedia('image-5', 'topic-2', 'image', imageBlob5, {
      title: 'Test Image 5',
      fileName: 'image-5.jpg'
    }, undefined) // progress callback
    
    // Store YouTube video that will be handled incorrectly
    await mediaService.storeYouTubeVideo(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'topic-2',
      {
        title: 'Test YouTube Video',
        source: 'youtube',
        isYouTube: true
      }
    )
    
    console.log('📝 [404 Test] Step 2: Generating SCORM package...')
    
    // Step 2: Generate SCORM package
    const courseSeedData = await storage.getCourseSeedData()
    if (!courseSeedData) {
      throw new Error('Failed to retrieve course seed data')
    }
    
    // Create course content from seed data  
    const courseContent: CourseContent = {
      welcomeMessage: "Welcome to test course",
      objectives: ["Test objective 1", "Test objective 2"],
      pages: [
        {
          id: 'topic-0',
          title: 'Topic 1 - Image Test',
          content: 'This topic has an image that should cause 404',
          imageUrl: 'image-3.jpg', // This will cause 404 - HTML expects .jpg but storage has .bin
          audioFile: 'audio-2',
          knowledgeCheck: {
            question: "Test question?",
            type: "multiple-choice" as const,
            options: ["A", "B", "C"],
            correctAnswer: "A"
          }
        },
        {
          id: 'topic-1', 
          title: 'Topic 2 - Multiple Images',
          content: 'This topic has multiple images',
          imageUrl: 'image-4.jpg', // Another 404 case
          audioFile: 'audio-3',
          knowledgeCheck: {
            question: "Another test?",
            type: "true-false" as const,
            correctAnswer: "true"
          }
        },
        {
          id: 'topic-2',
          title: 'Topic 3 - Image and Video', 
          content: 'Topic with image and video',
          imageUrl: 'image-5.jpg', // Third 404 case
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // This will be stored as video-6.bin but HTML expects video-6.txt
          audioFile: 'audio-4',
          knowledgeCheck: {
            question: "Fill in the blank: The sky is ____",
            type: "fill-in-the-blank" as const,
            correctAnswer: "blue"
          }
        }
      ]
    }
    
    const result = await generateRustSCORM(courseContent, 'test-project')
    
    console.log('📝 [404 Test] Step 3: Analyzing generated SCORM package for extension mismatches...')
    
    // Step 3: Analyze the results to detect extension mismatch
    expect(result.success).toBe(true)
    expect(result.zipData).toBeDefined()
    
    // Step 4: Extract and analyze ZIP contents to detect the mismatch
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    const zipContents = await zip.loadAsync(result.zipData!)
    
    // Get list of media files in ZIP
    const mediaFiles: string[] = []
    zip.folder('media')?.forEach((relativePath, file) => {
      if (!file.dir) {
        mediaFiles.push(relativePath)
      }
    })
    
    console.log('📁 [404 Test] Media files found in ZIP:', mediaFiles)
    
    // Step 5: Check for the specific extension mismatch that causes 404s
    // The bug: MediaService stores as .bin but SCORM HTML expects .jpg/.mp4/.txt
    
    // Check if images are stored as .bin (the bug)
    const hasBinFiles = mediaFiles.some(f => f.endsWith('.bin'))
    console.log(`🔍 [404 Test] Found .bin files in ZIP: ${hasBinFiles}`)
    
    // Get the HTML content to see what extensions it expects
    const htmlFiles = ['welcome.html', 'objectives.html', 'topic-0.html', 'topic-1.html', 'topic-2.html']
    let expectedImagePaths: string[] = []
    
    for (const htmlFile of htmlFiles) {
      const htmlZipFile = zip.file(htmlFile)
      if (htmlZipFile) {
        const htmlContent = await htmlZipFile.async('string')
        // Look for media/ references in HTML
        const mediaMatches = htmlContent.match(/media\/[^"'\s]+/g) || []
        expectedImagePaths.push(...mediaMatches)
      }
    }
    
    console.log('📄 [404 Test] Media paths expected by HTML:', expectedImagePaths)
    
    // Step 6: Verify the mismatch exists (this test MUST FAIL before fix)
    // HTML expects: media/image-3.jpg, media/image-4.jpg, media/image-5.jpg, media/video-6.txt
    // ZIP contains: image-3.bin, image-4.bin, image-5.bin, video-6.bin (or similar)
    
    const expectedImages = [
      'media/image-3.jpg',
      'media/image-4.jpg', 
      'media/image-5.jpg'
    ]
    
    const expectedVideo = 'media/video-6.txt' // or similar extension
    
    // Check for each expected image
    for (const expectedPath of expectedImages) {
      const fileName = expectedPath.replace('media/', '')
      const actualFileExists = mediaFiles.includes(fileName)
      
      console.log(`🔍 [404 Test] Expected: ${expectedPath}, Actual file exists: ${actualFileExists}`)
      
      // THIS ASSERTION SHOULD FAIL - proving the extension mismatch bug exists
      expect(actualFileExists, `Expected media file ${fileName} should exist in ZIP but doesn't due to extension mismatch`).toBe(true)
    }
    
    // Additional check: if HTML references .jpg files but ZIP contains .bin files, that's the bug
    const htmlReferencesJpg = expectedImagePaths.some(path => path.includes('.jpg'))
    const zipContainsBin = mediaFiles.some(f => f.includes('.bin'))
    
    if (htmlReferencesJpg && zipContainsBin) {
      console.error('🚨 [404 Test] EXTENSION MISMATCH DETECTED:')
      console.error('   HTML references .jpg files but ZIP contains .bin files')
      console.error('   This will cause 404 errors in SCORM runtime')
      
      // THIS SHOULD FAIL - proving the bug exists
      expect(false, 'Extension mismatch detected: HTML expects .jpg but ZIP contains .bin files').toBe(true)
    }
  })
  
  it('should detect YouTube video handling issues', async () => {
    console.log('📝 [YouTube Test] Testing YouTube video storage issues...')
    
    // Store a YouTube video
    await mediaService.storeYouTubeVideo(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ', 
      'topic-2',
      {
        title: 'Test YouTube Video',
        source: 'youtube',
        isYouTube: true
      }
    )
    
    // Generate SCORM
    const courseSeedData = await storage.getCourseSeedData()
    if (!courseSeedData) throw new Error('No course seed data')
    
    const courseContent: CourseContent = {
      welcomeMessage: "Welcome",
      objectives: ["Objective 1"],
      pages: [{
        id: 'topic-2',
        title: 'YouTube Test Topic',
        content: 'This topic has a YouTube video',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        knowledgeCheck: {
          question: 'Test?',
          type: 'true-false' as const,
          correctAnswer: 'true'
        }
      }]
    }
    
    const result = await generateRustSCORM(courseContent, 'test-project')
    expect(result.success).toBe(true)
    
    // Check if YouTube video is being treated as a binary file (the bug)
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    await zip.loadAsync(result.zipData!)
    
    const mediaFiles: string[] = []
    zip.folder('media')?.forEach((relativePath, file) => {
      if (!file.dir) {
        mediaFiles.push(relativePath)
      }
    })
    
    // Check if there's a video-6.bin or video-6.txt file (indicating wrong handling)
    const hasVideoFile = mediaFiles.some(f => f.startsWith('video-6.'))
    console.log(`🔍 [YouTube Test] Found video file in media folder: ${hasVideoFile}`)
    
    // YouTube videos should NOT be stored as files in the media folder
    // They should be handled as embeds in HTML
    if (hasVideoFile) {
      console.error('🚨 [YouTube Test] YOUTUBE HANDLING BUG:')
      console.error('   YouTube video stored as binary file instead of embed')
      console.error('   Found video files:', mediaFiles.filter(f => f.startsWith('video-')))
      
      // THIS SHOULD FAIL - YouTube videos shouldn't be stored as binary files
      expect(false, 'YouTube video incorrectly stored as binary file instead of embed').toBe(true)
    }
  })
})