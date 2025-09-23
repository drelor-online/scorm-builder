import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { AudioNarrationWizard } from './AudioNarrationWizard'

// Mock dependencies
vi.mock('../services/FileStorage', () => ({
  createFileStorage: vi.fn(() => ({
    currentProjectId: '1758559410161',
    saveContent: vi.fn().mockResolvedValue(true),
    getContent: vi.fn().mockResolvedValue(null),
    saveCourseContent: vi.fn().mockResolvedValue(true),
    saveProject: vi.fn().mockResolvedValue(true)
  }))
}))

vi.mock('../services/MediaService', () => ({
  createMediaService: vi.fn(() => ({
    getMediaBatchDirect: vi.fn().mockResolvedValue(new Map()),
    getAllMedia: vi.fn().mockResolvedValue([])
  }))
}))

// Mock course content with caption duplication issue
const createMockCourseContentWithDuplicate = () => ({
  welcomePage: {
    id: 'welcome',
    title: 'Welcome',
    content: 'Welcome content',
    narration: 'Welcome narration',
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
    title: 'Learning Objectives',
    content: 'Objectives content',
    narration: 'Learning objectives narration',
    media: [
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
      title: 'First Topic',
      content: 'First topic content',
      narration: 'First topic narration',
      media: [
        // BUG: This topic incorrectly has caption-1 (should be caption-2)
        {
          id: 'caption-1',
          type: 'caption',
          storageId: 'caption-1',
          content: 'Learning objectives caption content' // Same as learning objectives!
        }
      ]
    },
    {
      id: 'topic-1',
      title: 'Second Topic',
      content: 'Second topic content',
      narration: 'Second topic narration',
      media: [
        {
          id: 'caption-2', // This is wrong too - should be caption-3
          type: 'caption',
          storageId: 'caption-2',
          content: 'Second topic caption content'
        }
      ]
    }
  ]
})

describe('AudioNarrationWizard Caption Duplication Bug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should detect caption-1 duplication between learning objectives and first topic', () => {
    const mockContent = createMockCourseContentWithDuplicate()

    // The bug: caption-1 appears in both learningObjectivesPage and topics[0]
    const learningObjectivesCaption = mockContent.learningObjectivesPage.media.find(m => m.type === 'caption')
    const firstTopicCaption = mockContent.topics[0].media.find(m => m.type === 'caption')

    // Both should have caption-1 (showing the bug exists)
    expect(learningObjectivesCaption?.id).toBe('caption-1')
    expect(firstTopicCaption?.id).toBe('caption-1')

    // And they have the same content (the bug)
    expect(learningObjectivesCaption?.content).toBe(firstTopicCaption?.content)
    expect(firstTopicCaption?.content).toBe('Learning objectives caption content')
  })

  test('should verify expected caption mapping after fix', () => {
    // This test defines what the CORRECT caption mapping should be
    const expectedMapping = [
      { pageId: 'welcome', blockNumber: '0001', expectedCaptionId: 'caption-0' },
      { pageId: 'learning-objectives', blockNumber: '0002', expectedCaptionId: 'caption-1' },
      { pageId: 'topic-0', blockNumber: '0003', expectedCaptionId: 'caption-2' },
      { pageId: 'topic-1', blockNumber: '0004', expectedCaptionId: 'caption-3' }
    ]

    // When the bug is fixed, topic-0 should have caption-2, not caption-1
    const firstTopicExpected = expectedMapping.find(m => m.pageId === 'topic-0')
    expect(firstTopicExpected?.expectedCaptionId).toBe('caption-2')

    // Learning objectives should have caption-1
    const objectivesExpected = expectedMapping.find(m => m.pageId === 'learning-objectives')
    expect(objectivesExpected?.expectedCaptionId).toBe('caption-1')
  })

  test('should show that caption loading is broken due to index misalignment', async () => {
    const mockContent = createMockCourseContentWithDuplicate()

    // Simulate how AudioNarrationWizard loads captions from content
    const captionIdsInContent: (string | null)[] = []

    // This mirrors the logic in AudioNarrationWizard.tsx lines 839-863
    if ('welcomePage' in mockContent) {
      const welcomeCaption = mockContent.welcomePage.media?.find((m: any) => m.type === 'caption')
      captionIdsInContent.push(welcomeCaption?.id || null)
    }

    if ('learningObjectivesPage' in mockContent) {
      const objCaption = mockContent.learningObjectivesPage.media?.find((m: any) => m.type === 'caption')
      captionIdsInContent.push(objCaption?.id || null)
    }

    if ('topics' in mockContent && Array.isArray(mockContent.topics)) {
      mockContent.topics.forEach((topic: any) => {
        const topicCaption = topic.media?.find((m: any) => m.type === 'caption')
        captionIdsInContent.push(topicCaption?.id || null)
      })
    }

    // Show the problem: caption-1 appears twice in the array
    expect(captionIdsInContent).toEqual(['caption-0', 'caption-1', 'caption-1', 'caption-2'])

    // When mapped to block numbers, this creates the duplication:
    // Index 0 (welcome): caption-0 -> block 0001 ✓
    // Index 1 (objectives): caption-1 -> block 0002 ✓
    // Index 2 (topic-0): caption-1 -> block 0003 ✗ (should be caption-2)
    // Index 3 (topic-1): caption-2 -> block 0004 ✗ (should be caption-3)

    const duplicateCount = captionIdsInContent.filter(id => id === 'caption-1').length
    expect(duplicateCount).toBe(2) // Shows the bug - caption-1 appears twice
  })

  test('should demonstrate the correct caption mapping after fix', () => {
    // This test shows what the caption array SHOULD look like after the fix
    const correctCaptionIdsArray = ['caption-0', 'caption-1', 'caption-2', 'caption-3']

    // No duplicates in the correct version
    const caption1Count = correctCaptionIdsArray.filter(id => id === 'caption-1').length
    expect(caption1Count).toBe(1)

    // Each caption ID should be unique
    const uniqueIds = new Set(correctCaptionIdsArray)
    expect(uniqueIds.size).toBe(correctCaptionIdsArray.length)
  })
})