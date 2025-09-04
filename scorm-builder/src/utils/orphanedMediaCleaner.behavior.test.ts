/**
 * Test for orphaned media references cleanup utility
 * 
 * This test verifies that when JSON contains references to deleted media files,
 * those references are automatically cleaned up during import/validation.
 * 
 * Reproduces the user's issue:
 * 1. Course content cleared → media files deleted  
 * 2. JSON imported with same media IDs → should clean up orphaned references
 * 3. Components try to load non-existent media → should not happen after cleanup
 */

import { describe, it, expect, vi } from 'vitest'
import { cleanupOrphanedMediaReferences, MediaExistsChecker } from './orphanedMediaCleaner'

describe('Orphaned Media References Cleanup', () => {
  const SAMPLE_COURSE_CONTENT = {
    "welcomePage": {
      "title": "Welcome to Complex Projects - 12 - Electrical Power Design", 
      "content": "This course covers electrical power design...",
      "media": [
        {
          "id": "image-0",
          "type": "image",
          "url": "blob:http://localhost:1420/fake-url-1",
          "originalName": "deleted-image.jpg"
        }
      ]
    },
    "learningObjectives": {
      "title": "Learning Objectives",
      "objectives": ["Understand electrical systems"],
      "media": [
        {
          "id": "image-1",
          "type": "image", 
          "url": "blob:http://localhost:1420/fake-url-2",
          "originalName": "another-deleted-image.jpg"
        }
      ]
    },
    "topics": [
      {
        "id": "topic-1",
        "title": "Load List Development",
        "content": "Develop load lists...",
        "media": [
          {
            "id": "image-0", // Same as welcome page - orphaned reference
            "type": "image",
            "url": "blob:http://localhost:1420/fake-url-1", 
            "originalName": "deleted-image.jpg"
          }
        ]
      }
    ],
    "assessment": {
      "questions": []
    }
  }

  it('should demonstrate problem without cleanup utility - what would happen with old approach', async () => {
    // Mock media existence checker - both media files are deleted
    const mockMediaExistsChecker: MediaExistsChecker = vi.fn(async (mediaId: string) => {
      // Simulate that these media files were deleted during course content clearing
      if (mediaId === 'image-0' || mediaId === 'image-1') {
        return false // Media doesn't exist
      }
      return true
    })

    // Simulate OLD behavior - no cleanup, just return content as-is
    const oldBehaviorResult = { 
      cleanedContent: SAMPLE_COURSE_CONTENT, 
      removedMediaIds: [] as string[]
    }

    // OLD BEHAVIOR: Orphaned references would be preserved (the problem we're fixing)
    expect(oldBehaviorResult.cleanedContent.welcomePage.media).toHaveLength(1)
    expect(oldBehaviorResult.cleanedContent.welcomePage.media[0].id).toBe('image-0')
    
    expect(oldBehaviorResult.cleanedContent.learningObjectives.media).toHaveLength(1) 
    expect(oldBehaviorResult.cleanedContent.learningObjectives.media[0].id).toBe('image-1')
    
    expect(oldBehaviorResult.cleanedContent.topics[0].media).toHaveLength(1)
    expect(oldBehaviorResult.cleanedContent.topics[0].media[0].id).toBe('image-0')
    
    expect(oldBehaviorResult.removedMediaIds).toEqual([])

    // Now demonstrate our NEW utility fixes this
    const newBehaviorResult = await cleanupOrphanedMediaReferences(SAMPLE_COURSE_CONTENT, mockMediaExistsChecker)
    
    // NEW BEHAVIOR: Orphaned references are cleaned up ✅
    expect(newBehaviorResult.cleanedContent.welcomePage.media).toEqual([])
    expect(newBehaviorResult.cleanedContent.learningObjectives.media).toEqual([])
    expect(newBehaviorResult.cleanedContent.topics[0].media).toEqual([])
    expect(newBehaviorResult.removedMediaIds).toEqual(expect.arrayContaining(['image-0', 'image-1']))

    console.log('✅ COMPARISON: New utility successfully fixes the orphaned media problem')
  })

  it('should clean up orphaned media references (desired behavior after fix)', async () => {
    const mockMediaExistsChecker: MediaExistsChecker = vi.fn(async (mediaId: string) => {
      if (mediaId === 'image-0' || mediaId === 'image-1') {
        return false // These media files were deleted
      }
      return true
    })

    const result = await cleanupOrphanedMediaReferences(SAMPLE_COURSE_CONTENT, mockMediaExistsChecker)

    // DESIRED BEHAVIOR: Orphaned media references should be removed
    // This test will FAIL until we implement the fix (Green phase)
    
    expect(result.cleanedContent.welcomePage.media).toEqual([])
    expect(result.cleanedContent.learningObjectives.media).toEqual([])
    expect(result.cleanedContent.topics[0].media).toEqual([])
    
    // Should report which media IDs were removed
    expect(result.removedMediaIds).toEqual(expect.arrayContaining(['image-0', 'image-1']))

    console.log('✅ GREEN PHASE: Orphaned media references are cleaned up automatically')
  })

  it('should preserve valid media references and only remove orphaned ones', async () => {
    const mixedContent = {
      ...SAMPLE_COURSE_CONTENT,
      welcomePage: {
        ...SAMPLE_COURSE_CONTENT.welcomePage,
        media: [
          SAMPLE_COURSE_CONTENT.welcomePage.media[0], // image-0 (orphaned)
          { id: 'image-valid', type: 'image', url: 'blob:valid', originalName: 'valid.jpg' } // valid
        ]
      }
    }

    const mockMediaExistsChecker: MediaExistsChecker = vi.fn(async (mediaId: string) => {
      if (mediaId === 'image-0' || mediaId === 'image-1') {
        return false // Orphaned
      }
      if (mediaId === 'image-valid') {
        return true // Valid
      }
      return false
    })

    const result = await cleanupOrphanedMediaReferences(mixedContent, mockMediaExistsChecker)

    // Should keep valid media and remove orphaned media
    expect(result.cleanedContent.welcomePage.media).toHaveLength(1)
    expect(result.cleanedContent.welcomePage.media[0].id).toBe('image-valid')
    
    // Other pages should have orphaned references cleaned up
    expect(result.cleanedContent.learningObjectives.media).toEqual([])
    expect(result.cleanedContent.topics[0].media).toEqual([])
    
    // Should report only orphaned media as removed
    expect(result.removedMediaIds).toEqual(expect.arrayContaining(['image-0', 'image-1']))
    expect(result.removedMediaIds).not.toContain('image-valid')

    console.log('✅ GREEN PHASE: Mixed scenario - valid media preserved, orphaned removed')
  })

  it('should handle deep nested media references in topics', async () => {
    const contentWithNestedMedia = {
      topics: [
        {
          id: 'topic-1', 
          title: 'Topic 1',
          content: 'Content...',
          media: [
            { id: 'image-orphaned', type: 'image' },
            { id: 'image-valid', type: 'image' }
          ],
          subtopics: [
            {
              id: 'subtopic-1',
              media: [
                { id: 'image-orphaned', type: 'image' }, // Same orphaned reference
                { id: 'audio-orphaned', type: 'audio' }
              ]
            }
          ]
        }
      ]
    }

    const mockMediaExistsChecker: MediaExistsChecker = vi.fn(async (mediaId: string) => {
      if (mediaId === 'image-orphaned' || mediaId === 'audio-orphaned') {
        return false // Orphaned
      }
      if (mediaId === 'image-valid') {
        return true // Valid
      }
      return false
    })

    const result = await cleanupOrphanedMediaReferences(contentWithNestedMedia, mockMediaExistsChecker)

    // Should clean up orphaned references at all levels
    expect(result.cleanedContent.topics[0].media).toHaveLength(1)
    expect(result.cleanedContent.topics[0].media[0].id).toBe('image-valid')
    
    expect(result.cleanedContent.topics[0].subtopics[0].media).toEqual([])
    
    expect(result.removedMediaIds).toEqual(expect.arrayContaining(['image-orphaned', 'audio-orphaned']))

    console.log('✅ GREEN PHASE: Deep nested media references are cleaned up properly')
  })
})