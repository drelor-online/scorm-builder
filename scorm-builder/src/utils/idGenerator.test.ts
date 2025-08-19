import { describe, it, expect, beforeEach } from 'vitest'
import { generateMediaId, __resetCounters } from './idGenerator'

describe('Media ID Generation', () => {
  beforeEach(() => {
    __resetCounters()
  })
  
  it('should generate unique IDs for welcome, objectives, and topic-0', () => {
    // Welcome page should get index 0
    const welcomeId = generateMediaId('image', 'welcome')
    expect(welcomeId).toBe('image-0')
    
    // Objectives page should get index 1
    const objectivesId = generateMediaId('image', 'objectives')
    expect(objectivesId).toBe('image-1')
    
    // Topic-0 should get index 2 (not 1!)
    const topic0Id = generateMediaId('image', 'topic-0')
    expect(topic0Id).toBe('image-2')
    
    // Topic-1 should get index 3
    const topic1Id = generateMediaId('image', 'topic-1')
    expect(topic1Id).toBe('image-3')
  })
  
  it('should handle learning-objectives as alias for objectives', () => {
    const id1 = generateMediaId('image', 'learning-objectives')
    expect(id1).toBe('image-1')
    
    const id2 = generateMediaId('image', 'objectives')
    expect(id2).toBe('image-1')
  })
  
  it('should handle content-0 and content-1 aliases', () => {
    const id0 = generateMediaId('image', 'content-0')
    expect(id0).toBe('image-0')
    
    const id1 = generateMediaId('image', 'content-1')
    expect(id1).toBe('image-1')
  })
  
  it('should work for all media types', () => {
    expect(generateMediaId('audio', 'topic-0')).toBe('audio-2')
    expect(generateMediaId('video', 'topic-0')).toBe('video-2')
    expect(generateMediaId('caption', 'topic-0')).toBe('caption-2')
  })
})