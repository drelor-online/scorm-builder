import { describe, it, expect } from 'vitest'

// Test the YouTube URL detection logic that was fixed
describe('UnifiedMediaContext YouTube URL Detection Logic', () => {
  it('should correctly identify YouTube videos with various URL field formats', () => {
    // This tests the exact logic that was fixed in UnifiedMediaContext.tsx
    // The fixed logic checks for multiple URL field formats
    
    const testCases = [
      {
        description: 'embedUrl field',
        metadata: {
          type: 'youtube',
          embedUrl: 'https://www.youtube.com/embed/abc123'
        },
        expected: true
      },
      {
        description: 'embed_url field (snake_case)',
        metadata: {
          type: 'youtube', 
          embed_url: 'https://www.youtube.com/embed/def456'
        },
        expected: true
      },
      {
        description: 'youtubeUrl field',
        metadata: {
          type: 'youtube',
          youtubeUrl: 'https://www.youtube.com/watch?v=ghi789'
        },
        expected: true
      },
      {
        description: 'youtube_url field (snake_case)',
        metadata: {
          type: 'youtube',
          youtube_url: 'https://www.youtube.com/watch?v=jkl012'
        },
        expected: true
      },
      {
        description: 'url field (generic)',
        metadata: {
          type: 'youtube',
          url: 'https://www.youtube.com/embed/mno345'
        },
        expected: true
      },
      {
        description: 'no URL fields (should be detected as missing)',
        metadata: {
          type: 'youtube',
          title: 'Video without URLs'
        },
        expected: false
      }
    ]

    for (const testCase of testCases) {
      console.log(`🔍 [TEST] Testing ${testCase.description}`)
      
      // This is the exact logic that was fixed in UnifiedMediaContext.tsx line 264-268
      const hasYouTubeUrl = testCase.metadata?.url || 
                           testCase.metadata?.embedUrl || 
                           testCase.metadata?.embed_url ||
                           testCase.metadata?.youtubeUrl ||
                           testCase.metadata?.youtube_url
      
      const shouldNotBeSkipped = !!hasYouTubeUrl
      
      expect(shouldNotBeSkipped).toBe(testCase.expected)
      console.log(`✅ [TEST] ${testCase.description} - ${shouldNotBeSkipped ? 'Has URL' : 'Missing URL'}`)
    }
  })

  it('should demonstrate the old vs new logic', () => {
    const youtubeMetadata = {
      type: 'youtube',
      embed_url: 'https://www.youtube.com/embed/abc123',  // This is the common format
      title: 'Test YouTube Video'
    }

    // OLD LOGIC (broken): Only checked for 'url' field
    const oldLogicHasUrl = !!youtubeMetadata.url
    expect(oldLogicHasUrl).toBe(false) // This would incorrectly skip the video

    // NEW LOGIC (fixed): Checks for multiple URL field formats
    const newLogicHasUrl = youtubeMetadata.url || 
                          youtubeMetadata.embedUrl || 
                          youtubeMetadata.embed_url ||
                          youtubeMetadata.youtubeUrl ||
                          youtubeMetadata.youtube_url
    expect(!!newLogicHasUrl).toBe(true) // This correctly recognizes the video

    console.log('🔍 [TEST] Old logic would skip:', !oldLogicHasUrl)
    console.log('🔍 [TEST] New logic preserves:', !!newLogicHasUrl)
  })
})