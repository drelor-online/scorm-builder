import { describe, test, expect, beforeEach, vi } from 'vitest'
import { loadCaptionIdsWithValidation } from './AudioNarrationWizard.captionFix'

// This test simulates the exact data structure from the real project file that has the bug
describe('AudioNarrationWizard Integration Test - Real Project Data', () => {
  const mockLogger = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }

  const mockDebugLogger = {
    warn: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should fix the actual bug from project file Complex_Projects_-_03_-_ASME_B31_8', () => {
    // This is the EXACT structure from the real project file that has the bug
    const realProjectData = {
      welcomePage: {
        id: 'welcome',
        media: [
          {
            id: 'caption-0',
            type: 'caption',
            storageId: 'caption-0',
            content: 'Welcome caption content'
          }
        ]
      },
      learningObjectivesPage: {
        id: 'learning-objectives',
        media: [
          // This is correct - should be caption-1
          {
            id: 'caption-1',
            type: 'caption',
            storageId: 'caption-1',
            content: 'Learning objectives caption content'
          }
        ]
      },
      topics: [
        {
          id: 'topic-0',
          title: 'Scope and Applicability of B31.8',
          media: [
            // BUG: This topic has caption-1 (should be caption-2)
            {
              id: 'caption-1',
              type: 'caption',
              storageId: 'caption-1',
              content: 'Learning objectives caption content' // Same content as objectives!
            }
          ]
        },
        {
          id: 'topic-1',
          title: 'The Link Between B31.8 and Federal Law',
          media: [
            // BUG: This topic has caption-2 (should be caption-3)
            {
              id: 'caption-2',
              type: 'caption',
              storageId: 'caption-2',
              content: 'Second topic caption content'
            }
          ]
        }
      ]
    }

    // Run the fix
    const result = loadCaptionIdsWithValidation(realProjectData, mockLogger, mockDebugLogger)

    // The fix should detect and correct the misalignment
    expect(result).toEqual([
      'caption-0',  // welcome - correct
      'caption-1',  // objectives - correct
      null,         // topic-0 - detected mismatch, ignored caption-1
      null          // topic-1 - detected mismatch, ignored caption-2
    ])

    // Should warn about both misaligned topics
    expect(mockLogger.warn).toHaveBeenCalledTimes(2)

    // First warning for topic-0
    expect(mockLogger.warn).toHaveBeenNthCalledWith(1,
      '[AudioNarrationWizard] 🚨 CAPTION MISMATCH DETECTED: Topic 0 (topic-0) has caption ID "caption-1" but expected "caption-2". Ignoring misaligned caption to prevent duplication.'
    )

    // Second warning for topic-1
    expect(mockLogger.warn).toHaveBeenNthCalledWith(2,
      '[AudioNarrationWizard] 🚨 CAPTION MISMATCH DETECTED: Topic 1 (topic-1) has caption ID "caption-2" but expected "caption-3". Ignoring misaligned caption to prevent duplication.'
    )

    // Should log that duplicates were prevented
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('✅ No duplicates detected after fix')
    )

    // Verify that the debug logger was called with correct details
    expect(mockDebugLogger.warn).toHaveBeenCalledTimes(2)
    expect(mockDebugLogger.warn).toHaveBeenNthCalledWith(1,
      'CAPTION_FIX',
      'Caption ID mismatch detected and corrected',
      {
        topicIndex: 0,
        topicId: 'topic-0',
        foundCaptionId: 'caption-1',
        expectedCaptionId: 'caption-2',
        action: 'ignored_misaligned_caption'
      }
    )
  })

  test('should show the ORIGINAL BUGGY behavior without the fix', () => {
    // This simulates what the ORIGINAL code does (without the fix)
    const realProjectData = {
      welcomePage: {
        media: [{ id: 'caption-0', type: 'caption' }]
      },
      learningObjectivesPage: {
        media: [{ id: 'caption-1', type: 'caption' }]
      },
      topics: [
        {
          id: 'topic-0',
          media: [{ id: 'caption-1', type: 'caption' }] // BUG: Should be caption-2
        },
        {
          id: 'topic-1',
          media: [{ id: 'caption-2', type: 'caption' }] // BUG: Should be caption-3
        }
      ]
    }

    // Simulate the ORIGINAL buggy behavior (without validation)
    const originalBuggyResult = []

    // Original code just pushes whatever it finds
    originalBuggyResult.push('caption-0') // welcome
    originalBuggyResult.push('caption-1') // objectives
    originalBuggyResult.push('caption-1') // topic-0 - DUPLICATE!
    originalBuggyResult.push('caption-2') // topic-1

    // Show that the original code creates duplicates
    expect(originalBuggyResult).toEqual(['caption-0', 'caption-1', 'caption-1', 'caption-2'])

    // Count duplicates in original result
    const caption1Count = originalBuggyResult.filter(id => id === 'caption-1').length
    expect(caption1Count).toBe(2) // This is the bug - caption-1 appears twice!

    // Now show that our fix prevents this
    const fixedResult = loadCaptionIdsWithValidation(realProjectData, mockLogger, mockDebugLogger)
    const fixedCaption1Count = fixedResult.filter(id => id === 'caption-1').length
    expect(fixedCaption1Count).toBe(1) // Fixed - caption-1 appears only once
  })

  test('should demonstrate the console output that the user sees', () => {
    const realProjectData = {
      welcomePage: { media: [{ id: 'caption-0', type: 'caption' }] },
      learningObjectivesPage: { media: [{ id: 'caption-1', type: 'caption' }] },
      topics: [
        { id: 'topic-0', media: [{ id: 'caption-1', type: 'caption' }] },
        { id: 'topic-1', media: [{ id: 'caption-2', type: 'caption' }] }
      ]
    }

    loadCaptionIdsWithValidation(realProjectData, mockLogger, mockDebugLogger)

    // The user would see these console warnings in the browser:
    console.log('\n=== Console Output the User Would See ===')
    console.log('🚨 CAPTION MISMATCH DETECTED: Topic 0 (topic-0) has caption ID "caption-1" but expected "caption-2"')
    console.log('🚨 CAPTION MISMATCH DETECTED: Topic 1 (topic-1) has caption ID "caption-2" but expected "caption-3"')
    console.log('✅ No duplicates detected after fix')

    // This proves the fix is working and would be visible to the user
    expect(mockLogger.warn).toHaveBeenCalledTimes(2)
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('✅ No duplicates detected after fix')
    )
  })
})