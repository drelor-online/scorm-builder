import { describe, it, expect, act } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAppState } from '../useAppState'
import { CourseSeedData } from '../../types/course'
import { CourseContent } from '../../types/aiPrompt'

describe('useAppState', () => {
  const mockApiKeys = {
    googleImageApiKey: 'test-google-key',
    googleCseId: 'test-cse-id',
    youtubeApiKey: 'test-youtube-key'
  }

  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: ['Topic 1', 'Topic 2'],
    template: 'Technology',
    templateTopics: ['React', 'TypeScript']
  }

  const mockCourseContent: CourseContent = {
    title: 'Test Course Content',
    pages: [
      {
        id: 'page-1',
        title: 'Introduction',
        content: '<p>Welcome</p>',
        narration: 'Welcome'
      }
    ]
  }

  describe('Initial state', () => {
    it('should initialize with default values and provided API keys', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      expect(result.current.state).toEqual({
        currentStep: 'seed',
        courseSeedData: null,
        courseContent: null,
        showSettings: false,
        showHelp: false,
        showTestChecklist: false,
        showDeleteDialog: false,
        showUnsavedDialog: false,
        projectToDelete: null,
        toast: null,
        hasUnsavedChanges: false,
        apiKeys: mockApiKeys
      })
    })
  })

  describe('Step management', () => {
    it('should update current step', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      act(() => {
        result.current.actions.setStep('json')
      })

      expect(result.current.state.currentStep).toBe('json')

      act(() => {
        result.current.actions.setStep('media')
      })

      expect(result.current.state.currentStep).toBe('media')
    })
  })

  describe('Course data management', () => {
    it('should set course seed data', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      act(() => {
        result.current.actions.setCourseSeedData(mockCourseSeedData)
      })

      expect(result.current.state.courseSeedData).toEqual(mockCourseSeedData)

      // Should be able to set to null
      act(() => {
        result.current.actions.setCourseSeedData(null)
      })

      expect(result.current.state.courseSeedData).toBeNull()
    })

    it('should set course content', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      act(() => {
        result.current.actions.setCourseContent(mockCourseContent)
      })

      expect(result.current.state.courseContent).toEqual(mockCourseContent)

      // Should be able to set to null
      act(() => {
        result.current.actions.setCourseContent(null)
      })

      expect(result.current.state.courseContent).toBeNull()
    })
  })

  describe('UI toggles', () => {
    it('should toggle settings', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      expect(result.current.state.showSettings).toBe(false)

      act(() => {
        result.current.actions.toggleSettings()
      })

      expect(result.current.state.showSettings).toBe(true)

      act(() => {
        result.current.actions.toggleSettings()
      })

      expect(result.current.state.showSettings).toBe(false)
    })

    it('should toggle help', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      expect(result.current.state.showHelp).toBe(false)

      act(() => {
        result.current.actions.toggleHelp()
      })

      expect(result.current.state.showHelp).toBe(true)

      act(() => {
        result.current.actions.toggleHelp()
      })

      expect(result.current.state.showHelp).toBe(false)
    })

    it('should toggle test checklist', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      expect(result.current.state.showTestChecklist).toBe(false)

      act(() => {
        result.current.actions.toggleTestChecklist()
      })

      expect(result.current.state.showTestChecklist).toBe(true)

      act(() => {
        result.current.actions.toggleTestChecklist()
      })

      expect(result.current.state.showTestChecklist).toBe(false)
    })
  })

  describe('Dialog management', () => {
    it('should show/hide delete dialog with project info', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      const projectToDelete = { id: 'project-123', name: 'Test Project' }

      act(() => {
        result.current.actions.showDeleteDialog(projectToDelete)
      })

      expect(result.current.state.showDeleteDialog).toBe(true)
      expect(result.current.state.projectToDelete).toEqual(projectToDelete)

      // Hide dialog
      act(() => {
        result.current.actions.showDeleteDialog(null)
      })

      expect(result.current.state.showDeleteDialog).toBe(false)
      expect(result.current.state.projectToDelete).toBeNull()
    })

    it('should show/hide unsaved changes dialog', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      act(() => {
        result.current.actions.showUnsavedDialog(true)
      })

      expect(result.current.state.showUnsavedDialog).toBe(true)

      act(() => {
        result.current.actions.showUnsavedDialog(false)
      })

      expect(result.current.state.showUnsavedDialog).toBe(false)
    })
  })

  describe('Toast notifications', () => {
    it('should show success toast', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      const successToast = { message: 'Operation successful', type: 'success' as const }

      act(() => {
        result.current.actions.showToast(successToast)
      })

      expect(result.current.state.toast).toEqual(successToast)
    })

    it('should show error toast', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      const errorToast = { message: 'Operation failed', type: 'error' as const }

      act(() => {
        result.current.actions.showToast(errorToast)
      })

      expect(result.current.state.toast).toEqual(errorToast)
    })

    it('should clear toast', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      // Set a toast first
      act(() => {
        result.current.actions.showToast({ message: 'Test', type: 'success' })
      })

      // Clear it
      act(() => {
        result.current.actions.showToast(null)
      })

      expect(result.current.state.toast).toBeNull()
    })
  })

  describe('Unsaved changes tracking', () => {
    it('should set unsaved changes state', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      act(() => {
        result.current.actions.setUnsavedChanges(true)
      })

      expect(result.current.state.hasUnsavedChanges).toBe(true)

      act(() => {
        result.current.actions.setUnsavedChanges(false)
      })

      expect(result.current.state.hasUnsavedChanges).toBe(false)
    })
  })

  describe('API keys management', () => {
    it('should update API keys partially', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      // Update only Google key
      act(() => {
        result.current.actions.setApiKeys({ googleImageApiKey: 'new-google-key' })
      })

      expect(result.current.state.apiKeys).toEqual({
        googleImageApiKey: 'new-google-key',
        googleCseId: 'test-cse-id',
        youtubeApiKey: 'test-youtube-key'
      })

      // Update multiple keys
      act(() => {
        result.current.actions.setApiKeys({
          googleCseId: 'new-cse-id',
          youtubeApiKey: 'new-youtube-key'
        })
      })

      expect(result.current.state.apiKeys).toEqual({
        googleImageApiKey: 'new-google-key',
        googleCseId: 'new-cse-id',
        youtubeApiKey: 'new-youtube-key'
      })
    })
  })

  describe('State reset', () => {
    it('should reset state while preserving some values', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      // Set up complex state
      act(() => {
        result.current.actions.setStep('media')
        result.current.actions.setCourseSeedData(mockCourseSeedData)
        result.current.actions.setCourseContent(mockCourseContent)
        result.current.actions.setUnsavedChanges(true)
        result.current.actions.toggleSettings()
        result.current.actions.showDeleteDialog({ id: '123', name: 'Test' })
      })

      // Reset state
      act(() => {
        result.current.actions.resetState()
      })

      // Check reset values
      expect(result.current.state.currentStep).toBe('seed')
      expect(result.current.state.courseSeedData).toBeNull()
      expect(result.current.state.courseContent).toBeNull()
      expect(result.current.state.hasUnsavedChanges).toBe(false)
      expect(result.current.state.projectToDelete).toBeNull()

      // These should NOT be reset
      expect(result.current.state.showSettings).toBe(true)
      expect(result.current.state.apiKeys).toEqual(mockApiKeys)
    })
  })

  describe('Action memoization', () => {
    it('should memoize action creators', () => {
      const { result, rerender } = renderHook(() => useAppState(mockApiKeys))

      const firstActions = result.current.actions

      // Rerender the hook
      rerender()

      const secondActions = result.current.actions

      // All action creators should be the same reference
      expect(secondActions.setStep).toBe(firstActions.setStep)
      expect(secondActions.setCourseSeedData).toBe(firstActions.setCourseSeedData)
      expect(secondActions.setCourseContent).toBe(firstActions.setCourseContent)
      expect(secondActions.toggleSettings).toBe(firstActions.toggleSettings)
      expect(secondActions.toggleHelp).toBe(firstActions.toggleHelp)
      expect(secondActions.toggleTestChecklist).toBe(firstActions.toggleTestChecklist)
      expect(secondActions.showDeleteDialog).toBe(firstActions.showDeleteDialog)
      expect(secondActions.showUnsavedDialog).toBe(firstActions.showUnsavedDialog)
      expect(secondActions.showToast).toBe(firstActions.showToast)
      expect(secondActions.setUnsavedChanges).toBe(firstActions.setUnsavedChanges)
      expect(secondActions.setApiKeys).toBe(firstActions.setApiKeys)
      expect(secondActions.resetState).toBe(firstActions.resetState)
    })
  })

  describe('Complex scenarios', () => {
    it('should handle complete course creation workflow', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      // User starts course creation
      act(() => {
        result.current.actions.setStep('seed')
        result.current.actions.setCourseSeedData(mockCourseSeedData)
        result.current.actions.setUnsavedChanges(true)
      })

      expect(result.current.state.currentStep).toBe('seed')
      expect(result.current.state.courseSeedData).toEqual(mockCourseSeedData)
      expect(result.current.state.hasUnsavedChanges).toBe(true)

      // Move to content generation
      act(() => {
        result.current.actions.setStep('json')
        result.current.actions.setCourseContent(mockCourseContent)
        result.current.actions.showToast({ 
          message: 'Content generated successfully', 
          type: 'success' 
        })
      })

      expect(result.current.state.currentStep).toBe('json')
      expect(result.current.state.courseContent).toEqual(mockCourseContent)
      expect(result.current.state.toast?.type).toBe('success')

      // User saves and resets
      act(() => {
        result.current.actions.setUnsavedChanges(false)
        result.current.actions.showToast({ 
          message: 'Course saved successfully', 
          type: 'success' 
        })
        result.current.actions.resetState()
      })

      expect(result.current.state.courseSeedData).toBeNull()
      expect(result.current.state.courseContent).toBeNull()
      expect(result.current.state.hasUnsavedChanges).toBe(false)
    })

    it('should handle multiple dialogs correctly', () => {
      const { result } = renderHook(() => useAppState(mockApiKeys))

      // Show multiple dialogs
      act(() => {
        result.current.actions.toggleSettings()
        result.current.actions.toggleHelp()
        result.current.actions.showUnsavedDialog(true)
      })

      expect(result.current.state.showSettings).toBe(true)
      expect(result.current.state.showHelp).toBe(true)
      expect(result.current.state.showUnsavedDialog).toBe(true)

      // Close them independently
      act(() => {
        result.current.actions.toggleSettings()
      })

      expect(result.current.state.showSettings).toBe(false)
      expect(result.current.state.showHelp).toBe(true)
      expect(result.current.state.showUnsavedDialog).toBe(true)
    })
  })
})