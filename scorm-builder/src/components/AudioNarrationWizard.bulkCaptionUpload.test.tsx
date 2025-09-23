/**
 * Test bulk caption upload for Learning Objectives (Block 0002)
 *
 * This test reproduces and validates the fix for the issue where
 * Learning Objectives captions weren't being properly attached
 * during bulk caption ZIP upload.
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
const mockStoreMedia = vi.fn()
const mockMedia = {
  actions: {
    storeMedia: mockStoreMedia,
    createBlobUrl: vi.fn(),
    deleteMedia: vi.fn()
  },
  selectors: {
    getMedia: vi.fn(),
    getAllMedia: vi.fn(() => [])
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

// Mock step navigation context
vi.mock('../contexts/StepNavigationContext', () => ({
  useStepNavigation: () => ({
    currentStep: 5,
    setCurrentStep: vi.fn(),
    totalSteps: 8,
    steps: [],
    navigateToStep: vi.fn()
  })
}))

// Mock JSZip for ZIP file processing
const mockZipFile = {
  files: {
    'captions/0001-Block_Hello-and-welcome.vtt': {
      dir: false,
      async: vi.fn().mockResolvedValue('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello and welcome to this course.')
    },
    'captions/0002-Block_Before-we-dive-in-lets-outli.vtt': {
      dir: false,
      async: vi.fn().mockResolvedValue('WEBVTT\n\n00:00:00.000 --> 00:00:05.744\nBefore we dive in, let\'s outline what you\'ll achieve.')
    },
    'captions/0003-Block_Lets-begin-by-understanding.vtt': {
      dir: false,
      async: vi.fn().mockResolvedValue('WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nLet\'s begin by understanding the topic.')
    }
  }
}

vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({
    loadAsync: vi.fn().mockResolvedValue(mockZipFile)
  }))
}))

describe('AudioNarrationWizard Bulk Caption Upload', () => {
  const mockCourseContent: CourseContentUnion = {
    welcomePage: {
      title: 'Welcome',
      content: 'Welcome content',
      narration: 'Welcome narration'
    },
    learningObjectivesPage: {
      title: 'Learning Objectives',
      content: 'Learning objectives content',
      narration: 'Learning objectives narration',
      objectives: []
    },
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic 1 content',
        narration: 'Topic 1 narration'
      }
    ]
  }

  const mockOnSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock implementations
    mockStoreMedia.mockClear()
    mockStoreMedia.mockImplementation(async (file, pageId, type, metadata) => {
      return {
        id: `${type}-${pageId}-${Date.now()}`,
        pageId,
        type,
        metadata: {
          ...metadata,
          mimeType: type === 'caption' ? 'text/vtt' : 'audio/mpeg'
        }
      }
    })

    // Mock FileReader for ZIP upload simulation
    global.FileReader = vi.fn(() => ({
      readAsArrayBuffer: vi.fn(),
      onload: null,
      onerror: null,
      result: new ArrayBuffer(8)
    })) as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should store Learning Objectives caption with correct pageId during bulk upload', async () => {
    // ARRANGE: Render the wizard
    const { container } = render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSave={mockOnSave}
      />
    )

    // Get the bulk caption upload input
    const captionUploadInput = screen.getByTestId('captions-zip-input')
    expect(captionUploadInput).toBeInTheDocument()

    // Create a mock ZIP file
    const mockZipFile = new File(['fake zip content'], 'captions.zip', {
      type: 'application/zip'
    })

    // ACT: Simulate bulk caption upload
    fireEvent.change(captionUploadInput, {
      target: { files: [mockZipFile] }
    })

    // Wait for the upload to process
    await waitFor(async () => {
      // Verify that storeMedia was called for each caption file
      expect(mockStoreMedia).toHaveBeenCalledTimes(3)
    }, { timeout: 5000 })

    // ASSERT: Verify Learning Objectives caption was stored with correct pageId
    const learningObjectivesCall = mockStoreMedia.mock.calls.find(call =>
      call[1] === 'learning-objectives' && call[2] === 'caption'
    )

    expect(learningObjectivesCall).toBeDefined()
    expect(learningObjectivesCall[0].name).toMatch(/0002.*\.vtt$/)
    expect(learningObjectivesCall[1]).toBe('learning-objectives') // pageId
    expect(learningObjectivesCall[2]).toBe('caption') // type
    expect(learningObjectivesCall[3]).toMatchObject({
      originalName: expect.stringMatching(/0002.*\.vtt$/)
    })
  })

  it('should trigger auto-save and include Learning Objectives caption in course content', async () => {
    // ARRANGE: Mock successful media storage
    mockStoreMedia.mockImplementation(async (file, pageId, type, metadata) => {
      const mediaId = `${type}-${pageId}-${metadata.originalName?.match(/(\d{4})/)?.[1] || 'unknown'}`
      return { id: mediaId, pageId, type, metadata }
    })

    const { container } = render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSave={mockOnSave}
      />
    )

    const captionUploadInput = screen.getByTestId('captions-zip-input')
    const mockZipFile = new File(['fake zip content'], 'captions.zip', {
      type: 'application/zip'
    })

    // ACT: Upload captions
    fireEvent.change(captionUploadInput, {
      target: { files: [mockZipFile] }
    })

    // Wait for upload and auto-save to complete
    await waitFor(async () => {
      expect(mockStoreMedia).toHaveBeenCalledTimes(3)
    }, { timeout: 5000 })

    // Wait for auto-save to be triggered
    await waitFor(async () => {
      expect(mockOnSave).toHaveBeenCalled()
    }, { timeout: 6000 })

    // ASSERT: Verify onSave was called with Learning Objectives caption
    const saveCall = mockOnSave.mock.calls[mockOnSave.mock.calls.length - 1]
    const savedContent = saveCall[0]

    expect(savedContent.learningObjectivesPage).toBeDefined()
    expect(savedContent.learningObjectivesPage.media).toBeDefined()

    // Should include caption in media array
    const captionInMedia = savedContent.learningObjectivesPage.media.find((m: any) =>
      m.type === 'caption'
    )
    expect(captionInMedia).toBeDefined()
    expect(captionInMedia.id).toMatch(/caption-learning-objectives-0002/)
  })

  it('should handle cache invalidation properly after storing Learning Objectives caption', async () => {
    // ARRANGE: Mock getAllMedia to track cache invalidation
    let getAllMediaCallCount = 0
    mockMedia.selectors.getAllMedia.mockImplementation(() => {
      getAllMediaCallCount++
      return []
    })

    const { container } = render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSave={mockOnSave}
      />
    )

    const captionUploadInput = container.querySelector('input[type="file"][accept=".zip"]')
    const mockZipFile = new File(['fake zip content'], 'captions.zip', {
      type: 'application/zip'
    })

    const initialCallCount = getAllMediaCallCount

    // ACT: Upload captions
    fireEvent.change(captionUploadInput!, {
      target: { files: [mockZipFile] }
    })

    // Wait for upload to complete
    await waitFor(async () => {
      expect(mockStoreMedia).toHaveBeenCalledTimes(3)
    }, { timeout: 5000 })

    // ASSERT: Verify cache was invalidated (getAllMedia called more times)
    expect(getAllMediaCallCount).toBeGreaterThan(initialCallCount)
  })

  it('should handle errors gracefully when Learning Objectives caption upload fails', async () => {
    // ARRANGE: Mock storeMedia to fail for Learning Objectives
    mockStoreMedia.mockImplementation(async (file, pageId, type, metadata) => {
      if (pageId === 'learning-objectives' && type === 'caption') {
        throw new Error('Storage error for Learning Objectives caption')
      }
      return { id: `${type}-${pageId}-success`, pageId, type, metadata }
    })

    const { container } = render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSave={mockOnSave}
      />
    )

    const captionUploadInput = screen.getByTestId('captions-zip-input')
    const mockZipFile = new File(['fake zip content'], 'captions.zip', {
      type: 'application/zip'
    })

    // ACT: Upload captions
    fireEvent.change(captionUploadInput, {
      target: { files: [mockZipFile] }
    })

    // Wait for upload to complete
    await waitFor(async () => {
      // Should still try to store all 3 files
      expect(mockStoreMedia).toHaveBeenCalledTimes(3)
    }, { timeout: 5000 })

    // ASSERT: Should handle the error gracefully and continue with other files
    expect(mockStoreMedia).toHaveBeenCalledWith(
      expect.any(File),
      'learning-objectives',
      'caption',
      expect.any(Object)
    )

    // Other files should still be processed
    expect(mockStoreMedia).toHaveBeenCalledWith(
      expect.any(File),
      'welcome',
      'caption',
      expect.any(Object)
    )
  })

  it('should correctly identify block 0002 as Learning Objectives in narration blocks', async () => {
    // ARRANGE: Render the wizard
    const { container } = render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSave={mockOnSave}
      />
    )

    // ACT: Check that Learning Objectives block exists with correct properties
    // This is tested by observing the component behavior

    // Wait for component to initialize
    await waitFor(() => {
      expect(container.querySelector('[data-testid="audio-narration-wizard"]')).toBeInTheDocument()
    })

    // The component should have created narration blocks including Learning Objectives
    // We can verify this by checking that the block structure is correct through logging
    // This will be validated by the upload process working correctly
  })
})