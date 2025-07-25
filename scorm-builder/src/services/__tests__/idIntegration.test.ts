import { describe, it, expect } from 'vitest'
import { generateContentId, generateMediaId, getPageIndex } from '../idGenerator'

describe('ID Integration Tests', () => {
  it('should generate consistent IDs for all pages and media', () => {
    // Welcome page
    expect(generateContentId('welcome')).toBe('content-0')
    expect(generateMediaId('audio', getPageIndex('welcome'))).toBe('audio-0')
    expect(generateMediaId('caption', getPageIndex('welcome'))).toBe('caption-0')
    
    // Objectives page
    expect(generateContentId('objectives')).toBe('content-1')
    expect(generateMediaId('audio', getPageIndex('objectives'))).toBe('audio-1')
    expect(generateMediaId('caption', getPageIndex('objectives'))).toBe('caption-1')
    
    // Topics
    for (let i = 0; i < 5; i++) {
      expect(generateContentId('topic', i)).toBe(`content-${2 + i}`)
      expect(generateMediaId('audio', getPageIndex('topic', i))).toBe(`audio-${2 + i}`)
      expect(generateMediaId('caption', getPageIndex('topic', i))).toBe(`caption-${2 + i}`)
    }
  })
  
  it('should ensure no ID collisions between different content types', () => {
    const contentIds = new Set()
    const audioIds = new Set()
    const captionIds = new Set()
    
    // Add all page IDs
    contentIds.add(generateContentId('welcome'))
    contentIds.add(generateContentId('objectives'))
    
    audioIds.add(generateMediaId('audio', getPageIndex('welcome')))
    audioIds.add(generateMediaId('audio', getPageIndex('objectives')))
    
    captionIds.add(generateMediaId('caption', getPageIndex('welcome')))
    captionIds.add(generateMediaId('caption', getPageIndex('objectives')))
    
    // Add topic IDs
    for (let i = 0; i < 10; i++) {
      contentIds.add(generateContentId('topic', i))
      audioIds.add(generateMediaId('audio', getPageIndex('topic', i)))
      captionIds.add(generateMediaId('caption', getPageIndex('topic', i)))
    }
    
    // Check no duplicates within each type
    expect(contentIds.size).toBe(12) // 2 pages + 10 topics
    expect(audioIds.size).toBe(12)
    expect(captionIds.size).toBe(12)
    
    // Check prefixes are different
    const allContentIds = Array.from(contentIds)
    const allAudioIds = Array.from(audioIds)
    const allCaptionIds = Array.from(captionIds)
    
    expect(allContentIds.every(id => id.startsWith('content-'))).toBe(true)
    expect(allAudioIds.every(id => id.startsWith('audio-'))).toBe(true)
    expect(allCaptionIds.every(id => id.startsWith('caption-'))).toBe(true)
  })
})