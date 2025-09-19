import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CourseSettingsWizard, DEFAULT_COURSE_SETTINGS } from './CourseSettingsWizard'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { FileStorage } from '../services/FileStorage'

// Mock FileStorage
vi.mock('../services/FileStorage')
vi.mock('../config/environment', () => ({
  isTauriEnvironment: () => false
}))

const mockFileStorage = {
  isInitialized: true,
  currentProjectId: null,
  initialize: vi.fn().mockResolvedValue(undefined),
  saveContent: vi.fn(),
  getContent: vi.fn(),
  openProject: vi.fn(),
  listProjects: vi.fn().mockResolvedValue([]),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  getCourseSeedData: vi.fn(),
  saveCourseSeedData: vi.fn(),
  getCourseContent: vi.fn(),
  saveCourseContent: vi.fn(),
  storeMedia: vi.fn(),
  getMedia: vi.fn(),
  getAllProjectMedia: vi.fn().mockResolvedValue([]),
  cancelAllPendingSaves: vi.fn(),
  saveProject: vi.fn()
}

// Mock the FileStorage constructor
vi.mocked(FileStorage).mockImplementation(() => mockFileStorage as any)

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <PersistentStorageProvider>
      <UnsavedChangesProvider>
        <StepNavigationProvider>
          {children}
        </StepNavigationProvider>
      </UnsavedChangesProvider>
    </PersistentStorageProvider>
  )
}

describe('CourseSettingsWizard - Project ID Synchronization', () => {
  const mockCourseContent = {
    welcomePage: { title: 'Welcome', content: 'Test content' },
    learningObjectivesPage: { title: 'Objectives', content: 'Test objectives' },
    topics: [],
    assessment: { questions: [] }
  }

  const mockCourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    template: 'None',
    customTopics: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to no project open state
    mockFileStorage.currentProjectId = null
  })

  it('should demonstrate the project ID synchronization issue (reproducing the bug)', async () => {
    // Arrange: No project open initially
    mockFileStorage.currentProjectId = null

    // We expect the save to fail when no project is open
    mockFileStorage.saveContent.mockImplementation((key: string, content: any) => {
      if (!mockFileStorage.currentProjectId) {
        throw new Error('No project open')
      }
      return Promise.resolve()
    })

    const mockOnNext = vi.fn()
    const mockOnBack = vi.fn()

    // Act: Render CourseSettingsWizard
    render(
      <TestWrapper>
        <CourseSettingsWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      </TestWrapper>
    )

    // Wait for render
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /show progress bar/i })).toBeInTheDocument()
    })

    // Try to proceed to next step (which triggers save)
    const nextButton = screen.getByTestId('next-button')
    fireEvent.click(nextButton)

    // Assert: Should attempt to save and show the error
    // The component should handle the error gracefully and continue with navigation
    await waitFor(() => {
      expect(mockOnNext).toHaveBeenCalled()
    })

    // The save should have been attempted
    expect(mockFileStorage.saveContent).toHaveBeenCalledWith('courseSettings', expect.any(Object))
    expect(mockFileStorage.saveContent).toHaveBeenCalledTimes(1)
  })

  it('should successfully save course settings when a project is open', async () => {
    // Arrange: Project is open
    mockFileStorage.currentProjectId = '1756944000180'
    mockFileStorage.saveContent.mockResolvedValue(undefined)
    mockFileStorage.getContent.mockResolvedValue(DEFAULT_COURSE_SETTINGS)

    const mockOnNext = vi.fn()
    const mockOnBack = vi.fn()

    // Act: Render CourseSettingsWizard and try to save
    render(
      <TestWrapper>
        <CourseSettingsWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      </TestWrapper>
    )

    // Wait for settings to load
    await waitFor(() => {
      expect(mockFileStorage.getContent).toHaveBeenCalledWith('courseSettings')
    })

    // Modify a setting
    const checkbox = screen.getByRole('checkbox', { name: /show progress bar/i })
    fireEvent.click(checkbox)

    // Try to proceed to next step (which should save settings)
    const nextButton = screen.getByTestId('next-button')
    fireEvent.click(nextButton)

    // Assert: Should successfully save settings
    await waitFor(() => {
      expect(mockFileStorage.saveContent).toHaveBeenCalledWith('courseSettings', expect.any(Object))
      expect(mockOnNext).toHaveBeenCalled()
    })

    // The save should have succeeded
    expect(mockFileStorage.saveContent).toHaveBeenCalledTimes(1)
  })

  it('should load saved course settings when project is reopened', async () => {
    // Arrange: Project with saved settings
    const savedSettings = {
      ...DEFAULT_COURSE_SETTINGS,
      showProgress: false,
      passMark: 90
    }

    mockFileStorage.currentProjectId = '1756944000180'
    mockFileStorage.getContent.mockResolvedValue(savedSettings)

    const mockOnNext = vi.fn()
    const mockOnBack = vi.fn()

    // Act: Render CourseSettingsWizard
    render(
      <TestWrapper>
        <CourseSettingsWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      </TestWrapper>
    )

    // Assert: Should load the saved settings
    await waitFor(() => {
      expect(mockFileStorage.getContent).toHaveBeenCalledWith('courseSettings')
    })

    // Check that the loaded settings are applied
    const progressCheckbox = screen.getByRole('checkbox', { name: /show progress bar/i })
    expect(progressCheckbox).not.toBeChecked()

    const passMarkInput = screen.getByDisplayValue('90')
    expect(passMarkInput).toBeInTheDocument()
  })
})