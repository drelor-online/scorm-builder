import { describe, it, expect, act, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useConfirmDialog } from '../useConfirmDialog'

describe('useConfirmDialog', () => {
  beforeEach(() => {
    // Mock window.confirm
    vi.stubGlobal('confirm', vi.fn())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('should initialize with isPending as false', () => {
    const { result } = renderHook(() => useConfirmDialog())
    
    expect(result.current.isPending).toBe(false)
    expect(typeof result.current.confirm).toBe('function')
  })

  it('should set isPending to true when confirm is called', () => {
    const { result } = renderHook(() => useConfirmDialog())
    
    act(() => {
      result.current.confirm({
        message: 'Are you sure?',
        onConfirm: vi.fn()
      })
    })

    expect(result.current.isPending).toBe(true)
  })

  it('should call onConfirm when user confirms', () => {
    const mockConfirm = vi.mocked(window.confirm)
    mockConfirm.mockReturnValue(true)
    
    const { result } = renderHook(() => useConfirmDialog())
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    
    act(() => {
      result.current.confirm({
        message: 'Are you sure?',
        onConfirm,
        onCancel
      })
    })

    // Run the setTimeout
    act(() => {
      vi.runAllTimers()
    })

    expect(mockConfirm).toHaveBeenCalledWith('Are you sure?')
    expect(onConfirm).toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    expect(result.current.isPending).toBe(false)
  })

  it('should call onCancel when user cancels', () => {
    const mockConfirm = vi.mocked(window.confirm)
    mockConfirm.mockReturnValue(false)
    
    const { result } = renderHook(() => useConfirmDialog())
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    
    act(() => {
      result.current.confirm({
        message: 'Are you sure?',
        onConfirm,
        onCancel
      })
    })

    // Run the setTimeout
    act(() => {
      vi.runAllTimers()
    })

    expect(mockConfirm).toHaveBeenCalledWith('Are you sure?')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
    expect(result.current.isPending).toBe(false)
  })

  it('should not call onCancel if not provided when user cancels', () => {
    const mockConfirm = vi.mocked(window.confirm)
    mockConfirm.mockReturnValue(false)
    
    const { result } = renderHook(() => useConfirmDialog())
    const onConfirm = vi.fn()
    
    act(() => {
      result.current.confirm({
        message: 'Are you sure?',
        onConfirm
      })
    })

    // Run the setTimeout
    act(() => {
      vi.runAllTimers()
    })

    expect(mockConfirm).toHaveBeenCalledWith('Are you sure?')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(result.current.isPending).toBe(false)
  })

  it('should handle multiple confirm calls sequentially', () => {
    const mockConfirm = vi.mocked(window.confirm)
    mockConfirm.mockReturnValueOnce(true).mockReturnValueOnce(false)
    
    const { result } = renderHook(() => useConfirmDialog())
    const firstOnConfirm = vi.fn()
    const secondOnConfirm = vi.fn()
    const secondOnCancel = vi.fn()

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
    expect(result.current.isPending).toBe(false)

    // Second confirmation
    act(() => {
      result.current.confirm({
        message: 'Second action?',
        onConfirm: secondOnConfirm,
        onCancel: secondOnCancel
      })
    })

    act(() => {
      vi.runAllTimers()
    })

    expect(secondOnConfirm).not.toHaveBeenCalled()
    expect(secondOnCancel).toHaveBeenCalled()
    expect(result.current.isPending).toBe(false)
  })
})