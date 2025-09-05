/**
 * Integration test for courseContentMediaCleaner to verify complete cleanup
 * Tests the enhanced deep scanning and aggressive cleanup functionality
 */

import { describe, it, expect } from 'vitest'
import { 
  cleanMediaReferencesFromCourseContent, 
  hasMediaReferences, 
  countMediaReferences,
  type CourseContentWithMedia 
} from './courseContentMediaCleaner'

describe('CourseContentMediaCleaner - Enhanced Integration Tests', () => {
  const SAMPLE_COURSE_CONTENT: CourseContentWithMedia = {
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
    "learningObjectivesPage": {
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
            "id": "image-0", // Same as welcome page
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

  it('should detect media references before cleanup', () => {
    const hasMedia = hasMediaReferences(SAMPLE_COURSE_CONTENT)
    const mediaCount = countMediaReferences(SAMPLE_COURSE_CONTENT)
    
    console.log('Before cleanup - hasMedia:', hasMedia, 'count:', mediaCount)
    
    expect(hasMedia).toBe(true)
    expect(mediaCount).toBe(3) // 1 + 1 + 1 media references
  })

  it('should completely remove all media references with aggressive cleanup', () => {
    console.log('Testing enhanced cleanup with deep scanning...')
    
    const cleaned = cleanMediaReferencesFromCourseContent(SAMPLE_COURSE_CONTENT)
    
    expect(cleaned).not.toBeNull()
    
    // Should completely remove all media arrays
    expect(cleaned!.welcomePage.media).toBeUndefined()
    expect(cleaned!.learningObjectivesPage!.media).toBeUndefined()
    expect(cleaned!.topics![0].media).toBeUndefined()
    
    // Verify using our detection functions
    const hasMediaAfter = hasMediaReferences(cleaned)
    const countAfter = countMediaReferences(cleaned)
    
    console.log('After cleanup - hasMedia:', hasMediaAfter, 'count:', countAfter)
    
    expect(hasMediaAfter).toBe(false)
    expect(countAfter).toBe(0)
  })

  it('should handle deep nested structures', () => {
    const deepNestedContent = {
      topics: [
        {
          id: 'topic-1',
          sections: [
            {
              id: 'section-1',
              media: [{ id: 'nested-image-1' }],
              subsections: [
                {
                  id: 'subsection-1', 
                  media: [{ id: 'deeply-nested-image-1' }]
                }
              ]
            }
          ]
        }
      ]
    }
    
    const hasMediaBefore = hasMediaReferences(deepNestedContent)
    const countBefore = countMediaReferences(deepNestedContent)
    
    console.log('Deep nested before - hasMedia:', hasMediaBefore, 'count:', countBefore)
    
    expect(hasMediaBefore).toBe(true)
    expect(countBefore).toBe(2)
    
    const cleaned = cleanMediaReferencesFromCourseContent(deepNestedContent)
    
    const hasMediaAfter = hasMediaReferences(cleaned)
    const countAfter = countMediaReferences(cleaned)
    
    console.log('Deep nested after - hasMedia:', hasMediaAfter, 'count:', countAfter)
    
    expect(hasMediaAfter).toBe(false)
    expect(countAfter).toBe(0)
  })

  it('should handle both learningObjectivesPage and objectivesPage naming patterns', () => {
    const contentWithBothNamingPatterns = {
      learningObjectivesPage: {
        media: [{ id: 'learning-image-1' }]
      },
      objectivesPage: {
        media: [{ id: 'objectives-image-1' }]  
      }
    }
    
    const hasMediaBefore = hasMediaReferences(contentWithBothNamingPatterns)
    const countBefore = countMediaReferences(contentWithBothNamingPatterns)
    
    console.log('Both naming patterns before - hasMedia:', hasMediaBefore, 'count:', countBefore)
    
    expect(hasMediaBefore).toBe(true)
    expect(countBefore).toBe(2)
    
    const cleaned = cleanMediaReferencesFromCourseContent(contentWithBothNamingPatterns)
    
    const hasMediaAfter = hasMediaReferences(cleaned)
    const countAfter = countMediaReferences(cleaned)
    
    console.log('Both naming patterns after - hasMedia:', hasMediaAfter, 'count:', countAfter)
    
    expect(hasMediaAfter).toBe(false)
    expect(countAfter).toBe(0)
  })

  it('should handle null/undefined input gracefully', () => {
    expect(cleanMediaReferencesFromCourseContent(null)).toBeNull()
    expect(hasMediaReferences(null)).toBe(false)
    expect(countMediaReferences(null)).toBe(0)
  })

  it('should preserve non-media properties while cleaning media arrays', () => {
    const contentWithMixedProperties = {
      welcomePage: {
        title: 'Important Title',
        content: 'Important Content',
        metadata: { author: 'Test Author' },
        media: [{ id: 'image-to-remove' }]
      }
    }
    
    const cleaned = cleanMediaReferencesFromCourseContent(contentWithMixedProperties)
    
    // Should preserve all non-media properties
    expect(cleaned!.welcomePage.title).toBe('Important Title')
    expect(cleaned!.welcomePage.content).toBe('Important Content')
    expect(cleaned!.welcomePage.metadata).toEqual({ author: 'Test Author' })
    
    // Should remove media
    expect(cleaned!.welcomePage.media).toBeUndefined()
    expect(hasMediaReferences(cleaned)).toBe(false)
  })
})