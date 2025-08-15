import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StepNavigationProvider, useStepNavigation } from '../StepNavigationContext'
import React from 'react'

// Create a proper mock that returns promises
const createMockStorage = () => ({
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn().mockImplementation(() => Promise.resolve(null)),
  saveContent: vi.fn().mockImplementation(() => Promise.resolve()),
  getCourseMetadata: vi.fn().mockResolvedValue(null),
  saveCourseMetadata: vi.fn().mockResolvedValue(undefined),
  saveProject: vi.fn().mockResolvedValue(undefined),
  createProject: vi.fn(),
  openProject: vi.fn(),
  openProjectFromFile: vi.fn(),
  openProjectFromPath: vi.fn(),
  saveProjectAs: vi.fn(),
  listProjects: vi.fn(),
  getRecentProjects: vi.fn(),
  checkForRecovery: vi.fn(),
  recoverFromBackup: vi.fn(),
  storeMedia: vi.fn(),
  storeYouTubeVideo: vi.fn(),
  getMedia: vi.fn(),
  getMediaForTopic: vi.fn(),
  saveAiPrompt: vi.fn(),
  getAiPrompt: vi.fn(),
  saveAudioSettings: vi.fn(),
  getAudioSettings: vi.fn(),
  saveScormConfig: vi.fn(),
  getScormConfig: vi.fn(),
  deleteProject: vi.fn(),
  exportProject: vi.fn(),
  importProjectFromZip: vi.fn(),
  getCurrentProjectId: vi.fn(),
  setProjectsDirectory: vi.fn(),
  migrateFromLocalStorage: vi.fn(),
  clearRecentFilesCache: vi.fn(),
  error: null,
  fileStorage: {} as any
})

let mockStorage = createMockStorage()

vi.mock('../../contexts/PersistentStorageContext', () => ({
  useStorage: () => mockStorage
}))

describe('StepNavigationContext - SCORM Bug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage = createMockStorage()
  })

  it('reproduces the bug: steps 1-5 are disabled when loading at SCORM with only step 0 visited', async () => {
    // Simulate the exact scenario from the user's project:
    // - visitedSteps saved as [0]
    // - current step is SCORM (6)
    mockStorage.getContent.mockResolvedValueOnce({ steps: [0] })

    const { result } = renderHook(() => useStepNavigation(), {
      wrapper: ({ children }) => (
        <StepNavigationProvider>{children}</StepNavigationProvider>
      )
    })

    // Wait for initial load
    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('visitedSteps')
    })

    // Initial state should have only step 0 visited
    expect(result.current.visitedSteps).toEqual([0])

    // Simulate what App.tsx does: navigate to step 6 (SCORM)
    act(() => {
      result.current.navigateToStep(6)
    })

    // After navigation, visitedSteps should be [0, 6]
    expect(result.current.visitedSteps).toEqual([0, 6])
    expect(result.current.currentStep).toBe(6)

    // THE BUG: Steps 1-5 are NOT navigable even though we're at step 6
    expect(result.current.canNavigateToStep(0)).toBe(true)  // OK
    expect(result.current.canNavigateToStep(1)).toBe(false) // BUG: Should be true!
    expect(result.current.canNavigateToStep(2)).toBe(false) // BUG: Should be true!
    expect(result.current.canNavigateToStep(3)).toBe(false) // BUG: Should be true!
    expect(result.current.canNavigateToStep(4)).toBe(false) // BUG: Should be true!
    expect(result.current.canNavigateToStep(5)).toBe(false) // BUG: Should be true!
    expect(result.current.canNavigateToStep(6)).toBe(true)  // OK
  })

  it('shows the desired behavior: all steps 0-N should be visited when at step N', async () => {
    // Start with only step 0 visited
    mockStorage.getContent.mockResolvedValueOnce({ steps: [0] })

    const { result } = renderHook(() => useStepNavigation(), {
      wrapper: ({ children }) => (
        <StepNavigationProvider>{children}</StepNavigationProvider>
      )
    })

    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('visitedSteps')
    })

    // When loading at step 6, we should mark all steps 0-6 as visited
    act(() => {
      // This is what the fix should do automatically
      for (let i = 0; i <= 6; i++) {
        result.current.navigateToStep(i)
      }
      // End at step 6
      result.current.navigateToStep(6)
    })

    // All steps 0-6 should be navigable
    for (let i = 0; i <= 6; i++) {
      expect(result.current.canNavigateToStep(i)).toBe(true)
    }
    
    // Step 7 should still not be navigable (not visited yet)
    expect(result.current.canNavigateToStep(7)).toBe(false)
  })
})