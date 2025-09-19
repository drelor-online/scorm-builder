import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { SCORMPackageBuilder } from './SCORMPackageBuilder'
import type { CourseContent } from '../types/scorm'
import type { CourseSeedData } from '../types/course'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'

// Mock the Rust SCORM generator to capture what settings are passed
const mockGenerateRustSCORM = vi.fn()
vi.mock('../services/rustScormGenerator', () => ({
  generateRustSCORM: (...args: any[]) => mockGenerateRustSCORM(...args)
}))

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn().mockResolvedValue('/mock/path/test.zip')
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue([])
}))

// Mock course content converter
vi.mock('../services/courseContentConverter', () => ({
  convertToEnhancedCourseContent: vi.fn().mockResolvedValue({
    courseTitle: 'Test Course',
    welcomePage: { title: 'Welcome', content: 'Welcome content' },
    topics: []
  })
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
      saveCourseSeedData: vi.fn().mockResolvedValue(true),
      saveProject: vi.fn().mockResolvedValue(true),
      currentProjectId: 'test-project-123'
    })
  }
})

describe('SCORMPackageBuilder - Course Settings Template Integration', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      title: 'Welcome',
      content: 'Welcome content',
      media: []
    },
    topics: [
      {
        id: 'topic-1',
        title: 'Test Topic',
        content: 'Test content',
        media: [],
        knowledgeCheck: {
          enabled: true,
          questions: [
            {
              id: 'q1',
              type: 'multiple-choice',
              text: 'Test question?',
              options: ['A', 'B', 'C', 'D'],
              correctAnswer: 'A',
              explanation: 'Test explanation'
            }
          ]
        }
      }
    ]
  }

  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    description: 'Test Description',
    learningObjectives: ['Objective 1']
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock successful generation
    mockGenerateRustSCORM.mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
  })

  const renderWithProviders = (courseSettings: any = null) => {
    // Mock storage to return specific course settings
    mockStorageGetContent.mockImplementation((key: string) => {
      if (key === 'courseSettings') {
        return Promise.resolve(courseSettings)
      }
      return Promise.resolve(null)
    })

    return render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider projectId="test-project">
          <NotificationProvider>
            <StepNavigationProvider>
              <SCORMPackageBuilder
                courseContent={mockCourseContent}
                courseSeedData={mockCourseSeedData}
                onBack={() => {}}
                onSettingsClick={() => {}}
                onHelp={() => {}}
              />
            </StepNavigationProvider>
          </NotificationProvider>
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )
  }

  it('should pass course settings to generateRustSCORM when showProgress=false and showOutline=false', async () => {
    const courseSettings = {
      showProgress: false,
      showOutline: false,
      requireAudioCompletion: false,
      navigationMode: 'linear' as const,
      autoAdvance: false,
      allowPreviousReview: true,
      passMark: 80,
      allowRetake: true,
      retakeDelay: 0,
      completionCriteria: 'view_and_pass' as const,
      confirmExit: true,
      fontSize: 'medium' as const,
      timeLimit: 0,
      sessionTimeout: 30,
      minimumTimeSpent: 0,
      keyboardNavigation: true,
      printable: false
    }

    const { getByRole } = renderWithProviders(courseSettings)

    // Click generate button to trigger SCORM generation
    const generateButton = getByRole('button', { name: /generate scorm package/i })
    generateButton.click()

    // Wait for the mock to be called
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify generateRustSCORM was called with the correct settings
    expect(mockGenerateRustSCORM).toHaveBeenCalled()

    // Check the 5th argument (courseSettings)
    const callArgs = mockGenerateRustSCORM.mock.calls[0]
    const passedSettings = callArgs[4] // courseSettings should be the 5th argument

    expect(passedSettings).toBeDefined()
    expect(passedSettings.showProgress).toBe(false)
    expect(passedSettings.showOutline).toBe(false)
  })

  it('should pass default course settings when no settings are stored', async () => {
    const { getByRole } = renderWithProviders(null) // No stored settings

    // Click generate button to trigger SCORM generation
    const generateButton = getByRole('button', { name: /generate scorm package/i })
    generateButton.click()

    // Wait for the mock to be called
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify generateRustSCORM was called with default settings
    expect(mockGenerateRustSCORM).toHaveBeenCalled()

    const callArgs = mockGenerateRustSCORM.mock.calls[0]
    const passedSettings = callArgs[4] // courseSettings should be the 5th argument

    expect(passedSettings).toBeDefined()
    expect(passedSettings.showProgress).toBe(true) // Default should be true
    expect(passedSettings.showOutline).toBe(true)  // Default should be true
  })

  it('should pass course settings to generateRustSCORM when showProgress=true and showOutline=true', async () => {
    const courseSettings = {
      showProgress: true,
      showOutline: true,
      requireAudioCompletion: false,
      navigationMode: 'linear' as const,
      autoAdvance: false,
      allowPreviousReview: true,
      passMark: 80,
      allowRetake: true,
      retakeDelay: 0,
      completionCriteria: 'view_and_pass' as const,
      confirmExit: true,
      fontSize: 'medium' as const,
      timeLimit: 0,
      sessionTimeout: 30,
      minimumTimeSpent: 0,
      keyboardNavigation: true,
      printable: false
    }

    const { getByRole } = renderWithProviders(courseSettings)

    // Click generate button to trigger SCORM generation
    const generateButton = getByRole('button', { name: /generate scorm package/i })
    generateButton.click()

    // Wait for the mock to be called
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify generateRustSCORM was called with the correct settings
    expect(mockGenerateRustSCORM).toHaveBeenCalled()

    const callArgs = mockGenerateRustSCORM.mock.calls[0]
    const passedSettings = callArgs[4] // courseSettings should be the 5th argument

    expect(passedSettings).toBeDefined()
    expect(passedSettings.showProgress).toBe(true)
    expect(passedSettings.showOutline).toBe(true)
  })
})