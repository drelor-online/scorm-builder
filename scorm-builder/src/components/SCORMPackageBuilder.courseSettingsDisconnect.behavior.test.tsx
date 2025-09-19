/**
 * Behavior test for Course Settings Disconnect
 *
 * This test reproduces the critical issue where course settings like "Show progress bar"
 * and "Show course outline" are checked in the UI but don't appear in the generated SCORM package.
 *
 * ISSUE: User reports sidebar missing despite having showProgress=true and showOutline=true
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SCORMPackageBuilder } from './SCORMPackageBuilder'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import type { CourseSettings } from './CourseSettingsWizard'

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn()
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock course content converter
vi.mock('../services/courseContentConverter', () => ({
  convertToEnhancedCourseContent: vi.fn()
}))

// Mock storage system to control what settings are returned
const mockStorageGetContent = vi.fn()
const mockStorageSaveContent = vi.fn()

vi.mock('../contexts/PersistentStorageContext', () => {
  return {
    PersistentStorageProvider: ({ children }: { children: any }) => children,
    useStorage: () => ({
      getContent: mockStorageGetContent,
      saveContent: mockStorageSaveContent,
      currentProjectId: 'test-project-123'
    })
  }
})

// Mock SCORM generator to capture what settings are passed
let capturedSettings: any = null
vi.mock('../services/rustScormGenerator', () => ({
  generateRustSCORM: vi.fn().mockImplementation(async (courseContent, projectId, onProgress, preloadedMedia, courseSettings) => {
    capturedSettings = courseSettings // Capture for inspection
    console.log('[TEST] Captured course settings in generateRustSCORM:', courseSettings)
    return new Uint8Array([80, 75, 3, 4]) // ZIP signature
  })
}))

vi.mock('../utils/dynamicImports', () => ({
  loadCourseContentConverter: vi.fn(),
  loadSCORMGenerator: vi.fn()
}))

vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

describe('SCORMPackageBuilder Course Settings Disconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedSettings = null
    mockStorageGetContent.mockClear()
  })

  const renderSCORMBuilder = () => {
    return render(
      <NotificationProvider>
        <StepNavigationProvider>
          <PersistentStorageProvider>
            <UnifiedMediaProvider>
              <SCORMPackageBuilder
                courseContent={{
                  welcomePage: { title: 'Test Course', content: 'Test content', media: [] },
                  topics: [{ title: 'Topic 1', content: 'Topic content', media: [] }]
                }}
                courseSeedData={{ courseTitle: 'Test Course' }}
                onNext={vi.fn()}
                onBack={vi.fn()}
                onSettingsClick={vi.fn()}
                onSave={vi.fn()}
                onOpen={vi.fn()}
                onHelp={vi.fn()}
                onStepClick={vi.fn()}
              />
            </UnifiedMediaProvider>
          </PersistentStorageProvider>
        </StepNavigationProvider>
      </NotificationProvider>
    )
  }

  it('FAILING TEST: Should pass showProgress=true and showOutline=true to SCORM generator when settings are saved correctly', async () => {
    // This test reproduces the user's issue: settings checked in UI but sidebar missing in output

    // Arrange: Mock storage to return the settings that SHOULD work
    mockStorageGetContent.mockImplementation(async (key: string) => {
      if (key === 'courseSettings') {
        const correctSettings: CourseSettings = {
          requireAudioCompletion: false,
          navigationMode: 'linear',
          autoAdvance: false,
          allowPreviousReview: true,
          passMark: 80,
          allowRetake: true,
          retakeDelay: 0,
          completionCriteria: 'view_and_pass',
          showProgress: true,  // ✅ User checked this
          showOutline: true,   // ✅ User checked this
          confirmExit: true,
          fontSize: 'medium',
          timeLimit: 0,
          sessionTimeout: 30,
          minimumTimeSpent: 0,
          keyboardNavigation: true,
          printable: false
        }
        console.log('[TEST] Storage returning course settings:', correctSettings)
        return correctSettings
      }
      throw new Error('Content not found')
    })

    // Mock the dynamic imports
    const { loadCourseContentConverter, loadSCORMGenerator } = await import('../utils/dynamicImports')
    const { convertToEnhancedCourseContent } = await import('../services/courseContentConverter')
    const { generateRustSCORM } = await import('../services/rustScormGenerator')

    vi.mocked(loadCourseContentConverter).mockResolvedValue(vi.fn().mockResolvedValue({}))
    vi.mocked(loadSCORMGenerator).mockResolvedValue(generateRustSCORM)
    vi.mocked(convertToEnhancedCourseContent).mockResolvedValue({
      title: 'Test Course',
      welcome: { title: 'Welcome', content: 'Welcome content', media: [] },
      topics: [{ title: 'Topic 1', content: 'Topic content', media: [] }]
    })

    // Act: Render component and trigger SCORM generation
    renderSCORMBuilder()

    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    fireEvent.click(generateButton)

    // Wait for generation to complete
    await waitFor(() => {
      expect(generateRustSCORM).toHaveBeenCalled()
    }, { timeout: 10000 })

    // Assert: The settings should be passed correctly to the SCORM generator
    expect(capturedSettings).toBeTruthy()
    expect(capturedSettings).toMatchObject({
      showProgress: true,
      showOutline: true
    })

    console.log('[TEST] Final captured settings:', capturedSettings)

    // CRITICAL: If this test fails, it means the settings are not being passed through correctly
    // This would explain why the user's sidebar is missing despite checking the boxes
  })

  it('FAILING TEST: Should default to showProgress=true and showOutline=true when no settings are found in storage', async () => {
    // This test checks what happens when settings load fails - are defaults applied?

    // Arrange: Mock storage to fail loading settings (simulates first-time user or corrupted storage)
    mockStorageGetContent.mockImplementation(async (key: string) => {
      if (key === 'courseSettings') {
        throw new Error('No course settings found') // Simulates storage failure
      }
      throw new Error('Content not found')
    })

    // Mock the dynamic imports
    const { loadCourseContentConverter, loadSCORMGenerator } = await import('../utils/dynamicImports')
    const { convertToEnhancedCourseContent } = await import('../services/courseContentConverter')
    const { generateRustSCORM } = await import('../services/rustScormGenerator')

    vi.mocked(loadCourseContentConverter).mockResolvedValue(vi.fn().mockResolvedValue({}))
    vi.mocked(loadSCORMGenerator).mockResolvedValue(generateRustSCORM)
    vi.mocked(convertToEnhancedCourseContent).mockResolvedValue({
      title: 'Test Course',
      welcome: { title: 'Welcome', content: 'Welcome content', media: [] },
      topics: [{ title: 'Topic 1', content: 'Topic content', media: [] }]
    })

    // Act: Render component and trigger SCORM generation
    renderSCORMBuilder()

    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    fireEvent.click(generateButton)

    // Wait for generation to complete
    await waitFor(() => {
      expect(generateRustSCORM).toHaveBeenCalled()
    }, { timeout: 10000 })

    // Assert: Even when settings load fails, defaults should still provide sidebar
    // According to DEFAULT_COURSE_SETTINGS, both should default to true
    console.log('[TEST] Settings when storage fails:', capturedSettings)

    // This test will FAIL if no defaults are applied when settings load fails
    // If capturedSettings is null, that explains missing sidebars!
    expect(capturedSettings).toBeTruthy()

    if (capturedSettings) {
      // If defaults ARE applied correctly, they should be the expected defaults
      expect(capturedSettings).toMatchObject({
        showProgress: true,  // Should default to true
        showOutline: true    // Should default to true
      })
    }
  })

  it('FAILING TEST: Should handle malformed settings object gracefully', async () => {
    // This test checks what happens when settings exist but have wrong structure

    // Arrange: Mock storage to return malformed settings (simulates corruption or version mismatch)
    mockStorageGetContent.mockImplementation(async (key: string) => {
      if (key === 'courseSettings') {
        // Return malformed settings object (wrong property names, wrong types, etc.)
        const malformedSettings = {
          show_progress: 'yes',     // Wrong type (string instead of boolean)
          show_outline: undefined,  // Missing value
          wrongProperty: true,      // Extra property
          // Missing most expected properties
        }
        console.log('[TEST] Storage returning malformed settings:', malformedSettings)
        return malformedSettings
      }
      throw new Error('Content not found')
    })

    // Mock the dynamic imports
    const { loadCourseContentConverter, loadSCORMGenerator } = await import('../utils/dynamicImports')
    const { convertToEnhancedCourseContent } = await import('../services/courseContentConverter')
    const { generateRustSCORM } = await import('../services/rustScormGenerator')

    vi.mocked(loadCourseContentConverter).mockResolvedValue(vi.fn().mockResolvedValue({}))
    vi.mocked(loadSCORMGenerator).mockResolvedValue(generateRustSCORM)
    vi.mocked(convertToEnhancedCourseContent).mockResolvedValue({
      title: 'Test Course',
      welcome: { title: 'Welcome', content: 'Welcome content', media: [] },
      topics: [{ title: 'Topic 1', content: 'Topic content', media: [] }]
    })

    // Act: Render component and trigger SCORM generation
    renderSCORMBuilder()

    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    fireEvent.click(generateButton)

    // Wait for generation to complete
    await waitFor(() => {
      expect(generateRustSCORM).toHaveBeenCalled()
    }, { timeout: 10000 })

    // Assert: System should handle malformed settings gracefully
    console.log('[TEST] Settings with malformed input:', capturedSettings)

    // The system should either:
    // 1. Apply defaults when properties are missing/wrong type, OR
    // 2. Validate and reject malformed settings, falling back to defaults

    // This test will reveal how robust the settings pipeline is
    expect(capturedSettings).toBeTruthy()
  })

  it('BEHAVIOR: Should log detailed information about settings transformation pipeline', async () => {
    // This test doesn't assert anything - it just captures all the logging to understand the pipeline

    mockStorageGetContent.mockImplementation(async (key: string) => {
      if (key === 'courseSettings') {
        const settings: CourseSettings = {
          requireAudioCompletion: false,
          navigationMode: 'linear',
          autoAdvance: false,
          allowPreviousReview: true,
          passMark: 80,
          allowRetake: true,
          retakeDelay: 0,
          completionCriteria: 'view_and_pass',
          showProgress: true,
          showOutline: true,
          confirmExit: true,
          fontSize: 'medium',
          timeLimit: 0,
          sessionTimeout: 30,
          minimumTimeSpent: 0,
          keyboardNavigation: true,
          printable: false
        }
        return settings
      }
      throw new Error('Content not found')
    })

    const { loadCourseContentConverter, loadSCORMGenerator } = await import('../utils/dynamicImports')
    const { convertToEnhancedCourseContent } = await import('../services/courseContentConverter')
    const { generateRustSCORM } = await import('../services/rustScormGenerator')

    vi.mocked(loadCourseContentConverter).mockResolvedValue(vi.fn().mockResolvedValue({}))
    vi.mocked(loadSCORMGenerator).mockResolvedValue(generateRustSCORM)
    vi.mocked(convertToEnhancedCourseContent).mockResolvedValue({
      title: 'Test Course',
      welcome: { title: 'Welcome', content: 'Welcome content', media: [] },
      topics: [{ title: 'Topic 1', content: 'Topic content', media: [] }]
    })

    renderSCORMBuilder()

    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(generateRustSCORM).toHaveBeenCalled()
    }, { timeout: 10000 })

    // Log all the captured information for debugging
    console.log('=== SETTINGS PIPELINE DEBUG ===')
    console.log('1. Storage mock called with:', mockStorageGetContent.mock.calls)
    console.log('2. Settings passed to generateRustSCORM:', capturedSettings)
    console.log('3. generateRustSCORM call arguments:', generateRustSCORM.mock.calls[0])
    console.log('================================')
  })
})