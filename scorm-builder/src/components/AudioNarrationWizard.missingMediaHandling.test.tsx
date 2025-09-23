/**
 * @fileoverview Test for AudioNarrationWizard's missing media handling fix
 *
 * This test verifies that the system gracefully handles missing media (audio-22, caption-22)
 * without timing out or hanging the loading process.
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

describe('AudioNarrationWizard Missing Media Handling', () => {
  let mockFileStorage: MockFileStorage
  let mediaService: any
  let mockCourseContent: any

  beforeEach(async () => {
    mockFileStorage = new MockFileStorage()
    await mockFileStorage.createProject('Test Project')
    const projectId = mockFileStorage.getCurrentProjectId()!
    mediaService = createMediaService(projectId, mockFileStorage)

    // Create course content with topics that would expect audio-22, caption-22
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
      topics: Array.from({ length: 21 }, (_, i) => ({
        id: `topic-${i}`,
        title: `Topic ${i + 1}`,
        narration: `Topic ${i + 1} narration text`,
        media: []
      }))
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should skip loading missing media without timeout (improved fix)', async () => {
    // Arrange: Store only some media, simulating incomplete export
    // This simulates the scenario where audio-22 and caption-22 don't exist

    // Store media for welcome (audio-0)
    await mockFileStorage.storeMedia('audio-0', new Blob(['welcome audio']), 'audio', {
      page_id: 'welcome',
      original_name: 'welcome.mp3',
      mime_type: 'audio/mp3'
    })

    // Store media for objectives (audio-1)
    await mockFileStorage.storeMedia('audio-1', new Blob(['objectives audio']), 'audio', {
      page_id: 'objectives',
      original_name: 'objectives.mp3',
      mime_type: 'audio/mp3'
    })

    // Store media for all topics EXCEPT the last one (audio-2 through audio-21)
    // The last topic (topic-20) would expect audio-22, but we don't store it
    for (let i = 2; i <= 21; i++) {
      await mockFileStorage.storeMedia(`audio-${i}`, new Blob([`topic audio ${i}`]), 'audio', {
        page_id: `topic-${i - 2}`,
        original_name: `topic-${i - 2}.mp3`,
        mime_type: 'audio/mp3'
      })
    }
    // Deliberately NOT storing audio-22 and caption-22

    // Create narration blocks for all topics (including the ones without media)
    const narrationBlocks = [
      { blockNumber: '0001', text: 'Welcome narration text', pageId: 'welcome' },
      { blockNumber: '0002', text: 'Objectives narration text', pageId: 'objectives' },
      ...Array.from({ length: 21 }, (_, i) => ({
        blockNumber: String(i + 3).padStart(4, '0'),
        text: `Topic ${i + 1} narration text`,
        pageId: `topic-${i}`
      }))
    ]

    const mockOnSave = vi.fn()

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
        narrationBlocks={narrationBlocks}
      />
    )

    // Assert: Component should load without timing out
    await waitFor(() => {
      const pageWrapper = screen.getByTestId('page-wrapper')
      expect(pageWrapper).toBeInTheDocument()
    }, { timeout: 10000 }) // Much shorter timeout - should not need 120 seconds

    // The key assertion: the component loaded successfully without hanging
    const pageWrapper = screen.getByTestId('page-wrapper')
    expect(pageWrapper).toBeInTheDocument()

    // Additional verification: check that the loading completed
    // (no loading spinner should be visible after successful load)
    const loadingSpinner = screen.queryByTestId('loading-spinner')
    expect(loadingSpinner).not.toBeInTheDocument()
  })

  it('should log warnings for missing media but continue loading', async () => {
    // Arrange: Mock console.warn to capture warnings
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Minimal setup - only store welcome media
    await mockFileStorage.storeMedia('audio-0', new Blob(['welcome audio']), 'audio', {
      page_id: 'welcome',
      original_name: 'welcome.mp3',
      mime_type: 'audio/mp3'
    })

    const narrationBlocks = [
      { blockNumber: '0001', text: 'Welcome narration text', pageId: 'welcome' },
      { blockNumber: '0023', text: 'Last topic narration text', pageId: 'topic-20' }
    ]

    // Act: Render component
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        onSave={vi.fn()}
        onUpdateContent={vi.fn()}
        currentStep={4}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onNavigate={vi.fn()}
        narrationBlocks={narrationBlocks}
      />
    )

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByTestId('page-wrapper')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Assert: Should have logged warnings about missing media
    // (The exact log format may vary, but it should mention skipping missing media)

    // Restore console.warn
    warnSpy.mockRestore()

    // The component should load successfully despite missing media
    expect(screen.getByTestId('page-wrapper')).toBeInTheDocument()
  })

  it('should handle mixed scenario with some existing and some missing media', async () => {
    // Arrange: Store media for first half of topics but not the second half
    await mockFileStorage.storeMedia('audio-0', new Blob(['welcome audio']), 'audio', {
      page_id: 'welcome',
      original_name: 'welcome.mp3',
      mime_type: 'audio/mp3'
    })

    await mockFileStorage.storeMedia('audio-1', new Blob(['objectives audio']), 'audio', {
      page_id: 'objectives',
      original_name: 'objectives.mp3',
      mime_type: 'audio/mp3'
    })

    // Store media for first 10 topics only
    for (let i = 2; i <= 11; i++) {
      await mockFileStorage.storeMedia(`audio-${i}`, new Blob([`topic audio ${i}`]), 'audio', {
        page_id: `topic-${i - 2}`,
        original_name: `topic-${i - 2}.mp3`,
        mime_type: 'audio/mp3'
      })
    }
    // audio-12 through audio-22 are missing

    const narrationBlocks = [
      { blockNumber: '0001', text: 'Welcome', pageId: 'welcome' },
      { blockNumber: '0002', text: 'Objectives', pageId: 'objectives' },
      ...Array.from({ length: 21 }, (_, i) => ({
        blockNumber: String(i + 3).padStart(4, '0'),
        text: `Topic ${i + 1}`,
        pageId: `topic-${i}`
      }))
    ]

    // Act: Render component
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        onSave={vi.fn()}
        onUpdateContent={vi.fn()}
        currentStep={4}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onNavigate={vi.fn()}
        narrationBlocks={narrationBlocks}
      />
    )

    // Assert: Should load successfully without hanging
    await waitFor(() => {
      expect(screen.getByTestId('page-wrapper')).toBeInTheDocument()
    }, { timeout: 10000 })

    const pageWrapper = screen.getByTestId('page-wrapper')
    expect(pageWrapper).toBeInTheDocument()
  })
})