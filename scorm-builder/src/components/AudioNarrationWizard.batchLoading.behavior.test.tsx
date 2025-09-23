/**
 * Test batch loading optimization in AudioNarrationWizard
 *
 * This test reproduces the issue where caption loading calls getMedia()
 * sequentially instead of using batch loading, causing delays.
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AudioNarrationWizard } from './AudioNarrationWizard'
import type { CourseContentUnion } from '../types/aiPrompt'

// Mock the storage context
const mockStorage = {
  currentProjectId: 'test-project-123',
  getContent: vi.fn(),
  saveContent: vi.fn()
}

vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: () => mockStorage
}))

// Track sequential getMedia calls
const mockGetMedia = vi.fn()

// Mock the media context
const mockMedia = {
  actions: {
    storeMedia: vi.fn(),
    createBlobUrl: vi.fn(),
    deleteMedia: vi.fn()
  },
  selectors: {
    getMedia: mockGetMedia,
    getAllMedia: vi.fn(() => [
      // Multiple existing caption media that should be batch loaded
      { id: 'caption-0', type: 'caption', pageId: 'welcome', metadata: { originalName: 'welcome.vtt' } },
      { id: 'caption-1', type: 'caption', pageId: 'learning-objectives', metadata: { originalName: 'objectives.vtt' } },
      { id: 'caption-2', type: 'caption', pageId: 'topic-1', metadata: { originalName: 'topic1.vtt' } },
      { id: 'caption-3', type: 'caption', pageId: 'topic-2', metadata: { originalName: 'topic2.vtt' } }
    ])
  }
}

vi.mock('../hooks/useMedia', () => ({
  useMedia: () => mockMedia
}))

// Mock other required contexts
vi.mock('../contexts/UnsavedChangesContext', () => ({
  useUnsavedChanges: () => ({
    markUnsaved: vi.fn(),
    markSaved: vi.fn(),
    hasUnsavedChanges: false
  })
}))

vi.mock('../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn()
  })
}))

vi.mock('../hooks/useStepData', () => ({
  useStepData: () => ({
    currentStep: 5,
    totalSteps: 8,
    stepName: 'Audio Narration'
  })
}))

vi.mock('../contexts/StepNavigationContext', () => ({
  useStepNavigation: () => ({
    currentStep: 5,
    setCurrentStep: vi.fn(),
    totalSteps: 8,
    steps: [],
    navigateToStep: vi.fn()
  })
}))

// Mock MediaService batch loading
const mockGetMediaBatchDirect = vi.fn()
const mockCreateMediaService = vi.fn(() => ({
  getMediaBatchDirect: mockGetMediaBatchDirect
}))

vi.mock('../services/MediaService', () => ({
  createMediaService: mockCreateMediaService
}))

describe('AudioNarrationWizard Batch Loading Optimization', () => {
  const mockCourseContent: CourseContentUnion = {
    welcomePage: {
      title: 'Welcome',
      content: 'Welcome content',
      narration: 'Welcome narration',
      media: [{ id: 'caption-0', type: 'caption' as const }]
    },
    learningObjectivesPage: {
      title: 'Learning Objectives',
      content: 'Learning objectives content',
      narration: 'Learning objectives narration',
      objectives: [],
      media: [{ id: 'caption-1', type: 'caption' as const }]
    },
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic 1 content',
        narration: 'Topic 1 narration',
        media: [{ id: 'caption-2', type: 'caption' as const }]
      },
      {
        id: 'topic-2',
        title: 'Topic 2',
        content: 'Topic 2 content',
        narration: 'Topic 2 narration',
        media: [{ id: 'caption-3', type: 'caption' as const }]
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock getMedia to simulate caption loading
    mockGetMedia.mockImplementation(async (id: string) => ({
      id,
      data: new Uint8Array(Array.from(`WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nCaption for ${id}`, c => c.charCodeAt(0))),
      metadata: { mimeType: 'text/vtt' }
    }))

    // Mock successful batch loading
    mockGetMediaBatchDirect.mockResolvedValue(new Map())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should minimize sequential getMedia calls for caption loading', async () => {
    // ARRANGE: Track the timing and number of getMedia calls
    const getMediaCallTimes: number[] = []
    mockGetMedia.mockImplementation(async (id: string) => {
      getMediaCallTimes.push(Date.now())
      // Simulate a 100ms delay for each getMedia call
      await new Promise(resolve => setTimeout(resolve, 100))
      return {
        id,
        data: new Uint8Array(Array.from(`WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nCaption for ${id}`, c => c.charCodeAt(0))),
        metadata: { mimeType: 'text/vtt' }
      }
    })

    // ACT: Render the wizard
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSave={vi.fn()}
      />
    )

    // Wait for caption loading to complete
    await waitFor(() => {
      expect(mockGetMedia).toHaveBeenCalled()
    }, { timeout: 10000 })

    // ASSERT: Should have minimal getMedia calls (ideally through batch loading)
    const totalGetMediaCalls = mockGetMedia.mock.calls.length
    console.log(`Total getMedia calls: ${totalGetMediaCalls}`)

    // In an optimized system, we should have minimal sequential calls
    // If we have 4 captions and they're loaded sequentially, that's not optimal
    if (totalGetMediaCalls >= 4) {
      // Check if calls were made in parallel (overlapping time windows)
      if (getMediaCallTimes.length >= 2) {
        const maxTimeDiff = Math.max(...getMediaCallTimes) - Math.min(...getMediaCallTimes)
        console.log(`Time span of getMedia calls: ${maxTimeDiff}ms`)

        // If calls were truly sequential with 100ms delay each, 4 calls would take ~400ms
        // If they're parallel, they should complete in ~100-200ms
        expect(maxTimeDiff).toBeLessThan(300) // Allow some buffer, but should be much less than 400ms
      }
    }
  })

  it('should use batch loading when available instead of individual getMedia calls', async () => {
    // ARRANGE: Mock batch loading to succeed
    mockGetMediaBatchDirect.mockResolvedValue(new Map([
      ['caption-0', { data: new Uint8Array([1, 2, 3]), metadata: { mimeType: 'text/vtt' } }],
      ['caption-1', { data: new Uint8Array([4, 5, 6]), metadata: { mimeType: 'text/vtt' } }],
      ['caption-2', { data: new Uint8Array([7, 8, 9]), metadata: { mimeType: 'text/vtt' } }],
      ['caption-3', { data: new Uint8Array([10, 11, 12]), metadata: { mimeType: 'text/vtt' } }]
    ]))

    // ACT: Render the wizard
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSave={vi.fn()}
      />
    )

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('audio-narration-wizard')).toBeInTheDocument()
    }, { timeout: 10000 })

    // ASSERT: Should prefer batch loading over individual getMedia calls
    // If batch loading is available and working, individual getMedia calls should be minimal
    const individualCalls = mockGetMedia.mock.calls.length
    console.log(`Individual getMedia calls: ${individualCalls}`)

    // In an ideal optimization, we should have 0 individual calls when batch loading works
    // For now, let's just ensure it's reasonable (not one call per caption)
    expect(individualCalls).toBeLessThan(4) // Should not call getMedia for every single caption
  })

  it('should complete caption loading within reasonable time', async () => {
    // ARRANGE: Start timing
    const startTime = Date.now()

    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSave={vi.fn()}
      />
    )

    // Wait for loading to be marked as complete
    await waitFor(() => {
      expect(screen.getByTestId('audio-narration-wizard')).toBeInTheDocument()
    }, { timeout: 15000 })

    const endTime = Date.now()
    const duration = endTime - startTime

    // ASSERT: Should complete in reasonable time (not like the reported 20+ seconds)
    console.log(`Caption loading duration: ${duration}ms`)
    expect(duration).toBeLessThan(10000) // Should complete in under 10 seconds
  })
})