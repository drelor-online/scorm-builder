import { describe, it, expect, act, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useConfirmDialog } from '../useConfirmDialog'

describe('useConfirmDialog - Simple Tests', () => {
  let confirmSpy: any

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm')
    vi.useFakeTimers()
  })

  afterEach(() => {
    confirmSpy.mockRestore()
    vi.useRealTimers()
  })

  it('should return confirm function and isPending state', () => {
    const { result } = renderHook(() => useConfirmDialog())
    
    expect(result.current).toHaveProperty('confirm')
    expect(result.current).toHaveProperty('isPending')
    expect(typeof result.current.confirm).toBe('function')
    expect(result.current.isPending).toBe(false)
  })

  it('should call onConfirm when user confirms', () => {
    confirmSpy.mockReturnValue(true)
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    
    const { result } = renderHook(() => useConfirmDialog())
    
    act(() => {
      result.current.confirm({
        message: 'Are you sure?',
        onConfirm,
        onCancel
      })
    })

    // Should be pending immediately
    expect(result.current.isPending).toBe(true)

    // Fast forward timer
    act(() => {
      vi.runAllTimers()
    })

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure?')
    expect(onConfirm).toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    expect(result.current.isPending).toBe(false)
  })

  it('should call onCancel when user cancels', () => {
    confirmSpy.mockReturnValue(false)
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    
    const { result } = renderHook(() => useConfirmDialog())
    
    act(() => {
      result.current.confirm({
        message: 'Are you sure?',
        onConfirm,
        onCancel
      })
    })

    act(() => {
      vi.runAllTimers()
    })

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure?')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
    expect(result.current.isPending).toBe(false)
  })

  it('should handle missing onCancel callback', () => {
    confirmSpy.mockReturnValue(false)
    const onConfirm = vi.fn()
    
    const { result } = renderHook(() => useConfirmDialog())
    
    act(() => {
      result.current.confirm({
        message: 'Are you sure?',
        onConfirm
      })
    })

    act(() => {
      vi.runAllTimers()
    })

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure?')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(result.current.isPending).toBe(false)
  })

  it('should handle multiple confirmations', () => {
    confirmSpy.mockReturnValue(true)
    const firstOnConfirm = vi.fn()
    const secondOnConfirm = vi.fn()
    
    const { result } = renderHook(() => useConfirmDialog())
    
    // First confirmation
    act(() => {
      result.current.confirm({
        message: 'First action?',
        onConfirm: firstOnConfirm
      })
    })

    act(() => {
      vi.runAllTimers()
    })

    expect(firstOnConfirm).toHaveBeenCalled()

    // Second confirmation
    act(() => {
      result.current.confirm({
        message: 'Second action?',
        onConfirm: secondOnConfirm
      })
    })

    act(() => {
      vi.runAllTimers()
    })

    expect(secondOnConfirm).toHaveBeenCalled()
    expect(confirmSpy).toHaveBeenCalledTimes(2)
  })
})