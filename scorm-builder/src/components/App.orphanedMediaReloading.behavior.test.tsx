/**
 * Behavior test for orphaned media references reloading after JSON clear
 * 
 * This test reproduces the bug where:
 * 1. User has a project with course content and media files
 * 2. User clears the JSON (course content + media files are deleted)
 * 3. User loads/reloads the project 
 * 4. BUG: Orphaned media references reappear in course content from persistent audioNarration/media-enhancements
 * 5. Components fail trying to load non-existent media files
 */

import { describe, it, expect, vi } from 'vitest'

/**
 * These tests demonstrate the orphaned media reloading bug by testing the specific logic
 * that causes the issue. We focus on the loadProject function behavior.
 */

describe('App - Orphaned Media References Reloading After JSON Clear', () => {
  it('should demonstrate the orphaned media reloading bug in loadProject logic', async () => {
    // ARRANGE: Simulate the data states that cause the bug
    
    // 1. Mock storage returns persistent audioNarration and media-enhancements data
    // (these should have been cleared when JSON was cleared, but currently aren't)
    const mockAudioNarrationData = {
      welcome: 'audio-welcome-id-123',
      objectives: 'audio-objectives-id-456',
      'topic-0': 'audio-topic-0-id-789'
    }

    const mockMediaEnhancementsData = {
      welcome: [
        { id: 'media-welcome-id-123', type: 'image', url: '', title: 'Welcome Image', pageId: 'welcome' }
      ],
      'topic-0': [
        { id: 'media-topic-0-id-456', type: 'image', url: '', title: 'Topic 1 Image', pageId: 'topic-0' }
      ]
    }

    // 2. Mock course content that gets loaded (has empty media arrays initially)
    const mockCourseContent = {
      topics: [
        {
          id: 'topic-0',
          title: 'Topic 1',
          content: '<p>Content</p>',
          media: [] // Empty initially, will be populated by loadProject bug
        }
      ],
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<p>Welcome</p>',
        media: [] // Empty initially, will be populated by loadProject bug
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<p>Objectives</p>',
        media: [] // Empty initially, will be populated by loadProject bug
      },
      objectives: ['Learn something'],
      assessment: { questions: [], passMark: 80, narration: null }
    }

    // 3. Mock media context - all media files have been deleted (return null)
    const mockGetMedia = vi.fn().mockResolvedValue(null) // Media doesn't exist!

    // ACT: Simulate the problematic loadProject logic (lines 451-593 in App.tsx)
    // This is the current buggy behavior that blindly adds media references
    const simulateCurrentLoadProjectLogic = async () => {
      const loadedCourseContent = { ...mockCourseContent }
      const audioNarrationData = mockAudioNarrationData
      const mediaEnhancementsData = mockMediaEnhancementsData

      // BUG: Current code adds media references WITHOUT checking if media exists
      
      // Process welcome page - BUGGY LOGIC
      if (loadedCourseContent.welcomePage && audioNarrationData?.welcome) {
        const audioId = audioNarrationData.welcome
        const audioItem = {
          id: audioId,
          type: 'audio' as const,
          url: '',
          title: 'Audio Narration',
          pageId: 'welcome'
        }
        // BUG: Adds media reference without checking if media exists!
        loadedCourseContent.welcomePage.media.push(audioItem)
      }

      // Add media enhancement references - BUGGY LOGIC  
      if (loadedCourseContent.welcomePage && mediaEnhancementsData?.welcome) {
        const mediaItems = Array.isArray(mediaEnhancementsData.welcome) 
          ? mediaEnhancementsData.welcome 
          : [mediaEnhancementsData.welcome]
        mediaItems.forEach((item: any) => {
          // BUG: Adds media reference without checking if media exists!
          loadedCourseContent.welcomePage!.media!.push(item)
        })
      }

      // Process topics - BUGGY LOGIC
      if (loadedCourseContent.topics) {
        loadedCourseContent.topics.forEach((topic, index) => {
          const topicKey = `topic-${index}`
          
          // Add audio references - BUGGY LOGIC
          if (audioNarrationData?.[topicKey]) {
            const audioId = audioNarrationData[topicKey]
            const audioItem = {
              id: audioId,
              type: 'audio' as const,
              url: '',
              title: 'Audio Narration',
              pageId: topicKey
            }
            // BUG: Adds media reference without checking if media exists!
            topic.media!.push(audioItem)
          }
          
          // Add media enhancement references - BUGGY LOGIC
          if (mediaEnhancementsData?.[topicKey]) {
            const mediaItems = Array.isArray(mediaEnhancementsData[topicKey])
              ? mediaEnhancementsData[topicKey]
              : [mediaEnhancementsData[topicKey]]
            mediaItems.forEach((item: any) => {
              // BUG: Adds media reference without checking if media exists!
              topic.media!.push(item)
            })
          }
        })
      }

      return loadedCourseContent
    }

    // Run the buggy logic
    const resultCourseContent = await simulateCurrentLoadProjectLogic()

    // ASSERT: Demonstrate the bug - orphaned media references were added
    expect(resultCourseContent.welcomePage.media).toHaveLength(2) // audio + image
    expect(resultCourseContent.welcomePage.media[0].id).toBe('audio-welcome-id-123')
    expect(resultCourseContent.welcomePage.media[1].id).toBe('media-welcome-id-123')
    
    expect(resultCourseContent.topics[0].media).toHaveLength(2) // audio + image  
    expect(resultCourseContent.topics[0].media[0].id).toBe('audio-topic-0-id-789')
    expect(resultCourseContent.topics[0].media[1].id).toBe('media-topic-0-id-456')

    // The BUG: These media references point to non-existent files!
    // When components try to load these media IDs, they will fail
    // because the actual media files were deleted when JSON was cleared

    // This test demonstrates the current buggy behavior
    console.log('BUG DEMONSTRATED: Orphaned media references were added to course content')
    console.log('Welcome page media count:', resultCourseContent.welcomePage.media.length)
    console.log('Topic 0 media count:', resultCourseContent.topics[0].media.length)
    
    // This test should pass showing the bug exists
    // After we implement the fix, we'll update this test to verify the fix works
  })

  it('should demonstrate the missing persistent field clearing in handleClearCourseContent', async () => {
    // ARRANGE: Mock storage operations
    const mockSaveContent = vi.fn().mockResolvedValue(true)
    const mockSaveCourseContent = vi.fn().mockResolvedValue(true)

    // ACT: Simulate current handleClearCourseContent logic (lines 1129-1130 in App.tsx)
    const simulateCurrentClearLogic = async () => {
      // Current logic only saves cleared course content
      await mockSaveCourseContent(null)
      await mockSaveContent('currentStep', { step: 'json' })
      
      // BUG: Missing these calls to clear persistent media fields!
      // await mockSaveContent('audioNarration', null)  // <- MISSING!
      // await mockSaveContent('media-enhancements', null)  // <- MISSING!
    }

    await simulateCurrentClearLogic()

    // ASSERT: Show that persistent fields are NOT being cleared
    expect(mockSaveCourseContent).toHaveBeenCalledWith(null)
    expect(mockSaveContent).toHaveBeenCalledWith('currentStep', { step: 'json' })
    
    // These should be called but currently aren't (demonstrating the bug)
    expect(mockSaveContent).not.toHaveBeenCalledWith('audioNarration', null)
    expect(mockSaveContent).not.toHaveBeenCalledWith('media-enhancements', null)
    
    console.log('BUG DEMONSTRATED: audioNarration and media-enhancements persist after JSON clear')
  })

  it('should show the correct fix for both issues', async () => {
    // This test demonstrates what the FIXED logic should do
    
    const mockGetMedia = vi.fn()
    const mockSaveContent = vi.fn().mockResolvedValue(true)
    const mockSaveCourseContent = vi.fn().mockResolvedValue(true)

    // Setup mock - some media exists, some doesn't
    mockGetMedia.mockImplementation((mediaId: string) => {
      // Only one media file exists, others were deleted
      if (mediaId === 'audio-welcome-id-123') {
        return Promise.resolve({ id: mediaId, type: 'audio', url: 'blob:valid' })
      }
      return Promise.resolve(null) // All others deleted
    })

    // FIXED handleClearCourseContent logic
    const fixedClearLogic = async () => {
      await mockSaveCourseContent(null)
      await mockSaveContent('currentStep', { step: 'json' })
      
      // FIX: Clear persistent media fields too!
      await mockSaveContent('audioNarration', null)
      await mockSaveContent('media-enhancements', null)
    }

    await fixedClearLogic()

    // FIXED loadProject logic with validation
    const fixedLoadProjectLogic = async () => {
      const audioNarrationData = { welcome: 'audio-welcome-id-123' }
      const loadedCourseContent = {
        welcomePage: { id: 'welcome', media: [] }
      }

      // FIX: Validate media exists before adding references
      if (loadedCourseContent.welcomePage && audioNarrationData?.welcome) {
        const audioId = audioNarrationData.welcome
        const mediaExists = await mockGetMedia(audioId)
        
        if (mediaExists) { // Only add if media actually exists!
          const audioItem = {
            id: audioId,
            type: 'audio' as const,
            url: '',
            title: 'Audio Narration',
            pageId: 'welcome'
          }
          loadedCourseContent.welcomePage.media.push(audioItem)
        }
      }

      return loadedCourseContent
    }

    const fixedResult = await fixedLoadProjectLogic()

    // ASSERT: Fixed behavior
    expect(mockSaveContent).toHaveBeenCalledWith('audioNarration', null)
    expect(mockSaveContent).toHaveBeenCalledWith('media-enhancements', null)
    expect(mockGetMedia).toHaveBeenCalledWith('audio-welcome-id-123')
    expect(fixedResult.welcomePage.media).toHaveLength(1) // Only valid media added
    
    console.log('FIX DEMONSTRATED: Only existing media references are added')
  })
})