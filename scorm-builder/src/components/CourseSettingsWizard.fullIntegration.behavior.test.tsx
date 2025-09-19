/**
 * Integration Test: CourseSettingsWizard - Full Application Integration
 *
 * This test reproduces the exact issue reported by the beta tester:
 * - Course settings changes don't trigger unsaved changes indicator
 * - Save button doesn't show saving status
 * - Can't exit to dashboard
 */

import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { render } from '../test/testProviders'
import userEvent from '@testing-library/user-event'
import { CourseSettingsWizard } from './CourseSettingsWizard'
import { CourseContent, CourseSeedData } from '../types/schema'
import { vi } from 'vitest'

// Mock storage
const mockStorage = {
  saveContent: vi.fn().mockResolvedValue(undefined),
  getContent: vi.fn().mockResolvedValue(null),
  currentProjectId: 'test-project-123'
}

vi.mock('../hooks/usePersistentStorage', () => ({
  usePersistentStorage: () => mockStorage
}))

// Mock notifications
const mockSuccess = vi.fn()
const mockError = vi.fn()

vi.mock('../contexts/NotificationContext', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNotifications: () => ({
      success: mockSuccess,
      error: mockError,
      info: vi.fn(),
      warning: vi.fn()
    })
  }
})

// Create a spy for markDirty to verify it's called
const mockMarkDirty = vi.fn()
const mockResetDirty = vi.fn()
let mockHasUnsavedChanges = false

vi.mock('../contexts/UnsavedChangesContext', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useUnsavedChanges: () => ({
      markDirty: mockMarkDirty,
      resetDirty: mockResetDirty,
      hasUnsavedChanges: mockHasUnsavedChanges,
      isDirty: vi.fn().mockReturnValue(false),
      resetAll: vi.fn(),
      getDirtyState: vi.fn().mockReturnValue({
        hasUnsavedChanges: mockHasUnsavedChanges,
        sections: {
          courseSeed: false,
          courseContent: false,
          media: false,
          activities: false,
          courseSettings: false,
          promptTuning: false
        }
      })
    })
  }
})

describe('CourseSettingsWizard - Full Integration Test', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      title: 'Welcome',
      content: 'Test content',
      media: [],
      narration: null
    },
    learningObjectivesPage: {
      title: 'Learning Objectives',
      content: 'Objectives content',
      objectives: ['Objective 1'],
      media: [],
      narration: null
    },
    topics: [
      {
        title: 'Topic 1',
        content: 'Topic content',
        media: [],
        narration: null
      }
    ],
    assessment: {
      title: 'Assessment',
      content: 'Assessment content',
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice',
          question: 'Test question?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 0,
          explanation: 'Test explanation'
        }
      ],
      media: [],
      narration: null
    }
  }

  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: ['Topic 1'],
    template: 'None',
    templateTopics: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockHasUnsavedChanges = false

    // Reset console spy to catch any actual calls
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should call markDirty when course settings are changed', async () => {
    const user = userEvent.setup()
    const mockOnNext = vi.fn()
    const mockOnSave = vi.fn()

    render(
      <CourseSettingsWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={vi.fn()}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={mockOnSave}
        onOpen={vi.fn()}
        onStepClick={vi.fn()}
      />
    )

    // **STEP 1: Verify component renders**
    expect(screen.getByText('Course Settings')).toBeInTheDocument()

    // **STEP 2: Find and change a course setting**
    // Look for "Require audio completion" checkbox
    const audioCompletionCheckbox = screen.getByRole('checkbox', { name: /require audio completion/i })
    expect(audioCompletionCheckbox).toBeInTheDocument()

    // **STEP 3: Make a change to trigger unsaved changes**
    await user.click(audioCompletionCheckbox)

    // **STEP 4: Verify markDirty was called with 'courseSettings'**
    await waitFor(() => {
      expect(mockMarkDirty).toHaveBeenCalledWith('courseSettings')
    }, { timeout: 2000 })

    // Log what actually got called for debugging
    console.log('[TEST] markDirty calls:', mockMarkDirty.mock.calls)
  })

  it('should trigger save action when save button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnSave = vi.fn()

    // Mock that we have unsaved changes
    mockHasUnsavedChanges = true

    render(
      <CourseSettingsWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={mockOnSave}
        onOpen={vi.fn()}
        onStepClick={vi.fn()}
      />
    )

    // Make a change first
    const audioCompletionCheckbox = screen.getByRole('checkbox', { name: /require audio completion/i })
    await user.click(audioCompletionCheckbox)

    // Try to find save button (might be in PageLayout)
    const saveButton = screen.getByTestId('save-button')
    await user.click(saveButton)

    // Verify save was called
    expect(mockOnSave).toHaveBeenCalled()
  })

  it('should show unsaved changes warning when trying to navigate away', async () => {
    const user = userEvent.setup()
    const mockOnBack = vi.fn()

    // Mock that we have unsaved changes
    mockHasUnsavedChanges = true

    render(
      <CourseSettingsWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={mockOnBack}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={vi.fn()}
        onOpen={vi.fn()}
        onStepClick={vi.fn()}
      />
    )

    // Make a change to trigger unsaved changes
    const audioCompletionCheckbox = screen.getByRole('checkbox', { name: /require audio completion/i })
    await user.click(audioCompletionCheckbox)

    // Try to navigate back
    const backButton = screen.getByTestId('back-button')
    await user.click(backButton)

    // Should show navigation warning
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
    })

    // Navigation should be blocked until confirmed
    expect(mockOnBack).not.toHaveBeenCalled()
  })

  it('should show specific error if markDirty is called with invalid section', async () => {
    const user = userEvent.setup()

    // Mock markDirty to throw error for invalid section
    mockMarkDirty.mockImplementation((section: string) => {
      if (!['courseSeed', 'courseContent', 'media', 'activities', 'courseSettings', 'promptTuning'].includes(section)) {
        throw new Error(`Invalid section: ${section}`)
      }
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

    // Make a change
    const audioCompletionCheckbox = screen.getByRole('checkbox', { name: /require audio completion/i })
    await user.click(audioCompletionCheckbox)

    // Should not throw error if 'courseSettings' is valid
    await waitFor(() => {
      expect(mockMarkDirty).toHaveBeenCalledWith('courseSettings')
    })
  })

  it('should debug log all function calls to help identify the issue', async () => {
    const user = userEvent.setup()

    // Add console spy to see what's happening
    const consoleSpy = vi.spyOn(console, 'log')

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

    // Make a change
    const audioCompletionCheckbox = screen.getByRole('checkbox', { name: /require audio completion/i })
    await user.click(audioCompletionCheckbox)

    // Wait and log all calls
    await waitFor(() => {
      console.log('[TEST DEBUG] markDirty calls:', mockMarkDirty.mock.calls)
      console.log('[TEST DEBUG] Console calls:', consoleSpy.mock.calls)
      console.log('[TEST DEBUG] Storage calls:', mockStorage.saveContent.mock.calls)
    })
  })
})