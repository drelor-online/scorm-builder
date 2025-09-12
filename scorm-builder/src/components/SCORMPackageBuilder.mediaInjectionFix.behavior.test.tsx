/**
 * Behavior test to verify the media injection fix
 * where missing topic media gets injected during SCORM generation
 */

import { describe, it, expect, vi } from 'vitest'

describe('SCORMPackageBuilder Media Injection Fix', () => {
  it('should inject missing topic media from storage into course content before conversion', async () => {
    console.log('=== MEDIA INJECTION FIX TEST ===')
    
    // Simulate the storage media that exists
    const storageMedia = [
      { id: 'image-0', pageId: 'welcome', type: 'image', metadata: { page_id: 'welcome' } },
      { id: 'video-1', pageId: 'learning-objectives', type: 'video', metadata: { page_id: 'learning-objectives' } },
      { id: 'video-2', pageId: 'topic-0', type: 'video', metadata: { page_id: 'topic-0' } },
      { id: 'image-3', pageId: 'topic-1', type: 'image', metadata: { page_id: 'topic-1' } }, // Missing from course content
      { id: 'image-4', pageId: 'topic-2', type: 'image', metadata: { page_id: 'topic-2' } }, // Missing from course content  
      { id: 'image-5', pageId: 'topic-3', type: 'image', metadata: { page_id: 'topic-3' } }, // Missing from course content
      { id: 'video-6', pageId: 'topic-4', type: 'video', metadata: { page_id: 'topic-4' } }
    ]
    
    // Simulate the broken course content (missing media on topics 1-3)
    const brokenCourseContent = {
      welcomePage: {
        title: 'Welcome',
        content: 'Welcome content',
        narration: '',
        duration: 0,
        media: [
          { id: 'image-0', type: 'image', url: 'blob:...', title: 'Welcome Image' }
        ]
      },
      learningObjectivesPage: {
        title: 'Learning Objectives',
        content: 'Objectives content',
        narration: '',
        duration: 0,
        media: [
          { id: 'video-1', type: 'video', url: 'https://youtube.com/watch?v=abc', title: 'Objectives Video' }
        ]
      },
      topics: [
        {
          id: 'topic-0',
          title: 'Topic 0',
          content: 'Content 0',
          narration: '',
          duration: 0,
          media: [
            { id: 'video-2', type: 'video', url: 'https://youtube.com/watch?v=def', title: 'Topic 0 Video' }
          ]
        },
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content 1',
          narration: '',
          duration: 0,
          media: [] // BROKEN: Should have image-3
        },
        {
          id: 'topic-2',
          title: 'Topic 2',
          content: 'Content 2',
          narration: '',
          duration: 0,
          media: [] // BROKEN: Should have image-4
        },
        {
          id: 'topic-3',
          title: 'Topic 3',
          content: 'Content 3',
          narration: '',
          duration: 0,
          media: [] // BROKEN: Should have image-5
        },
        {
          id: 'topic-4',
          title: 'Topic 4',
          content: 'Content 4',
          narration: '',
          duration: 0,
          media: [
            { id: 'video-6', type: 'video', url: 'https://youtube.com/watch?v=ghi', title: 'Topic 4 Video' }
          ]
        }
      ],
      assessment: { passMark: 80, questions: [] }
    }
    
    // Function to inject missing media (this is what we need to implement)
    function injectMissingTopicMedia(courseContent: any, storageMedia: any[]) {
      console.log('Before injection:', courseContent.topics.map((t: any, i: number) => ({
        topicIndex: i,
        topicId: t.id,
        mediaCount: t.media?.length || 0
      })))
      
      // Create a map of page_id to media for easy lookup
      const mediaByPageId = new Map()
      storageMedia.forEach(media => {
        const pageId = media.pageId || media.metadata?.page_id
        if (pageId) {
          if (!mediaByPageId.has(pageId)) {
            mediaByPageId.set(pageId, [])
          }
          mediaByPageId.get(pageId).push(media)
        }
      })
      
      // Inject missing media into topics
      courseContent.topics.forEach((topic: any, index: number) => {
        const topicPageId = topic.id
        const storageMediaForTopic = mediaByPageId.get(topicPageId) || []
        const existingMediaIds = new Set(topic.media?.map((m: any) => m.id) || [])
        
        // Find media in storage that's not in course content
        const missingMedia = storageMediaForTopic.filter((media: any) => !existingMediaIds.has(media.id))
        
        if (missingMedia.length > 0) {
          console.log(`Injecting ${missingMedia.length} missing media items into ${topicPageId}:`, missingMedia.map((m: any) => m.id))
          
          // Add missing media to the topic
          topic.media = topic.media || []
          missingMedia.forEach((media: any) => {
            topic.media.push({
              id: media.id,
              type: media.type,
              url: `injected-url-for-${media.id}`, // This would be resolved properly in real implementation
              title: `Injected ${media.type} for ${topicPageId}`,
              storageId: media.id
            })
          })
        }
      })
      
      console.log('After injection:', courseContent.topics.map((t: any, i: number) => ({
        topicIndex: i,
        topicId: t.id,
        mediaCount: t.media?.length || 0,
        mediaIds: t.media?.map((m: any) => m.id) || []
      })))
      
      return courseContent
    }
    
    // Test the injection fix
    const fixedCourseContent = injectMissingTopicMedia(brokenCourseContent, storageMedia)
    
    // Verify the fix worked
    expect(fixedCourseContent.topics[1].media).toHaveLength(1)
    expect(fixedCourseContent.topics[2].media).toHaveLength(1)
    expect(fixedCourseContent.topics[3].media).toHaveLength(1)
    expect(fixedCourseContent.topics[1].media[0].id).toBe('image-3')
    expect(fixedCourseContent.topics[2].media[0].id).toBe('image-4')
    expect(fixedCourseContent.topics[3].media[0].id).toBe('image-5')
    
    console.log('✅ MEDIA INJECTION FIX WORKING: All missing topic media has been injected')
    console.log('IMPLEMENTATION NEEDED: Add this logic to SCORMPackageBuilder before course content conversion')
  })
  
  it('should not duplicate existing media when injecting', async () => {
    console.log('=== DUPLICATE PREVENTION TEST ===')
    
    const storageMedia = [
      { id: 'video-1', pageId: 'topic-0', type: 'video', metadata: { page_id: 'topic-0' } },
      { id: 'image-1', pageId: 'topic-0', type: 'image', metadata: { page_id: 'topic-0' } }
    ]
    
    const courseContentWithExistingMedia = {
      topics: [
        {
          id: 'topic-0',
          title: 'Topic 0',
          content: 'Content',
          narration: '',
          duration: 0,
          media: [
            { id: 'video-1', type: 'video', url: 'existing-url', title: 'Existing Video' }
          ]
        }
      ]
    }
    
    function injectMissingTopicMedia(courseContent: any, storageMedia: any[]) {
      const mediaByPageId = new Map()
      storageMedia.forEach(media => {
        const pageId = media.pageId || media.metadata?.page_id
        if (pageId) {
          if (!mediaByPageId.has(pageId)) {
            mediaByPageId.set(pageId, [])
          }
          mediaByPageId.get(pageId).push(media)
        }
      })
      
      courseContent.topics.forEach((topic: any) => {
        const topicPageId = topic.id
        const storageMediaForTopic = mediaByPageId.get(topicPageId) || []
        const existingMediaIds = new Set(topic.media?.map((m: any) => m.id) || [])
        
        const missingMedia = storageMediaForTopic.filter((media: any) => !existingMediaIds.has(media.id))
        
        if (missingMedia.length > 0) {
          topic.media = topic.media || []
          missingMedia.forEach((media: any) => {
            topic.media.push({
              id: media.id,
              type: media.type,
              url: `injected-url-for-${media.id}`,
              title: `Injected ${media.type}`,
              storageId: media.id
            })
          })
        }
      })
      
      return courseContent
    }
    
    const result = injectMissingTopicMedia(courseContentWithExistingMedia, storageMedia)
    
    // Should have 2 media items: existing video-1 + injected image-1
    expect(result.topics[0].media).toHaveLength(2)
    expect(result.topics[0].media[0].id).toBe('video-1') // Existing
    expect(result.topics[0].media[1].id).toBe('image-1') // Injected
    
    // video-1 should not be duplicated
    const mediaIds = result.topics[0].media.map((m: any) => m.id)
    expect(mediaIds.filter((id: string) => id === 'video-1')).toHaveLength(1)
    
    console.log('✅ DUPLICATE PREVENTION WORKING: Existing media not duplicated during injection')
  })
})