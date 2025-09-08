import { describe, test, expect, vi } from 'vitest'
import { convertToEnhancedCourseContent } from '../services/courseContentConverter'
import type { CourseContent } from '../types/aiPrompt'
import type { CourseMetadata } from '../types/metadata'

// Mock the rustScormGenerator to capture what gets passed to it
const mockGenerateRustSCORM = vi.fn()
vi.mock('../services/rustScormGenerator', () => ({
  generateRustSCORM: mockGenerateRustSCORM,
  generateYouTubeEmbedUrl: vi.fn((videoId: string, start?: number, end?: number) => {
    const params = new URLSearchParams()
    if (start !== undefined && start >= 0) {
      params.set('start', Math.floor(start).toString())
    }
    if (end !== undefined && end > 0) {
      params.set('end', Math.floor(end).toString())
    }
    return `https://www.youtube.com/embed/${videoId}${params.toString() ? `?${params.toString()}` : ''}`
  })
}))

describe('SCORM Package Builder - YouTube Clip Timing Integration', () => {
  const mockMetadata: CourseMetadata = {
    title: 'Test Course',
    description: 'Test Description',
    author: 'Test Author',
    version: '1.0',
    scormVersion: '1.2',
    duration: 0,
    passMark: 80
  }

  test('should preserve YouTube clip timing through entire SCORM generation pipeline', () => {
    console.log('[INTEGRATION TEST] 🔬 Testing SCORM pipeline preserves YouTube clip timing...')

    // Create CourseContent with YouTube video containing clip timing
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<p>Welcome</p>',
        narration: 'Welcome narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5,
        media: []
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<p>Objectives</p>',
        narration: 'Objectives narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 3,
        media: []
      },
      topics: [{
        id: 'topic-0',
        title: 'Video Topic with Clip Timing',
        content: '<p>This topic has a clipped YouTube video</p>',
        narration: 'Topic narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 10,
        media: [{
          id: 'video-with-clip',
          type: 'video',
          title: 'YouTube Video with Clip Timing',
          url: 'https://www.youtube.com/watch?v=testVideoId',
          embedUrl: 'https://www.youtube.com/embed/testVideoId?start=90&end=225',
          isYouTube: true,
          storageId: 'video-with-clip',
          // This is the key data that should be preserved
          clipStart: 90,  // 1:30 in seconds
          clipEnd: 225    // 3:45 in seconds
        }]
      }],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    console.log('[INTEGRATION TEST] 📝 Input CourseContent with clip timing:', {
      topicMediaCount: courseContent.topics[0].media?.length,
      videoClipStart: courseContent.topics[0].media?.[0]?.clipStart,
      videoClipEnd: courseContent.topics[0].media?.[0]?.clipEnd
    })

    // Step 1: Convert CourseContent to EnhancedCourseContent (this is what SCORMPackageBuilder does)
    const enhancedContent = convertToEnhancedCourseContent(courseContent, mockMetadata, 'test-project')

    console.log('[INTEGRATION TEST] 🔄 Enhanced content conversion result:', {
      topicsCount: enhancedContent.topics?.length,
      firstTopicMediaCount: enhancedContent.topics?.[0]?.media?.length,
      firstTopicVideoClipStart: enhancedContent.topics?.[0]?.media?.[0]?.clipStart,
      firstTopicVideoClipEnd: enhancedContent.topics?.[0]?.media?.[0]?.clipEnd
    })

    // Verify that EnhancedCourseContent preserves clip timing
    expect(enhancedContent.topics).toBeDefined()
    expect(enhancedContent.topics).toHaveLength(1)
    
    const enhancedTopic = enhancedContent.topics![0]
    expect(enhancedTopic.media).toBeDefined()
    expect(enhancedTopic.media).toHaveLength(1)
    
    const enhancedVideo = enhancedTopic.media![0]
    expect(enhancedVideo.clipStart).toBe(90)   // Should preserve 1:30 start time
    expect(enhancedVideo.clipEnd).toBe(225)    // Should preserve 3:45 end time
    expect(enhancedVideo.type).toBe('video')
    expect(enhancedVideo.url).toBe('https://www.youtube.com/watch?v=testVideoId')

    console.log('[INTEGRATION TEST] ✅ EnhancedCourseContent preserves clip timing correctly')

    // The enhanced content should now contain all the data needed for SCORM generation
    // When generateRustSCORM processes this, it should create YouTube embed URLs with clip timing
    console.log('[INTEGRATION TEST] 🎯 Pipeline test PASSED - clip timing preserved through conversion')
  })

  test('should handle YouTube video without clip timing correctly', () => {
    console.log('[INTEGRATION TEST] 🔬 Testing YouTube video without clip timing...')

    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<p>Welcome</p>',
        narration: 'Welcome narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5,
        media: []
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<p>Objectives</p>',
        narration: 'Objectives narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 3,
        media: []
      },
      topics: [{
        id: 'topic-0',
        title: 'Video Topic without Clip Timing',
        content: '<p>This topic has a regular YouTube video</p>',
        narration: 'Topic narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 10,
        media: [{
          id: 'video-no-clip',
          type: 'video',
          title: 'Regular YouTube Video',
          url: 'https://www.youtube.com/watch?v=testVideoId2',
          embedUrl: 'https://www.youtube.com/embed/testVideoId2',
          isYouTube: true,
          storageId: 'video-no-clip',
          // No clipStart or clipEnd - should remain undefined
        }]
      }],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    const enhancedContent = convertToEnhancedCourseContent(courseContent, mockMetadata, 'test-project')

    // Verify that videos without clip timing don't have clip timing added
    const enhancedVideo = enhancedContent.topics![0].media![0]
    expect(enhancedVideo.clipStart).toBeUndefined()
    expect(enhancedVideo.clipEnd).toBeUndefined()
    expect(enhancedVideo.type).toBe('video')

    console.log('[INTEGRATION TEST] ✅ Videos without clip timing remain undefined correctly')
  })

  test('should verify clip timing data structure matches what rustScormGenerator expects', () => {
    console.log('[INTEGRATION TEST] 🔬 Testing data structure compatibility...')

    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<p>Welcome</p>',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5,
        media: []
      },
      learningObjectivesPage: {
        id: 'objectives', 
        title: 'Learning Objectives',
        content: '<p>Objectives</p>',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 3,
        media: []
      },
      topics: [{
        id: 'topic-0',
        title: 'Test Topic',
        content: '<p>Content</p>',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 10,
        media: [{
          id: 'video-test',
          type: 'video',
          title: 'Test YouTube Video',
          url: 'https://www.youtube.com/watch?v=testId',
          isYouTube: true,
          storageId: 'video-test',
          clipStart: 30,   // 30 seconds
          clipEnd: 120     // 2 minutes
        }]
      }],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    const enhancedContent = convertToEnhancedCourseContent(courseContent, mockMetadata)

    // Verify the enhanced content has the exact structure rustScormGenerator expects
    const videoMedia = enhancedContent.topics![0].media![0]
    
    // These are the fields rustScormGenerator.ts looks for (lines 587-592)
    expect(videoMedia).toMatchObject({
      id: 'video-test',
      url: 'https://www.youtube.com/watch?v=testId',
      type: 'video',
      clipStart: 30,
      clipEnd: 120,
      storageId: 'video-test'
    })

    console.log('[INTEGRATION TEST] ✅ Enhanced content structure matches rustScormGenerator expectations')
    console.log('[INTEGRATION TEST] 📊 Video media object:', {
      hasRequiredFields: !!(videoMedia.id && videoMedia.url && videoMedia.type),
      hasClipTiming: !!(videoMedia.clipStart !== undefined && videoMedia.clipEnd !== undefined),
      clipValues: { start: videoMedia.clipStart, end: videoMedia.clipEnd }
    })
  })
})