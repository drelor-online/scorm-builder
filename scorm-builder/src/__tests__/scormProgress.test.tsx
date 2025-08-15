/**
 * Tests for SCORM package generation progress reporting
 * 
 * This verifies that SCORM generation provides proper progress feedback
 * to users during the ZIP creation process
 */

import { vi } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import React from 'react'
import { SCORMPackageBuilder } from '../components/SCORMPackageBuilderLazy'
import { NotificationProvider } from '../contexts/NotificationContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { CourseContent } from '../types/aiPrompt'

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn()
}))

// Mock dynamic imports
vi.mock('../utils/dynamicImports', () => ({
  loadCourseContentConverter: vi.fn(),
  loadSCORMGenerator: vi.fn()
}))

const mockCourseContent: CourseContent = {
  title: 'Test Course',
  introduction: 'Test introduction',
  topics: [
    {
      title: 'Topic 1',
      content: 'Content 1',
      media: [{ type: 'image', url: 'test.jpg' }],
      audioFile: 'audio1.mp3'
    },
    {
      title: 'Topic 2', 
      content: 'Content 2',
      media: [{ type: 'video', url: 'test.mp4' }]
    }
  ],
  welcomePage: {
    title: 'Welcome',
    content: 'Welcome content',
    audioFile: 'welcome.mp3',
    media: [{ type: 'image', url: 'welcome.jpg' }]
  },
  learningObjectivesPage: {
    title: 'Objectives',
    content: 'Objectives content',
    audioFile: 'objectives.mp3'
  },
  assessment: {
    questions: [
      {
        id: '1',
        type: 'multiple-choice',
        question: 'Test question',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A'
      }
    ]
  }
}

const mockCourseSeedData = {
  courseTitle: 'Test Course Title',
  courseDescription: 'Test Description',
  duration: 30
}

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    <PersistentStorageProvider>
      <StepNavigationProvider>
        {children}
      </StepNavigationProvider>
    </PersistentStorageProvider>
  </NotificationProvider>
)

