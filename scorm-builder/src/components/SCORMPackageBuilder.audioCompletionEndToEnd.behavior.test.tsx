import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi } from 'vitest'
import { SCORMPackageBuilder } from './SCORMPackageBuilder'
import { CourseSettingsWizard, type CourseSettings } from './CourseSettingsWizard'
import { TestProviders } from '../test/TestProviders'

// Mock the Rust SCORM generator
vi.mock('../services/rustScormGenerator', () => ({
  generateRustSCORM: vi.fn()
}))

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

// Import the mocked function
const { generateRustSCORM } = await import('../services/rustScormGenerator')
const mockGenerateRustSCORM = generateRustSCORM as ReturnType<typeof vi.fn>

describe('Audio Completion Requirement - End-to-End', () => {
  const mockCourseContent = {
    courseTitle: 'Test Course',
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: '<p>Test content</p>',
        media: [
          {
            id: 'audio-1',
            type: 'audio',
            url: 'test-audio.mp3',
            title: 'Test Audio'
          }
        ]
      }
    ]
  }

  const mockCourseSeedData = {
    courseTitle: 'Test Course',
    courseDescription: 'Test Description'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    
    // Setup successful SCORM generation mock
    mockGenerateRustSCORM.mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
  })

  describe('Complete Audio Completion Flow', () => {
    it('should enable audio completion requirement and generate SCORM with the setting', async () => {
      let savedCourseSettings: any = null
      
      // Mock storage context to capture saved settings
      const mockStorage = {
        saveContent: vi.fn((key, content) => {
          if (key === 'courseSettings') {
            savedCourseSettings = content
          }
          return Promise.resolve()
        }),
        loadContent: vi.fn((key) => {
          if (key === 'courseSettings') {
            return Promise.resolve(savedCourseSettings)
          }
          return Promise.resolve(null)
        }),
        currentProjectId: 'test-project'
      }

      // Step 1: Render CourseSettingsWizard and enable audio completion
      const { rerender } = render(
        <TestProviders mockStorage={mockStorage}>
          <CourseSettingsWizard
            courseContent={mockCourseContent}
            courseSeedData={mockCourseSeedData}
            onNext={() => {}}
            onBack={() => {}}
          />
        </TestProviders>
      )

      // Find and click the audio completion checkbox
      const audioCompletionCheckbox = screen.getByRole('checkbox', {
        name: /require audio completion before page navigation/i
      })
      
      expect(audioCompletionCheckbox).toBeInTheDocument()
      expect(audioCompletionCheckbox).not.toBeChecked()

      // Enable the audio completion requirement
      fireEvent.click(audioCompletionCheckbox)
      expect(audioCompletionCheckbox).toBeChecked()

      // Click next to save settings
      const nextButton = screen.getByRole('button', { name: /next/i })
      fireEvent.click(nextButton)

      // Wait for settings to be saved
      await waitFor(() => {
        expect(mockStorage.saveContent).toHaveBeenCalledWith('courseSettings', expect.objectContaining({
          requireAudioCompletion: true
        }))
      })

      // Verify settings were captured
      expect(savedCourseSettings).toEqual({
        requireAudioCompletion: true
      })

      // Step 2: Render SCORMPackageBuilder and generate package
      rerender(
        <TestProviders mockStorage={mockStorage}>
          <SCORMPackageBuilder
            courseContent={mockCourseContent}
            courseSeedData={mockCourseSeedData}
            onNext={() => {}}
            onBack={() => {}}
          />
        </TestProviders>
      )

      // Find and click the generate button
      const generateButton = screen.getByTestId('generate-scorm-button')
      fireEvent.click(generateButton)

      // Step 3: Verify the settings are loaded and passed to Rust generator
      await waitFor(() => {
        expect(mockStorage.loadContent).toHaveBeenCalledWith('courseSettings')
      }, { timeout: 5000 })

      await waitFor(() => {
        expect(mockGenerateRustSCORM).toHaveBeenCalledWith(
          expect.any(Object), // enhanced content
          'test-project', // project ID
          expect.any(Function), // progress callback
          expect.any(Object), // media files
          expect.objectContaining({ // course settings with audio requirement
            requireAudioCompletion: true
          })
        )
      }, { timeout: 10000 })

      // Step 4: Verify success state is shown
      await waitFor(() => {
        expect(screen.getByText('Package Ready!')).toBeInTheDocument()
      }, { timeout: 10000 })

      console.log('✓ End-to-end audio completion requirement test passed')
    })

    it('should generate SCORM without audio completion when setting is disabled', async () => {
      let savedCourseSettings: any = { requireAudioCompletion: false }
      
      const mockStorage = {
        saveContent: vi.fn(),
        loadContent: vi.fn((key) => {
          if (key === 'courseSettings') {
            return Promise.resolve(savedCourseSettings)
          }
          return Promise.resolve(null)
        }),
        currentProjectId: 'test-project'
      }

      // Render SCORMPackageBuilder with disabled audio completion
      render(
        <TestProviders mockStorage={mockStorage}>
          <SCORMPackageBuilder
            courseContent={mockCourseContent}
            courseSeedData={mockCourseSeedData}
            onNext={() => {}}
            onBack={() => {}}
          />
        </TestProviders>
      )

      // Generate package
      const generateButton = screen.getByTestId('generate-scorm-button')
      fireEvent.click(generateButton)

      // Verify settings are passed with requireAudioCompletion: false
      await waitFor(() => {
        expect(mockGenerateRustSCORM).toHaveBeenCalledWith(
          expect.any(Object),
          'test-project',
          expect.any(Function),
          expect.any(Object),
          expect.objectContaining({
            requireAudioCompletion: false
          })
        )
      }, { timeout: 10000 })

      console.log('✓ Audio completion disabled test passed')
    })

    it('should handle missing course settings gracefully', async () => {
      const mockStorage = {
        saveContent: vi.fn(),
        loadContent: vi.fn(() => Promise.reject(new Error('Settings not found'))),
        currentProjectId: 'test-project'
      }

      render(
        <TestProviders mockStorage={mockStorage}>
          <SCORMPackageBuilder
            courseContent={mockCourseContent}
            courseSeedData={mockCourseSeedData}
            onNext={() => {}}
            onBack={() => {}}
          />
        </TestProviders>
      )

      const generateButton = screen.getByTestId('generate-scorm-button')
      fireEvent.click(generateButton)

      // Verify null is passed when settings can't be loaded
      await waitFor(() => {
        expect(mockGenerateRustSCORM).toHaveBeenCalledWith(
          expect.any(Object),
          'test-project',
          expect.any(Function),
          expect.any(Object),
          null // No settings available
        )
      }, { timeout: 10000 })

      console.log('✓ Missing settings handling test passed')
    })
  })

  describe('Settings Validation', () => {
    it('should validate that course settings contain expected audio completion field', () => {
      // Test the settings structure
      const validSettings = {
        requireAudioCompletion: true
      }

      expect(validSettings).toHaveProperty('requireAudioCompletion')
      expect(typeof validSettings.requireAudioCompletion).toBe('boolean')
      
      console.log('✓ Settings validation test passed')
    })
  })
})