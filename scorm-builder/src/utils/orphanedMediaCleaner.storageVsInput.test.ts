import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { cleanupOrphanedMediaReferences, MediaExistsChecker } from './orphanedMediaCleaner'
import { debugLogger } from './ultraSimpleLogger'

describe('orphanedMediaCleaner - Storage vs Input JSON Discrepancy', () => {
  let mockMediaExistsChecker: Mock<MediaExistsChecker>

  beforeEach(() => {
    mockMediaExistsChecker = vi.fn()
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(debugLogger, 'debug').mockImplementation(() => {})
    vi.spyOn(debugLogger, 'info').mockImplementation(() => {})
  })

  it('should reproduce the exact issue: cleanup finds 0 references but components still try to load deleted media', async () => {
    // This reproduces the user's exact scenario:
    // 1. Input JSON has no media references (freshly pasted)
    // 2. But storage/components have media references from previous media enhancement
    // 3. Cleanup runs on input JSON (finds 0), but components load from storage (has references to deleted media)
    
    // SCENARIO: Fresh JSON input with no media references (typical user paste)
    const inputJsonData = {
      welcomePage: {
        id: 'welcome-1',
        title: 'Welcome',
        content: '<h1>Welcome to the course</h1>',
        narration: 'Welcome to this course',
        imageKeywords: ['welcome'],
        imagePrompts: ['welcome scene'],
        videoSearchTerms: ['intro'],
        duration: 2
        // NO media array here - this is fresh input JSON
      },
      learningObjectivesPage: {
        id: 'objectives-1', 
        title: 'Learning Objectives',
        content: '<p>Learn about...</p>',
        narration: 'The learning objectives are...',
        imageKeywords: ['objectives'],
        imagePrompts: ['learning goals'],
        videoSearchTerms: ['goals'],
        duration: 3
        // NO media array here either
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Introduction',
          content: '<p>This is the introduction</p>',
          narration: 'This is the introduction to our course',
          imageKeywords: ['intro'],
          imagePrompts: ['introduction scene'],
          videoSearchTerms: ['intro'],
          duration: 5
          // NO media array here either - fresh input
        }
      ],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    // SCENARIO: What actually gets loaded from storage (has media from previous session)
    const storageData = {
      ...inputJsonData,
      welcomePage: {
        ...inputJsonData.welcomePage,
        media: [
          { id: 'image-0', type: 'image', url: 'blob:http://localhost/image-0', title: 'Welcome Image' },
          { id: 'image-1', type: 'image', url: 'blob:http://localhost/image-1', title: 'Another Image' }
        ]
      },
      topics: [
        {
          ...inputJsonData.topics[0],
          media: [
            { id: 'image-2', type: 'image', url: 'blob:http://localhost/image-2', title: 'Topic Image' }
          ]
        }
      ]
    }

    // SCENARIO: Media was deleted, so these IDs no longer exist in storage
    mockMediaExistsChecker.mockImplementation(async (mediaId: string) => {
      // Simulate deleted media - image-0 and image-1 were deleted
      const deletedIds = ['image-0', 'image-1']
      const exists = !deletedIds.includes(mediaId)
      console.log(`Media check for ${mediaId}: ${exists}`)
      return exists
    })

    // BUG REPRODUCTION: Cleanup runs on input JSON (finds 0 references)
    const inputCleanupResult = await cleanupOrphanedMediaReferences(inputJsonData, mockMediaExistsChecker)
    
    // This should find 0 references (reproducing the user's log: "Found 0 media references") 
    expect(inputCleanupResult.removedMediaIds.length).toBe(0)
    expect(inputCleanupResult.cleanedContent).toEqual(inputJsonData)

    // ACTUAL PROBLEM: Cleanup should run on storage data that has the real media references
    const storageCleanupResult = await cleanupOrphanedMediaReferences(storageData, mockMediaExistsChecker)
    
    // This should find and remove the orphaned references
    expect(storageCleanupResult.removedMediaIds.length).toBe(2)
    expect(Array.from(storageCleanupResult.removedMediaIds)).toEqual(['image-0', 'image-1'])
    
    // The cleaned storage data should have the orphaned media removed
    expect(storageCleanupResult.cleanedContent.welcomePage.media).toEqual([])
    expect(storageCleanupResult.cleanedContent.topics[0].media).toEqual([
      { id: 'image-2', type: 'image', url: 'blob:http://localhost/image-2', title: 'Topic Image' }
    ])

    // Verify media existence was checked for the right IDs
    expect(mockMediaExistsChecker).toHaveBeenCalledWith('image-0')
    expect(mockMediaExistsChecker).toHaveBeenCalledWith('image-1') 
    expect(mockMediaExistsChecker).toHaveBeenCalledWith('image-2')
  })

  it('should handle the case where input JSON and storage are in sync', async () => {
    // SCENARIO: Both input and storage have the same media references
    const courseData = {
      welcomePage: {
        id: 'welcome-1',
        title: 'Welcome',
        content: '<h1>Welcome</h1>',
        narration: 'Welcome',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 2,
        media: [
          { id: 'image-5', type: 'image', url: 'blob:http://localhost/image-5', title: 'Sync Image' }
        ]
      },
      learningObjectivesPage: {
        id: 'objectives-1',
        title: 'Objectives', 
        content: '<p>Objectives</p>',
        narration: 'Objectives',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 2
      },
      topics: [],
      assessment: { questions: [], passMark: 80, narration: null }
    }

    // Media exists in storage
    mockMediaExistsChecker.mockResolvedValue(true)

    const result = await cleanupOrphanedMediaReferences(courseData, mockMediaExistsChecker)
    
    // Should not remove any media since it exists
    expect(result.removedMediaIds.length).toBe(0)
    expect(result.cleanedContent.welcomePage.media).toEqual([
      { id: 'image-5', type: 'image', url: 'blob:http://localhost/image-5', title: 'Sync Image' }
    ])
  })
})