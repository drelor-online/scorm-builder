/**
 * Real-world behavior test for the Complex Projects - 02 - Hazardous Area Classification project
 * This test simulates the exact scenario the user reported to verify caption-1 inclusion
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
    currentProjectId: '1756944132721', // The exact project ID from user's report
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

describe('SCORMPackageBuilder Real World Test - Complex Projects Project', () => {
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
      console.log(`[REAL-WORLD-TEST] Media passed to SCORM generator: ${mediaIds.join(', ')}`)
      return new Uint8Array([1, 2, 3]) // Mock SCORM package bytes
    })
  })

  afterEach(() => {
    consoleSpy.mockClear()
  })

  it('should include caption-1 for Complex Projects - 02 - Hazardous Area Classification', async () => {
    // Simulate the actual course content structure based on the user's project
    const courseContent = {
      title: "Complex Projects - 02 - Hazardous Area Classification",
      welcomePage: {
        title: "Welcome",
        content: "Welcome to Complex Projects - 02 - Hazardous Area Classification",
        media: []
      },
      learningObjectivesPage: {
        title: "Learning Objectives",
        heading: "What You Will Learn",
        objectives: [
          "Understand hazardous area classification principles",
          "Learn about zone classification systems",
          "Apply safety protocols in hazardous environments"
        ],
        // This is the key scenario: NO explicit audio/caption files defined
        // but audio-1 and caption-1 exist on disk
        media: []
      },
      topics: [
        {
          id: "topic-1",
          title: "Introduction to Hazardous Areas",
          content: "Content about hazardous areas...",
          media: []
        },
        {
          id: "topic-2",
          title: "Classification Systems",
          content: "Content about classification systems...",
          media: []
        }
      ],
      assessment: {
        questions: []
      }
    }

    const courseSeedData = {
      courseTitle: "Complex Projects - 02 - Hazardous Area Classification",
      projectId: "1756944132721"
    }

    console.log(`[REAL-WORLD-TEST] Testing with project: ${courseSeedData.courseTitle} (ID: ${courseSeedData.projectId})`)

    const mockComponent = render(
      <SCORMPackageBuilder
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onComplete={mockOnComplete}
        onError={vi.fn()}
      />
    )

    // Wait for the component to trigger SCORM generation
    await waitFor(() => {
      expect(mockGenerateRustSCORM).toHaveBeenCalled()
    }, { timeout: 15000 })

    // Verify that generateRustSCORM was called with media including both audio-1 and caption-1
    const callArgs = mockGenerateRustSCORM.mock.calls[0]
    const mediaMap = callArgs[2] // Third argument is the media map
    const mediaIds = Array.from(mediaMap.keys())

    console.log(`[REAL-WORLD-TEST] ✅ Final media IDs collected: ${mediaIds.join(', ')}`)

    // These are the critical assertions - this should now PASS with our fix
    expect(mediaIds).toContain('audio-1')
    expect(mediaIds).toContain('caption-1')

    // Verify our debug logs show the universal fallback logic is working
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SCORMPackageBuilder] Adding fallback media IDs for objectives page (universal)')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SCORMPackageBuilder] Added fallback: caption-1')
    )

    console.log(`[REAL-WORLD-TEST] 🎉 SUCCESS: caption-1 is now included in SCORM package for Complex Projects!`)
  })

  it('should show enhanced debug logging for troubleshooting', async () => {
    const courseContent = {
      title: "Test Course",
      learningObjectivesPage: {
        objectives: ["Test objective"],
        media: []
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

    // Verify our new debug logs are showing enhancedContent structure
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SCORMPackageBuilder] DEBUG: enhancedContent properties:')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SCORMPackageBuilder] DEBUG: has learningObjectivesPage:')
    )

    console.log(`[REAL-WORLD-TEST] ✅ Debug logging is working correctly`)
  })
})