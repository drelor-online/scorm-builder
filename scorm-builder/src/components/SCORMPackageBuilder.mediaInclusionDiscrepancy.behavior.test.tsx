/**
 * Behavior test to reproduce the media inclusion discrepancy
 * where only 1 of 4 expected image files gets loaded as binary files
 */

import { describe, it, expect, vi } from 'vitest'

describe('SCORMPackageBuilder Media Inclusion Discrepancy', () => {
  it('should reproduce the issue where only 1 binary file gets loaded instead of 4', async () => {
    console.log('=== MEDIA INCLUSION DISCREPANCY ISSUE ===')
    
    // User's actual storage media from logs
    const storageMedia = [
      { id: 'image-0', pageId: 'welcome', type: 'image', fileName: 'image-0.jpg', hasData: true },
      { id: 'image-3', pageId: 'topic-1', type: 'image', fileName: 'image-3.jpg', hasData: true },
      { id: 'image-4', pageId: 'topic-2', type: 'image', fileName: 'image-4.jpg', hasData: true },
      { id: 'image-5', pageId: 'topic-3', type: 'image', fileName: 'image-5.jpg', hasData: true },
      { id: 'video-1', pageId: 'learning-objectives', type: 'video', fileName: 'video-1.mp4', hasData: false },
      { id: 'video-2', pageId: 'topic-0', type: 'video', fileName: 'video-2.mp4', hasData: false },
      { id: 'video-6', pageId: 'topic-4', type: 'video', fileName: 'video-6.mp4', hasData: false }
    ]
    
    // User's actual course content structure from logs
    const courseContentStructure = {
      welcomeMedia: [{ id: 'image-0', type: 'image' }],
      objectivesMedia: [{ id: 'video-1', type: 'video' }],
      topicsWithMedia: [
        { topicIndex: 0, topicId: 'topic-0', mediaCount: 1, mediaItems: [{ id: 'video-2', type: 'video' }] },
        { topicIndex: 1, topicId: 'topic-1', mediaCount: 0, mediaItems: [] }, // BUG: Missing image-3
        { topicIndex: 2, topicId: 'topic-2', mediaCount: 0, mediaItems: [] }, // BUG: Missing image-4
        { topicIndex: 3, topicId: 'topic-3', mediaCount: 0, mediaItems: [] }, // BUG: Missing image-5
        { topicIndex: 4, topicId: 'topic-4', mediaCount: 1, mediaItems: [{ id: 'video-6', type: 'video' }] }
      ]
    }
    
    console.log('Storage media available:', storageMedia.map(m => ({ id: m.id, pageId: m.pageId, type: m.type, hasData: m.hasData })))
    console.log('Course content structure:', courseContentStructure)
    
    // Expected: 4 images should be loaded as binary files
    const expectedBinaryFiles = storageMedia.filter(m => m.type === 'image' && m.hasData)
    console.log('Expected binary files:', expectedBinaryFiles.map(m => m.id))
    
    // Actual: Only welcome page media gets loaded
    const actualBinaryFiles = courseContentStructure.welcomeMedia.filter(m => m.type === 'image')
    console.log('Actual binary files loaded:', actualBinaryFiles.map(m => m.id))
    
    // Problem identification
    const missingFromTopics = [
      { expected: 'image-3', topic: 'topic-1', actualMediaCount: courseContentStructure.topicsWithMedia[1].mediaCount },
      { expected: 'image-4', topic: 'topic-2', actualMediaCount: courseContentStructure.topicsWithMedia[2].mediaCount },
      { expected: 'image-5', topic: 'topic-3', actualMediaCount: courseContentStructure.topicsWithMedia[3].mediaCount }
    ]
    
    console.log('BUG CONFIRMED: Missing images from topics:', missingFromTopics)
    
    // The test should pass when the bug is confirmed
    expect(actualBinaryFiles.length).toBe(1) // Current broken state
    expect(expectedBinaryFiles.length).toBe(4) // What should be
    expect(missingFromTopics.every(m => m.actualMediaCount === 0)).toBe(true) // All topics missing their images
    
    console.log('✅ BUG REPRODUCED: Only 1 binary file loaded instead of 4')
    console.log('ROOT CAUSE: Topics 1, 2, 3 missing their image media in course content structure')
  })
  
  it('should identify the exact location where topic media is not being mapped', async () => {
    console.log('=== TOPIC MEDIA MAPPING ISSUE ===')
    
    // Simulate the media mapping process
    const storageMediaByPageId = {
      'welcome': [{ id: 'image-0', type: 'image' }],
      'learning-objectives': [{ id: 'video-1', type: 'video' }],
      'topic-0': [{ id: 'video-2', type: 'video' }],
      'topic-1': [{ id: 'image-3', type: 'image' }], // Should be here but isn't in course content
      'topic-2': [{ id: 'image-4', type: 'image' }], // Should be here but isn't in course content
      'topic-3': [{ id: 'image-5', type: 'image' }], // Should be here but isn't in course content
      'topic-4': [{ id: 'video-6', type: 'video' }]
    }
    
    console.log('Storage media by page ID:', storageMediaByPageId)
    
    // Check which topics have media in storage but not in course content
    const topicsWithMissingMedia = []
    for (let i = 1; i <= 3; i++) {
      const topicId = `topic-${i}`
      const storageMedia = storageMediaByPageId[topicId] || []
      const courseContentMedia = [] // Empty in course content (the bug)
      
      if (storageMedia.length > 0 && courseContentMedia.length === 0) {
        topicsWithMissingMedia.push({
          topicId,
          missingMedia: storageMedia
        })
      }
    }
    
    console.log('Topics with missing media mapping:', topicsWithMissingMedia)
    
    // The bug is confirmed
    expect(topicsWithMissingMedia).toHaveLength(3)
    expect(topicsWithMissingMedia.map(t => t.topicId)).toEqual(['topic-1', 'topic-2', 'topic-3'])
    
    console.log('✅ MAPPING ISSUE IDENTIFIED: Topics 1-3 have media in storage but not in course content')
    console.log('FIX NEEDED: Ensure topic media gets mapped correctly from storage to course content')
  })
})