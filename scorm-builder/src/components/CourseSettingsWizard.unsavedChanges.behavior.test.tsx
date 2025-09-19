/**
 * Behavior Test: Course Settings Wizard - Unsaved Changes Integration
 *
 * Tests that CourseSettingsWizard properly integrates with the unsaved changes system.
 * This reproduces the exact issue reported where course settings changes
 * don't trigger the unsaved changes indicator.
 */

import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { render } from '../test/testProviders'
import userEvent from '@testing-library/user-event'
import { CourseSettingsWizard, DEFAULT_COURSE_SETTINGS } from './CourseSettingsWizard'
import { CourseSeedData } from '../types/schema'
import { CourseContent } from '../types/aiPrompt'

import { vi } from 'vitest'

// Mock usePersistentStorage directly
const mockStorage = {
  saveContent: vi.fn().mockResolvedValue(undefined),
  getContent: vi.fn().mockResolvedValue(null),
  currentProjectId: 'test-project-123'
}

vi.mock('../hooks/usePersistentStorage', () => ({
  usePersistentStorage: () => mockStorage
}))

// Mock useUnsavedChanges
const mockMarkDirty = vi.fn()
const mockResetDirty = vi.fn()

vi.mock('../contexts/UnsavedChangesContext', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useUnsavedChanges: () => ({
      markDirty: mockMarkDirty,
      resetDirty: mockResetDirty,
      hasUnsavedChanges: false
    })
  }
})

describe('CourseSettingsWizard - Unsaved Changes Integration', () => {
  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: ['Topic 1', 'Topic 2'],
    template: 'None',
    templateTopics: []
  }

  const mockCourseContent: CourseContent = {
    welcomePage: {
      title: 'Welcome',
      content: 'Test content',
      media: []
    },
    objectives: {
      title: 'Objectives',
      content: 'Test objectives',
      media: []
    },
    topics: [
      {
        title: 'Topic 1',
        content: 'Content 1',
        media: []
      }
    ]
  }

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
  })

  it('should call markDirty when course settings are changed', async () => {
    const user = userEvent.setup()
    const mockOnNext = vi.fn()

    render(
      <CourseSettingsWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={vi.fn()}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={vi.fn()}
        onOpen={vi.fn()}
        onStepClick={vi.fn()}
      />
    )

    // **TEST: Change show progress bar setting**
    const showProgressCheckbox = screen.getByRole('checkbox', { name: /show progress bar/i })
    expect(showProgressCheckbox).toBeChecked() // Should be checked by default

    // This change should trigger markDirty('courseSettings')
    await user.click(showProgressCheckbox)

    // Verify markDirty was called
    await waitFor(() => {
      expect(mockMarkDirty).toHaveBeenCalledWith('courseSettings')
    })

    expect(showProgressCheckbox).not.toBeChecked()
  })

  it('should call markDirty when pass mark is changed', async () => {
    const user = userEvent.setup()

    render(
      <CourseSettingsWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={vi.fn()}
        onOpen={vi.fn()}
        onStepClick={vi.fn()}
      />
    )

    // **TEST: Change pass mark setting**
    const passMarkInput = screen.getByDisplayValue('80') // Default value

    // Clear and type new value
    await user.clear(passMarkInput)
    await user.type(passMarkInput, '75')

    // This change should trigger markDirty('courseSettings')
    await waitFor(() => {
      expect(mockMarkDirty).toHaveBeenCalledWith('courseSettings')
    })
  })

  it('should call markDirty when show outline setting is changed', async () => {
    const user = userEvent.setup()

    render(
      <CourseSettingsWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={vi.fn()}
        onOpen={vi.fn()}
        onStepClick={vi.fn()}
      />
    )

    // **TEST: Change show outline setting**
    const showOutlineCheckbox = screen.getByRole('checkbox', { name: /show course outline/i })
    expect(showOutlineCheckbox).toBeChecked() // Should be checked by default

    // This change should trigger markDirty('courseSettings')
    await user.click(showOutlineCheckbox)

    // Verify markDirty was called
    await waitFor(() => {
      expect(mockMarkDirty).toHaveBeenCalledWith('courseSettings')
    })
  })

  it('should call resetDirty when component unmounts', () => {
    const { unmount } = render(
      <CourseSettingsWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={vi.fn()}
        onOpen={vi.fn()}
        onStepClick={vi.fn()}
      />
    )

    // Unmount component
    unmount()

    // Should call resetDirty on unmount
    expect(mockResetDirty).toHaveBeenCalledWith('courseSettings')
  })

  it('should not call markDirty during initial load from storage', async () => {
    // Mock storage returns saved settings
    const savedSettings = {
      ...DEFAULT_COURSE_SETTINGS,
      showProgress: false,
      passMark: 75
    }

    mockStorage.getContent.mockImplementation((key: string) => {
      if (key === 'courseSettings') {
        return Promise.resolve(savedSettings)
      }
      return Promise.resolve(null)
    })

    render(
      <CourseSettingsWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={vi.fn()}
        onOpen={vi.fn()}
        onStepClick={vi.fn()}
      />
    )

    // Wait for component to load settings
    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('courseSettings')
    })

    // Should NOT call markDirty during initial load
    expect(mockMarkDirty).not.toHaveBeenCalled()

    // Verify UI reflects loaded settings
    const showProgressCheckbox = screen.getByRole('checkbox', { name: /show progress bar/i })
    const passMarkInput = screen.getByDisplayValue('75')

    expect(showProgressCheckbox).not.toBeChecked()
    expect(passMarkInput).toBeInTheDocument()
  })
})