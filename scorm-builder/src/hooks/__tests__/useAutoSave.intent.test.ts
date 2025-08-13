import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoSave } from '../useAutoSave'

describe('useAutoSave - User Intent Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('User wants automatic saving of their work', () => {
    it('should save automatically after specified delay', async () => {
      const mockOnSave = vi.fn().mockResolvedValue({ success: true })
      const testData = { title: 'Test Course', content: 'Initial content' }

      const { result, rerender } = renderHook(
        ({ data, isDirty }) => useAutoSave({ data, onSave: mockOnSave, delay: 1000, isDirty }),
        { initialProps: { data: testData, isDirty: false } }
      )

      // Initially not saving
      expect(result.current.isSaving).toBe(false)
      expect(mockOnSave).not.toHaveBeenCalled()

      // Update data and mark as dirty (user action)
      const updatedData = { title: 'Test Course', content: 'Updated content' }
      rerender({ data: updatedData, isDirty: true })

      // Should not save immediately
      expect(mockOnSave).not.toHaveBeenCalled()

      // Fast forward past delay
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      // Should trigger save
      expect(mockOnSave).toHaveBeenCalledWith(updatedData)
    })

    it('should debounce rapid changes', async () => {
      const mockOnSave = vi.fn().mockResolvedValue({ success: true })
      const mockOnSaveComplete = vi.fn()
      const testData = { title: 'Test', content: 'Initial' }

      const { rerender } = renderHook(
        ({ data, isDirty }) => useAutoSave({ 
          data, 
          onSave: mockOnSave, 
          delay: 1000, 
          isDirty,
          onSaveComplete: mockOnSaveComplete
        }),
        { initialProps: { data: testData, isDirty: false } }
      )

      // Mark as dirty and make rapid changes
      rerender({ data: { title: 'Test', content: 'Update 1' }, isDirty: true })
      vi.advanceTimersByTime(500)
      
      rerender({ data: { title: 'Test', content: 'Update 2' }, isDirty: true })
      vi.advanceTimersByTime(500)
      
      rerender({ data: { title: 'Test', content: 'Update 3' }, isDirty: true })
      
      // Should not have saved yet
      expect(mockOnSave).not.toHaveBeenCalled()

      // Complete the delay
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      // Should save only once with latest data
      expect(mockOnSave).toHaveBeenCalledTimes(1)
      expect(mockOnSave).toHaveBeenCalledWith({ title: 'Test', content: 'Update 3' })
    })

    it('should not autosave when disabled', () => {
      const mockOnSave = vi.fn()
      const testData = { title: 'Test', content: 'Content' }

      const { rerender } = renderHook(
        ({ data }) => useAutoSave({ data, onSave: mockOnSave, delay: 1000, disabled: true }),
        { initialProps: { data: testData } }
      )

      // Update data
      rerender({ data: { title: 'Test', content: 'Updated' } })

      // Fast forward
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      // Should not save when disabled
      expect(mockOnSave).not.toHaveBeenCalled()
    })
  })

  describe('User wants to force save immediately', () => {
    it('should save immediately when forceSave is called', async () => {
      const mockOnSave = vi.fn().mockResolvedValue({ success: true })
      const testData = { title: 'Test', content: 'Content' }

      const { result } = renderHook(() => 
        useAutoSave({ data: testData, onSave: mockOnSave, delay: 5000 })
      )

      // Force save without waiting
      await act(async () => {
        await result.current.forceSave()
      })

      expect(mockOnSave).toHaveBeenCalledWith(testData)
    })

    it('should cancel pending autosave when force saving', async () => {
      const mockOnSave = vi.fn().mockResolvedValue({ success: true })
      const testData = { title: 'Test', content: 'Initial' }

      const { result, rerender } = renderHook(
        ({ data }) => useAutoSave({ data, onSave: mockOnSave, delay: 2000 }),
        { initialProps: { data: testData } }
      )

      // Update data to trigger autosave
      rerender({ data: { title: 'Test', content: 'Updated' } })

      // Advance time partially
      vi.advanceTimersByTime(1000)

      // Force save
      await act(async () => {
        await result.current.forceSave()
      })

      // Should save immediately
      expect(mockOnSave).toHaveBeenCalledTimes(1)

      // Complete original timer
      vi.advanceTimersByTime(1000)

      // Should not save again
      expect(mockOnSave).toHaveBeenCalledTimes(1)
    })
  })

  describe('User wants to know save status', () => {
    it('should indicate when saving is in progress', async () => {
      vi.useRealTimers() // Use real timers for async operations
      const mockOnSave = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      )
      const testData = { title: 'Test', content: 'Content' }

      const { result } = renderHook(() => 
        useAutoSave({ data: testData, onSave: mockOnSave, delay: 1000 })
      )

      // Initially not saving
      expect(result.current.isSaving).toBe(false)

      // Force save
      let savePromise: Promise<any>
      act(() => {
        savePromise = result.current.forceSave()
      })

      // Should be saving
      expect(result.current.isSaving).toBe(true)

      // Wait for save to complete
      await act(async () => {
        await savePromise
      })

      // Should no longer be saving
      expect(result.current.isSaving).toBe(false)
    })

    it('should track time since last save', async () => {
      vi.useRealTimers() // Use real timers for async operations
      const mockOnSave = vi.fn().mockResolvedValue({ success: true })
      const testData = { title: 'Test', content: 'Content' }

      const { result } = renderHook(() => 
        useAutoSave({ data: testData, onSave: mockOnSave, delay: 1000 })
      )

      // Initially no last save time
      expect(result.current.lastSaved).toBeNull()

      // Force save
      await act(async () => {
        await result.current.forceSave()
      })

      // Should have last saved time
      expect(result.current.lastSaved).toBeInstanceOf(Date)
    })
  })

  describe('User wants error handling', () => {
    it('should handle save errors gracefully', async () => {
      vi.useRealTimers() // Use real timers for async operations
      const mockOnError = vi.fn()
      const mockOnSave = vi.fn().mockRejectedValue(new Error('Save failed'))
      const testData = { title: 'Test', content: 'Content' }

      const { result } = renderHook(() => 
        useAutoSave({ data: testData, onSave: mockOnSave, onError: mockOnError, delay: 1000 })
      )

      // Force save that will fail
      await act(async () => {
        await result.current.forceSave()
      })

      // Should have called error handler
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error))
      // Should no longer be saving after error
      expect(result.current.isSaving).toBe(false)
    })

    it('should retry after errors', async () => {
      const mockOnError = vi.fn()
      const mockOnSave = vi.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValue({ success: true })
      
      const testData = { title: 'Test', content: 'Content' }

      const { result, rerender } = renderHook(
        ({ data }) => useAutoSave({ data, onSave: mockOnSave, onError: mockOnError, delay: 1000 }),
        { initialProps: { data: testData } }
      )

      // First save will fail (using force save with real timers)
      vi.useRealTimers()
      await act(async () => {
        await result.current.forceSave()
      })

      expect(mockOnSave).toHaveBeenCalledTimes(1)
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error))

      // Reset to fake timers for auto-save test
      vi.useFakeTimers()
      
      // Update data to trigger another save
      rerender({ data: { title: 'Test', content: 'Updated' } })

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Should retry and succeed
      expect(mockOnSave).toHaveBeenCalledTimes(2)
    })
  })
})