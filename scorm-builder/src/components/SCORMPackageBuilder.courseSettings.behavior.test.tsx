import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi } from 'vitest'
import { SCORMPackageBuilder } from './SCORMPackageBuilder'
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

describe('SCORMPackageBuilder - Course Settings Integration', () => {
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

  describe('Course Settings Loading and Usage', () => {
    it('should load course settings with audio completion enabled and pass to Rust generator', async () => {
      const courseSettings = {
        requireAudioCompletion: true,
        navigationMode: 'linear' as const,
        allowRetake: true,
        passMark: 85
      }
      
      // Mock storage that returns our course settings
      const mockStorage = {
        saveContent: vi.fn(),
        loadContent: vi.fn((key) => {
          if (key === 'courseSettings') {
            return Promise.resolve(courseSettings)
          }
          return Promise.resolve(null)
        }),
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

      // Find and click the generate button
      const generateButton = screen.getByTestId('generate-scorm-button')
      fireEvent.click(generateButton)

      // Verify course settings are loaded from storage
      await waitFor(() => {
        expect(mockStorage.loadContent).toHaveBeenCalledWith('courseSettings')
      }, { timeout: 5000 })

      // Verify the settings are passed to Rust generator with requireAudioCompletion: true
      await waitFor(() => {
        expect(mockGenerateRustSCORM).toHaveBeenCalledWith(
          expect.any(Object), // enhanced content
          'test-project', // project ID
          expect.any(Function), // progress callback
          expect.any(Object), // media files
          expect.objectContaining({ // course settings
            requireAudioCompletion: true,
            navigationMode: 'linear',
            allowRetake: true,
            passMark: 85
          })
        )
      }, { timeout: 10000 })

      console.log('✓ Course settings with audio completion enabled loaded and passed to generator')
    })

    it('should load course settings with audio completion disabled and pass to Rust generator', async () => {
      const courseSettings = {
        requireAudioCompletion: false,
        navigationMode: 'free' as const,
        allowRetake: false,
        passMark: 70
      }
      
      const mockStorage = {
        saveContent: vi.fn(),
        loadContent: vi.fn((key) => {
          if (key === 'courseSettings') {
            return Promise.resolve(courseSettings)
          }
          return Promise.resolve(null)
        }),
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

      // Verify settings are passed with requireAudioCompletion: false
      await waitFor(() => {
        expect(mockGenerateRustSCORM).toHaveBeenCalledWith(
          expect.any(Object),
          'test-project',
          expect.any(Function),
          expect.any(Object),
          expect.objectContaining({
            requireAudioCompletion: false,
            navigationMode: 'free',
            allowRetake: false,
            passMark: 70
          })
        )
      }, { timeout: 10000 })

      console.log('✓ Course settings with audio completion disabled loaded and passed to generator')
    })

    it('should handle missing course settings gracefully by passing null', async () => {
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

      console.log('✓ Missing course settings handled gracefully with null parameter')
    })

    it('should handle empty course settings object', async () => {
      const courseSettings = {}
      
      const mockStorage = {
        saveContent: vi.fn(),
        loadContent: vi.fn((key) => {
          if (key === 'courseSettings') {
            return Promise.resolve(courseSettings)
          }
          return Promise.resolve(null)
        }),
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

      // Verify empty settings object is passed
      await waitFor(() => {
        expect(mockGenerateRustSCORM).toHaveBeenCalledWith(
          expect.any(Object),
          'test-project',
          expect.any(Function),
          expect.any(Object),
          {} // Empty settings object
        )
      }, { timeout: 10000 })

      console.log('✓ Empty course settings object handled correctly')
    })
  })

  describe('Storage Integration Validation', () => {
    it('should call storage.loadContent with correct key', async () => {
      const mockStorage = {
        saveContent: vi.fn(),
        loadContent: vi.fn(() => Promise.resolve(null)),
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

      await waitFor(() => {
        expect(mockStorage.loadContent).toHaveBeenCalledWith('courseSettings')
      }, { timeout: 5000 })

      console.log('✓ Storage called with correct courseSettings key')
    })
  })
})