/**
 * Test for page-based media ID generation
 * This test MUST FAIL first to prove we need the fix
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as idGenerator from '../idGenerator'

describe('Page-based media ID generation', () => {
  beforeEach(() => {
    // Reset counters before each test
    idGenerator.__resetCounters()
  })

  describe('Images should use page-based indexing', () => {
    it('should generate page-specific image IDs for welcome page', () => {
      const id1 = idGenerator.generateMediaId('image', 'welcome')
      const id2 = idGenerator.generateMediaId('image', 'welcome')
      
      // Images on the same page should have consistent page-based IDs
      expect(id1).toBe('image-0') // Welcome page = index 0
      expect(id2).toBe('image-0') // Should be the same for the same page
    })

    it('should generate page-specific image IDs for objectives page', () => {
      const id1 = idGenerator.generateMediaId('image', 'objectives')
      const id2 = idGenerator.generateMediaId('image', 'objectives')
      
      expect(id1).toBe('image-1') // Objectives page = index 1
      expect(id2).toBe('image-1') // Should be the same for the same page
    })

    it('should generate page-specific image IDs for topic pages', () => {
      const topic0Id = idGenerator.generateMediaId('image', 'topic-0')
      const topic1Id = idGenerator.generateMediaId('image', 'topic-1')
      const topic0IdAgain = idGenerator.generateMediaId('image', 'topic-0')
      
      expect(topic0Id).toBe('image-2') // Topic 0 (first topic) = index 2
      expect(topic1Id).toBe('image-3') // Topic 1 (second topic) = index 3
      expect(topic0IdAgain).toBe('image-2') // Same as first topic-0 call
    })

    it('should not increment counter on re-renders', () => {
      // Simulate multiple component re-renders for the same page
      const ids = []
      for (let i = 0; i < 5; i++) {
        ids.push(idGenerator.generateMediaId('image', 'welcome'))
      }
      
      // All IDs should be the same
      expect(ids).toEqual(['image-0', 'image-0', 'image-0', 'image-0', 'image-0'])
    })
  })

  describe('Videos should use page-based indexing', () => {
    it('should generate page-specific video IDs for welcome page', () => {
      const id1 = idGenerator.generateMediaId('video', 'welcome')
      const id2 = idGenerator.generateMediaId('video', 'welcome')
      
      expect(id1).toBe('video-0') // Welcome page = index 0
      expect(id2).toBe('video-0') // Should be the same for the same page
    })

    it('should generate page-specific video IDs for objectives page', () => {
      const id1 = idGenerator.generateMediaId('video', 'objectives')
      const id2 = idGenerator.generateMediaId('video', 'objectives')
      
      expect(id1).toBe('video-1') // Objectives page = index 1
      expect(id2).toBe('video-1') // Should be the same for the same page
    })

    it('should generate page-specific video IDs for topic pages', () => {
      const topic0Id = idGenerator.generateMediaId('video', 'topic-0')
      const topic1Id = idGenerator.generateMediaId('video', 'topic-1')
      const topic0IdAgain = idGenerator.generateMediaId('video', 'topic-0')
      
      expect(topic0Id).toBe('video-2') // Topic 0 (first topic) = index 2
      expect(topic1Id).toBe('video-3') // Topic 1 (second topic) = index 3
      expect(topic0IdAgain).toBe('video-2') // Same as first topic-0 call
    })

    it('should not increment counter on re-renders', () => {
      // Simulate multiple component re-renders for the same page
      const ids = []
      for (let i = 0; i < 5; i++) {
        ids.push(idGenerator.generateMediaId('video', 'objectives'))
      }
      
      // All IDs should be the same
      expect(ids).toEqual(['video-1', 'video-1', 'video-1', 'video-1', 'video-1'])
    })
  })

  describe('Cross-media consistency', () => {
    it('should use the same page index for all media types', () => {
      const imageId = idGenerator.generateMediaId('image', 'topic-0')
      const videoId = idGenerator.generateMediaId('video', 'topic-0')
      const audioId = idGenerator.generateMediaId('audio', 'topic-0')
      const captionId = idGenerator.generateMediaId('caption', 'topic-0')
      
      // All should use index 2 for topic-0 (first topic)
      expect(imageId).toBe('image-2')
      expect(videoId).toBe('video-2')
      expect(audioId).toBe('audio-2')
      expect(captionId).toBe('caption-2')
    })

    it('should handle mixed media operations without interference', () => {
      // Add various media to different pages
      const welcomeImage = idGenerator.generateMediaId('image', 'welcome')
      const objectivesVideo = idGenerator.generateMediaId('video', 'objectives')
      const topic0Audio = idGenerator.generateMediaId('audio', 'topic-0')
      const welcomeVideo = idGenerator.generateMediaId('video', 'welcome')
      const topic0Image = idGenerator.generateMediaId('image', 'topic-0')
      
      expect(welcomeImage).toBe('image-0')
      expect(objectivesVideo).toBe('video-1')
      expect(topic0Audio).toBe('audio-2')
      expect(welcomeVideo).toBe('video-0')
      expect(topic0Image).toBe('image-2')
    })
  })

  describe('Edge cases', () => {
    it('should handle content-0 and content-1 aliases', () => {
      const content0Image = idGenerator.generateMediaId('image', 'content-0')
      const welcomeImage = idGenerator.generateMediaId('image', 'welcome')
      
      expect(content0Image).toBe('image-0')
      expect(welcomeImage).toBe('image-0')
      
      const content1Video = idGenerator.generateMediaId('video', 'content-1')
      const objectivesVideo = idGenerator.generateMediaId('video', 'objectives')
      
      expect(content1Video).toBe('video-1')
      expect(objectivesVideo).toBe('video-1')
    })

    it('should handle learning-objectives alias', () => {
      const learningObjectivesImage = idGenerator.generateMediaId('image', 'learning-objectives')
      const objectivesImage = idGenerator.generateMediaId('image', 'objectives')
      
      expect(learningObjectivesImage).toBe('image-1')
      expect(objectivesImage).toBe('image-1')
    })
  })
})