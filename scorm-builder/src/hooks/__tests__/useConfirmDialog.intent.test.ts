import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConfirmDialog } from '../useConfirmDialog'

describe('useConfirmDialog - User Intent Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Mock window.confirm
    window.confirm = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('User wants to show a confirmation dialog', () => {
    it('should show confirmation dialog with message', async () => {
      const mockConfirm = vi.mocked(window.confirm)
      mockConfirm.mockReturnValue(true)
      
      const { result } = renderHook(() => useConfirmDialog())
      
      const onConfirm = vi.fn()
      const onCancel = vi.fn()

      act(() => {
        result.current.confirm({
          message: 'Are you sure you want to delete this project?',
          onConfirm,
          onCancel
        })
      })

      // Wait for setTimeout to execute
      await vi.runAllTimersAsync()

      expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this project?')
    })

    it('should call onConfirm when user clicks OK', async () => {
      const mockConfirm = vi.mocked(window.confirm)
      mockConfirm.mockReturnValue(true)
      
      const { result } = renderHook(() => useConfirmDialog())
      
      const onConfirm = vi.fn()
      const onCancel = vi.fn()

      act(() => {
        result.current.confirm({
          message: 'Save changes?',
          onConfirm,
          onCancel
        })
      })

      await vi.runAllTimersAsync()

      expect(onConfirm).toHaveBeenCalled()
      expect(onCancel).not.toHaveBeenCalled()
    })

    it('should call onCancel when user clicks Cancel', async () => {
      const mockConfirm = vi.mocked(window.confirm)
      mockConfirm.mockReturnValue(false)
      
      const { result } = renderHook(() => useConfirmDialog())
      
      const onConfirm = vi.fn()
      const onCancel = vi.fn()

      act(() => {
        result.current.confirm({
          message: 'Discard changes?',
          onConfirm,
          onCancel
        })
      })

      await vi.runAllTimersAsync()

      expect(onConfirm).not.toHaveBeenCalled()
      expect(onCancel).toHaveBeenCalled()
    })

    it('should not call onCancel if not provided when user cancels', async () => {
      const mockConfirm = vi.mocked(window.confirm)
      mockConfirm.mockReturnValue(false)
      
      const { result } = renderHook(() => useConfirmDialog())
      
      const onConfirm = vi.fn()

      act(() => {
        result.current.confirm({
          message: 'Delete file?',
          onConfirm
        })
      })

      await vi.runAllTimersAsync()

      expect(onConfirm).not.toHaveBeenCalled()
      // Should not throw error when onCancel is not provided
    })
  })

  describe('User wants to know when dialog is pending', () => {
    it('should set isPending to true while showing dialog', () => {
      const mockConfirm = vi.mocked(window.confirm)
      mockConfirm.mockReturnValue(true)
      
      const { result } = renderHook(() => useConfirmDialog())

      expect(result.current.isPending).toBe(false)

      act(() => {
        result.current.confirm({
          message: 'Continue?',
          onConfirm: () => {}
        })
      })

      expect(result.current.isPending).toBe(true)
    })

    it('should set isPending to false after dialog is closed', async () => {
      const mockConfirm = vi.mocked(window.confirm)
      mockConfirm.mockReturnValue(true)
      
      const { result } = renderHook(() => useConfirmDialog())

      act(() => {
        result.current.confirm({
          message: 'Continue?',
          onConfirm: () => {}
        })
      })

      expect(result.current.isPending).toBe(true)

      // Run timers and wait for state update
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(result.current.isPending).toBe(false)
    })
  })

  describe('User wants to handle multiple confirmations', () => {
    it('should handle sequential confirm calls', async () => {
      const mockConfirm = vi.mocked(window.confirm)
      mockConfirm.mockReturnValueOnce(true).mockReturnValueOnce(false)
      
      const { result } = renderHook(() => useConfirmDialog())
      
      const onConfirm1 = vi.fn()
      const onConfirm2 = vi.fn()
      const onCancel2 = vi.fn()

      // First confirmation
      act(() => {
        result.current.confirm({
          message: 'First action?',
          onConfirm: onConfirm1
        })
      })

      await vi.runAllTimersAsync()

      expect(onConfirm1).toHaveBeenCalled()

      // Second confirmation
      act(() => {
        result.current.confirm({
          message: 'Second action?',
          onConfirm: onConfirm2,
          onCancel: onCancel2
        })
      })

      await vi.runAllTimersAsync()

      expect(onConfirm2).not.toHaveBeenCalled()
      expect(onCancel2).toHaveBeenCalled()
    })
  })

  describe('User wants different confirmation scenarios', () => {
    it('should handle delete confirmation', async () => {
      const mockConfirm = vi.mocked(window.confirm)
      mockConfirm.mockReturnValue(true)
      
      const { result } = renderHook(() => useConfirmDialog())
      
      const handleDelete = vi.fn()

      act(() => {
        result.current.confirm({
          message: 'Are you sure you want to delete this item? This action cannot be undone.',
          onConfirm: handleDelete
        })
      })

      await vi.runAllTimersAsync()

      expect(handleDelete).toHaveBeenCalled()
    })

    it('should handle navigation confirmation with unsaved changes', async () => {
      const mockConfirm = vi.mocked(window.confirm)
      mockConfirm.mockReturnValue(false)
      
      const { result } = renderHook(() => useConfirmDialog())
      
      const handleNavigation = vi.fn()
      const handleSave = vi.fn()

      act(() => {
        result.current.confirm({
          message: 'You have unsaved changes. Do you want to leave without saving?',
          onConfirm: handleNavigation,
          onCancel: handleSave
        })
      })

      await vi.runAllTimersAsync()

      expect(handleNavigation).not.toHaveBeenCalled()
      expect(handleSave).toHaveBeenCalled()
    })
  })
})