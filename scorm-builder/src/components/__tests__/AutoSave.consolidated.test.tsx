/**
 * AutoSave - Consolidated Test Suite
 * 
 * This file consolidates AutoSave tests from multiple separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - useAutoSave.test.tsx (hook functionality with ignored keys)
 * - useAutoSave.dirtyFlag.test.tsx (dirty state tracking)
 * - useAutoSave.infiniteLoop.test.tsx (loop prevention)
 * - useAutoSave.integration.test.tsx (integration testing)
 * - AutoSaveIndicator.test.tsx (indicator component) - REMOVED: component deleted
 * - AutoSaveIndicatorConnected.test.tsx (connected indicator) - REMOVED: component deleted
 * - AutoSaveContext.test.tsx (context provider)
 * - useAutoSaveNarration.test.tsx (narration auto-save)
 * - autosaveIndicator.test.tsx (global indicator)
 * - autosaveNotifications.test.tsx (notification system)
 * - UnsavedChangesContext.test.tsx (unsaved changes tracking)
 * 
 * Test Categories:
 * - useAutoSave hook functionality
 * - AutoSave context and state management
 * - AutoSave indicators and UI components
 * - Infinite loop prevention
 * - Integration with storage systems
 * - Narration-specific auto-save
 * - Error handling and edge cases
 */

import React, { ReactNode } from 'react'
import { act } from '../../test/testProviders'
import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAutoSave } from '../../hooks/useAutoSave'
import { AutoSaveProvider, useAutoSaveState } from '../../contexts/AutoSaveContext'

