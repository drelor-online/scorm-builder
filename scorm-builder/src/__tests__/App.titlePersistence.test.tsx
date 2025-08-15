import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from '../App'

// Mock dependencies
vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: vi.fn(),
  PersistentStorageProvider: ({ children }: any) => children
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('../contexts/StepNavigationContext', () => ({
  StepNavigationProvider: ({ children }: any) => children,
  useStepNavigation: () => ({
    currentStep: 'seed',
    markStepAsVisited: vi.fn(),
    canProceedToStep: () => true,
    navigateToStep: vi.fn()
  })
}))

vi.mock('../contexts/UnifiedMediaContext', () => ({
  UnifiedMediaProvider: ({ children }: any) => children,
  useUnifiedMedia: () => ({
    storeMedia: vi.fn(),
    getMedia: vi.fn(),
    deleteMedia: vi.fn(),
    storeYouTubeVideo: vi.fn(),
    getMediaForPage: () => [],
    getAllMedia: () => [],
    getMediaById: () => undefined,
    createBlobUrl: vi.fn(),
    revokeBlobUrl: vi.fn(),
    isLoading: false,
    error: null,
    clearError: vi.fn(),
    refreshMedia: vi.fn()
  })
}))

import { useStorage } from '../contexts/PersistentStorageContext'
import { invoke } from '@tauri-apps/api/core'

describe('App - Title Persistence from Project Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset window.location
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true
    })
  })

  it('should load and display course title from project file when opened from dashboard', async () => {
    // Simulate opening a project from the dashboard
    const mockProjectData = {
      id: '1754444630422',
      name: 'Natural_Gas_Safety_1754444630422',
      course_data: {
        title: 'Natural Gas Safety',
        objectives: ['Understand gas safety basics'],
        topics: [{
          title: 'Introduction',
          content: 'Welcome to the course'
        }]
      }
    }

    // Mock storage with project data
    vi.mocked(useStorage).mockReturnValue({
      currentProjectId: '1754444630422',
      currentProjectPath: 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Natural_Gas_Safety_1754444630422.scormproj',
      isInitialized: true,
      getContent: vi.fn((key) => {
        if (key === 'courseSeedData') {
          return null // No seed data yet - simulating fresh load
        }
        return null
      }),
      getCourseMetadata: vi.fn().mockResolvedValue({
        title: 'Natural Gas Safety',
        difficulty: 3,
        topics: ['Introduction']
      }),
      saveContent: vi.fn(),
      saveCourseMetadata: vi.fn(),
      listProjects: vi.fn().mockResolvedValue([{
        id: '1754444630422',
        name: 'Natural Gas Safety',
        path: 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Natural_Gas_Safety_1754444630422.scormproj'
      }]),
      fileStorage: {}
    } as any)

    // Mock invoke to return project data
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'load_project') {
        return Promise.resolve(mockProjectData)
      }
      return Promise.resolve(null)
    })

    render(<App />)

    // Wait for the title to appear
    await waitFor(() => {
      const titleInput = screen.getByLabelText(/Course Title/i) as HTMLInputElement
      expect(titleInput.value).toBe('Natural Gas Safety')
    }, { timeout: 3000 })
  })

  it('should preserve title when navigating between steps', async () => {
    // Mock storage with saved seed data
    vi.mocked(useStorage).mockReturnValue({
      currentProjectId: '1754444630422',
      currentProjectPath: 'C:\\Users\\sierr\\Documents\\SCORM Projects\\Natural_Gas_Safety_1754444630422.scormproj',
      isInitialized: true,
      getContent: vi.fn((key) => {
        if (key === 'courseSeedData') {
          return Promise.resolve({
            courseTitle: 'My Preserved Title',
            difficulty: 3,
            customTopics: ['Topic 1', 'Topic 2'],
            template: 'None'
          })
        }
        return Promise.resolve(null)
      }),
      getCourseMetadata: vi.fn().mockResolvedValue({
        title: 'My Preserved Title',
        difficulty: 3,
        topics: ['Topic 1', 'Topic 2']
      }),
      saveContent: vi.fn(),
      saveCourseMetadata: vi.fn(),
      listProjects: vi.fn().mockResolvedValue([]),
      fileStorage: {}
    } as any)

    render(<App />)

    // Wait for the title to appear
    await waitFor(() => {
      const titleInput = screen.getByLabelText(/Course Title/i) as HTMLInputElement
      expect(titleInput.value).toBe('My Preserved Title')
    }, { timeout: 3000 })
  })
})