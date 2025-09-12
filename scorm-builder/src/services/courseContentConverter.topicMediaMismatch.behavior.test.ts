/**
 * Behavior test to reproduce the topic media mismatch issue
 * where storage has images for topics 1-3 but course content doesn't reference them
 */

import { describe, it, expect } from 'vitest'
import { convertToEnhancedCourseContent } from './courseContentConverter'
import type { CourseContent } from '../types/aiPrompt'
import type { CourseMetadata } from '../types/metadata'

describe('Course Content Converter Topic Media Mismatch', () => {
  it('should reproduce the issue where storage has media but course content topics do not reference them', async () => {
    console.log('=== TOPIC MEDIA MISMATCH ISSUE ===')
    
    // User's actual storage media (from logs)
    const storageMediaByPageId = {
      'welcome': ['image-0'],
      'learning-objectives': ['video-1'],
      'topic-0': ['video-2'],
      'topic-1': ['image-3'], // Storage has this but course content doesn't
      'topic-2': ['image-4'], // Storage has this but course content doesn't
      'topic-3': ['image-5'], // Storage has this but course content doesn't
      'topic-4': ['video-6']
    }
    
    // Simulate the actual course content structure (what gets loaded from storage)
    // This represents what's actually stored in the project file
    const courseContent: CourseContent = {
      welcomePage: {
        title: 'Welcome to Complex Projects - 1 - 49 CFR 192',
        content: 'Welcome content...',
        narration: '',
        duration: 0,
        media: [
          { id: 'image-0', type: 'image', url: 'blob:...', title: 'Welcome Image', storageId: 'image-0' }
        ]
      },
      learningObjectivesPage: {
        title: 'Learning Objectives',
        content: 'Objectives content...',
        narration: '',
        duration: 0,
        media: [
          { id: 'video-1', type: 'video', url: 'https://www.youtube.com/watch?v=tM-Q-YvF-ns', title: 'TC Energy Video', storageId: 'video-1' }
        ]
      },
      topics: [
        {
          id: 'topic-0',
          title: 'Topic 0',
          content: 'Content...',
          narration: '',
          duration: 0,
          media: [
            { id: 'video-2', type: 'video', url: 'https://www.youtube.com/watch?v=2ig_bliXMW0', title: 'Video 2', storageId: 'video-2' }
          ]
        },
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content...',
          narration: '',
          duration: 0,
          media: [] // BUG: Empty media array even though storage has image-3
        },
        {
          id: 'topic-2',
          title: 'Topic 2',
          content: 'Content...',
          narration: '',
          duration: 0,
          media: [] // BUG: Empty media array even though storage has image-4
        },
        {
          id: 'topic-3',
          title: 'Topic 3',
          content: 'Content...',
          narration: '',
          duration: 0,
          media: [] // BUG: Empty media array even though storage has image-5
        },
        {
          id: 'topic-4',
          title: 'Topic 4',
          content: 'Content...',
          narration: '',
          duration: 0,
          media: [
            { id: 'video-6', type: 'video', url: 'https://www.youtube.com/watch?v=TvB8QQibvco&start=60&end=89', title: 'Video 6', storageId: 'video-6' }
          ]
        }
      ],
      assessment: {
        passMark: 80,
        questions: []
      }
    }
    
    const metadata: CourseMetadata = {
      title: 'Complex Projects - 1 - 49 CFR 192',
      lastModified: new Date().toISOString()
    }
    
    console.log('Storage media by page ID:', storageMediaByPageId)
    console.log('Course content topics media:', courseContent.topics.map((topic, index) => ({
      topicIndex: index,
      topicId: topic.id,
      mediaCount: topic.media?.length || 0,
      mediaIds: topic.media?.map(m => m.id) || []
    })))
    
    // Convert to enhanced format
    const enhancedContent = convertToEnhancedCourseContent(courseContent, metadata)
    
    console.log('Enhanced content topics media:', enhancedContent.topics?.map((topic, index) => ({
      topicIndex: index,
      topicId: topic.id,
      mediaCount: topic.media?.length || 0,
      mediaIds: topic.media?.map(m => m.id) || []
    })))
    
    // The bug: Enhanced content will also have empty media arrays for topics 1-3
    // because the converter can only work with what's in the course content
    const topicsWithMissingMedia = []
    for (let i = 1; i <= 3; i++) {
      const topicId = `topic-${i}`
      const storageHasMedia = storageMediaByPageId[topicId]?.length > 0
      const enhancedHasMedia = enhancedContent.topics?.[i]?.media?.length > 0
      
      if (storageHasMedia && !enhancedHasMedia) {
        topicsWithMissingMedia.push({
          topicId,
          storageMedia: storageMediaByPageId[topicId],
          enhancedMedia: enhancedContent.topics?.[i]?.media || []
        })
      }
    }
    
    console.log('Topics with missing media after conversion:', topicsWithMissingMedia)
    
    // Bug confirmed: The converter preserves the missing media issue
    expect(topicsWithMissingMedia).toHaveLength(3)
    expect(topicsWithMissingMedia.map(t => t.topicId)).toEqual(['topic-1', 'topic-2', 'topic-3'])
    
    console.log('✅ BUG REPRODUCED: Course content converter preserves missing topic media')
    console.log('ROOT CAUSE: Course content stored in project file has empty media arrays for topics 1-3')
    console.log('SOLUTION NEEDED: Either fix course content during save/load or inject media during conversion')
  })
  
  it('should show what the enhanced content should look like with proper media mapping', async () => {
    console.log('=== EXPECTED ENHANCED CONTENT STRUCTURE ===')
    
    // What the course content SHOULD look like with proper media mapping
    const correctedCourseContent: CourseContent = {
      welcomePage: {
        title: 'Welcome to Complex Projects - 1 - 49 CFR 192',
        content: 'Welcome content...',
        narration: '',
        duration: 0,
        media: [
          { id: 'image-0', type: 'image', url: 'blob:...', title: 'Welcome Image', storageId: 'image-0' }
        ]
      },
      learningObjectivesPage: {
        title: 'Learning Objectives',
        content: 'Objectives content...',
        narration: '',
        duration: 0,
        media: [
          { id: 'video-1', type: 'video', url: 'https://www.youtube.com/watch?v=tM-Q-YvF-ns', title: 'TC Energy Video', storageId: 'video-1' }
        ]
      },
      topics: [
        {
          id: 'topic-0',
          title: 'Topic 0',
          content: 'Content...',
          narration: '',
          duration: 0,
          media: [
            { id: 'video-2', type: 'video', url: 'https://www.youtube.com/watch?v=2ig_bliXMW0', title: 'Video 2', storageId: 'video-2' }
          ]
        },
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content...',
          narration: '',
          duration: 0,
          media: [
            { id: 'image-3', type: 'image', url: 'blob:...', title: 'Topic 1 Image', storageId: 'image-3' }
          ]
        },
        {
          id: 'topic-2',
          title: 'Topic 2',
          content: 'Content...',
          narration: '',
          duration: 0,
          media: [
            { id: 'image-4', type: 'image', url: 'blob:...', title: 'Topic 2 Image', storageId: 'image-4' }
          ]
        },
        {
          id: 'topic-3',
          title: 'Topic 3',
          content: 'Content...',
          narration: '',
          duration: 0,
          media: [
            { id: 'image-5', type: 'image', url: 'blob:...', title: 'Topic 3 Image', storageId: 'image-5' }
          ]
        },
        {
          id: 'topic-4',
          title: 'Topic 4',
          content: 'Content...',
          narration: '',
          duration: 0,
          media: [
            { id: 'video-6', type: 'video', url: 'https://www.youtube.com/watch?v=TvB8QQibvco&start=60&end=89', title: 'Video 6', storageId: 'video-6' }
          ]
        }
      ],
      assessment: {
        passMark: 80,
        questions: []
      }
    }
    
    const metadata: CourseMetadata = {
      title: 'Complex Projects - 1 - 49 CFR 192',
      lastModified: new Date().toISOString()
    }
    
    const enhancedContent = convertToEnhancedCourseContent(correctedCourseContent, metadata)
    
    const allTopicsWithMedia = enhancedContent.topics?.map((topic, index) => ({
      topicIndex: index,
      topicId: topic.id,
      mediaCount: topic.media?.length || 0,
      mediaIds: topic.media?.map(m => m.id) || []
    }))
    
    console.log('Expected enhanced content (with corrected course content):', allTopicsWithMedia)
    
    // With corrected course content, all topics should have their media
    expect(enhancedContent.topics?.[1]?.media).toHaveLength(1)
    expect(enhancedContent.topics?.[2]?.media).toHaveLength(1)
    expect(enhancedContent.topics?.[3]?.media).toHaveLength(1)
    expect(enhancedContent.topics?.[1]?.media?.[0]?.id).toBe('image-3')
    expect(enhancedContent.topics?.[2]?.media?.[0]?.id).toBe('image-4')
    expect(enhancedContent.topics?.[3]?.media?.[0]?.id).toBe('image-5')
    
    console.log('✅ EXPECTED BEHAVIOR: With corrected course content, all topics have their media')
    console.log('GOAL: Need to ensure course content gets properly populated with media references')
  })
})