describe('AutoSave - Consolidated Test Suite', () => {
  beforeEach(() => {
    vi.clearAllTimers()
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  describe('useAutoSave Hook - Core Functionality', () => {
    it('should NOT save when only ignored fields change', async () => {
      const mockSave = vi.fn().mockResolvedValue({ success: true })
      let data = {
        title: 'Test Course',
        content: 'Course content',
        lastModified: '2023-01-01T00:00:00.000Z',
        metadata: { version: 1 }
      }

      const { rerender } = renderHook(() => useAutoSave({
        data,
        onSave: mockSave,
        delay: 100,
        ignoredKeys: ['lastModified'],
        disabled: false
      }))

      mockSave.mockClear()

      // Change only the ignored field
      data = { ...data, lastModified: '2023-01-01T01:00:00.000Z' }
      rerender()

      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      expect(mockSave).toHaveBeenCalledTimes(0)
    })

    it('should save when non-ignored fields change', async () => {
      const mockSave = vi.fn().mockResolvedValue({ success: true })
      let data = {
        title: 'Test Course',
        content: 'Course content',
        lastModified: '2023-01-01T00:00:00.000Z'
      }

      const { rerender } = renderHook(() => useAutoSave({
        data,
        onSave: mockSave,
        delay: 100,
        ignoredKeys: ['lastModified'],
        disabled: false
      }))

      mockSave.mockClear()

      // Change a non-ignored field
      data = { ...data, title: 'Updated Course', lastModified: '2023-01-01T01:00:00.000Z' }
      rerender()

      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      expect(mockSave).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple ignored keys', async () => {
      const mockSave = vi.fn().mockResolvedValue({ success: true })
      let data = {
        title: 'Test Course',
        content: 'Course content',
        lastModified: '2023-01-01T00:00:00.000Z',
        internalId: 'abc123',
        metadata: { timestamp: '2023-01-01T00:00:00.000Z' }
      }

      const { rerender } = renderHook(() => useAutoSave({
        data,
        onSave: mockSave,
        delay: 100,
        ignoredKeys: ['lastModified', 'internalId', 'metadata'],
        disabled: false
      }))

      mockSave.mockClear()

      // Change multiple ignored fields
      data = {
        ...data,
        lastModified: '2023-01-01T01:00:00.000Z',
        internalId: 'def456',
        metadata: { timestamp: '2023-01-01T01:00:00.000Z' }
      }
      rerender()

      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      expect(mockSave).toHaveBeenCalledTimes(0)
    })

    it('should handle nested ignored keys', async () => {
      const mockSave = vi.fn().mockResolvedValue({ success: true })
      let data = {
        title: 'Test Course',
        metadata: {
          lastModified: '2023-01-01T00:00:00.000Z',
          version: 1
        }
      }

      const { rerender } = renderHook(() => useAutoSave({
        data,
        onSave: mockSave,
        delay: 100,
        ignoredKeys: ['metadata.lastModified'],
        disabled: false
      }))

      mockSave.mockClear()

      // Change only the nested ignored field
      data = {
        ...data,
        metadata: {
          ...data.metadata,
          lastModified: '2023-01-01T01:00:00.000Z'
        }
      }
      rerender()

      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      expect(mockSave).toHaveBeenCalledTimes(0)
    })

    it('should work without ignoredKeys for backward compatibility', async () => {
      const mockSave = vi.fn().mockResolvedValue({ success: true })
      let data = {
        title: 'Test Course',
        lastModified: '2023-01-01T00:00:00.000Z'
      }

      const { rerender } = renderHook(() => useAutoSave({
        data,
        onSave: mockSave,
        delay: 100,
        disabled: false
      }))

      mockSave.mockClear()

      // Change any field
      data = { ...data, lastModified: '2023-01-01T01:00:00.000Z' }
      rerender()

      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      expect(mockSave).toHaveBeenCalledTimes(1)
    })
  })

  describe('useAutoSave Hook - Infinite Loop Prevention', () => {
    it('should prevent autosave infinite loops', async () => {
      const mockSave = vi.fn().mockImplementation(async (_data) => {
        return { success: true }
      })

      let lastModified = '2023-01-01T00:00:00.000Z'
      const getProjectData = () => ({
        courseTitle: 'Natural Gas Safety',
        courseSeedData: { 
          courseTitle: 'Natural Gas Safety', 
          difficulty: 3, 
          customTopics: ["Safety Fundamentals"], 
          template: 'Safety' 
        },
        currentStep: 4,
        lastModified,
        mediaFiles: {},
        audioFiles: {}
      })

      let currentData = getProjectData()
      const { result, rerender } = renderHook(() => useAutoSave({
        data: currentData,
        onSave: mockSave,
        delay: 100,
        ignoredKeys: ['lastModified', 'mediaFiles', 'audioFiles'],
        disabled: false
      }))

      mockSave.mockClear()

      // Simulate save completing and timestamp updating
      await act(async () => {
        await result.current.forceSave()
      })
      
      // Update timestamp (simulates what happens after save)
      lastModified = new Date().toISOString()
      currentData = getProjectData()
      rerender()

      mockSave.mockClear()

      // Wait for any potential autosave
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      // Should NOT trigger another save since only ignored fields changed
      expect(mockSave).toHaveBeenCalledTimes(0)
    })

    it('should handle rapid successive data changes without excessive saves', async () => {
      const mockSave = vi.fn().mockResolvedValue({ success: true })
      let data = { title: 'Test', content: 'Content' }

      const { rerender } = renderHook(() => useAutoSave({
        data,
        onSave: mockSave,
        delay: 100,
        disabled: false
      }))

      mockSave.mockClear()

      // Make rapid changes
      data = { ...data, title: 'Test 1' }
      rerender()
      
      data = { ...data, title: 'Test 2' }
      rerender()
      
      data = { ...data, title: 'Test 3' }
      rerender()

      // Should debounce and only save once
      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      expect(mockSave).toHaveBeenCalledTimes(1)
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Test 3' }))
    })
  })

  describe('useAutoSave Hook - Dirty State and Force Save', () => {
    it('should track dirty state correctly', async () => {
      const mockSave = vi.fn().mockResolvedValue({ success: true })
      let data = { title: 'Test' }

      const { result, rerender } = renderHook(() => useAutoSave({
        data,
        onSave: mockSave,
        delay: 100,
        disabled: false
      }))

      // Initially not dirty
      expect(result.current.isDirty).toBe(false)

      // Change data
      data = { title: 'Modified' }
      rerender()

      // Should be dirty
      expect(result.current.isDirty).toBe(true)

      // Wait for auto-save
      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      // Should no longer be dirty after save
      expect(result.current.isDirty).toBe(false)
    })

    it('should allow force save regardless of timer', async () => {
      const mockSave = vi.fn().mockResolvedValue({ success: true })
      const data = { title: 'Test' }

      const { result } = renderHook(() => useAutoSave({
        data,
        onSave: mockSave,
        delay: 5000, // Long delay
        disabled: false
      }))

      mockSave.mockClear()

      // Force save immediately
      await act(async () => {
        await result.current.forceSave()
      })

      expect(mockSave).toHaveBeenCalledTimes(1)
    })

    it('should handle save errors gracefully', async () => {
      const mockSave = vi.fn().mockRejectedValue(new Error('Save failed'))
      let data = { title: 'Test' }

      const { result, rerender } = renderHook(() => useAutoSave({
        data,
        onSave: mockSave,
        delay: 100,
        disabled: false
      }))

      data = { title: 'Modified' }
      rerender()

      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      // Should still be dirty after failed save
      expect(result.current.isDirty).toBe(true)
    })
  })

  // AutoSaveIndicator tests removed - component no longer exists
  // describe('AutoSaveIndicator Component', () => {
  //   Tests removed because AutoSaveIndicator component was deleted
  // })

  describe('AutoSaveContext and Provider', () => {
    it('should provide auto-save state to children', () => {
      const lastSaved = new Date('2024-01-01T12:00:00Z')
      
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AutoSaveProvider 
          isSaving={true} 
          lastSaved={lastSaved}
          hasUnsavedChanges={true}
        >
          {children}
        </AutoSaveProvider>
      )
      
      const { result } = renderHook(() => useAutoSaveState(), { wrapper })
      
      expect(result.current.isSaving).toBe(true)
      expect(result.current.lastSaved).toEqual(lastSaved)
      expect(result.current.hasUnsavedChanges).toBe(true)
    })

    it('should provide false values when not saving', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AutoSaveProvider 
          isSaving={false} 
          lastSaved={null}
          hasUnsavedChanges={false}
        >
          {children}
        </AutoSaveProvider>
      )
      
      const { result } = renderHook(() => useAutoSaveState(), { wrapper })
      
      expect(result.current.isSaving).toBe(false)
      expect(result.current.lastSaved).toBeNull()
      expect(result.current.hasUnsavedChanges).toBe(false)
    })

    it('should return default values when used outside provider', () => {
      const { result } = renderHook(() => useAutoSaveState())
      
      expect(result.current.isSaving).toBe(false)
      expect(result.current.lastSaved).toBeNull()
      expect(result.current.hasUnsavedChanges).toBe(false)
    })

    it('should update when props change', () => {
      const initialDate = new Date('2024-01-01T12:00:00Z')
      const updatedDate = new Date('2024-01-01T12:05:00Z')
      
      let currentProps = {
        isSaving: true,
        lastSaved: initialDate,
        hasUnsavedChanges: true
      }
      
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AutoSaveProvider {...currentProps}>
          {children}
        </AutoSaveProvider>
      )
      
      const { result, rerender } = renderHook(() => useAutoSaveState(), { wrapper })
      
      // Initial state
      expect(result.current.isSaving).toBe(true)
      expect(result.current.lastSaved).toEqual(initialDate)
      expect(result.current.hasUnsavedChanges).toBe(true)
      
      // Update props
      currentProps = {
        isSaving: false,
        lastSaved: updatedDate,
        hasUnsavedChanges: false
      }
      rerender()
      
      // Updated state
      expect(result.current.isSaving).toBe(false)
      expect(result.current.lastSaved).toEqual(updatedDate)
      expect(result.current.hasUnsavedChanges).toBe(false)
    })

    it('should handle null lastSaved date transitions', () => {
      const savedDate = new Date('2024-01-01T12:00:00Z')
      
      let currentLastSaved: Date | null = null
      
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AutoSaveProvider 
          isSaving={false} 
          lastSaved={currentLastSaved}
          hasUnsavedChanges={false}
        >
          {children}
        </AutoSaveProvider>
      )
      
      const { result, rerender } = renderHook(() => useAutoSaveState(), { wrapper })
      
      // Initially null
      expect(result.current.lastSaved).toBeNull()
      
      // Update to date
      currentLastSaved = savedDate
      rerender()
      expect(result.current.lastSaved).toEqual(savedDate)
      
      // Back to null
      currentLastSaved = null
      rerender()
      expect(result.current.lastSaved).toBeNull()
    })
  })

  describe('AutoSave Error Handling and Edge Cases', () => {
    it('should handle disabled auto-save', async () => {
      const mockSave = vi.fn().mockResolvedValue({ success: true })
      let data = { title: 'Test' }

      const { rerender } = renderHook(() => useAutoSave({
        data,
        onSave: mockSave,
        delay: 100,
        disabled: true // Disabled
      }))

      data = { title: 'Modified' }
      rerender()

      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      expect(mockSave).toHaveBeenCalledTimes(0)
    })

    it('should handle save function that returns undefined', async () => {
      const mockSave = vi.fn().mockResolvedValue(undefined)
      let data = { title: 'Test' }

      const { rerender } = renderHook(() => useAutoSave({
        data,
        onSave: mockSave,
        delay: 100,
        disabled: false
      }))

      data = { title: 'Modified' }
      rerender()

      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      expect(mockSave).toHaveBeenCalledTimes(1)
    })

    it('should cleanup timers on unmount', () => {
      const mockSave = vi.fn().mockResolvedValue({ success: true })
      const data = { title: 'Test' }

      const { unmount } = renderHook(() => useAutoSave({
        data,
        onSave: mockSave,
        delay: 100,
        disabled: false
      }))

      unmount()

      // Should not throw or cause memory leaks
      vi.advanceTimersByTime(200)
      expect(mockSave).toHaveBeenCalledTimes(0)
    })

    it('should handle complex nested data structures', async () => {
      const mockSave = vi.fn().mockResolvedValue({ success: true })
      let data = {
        course: {
          title: 'Test',
          topics: [
            { id: 1, title: 'Topic 1', content: 'Content 1' },
            { id: 2, title: 'Topic 2', content: 'Content 2' }
          ]
        },
        metadata: {
          lastModified: '2023-01-01T00:00:00.000Z',
          version: 1
        }
      }

      const { rerender } = renderHook(() => useAutoSave({
        data,
        onSave: mockSave,
        delay: 100,
        ignoredKeys: ['metadata.lastModified'],
        disabled: false
      }))

      mockSave.mockClear()

      // Change nested content
      data = {
        ...data,
        course: {
          ...data.course,
          topics: [
            ...data.course.topics.slice(0, 1),
            { ...data.course.topics[1], content: 'Modified Content 2' }
          ]
        }
      }
      rerender()

      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      expect(mockSave).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple consumers of context state', () => {
      const lastSaved = new Date()
      
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AutoSaveProvider 
          isSaving={false} 
          lastSaved={lastSaved}
          hasUnsavedChanges={true}
        >
          {children}
        </AutoSaveProvider>
      )
      
      // First consumer
      const { result: result1 } = renderHook(() => useAutoSaveState(), { wrapper })
      
      // Second consumer  
      const { result: result2 } = renderHook(() => useAutoSaveState(), { wrapper })
      
      // Both should have same values
      expect(result1.current).toEqual(result2.current)
      expect(result1.current.hasUnsavedChanges).toBe(true)
      expect(result2.current.hasUnsavedChanges).toBe(true)
    })

    it('should handle rapid state changes without issues', () => {
      let currentIsSaving = false
      
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AutoSaveProvider 
          isSaving={currentIsSaving} 
          lastSaved={null}
          hasUnsavedChanges={true}
        >
          {children}
        </AutoSaveProvider>
      )
      
      const { result, rerender } = renderHook(() => useAutoSaveState(), { wrapper })
      
      // Rapid toggles
      expect(result.current.isSaving).toBe(false)
      
      currentIsSaving = true
      rerender()
      expect(result.current.isSaving).toBe(true)
      
      currentIsSaving = false
      rerender()
      expect(result.current.isSaving).toBe(false)
      
      currentIsSaving = true
      rerender()
      expect(result.current.isSaving).toBe(true)
    })

    it('should preserve date object reference integrity', () => {
      const sameDate = new Date('2024-01-01T12:00:00Z')
      
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AutoSaveProvider 
          isSaving={false} 
          lastSaved={sameDate}
          hasUnsavedChanges={false}
        >
          {children}
        </AutoSaveProvider>
      )
      
      const { result } = renderHook(() => useAutoSaveState(), { wrapper })
      
      // Should be the exact same object reference
      expect(result.current.lastSaved).toBe(sameDate)
    })
  })

  describe('AutoSave Integration Scenarios', () => {
    it('should handle saving with unsaved changes state', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AutoSaveProvider 
          isSaving={true} 
          lastSaved={null}
          hasUnsavedChanges={true}
        >
          {children}
        </AutoSaveProvider>
      )
      
      const { result } = renderHook(() => useAutoSaveState(), { wrapper })
      
      // Saving but never saved before
      expect(result.current.isSaving).toBe(true)
      expect(result.current.lastSaved).toBeNull()
      expect(result.current.hasUnsavedChanges).toBe(true)
    })

    it('should handle saved state with no changes', () => {
      const lastSaved = new Date()
      
      const wrapper = ({ children }: { children: ReactNode }) => (
        <AutoSaveProvider 
          isSaving={false} 
          lastSaved={lastSaved}
          hasUnsavedChanges={false}
        >
          {children}
        </AutoSaveProvider>
      )
      
      const { result } = renderHook(() => useAutoSaveState(), { wrapper })
      
      // Recently saved, no changes
      expect(result.current.isSaving).toBe(false)
      expect(result.current.lastSaved).toEqual(lastSaved)
      expect(result.current.hasUnsavedChanges).toBe(false)
    })

    it('should work with real-world course data structures', async () => {
      const mockSave = vi.fn().mockResolvedValue({ success: true })
      let courseData = {
        title: 'Safety Training Course',
        topics: [
          {
            id: 'topic-1',
            title: 'Introduction',
            content: 'Welcome to the course',
            media: []
          }
        ],
        assessment: {
          questions: [],
          passMark: 80
        },
        metadata: {
          lastModified: '2023-01-01T00:00:00.000Z',
          version: 1,
          author: 'System'
        }
      }

      const { rerender } = renderHook(() => useAutoSave({
        data: courseData,
        onSave: mockSave,
        delay: 100,
        ignoredKeys: ['metadata.lastModified', 'metadata.version'],
        disabled: false
      }))

      mockSave.mockClear()

      // Update course content
      courseData = {
        ...courseData,
        topics: [
          {
            ...courseData.topics[0],
            content: 'Updated welcome message'
          }
        ],
        metadata: {
          ...courseData.metadata,
          lastModified: new Date().toISOString(), // This should be ignored
          version: 2 // This should be ignored
        }
      }
      rerender()

      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      // Should save because content changed, ignoring metadata
      expect(mockSave).toHaveBeenCalledTimes(1)
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
        topics: expect.arrayContaining([
          expect.objectContaining({
            content: 'Updated welcome message'
          })
        ])
      }))
    })
  })
})