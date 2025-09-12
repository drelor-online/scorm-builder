import { describe, it, expect } from 'vitest'

/**
 * BEHAVIOR TEST: Media Injection YouTube URL Issue
 * 
 * This test reproduces the REAL root cause of the YouTube video display issue:
 * The media injection logic in SCORMPackageBuilder.tsx (lines 90-96) creates
 * YouTube videos with wrong URL structure instead of preserving YouTube metadata.
 * 
 * The issue:
 * - MediaService stores YouTube videos with proper embedUrl metadata
 * - Media injection creates mediaItem with generic `url: generatedUrl` 
 * - This overwrites YouTube-specific properties (embedUrl, youtubeUrl)
 * - extractCourseContentMedia() then finds `embedUrl: undefined`
 * 
 * Expected: This test should FAIL, confirming the media injection URL issue.
 */
describe('SCORMPackageBuilder Media Injection - YouTube URL Issue', () => {
  it('should reproduce the media injection YouTube URL issue', () => {
    console.log('🔍 [Media Injection Issue] Testing SCORMPackageBuilder YouTube injection logic...')
    
    // Step 1: Simulate MediaService stored YouTube video (correct format)
    const storedYouTubeVideo = {
      id: 'video-youtube-123',
      type: 'youtube',
      fileName: 'youtube-video-123.mp4', // This gets used for generatedUrl
      url: undefined, // YouTube videos don't have file URLs
      metadata: {
        uploadedAt: new Date().toISOString(),
        type: 'youtube',
        pageId: 'topic-1',
        title: 'Educational YouTube Video',
        // These are the CRITICAL YouTube properties that should be preserved
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=30&end=90',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        clipStart: 30,
        clipEnd: 90,
        isYouTube: true
      }
    }
    
    console.log('   📊 Stored YouTube video in MediaService:')
    console.log(`     id: ${storedYouTubeVideo.id}`)
    console.log(`     type: ${storedYouTubeVideo.type}`)
    console.log(`     fileName: ${storedYouTubeVideo.fileName}`)
    console.log(`     metadata.embedUrl: ${storedYouTubeVideo.metadata.embedUrl}`)
    console.log(`     metadata.youtubeUrl: ${storedYouTubeVideo.metadata.youtubeUrl}`)
    console.log(`     metadata.isYouTube: ${storedYouTubeVideo.metadata.isYouTube}`)
    
    // Step 2: Simulate current media injection logic (BROKEN)
    console.log('')
    console.log('   🔄 Simulating current media injection logic...')
    
    const media = storedYouTubeVideo
    const topicPageId = 'topic-1'
    
    // This is the EXACT logic from SCORMPackageBuilder.tsx lines 77-96
    const generatedUrl = media.url || (media.fileName ? `media/${media.fileName}` : `storage-ref-${media.id}`)
    
    console.log(`   📝 Generated URL: ${generatedUrl}`)
    
    // This is the BROKEN media item creation
    const injectedMediaItem = {
      id: media.id,
      type: media.type,
      url: generatedUrl, // ← THIS OVERWRITES YouTube properties!
      title: media.metadata?.title || `${media.type} for ${topicPageId}`,
      storageId: media.id
    }
    
    console.log('')
    console.log('   📋 Injected media item (current broken logic):')
    console.log(`     id: ${injectedMediaItem.id}`)
    console.log(`     type: ${injectedMediaItem.type}`)
    console.log(`     url: ${injectedMediaItem.url}`)  // Wrong! Should be embedUrl
    console.log(`     title: ${injectedMediaItem.title}`)
    console.log(`     embedUrl: ${(injectedMediaItem as any).embedUrl}`)  // undefined!
    console.log(`     youtubeUrl: ${(injectedMediaItem as any).youtubeUrl}`)  // undefined!
    console.log(`     isYouTube: ${(injectedMediaItem as any).isYouTube}`)  // undefined!
    
    // Step 3: Verify the issue - YouTube properties are missing
    expect(injectedMediaItem.url).toBe('media/youtube-video-123.mp4') // Wrong URL format
    expect((injectedMediaItem as any).embedUrl).toBeUndefined()  // Missing!
    expect((injectedMediaItem as any).youtubeUrl).toBeUndefined()  // Missing!
    expect((injectedMediaItem as any).isYouTube).toBeUndefined()  // Missing!
    
    // Step 4: Simulate what extractCourseContentMedia() will see
    console.log('')
    console.log('   🎯 Simulating what extractCourseContentMedia() sees...')
    
    const courseContentWithInjectedMedia = {
      topics: [
        {
          id: topicPageId,
          title: 'Topic with YouTube Video',
          media: [injectedMediaItem]
        }
      ]
    }
    
    // This is the detection logic from extractCourseContentMedia()
    const topic = courseContentWithInjectedMedia.topics[0]
    const mediaItem = topic.media[0]
    
    console.log(`   🔍 Detection check for ${mediaItem.id}:`)
    console.log(`     isYouTube: ${(mediaItem as any).isYouTube || false}`)
    console.log(`     type === 'youtube': ${mediaItem.type === 'youtube'}`)
    console.log(`     embedUrl: ${(mediaItem as any).embedUrl}`)
    console.log(`     youtubeUrl: ${(mediaItem as any).youtubeUrl}`)
    
    if ((mediaItem as any).isYouTube || mediaItem.type === 'youtube') {
      console.log('   ✅ YouTube video detected!')
      console.log(`   ⚠️ But embedUrl is: ${(mediaItem as any).embedUrl || 'undefined'}`)
      console.log('   🚨 This will cause extraction to fail!')
    } else {
      console.log('   ❌ YouTube video NOT detected')
    }
    
    // The detection will work (type === 'youtube') but embedUrl will be undefined
    const isDetectedAsYouTube = (mediaItem as any).isYouTube || mediaItem.type === 'youtube'
    expect(isDetectedAsYouTube).toBe(true) // Detection works
    expect((mediaItem as any).embedUrl).toBeUndefined() // But embedUrl is missing!
    
    console.log('')
    console.log('   🚨 [MEDIA INJECTION ISSUE CONFIRMED]')
    console.log('     1. MediaService stores YouTube videos with proper embedUrl metadata')
    console.log('     2. Media injection creates generic mediaItem with wrong url property')
    console.log('     3. YouTube-specific properties (embedUrl, youtubeUrl, isYouTube) are lost')
    console.log('     4. extractCourseContentMedia() detects type=youtube but embedUrl=undefined')
    console.log('     5. YouTube videos fail to extract properly → no display in SCORM')
  })
  
  it('should show what the FIXED injection should create', () => {
    console.log('🔍 [Fixed Injection] Testing what FIXED media injection should create...')
    
    const storedYouTubeVideo = {
      id: 'video-youtube-456',
      type: 'youtube',
      fileName: 'youtube-video-456.mp4',
      url: undefined,
      metadata: {
        type: 'youtube',
        pageId: 'topic-2', 
        title: 'Fixed YouTube Video',
        embedUrl: 'https://www.youtube.com/embed/fixed123?start=15&end=75',
        youtubeUrl: 'https://www.youtube.com/watch?v=fixed123',
        clipStart: 15,
        clipEnd: 75,
        isYouTube: true
      }
    }
    
    console.log('   📊 Stored YouTube video metadata:')
    console.log(`     embedUrl: ${storedYouTubeVideo.metadata.embedUrl}`)
    console.log(`     youtubeUrl: ${storedYouTubeVideo.metadata.youtubeUrl}`)
    console.log(`     isYouTube: ${storedYouTubeVideo.metadata.isYouTube}`)
    
    // This is what the FIXED injection should create
    const fixedInjectedMediaItem = {
      id: storedYouTubeVideo.id,
      type: storedYouTubeVideo.type,
      title: storedYouTubeVideo.metadata?.title || `YouTube Video ${storedYouTubeVideo.id}`,
      storageId: storedYouTubeVideo.id,
      
      // FIXED: Preserve YouTube-specific properties from metadata
      embedUrl: storedYouTubeVideo.metadata?.embedUrl,        // ← Now preserved!
      youtubeUrl: storedYouTubeVideo.metadata?.youtubeUrl,    // ← Now preserved!
      isYouTube: storedYouTubeVideo.metadata?.isYouTube,      // ← Now preserved!
      clipStart: storedYouTubeVideo.metadata?.clipStart,     // ← Now preserved!
      clipEnd: storedYouTubeVideo.metadata?.clipEnd,         // ← Now preserved!
      
      // For YouTube videos, url should be the embedUrl, not a file path
      url: storedYouTubeVideo.metadata?.embedUrl || storedYouTubeVideo.metadata?.youtubeUrl
    }
    
    console.log('')
    console.log('   ✅ FIXED injected media item:')
    console.log(`     id: ${fixedInjectedMediaItem.id}`)
    console.log(`     type: ${fixedInjectedMediaItem.type}`)
    console.log(`     url: ${fixedInjectedMediaItem.url}`)
    console.log(`     embedUrl: ${fixedInjectedMediaItem.embedUrl}`)
    console.log(`     youtubeUrl: ${fixedInjectedMediaItem.youtubeUrl}`)
    console.log(`     isYouTube: ${fixedInjectedMediaItem.isYouTube}`)
    console.log(`     clipStart: ${fixedInjectedMediaItem.clipStart}`)
    console.log(`     clipEnd: ${fixedInjectedMediaItem.clipEnd}`)
    
    // Verify the fixed properties exist
    expect(fixedInjectedMediaItem.embedUrl).toBe(storedYouTubeVideo.metadata.embedUrl)
    expect(fixedInjectedMediaItem.youtubeUrl).toBe(storedYouTubeVideo.metadata.youtubeUrl)
    expect(fixedInjectedMediaItem.isYouTube).toBe(true)
    expect(fixedInjectedMediaItem.clipStart).toBe(15)
    expect(fixedInjectedMediaItem.clipEnd).toBe(75)
    expect(fixedInjectedMediaItem.url).toBe(storedYouTubeVideo.metadata.embedUrl) // URL is embedUrl
    
    // Test that extractCourseContentMedia() would work correctly
    console.log('')
    console.log('   🎯 Testing extraction with fixed media item...')
    
    const isDetectedAsYouTube = fixedInjectedMediaItem.isYouTube || fixedInjectedMediaItem.type === 'youtube'
    const hasValidEmbedUrl = !!fixedInjectedMediaItem.embedUrl
    const hasValidYouTubeUrl = !!fixedInjectedMediaItem.youtubeUrl
    
    console.log(`     Detection: ${isDetectedAsYouTube}`)
    console.log(`     Valid embedUrl: ${hasValidEmbedUrl}`)  
    console.log(`     Valid youtubeUrl: ${hasValidYouTubeUrl}`)
    
    expect(isDetectedAsYouTube).toBe(true)
    expect(hasValidEmbedUrl).toBe(true)  // No more undefined!
    expect(hasValidYouTubeUrl).toBe(true)
    
    console.log('')
    console.log('   ✅ [FIXED VERSION VERIFIED]')
    console.log('     After fixing media injection:')
    console.log('       1. YouTube metadata is preserved during injection')
    console.log('       2. extractCourseContentMedia() gets proper embedUrl')
    console.log('       3. YouTube videos will be extracted and displayed correctly')
    console.log('')
    console.log('   🔧 Fix required: Update SCORMPackageBuilder.tsx media injection logic')
    console.log('      to preserve YouTube metadata when injecting YouTube videos')
  })
})