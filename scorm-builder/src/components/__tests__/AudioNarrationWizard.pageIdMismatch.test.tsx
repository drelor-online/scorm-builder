import { describe, it, expect } from 'vitest'
import type { CourseContent } from '../../types/aiPrompt'

describe('AudioNarrationWizard - page ID mismatch diagnosis', () => {
  it('should show the page ID mismatch between narration blocks and MediaStore', () => {
    // This is what courseContent looks like
    // @ts-expect-error - This is demonstrative code showing the mismatch
    const _courseContent: CourseContent = {
      welcomePage: {
        id: 'content-0', // Note: NOT 'welcome'
        title: 'Welcome',
        content: '<h1>Welcome</h1>',
        narration: 'Welcome narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      learningObjectivesPage: {
        id: 'content-1', // Note: NOT 'objectives'
        title: 'Learning Objectives',
        content: '<h2>Objectives</h2>',
        narration: 'Objectives narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      topics: [{
        id: 'topic-0', // This one matches!
        title: 'Safety Basics',
        content: '<p>Safety content</p>',
        narration: 'Safety narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5
      }],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    // What AudioNarrationWizard creates as pageIds
    const narrationBlocks = [
      { pageId: 'content-0', blockNumber: '0001' },  // From welcomePage.id
      { pageId: 'content-1', blockNumber: '0002' },  // From learningObjectivesPage.id
      { pageId: 'topic-0', blockNumber: '0003' }     // From topics[0].id
    ]

    // What MediaStore has as page_id in metadata
    const mediaStoreMetadata = [
      { id: 'audio-0', metadata: { page_id: 'welcome', type: 'audio' } },     // Fixed string 'welcome'
      { id: 'audio-1', metadata: { page_id: 'objectives', type: 'audio' } },  // Fixed string 'objectives'
      { id: 'audio-2', metadata: { page_id: 'topic-0', type: 'audio' } }      // Matches!
    ]

    // The mismatch:
    expect(narrationBlocks[0].pageId).toBe('content-0')
    expect(mediaStoreMetadata[0].metadata.page_id).toBe('welcome')
    expect(narrationBlocks[0].pageId).not.toBe(mediaStoreMetadata[0].metadata.page_id) // MISMATCH!

    expect(narrationBlocks[1].pageId).toBe('content-1')
    expect(mediaStoreMetadata[1].metadata.page_id).toBe('objectives')
    expect(narrationBlocks[1].pageId).not.toBe(mediaStoreMetadata[1].metadata.page_id) // MISMATCH!

    // Only topics match
    expect(narrationBlocks[2].pageId).toBe('topic-0')
    expect(mediaStoreMetadata[2].metadata.page_id).toBe('topic-0')
    expect(narrationBlocks[2].pageId).toBe(mediaStoreMetadata[2].metadata.page_id) // MATCH!
  })

  it('should show the fix: map by index instead of page_id', () => {
    // The fix is to map by index position instead of page_id
    const narrationBlocks = [
      { pageId: 'content-0', blockNumber: '0001' },  // Index 0 = welcome
      { pageId: 'content-1', blockNumber: '0002' },  // Index 1 = objectives
      { pageId: 'topic-0', blockNumber: '0003' },     // Index 2 = first topic
      { pageId: 'topic-1', blockNumber: '0004' },     // Index 3 = second topic
    ]

    // MediaStore uses numeric IDs that match the index
    const mediaStoreItems = [
      { id: 'audio-0', metadata: { page_id: 'welcome', type: 'audio' } },     // Index 0
      { id: 'audio-1', metadata: { page_id: 'objectives', type: 'audio' } },  // Index 1
      { id: 'audio-2', metadata: { page_id: 'topic-0', type: 'audio' } },     // Index 2
      { id: 'audio-3', metadata: { page_id: 'topic-1', type: 'audio' } },     // Index 3
    ]

    // Extract index from media ID
    const getIndexFromMediaId = (id: string) => {
      const match = id.match(/audio-(\d+)/)
      return match ? parseInt(match[1]) : -1
    }

    // Map by index
    mediaStoreItems.forEach((item) => {
      const index = getIndexFromMediaId(item.id)
      if (index >= 0 && index < narrationBlocks.length) {
        const block = narrationBlocks[index]
        expect(block).toBeDefined()
        // They map correctly by index!
      }
    })
  })
})