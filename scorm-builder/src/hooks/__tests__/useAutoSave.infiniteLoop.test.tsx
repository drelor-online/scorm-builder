import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoSave } from '../useAutoSave'
import { useRef, useEffect } from 'react'

describe('useAutoSave - Infinite Loop Bug Reproduction', () => {
  beforeEach(() => {
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('should NOT cause infinite saves when dependencies change but isDirty is false', async () => {
    const mockSave = vi.fn().mockResolvedValue({ success: true })
    const mockOnSaveComplete = vi.fn()
    
    // Simulate the App.tsx pattern where data is created from state, not a ref
    const TestComponent = ({ isDirty, courseSeedData, courseContent, currentStep }: any) => {
      // Create data inline (not using a ref like in the real app)
      const data = isDirty && courseSeedData ? {
        courseTitle: courseSeedData.courseTitle,
        courseSeedData: courseSeedData,
        courseContent: courseContent || undefined,
        currentStep: currentStep,
        lastModified: Date.now(),
        mediaFiles: {},
        audioFiles: {}
      } : null
      
      const autoSaveState = useAutoSave({
        data,
        onSave: mockSave,
        delay: 1000,
        isDirty,
        onSaveComplete: mockOnSaveComplete,
        disabled: false
      })
      
      return autoSaveState
    }

    const initialProps = {
      isDirty: false,
      courseSeedData: { courseTitle: 'Test Course', difficulty: 3, customTopics: [], template: 'None', templateTopics: [] },
      courseContent: { welcomePage: { title: 'Welcome', content: 'Hello' }, learningObjectivesPage: { title: 'Objectives', content: 'Learn' }, topics: [] },
      currentStep: 0
    }

    const { result, rerender } = renderHook(
      (props) => TestComponent(props),
      { initialProps }
    )

    // Clear any initial calls
    mockSave.mockClear()
    mockOnSaveComplete.mockClear()

    // Simulate multiple state changes while isDirty remains false
    // This simulates what happens when a project loads and state gets updated
    for (let i = 1; i <= 3; i++) {
      rerender({
        ...initialProps,
        isDirty: false, // Still false - no user action
        courseContent: { 
          ...initialProps.courseContent, 
          welcomePage: { ...initialProps.courseContent.welcomePage, content: `Auto-updated ${i}` }
        },
        currentStep: i
      })

      await act(async () => {
        vi.advanceTimersByTime(1200) // Wait longer than delay
      })
    }

    // Should NOT have saved anything since isDirty was always false
    expect(mockSave).toHaveBeenCalledTimes(0)
    expect(mockOnSaveComplete).toHaveBeenCalledTimes(0)
    
    // Now simulate a user action - set isDirty to true
    rerender({
      ...initialProps,
      isDirty: true, // User made a change
      courseContent: { 
        ...initialProps.courseContent, 
        welcomePage: { ...initialProps.courseContent.welcomePage, content: 'User changed content' }
      }
    })

    await act(async () => {
      vi.advanceTimersByTime(1200)
    })

    // This SHOULD trigger exactly one save
    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(mockOnSaveComplete).toHaveBeenCalledTimes(1)
  })

  it('should NOT trigger saves when courseContent changes but isDirty remains false', async () => {
    const mockSave = vi.fn().mockResolvedValue({ success: true })
    
    const TestComponent = ({ isDirty, courseContent }: any) => {
      const autoSaveDataRef = useRef<any>(null)
      const courseSeedData = { courseTitle: 'Test', difficulty: 3, customTopics: [], template: 'None', templateTopics: [] }
      
      // Buggy pattern - updates ref when courseContent changes even if isDirty is false
      useEffect(() => {
        if (isDirty && courseSeedData) {
          autoSaveDataRef.current = {
            courseTitle: courseSeedData.courseTitle,
            courseSeedData: courseSeedData,
            courseContent: courseContent || undefined,
            currentStep: 0
          }
        }
      }, [isDirty, courseContent]) // BUG: courseContent in dependencies
      
      return useAutoSave({
        data: autoSaveDataRef.current,
        onSave: mockSave,
        delay: 500,
        isDirty,
        disabled: false
      })
    }

    const { rerender } = renderHook(
      (props) => TestComponent(props),
      { 
        initialProps: { 
          isDirty: false, 
          courseContent: { welcomePage: { title: 'Welcome', content: 'Initial' } } 
        } 
      }
    )

    // Change courseContent multiple times while isDirty stays false
    for (let i = 1; i <= 5; i++) {
      rerender({
        isDirty: false,
        courseContent: { welcomePage: { title: 'Welcome', content: `Updated ${i}` } }
      })
      
      await act(async () => {
        vi.advanceTimersByTime(600) // Wait for potential save
      })
    }

    // Should NOT have saved anything since isDirty was always false
    expect(mockSave).toHaveBeenCalledTimes(0)
  })
})