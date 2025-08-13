import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, render, fireEvent, waitFor } from '@testing-library/react'
import { useAutoSave } from '../useAutoSave'
import { generateNotificationId } from '../../utils/idGenerator'

describe('useAutoSave - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('should not create infinite autosave loop after project loads', async () => {
    const mockSave = vi.fn().mockResolvedValue({ success: true })
    const mockOnSaveComplete = vi.fn()
    
    // Simulate App.tsx autosave pattern
    const TestAutosaveComponent = () => {
      const [courseSeedData, setCourseSeedData] = React.useState(null)
      const [courseContent, setCourseContent] = React.useState(null)
      const [isDirty, setIsDirty] = React.useState(false)
      const autoSaveDataRef = React.useRef(null)
      
      // Simulate the fixed useEffect pattern
      React.useEffect(() => {
        if (courseSeedData) {
          autoSaveDataRef.current = {
            courseTitle: courseSeedData.courseTitle,
            courseSeedData: courseSeedData,
            courseContent: courseContent || undefined,
            currentStep: 0,
            lastModified: Date.now(),
            mediaFiles: {},
            audioFiles: {}
          }
        }
      }, [courseSeedData, courseContent]) // Update ref when data changes
      
      const autoSaveState = useAutoSave({
        data: autoSaveDataRef.current,
        onSave: mockSave,
        delay: 2000,
        isDirty,
        onSaveComplete: () => {
          mockOnSaveComplete()
          setIsDirty(false)
        },
        disabled: false
      })
      
      // Simulate project loading (should NOT trigger autosave)
      React.useEffect(() => {
        // Simulate loading project data from storage
        setTimeout(() => {
          setCourseSeedData({ 
            courseTitle: 'Loaded Course', 
            difficulty: 3, 
            customTopics: [], 
            template: 'None', 
            templateTopics: [] 
          })
          setCourseContent({ 
            welcomePage: { title: 'Welcome', content: 'Loaded content' },
            topics: []
          })
        }, 100)
      }, [])
      
      return (
        <div>
          <button 
            onClick={() => {
              setIsDirty(true) // User action - should trigger save
              setCourseSeedData(prev => prev ? { 
                ...prev, 
                courseTitle: 'User Edited Title' 
              } : null)
            }}
          >
            Edit Title
          </button>
          <div data-testid="save-count">{mockSave.mock.calls.length}</div>
          <div data-testid="is-saving">{autoSaveState.isSaving ? 'saving' : 'idle'}</div>
        </div>
      )
    }

    const { getByTestId, getByText } = render(<TestAutosaveComponent />)

    // Wait for project to load
    await act(async () => {
      vi.advanceTimersByTime(200)
    })

    // Clear any setup calls
    mockSave.mockClear()
    mockOnSaveComplete.mockClear()

    // Wait 10 seconds after loading - should NOT trigger any saves
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    expect(mockSave).toHaveBeenCalledTimes(0)
    expect(getByTestId('save-count')).toHaveTextContent('0')

    // Now simulate user action
    fireEvent.click(getByText('Edit Title'))

    // Wait for autosave delay
    await act(async () => {
      vi.advanceTimersByTime(2500)
    })

    // Should have saved exactly once
    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(mockOnSaveComplete).toHaveBeenCalledTimes(1)
    expect(getByTestId('save-count')).toHaveTextContent('1')

    // Wait another 10 seconds without changes - should NOT save again
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    expect(mockSave).toHaveBeenCalledTimes(1) // Still only one save
  })

  it('should generate unique notification IDs even when created rapidly', () => {
    const ids = new Set()
    
    // Generate 1000 notification IDs rapidly
    for (let i = 0; i < 1000; i++) {
      const id = generateNotificationId()
      expect(ids.has(id)).toBe(false) // Should not have duplicates
      ids.add(id)
    }
    
    expect(ids.size).toBe(1000) // All IDs should be unique
  })

  it('should handle rapid user edits with proper debouncing', async () => {
    const mockSave = vi.fn().mockResolvedValue({ success: true })
    const mockOnSaveComplete = vi.fn()
    
    let isDirty = false
    let data = { title: 'Initial' }
    
    const { rerender } = renderHook(
      ({ isDirty, data }) => useAutoSave({
        data,
        onSave: mockSave,
        delay: 2000,
        isDirty,
        onSaveComplete: mockOnSaveComplete,
        minSaveInterval: 5000 // 5 second minimum between saves
      }),
      { initialProps: { isDirty, data } }
    )

    // Simulate rapid user edits
    for (let i = 1; i <= 5; i++) {
      rerender({ 
        isDirty: true, 
        data: { title: `Edit ${i}` }
      })
      
      // Small delay between edits
      await act(async () => {
        vi.advanceTimersByTime(500)
      })
    }

    // Wait for debounce to complete
    await act(async () => {
      vi.advanceTimersByTime(2500)
    })

    // Should have saved once with the latest data
    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(mockSave).toHaveBeenCalledWith({ title: 'Edit 5' })
    expect(mockOnSaveComplete).toHaveBeenCalledTimes(1)

    // Try to trigger another save quickly - should be debounced
    mockSave.mockClear()
    mockOnSaveComplete.mockClear()
    
    rerender({ 
      isDirty: true, 
      data: { title: 'Edit 6' }
    })

    await act(async () => {
      vi.advanceTimersByTime(2500)
    })

    // Should be debounced due to minSaveInterval
    expect(mockSave).toHaveBeenCalledTimes(0)
  })

  it('should not save when data changes but isDirty is false', async () => {
    const mockSave = vi.fn().mockResolvedValue({ success: true })
    
    const { rerender } = renderHook(
      ({ isDirty, data }) => useAutoSave({
        data,
        onSave: mockSave,
        delay: 1000,
        isDirty,
        disabled: false
      }),
      { 
        initialProps: { 
          isDirty: false, 
          data: { title: 'Initial' } 
        } 
      }
    )

    // Change data multiple times without setting isDirty
    for (let i = 1; i <= 10; i++) {
      rerender({ 
        isDirty: false, // Key: isDirty stays false
        data: { title: `Auto Update ${i}` }
      })
      
      await act(async () => {
        vi.advanceTimersByTime(1200)
      })
    }

    // Should never have saved since isDirty was always false
    expect(mockSave).toHaveBeenCalledTimes(0)
  })
})