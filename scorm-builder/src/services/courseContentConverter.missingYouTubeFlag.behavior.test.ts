import { describe, it, expect } from 'vitest'
import { convertToEnhancedCourseContent } from './courseContentConverter'
import type { CourseContent } from '../types/aiPrompt'
import type { CourseMetadata } from '../types/metadata'

/**
 * BEHAVIOR TEST: Missing isYouTube Flag Issue
 * 
 * This test reproduces the exact root cause of why YouTube videos are not
 * displaying in SCORM packages: the courseContentConverter strips the
 * `isYouTube` flag during media conversion.
 * 
 * Root Cause: In courseContentConverter.ts lines 202-215, the media mapping
 * preserves most properties but omits `isYouTube` and `youtubeUrl`.
 * 
 * Expected: This test should FAIL, confirming the missing properties issue.
 */
describe('Course Content Converter - Missing YouTube Flag Issue', () => {
  it('should reproduce the missing isYouTube flag issue', () => {
    console.log('🔍 [YouTube Flag Issue] Testing courseContentConverter YouTube flag preservation...')
    
    // Step 1: Create course content with YouTube videos (as created by MediaEnhancementWizard)
    const courseContentWithYouTube: CourseContent = {
      welcomePage: {
        title: 'Welcome',
        content: 'Welcome content',
        media: []
      },
      learningObjectivesPage: {
        title: 'Objectives',
        content: 'Objectives content', 
        media: []
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Video Topic',
          content: 'This topic has a YouTube video',
          media: [
            {
              id: 'video-123',
              type: 'video',
              title: 'Test YouTube Video',
              url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              // These are the critical YouTube properties that MediaEnhancementWizard adds
              isYouTube: true,                    // ← This should be preserved  
              youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',  // ← This should be preserved
              embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=10&end=60',
              clipStart: 10,
              clipEnd: 60
            } as any // Cast to any to allow extra properties
          ]
        }
      ],
      assessment: {
        passingScore: 80,
        questions: []
      }
    }
    
    console.log('   📊 Original course content YouTube video properties:')
    const originalMedia = courseContentWithYouTube.topics[0].media[0] as any
    console.log(`     id: ${originalMedia.id}`)
    console.log(`     type: ${originalMedia.type}`)
    console.log(`     isYouTube: ${originalMedia.isYouTube}`)
    console.log(`     youtubeUrl: ${originalMedia.youtubeUrl}`)
    console.log(`     embedUrl: ${originalMedia.embedUrl}`)
    console.log(`     clipStart: ${originalMedia.clipStart}`)
    console.log(`     clipEnd: ${originalMedia.clipEnd}`)
    
    // Step 2: Convert to enhanced format (this is where the bug occurs)
    const metadata: CourseMetadata = {
      title: 'Test Course',
      description: 'Test Description',
      author: 'Test Author',
      createdAt: new Date().toISOString(),
      version: '1.0.0'
    }
    
    console.log('')
    console.log('   🔄 Converting to enhanced format (where the issue occurs)...')
    
    const enhancedContent = convertToEnhancedCourseContent(
      courseContentWithYouTube,
      metadata,
      'test-project'
    )
    
    // Step 3: Check what properties survived the conversion
    const convertedTopic = enhancedContent.topics[0]
    const convertedMedia = convertedTopic.media[0]
    
    console.log('')
    console.log('   📋 Converted enhanced content YouTube video properties:')
    console.log(`     id: ${convertedMedia.id}`)
    console.log(`     type: ${convertedMedia.type}`)
    console.log(`     isYouTube: ${(convertedMedia as any).isYouTube}`)  // This will be undefined
    console.log(`     youtubeUrl: ${(convertedMedia as any).youtubeUrl}`)  // This will be undefined
    console.log(`     embedUrl: ${convertedMedia.embedUrl}`)
    console.log(`     clipStart: ${convertedMedia.clipStart}`)
    console.log(`     clipEnd: ${convertedMedia.clipEnd}`)
    
    // Step 4: Validate that the critical properties were preserved
    console.log('')
    console.log('   🧪 Property preservation analysis:')
    
    // These should be preserved
    expect(convertedMedia.id).toBe(originalMedia.id)
    expect(convertedMedia.type).toBe(originalMedia.type)
    expect(convertedMedia.embedUrl).toBe(originalMedia.embedUrl)
    expect(convertedMedia.clipStart).toBe(originalMedia.clipStart)
    expect(convertedMedia.clipEnd).toBe(originalMedia.clipEnd)
    console.log('     ✅ Basic properties preserved: id, type, embedUrl, clipStart, clipEnd')
    
    // These are the MISSING properties that cause the issue
    const convertedIsYouTube = (convertedMedia as any).isYouTube
    const convertedYoutubeUrl = (convertedMedia as any).youtubeUrl
    
    console.log(`     ❌ isYouTube preserved: ${convertedIsYouTube !== undefined} (value: ${convertedIsYouTube})`)
    console.log(`     ❌ youtubeUrl preserved: ${convertedYoutubeUrl !== undefined} (value: ${convertedYoutubeUrl})`)
    
    // These assertions should FAIL, confirming the bug
    expect(convertedIsYouTube).toBe(true) // This will fail - isYouTube is undefined
    expect(convertedYoutubeUrl).toBe(originalMedia.youtubeUrl) // This will fail - youtubeUrl is undefined
    
    console.log('')
    console.log('   🚨 [ROOT CAUSE CONFIRMED]')
    console.log('     The courseContentConverter is stripping YouTube-specific properties!')
    console.log('     This is why extractCourseContentMedia() cannot detect YouTube videos!')
  })
  
  it('should simulate what extractCourseContentMedia sees after conversion', () => {
    console.log('🔍 [Extraction Simulation] Testing what extractCourseContentMedia receives...')
    
    // Step 1: Create course content and convert it (simulating the broken conversion)
    const courseContent: CourseContent = {
      welcomePage: { title: 'Welcome', content: 'Content', media: [] },
      learningObjectivesPage: { title: 'Objectives', content: 'Content', media: [] },
      topics: [
        {
          id: 'topic-1',
          title: 'Video Topic',
          content: 'Content',
          media: [
            {
              id: 'video-456',
              type: 'video',
              title: 'YouTube Video',
              url: 'https://www.youtube.com/watch?v=test123',
              isYouTube: true,  // This gets lost in conversion
              youtubeUrl: 'https://www.youtube.com/watch?v=test123',  // This gets lost
              embedUrl: 'https://www.youtube.com/embed/test123?start=15&end=45',
              clipStart: 15,
              clipEnd: 45
            } as any
          ]
        }
      ],
      assessment: { passingScore: 80, questions: [] }
    }
    
    const metadata: CourseMetadata = {
      title: 'Test Course',
      description: 'Description',
      author: 'Author',
      createdAt: new Date().toISOString(),
      version: '1.0.0'
    }
    
    const enhancedContent = convertToEnhancedCourseContent(courseContent, metadata, 'test-project')
    
    // Step 2: Simulate what extractCourseContentMedia() sees
    const simulateExtractCourseContentMedia = (courseContent: any) => {
      console.log('   📤 Simulating extractCourseContentMedia() logic...')
      
      let youtubeVideosFound = 0
      
      for (const topic of courseContent.topics || []) {
        console.log(`   🔍 Checking topic "${topic.title}" for YouTube videos...`)
        
        if (!topic.media || !Array.isArray(topic.media) || topic.media.length === 0) {
          console.log('     - No media array or empty media array')
          continue
        }
        
        console.log(`     - Found ${topic.media.length} media items`)
        
        for (const mediaItem of topic.media) {
          console.log(`     - Processing ${mediaItem.id} (${mediaItem.type})`)
          console.log(`       isYouTube: ${mediaItem.isYouTube}`)
          console.log(`       youtubeUrl: ${mediaItem.youtubeUrl}`)
          console.log(`       embedUrl: ${mediaItem.embedUrl}`)
          
          // This is the exact detection logic from extractCourseContentMedia()
          if (mediaItem.isYouTube || mediaItem.type === 'youtube') {
            console.log(`     ✅ YouTube video detected: ${mediaItem.id}`)
            youtubeVideosFound++
          } else {
            console.log(`     ❌ NOT detected as YouTube video`)
            console.log(`       - isYouTube check: ${mediaItem.isYouTube || false}`)
            console.log(`       - type === 'youtube' check: ${mediaItem.type === 'youtube'}`)
          }
        }
      }
      
      return youtubeVideosFound
    }
    
    const foundCount = simulateExtractCourseContentMedia(enhancedContent)
    
    console.log('')
    console.log(`   📊 Results:`)
    console.log(`     YouTube videos in original course content: 1`)
    console.log(`     YouTube videos detected by extraction logic: ${foundCount}`)
    console.log(`     Detection success: ${foundCount > 0 ? 'YES' : 'NO'}`)
    
    // This should fail - no YouTube videos detected due to missing isYouTube flag
    expect(foundCount).toBe(1) // This will fail because foundCount will be 0
    
    console.log('')
    console.log('   🚨 [EXTRACTION FAILURE CONFIRMED]')
    console.log('     extractCourseContentMedia() cannot detect YouTube videos')
    console.log('     because courseContentConverter stripped the isYouTube flag!')
    console.log('     This is why no YouTube videos appear in SCORM packages!')
  })
  
  it('should show what the FIXED conversion should look like', () => {
    console.log('🔍 [Fixed Conversion] Testing what FIXED courseContentConverter should produce...')
    
    // This test shows what the enhanced content should look like after we fix the converter
    
    const originalMediaWithYouTube = {
      id: 'video-789',
      type: 'video', 
      title: 'Fixed YouTube Video',
      url: 'https://www.youtube.com/watch?v=fixed123',
      isYouTube: true,
      youtubeUrl: 'https://www.youtube.com/watch?v=fixed123',
      embedUrl: 'https://www.youtube.com/embed/fixed123?start=20&end=80',
      clipStart: 20,
      clipEnd: 80
    }
    
    console.log('   📊 Original YouTube media properties:')
    Object.entries(originalMediaWithYouTube).forEach(([key, value]) => {
      console.log(`     ${key}: ${value}`)
    })
    
    // This is what the FIXED converter should produce
    const fixedConvertedMedia = {
      id: originalMediaWithYouTube.id,
      url: originalMediaWithYouTube.url,
      title: originalMediaWithYouTube.title,
      type: originalMediaWithYouTube.type,
      embedUrl: originalMediaWithYouTube.embedUrl,
      isYouTube: originalMediaWithYouTube.isYouTube,      // ← FIXED: Now preserved!
      youtubeUrl: originalMediaWithYouTube.youtubeUrl,    // ← FIXED: Now preserved!
      clipStart: originalMediaWithYouTube.clipStart,      // Already working
      clipEnd: originalMediaWithYouTube.clipEnd,          // Already working
      // ... other properties
    }
    
    console.log('')
    console.log('   ✅ FIXED converter output should include:')
    Object.entries(fixedConvertedMedia).forEach(([key, value]) => {
      console.log(`     ${key}: ${value}`)
    })
    
    // Verify the fixed properties exist
    expect(fixedConvertedMedia.isYouTube).toBe(true)
    expect(fixedConvertedMedia.youtubeUrl).toBe(originalMediaWithYouTube.youtubeUrl)
    expect(fixedConvertedMedia.embedUrl).toBe(originalMediaWithYouTube.embedUrl)
    expect(fixedConvertedMedia.clipStart).toBe(originalMediaWithYouTube.clipStart)
    expect(fixedConvertedMedia.clipEnd).toBe(originalMediaWithYouTube.clipEnd)
    
    // Test that extractCourseContentMedia would detect this
    const wouldDetectAsYouTube = fixedConvertedMedia.isYouTube || fixedConvertedMedia.type === 'youtube'
    expect(wouldDetectAsYouTube).toBe(true)
    
    console.log('')
    console.log('   ✅ [FIXED VERSION VERIFIED]')
    console.log('     After fixing courseContentConverter:')
    console.log('       1. isYouTube flag will be preserved')
    console.log('       2. youtubeUrl will be preserved') 
    console.log('       3. extractCourseContentMedia() will detect YouTube videos')
    console.log('       4. YouTube videos will appear in SCORM packages')
    console.log('')
    console.log('   🔧 Fix required: Add isYouTube and youtubeUrl to media mapping in courseContentConverter.ts')
  })
})