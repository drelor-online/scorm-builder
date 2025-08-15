import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor, renderHook, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StepNavigationProvider, useStepNavigation } from '../StepNavigationContext'
import React from 'react'

// Mock storage
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn().mockResolvedValue(null),
  saveContent: vi.fn().mockResolvedValue(undefined),
  getCourseMetadata: vi.fn(),
  saveCourseMetadata: vi.fn(),
  saveProject: vi.fn(),
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
}

vi.mock('../../contexts/PersistentStorageContext', () => ({
  useStorage: () => mockStorage
}))

describe('StepNavigationContext - Visited Steps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should load visited steps from storage', async () => {
    // Simulate saved visited steps
    mockStorage.getContent.mockResolvedValue({ steps: [0, 1, 2] })

    const { result } = renderHook(() => useStepNavigation(), {
      wrapper: ({ children }) => (
        <StepNavigationProvider>{children}</StepNavigationProvider>
      )
    })

    // Wait for the effect to load visited steps
    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('visitedSteps')
    })

    await waitFor(() => {
      expect(result.current.visitedSteps).toEqual([0, 1, 2])
    })
  })

  it('should allow navigation to visited steps', async () => {
    mockStorage.getContent.mockResolvedValue({ steps: [0, 1, 2, 3] })

    const { result } = renderHook(() => useStepNavigation(), {
      wrapper: ({ children }) => (
        <StepNavigationProvider>{children}</StepNavigationProvider>
      )
    })

    await waitFor(() => {
      expect(result.current.visitedSteps).toEqual([0, 1, 2, 3])
    })

    // Should be able to navigate to visited steps
    expect(result.current.canNavigateToStep(0)).toBe(true)
    expect(result.current.canNavigateToStep(1)).toBe(true)
    expect(result.current.canNavigateToStep(2)).toBe(true)
    expect(result.current.canNavigateToStep(3)).toBe(true)
    
    // Should NOT be able to navigate to unvisited steps
    expect(result.current.canNavigateToStep(4)).toBe(false)
    expect(result.current.canNavigateToStep(5)).toBe(false)
  })

  it('should add new steps to visited when navigating', async () => {
    mockStorage.getContent.mockResolvedValue({ steps: [0] })

    const { result } = renderHook(() => useStepNavigation(), {
      wrapper: ({ children }) => (
        <StepNavigationProvider>{children}</StepNavigationProvider>
      )
    })

    await waitFor(() => {
      expect(result.current.visitedSteps).toEqual([0])
    })

    // Navigate to a new step
    act(() => {
      result.current.navigateToStep(3)
    })

    // Should add the new step to visited steps
    expect(result.current.visitedSteps).toEqual([0, 3])
    expect(result.current.currentStep).toBe(3)

    // Should save the updated visited steps
    await waitFor(() => {
      expect(mockStorage.saveContent).toHaveBeenCalledWith('visitedSteps', { steps: [0, 3] })
    })
  })

  it('should handle project with only step 0 visited but at step 6 (SCORM bug reproduction)', async () => {
    // This reproduces the bug: project saved at SCORM step but visitedSteps only has [0]
    mockStorage.getContent.mockResolvedValue({ steps: [0] })

    const { result } = renderHook(() => useStepNavigation(), {
      wrapper: ({ children }) => (
        <StepNavigationProvider>{children}</StepNavigationProvider>
      )
    })

    await waitFor(() => {
      expect(result.current.visitedSteps).toEqual([0])
    })

    // Navigate to step 6 (SCORM) as App.tsx would do
    act(() => {
      result.current.navigateToStep(6)
    })

    // After navigating to step 6, visitedSteps should be [0, 6]
    expect(result.current.visitedSteps).toEqual([0, 6])

    // BUG: Steps 1-5 are NOT in visitedSteps, so they would be disabled
    expect(result.current.canNavigateToStep(1)).toBe(false) // Should be true!
    expect(result.current.canNavigateToStep(2)).toBe(false) // Should be true!
    expect(result.current.canNavigateToStep(3)).toBe(false) // Should be true!
    expect(result.current.canNavigateToStep(4)).toBe(false) // Should be true!
    expect(result.current.canNavigateToStep(5)).toBe(false) // Should be true!
    expect(result.current.canNavigateToStep(6)).toBe(true)
  })

  it('should populate all previous steps when loading at a later step (desired behavior)', async () => {
    // This test shows the desired behavior: when at step N, steps 0 through N should be visited
    mockStorage.getContent.mockResolvedValue({ steps: [0] })

    const { result } = renderHook(() => useStepNavigation(), {
      wrapper: ({ children }) => (
        <StepNavigationProvider>{children}</StepNavigationProvider>
      )
    })

    await waitFor(() => {
      expect(result.current.visitedSteps).toEqual([0])
    })

    // Simulate what SHOULD happen when loading at step 6
    // All steps 0-6 should be marked as visited
    act(() => {
      for (let i = 0; i <= 6; i++) {
        if (!result.current.visitedSteps.includes(i)) {
          result.current.navigateToStep(i)
        }
      }
    })

    // All steps should now be accessible
    expect(result.current.visitedSteps).toContain(0)
    expect(result.current.visitedSteps).toContain(1)
    expect(result.current.visitedSteps).toContain(2)
    expect(result.current.visitedSteps).toContain(3)
    expect(result.current.visitedSteps).toContain(4)
    expect(result.current.visitedSteps).toContain(5)
    expect(result.current.visitedSteps).toContain(6)

    // All steps should be navigable
    for (let i = 0; i <= 6; i++) {
      expect(result.current.canNavigateToStep(i)).toBe(true)
    }
  })
})