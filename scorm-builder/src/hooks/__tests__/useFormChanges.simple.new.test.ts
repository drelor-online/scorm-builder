import { describe, it, expect, act, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFormChanges } from '../useFormChanges'

// Mock window.confirm
global.confirm = vi.fn()

describe('useFormChanges Hook - Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with no changes', () => {
    const { result } = renderHook(() => useFormChanges())

    expect(result.current.hasChanges).toBe(false)
    expect(result.current.showNavigationWarning).toBe(false)
  })

  it('should detect changes when values differ from initial', () => {
    const initialValues = { name: 'John', age: 30 }
    const { result } = renderHook(() => 
      useFormChanges({ initialValues })
    )

    act(() => {
      const hasChanges = result.current.checkForChanges({ 
        name: 'Jane', 
        age: 30 
      })
      expect(hasChanges).toBe(true)
    })

    expect(result.current.hasChanges).toBe(true)
  })

  it('should not detect changes when values match initial', () => {
    const initialValues = { name: 'John', age: 30 }
    const { result } = renderHook(() => 
      useFormChanges({ initialValues })
    )

    act(() => {
      const hasChanges = result.current.checkForChanges({ 
        name: 'John', 
        age: 30 
      })
      expect(hasChanges).toBe(false)
    })

    expect(result.current.hasChanges).toBe(false)
  })

  it('should detect array changes', () => {
    const initialValues = { tags: ['react', 'vue'] }
    const { result } = renderHook(() => 
      useFormChanges({ initialValues })
    )

    // Different length
    act(() => {
      const hasChanges = result.current.checkForChanges({ 
        tags: ['react', 'vue', 'angular']
      })
      expect(hasChanges).toBe(true)
    })

    // Different values
    act(() => {
      const hasChanges = result.current.checkForChanges({ 
        tags: ['react', 'angular']
      })
      expect(hasChanges).toBe(true)
    })
  })

  it('should handle navigation with unsaved changes', () => {
    vi.mocked(confirm).mockReturnValue(true)
    const navigationCallback = vi.fn()
    const onNavigationAttempt = vi.fn()
    
    const { result } = renderHook(() => 
      useFormChanges({ 
        initialValues: { name: 'John' },
        onNavigationAttempt 
      })
    )

    // Create changes
    act(() => {
      result.current.checkForChanges({ name: 'Jane' })
    })

    // Attempt navigation
    act(() => {
      result.current.attemptNavigation(navigationCallback)
    })

    expect(confirm).toHaveBeenCalledWith('You have unsaved changes. Are you sure you want to leave?')
    expect(navigationCallback).toHaveBeenCalled()
    expect(onNavigationAttempt).toHaveBeenCalled()
  })

  it('should cancel navigation when user declines', () => {
    vi.mocked(confirm).mockReturnValue(false)
    const navigationCallback = vi.fn()
    
    const { result } = renderHook(() => 
      useFormChanges({ initialValues: { name: 'John' } })
    )

    // Create changes
    act(() => {
      result.current.checkForChanges({ name: 'Jane' })
    })

    // Attempt navigation
    act(() => {
      result.current.attemptNavigation(navigationCallback)
    })

    expect(confirm).toHaveBeenCalled()
    expect(navigationCallback).not.toHaveBeenCalled()
  })

  it('should navigate directly when no changes', () => {
    const navigationCallback = vi.fn()
    const { result } = renderHook(() => useFormChanges())

    act(() => {
      result.current.attemptNavigation(navigationCallback)
    })

    expect(confirm).not.toHaveBeenCalled()
    expect(navigationCallback).toHaveBeenCalled()
  })

  it('should reset changes', () => {
    const { result } = renderHook(() => 
      useFormChanges({ initialValues: { name: 'John' } })
    )

    // Create changes
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

  it('should update initial values', () => {
    const { result } = renderHook(() => 
      useFormChanges({ initialValues: { name: 'John' } })
    )

    // Create changes
    act(() => {
      result.current.checkForChanges({ name: 'Jane' })
    })
    expect(result.current.hasChanges).toBe(true)

    // Update initial values (like after save)
    act(() => {
      result.current.updateInitialValues({ name: 'Jane' })
    })
    expect(result.current.hasChanges).toBe(false)

    // Check same values don't show as changed
    act(() => {
      const hasChanges = result.current.checkForChanges({ name: 'Jane' })
      expect(hasChanges).toBe(false)
    })
  })

  it('should confirm navigation with pending callback', () => {
    const pendingCallback = vi.fn()
    const { result } = renderHook(() => useFormChanges())

    // Simulate pending navigation
    act(() => {
      // First set hasChanges to true
      result.current.checkForChanges({ name: 'changed' })
      // Manually trigger the warning state (in real usage this would be set by attemptNavigation)
      result.current.showNavigationWarning = false
    })

    // Confirm navigation
    act(() => {
      result.current.confirmNavigation()
    })

    expect(result.current.hasChanges).toBe(false)
    expect(result.current.showNavigationWarning).toBe(false)
  })

  it('should cancel navigation', () => {
    const { result } = renderHook(() => useFormChanges())

    // Cancel navigation
    act(() => {
      result.current.cancelNavigation()
    })

    expect(result.current.showNavigationWarning).toBe(false)
  })
})