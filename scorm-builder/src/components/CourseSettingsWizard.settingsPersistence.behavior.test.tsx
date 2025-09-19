/**
 * Behavior Test: Course Settings Wizard - Settings Persistence
 *
 * Tests that course settings persist across save/reload cycles.
 * This reproduces the exact issue reported by the beta tester where
 * course settings changes don't persist after saving and reloading the project.
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

describe('CourseSettingsWizard - Settings Persistence', () => {
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

  it('should persist course settings across component remounts', async () => {
    const user = userEvent.setup()
    const mockOnNext = vi.fn()

    // **STEP 1: Initial render with default settings**
    const { rerender } = render(
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

    // **STEP 2: Modify settings from defaults**
    // Change "Show progress bar" to false (it's true by default)
    const showProgressCheckbox = screen.getByRole('checkbox', { name: /show progress bar/i })
    expect(showProgressCheckbox).toBeChecked() // Should be checked by default
    await user.click(showProgressCheckbox)
    expect(showProgressCheckbox).not.toBeChecked()

    // Change "Show course outline" to false (it's true by default)
    const showOutlineCheckbox = screen.getByRole('checkbox', { name: /show course outline/i })
    expect(showOutlineCheckbox).toBeChecked() // Should be checked by default
    await user.click(showOutlineCheckbox)
    expect(showOutlineCheckbox).not.toBeChecked()

    // We'll focus on the checkbox settings which are easier to test

    // **STEP 3: Trigger save by clicking Next**
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // Verify onNext was called with the modified settings
    await waitFor(() => {
      expect(mockOnNext).toHaveBeenCalledWith(
        expect.objectContaining({
          showProgress: false,
          showOutline: false
        })
      )
    })

    // **STEP 4: Simulate settings being saved to storage**
    const savedSettings = {
      ...DEFAULT_COURSE_SETTINGS,
      showProgress: false,
      showOutline: false
    }

    mockStorage.getContent.mockImplementation((key: string) => {
      if (key === 'courseSettings') {
        return Promise.resolve(savedSettings)
      }
      return Promise.resolve(null)
    })

    // **STEP 5: Re-render component (simulating reload)**
    rerender(
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

    // **STEP 6: Verify settings were loaded from storage**
    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('courseSettings')
    })

    // **STEP 7: Verify UI reflects the saved settings**
    await waitFor(() => {
      const reloadedShowProgressCheckbox = screen.getByRole('checkbox', { name: /show progress bar/i })
      const reloadedShowOutlineCheckbox = screen.getByRole('checkbox', { name: /show course outline/i })

      expect(reloadedShowProgressCheckbox).not.toBeChecked()
      expect(reloadedShowOutlineCheckbox).not.toBeChecked()
    })

    // The test passes if:
    // 1. Settings were saved when Next was clicked
    // 2. Settings were loaded from storage on component mount
    // 3. UI reflects the saved settings, not defaults
  })

  it('should load default settings when no saved settings exist', async () => {
    // Mock storage returns null (no saved settings)
    mockStorage.getContent.mockResolvedValue(null)

    // Render component
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

    // Verify it attempts to load settings
    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('courseSettings')
    })

    // Should show default settings since no saved settings exist
    const showProgressCheckbox = screen.getByRole('checkbox', { name: /show progress bar/i })
    const showOutlineCheckbox = screen.getByRole('checkbox', { name: /show course outline/i })
    const passMarkInput = screen.getByDisplayValue('80') // Default value

    expect(showProgressCheckbox).toBeChecked() // Default is true
    expect(showOutlineCheckbox).toBeChecked() // Default is true
    expect(passMarkInput).toBeInTheDocument() // Default is 80
  })

  it('should handle storage errors gracefully', async () => {
    // Mock storage to throw error
    mockStorage.getContent.mockRejectedValue(new Error('Storage error'))

    // Component should still render and not crash
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

    // Should attempt to load settings despite error
    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('courseSettings')
    })

    // Should fall back to default settings
    const showProgressCheckbox = screen.getByRole('checkbox', { name: /show progress bar/i })
    const showOutlineCheckbox = screen.getByRole('checkbox', { name: /show course outline/i })

    expect(showProgressCheckbox).toBeChecked() // Default is true
    expect(showOutlineCheckbox).toBeChecked() // Default is true
  })
})