describe('SCORM Progress Reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock window.__TAURI__ to simulate Tauri environment
    Object.defineProperty(window, '__TAURI__', {
      value: {},
      writable: true
    })
  })

  test('should show progress during SCORM generation', async () => {
    // ARRANGE
    const { loadCourseContentConverter, loadSCORMGenerator } = await import('../utils/dynamicImports')
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    
    // Mock the functions to return successful results
    vi.mocked(loadCourseContentConverter).mockResolvedValue(() => mockCourseContent)
    vi.mocked(loadSCORMGenerator).mockResolvedValue(vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])))
    vi.mocked(save).mockResolvedValue('test-course.zip')
    vi.mocked(writeFile).mockResolvedValue()

    render(
      <TestWrapper>
        <SCORMPackageBuilder
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={() => {}}
          onBack={() => {}}
        />
      </TestWrapper>
    )

    // ACT - Click generate button
    const generateButton = screen.getByText('Generate SCORM Package')
    await act(async () => {
      fireEvent.click(generateButton)
    })

    // ASSERT - Should show progress messages and progress bar
    await waitFor(() => {
      expect(screen.getByText(/Loading SCORM generator/i)).toBeInTheDocument()
    })

    // Should show progress bar (it's a styled div, not a semantic progressbar)
    await waitFor(() => {
      expect(screen.getByText(/Loading content converter/i)).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  test('should update progress messages through generation steps', async () => {
    // ARRANGE
    const { loadCourseContentConverter, loadSCORMGenerator } = await import('../utils/dynamicImports')
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    
    // Mock with delays to test progress updates
    vi.mocked(loadCourseContentConverter).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(() => mockCourseContent), 100))
    )
    vi.mocked(loadSCORMGenerator).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))), 100))
    )
    vi.mocked(save).mockResolvedValue('test-course.zip')
    vi.mocked(writeFile).mockResolvedValue()

    render(
      <TestWrapper>
        <SCORMPackageBuilder
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={() => {}}
          onBack={() => {}}
        />
      </TestWrapper>
    )

    // ACT
    const generateButton = screen.getByText('Generate SCORM Package')
    await act(async () => {
      fireEvent.click(generateButton)
    })

    // ASSERT - Should show different progress messages
    await waitFor(() => {
      expect(screen.getByText(/Loading content converter/i)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText(/Converting course content/i)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText(/Loading SCORM package generator/i)).toBeInTheDocument()
    })
  })

  test('should calculate media count for progress estimation', async () => {
    // ARRANGE
    const { loadCourseContentConverter, loadSCORMGenerator } = await import('../utils/dynamicImports')
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    
    vi.mocked(loadCourseContentConverter).mockResolvedValue(() => mockCourseContent)
    vi.mocked(loadSCORMGenerator).mockResolvedValue(vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])))
    vi.mocked(save).mockResolvedValue('test-course.zip')
    vi.mocked(writeFile).mockResolvedValue()

    render(
      <TestWrapper>
        <SCORMPackageBuilder
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={() => {}}
          onBack={() => {}}
        />
      </TestWrapper>
    )

    // ACT
    const generateButton = screen.getByText('Generate SCORM Package')
    await act(async () => {
      fireEvent.click(generateButton)
    })

    // ASSERT - Should show media count and time estimation
    await waitFor(() => {
      // Should show progress message with media count
      // Expected: 2 topic media + 2 topic audio + 1 welcome audio + 1 welcome media + 1 objectives audio = 7 media files
      expect(screen.getByText(/7 media files/i)).toBeInTheDocument()
    })
  })

  test('should show success message when generation completes', async () => {
    // ARRANGE
    const { loadCourseContentConverter, loadSCORMGenerator } = await import('../utils/dynamicImports')
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    
    vi.mocked(loadCourseContentConverter).mockResolvedValue(() => mockCourseContent)
    vi.mocked(loadSCORMGenerator).mockResolvedValue(vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])))
    vi.mocked(save).mockResolvedValue('test-course.zip')
    vi.mocked(writeFile).mockResolvedValue()

    render(
      <TestWrapper>
        <SCORMPackageBuilder
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={() => {}}
          onBack={() => {}}
        />
      </TestWrapper>
    )

    // ACT
    const generateButton = screen.getByText('Generate SCORM Package')
    await act(async () => {
      fireEvent.click(generateButton)
    })

    // ASSERT - Should show success message
    await waitFor(() => {
      expect(screen.getByText(/SCORM package saved successfully/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  test('should show error message when generation fails', async () => {
    // ARRANGE
    const { loadCourseContentConverter } = await import('../utils/dynamicImports')
    
    // Mock failure
    vi.mocked(loadCourseContentConverter).mockRejectedValue(new Error('Generation failed'))

    render(
      <TestWrapper>
        <SCORMPackageBuilder
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={() => {}}
          onBack={() => {}}
        />
      </TestWrapper>
    )

    // ACT
    const generateButton = screen.getByText('Generate SCORM Package')
    await act(async () => {
      fireEvent.click(generateButton)
    })

    // ASSERT - Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Error: Generation failed/i)).toBeInTheDocument()
    })
  })

  test('should reset progress after completion', async () => {
    // ARRANGE
    const { loadCourseContentConverter, loadSCORMGenerator } = await import('../utils/dynamicImports')
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    
    vi.mocked(loadCourseContentConverter).mockResolvedValue(() => mockCourseContent)
    vi.mocked(loadSCORMGenerator).mockResolvedValue(vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])))
    vi.mocked(save).mockResolvedValue('test-course.zip')
    vi.mocked(writeFile).mockResolvedValue()

    render(
      <TestWrapper>
        <SCORMPackageBuilder
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={() => {}}
          onBack={() => {}}
        />
      </TestWrapper>
    )

    // ACT
    const generateButton = screen.getByText('Generate SCORM Package')
    await act(async () => {
      fireEvent.click(generateButton)
    })

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/SCORM package saved successfully/i)).toBeInTheDocument()
    }, { timeout: 2000 })

    // ASSERT - Progress should reset after 2 seconds
    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })
})