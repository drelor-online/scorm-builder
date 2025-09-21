/**
 * Test for SCORMPackageBuilder objectives fallback media collection
 *
 * This test verifies that audio-1 and caption-1 are always added to mediaToLoad
 * when an objectives/learningObjectivesPage exists, even if not explicitly
 * defined in the course content.
 *
 * Follows TDD approach: This test should initially FAIL, then pass after
 * implementing the fallback logic in SCORMPackageBuilder.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import React from 'react'

// Mock all external dependencies
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
  emit: vi.fn()
}))

vi.mock('../services/MediaService', () => ({
  createMediaService: vi.fn(() => ({
    getMediaBatchDirect: vi.fn(),
    listAllMedia: vi.fn(),
    getMedia: vi.fn()
  }))
}))

vi.mock('../services/rustScormGenerator', () => ({
  generateRustSCORM: vi.fn(),
  getExtensionFromMimeType: vi.fn((type: string) => {
    if (type.includes('audio')) return '.mp3'
    if (type.includes('caption') || type.includes('vtt')) return '.vtt'
    return '.bin'
  })
}))

vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: vi.fn(() => ({
    currentProjectId: 'test-project',
    saveProject: vi.fn(),
    loadProject: vi.fn()
  }))
}))

vi.mock('../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: vi.fn(() => ({
    getAllMedia: vi.fn(() => []),
    getMediaBatchDirect: vi.fn(() => Promise.resolve(new Map())),
    isLoading: false,
    error: null
  }))
}))

vi.mock('../services/storageMigration', () => ({
  getLearningObjectivesAudioCaption: vi.fn(() => ({ audio: null, caption: null }))
}))

vi.mock('../contexts/NotificationContext', () => ({
  useNotifications: vi.fn(() => ({
    addNotification: vi.fn(),
    removeNotification: vi.fn(),
    notifications: []
  }))
}))

vi.mock('../contexts/StepNavigationContext', () => ({
  useStepNavigation: vi.fn(() => ({
    currentStep: 'scorm-generation',
    setCurrentStep: vi.fn(),
    completedSteps: [],
    isStepCompleted: vi.fn(() => true)
  }))
}))

// Mock console methods to capture debug logs
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

import SCORMPackageBuilder from './SCORMPackageBuilder'

describe('SCORMPackageBuilder Objectives Fallback Media Collection', () => {
  let mockOnComplete: any
  let mockGenerateRustSCORM: any

  beforeEach(async () => {
    vi.clearAllMocks()
    mockOnComplete = vi.fn()

    // Get the mocked generateRustSCORM function
    const rustScormModule = await import('../services/rustScormGenerator')
    mockGenerateRustSCORM = rustScormModule.generateRustSCORM as any
    mockGenerateRustSCORM.mockImplementation(async (content: any, settings: any, mediaMap: any, extensionMap: any) => {
      // Capture what media was passed to the SCORM generator
      const mediaIds = Array.from(mediaMap.keys())
      console.log(`[TEST] Media passed to SCORM generator: ${mediaIds.join(', ')}`)
      return new Uint8Array([1, 2, 3]) // Mock SCORM package bytes
    })
  })

  afterEach(() => {
    consoleSpy.mockClear()
  })

  it('should include audio-1 and caption-1 in mediaToLoad when learningObjectivesPage exists', async () => {
    // This test is expected to FAIL initially because the fallback logic hasn't been implemented yet
    // After implementing the fallback logic in SCORMPackageBuilder.tsx, this test should pass

    const courseContent = {
      title: "Test Course",
      welcomePage: {
        title: "Welcome",
        content: "Welcome to the course",
        media: []
      },
      learningObjectivesPage: {
        title: "Learning Objectives",
        heading: "What You Will Learn",
        objectives: ["Learn something important"],
        // NOTE: No explicit audioId, audioFile, captionId, or captionFile
        media: [] // Empty media array - should trigger fallback
      },
      topics: [],
      assessment: {
        questions: []
      }
    }

    const courseSeedData = {
      courseTitle: "Test Course"
    }

    // Mock the component to trigger generation immediately
    const mockComponent = render(
      <SCORMPackageBuilder
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onComplete={mockOnComplete}
        onError={vi.fn()}
      />
    )

    // Find and click the generate button to trigger SCORM generation
    const generateButton = mockComponent.getByText(/Generate SCORM Package/i) ||
                           mockComponent.getByText(/Generate/i) ||
                           mockComponent.getByRole('button', { name: /generate/i })

    if (generateButton) {
      generateButton.click()
    }

    // Wait for SCORM generation to be called
    await waitFor(() => {
      expect(mockGenerateRustSCORM).toHaveBeenCalled()
    }, { timeout: 15000 })

    // Verify that generateRustSCORM was called with media including audio-1 and caption-1
    const callArgs = mockGenerateRustSCORM.mock.calls[0]
    const mediaMap = callArgs[2] // Third argument is the media map
    const mediaIds = Array.from(mediaMap.keys())

    // This assertion will FAIL until we implement the fallback logic
    expect(mediaIds).toContain('audio-1')
    expect(mediaIds).toContain('caption-1')

    console.log(`[TEST] ✅ Verified audio-1 and caption-1 are included in media collection`)
  })

  it('should include audio-1 and caption-1 when objectivesPage exists (alternative naming)', async () => {
    const courseContent = {
      title: "Test Course",
      welcomePage: {
        title: "Welcome",
        content: "Welcome to the course",
        media: []
      },
      objectivesPage: { // Note: using objectivesPage instead of learningObjectivesPage
        title: "Learning Objectives",
        heading: "What You Will Learn",
        objectives: ["Learn something important"],
        media: []
      },
      topics: [],
      assessment: {
        questions: []
      }
    }

    const courseSeedData = {
      courseTitle: "Test Course"
    }

    render(
      <SCORMPackageBuilder
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onComplete={mockOnComplete}
        onError={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(mockGenerateRustSCORM).toHaveBeenCalled()
    }, { timeout: 10000 })

    const callArgs = mockGenerateRustSCORM.mock.calls[0]
    const mediaMap = callArgs[2]
    const mediaIds = Array.from(mediaMap.keys())

    expect(mediaIds).toContain('audio-1')
    expect(mediaIds).toContain('caption-1')

    console.log(`[TEST] ✅ Verified fallback works with objectivesPage naming`)
  })

  it('should include both explicit and fallback media when both are present', async () => {
    const courseContent = {
      title: "Test Course",
      welcomePage: {
        title: "Welcome",
        content: "Welcome to the course",
        media: []
      },
      learningObjectivesPage: {
        title: "Learning Objectives",
        heading: "What You Will Learn",
        objectives: ["Learn something important"],
        audioFile: "custom-objectives-audio", // Explicit audio
        captionFile: "custom-objectives-caption", // Explicit caption
        media: [
          { id: "custom-objectives-audio", type: "audio" },
          { id: "custom-objectives-caption", type: "caption" }
        ]
      },
      topics: [],
      assessment: {
        questions: []
      }
    }

    const courseSeedData = {
      courseTitle: "Test Course"
    }

    render(
      <SCORMPackageBuilder
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onComplete={mockOnComplete}
        onError={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(mockGenerateRustSCORM).toHaveBeenCalled()
    }, { timeout: 10000 })

    const callArgs = mockGenerateRustSCORM.mock.calls[0]
    const mediaMap = callArgs[2]
    const mediaIds = Array.from(mediaMap.keys())

    // Should have both explicit and fallback media
    expect(mediaIds).toContain('custom-objectives-audio')
    expect(mediaIds).toContain('custom-objectives-caption')
    expect(mediaIds).toContain('audio-1')
    expect(mediaIds).toContain('caption-1')

    console.log(`[TEST] ✅ Verified both explicit and fallback media are included`)
  })

  it('should NOT include fallback media when no objectives page exists', async () => {
    const courseContent = {
      title: "Test Course",
      welcomePage: {
        title: "Welcome",
        content: "Welcome to the course",
        media: []
      },
      // No learningObjectivesPage or objectivesPage
      topics: [],
      assessment: {
        questions: []
      }
    }

    const courseSeedData = {
      courseTitle: "Test Course"
    }

    render(
      <SCORMPackageBuilder
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onComplete={mockOnComplete}
        onError={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(mockGenerateRustSCORM).toHaveBeenCalled()
    }, { timeout: 10000 })

    const callArgs = mockGenerateRustSCORM.mock.calls[0]
    const mediaMap = callArgs[2]
    const mediaIds = Array.from(mediaMap.keys())

    // Should NOT have fallback media when no objectives page
    expect(mediaIds).not.toContain('audio-1')
    expect(mediaIds).not.toContain('caption-1')

    console.log(`[TEST] ✅ Verified no fallback media when objectives page missing`)
  })
})