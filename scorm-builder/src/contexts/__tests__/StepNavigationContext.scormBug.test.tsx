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

  it('FIXED: now backfills intermediate steps when navigating to step N', async () => {
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

    // FIXED: After navigation, all steps 0-6 should now be visited (backfilled)
    expect(result.current.visitedSteps).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(result.current.currentStep).toBe(6)

    // FIXED: All steps 0-6 are now navigable
    expect(result.current.canNavigateToStep(0)).toBe(true)  // ✓
    expect(result.current.canNavigateToStep(1)).toBe(true)  // ✓ FIXED!
    expect(result.current.canNavigateToStep(2)).toBe(true)  // ✓ FIXED!
    expect(result.current.canNavigateToStep(3)).toBe(true)  // ✓ FIXED!
    expect(result.current.canNavigateToStep(4)).toBe(true)  // ✓ FIXED!
    expect(result.current.canNavigateToStep(5)).toBe(true)  // ✓ FIXED!
    expect(result.current.canNavigateToStep(6)).toBe(true)  // ✓
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

  it('FIXED: automatically backfills visited steps when navigating to step N', async () => {
    // Start with only step 0 visited (simulating saved state)
    mockStorage.getContent.mockResolvedValueOnce({ steps: [0] })

    const { result } = renderHook(() => useStepNavigation(), {
      wrapper: ({ children }) => (
        <StepNavigationProvider>{children}</StepNavigationProvider>
      )
    })

    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('visitedSteps')
    })

    // Initial state: only step 0 visited
    expect(result.current.visitedSteps).toEqual([0])
    expect(result.current.currentStep).toBe(0)

    // Navigate directly to step 6 (SCORM scenario)
    act(() => {
      result.current.navigateToStep(6)
    })

    // EXPECTED: All steps 0-6 should now be visited (backfilled)
    expect(result.current.visitedSteps).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(result.current.currentStep).toBe(6)

    // EXPECTED: All steps 0-6 should be navigable
    for (let i = 0; i <= 6; i++) {
      expect(result.current.canNavigateToStep(i)).toBe(true)
    }
    
    // Step 7 should still not be navigable
    expect(result.current.canNavigateToStep(7)).toBe(false)

    // Verify backfilled steps are persisted (with debounce delay)
    await waitFor(() => {
      expect(mockStorage.saveContent).toHaveBeenCalledWith('visitedSteps', {
        steps: [0, 1, 2, 3, 4, 5, 6]
      })
    }, { timeout: 2000 }) // Allow time for debounced save
  })

  it('preserves higher visited steps when backfilling', async () => {
    // Start with steps [0, 3, 8] visited (user jumped around)
    mockStorage.getContent.mockResolvedValueOnce({ steps: [0, 3, 8] })

    const { result } = renderHook(() => useStepNavigation(), {
      wrapper: ({ children }) => (
        <StepNavigationProvider>{children}</StepNavigationProvider>
      )
    })

    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('visitedSteps')
    })

    // Navigate to step 5 (should backfill 1, 2, 4, 5 but keep 8)
    act(() => {
      result.current.navigateToStep(5)
    })

    // Should have [0, 1, 2, 3, 4, 5, 8] - backfilled 0-5 + preserved 8
    expect(result.current.visitedSteps).toEqual([0, 1, 2, 3, 4, 5, 8])
    
    // All steps 0-5 and 8 should be navigable
    for (let i = 0; i <= 5; i++) {
      expect(result.current.canNavigateToStep(i)).toBe(true)
    }
    expect(result.current.canNavigateToStep(6)).toBe(false) // Not visited
    expect(result.current.canNavigateToStep(7)).toBe(false) // Not visited
    expect(result.current.canNavigateToStep(8)).toBe(true)  // Previously visited
  })

  it('handles backward navigation without losing backfilled steps', async () => {
    // Start fresh with only step 0
    mockStorage.getContent.mockResolvedValueOnce({ steps: [0] })

    const { result } = renderHook(() => useStepNavigation(), {
      wrapper: ({ children }) => (
        <StepNavigationProvider>{children}</StepNavigationProvider>
      )
    })

    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('visitedSteps')
    })

    // Navigate forward to step 4 (should backfill 0-4)
    act(() => {
      result.current.navigateToStep(4)
    })
    expect(result.current.visitedSteps).toEqual([0, 1, 2, 3, 4])

    // Navigate backward to step 2 (should not remove any visited steps)
    act(() => {
      result.current.navigateToStep(2)
    })
    expect(result.current.visitedSteps).toEqual([0, 1, 2, 3, 4]) // Unchanged
    expect(result.current.currentStep).toBe(2)

    // All steps 0-4 should still be navigable
    for (let i = 0; i <= 4; i++) {
      expect(result.current.canNavigateToStep(i)).toBe(true)
    }
  })
})