import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFormChanges } from '../useFormChanges'

describe('useFormChanges - User Intent Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.confirm
    window.confirm = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('User wants to track form changes', () => {
    it('should initially have no changes', () => {
      const { result } = renderHook(() => useFormChanges())

      expect(result.current.hasChanges).toBe(false)
    })

    it('should detect when form has changes via checkForChanges', () => {
      const { result } = renderHook(() => useFormChanges({
        initialValues: { name: 'John', email: 'john@example.com' }
      }))

      // Initially no changes
      expect(result.current.hasChanges).toBe(false)

      // Check with changed values
      act(() => {
        result.current.checkForChanges({ name: 'Jane', email: 'john@example.com' })
      })

      expect(result.current.hasChanges).toBe(true)
    })

    it('should detect array changes', () => {
      const { result } = renderHook(() => useFormChanges({
        initialValues: { tags: ['tag1', 'tag2'] }
      }))

      // Check with different array length
      act(() => {
        result.current.checkForChanges({ tags: ['tag1', 'tag2', 'tag3'] })
      })

      expect(result.current.hasChanges).toBe(true)
    })

    it('should detect no changes when values are same', () => {
      const { result } = renderHook(() => useFormChanges({
        initialValues: { name: 'John', age: 30 }
      }))

      act(() => {
        result.current.checkForChanges({ name: 'John', age: 30 })
      })

      expect(result.current.hasChanges).toBe(false)
    })
  })

  describe('User wants to reset form state', () => {
    it('should clear all changes when reset', () => {
      const { result } = renderHook(() => useFormChanges({
        initialValues: { name: 'John' }
      }))

      // Make changes
      act(() => {
        result.current.checkForChanges({ name: 'Jane' })
      })

      expect(result.current.hasChanges).toBe(true)

      // Reset
      act(() => {
        result.current.resetChanges()
      })

      expect(result.current.hasChanges).toBe(false)
    })

    it('should update initial values after save', () => {
      const { result } = renderHook(() => useFormChanges({
        initialValues: { name: 'John' }
      }))

      // Make changes
      act(() => {
        result.current.checkForChanges({ name: 'Jane' })
      })

      expect(result.current.hasChanges).toBe(true)

      // Update initial values (simulating a save)
      act(() => {
        result.current.updateInitialValues({ name: 'Jane' })
      })

      expect(result.current.hasChanges).toBe(false)

      // Check that the new values are now considered initial
      act(() => {
        result.current.checkForChanges({ name: 'Jane' })
      })

      expect(result.current.hasChanges).toBe(false)
    })
  })

  describe('User wants to prevent accidental navigation', () => {
    it('should warn when navigating with unsaved changes', () => {
      const mockConfirm = vi.mocked(window.confirm)
      mockConfirm.mockReturnValue(false)

      const { result } = renderHook(() => useFormChanges({
        initialValues: { name: 'John' }
      }))

      // Make changes
      act(() => {
        result.current.checkForChanges({ name: 'Jane' })
      })

      const navigationCallback = vi.fn()

      act(() => {
        result.current.attemptNavigation(navigationCallback)
      })

      expect(mockConfirm).toHaveBeenCalledWith('You have unsaved changes. Are you sure you want to leave?')
      expect(navigationCallback).not.toHaveBeenCalled()
    })

    it('should allow navigation when user confirms', () => {
      const mockConfirm = vi.mocked(window.confirm)
      mockConfirm.mockReturnValue(true)

      const { result } = renderHook(() => useFormChanges({
        initialValues: { name: 'John' }
      }))

      // Make changes
      act(() => {
        result.current.checkForChanges({ name: 'Jane' })
      })

      const navigationCallback = vi.fn()

      act(() => {
        result.current.attemptNavigation(navigationCallback)
      })

      expect(mockConfirm).toHaveBeenCalled()
      expect(navigationCallback).toHaveBeenCalled()
    })

    it('should navigate without warning when no changes', () => {
      const mockConfirm = vi.mocked(window.confirm)
      
      const { result } = renderHook(() => useFormChanges())

      const navigationCallback = vi.fn()

      act(() => {
        result.current.attemptNavigation(navigationCallback)
      })

      expect(mockConfirm).not.toHaveBeenCalled()
      expect(navigationCallback).toHaveBeenCalled()
    })

    it('should call onNavigationAttempt callback when provided', () => {
      const mockConfirm = vi.mocked(window.confirm)
      mockConfirm.mockReturnValue(false)
      
      const onNavigationAttempt = vi.fn()
      
      const { result } = renderHook(() => useFormChanges({
        initialValues: { name: 'John' },
        onNavigationAttempt
      }))

      // Make changes
      act(() => {
        result.current.checkForChanges({ name: 'Jane' })
      })

      act(() => {
        result.current.attemptNavigation(() => {})
      })

      expect(onNavigationAttempt).toHaveBeenCalled()
    })
  })

  describe('User wants navigation warning state management', () => {
    it('should manage navigation warning visibility', () => {
      const { result } = renderHook(() => useFormChanges())

      expect(result.current.showNavigationWarning).toBe(false)
      
      // The hook doesn't directly expose methods to toggle showNavigationWarning
      // as it's managed internally, but we can test its initial state
    })
  })
})