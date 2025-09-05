/**
 * Integration test for JSONImportValidator media validation
 * 
 * This test verifies that the JSONImportValidator properly validates media existence
 * and removes orphaned references when processing course content.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanupOrphanedMediaReferences } from '../utils/orphanedMediaCleaner'
import { CourseContent } from '../types/aiPrompt'

describe('JSONImportValidator - Media Validation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should properly validate and clean orphaned media references', async () => {
    // ARRANGE: Mock media existence checker
    const mockMediaExistsChecker = vi.fn()
    
    // Course content with mix of valid and orphaned media references
    const courseContentWithMixedRefs: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<p>Welcome content</p>',
        narration: 'Welcome narration',
        duration: 2,
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        media: [
          {
            id: 'image-welcome-valid',
            type: 'image',
            url: '',
            title: 'Valid Welcome Image',
            pageId: 'welcome'
          },
          {
            id: 'image-welcome-orphaned',
            type: 'image',
            url: '',
            title: 'Orphaned Welcome Image',
            pageId: 'welcome'
          }
        ]
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<ul><li>Learn something</li></ul>',
        narration: 'Objectives narration',
        duration: 3,
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        media: [
          {
            id: 'audio-objectives-orphaned',
            type: 'audio',
            url: '',
            title: 'Orphaned Objectives Audio',
            pageId: 'objectives'
          }
        ]
      },
      topics: [
        {
          id: 'topic-0',
          title: 'Topic 1',
          content: '<p>Topic content</p>',
          narration: 'Topic narration',
          duration: 5,
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          knowledgeCheck: { questions: [] },
          media: [
            {
              id: 'audio-topic-0-valid',
              type: 'audio',
              url: '',
              title: 'Valid Topic Audio',
              pageId: 'topic-0'
            },
            {
              id: 'image-topic-0-orphaned',
              type: 'image',
              url: '',
              title: 'Orphaned Topic Image',
              pageId: 'topic-0'
            },
            {
              id: 'video-topic-0-valid',
              type: 'video',
              url: '',
              title: 'Valid Topic Video',
              pageId: 'topic-0'
            }
          ]
        }
      ],
      objectives: ['Learn something'],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    // Mock media existence: only certain media exists
    mockMediaExistsChecker.mockImplementation(async (mediaId: string) => {
      const validMediaIds = [
        'image-welcome-valid',
        'audio-topic-0-valid', 
        'video-topic-0-valid'
      ]
      return validMediaIds.includes(mediaId)
    })

    // ACT: Run the cleanup process
    const result = await cleanupOrphanedMediaReferences(
      courseContentWithMixedRefs,
      mockMediaExistsChecker
    )

    // ASSERT: Verify cleanup results
    expect(result.removedMediaIds).toHaveLength(3) // Should remove 3 orphaned references
    expect(result.removedMediaIds).toEqual([
      'image-welcome-orphaned',
      'audio-objectives-orphaned',
      'image-topic-0-orphaned'
    ])

    // Verify cleaned content structure
    const cleanedContent = result.cleanedContent as CourseContent
    
    // Welcome page should have only the valid media
    expect(cleanedContent.welcomePage.media).toHaveLength(1)
    expect(cleanedContent.welcomePage.media?.[0]?.id).toBe('image-welcome-valid')
    
    // Objectives page should have no media (orphaned audio removed)
    expect(cleanedContent.learningObjectivesPage.media).toHaveLength(0)
    
    // Topic should have only valid media (orphaned image removed)
    expect(cleanedContent.topics[0].media).toHaveLength(2)
    const topicMediaIds = cleanedContent.topics[0].media?.map(m => m.id) || []
    expect(topicMediaIds).toContain('audio-topic-0-valid')
    expect(topicMediaIds).toContain('video-topic-0-valid')
    expect(topicMediaIds).not.toContain('image-topic-0-orphaned')

    // Verify media existence was checked for all media
    expect(mockMediaExistsChecker).toHaveBeenCalledTimes(6)
    expect(mockMediaExistsChecker).toHaveBeenCalledWith('image-welcome-valid')
    expect(mockMediaExistsChecker).toHaveBeenCalledWith('image-welcome-orphaned')
    expect(mockMediaExistsChecker).toHaveBeenCalledWith('audio-objectives-orphaned')
    expect(mockMediaExistsChecker).toHaveBeenCalledWith('audio-topic-0-valid')
    expect(mockMediaExistsChecker).toHaveBeenCalledWith('image-topic-0-orphaned')
    expect(mockMediaExistsChecker).toHaveBeenCalledWith('video-topic-0-valid')
  })

  it('should handle media arrays correctly and preserve non-media content', async () => {
    // ARRANGE: Content with various media array scenarios
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<p>Welcome content</p>',
        narration: 'Welcome narration',
        duration: 2,
        imageKeywords: ['keyword1', 'keyword2'],
        imagePrompts: ['prompt1'],
        videoSearchTerms: ['search1'],
        media: [] // Empty media array
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<ul><li>Learn something</li></ul>',
        narration: 'Objectives narration',
        duration: 3,
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        // No media property at all
      },
      topics: [
        {
          id: 'topic-0',
          title: 'Topic 1',
          content: '<p>Topic content</p>',
          narration: 'Topic narration',
          duration: 5,
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          knowledgeCheck: { 
            questions: [
              {
                id: 'q1',
                question: 'Test question?',
                type: 'multiple-choice',
                options: ['A', 'B', 'C'],
                correctAnswer: 'A',
                feedback: {
                  correct: 'Correct!',
                  incorrect: 'Wrong!'
                }
              }
            ] 
          },
          media: [
            {
              id: 'valid-media',
              type: 'image',
              url: '',
              title: 'Valid Media',
              pageId: 'topic-0'
            }
          ]
        }
      ],
      objectives: ['Objective 1', 'Objective 2'],
      assessment: {
        questions: [
          {
            id: 'aq1',
            question: 'Assessment question?',
            type: 'true-false',
            correctAnswer: true,
            feedback: {
              correct: 'Right!',
              incorrect: 'Wrong!'
            }
          }
        ],
        passMark: 75,
        narration: 'Assessment intro'
      }
    }

    const mockMediaExistsChecker = vi.fn()
    mockMediaExistsChecker.mockResolvedValue(true) // All media exists

    // ACT: Run cleanup
    const result = await cleanupOrphanedMediaReferences(courseContent, mockMediaExistsChecker)

    // ASSERT: Verify that non-media content is preserved
    const cleanedContent = result.cleanedContent as CourseContent
    
    // Check that all non-media properties are preserved
    expect(cleanedContent.welcomePage.imageKeywords).toEqual(['keyword1', 'keyword2'])
    expect(cleanedContent.welcomePage.imagePrompts).toEqual(['prompt1'])
    expect(cleanedContent.welcomePage.videoSearchTerms).toEqual(['search1'])
    expect(cleanedContent.objectives).toEqual(['Objective 1', 'Objective 2'])
    expect(cleanedContent.topics[0].knowledgeCheck?.questions).toHaveLength(1)
    expect(cleanedContent.assessment.questions).toHaveLength(1)
    expect(cleanedContent.assessment.passMark).toBe(75)
    expect(cleanedContent.assessment.narration).toBe('Assessment intro')

    // Media should be preserved since it exists
    expect(cleanedContent.topics[0].media).toHaveLength(1)
    expect(cleanedContent.topics[0].media?.[0]?.id).toBe('valid-media')

    // No media should be removed
    expect(result.removedMediaIds).toHaveLength(0)
  })

  it('should handle edge cases gracefully', async () => {
    // Test with null/undefined inputs
    const mockMediaExistsChecker = vi.fn()
    
    // Test null input
    const resultNull = await cleanupOrphanedMediaReferences(null, mockMediaExistsChecker)
    expect(resultNull.cleanedContent).toBe(null)
    expect(resultNull.removedMediaIds).toEqual([])
    
    // Test undefined input
    const resultUndefined = await cleanupOrphanedMediaReferences(undefined, mockMediaExistsChecker)
    expect(resultUndefined.cleanedContent).toBe(undefined)
    expect(resultUndefined.removedMediaIds).toEqual([])
    
    // Test with media items without IDs
    const contentWithInvalidMedia: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<p>Welcome</p>',
        narration: '',
        duration: 2,
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        media: [
          { id: '', type: 'image', url: '', title: '', pageId: 'welcome' }, // Empty ID
          { type: 'image', url: '', title: '', pageId: 'welcome' } as any, // No ID property
          { id: 'valid-id', type: 'image', url: '', title: '', pageId: 'welcome' }
        ]
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: '<p>Objectives</p>',
        narration: '',
        duration: 3,
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        media: []
      },
      topics: [],
      objectives: [],
      assessment: { questions: [], passMark: 80, narration: null }
    }
    
    mockMediaExistsChecker.mockResolvedValue(true)
    
    const resultInvalid = await cleanupOrphanedMediaReferences(contentWithInvalidMedia, mockMediaExistsChecker)
    const cleanedInvalid = resultInvalid.cleanedContent as CourseContent
    
    // Should preserve items without valid IDs and only check valid IDs
    expect(cleanedInvalid.welcomePage.media).toHaveLength(3)
    expect(mockMediaExistsChecker).toHaveBeenCalledTimes(1) // Only called for valid ID
    expect(mockMediaExistsChecker).toHaveBeenCalledWith('valid-id')
  })
})