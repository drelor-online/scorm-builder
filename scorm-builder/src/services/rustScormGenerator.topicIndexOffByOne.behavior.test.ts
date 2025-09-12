import { describe, it, expect } from 'vitest'

/**
 * BEHAVIOR TEST: Topic Index Off-By-One Error - Image Display Bug
 * 
 * Issue: Images are showing up on wrong pages - current page shows both its image 
 * AND the previous page's image. This is caused by an off-by-one error in the 
 * topic index calculation in media injection logic.
 * 
 * Root Cause: Line 1792 in rustScormGenerator.ts:
 * const topicIndex = parseInt(pageId.replace('topic-', '')) - 1  // <-- WRONG!
 * 
 * This causes:
 * - pageId 'topic-0' → topicIndex -1 (invalid, no injection)  
 * - pageId 'topic-1' → topicIndex 0 (injects into topic-0, wrong page)
 * - pageId 'topic-2' → topicIndex 1 (injects into topic-1, wrong page)
 * 
 * Expected Behavior:
 * - pageId 'topic-0' → topicIndex 0 (injects into topic-0, correct)
 * - pageId 'topic-1' → topicIndex 1 (injects into topic-1, correct)
 */
describe('Topic Index Off-By-One Error - Image Display Bug', () => {
  it('should demonstrate the off-by-one error in topic index calculation', () => {
    console.log('🔍 [Topic Index Bug] Testing topic index calculation...')
    
    // Simulate the BUGGY logic from line 1792
    const getBuggyTopicIndex = (pageId: string) => {
      return parseInt(pageId.replace('topic-', '')) - 1  // <-- The bug is here: -1
    }
    
    // Simulate the CORRECT logic (used elsewhere in the codebase)
    const getCorrectTopicIndex = (pageId: string) => {
      return parseInt(pageId.replace('topic-', ''))  // <-- No -1, this is correct
    }
    
    const testCases = [
      { pageId: 'topic-0', expectedIndex: 0, description: 'First topic should map to index 0' },
      { pageId: 'topic-1', expectedIndex: 1, description: 'Second topic should map to index 1' },
      { pageId: 'topic-2', expectedIndex: 2, description: 'Third topic should map to index 2' },
      { pageId: 'topic-3', expectedIndex: 3, description: 'Fourth topic should map to index 3' }
    ]
    
    console.log('   📊 Testing topic index mappings:')
    testCases.forEach(testCase => {
      const buggyIndex = getBuggyTopicIndex(testCase.pageId)
      const correctIndex = getCorrectTopicIndex(testCase.pageId)
      
      console.log(`     ${testCase.pageId}:`)
      console.log(`       Buggy logic: ${testCase.pageId} → index ${buggyIndex}`)
      console.log(`       Correct logic: ${testCase.pageId} → index ${correctIndex}`)
      console.log(`       Expected: ${testCase.expectedIndex}`)
      
      // The buggy logic produces wrong results
      expect(buggyIndex).not.toBe(testCase.expectedIndex)
      
      // The correct logic produces right results  
      expect(correctIndex).toBe(testCase.expectedIndex)
      
      console.log('')
    })
    
    console.log('   🚨 [BUG IMPACT] How this causes the image display issue:')
    console.log('     1. User stores image-3 for topic-1 (pageId: "topic-1")')
    console.log('     2. Media injection calculates: parseInt("topic-1".replace("topic-", "")) - 1 = 1 - 1 = 0')
    console.log('     3. Image gets injected into courseData.topics[0] instead of courseData.topics[1]')
    console.log('     4. User sees image-3 on topic-0 page instead of topic-1 page')
    console.log('     5. When user views topic-1, it shows both its image AND the misplaced image-3')
    
    console.log('')
    console.log('   ✅ [BUG CONFIRMED] Off-by-one error in topic index calculation causes image misplacement')
  })
  
  it('should demonstrate the impact on courseData.topics array access', () => {
    console.log('🔍 [Topic Index Bug] Testing array access with buggy vs correct logic...')
    
    // Simulate courseData.topics array
    const mockTopics = [
      { id: 'topic-0', title: 'Topic 0', media: [] },
      { id: 'topic-1', title: 'Topic 1', media: [] },
      { id: 'topic-2', title: 'Topic 2', media: [] },
      { id: 'topic-3', title: 'Topic 3', media: [] }
    ]
    
    const simulateMediaInjection = (pageId: string, useBuggyLogic: boolean) => {
      const topicIndex = useBuggyLogic 
        ? parseInt(pageId.replace('topic-', '')) - 1  // Buggy
        : parseInt(pageId.replace('topic-', ''))      // Correct
      
      // Check if index is valid
      if (topicIndex >= 0 && topicIndex < mockTopics.length) {
        return { 
          success: true, 
          targetTopic: mockTopics[topicIndex], 
          actualIndex: topicIndex 
        }
      } else {
        return { 
          success: false, 
          targetTopic: null, 
          actualIndex: topicIndex 
        }
      }
    }
    
    const mediaItems = [
      { id: 'image-3', pageId: 'topic-0', expectedTargetIndex: 0 },
      { id: 'image-4', pageId: 'topic-1', expectedTargetIndex: 1 },
      { id: 'image-5', pageId: 'topic-2', expectedTargetIndex: 2 },
      { id: 'video-6', pageId: 'topic-3', expectedTargetIndex: 3 }
    ]
    
    console.log('   📋 Media injection simulation:')
    mediaItems.forEach(media => {
      const buggyResult = simulateMediaInjection(media.pageId, true)
      const correctResult = simulateMediaInjection(media.pageId, false)
      
      console.log(`     ${media.id} (pageId: ${media.pageId}):`)
      console.log(`       Buggy logic: targets index ${buggyResult.actualIndex} (${buggyResult.success ? `topic "${buggyResult.targetTopic?.id}"` : 'INVALID'})`)
      console.log(`       Correct logic: targets index ${correctResult.actualIndex} (${correctResult.success ? `topic "${correctResult.targetTopic?.id}"` : 'INVALID'})`)
      console.log(`       Expected: index ${media.expectedTargetIndex}`)
      
      // Verify buggy logic produces wrong results
      if (media.pageId === 'topic-0') {
        // topic-0 with buggy logic gets index -1 (invalid)
        expect(buggyResult.success).toBe(false)
        expect(buggyResult.actualIndex).toBe(-1)
      } else {
        // Other topics get wrong but valid indices
        expect(buggyResult.success).toBe(true)
        expect(buggyResult.actualIndex).not.toBe(media.expectedTargetIndex)
      }
      
      // Verify correct logic produces right results
      expect(correctResult.success).toBe(true)
      expect(correctResult.actualIndex).toBe(media.expectedTargetIndex)
      
      console.log('')
    })
    
    console.log('   🎯 [KEY INSIGHT] The bug causes media to be injected into wrong topics:')
    console.log('     - image-3 (topic-0) → gets skipped (index -1 is invalid)')
    console.log('     - image-4 (topic-1) → gets injected into topic-0 (index 0)')
    console.log('     - image-5 (topic-2) → gets injected into topic-1 (index 1)')
    console.log('     - This creates the "previous page image" effect the user reported!')
    
    console.log('')
    console.log('   ✅ [BUG IMPACT CONFIRMED] Array access with wrong indices causes media misplacement')
  })
})