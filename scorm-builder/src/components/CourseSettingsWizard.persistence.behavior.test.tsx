/**
 * @file CourseSettingsWizard.persistence.behavior.test.tsx
 *
 * TDD Test for course settings persistence issue.
 *
 * ISSUE: Course settings are not being saved with the project and reset when
 * navigating back to the settings page.
 *
 * EXPECTED BEHAVIOR:
 * - Course settings should be saved when moving to next step
 * - Course settings should persist when returning to the settings page
 * - Default navigation mode should be 'free', not 'linear'
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../test/testProviders'
import { CourseSettingsWizard, DEFAULT_COURSE_SETTINGS } from './CourseSettingsWizard'
import type { CourseContentUnion, CourseSeedData } from '../types/aiPrompt'

// Mock storage functions
const mockSaveContent = vi.fn()
const mockGetContent = vi.fn()
const mockPersistentStorage = {
  saveContent: mockSaveContent,
  getContent: mockGetContent,
  currentProjectId: 'test-project-123',
  isInitialized: true,
}

vi.mock('../hooks/usePersistentStorage', () => ({
  usePersistentStorage: () => mockPersistentStorage,
}))

// Mock course content
const createMockCourseContent = (): CourseContentUnion => ({
  title: 'Test Course',
  welcome: {
    pageId: 'welcome',
    content: 'Welcome to the test course',
    media: []
  },
  objectives: ['Objective 1', 'Objective 2'],
  objectivesPage: {
    pageId: 'objectives',
    content: 'Course objectives',
    media: []
  },
  topics: [
    {
      id: 'topic-1',
      title: 'Topic 1',
      content: 'Content for topic 1',
      media: []
    }
  ]
})

const createMockCourseSeedData = (): CourseSeedData => ({
  title: 'Test Course',
  learnerDescription: 'Test learner description',
  learnerGoals: 'Test learner goals',
  topics: ['Topic 1'],
  courseTone: 'professional' as const,
  courseStructure: 'modular' as const,
  contentTypes: ['text', 'interactive'] as const,
  estimatedDuration: 60
})

describe('CourseSettingsWizard Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock successful storage operations
    mockSaveContent.mockResolvedValue(undefined)
    mockGetContent.mockResolvedValue(null) // No saved settings initially
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should have free navigation mode as default, not linear', () => {
    // ARRANGE & ACT
    const defaultSettings = DEFAULT_COURSE_SETTINGS

    // ASSERT: Default navigation mode should be 'free'
    expect(defaultSettings.navigationMode).toBe('free')
  })

  it('should save course settings when Next button is clicked', async () => {
    // ARRANGE
    const courseContent = createMockCourseContent()
    const courseSeedData = createMockCourseSeedData()
    const onNext = vi.fn()
    const onBack = vi.fn()

    render(
      <CourseSettingsWizard
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onNext={onNext}
        onBack={onBack}
      />
    )

    // ACT: Change a setting
    const requireAudioCheckbox = screen.getByLabelText(/require audio completion/i)
    fireEvent.click(requireAudioCheckbox)

    // Click Next
    const nextButton = screen.getByText('Generate SCORM Package')
    fireEvent.click(nextButton)

    // ASSERT: Settings should be saved to storage
    await waitFor(() => {
      expect(mockSaveContent).toHaveBeenCalledWith('courseSettings', expect.objectContaining({
        requireAudioCompletion: true,
        navigationMode: 'free' // Should be 'free', not 'linear'
      }))
    })

    // ASSERT: onNext should be called with the settings
    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({
      requireAudioCompletion: true,
      navigationMode: 'free'
    }))
  })

  it('should load saved course settings when component mounts', async () => {
    // ARRANGE: Mock saved settings in storage
    const savedSettings = {
      ...DEFAULT_COURSE_SETTINGS,
      requireAudioCompletion: true,
      navigationMode: 'linear' as const,
      passMark: 90
    }
    mockGetContent.mockResolvedValue(savedSettings)

    const courseContent = createMockCourseContent()
    const courseSeedData = createMockCourseSeedData()
    const onNext = vi.fn()
    const onBack = vi.fn()

    // ACT: Render component
    render(
      <CourseSettingsWizard
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onNext={onNext}
        onBack={onBack}
      />
    )

    // ASSERT: Storage should be queried for saved settings
    await waitFor(() => {
      expect(mockGetContent).toHaveBeenCalledWith('courseSettings')
    })

    // ASSERT: UI should show the loaded settings
    await waitFor(() => {
      const requireAudioCheckbox = screen.getByLabelText(/require audio completion/i) as HTMLInputElement
      expect(requireAudioCheckbox.checked).toBe(true)

      const linearRadio = screen.getByDisplayValue('linear') as HTMLInputElement
      expect(linearRadio.checked).toBe(true)
    })
  })

  it('should persist settings changes across page navigation', async () => {
    // ARRANGE: Create component with initial settings
    const courseContent = createMockCourseContent()
    const courseSeedData = createMockCourseSeedData()
    const onNext = vi.fn()
    const onBack = vi.fn()

    const { rerender } = render(
      <CourseSettingsWizard
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onNext={onNext}
        onBack={onBack}
      />
    )

    // ACT: Change settings
    const showProgressCheckbox = screen.getByLabelText(/show progress/i)
    fireEvent.click(showProgressCheckbox) // Uncheck it (default is true)

    const confirmExitCheckbox = screen.getByLabelText(/confirm exit/i)
    fireEvent.click(confirmExitCheckbox) // Uncheck it (default is true)

    // Click Next to save settings
    const nextButton = screen.getByText('Generate SCORM Package')
    fireEvent.click(nextButton)

    // Wait for save to complete
    await waitFor(() => {
      expect(mockSaveContent).toHaveBeenCalled()
    })

    // SIMULATE: Coming back to the settings page
    // Mock that the settings are now in storage
    const expectedSavedSettings = {
      ...DEFAULT_COURSE_SETTINGS,
      showProgress: false,
      confirmExit: false,
      navigationMode: 'free'
    }
    mockGetContent.mockResolvedValue(expectedSavedSettings)

    // Rerender component (simulating navigation back)
    rerender(
      <CourseSettingsWizard
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onNext={onNext}
        onBack={onBack}
      />
    )

    // ASSERT: Settings should be restored from storage
    await waitFor(() => {
      const showProgressCheckbox = screen.getByLabelText(/show progress/i) as HTMLInputElement
      expect(showProgressCheckbox.checked).toBe(false)

      const confirmExitCheckbox = screen.getByLabelText(/confirm exit/i) as HTMLInputElement
      expect(confirmExitCheckbox.checked).toBe(false)

      const freeRadio = screen.getByDisplayValue('free') as HTMLInputElement
      expect(freeRadio.checked).toBe(true)
    })
  })

  it('should handle storage errors gracefully', async () => {
    // ARRANGE: Mock storage error
    mockGetContent.mockRejectedValue(new Error('Storage error'))

    const courseContent = createMockCourseContent()
    const courseSeedData = createMockCourseSeedData()
    const onNext = vi.fn()
    const onBack = vi.fn()

    // ACT: Render component
    render(
      <CourseSettingsWizard
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onNext={onNext}
        onBack={onBack}
      />
    )

    // ASSERT: Component should render with default settings despite error
    await waitFor(() => {
      const requireAudioCheckbox = screen.getByLabelText(/require audio completion/i) as HTMLInputElement
      expect(requireAudioCheckbox.checked).toBe(false) // Default value

      const freeRadio = screen.getByDisplayValue('free') as HTMLInputElement
      expect(freeRadio.checked).toBe(true) // Should default to 'free'
    })
  })

  it('should use free navigation mode in default settings', () => {
    // ARRANGE
    const courseContent = createMockCourseContent()
    const courseSeedData = createMockCourseSeedData()
    const onNext = vi.fn()
    const onBack = vi.fn()

    // ACT: Render component with no saved settings (defaults)
    render(
      <CourseSettingsWizard
        courseContent={courseContent}
        courseSeedData={courseSeedData}
        onNext={onNext}
        onBack={onBack}
      />
    )

    // ASSERT: Free navigation should be selected by default
    const freeRadio = screen.getByDisplayValue('free') as HTMLInputElement
    const linearRadio = screen.getByDisplayValue('linear') as HTMLInputElement

    expect(freeRadio.checked).toBe(true)
    expect(linearRadio.checked).toBe(false)
  })
})