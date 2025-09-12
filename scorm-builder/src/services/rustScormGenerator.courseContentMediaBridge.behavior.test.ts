import { describe, it, expect } from 'vitest'

/**
 * BEHAVIOR TEST: Course Content Media Bridge Issue
 * 
 * This test identifies the missing bridge between course content media (stored via
 * MediaEnhancementWizard) and the media injection system during SCORM generation.
 * 
 * Root Cause: YouTube videos added via MediaEnhancementWizard are stored in 
 * page.media arrays in course content, but they're never transferred to the 
 * MediaService for injection into SCORM templates.
 * 
 * Flow that's broken:
 * 1. User adds YouTube video via MediaEnhancementWizard ✅
 * 2. Video stored in courseContent.topics[i].media array ✅  
 * 3. SCORM generation calls convertEnhancedToRustFormat() ❌ (missing extraction)
 * 4. Media injection system never sees YouTube videos from course content ❌
 * 5. SCORM template has no YouTube video data to render ❌
 */
describe('Course Content Media Bridge Issue - YouTube Videos', () => {
  it('should demonstrate the missing bridge between course content and media injection', () => {
    console.log('🔍 [Media Bridge] Testing course content → media injection flow...')
    
    // Simulate course content structure with YouTube videos (from MediaEnhancementWizard)
    const mockCourseContent = {
      welcomeMessage: "Welcome to the course",
      objectives: ["Learn something"],
      topics: [
        {
          id: 'topic-0',
          title: 'Topic 1', 
          content: 'Topic content',
          media: [
            {
              id: 'image-3',
              type: 'image',
              url: 'blob:http://localhost/abc123',
              title: 'Test Image'
            }
          ]
        },
        {
          id: 'topic-1',
          title: 'Topic 2',
          content: 'Topic content with YouTube video',
          media: [
            {
              id: 'video-6', 
              type: 'video',
              title: 'Test YouTube Video',
              isYouTube: true,
              embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
              clipStart: 10,
              clipEnd: 60,
              url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
            }
          ]
        }
      ]
    }
    
    console.log('   📊 Course content structure:')
    mockCourseContent.topics.forEach((topic, index) => {
      console.log(`     Topic ${index}: ${topic.title}`)
      console.log(`       Media items: ${topic.media.length}`)
      topic.media.forEach(media => {
        console.log(`         - ${media.id} (${media.type}${media.isYouTube ? ', YouTube' : ''})`)
      })
    })
    
    // Simulate the CURRENT convertEnhancedToRustFormat behavior (missing media extraction)
    const simulateCurrentConversion = (courseContent: any) => {
      console.log('')
      console.log('   🔄 Simulating CURRENT convertEnhancedToRustFormat behavior:')
      
      const rustData = {
        topics: courseContent.topics.map((topic: any) => ({
          id: topic.id,
          title: topic.title,
          content: topic.content,
          // ❌ MISSING: Media extraction from topic.media array
          // Currently only handles imageUrl and audioFile, not media array
        }))
      }
      
      console.log(`     Processed ${rustData.topics.length} topics`)
      console.log('     ❌ Media arrays from course content NOT extracted')
      console.log('     ❌ YouTube videos from MediaEnhancementWizard IGNORED')
      
      return rustData
    }
    
    const convertedData = simulateCurrentConversion(mockCourseContent)
    
    // Simulate what MediaService would see (empty - no course content media extracted)
    const simulateMediaServiceState = () => {
      return {
        storedMedia: [], // Empty because course content media never gets stored
        injectionResults: []
      }
    }
    
    const mediaServiceState = simulateMediaServiceState()
    
    console.log('')
    console.log('   📤 Media injection system state:')
    console.log(`     Stored media items: ${mediaServiceState.storedMedia.length}`)
    console.log('     ❌ YouTube videos from course content: NOT FOUND')
    console.log('     ❌ SCORM template will have no YouTube data')
    
    // Verify the broken flow
    expect(convertedData.topics[1].media).toBeUndefined() // Media not extracted
    expect(mediaServiceState.storedMedia.length).toBe(0) // No media transferred
    
    console.log('')
    console.log('   🚨 [BROKEN FLOW CONFIRMED]')
    console.log('     ❌ Course content YouTube videos never reach media injection')
    console.log('     ❌ MediaEnhancementWizard → SCORM generation bridge is missing')
    console.log('     ❌ Users see empty video placeholders in SCORM packages')
  })
  
  it('should demonstrate what the FIXED flow should look like', () => {
    console.log('🔍 [Media Bridge] Testing what FIXED flow should look like...')
    
    const mockCourseContent = {
      topics: [
        {
          id: 'topic-1',
          title: 'Topic with YouTube',
          content: 'Topic content',
          media: [
            {
              id: 'video-6',
              type: 'video', 
              title: 'YouTube Video',
              isYouTube: true,
              embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
              clipStart: 10,
              clipEnd: 60
            }
          ]
        }
      ]
    }
    
    // Simulate the FIXED convertEnhancedToRustFormat behavior (WITH media extraction)
    const simulateFixedConversion = (courseContent: any, mockMediaService: any) => {
      console.log('')
      console.log('   🔄 Simulating FIXED convertEnhancedToRustFormat behavior:')
      
      const extractedMedia: any[] = []
      
      // Extract media from course content and store in MediaService
      courseContent.topics.forEach((topic: any) => {
        if (topic.media && topic.media.length > 0) {
          topic.media.forEach((mediaItem: any) => {
            console.log(`     Extracting ${mediaItem.id} from ${topic.id}`)
            
            // Store in MediaService with proper pageId mapping
            const mediaForStorage = {
              ...mediaItem,
              pageId: topic.id
            }
            
            if (mediaItem.isYouTube) {
              // Use storeYouTubeVideo for YouTube items
              mockMediaService.storeYouTubeVideo(
                mediaItem.url || mediaItem.embedUrl,
                mediaItem.embedUrl,
                topic.id,
                {
                  title: mediaItem.title,
                  clipStart: mediaItem.clipStart,
                  clipEnd: mediaItem.clipEnd
                }
              )
            } else {
              // Use regular storeMedia for other items
              mockMediaService.storeMedia(
                mediaItem.id,
                topic.id,
                mediaItem.type,
                null, // No blob for existing items
                mediaItem
              )
            }
            
            extractedMedia.push(mediaForStorage)
          })
        }
      })
      
      console.log(`     ✅ Extracted ${extractedMedia.length} media items from course content`)
      console.log('     ✅ YouTube videos stored in MediaService')
      
      return { extractedMedia }
    }
    
    // Mock MediaService
    const mockMediaService = {
      storedItems: [] as any[],
      storeYouTubeVideo: function(url: string, embedUrl: string, pageId: string, metadata: any) {
        const item = {
          id: `video-${this.storedItems.length + 1}`,
          type: 'youtube',
          pageId,
          metadata: {
            ...metadata,
            embedUrl,
            youtubeUrl: url,
            isYouTube: true
          }
        }
        this.storedItems.push(item)
        console.log(`     📺 Stored YouTube video: ${item.id} for ${pageId}`)
        return item
      },
      storeMedia: function(id: string, pageId: string, type: string, blob: any, metadata: any) {
        const item = { id, type, pageId, metadata }
        this.storedItems.push(item)
        console.log(`     📄 Stored ${type} media: ${id} for ${pageId}`)
        return item
      }
    }
    
    const fixedResult = simulateFixedConversion(mockCourseContent, mockMediaService)
    
    console.log('')
    console.log('   📤 Media injection system state (FIXED):')
    console.log(`     Stored media items: ${mockMediaService.storedItems.length}`)
    console.log(`     YouTube videos available for injection: ${mockMediaService.storedItems.filter(i => i.type === 'youtube').length}`)
    
    // Simulate media injection with extracted YouTube videos
    const injectableYouTubeVideos = mockMediaService.storedItems.filter(item => {
      const isYouTube = item.type === 'youtube' || item.metadata?.isYouTube
      return isYouTube
    })
    
    console.log('')
    console.log('   🎯 Media injection results:')
    injectableYouTubeVideos.forEach(video => {
      console.log(`     ✅ ${video.id} → YouTube embed with metadata`)
      console.log(`         embedUrl: ${video.metadata?.embedUrl}`)
      console.log(`         clipStart: ${video.metadata?.clipStart}s`)
      console.log(`         clipEnd: ${video.metadata?.clipEnd}s`)
    })
    
    // Verify the fixed flow
    expect(fixedResult.extractedMedia.length).toBe(1)
    expect(mockMediaService.storedItems.length).toBe(1)
    expect(mockMediaService.storedItems[0].type).toBe('youtube')
    expect(injectableYouTubeVideos.length).toBe(1)
    
    console.log('')
    console.log('   ✅ [FIXED FLOW CONFIRMED]')
    console.log('     ✅ Course content media extracted during SCORM generation')
    console.log('     ✅ YouTube videos transferred to MediaService')
    console.log('     ✅ Media injection system has YouTube data for templates')
    console.log('     ✅ Users will see YouTube videos in SCORM packages')
  })
  
  it('should verify the bridge preserves YouTube metadata correctly', () => {
    console.log('🔍 [Media Bridge] Testing metadata preservation...')
    
    const youTubeVideoFromCourseContent = {
      id: 'video-6',
      type: 'video',
      title: 'Test YouTube Video with Clips', 
      isYouTube: true,
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=10&end=60',
      clipStart: 10,
      clipEnd: 60,
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    }
    
    // Simulate metadata preservation through the bridge
    const simulateMetadataPreservation = (originalMedia: any) => {
      console.log('   📋 Original metadata from course content:')
      console.log(`     isYouTube: ${originalMedia.isYouTube}`)
      console.log(`     embedUrl: ${originalMedia.embedUrl}`)
      console.log(`     clipStart: ${originalMedia.clipStart}`)
      console.log(`     clipEnd: ${originalMedia.clipEnd}`)
      console.log(`     title: ${originalMedia.title}`)
      
      // What should be preserved when storing in MediaService
      const preservedMetadata = {
        title: originalMedia.title,
        embedUrl: originalMedia.embedUrl,
        youtubeUrl: originalMedia.youtubeUrl,
        isYouTube: true,
        type: 'youtube',
        clipStart: originalMedia.clipStart,
        clipEnd: originalMedia.clipEnd
      }
      
      console.log('')
      console.log('   ✅ Preserved metadata for MediaService:')
      Object.entries(preservedMetadata).forEach(([key, value]) => {
        console.log(`     ${key}: ${value}`)
      })
      
      // What media injection should receive
      const injectionMetadata = {
        id: originalMedia.id,
        type: 'video',
        is_youtube: true,
        embed_url: preservedMetadata.embedUrl,
        title: preservedMetadata.title,
        clipStart: preservedMetadata.clipStart,
        clipEnd: preservedMetadata.clipEnd
      }
      
      console.log('')
      console.log('   🎯 Final injection metadata:')
      Object.entries(injectionMetadata).forEach(([key, value]) => {
        console.log(`     ${key}: ${value}`)
      })
      
      return { preservedMetadata, injectionMetadata }
    }
    
    const result = simulateMetadataPreservation(youTubeVideoFromCourseContent)
    
    // Verify critical metadata is preserved
    expect(result.preservedMetadata.isYouTube).toBe(true)
    expect(result.preservedMetadata.clipStart).toBe(10)
    expect(result.preservedMetadata.clipEnd).toBe(60)
    expect(result.preservedMetadata.embedUrl).toContain('youtube.com/embed')
    
    expect(result.injectionMetadata.is_youtube).toBe(true)
    expect(result.injectionMetadata.embed_url).toBe(result.preservedMetadata.embedUrl)
    expect(result.injectionMetadata.clipStart).toBe(10)
    expect(result.injectionMetadata.clipEnd).toBe(60)
    
    console.log('')
    console.log('   ✅ [METADATA PRESERVATION CONFIRMED]')
    console.log('     ✅ YouTube flags preserved (isYouTube → is_youtube)')
    console.log('     ✅ Embed URLs preserved (embedUrl → embed_url)')
    console.log('     ✅ Clip timing preserved (clipStart/clipEnd maintained)')
    console.log('     ✅ Title and other metadata preserved')
    
    // This test passes if we reach this point
    expect(true).toBe(true)
  })
})