import { describe, test, expect, vi } from 'vitest'
import { loadCaptionIdsWithValidation, loadAudioIdsFromContent } from './AudioNarrationWizard.captionFix'

// Mock logger objects
const mockLogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

const mockDebugLogger = {
  warn: vi.fn()
}

describe('AudioNarrationWizard Caption Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should detect and fix caption duplication', () => {
    // Mock course content with the bug (caption-1 appears in both objectives and first topic)
    const buggyContent = {
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

    const result = loadCaptionIdsWithValidation(buggyContent, mockLogger, mockDebugLogger)

    // Should fix the duplication by ignoring misaligned captions
    expect(result).toEqual(['caption-0', 'caption-1', null, null])

    // Should log warnings about the misalignment
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('CAPTION MISMATCH DETECTED: Topic 0 (topic-0) has caption ID "caption-1" but expected "caption-2"')
    )
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('CAPTION MISMATCH DETECTED: Topic 1 (topic-1) has caption ID "caption-2" but expected "caption-3"')
    )

    // Should log success message
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('✅ No duplicates detected after fix')
    )
  })

  test('should pass through correctly aligned captions', () => {
    // Mock course content with correct caption alignment
    const goodContent = {
      welcomePage: {
        media: [{ id: 'caption-0', type: 'caption' }]
      },
      learningObjectivesPage: {
        media: [{ id: 'caption-1', type: 'caption' }]
      },
      topics: [
        {
          id: 'topic-0',
          media: [{ id: 'caption-2', type: 'caption' }] // Correct
        },
        {
          id: 'topic-1',
          media: [{ id: 'caption-3', type: 'caption' }] // Correct
        }
      ]
    }

    const result = loadCaptionIdsWithValidation(goodContent, mockLogger, mockDebugLogger)

    // Should pass through all captions without modification
    expect(result).toEqual(['caption-0', 'caption-1', 'caption-2', 'caption-3'])

    // Should not log any warnings
    expect(mockLogger.warn).not.toHaveBeenCalled()

    // Should log success message
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('✅ No duplicates detected after fix')
    )
  })

  test('should handle missing captions', () => {
    // Mock course content with some missing captions
    const contentWithMissing = {
      welcomePage: {
        media: [{ id: 'caption-0', type: 'caption' }]
      },
      learningObjectivesPage: {
        media: [] // No caption
      },
      topics: [
        {
          id: 'topic-0',
          media: [{ id: 'caption-2', type: 'caption' }] // Correct
        },
        {
          id: 'topic-1',
          media: [] // No caption
        }
      ]
    }

    const result = loadCaptionIdsWithValidation(contentWithMissing, mockLogger, mockDebugLogger)

    // Should handle missing captions correctly
    expect(result).toEqual(['caption-0', null, 'caption-2', null])

    // Should not log warnings for missing captions (those are expected)
    expect(mockLogger.warn).not.toHaveBeenCalled()
  })

  test('should load audio IDs correctly (unchanged logic)', () => {
    const content = {
      welcomePage: {
        media: [{ id: 'audio-0', type: 'audio' }]
      },
      learningObjectivesPage: {
        media: [{ id: 'audio-1', type: 'audio' }]
      },
      topics: [
        {
          id: 'topic-0',
          media: [{ id: 'audio-2', type: 'audio' }]
        },
        {
          id: 'topic-1',
          media: [{ id: 'audio-3', type: 'audio' }]
        }
      ]
    }

    const result = loadAudioIdsFromContent(content)

    expect(result).toEqual(['audio-0', 'audio-1', 'audio-2', 'audio-3'])
  })
})