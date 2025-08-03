import { renderHook , waitFor } from '@testing-library/react'
import { describe, it, expect, act, vi, beforeEach, afterEach } from 'vitest'
import { useAutoSave } from '../useAutoSave'

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not save when data has not changed', () => {
    const mockSave = vi.fn()
    const data = { title: 'Test' }
    
    renderHook(() => useAutoSave({
      data,
      onSave: mockSave,
      delay: 1000
    }))
    
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('should save after delay when data changes', () => {
    const mockSave = vi.fn().mockResolvedValue({ success: true })
    let data = { title: 'Test' }
    
    const { rerender } = renderHook(
      (props) => useAutoSave(props),
      {
        initialProps: {
          data,
          onSave: mockSave,
          delay: 1000
        }
      }
    )
    
    // Change data
    data = { title: 'Test Updated' }
    rerender({ data, onSave: mockSave, delay: 1000 })
    
    // Should not save immediately
    expect(mockSave).not.toHaveBeenCalled()
    
    // Should save after delay
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    
    expect(mockSave).toHaveBeenCalledWith({ title: 'Test Updated' })
  })

  it('should debounce saves', () => {
    const mockSave = vi.fn().mockResolvedValue({ success: true })
    let data = { title: 'Test' }
    
    const { rerender } = renderHook(
      (props) => useAutoSave(props),
      {
        initialProps: {
          data,
          onSave: mockSave,
          delay: 1000
        }
      }
    )
    
    // Multiple rapid changes
    data = { title: 'Test 1' }
    rerender({ data, onSave: mockSave, delay: 1000 })
    
    act(() => {
      vi.advanceTimersByTime(500)
    })
    
    data = { title: 'Test 2' }
    rerender({ data, onSave: mockSave, delay: 1000 })
    
    act(() => {
      vi.advanceTimersByTime(500)
    })
    
    data = { title: 'Test 3' }
    rerender({ data, onSave: mockSave, delay: 1000 })
    
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    
    // Should only save once with the latest data
    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(mockSave).toHaveBeenCalledWith({ title: 'Test 3' })
  })

  it('should handle save errors', async () => {
    const mockSave = vi.fn().mockRejectedValue(new Error('Save failed'))
    const mockOnError = vi.fn()
    let data = { title: 'Test' }
    
    const { rerender } = renderHook(
      (props) => useAutoSave(props),
      {
        initialProps: {
          data,
          onSave: mockSave,
          delay: 1000,
          onError: mockOnError
        }
      }
    )
    
    data = { title: 'Test Updated' }
    rerender({ data, onSave: mockSave, delay: 1000, onError: mockOnError })
    
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    
    // Wait for async operations
    await vi.waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(new Error('Save failed'))
    })
  })

  it('should provide saving state', () => {
    const mockSave = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ success: true }), 500))
    )
    let data = { title: 'Test' }
    
    const { result, rerender } = renderHook(
      (props) => useAutoSave(props),
      {
        initialProps: {
          data,
          onSave: mockSave,
          delay: 1000
        }
      }
    )
    
    expect(result.current.isSaving).toBe(false)
    
    data = { title: 'Test Updated' }
    rerender({ data, onSave: mockSave, delay: 1000 })
    
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    
    expect(result.current.isSaving).toBe(true)
  })

  it('should provide last saved timestamp', async () => {
    const mockSave = vi.fn().mockResolvedValue({ success: true })
    let data = { title: 'Test' }
    
    const { result, rerender } = renderHook(
      (props) => useAutoSave(props),
      {
        initialProps: {
          data,
          onSave: mockSave,
          delay: 1000
        }
      }
    )
    
    expect(result.current.lastSaved).toBeNull()
    
    data = { title: 'Test Updated' }
    rerender({ data, onSave: mockSave, delay: 1000 })
    
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    
    await vi.waitFor(() => {
      expect(result.current.lastSaved).toBeInstanceOf(Date)
    })
  })

  it('should handle conflict resolution', async () => {
    const mockSave = vi.fn().mockRejectedValue({ 
      type: 'CONFLICT',
      serverData: { title: 'Server Version' }
    })
    const mockOnConflict = vi.fn()
    let data = { title: 'Test' }
    
    const { rerender } = renderHook(
      (props) => useAutoSave(props),
      {
        initialProps: {
          data,
          onSave: mockSave,
          delay: 1000,
          onConflict: mockOnConflict
        }
      }
    )
    
    data = { title: 'Local Version' }
    rerender({ 
      data, 
      onSave: mockSave, 
      delay: 1000, 
      onConflict: mockOnConflict 
    })
    
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    
    await vi.waitFor(() => {
      expect(mockOnConflict).toHaveBeenCalledWith({
        localData: { title: 'Local Version' },
        serverData: { title: 'Server Version' }
      })
    })
  })

  it('should disable auto-save when disabled prop is true', () => {
    const mockSave = vi.fn()
    let data = { title: 'Test' }
    
    const { rerender } = renderHook(
      (props) => useAutoSave(props),
      {
        initialProps: {
          data,
          onSave: mockSave,
          delay: 1000,
          disabled: true
        }
      }
    )
    
    data = { title: 'Test Updated' }
    rerender({ data, onSave: mockSave, delay: 1000, disabled: true })
    
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('should force save immediately', async () => {
    const mockSave = vi.fn().mockResolvedValue({ success: true })
    const data = { title: 'Test' }
    
    const { result } = renderHook(() => useAutoSave({
      data,
      onSave: mockSave,
      delay: 1000
    }))
    
    await act(async () => {
      await result.current.forceSave()
    })
    
    expect(mockSave).toHaveBeenCalledWith({ title: 'Test' })
  })

  it('should cancel pending save on unmount', () => {
    const mockSave = vi.fn()
    let data = { title: 'Test' }
    
    const { rerender, unmount } = renderHook(
      (props) => useAutoSave(props),
      {
        initialProps: {
          data,
          onSave: mockSave,
          delay: 1000
        }
      }
    )
    
    data = { title: 'Test Updated' }
    rerender({ data, onSave: mockSave, delay: 1000 })
    
    // Unmount before save completes
    unmount()
    
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    
    expect(mockSave).not.toHaveBeenCalled()
  })
})