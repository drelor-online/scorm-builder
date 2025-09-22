import { describe, test, expect, vi } from 'vitest'

// Helper function to extract narration blocks (simplified version from AudioNarrationWizard)
function extractNarrationBlocks(content: any) {
  const blocks = []
  let blockCounter = 1

  // Check if it has new format pages
  const hasNewPages = 'welcomePage' in content && 'learningObjectivesPage' in content

  if (hasNewPages) {
    // ALWAYS add welcome page block
    if ('welcomePage' in content) {
      blocks.push({
        id: 'welcome-narration',
        text: content.welcomePage?.narration || '',
        blockNumber: '0001',
        pageId: 'welcome',
        pageTitle: content.welcomePage?.title || 'Welcome'
      })
    }

    // ALWAYS add learning objectives page block
    if ('learningObjectivesPage' in content) {
      blocks.push({
        id: 'objectives-narration',
        text: content.learningObjectivesPage?.narration || '',
        blockNumber: '0002',
        pageId: 'objectives',
        pageTitle: content.learningObjectivesPage?.title || 'Learning Objectives'
      })
    }

    // Start topic block counter at 3
    blockCounter = 3
  }

  // Process topics
  if (content.topics && Array.isArray(content.topics)) {
    content.topics.forEach((topic: any) => {
      blocks.push({
        id: `${topic.id}-narration`,
        text: topic.narration || '',
        blockNumber: String(blockCounter++).padStart(4, '0'),
        pageId: topic.id,
        pageTitle: topic.title
      })
    })
  }

  return blocks
}

// Helper function to simulate current (broken) caption loading logic
function simulateCurrentCaptionLoading(courseContent: any, narrationBlocks: any[]) {
  // This is the same logic as in AudioNarrationWizard lines 865-893
  const captionIdsInContent: (string | null)[] = []

  // Check welcome page
  if ('welcomePage' in courseContent) {
    const welcomeCaption = courseContent.welcomePage.media?.find((m: any) => m.type === 'caption')
    captionIdsInContent.push(welcomeCaption?.id || null)
  }

  // Check objectives page
  if ('learningObjectivesPage' in courseContent) {
    const objCaption = courseContent.learningObjectivesPage.media?.find((m: any) => m.type === 'caption')
    captionIdsInContent.push(objCaption?.id || null)
  }

  // Check topics
  if (courseContent.topics) {
    courseContent.topics.forEach((topic: any) => {
      const topicCaption = topic.media?.find((m: any) => m.type === 'caption')
      captionIdsInContent.push(topicCaption?.id || null)
    })
  }

  // Simulate the BROKEN mapping logic from lines 1105-1106
  const captionToBlockMapping: { captionId: string, blockNumber: string }[] = []

  captionIdsInContent.forEach((captionId, index) => {
    if (captionId && narrationBlocks[index]) {
      captionToBlockMapping.push({
        captionId,
        blockNumber: narrationBlocks[index].blockNumber
      })
    }
  })

  return { captionIdsInContent, captionToBlockMapping }
}

describe('AudioNarrationWizard Caption Duplication Issue', () => {
  test('should reproduce the caption duplication bug with index-based mapping', () => {
    // Create course content that has duplicated caption IDs after import
    const courseContentWithDuplicates = {
      welcomePage: {
        title: 'Welcome',
        media: [] // No caption for welcome
      },
      learningObjectivesPage: {
        title: 'Learning Objectives',
        media: [
          { id: 'caption-1', type: 'caption' } // Correct: objectives should have caption-1
        ]
      },
      topics: [
        {
          id: 'topic-0',
          title: 'Topic 1',
          media: [
            { id: 'caption-2', type: 'caption' } // Correct: topic-0 should have caption-2
          ]
        },
        {
          id: 'topic-1',
          title: 'Topic 2',
          media: [
            { id: 'caption-2', type: 'caption' } // BUG: topic-1 has caption-2 instead of caption-3
          ]
        }
      ]
    }

    // Extract narration blocks (this creates the correct block structure)
    const narrationBlocks = extractNarrationBlocks(courseContentWithDuplicates)

    // Verify the correct block structure
    expect(narrationBlocks).toHaveLength(4)
    expect(narrationBlocks[0].blockNumber).toBe('0001') // Welcome
    expect(narrationBlocks[1].blockNumber).toBe('0002') // Objectives
    expect(narrationBlocks[2].blockNumber).toBe('0003') // Topic-0
    expect(narrationBlocks[3].blockNumber).toBe('0004') // Topic-1

    // Simulate the current broken caption loading logic
    const { captionIdsInContent, captionToBlockMapping } = simulateCurrentCaptionLoading(
      courseContentWithDuplicates,
      narrationBlocks
    )

    // Show the problem: captionIdsInContent has duplicates
    expect(captionIdsInContent).toEqual([null, 'caption-1', 'caption-2', 'caption-2'])

    // Show the broken mapping: caption-2 maps to both blocks 0003 and 0004
    const caption2Mappings = captionToBlockMapping.filter(m => m.captionId === 'caption-2')
    expect(caption2Mappings).toHaveLength(2) // This is the bug!
    expect(caption2Mappings[0].blockNumber).toBe('0003') // topic-0 gets caption-2 ✓
    expect(caption2Mappings[1].blockNumber).toBe('0004') // topic-1 also gets caption-2 ✗

    // This test demonstrates the exact issue from the user's logs:
    // "Loading caption caption-2 for block 0003"
    // "Loading caption caption-2 for block 0004"
  })

  test('should show what the correct mapping should be', () => {
    // This is what the course content SHOULD look like after proper import
    const correctCourseContent = {
      welcomePage: {
        title: 'Welcome',
        media: [] // No caption for welcome
      },
      learningObjectivesPage: {
        title: 'Learning Objectives',
        media: [
          { id: 'caption-1', type: 'caption' } // Objectives: caption-1
        ]
      },
      topics: [
        {
          id: 'topic-0',
          title: 'Topic 1',
          media: [
            { id: 'caption-2', type: 'caption' } // Topic-0: caption-2
          ]
        },
        {
          id: 'topic-1',
          title: 'Topic 2',
          media: [
            { id: 'caption-3', type: 'caption' } // Topic-1: caption-3 (CORRECT!)
          ]
        }
      ]
    }

    const narrationBlocks = extractNarrationBlocks(correctCourseContent)
    const { captionIdsInContent, captionToBlockMapping } = simulateCurrentCaptionLoading(
      correctCourseContent,
      narrationBlocks
    )

    // With correct data, there should be no duplicates
    expect(captionIdsInContent).toEqual([null, 'caption-1', 'caption-2', 'caption-3'])

    // Each caption should map to exactly one block
    const captionCounts = captionToBlockMapping.reduce((acc, mapping) => {
      acc[mapping.captionId] = (acc[mapping.captionId] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    expect(captionCounts['caption-1']).toBe(1) // Only objectives
    expect(captionCounts['caption-2']).toBe(1) // Only topic-0
    expect(captionCounts['caption-3']).toBe(1) // Only topic-1
  })
})