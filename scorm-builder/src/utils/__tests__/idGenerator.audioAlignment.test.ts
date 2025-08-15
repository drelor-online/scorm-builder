import { describe, it, expect, beforeEach } from 'vitest'
import { generateMediaId, __resetCounters } from '../idGenerator'

describe('idGenerator - Audio File Alignment', () => {
  beforeEach(() => {
    // Reset counters before each test
    __resetCounters()
  })

  it('should generate correct audio IDs for all pages in sequence', () => {
    // Welcome page should get audio-0
    const welcomeAudioId = generateMediaId('audio', 'welcome')
    expect(welcomeAudioId).toBe('audio-0')
    
    // Objectives page should get audio-1
    const objectivesAudioId = generateMediaId('audio', 'objectives')
    expect(objectivesAudioId).toBe('audio-1')
    
    // Topic 0 (first topic) should get audio-2
    const topic0AudioId = generateMediaId('audio', 'topic-0')
    expect(topic0AudioId).toBe('audio-2')
    
    // Topic 1 (second topic) should get audio-3
    const topic1AudioId = generateMediaId('audio', 'topic-1')
    expect(topic1AudioId).toBe('audio-3')
    
    // Topic 2 (third topic) should get audio-4
    const topic2AudioId = generateMediaId('audio', 'topic-2')
    expect(topic2AudioId).toBe('audio-4')
  })

  it('should generate correct caption IDs for all pages in sequence', () => {
    // Welcome page should get caption-0
    const welcomeCaptionId = generateMediaId('caption', 'welcome')
    expect(welcomeCaptionId).toBe('caption-0')
    
    // Objectives page should get caption-1
    const objectivesCaptionId = generateMediaId('caption', 'objectives')
    expect(objectivesCaptionId).toBe('caption-1')
    
    // Topic 0 (first topic) should get caption-2
    const topic0CaptionId = generateMediaId('caption', 'topic-0')
    expect(topic0CaptionId).toBe('caption-2')
    
    // Topic 1 (second topic) should get caption-3
    const topic1CaptionId = generateMediaId('caption', 'topic-1')
    expect(topic1CaptionId).toBe('caption-3')
    
    // Topic 2 (third topic) should get caption-4
    const topic2CaptionId = generateMediaId('caption', 'topic-2')
    expect(topic2CaptionId).toBe('caption-4')
  })

  it('should maintain consistency between audio and caption IDs', () => {
    const pages = [
      { id: 'welcome', expectedIndex: 0 },
      { id: 'objectives', expectedIndex: 1 },
      { id: 'topic-0', expectedIndex: 2 },
      { id: 'topic-1', expectedIndex: 3 },
      { id: 'topic-2', expectedIndex: 4 },
      { id: 'topic-3', expectedIndex: 5 }
    ]
    
    pages.forEach(({ id: pageId, expectedIndex }) => {
      const audioId = generateMediaId('audio', pageId)
      const captionId = generateMediaId('caption', pageId)
      
      // Audio and caption should have the same index
      expect(audioId).toBe(`audio-${expectedIndex}`)
      expect(captionId).toBe(`caption-${expectedIndex}`)
    })
  })

  it('should handle multiple calls for the same page consistently', () => {
    // First call
    const firstCall = generateMediaId('audio', 'topic-1')
    expect(firstCall).toBe('audio-3')
    
    // Second call for the same page should return the same ID
    const secondCall = generateMediaId('audio', 'topic-1')
    expect(secondCall).toBe('audio-3')
    
    // Third call for the same page should also return the same ID
    const thirdCall = generateMediaId('audio', 'topic-1')
    expect(thirdCall).toBe('audio-3')
  })

  it('should handle different page ID formats', () => {
    // Test with content-0 (alternate format for welcome)
    const content0 = generateMediaId('audio', 'content-0')
    expect(content0).toBe('audio-0')
    
    // Test with content-1 (alternate format for objectives)
    const content1 = generateMediaId('audio', 'content-1')
    expect(content1).toBe('audio-1')
    
    // Test with learning-objectives (another alternate format)
    const learningObjectives = generateMediaId('audio', 'learning-objectives')
    expect(learningObjectives).toBe('audio-1')
  })

  it('should handle topics with different numbering correctly', () => {
    // Topics are 0-indexed (topic-0 is first topic, topic-1 is second, etc.)
    const topic0 = generateMediaId('audio', 'topic-0')
    const topic1 = generateMediaId('audio', 'topic-1')
    const topic2 = generateMediaId('audio', 'topic-2')
    const topic10 = generateMediaId('audio', 'topic-10')
    
    // Topic 0 (first topic) should be at index 2 (after welcome=0, objectives=1)
    expect(topic0).toBe('audio-2')
    // Topic 1 (second topic) should be at index 3
    expect(topic1).toBe('audio-3')
    // Topic 2 (third topic) should be at index 4
    expect(topic2).toBe('audio-4')
    // Topic 10 should be at index 12
    expect(topic10).toBe('audio-12')
  })

  describe('Reproducing the reported bug', () => {
    it('should NOT have learning objectives page getting topic 1 audio', () => {
      // This test reproduces the reported issue
      // User reports: "learning objectives page had the topic 1 audio"
      
      // Generate IDs in the order they would be generated during upload
      const welcomeAudio = generateMediaId('audio', 'welcome')
      const objectivesAudio = generateMediaId('audio', 'objectives')
      const topic0Audio = generateMediaId('audio', 'topic-0')  // First topic
      const topic1Audio = generateMediaId('audio', 'topic-1')  // Second topic
      
      // The objectives page should get audio-1, not audio-2 (which is topic-0's audio)
      expect(objectivesAudio).toBe('audio-1')
      expect(objectivesAudio).not.toBe(topic0Audio)
      
      // Topic 0 (first topic) should get audio-2
      expect(topic0Audio).toBe('audio-2')
      
      // Topic 1 (second topic) should get audio-3
      expect(topic1Audio).toBe('audio-3')
      
      // Verify they are all different
      const allIds = [welcomeAudio, objectivesAudio, topic0Audio, topic1Audio]
      const uniqueIds = new Set(allIds)
      expect(uniqueIds.size).toBe(allIds.length)
    })
  })
})