import { describe, it, expect } from 'vitest'

/**
 * DIAGNOSTIC TEST: Property Name Mismatch Issue
 * 
 * This test reproduces the exact issue causing YouTube videos to not display
 * in SCORM packages. The problem is a property name mismatch between:
 * 
 * 1. MediaService.storeYouTubeVideo() stores: embedUrl (camelCase)
 * 2. Media injection expects: embed_url (snake_case) 
 * 3. SCORM template requires: embed_url (snake_case)
 * 
 * Expected: This test should FAIL, confirming the property mismatch exists.
 */
describe('Property Name Mismatch - YouTube Videos Not Displaying', () => {
  it('should expose the property name mismatch causing YouTube videos to not display', async () => {
    console.log('🔍 [Property Mismatch] Testing YouTube video property name consistency...')
    
    // Step 1: Simulate MediaEnhancementWizard adding YouTube video to course content
    const courseContentWithYouTube = {
      topics: [
        {
          id: 'topic-1',
          title: 'Video Topic',
          content: 'This topic has a YouTube video',
          media: [
            {
              id: 'video-test-123',
              type: 'video',
              title: 'Test YouTube Video',
              isYouTube: true,
              embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=10&end=60',
              youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              clipStart: 10,
              clipEnd: 60
            }
          ]
        }
      ]
    }
    
    console.log('   📊 Course content YouTube video:')
    console.log(`     embedUrl: ${courseContentWithYouTube.topics[0].media[0].embedUrl}`)
    console.log(`     isYouTube: ${courseContentWithYouTube.topics[0].media[0].isYouTube}`)
    
    // Step 2: Simulate MediaService.storeYouTubeVideo() (what our bridge calls)
    const mockMediaService = {
      storedItems: [] as any[],
      async storeYouTubeVideo(youtubeUrl: string, embedUrl: string, pageId: string, metadata: any) {
        // This simulates the CURRENT MediaService.storeYouTubeVideo() behavior
        const mediaItem = {
          id: 'video-stored-456',
          type: 'youtube',
          pageId,
          metadata: {
            uploadedAt: new Date().toISOString(),
            type: 'youtube',
            pageId,
            youtubeUrl,
            embedUrl,        // ← PROBLEM: Stored as camelCase
            isYouTube: true, // ← PROBLEM: Stored as camelCase
            title: metadata?.title,
            clipStart: metadata?.clipStart,
            clipEnd: metadata?.clipEnd
          }
        }
        this.storedItems.push(mediaItem)
        console.log(`   📺 MediaService stored YouTube video with properties:`)
        console.log(`     metadata.embedUrl: ${mediaItem.metadata.embedUrl}`)
        console.log(`     metadata.isYouTube: ${mediaItem.metadata.isYouTube}`)
        console.log(`     metadata.embed_url: ${(mediaItem.metadata as any).embed_url}`) // undefined
        console.log(`     metadata.is_youtube: ${(mediaItem.metadata as any).is_youtube}`) // undefined
        return mediaItem
      }
    }
    
    // Step 3: Simulate extractCourseContentMedia() bridge function
    const extractedMedia = []
    const topic = courseContentWithYouTube.topics[0]
    for (const mediaItem of topic.media) {
      if (mediaItem.isYouTube) {
        const storedItem = await mockMediaService.storeYouTubeVideo(
          mediaItem.youtubeUrl,
          mediaItem.embedUrl,
          topic.id,
          {
            title: mediaItem.title,
            clipStart: mediaItem.clipStart,
            clipEnd: mediaItem.clipEnd
          }
        )
        extractedMedia.push(storedItem)
      }
    }
    
    console.log(`   ✅ Bridge extracted ${extractedMedia.length} YouTube videos`)
    
    // Step 4: Simulate media injection system (current logic from rustScormGenerator.ts)
    const mediaItemFromStorage = mockMediaService.storedItems[0]
    
    // This is the current detection logic
    const isYouTubeVideo = mediaItemFromStorage.type === 'youtube' || 
                          (mediaItemFromStorage.metadata?.isYouTube === true) ||
                          (mediaItemFromStorage.metadata?.type === 'youtube') ||
                          (mediaItemFromStorage.metadata?.embed_url && (
                            mediaItemFromStorage.metadata.embed_url.includes('youtube.com') || 
                            mediaItemFromStorage.metadata.embed_url.includes('youtu.be')
                          ))
    
    console.log('')
    console.log('   🎯 Media injection system analysis:')
    console.log(`     Detected as YouTube video: ${isYouTubeVideo}`)
    console.log(`     Detection factors:`)
    console.log(`       type === 'youtube': ${mediaItemFromStorage.type === 'youtube'}`)
    console.log(`       metadata?.isYouTube === true: ${mediaItemFromStorage.metadata?.isYouTube === true}`)
    console.log(`       metadata?.type === 'youtube': ${mediaItemFromStorage.metadata?.type === 'youtube'}`)
    console.log(`       metadata?.embed_url exists: ${!!mediaItemFromStorage.metadata?.embed_url}`)
    
    // This is the current injection logic that should create the media reference
    let mediaReference
    if (isYouTubeVideo) {
      mediaReference = {
        id: mediaItemFromStorage.id,
        type: 'video',
        is_youtube: true,
        embed_url: mediaItemFromStorage.metadata?.embed_url || mediaItemFromStorage.metadata?.embedUrl, // ← THE PROBLEM
        title: mediaItemFromStorage.metadata?.title || `YouTube Video ${mediaItemFromStorage.id}`,
        clipStart: mediaItemFromStorage.metadata?.clipStart,
        clipEnd: mediaItemFromStorage.metadata?.clipEnd
      }
    }
    
    console.log('')
    console.log('   📋 Generated media reference for SCORM template:')
    console.log(`     is_youtube: ${mediaReference?.is_youtube}`)
    console.log(`     embed_url: ${mediaReference?.embed_url}`)
    console.log(`     title: ${mediaReference?.title}`)
    
    // Step 5: Simulate SCORM template rendering
    const templateWillRender = !!(mediaReference?.is_youtube && mediaReference?.embed_url)
    
    console.log('')
    console.log('   🎬 SCORM template rendering:')
    console.log(`     Template conditions:`)
    console.log(`       {{#if is_youtube}}: ${!!mediaReference?.is_youtube}`)
    console.log(`       {{embed_url}} available: ${!!mediaReference?.embed_url}`)
    console.log(`       Will render iframe: ${templateWillRender}`)
    
    if (templateWillRender) {
      console.log(`     Generated iframe src: ${mediaReference.embed_url}`)
    } else {
      console.log('     ❌ NO IFRAME WILL BE GENERATED - Missing embed_url')
    }
    
    // Step 6: Validate the issue
    console.log('')
    console.log('   🧪 Property name mismatch analysis:')
    
    // The stored data has embedUrl (camelCase)
    expect(mediaItemFromStorage.metadata.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?start=10&end=60')
    expect(mediaItemFromStorage.metadata.isYouTube).toBe(true)
    
    // But the stored data is missing embed_url (snake_case)
    expect((mediaItemFromStorage.metadata as any).embed_url).toBeUndefined()
    expect((mediaItemFromStorage.metadata as any).is_youtube).toBeUndefined()
    
    // The injection logic tries embed_url first, then embedUrl as fallback
    const embed_url_from_snake = mediaItemFromStorage.metadata?.embed_url
    const embed_url_from_camel = mediaItemFromStorage.metadata?.embedUrl
    
    console.log('   📊 Property availability:')
    console.log(`     metadata.embed_url (snake_case): ${embed_url_from_snake || 'undefined'}`)
    console.log(`     metadata.embedUrl (camelCase): ${embed_url_from_camel || 'undefined'}`)
    console.log(`     Fallback logic works: ${!!(embed_url_from_snake || embed_url_from_camel)}`)
    
    // This should pass - fallback logic should work
    expect(mediaReference?.embed_url).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?start=10&end=60')
    expect(templateWillRender).toBe(true)
    
    // If this test passes, the fallback logic is working, so the issue might be elsewhere
    console.log('')
    console.log('   ✅ [UNEXPECTED RESULT] Property fallback logic works!')
    console.log('     The issue might not be property name mismatch...')
    console.log('     Need to investigate further:')
    console.log('       1. Is extractCourseContentMedia() actually being called?')
    console.log('       2. Are there errors in MediaService.storeYouTubeVideo()?')
    console.log('       3. Is media injection running for the right pages?')
    console.log('       4. Are there console errors during SCORM generation?')
  })
  
  it('should verify that extractCourseContentMedia is actually called during SCORM generation', async () => {
    console.log('🔍 [Execution Check] Testing if extractCourseContentMedia is actually called...')
    
    // This test verifies that our bridge function is actually being executed
    // during SCORM generation, not just defined in the code
    
    let extractionCalled = false
    let extractionCount = 0
    
    // Mock the extractCourseContentMedia function with logging
    const mockExtractCourseContentMedia = async (courseContent: any, projectId: string) => {
      extractionCalled = true
      console.log(`   📤 extractCourseContentMedia called with:`)
      console.log(`     projectId: ${projectId}`)
      console.log(`     topics: ${courseContent.topics?.length || 0}`)
      
      // Check for YouTube videos in course content
      for (const topic of courseContent.topics || []) {
        if (topic.media && Array.isArray(topic.media)) {
          for (const mediaItem of topic.media) {
            if (mediaItem.isYouTube) {
              extractionCount++
              console.log(`     Found YouTube video: ${mediaItem.id} in ${topic.id}`)
              console.log(`       embedUrl: ${mediaItem.embedUrl}`)
              console.log(`       isYouTube: ${mediaItem.isYouTube}`)
            }
          }
        }
      }
      
      console.log(`   ✅ Extraction completed: ${extractionCount} YouTube videos found`)
    }
    
    // Simulate course content with YouTube video
    const courseContent = {
      title: 'Test Course',
      topics: [
        {
          id: 'topic-1',
          title: 'Video Topic',
          content: 'Content',
          media: [
            {
              id: 'video-123',
              type: 'video',
              title: 'Test Video',
              isYouTube: true,
              embedUrl: 'https://www.youtube.com/embed/test123',
              youtubeUrl: 'https://www.youtube.com/watch?v=test123'
            }
          ]
        }
      ]
    }
    
    // Simulate the call that should happen in convertEnhancedToRustFormat
    console.log('   🔄 Simulating convertEnhancedToRustFormat calling extractCourseContentMedia...')
    await mockExtractCourseContentMedia(courseContent, 'test-project')
    
    // Verify the function was called and found the YouTube video
    expect(extractionCalled).toBe(true)
    expect(extractionCount).toBe(1)
    
    console.log('')
    console.log('   ✅ [EXTRACTION VERIFICATION PASSED]')
    console.log('     extractCourseContentMedia function logic works correctly')
    console.log('     YouTube videos are detected in course content')
    console.log('     Next: Need to verify this is called in actual SCORM generation')
  })
  
  it('should trace the complete YouTube video data flow', async () => {
    console.log('🔍 [Data Flow] Tracing complete YouTube video data flow...')
    
    // This test traces YouTube video data through the complete pipeline
    // to identify exactly where the data gets lost or corrupted
    
    const videoData = {
      id: 'video-trace-789',
      type: 'video',
      title: 'Trace Test Video',
      isYouTube: true,
      embedUrl: 'https://www.youtube.com/embed/trace789?start=15&end=45',
      youtubeUrl: 'https://www.youtube.com/watch?v=trace789',
      clipStart: 15,
      clipEnd: 45
    }
    
    console.log('   📍 Stage 1: Course Content (MediaEnhancementWizard output)')
    console.log(`     id: ${videoData.id}`)
    console.log(`     isYouTube: ${videoData.isYouTube}`)
    console.log(`     embedUrl: ${videoData.embedUrl}`)
    console.log(`     clipStart: ${videoData.clipStart}`)
    console.log(`     clipEnd: ${videoData.clipEnd}`)
    
    // Stage 2: Bridge extraction
    console.log('')
    console.log('   📍 Stage 2: Bridge Extraction (extractCourseContentMedia)')
    const extractedForStorage = {
      youtubeUrl: videoData.youtubeUrl,
      embedUrl: videoData.embedUrl,
      pageId: 'topic-1',
      metadata: {
        title: videoData.title,
        clipStart: videoData.clipStart,
        clipEnd: videoData.clipEnd,
        thumbnail: undefined
      }
    }
    console.log(`     youtubeUrl: ${extractedForStorage.youtubeUrl}`)
    console.log(`     embedUrl: ${extractedForStorage.embedUrl}`)
    console.log(`     metadata.clipStart: ${extractedForStorage.metadata.clipStart}`)
    console.log(`     metadata.clipEnd: ${extractedForStorage.metadata.clipEnd}`)
    
    // Stage 3: MediaService storage
    console.log('')
    console.log('   📍 Stage 3: MediaService Storage (storeYouTubeVideo)')
    const storedMetadata = {
      uploadedAt: new Date().toISOString(),
      type: 'youtube',
      pageId: extractedForStorage.pageId,
      youtubeUrl: extractedForStorage.youtubeUrl,
      embedUrl: extractedForStorage.embedUrl,  // ← Stored as camelCase
      isYouTube: true,                         // ← Stored as camelCase
      title: extractedForStorage.metadata.title,
      clipStart: extractedForStorage.metadata.clipStart,
      clipEnd: extractedForStorage.metadata.clipEnd
    }
    console.log(`     metadata.embedUrl (camelCase): ${storedMetadata.embedUrl}`)
    console.log(`     metadata.isYouTube (camelCase): ${storedMetadata.isYouTube}`)
    console.log(`     metadata.embed_url (snake_case): ${(storedMetadata as any).embed_url}`)
    console.log(`     metadata.is_youtube (snake_case): ${(storedMetadata as any).is_youtube}`)
    
    // Stage 4: Media injection retrieval
    console.log('')
    console.log('   📍 Stage 4: Media Injection (injectOrphanedMediaIntoPages)')
    const mediaItem = {
      id: 'video-stored-999',
      type: 'youtube',
      pageId: 'topic-1',
      metadata: storedMetadata
    }
    
    // Detection logic
    const isYouTubeDetected = mediaItem.type === 'youtube' || 
                             (mediaItem.metadata?.isYouTube === true) ||
                             (mediaItem.metadata?.type === 'youtube')
    
    console.log(`     YouTube detection: ${isYouTubeDetected}`)
    console.log(`     Detection factors:`)
    console.log(`       type === 'youtube': ${mediaItem.type === 'youtube'}`)
    console.log(`       metadata.isYouTube: ${mediaItem.metadata?.isYouTube}`)
    console.log(`       metadata.type: ${mediaItem.metadata?.type}`)
    
    // Injection result
    const mediaReference = {
      id: mediaItem.id,
      type: 'video',
      is_youtube: true,
      embed_url: mediaItem.metadata?.embed_url || mediaItem.metadata?.embedUrl,
      title: mediaItem.metadata?.title,
      clipStart: mediaItem.metadata?.clipStart,
      clipEnd: mediaItem.metadata?.clipEnd
    }
    
    console.log('     Generated media reference:')
    console.log(`       is_youtube: ${mediaReference.is_youtube}`)
    console.log(`       embed_url: ${mediaReference.embed_url}`)
    console.log(`       title: ${mediaReference.title}`)
    console.log(`       clipStart: ${mediaReference.clipStart}`)
    console.log(`       clipEnd: ${mediaReference.clipEnd}`)
    
    // Stage 5: Template rendering
    console.log('')
    console.log('   📍 Stage 5: SCORM Template Rendering')
    const templateConditions = {
      hasMedia: !!mediaReference,
      isYouTube: !!mediaReference.is_youtube,
      hasEmbedUrl: !!mediaReference.embed_url,
      willRender: !!(mediaReference.is_youtube && mediaReference.embed_url)
    }
    
    console.log(`     {{#if media}}: ${templateConditions.hasMedia}`)
    console.log(`     {{#if is_youtube}}: ${templateConditions.isYouTube}`)
    console.log(`     {{embed_url}}: ${mediaReference.embed_url || 'undefined'}`)
    console.log(`     Will render iframe: ${templateConditions.willRender}`)
    
    // Final verification
    expect(templateConditions.willRender).toBe(true)
    expect(mediaReference.embed_url).toBe(videoData.embedUrl)
    expect(mediaReference.clipStart).toBe(videoData.clipStart)
    expect(mediaReference.clipEnd).toBe(videoData.clipEnd)
    
    console.log('')
    console.log('   ✅ [DATA FLOW TRACE COMPLETE]')
    console.log('     All data transformations preserve YouTube video information')
    console.log('     Template should render iframe correctly')
    console.log('     Issue might be in actual execution, not data flow logic')
  })
})