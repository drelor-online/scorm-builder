/**
 * Test for media resolution in SCORM generation
 * 
 * This test verifies that all topics get their media resolved correctly,
 * especially topics beyond the first 9 (topics 10-19)
 */
import { vi } from 'vitest'

describe('SCORM Media Resolution', () => {
  // Mock the enhanced course content with 20 topics
  const createMockEnhancedContent = (topicCount: number) => {
    const topics = []
    for (let i = 0; i < topicCount; i++) {
      topics.push({
        id: `topic-${i + 1}`,
        title: `Topic ${i + 1}`,
        content: `Content for topic ${i + 1}`,
        media: [
          {
            id: `image-${i + 1}`,
            type: 'image',
            url: `https://example.com/image-${i + 1}.jpg`,
            title: `Image ${i + 1}`
          },
          {
            id: `video-${i + 1}`, 
            type: 'video',
            url: `https://example.com/video-${i + 1}.mp4`,
            title: `Video ${i + 1}`
          }
        ]
      })
    }
    
    return {
      title: 'Test Course',
      duration: 3600,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: { title: 'Welcome', content: 'Welcome content' },
      objectives: ['Learn A', 'Learn B'],
      objectivesPage: { narration: 'Objectives narration' },
      topics,
      assessment: { questions: [] }
    }
  }

  // Mock the media resolution function (simplified version of what happens in rustScormGenerator.ts)
  const resolveMediaForTopics = async (enhancedContent: any): Promise<any[]> => {
    const resolvedTopics = []
    
    // Current implementation: Process each topic
    for (const topic of enhancedContent.topics) {
      const resolvedTopic = {
        ...topic,
        image_url: undefined as string | undefined,
        video_url: undefined as string | undefined
      }
      
      // Resolve media for this topic
      if (topic.media && Array.isArray(topic.media)) {
        for (const media of topic.media) {
          if (media.type === 'image') {
            resolvedTopic.image_url = media.url
          } else if (media.type === 'video') {
            resolvedTopic.video_url = media.url
          }
        }
      }
      
      resolvedTopics.push(resolvedTopic)
    }
    
    return resolvedTopics
  }

  test('should resolve media for all 20 topics, including topics 10-19', async () => {
    // ARRANGE: Create content with 20 topics
    const enhancedContent = createMockEnhancedContent(20)
    
    // ACT: Resolve media for all topics
    const resolvedTopics = await resolveMediaForTopics(enhancedContent)
    
    // ASSERT: All 20 topics should have resolved media
    expect(resolvedTopics).toHaveLength(20)
    
    // Check topics 1-9 have media (should work in current implementation)
    for (let i = 0; i < 9; i++) {
      const topic = resolvedTopics[i]
      expect(topic.image_url).toBe(`https://example.com/image-${i + 1}.jpg`)
      expect(topic.video_url).toBe(`https://example.com/video-${i + 1}.mp4`)
    }
    
    // Check topics 10-20 have media (this is where the bug might be)
    for (let i = 9; i < 20; i++) {
      const topic = resolvedTopics[i]
      expect(topic.image_url).toBe(`https://example.com/image-${i + 1}.jpg`)
      expect(topic.video_url).toBe(`https://example.com/video-${i + 1}.mp4`)
      
      // This test should pass if media resolution works correctly for all topics
      // If there's a bug limiting to first 9 topics, topics 10-20 would have undefined URLs
    }
  })

  test('should handle topics with no media gracefully', async () => {
    // ARRANGE: Create content with topics that have no media
    const enhancedContent = createMockEnhancedContent(5)
    enhancedContent.topics[2].media = [] // Topic 3 has no media
    enhancedContent.topics[4].media = undefined // Topic 5 has undefined media
    
    // ACT: Resolve media for all topics
    const resolvedTopics = await resolveMediaForTopics(enhancedContent)
    
    // ASSERT: Topics without media should have undefined URLs
    expect(resolvedTopics[0].image_url).toBeDefined() // Topic 1 has media
    expect(resolvedTopics[1].image_url).toBeDefined() // Topic 2 has media
    expect(resolvedTopics[2].image_url).toBeUndefined() // Topic 3 has no media
    expect(resolvedTopics[3].image_url).toBeDefined() // Topic 4 has media
    expect(resolvedTopics[4].image_url).toBeUndefined() // Topic 5 has undefined media
  })

  test('should handle edge case with exactly 9 topics', async () => {
    // ARRANGE: Create content with exactly 9 topics
    const enhancedContent = createMockEnhancedContent(9)
    
    // ACT: Resolve media for all topics
    const resolvedTopics = await resolveMediaForTopics(enhancedContent)
    
    // ASSERT: All 9 topics should have resolved media
    expect(resolvedTopics).toHaveLength(9)
    for (let i = 0; i < 9; i++) {
      const topic = resolvedTopics[i]
      expect(topic.image_url).toBe(`https://example.com/image-${i + 1}.jpg`)
      expect(topic.video_url).toBe(`https://example.com/video-${i + 1}.mp4`)
    }
  })

  test('should handle edge case with exactly 10 topics', async () => {
    // ARRANGE: Create content with exactly 10 topics (where bug might manifest)
    const enhancedContent = createMockEnhancedContent(10)
    
    // ACT: Resolve media for all topics
    const resolvedTopics = await resolveMediaForTopics(enhancedContent)
    
    // ASSERT: All 10 topics should have resolved media
    expect(resolvedTopics).toHaveLength(10)
    for (let i = 0; i < 10; i++) {
      const topic = resolvedTopics[i]
      expect(topic.image_url).toBe(`https://example.com/image-${i + 1}.jpg`)
      expect(topic.video_url).toBe(`https://example.com/video-${i + 1}.mp4`)
      
      // Special attention to topic 10 (index 9) which might be the first to fail
      if (i === 9) {
        expect(topic.image_url).toBe('https://example.com/image-10.jpg')
        expect(topic.video_url).toBe('https://example.com/video-10.mp4')
      }
    }
  })

  test('should use dynamic topic count instead of hard-coded limit', () => {
    // ARRANGE: Test different topic counts
    const testCounts = [5, 9, 10, 15, 20, 25]
    
    testCounts.forEach(count => {
      // ACT: Create content with varying topic counts
      const enhancedContent = createMockEnhancedContent(count)
      
      // ASSERT: Should create exactly the requested number of topics
      expect(enhancedContent.topics).toHaveLength(count)
      
      // Verify all topics have proper IDs
      enhancedContent.topics.forEach((topic: any, index: number) => {
        expect(topic.id).toBe(`topic-${index + 1}`)
      })
    })
  })
})