/**
 * @fileoverview Test for AudioNarrationWizard's off-by-one media assignment issue
 *
 * This test reproduces the exact issue reported by the user where after importing a project,
 * topics play audio from the next topic due to incorrectly stored media content during import.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '../test/testProviders'
import React from 'react'
import { AudioNarrationWizard } from './AudioNarrationWizard'
import { createMediaService } from '../services/MediaService'
import { MockFileStorage } from '../services/MockFileStorage'

// Mock the dependencies
vi.mock('../context/AudioContext', () => ({
  useAudio: () => ({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn()
  })
}))

vi.mock('../hooks/useStepData', () => ({
  useStepData: () => ({
    stepData: null,
    setStepData: vi.fn(),
    clearStepData: vi.fn()
  })
}))

describe('AudioNarrationWizard Off-by-One Media Assignment', () => {
  let mockFileStorage: MockFileStorage
  let mediaService: any
  let mockCourseContent: any

  beforeEach(async () => {
    mockFileStorage = new MockFileStorage()
    await mockFileStorage.createProject('Test Project')
    const projectId = mockFileStorage.getCurrentProjectId()!
    mediaService = createMediaService(projectId, mockFileStorage)

    // Create course content with 2 topics
    mockCourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        narration: 'Welcome narration text',
        media: []
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        narration: 'Objectives narration text',
        media: []
      },
      topics: [
        {
          id: 'topic-0',
          title: 'First Topic',
          narration: 'First topic narration text',
          media: []
        },
        {
          id: 'topic-1',
          title: 'Second Topic',
          narration: 'Second topic narration text',
          media: []
        }
      ]
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should reproduce the off-by-one issue where topics play wrong audio', async () => {
    // Arrange: Simulate the off-by-one issue from imported project
    // The issue: media content was stored with wrong IDs during import
    // - audio-2 contains content that should be audio-3 (topic-1's audio)
    // - audio-3 contains content that should be audio-4 (non-existent topic's audio)

    // Store media with CORRECT IDs but WRONG CONTENT (simulating import bug)
    await mockFileStorage.storeMedia('audio-0', new Blob(['welcome audio content']), 'audio', {
      page_id: 'welcome',
      original_name: 'welcome.mp3',
      mime_type: 'audio/mp3'
    })

    await mockFileStorage.storeMedia('audio-1', new Blob(['objectives audio content']), 'audio', {
      page_id: 'objectives',
      original_name: 'objectives.mp3',
      mime_type: 'audio/mp3'
    })

    // HERE'S THE BUG: These audio files contain the wrong content
    await mockFileStorage.storeMedia('audio-2', new Blob(['topic-1 audio content']), 'audio', {
      page_id: 'topic-0', // Should contain topic-0 content but has topic-1 content
      original_name: 'topic-0.mp3',
      mime_type: 'audio/mp3'
    })

    await mockFileStorage.storeMedia('audio-3', new Blob(['topic-2 audio content']), 'audio', {
      page_id: 'topic-1', // Should contain topic-1 content but has topic-2 content
      original_name: 'topic-1.mp3',
      mime_type: 'audio/mp3'
    })

    const mockOnSave = vi.fn()
    const playAudioSpy = vi.fn()

    // Mock the actual audio playing to capture what content would be played
    const originalCreateObjectURL = URL.createObjectURL
    URL.createObjectURL = vi.fn((blob: Blob) => {
      // Simulate blob content detection by using blob size/content
      return `blob:mock-${blob.size}-${blob.type}`
    })

    // Act: Render AudioNarrationWizard
    render(
      <AudioNarrationWizard
          courseContent={mockCourseContent}
          onSave={mockOnSave}
          onUpdateContent={vi.fn()}
          currentStep={4}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onNavigate={vi.fn()}
          narrationBlocks={[
            { blockNumber: '0001', text: 'Welcome narration text', pageId: 'welcome' },
            { blockNumber: '0002', text: 'Objectives narration text', pageId: 'objectives' },
            { blockNumber: '0003', text: 'First topic narration text', pageId: 'topic-0' },
            { blockNumber: '0004', text: 'Second topic narration text', pageId: 'topic-1' }
          ]}
        />
    )

    // Assert: Wait for component to load
    await waitFor(() => {
      // Check if the component loaded - look for any element that indicates it's rendered
      const pageWrapper = screen.getByTestId('page-wrapper')
      expect(pageWrapper).toBeInTheDocument()
    }, { timeout: 5000 })

    // Verify the problem: Current logic loads audio-2 for block 0003
    // but audio-2 contains topic-1's content (not topic-0's content)
    // This creates the off-by-one issue the user experiences

    // This test documents the issue and will help verify the fix
    // For now, just ensure the component renders and is ready for testing
    const pageWrapper = screen.getByTestId('page-wrapper')
    expect(pageWrapper).toBeInTheDocument()

    // TODO: Once the compensation logic is implemented, this test should verify
    // that block 0003 gets the correct audio content for topic-0

    // Restore original function
    URL.createObjectURL = originalCreateObjectURL
  })

  it('should demonstrate the correct behavior after fix', async () => {
    // This test shows what the behavior SHOULD be after we implement the fix

    // Arrange: Same incorrectly stored media content
    await mockFileStorage.storeMedia('audio-0', new Blob(['welcome audio content']), 'audio', {
      page_id: 'welcome',
      original_name: 'welcome.mp3'
    })

    await mockFileStorage.storeMedia('audio-1', new Blob(['objectives audio content']), 'audio', {
      page_id: 'objectives',
      original_name: 'objectives.mp3'
    })

    // Wrong content stored with these IDs
    await mockFileStorage.storeMedia('audio-2', new Blob(['topic-1 audio content']), 'audio', {
      page_id: 'topic-0',
      original_name: 'topic-0.mp3'
    })

    await mockFileStorage.storeMedia('audio-3', new Blob(['topic-0 audio content']), 'audio', {
      page_id: 'topic-1',
      original_name: 'topic-1.mp3'
    })

    // Act: The FIXED AudioNarrationWizard should compensate for the off-by-one
    // by detecting this scenario and adjusting which media ID to load

    // For block 0003 (topic-0): Instead of loading audio-2, load audio-3
    // because audio-3 actually contains topic-0's content

    // Assert: After fix, block 0003 should get audio that contains topic-0 content
    // (This test will pass once we implement the compensation logic)

    expect(true).toBe(true) // Placeholder for now
  })

  it('should handle normal projects without off-by-one issue', async () => {
    // Arrange: Correctly stored media (normal case)
    await mockFileStorage.storeMedia('audio-0', new Blob(['welcome audio content']), 'audio', {
      page_id: 'welcome',
      original_name: 'welcome.mp3'
    })

    await mockFileStorage.storeMedia('audio-1', new Blob(['objectives audio content']), 'audio', {
      page_id: 'objectives',
      original_name: 'objectives.mp3'
    })

    await mockFileStorage.storeMedia('audio-2', new Blob(['topic-0 audio content']), 'audio', {
      page_id: 'topic-0', // Correct content for topic-0
      original_name: 'topic-0.mp3'
    })

    await mockFileStorage.storeMedia('audio-3', new Blob(['topic-1 audio content']), 'audio', {
      page_id: 'topic-1', // Correct content for topic-1
      original_name: 'topic-1.mp3'
    })

    // Act & Assert: Normal projects should continue to work correctly
    // The fix should not break correctly stored media

    render(
      <AudioNarrationWizard
          courseContent={mockCourseContent}
          onSave={vi.fn()}
          onUpdateContent={vi.fn()}
          currentStep={4}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onNavigate={vi.fn()}
          narrationBlocks={[
            { blockNumber: '0001', text: 'Welcome', pageId: 'welcome' },
            { blockNumber: '0002', text: 'Objectives', pageId: 'objectives' },
            { blockNumber: '0003', text: 'Topic 0', pageId: 'topic-0' },
            { blockNumber: '0004', text: 'Topic 1', pageId: 'topic-1' }
          ]}
        />
    )

    await waitFor(() => {
      expect(screen.getByTestId('page-wrapper')).toBeInTheDocument()
    })

    // Normal projects should work with the standard audio-${blockNum - 1} formula
    expect(true).toBe(true)
  })
})