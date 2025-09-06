/**
 * Tests for the fixed courseContentMediaCleaner
 * 
 * This test suite verifies that the media cleaner works correctly with
 * immutable patterns and doesn't suffer from React state mutation issues.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  cleanMediaReferencesFromCourseContent, 
  hasMediaReferences, 
  countMediaReferences 
} from './courseContentMediaCleaner'

describe('courseContentMediaCleaner - Fixed Version', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock the logger to prevent console output during tests
    vi.doMock('./ultraSimpleLogger', () => ({
      debugLogger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    }))
  })

  it('should handle null/undefined input gracefully', () => {
    expect(cleanMediaReferencesFromCourseContent(null)).toBe(null)
    expect(cleanMediaReferencesFromCourseContent(undefined as any)).toBe(null)
  })

  it('should remove media references using immutable patterns', () => {
    const courseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<p>Welcome</p>',
        media: [
          { id: 'image-0', type: 'image', url: '', title: 'Image 1', pageId: 'welcome' },
          { id: 'image-1', type: 'image', url: '', title: 'Image 2', pageId: 'welcome' }
        ]
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: '<p>Objectives</p>',
        media: [
          { id: 'audio-0', type: 'audio', url: '', title: 'Objectives Audio', pageId: 'objectives' }
        ]
      },
      topics: [
        {
          id: 'topic-0',
          title: 'Topic 1',
          content: '<p>Topic content</p>',
          media: [
            { id: 'video-0', type: 'video', url: '', title: 'Topic Video', pageId: 'topic-0' }
          ]
        }
      ]
    }

    const originalContent = JSON.stringify(courseContent) // For comparison

    const cleaned = cleanMediaReferencesFromCourseContent(courseContent)

    // Verify original object is unchanged (immutability)
    expect(JSON.stringify(courseContent)).toBe(originalContent)

    // Verify cleaned object has no media references
    expect(cleaned?.welcomePage?.media).toBeUndefined()
    expect(cleaned?.learningObjectivesPage?.media).toBeUndefined()
    expect(cleaned?.topics?.[0]?.media).toBeUndefined()

    // Verify other properties are preserved
    expect(cleaned?.welcomePage?.title).toBe('Welcome')
    expect(cleaned?.learningObjectivesPage?.title).toBe('Objectives')
    expect(cleaned?.topics?.[0]?.title).toBe('Topic 1')
  })

  it('should handle React state-like objects (frozen/proxied)', () => {
    const courseContent = {
      welcomePage: Object.freeze({
        id: 'welcome',
        title: 'Welcome',
        content: '<p>Welcome</p>',
        media: Object.freeze([
          Object.freeze({ id: 'image-0', type: 'image', url: '', title: 'Image 1', pageId: 'welcome' })
        ])
      }),
      topics: Object.freeze([
        Object.freeze({
          id: 'topic-0',
          title: 'Topic 1',
          content: '<p>Topic content</p>',
          media: Object.freeze([
            Object.freeze({ id: 'video-0', type: 'video', url: '', title: 'Topic Video', pageId: 'topic-0' })
          ])
        })
      ])
    }

    // This should NOT throw errors even with frozen objects
    expect(() => {
      const cleaned = cleanMediaReferencesFromCourseContent(courseContent)
      
      // Verify cleaning worked despite frozen input
      expect(cleaned?.welcomePage?.media).toBeUndefined()
      expect(cleaned?.topics?.[0]?.media).toBeUndefined()
      
      // Verify structure preserved
      expect(cleaned?.welcomePage?.title).toBe('Welcome')
      expect(cleaned?.topics?.[0]?.title).toBe('Topic 1')
    }).not.toThrow()
  })

  it('should handle circular reference issues gracefully', () => {
    const courseContent: any = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<p>Welcome</p>',
        media: [
          { id: 'image-0', type: 'image', url: '', title: 'Image 1', pageId: 'welcome' }
        ]
      }
    }
    
    // Create circular reference (this could happen in complex React state)
    courseContent.self = courseContent

    // Should handle this gracefully - our implementation throws with a clear error message
    expect(() => {
      cleanMediaReferencesFromCourseContent(courseContent)
    }).toThrow(/Media cleaning failed/)
  })

  it('should work with complex nested structures', () => {
    const courseContent = {
      welcomePage: {
        id: 'welcome',
        nestedObject: {
          deeplyNested: {
            media: [{ id: 'nested-media', type: 'image' }] // This should be cleaned too
          }
        },
        media: [{ id: 'welcome-media', type: 'image' }]
      },
      customSections: [
        {
          name: 'Custom',
          subsections: [
            {
              media: [{ id: 'custom-media', type: 'video' }] // Should be cleaned
            }
          ]
        }
      ],
      topics: [
        {
          id: 'topic-0',
          knowledgeCheck: {
            questions: [
              {
                id: 'q1',
                media: [{ id: 'question-media', type: 'image' }] // Should be cleaned
              }
            ]
          },
          media: [{ id: 'topic-media', type: 'audio' }]
        }
      ]
    }

    const cleaned = cleanMediaReferencesFromCourseContent(courseContent)

    // Verify ALL media arrays are removed, regardless of nesting
    expect(cleaned?.welcomePage?.media).toBeUndefined()
    expect(cleaned?.welcomePage?.nestedObject?.deeplyNested?.media).toBeUndefined()
    expect(cleaned?.customSections?.[0]?.subsections?.[0]?.media).toBeUndefined()
    expect(cleaned?.topics?.[0]?.media).toBeUndefined()
    expect(cleaned?.topics?.[0]?.knowledgeCheck?.questions?.[0]?.media).toBeUndefined()

    // Verify structure is preserved
    expect(cleaned?.welcomePage?.id).toBe('welcome')
    expect(cleaned?.topics?.[0]?.id).toBe('topic-0')
    expect(cleaned?.topics?.[0]?.knowledgeCheck?.questions?.[0]?.id).toBe('q1')
  })

  it('should provide detailed error information on failure', () => {
    // Test with an object that would cause JSON.stringify to fail (circular reference)
    const problematicContent: any = {
      welcomePage: {
        media: [{ id: 'test', type: 'image' }]
      }
    }
    // Create circular reference to force JSON.stringify to fail
    problematicContent.welcomePage.circular = problematicContent

    expect(() => {
      cleanMediaReferencesFromCourseContent(problematicContent)
    }).toThrow(/Media cleaning failed/)
  })

  it('should work correctly with hasMediaReferences and countMediaReferences', () => {
    const contentWithMedia = {
      welcomePage: {
        media: [{ id: 'img1' }, { id: 'img2' }]
      },
      topics: [
        { media: [{ id: 'vid1' }] }
      ]
    }

    const contentWithoutMedia = {
      welcomePage: {
        title: 'Welcome'
      },
      topics: [
        { title: 'Topic 1' }
      ]
    }

    // Before cleaning
    expect(hasMediaReferences(contentWithMedia)).toBe(true)
    expect(countMediaReferences(contentWithMedia)).toBe(3)

    // After cleaning
    const cleaned = cleanMediaReferencesFromCourseContent(contentWithMedia)
    expect(hasMediaReferences(cleaned)).toBe(false)
    expect(countMediaReferences(cleaned)).toBe(0)

    // Content that never had media
    expect(hasMediaReferences(contentWithoutMedia)).toBe(false)
    expect(countMediaReferences(contentWithoutMedia)).toBe(0)
  })

  it('should handle alternative page naming patterns', () => {
    const courseContent = {
      welcomePage: {
        media: [{ id: 'welcome-media' }]
      },
      learningObjectivesPage: {
        media: [{ id: 'objectives-media-1' }]
      },
      objectivesPage: {  // Alternative naming
        media: [{ id: 'objectives-media-2' }]
      },
      topics: [
        { media: [{ id: 'topic-media' }] }
      ]
    }

    const cleaned = cleanMediaReferencesFromCourseContent(courseContent)

    // All should be cleaned regardless of naming pattern
    expect(cleaned?.welcomePage?.media).toBeUndefined()
    expect(cleaned?.learningObjectivesPage?.media).toBeUndefined()
    expect(cleaned?.objectivesPage?.media).toBeUndefined()
    expect(cleaned?.topics?.[0]?.media).toBeUndefined()
  })
})