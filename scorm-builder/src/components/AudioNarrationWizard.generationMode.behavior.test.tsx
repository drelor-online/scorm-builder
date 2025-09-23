/**
 * Test generation mode detection in AudioNarrationWizard
 *
 * This test reproduces the issue where generation mode is incorrectly
 * enabled for existing media loading, causing 45-60 second timeouts
 * instead of the expected 5-20 second timeouts.
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

// Mock the media context
const mockMedia = {
  actions: {
    storeMedia: vi.fn(),
    createBlobUrl: vi.fn(),
    deleteMedia: vi.fn()
  },
  selectors: {
    getMedia: vi.fn(),
    getAllMedia: vi.fn(() => [
      // Existing audio media that should not trigger generation mode
      { id: 'audio-0', type: 'audio', pageId: 'welcome', metadata: { originalName: 'welcome.mp3' } },
      { id: 'audio-1', type: 'audio', pageId: 'learning-objectives', metadata: { originalName: 'objectives.mp3' } },
      { id: 'caption-0', type: 'caption', pageId: 'welcome', metadata: { originalName: 'welcome.vtt' } }
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

// Mock MediaService to capture generation mode usage
const mockGetMediaBatchDirect = vi.fn()
const mockCreateMediaService = vi.fn(() => ({
  getMediaBatchDirect: mockGetMediaBatchDirect
}))

vi.mock('../services/MediaService', () => ({
  createMediaService: mockCreateMediaService
}))

describe('AudioNarrationWizard Generation Mode Detection', () => {
  const mockCourseContent: CourseContentUnion = {
    welcomePage: {
      title: 'Welcome',
      content: 'Welcome content',
      narration: 'Welcome narration',
      media: [{ id: 'audio-0', type: 'audio' as const }]
    },
    learningObjectivesPage: {
      title: 'Learning Objectives',
      content: 'Learning objectives content',
      narration: 'Learning objectives narration',
      objectives: [],
      media: [{ id: 'audio-1', type: 'audio' as const }, { id: 'caption-0', type: 'caption' as const }]
    },
    topics: []
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock successful batch loading
    mockGetMediaBatchDirect.mockResolvedValue(new Map([
      ['audio-0', { data: new Uint8Array([1, 2, 3]), metadata: { mimeType: 'audio/mpeg' } }],
      ['audio-1', { data: new Uint8Array([4, 5, 6]), metadata: { mimeType: 'audio/mpeg' } }],
      ['caption-0', { data: new Uint8Array([7, 8, 9]), metadata: { mimeType: 'text/vtt' } }]
    ]))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should NOT enable generation mode when loading existing media for duration calculation', async () => {
    // ARRANGE: Render the wizard with existing media
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSave={vi.fn()}
      />
    )

    // Wait for component to initialize and trigger duration loading
    await waitFor(() => {
      expect(mockCreateMediaService).toHaveBeenCalled()
    }, { timeout: 10000 })

    // ASSERT: MediaService should NOT be created with generation mode enabled
    const mediaServiceCalls = mockCreateMediaService.mock.calls
    expect(mediaServiceCalls.length).toBeGreaterThan(0)

    // Check the last call (most recent MediaService creation)
    const lastCall = mediaServiceCalls[mediaServiceCalls.length - 1]
    const [projectId, fileStorage, generationMode] = lastCall

    expect(projectId).toBe('test-project-123')
    expect(generationMode).toBe(false) // This should be false for existing media loading
  })

  it('should use normal timeouts (not generation mode timeouts) for existing media', async () => {
    // ARRANGE: Start timing the operation
    const startTime = Date.now()

    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSave={vi.fn()}
      />
    )

    // Wait for duration loading to complete
    await waitFor(() => {
      expect(mockGetMediaBatchDirect).toHaveBeenCalled()
    }, { timeout: 10000 })

    const endTime = Date.now()
    const duration = endTime - startTime

    // ASSERT: Operation should complete in reasonable time (not 45-60 seconds)
    expect(duration).toBeLessThan(10000) // Should complete in under 10 seconds
  })

  it('should handle timeout errors gracefully when not in generation mode', async () => {
    // ARRANGE: Mock a timeout scenario
    mockGetMediaBatchDirect.mockRejectedValue(new Error('Timeout: Failed to load media within time limit'))

    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSave={vi.fn()}
      />
    )

    // ACT: Wait for the timeout to occur
    await waitFor(() => {
      expect(mockGetMediaBatchDirect).toHaveBeenCalled()
    }, { timeout: 10000 })

    // ASSERT: Component should handle timeout gracefully without freezing
    // The wizard should still render and be usable
    expect(screen.getByTestId('audio-narration-wizard')).toBeInTheDocument()
  })

  it('should detect existing media correctly and avoid unnecessary generation', async () => {
    // ARRANGE: Render with existing media
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSave={vi.fn()}
      />
    )

    // Wait for initialization
    await waitFor(() => {
      expect(mockCreateMediaService).toHaveBeenCalled()
    }, { timeout: 10000 })

    // ASSERT: Should recognize that media already exists
    expect(mockMedia.selectors.getAllMedia).toHaveBeenCalled()

    // Should use normal loading path, not generation path
    const mediaServiceCall = mockCreateMediaService.mock.calls[0]
    expect(mediaServiceCall[2]).toBe(false) // generationMode should be false
  })
})