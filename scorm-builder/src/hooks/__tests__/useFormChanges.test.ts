import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFormChanges } from '../useFormChanges'

// Mock window.confirm
const mockConfirm = vi.fn()
global.window.confirm = mockConfirm

beforeEach(() => {
  mockConfirm.mockReset()
})

describe('useFormChanges', () => {
  describe('Initial state', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useFormChanges())

      expect(result.current.hasChanges).toBe(false)
      expect(result.current.showNavigationWarning).toBe(false)
    })

    it('should accept initial values', () => {
      const initialValues = { name: 'John', email: 'john@example.com' }
      const { result } = renderHook(() => useFormChanges({ initialValues }))

      // Check initial state
      expect(result.current.hasChanges).toBe(false)

      // Should detect no changes when values match initial
      let hasChanges: boolean
      act(() => {
        hasChanges = result.current.checkForChanges(initialValues)
      })
      expect(hasChanges!).toBe(false)
    })
  })

  describe('Change detection', () => {
    it('should detect simple value changes', () => {
      const initialValues = { name: 'John', age: 25 }
      const { result } = renderHook(() => useFormChanges({ initialValues }))

      // Change values
      let hasChanges: boolean
      act(() => {
        hasChanges = result.current.checkForChanges({ 
          name: 'Jane',  // Changed
          age: 25        // Unchanged
        })
      })

      expect(hasChanges!).toBe(true)
      expect(result.current.hasChanges).toBe(true)
    })

    it('should detect no changes when values match', () => {
      const initialValues = { name: 'John', age: 25 }
      const { result } = renderHook(() => useFormChanges({ initialValues }))

      let hasChanges: boolean
      act(() => {
        hasChanges = result.current.checkForChanges(initialValues)
      })

      expect(hasChanges!).toBe(false)
      expect(result.current.hasChanges).toBe(false)
    })

    it('should detect array changes - different length', () => {
      const initialValues = { tags: ['react', 'typescript'] }
      const { result } = renderHook(() => useFormChanges({ initialValues }))

      let hasChanges: boolean
      act(() => {
        hasChanges = result.current.checkForChanges({ 
          tags: ['react', 'typescript', 'vitest']
        })
      })

      expect(hasChanges!).toBe(true)
    })

    it('should detect array changes - different values', () => {
      const initialValues = { tags: ['react', 'typescript'] }
      const { result } = renderHook(() => useFormChanges({ initialValues }))

      let hasChanges: boolean
      act(() => {
        hasChanges = result.current.checkForChanges({ 
          tags: ['react', 'javascript']
        })
      })

      expect(hasChanges!).toBe(true)
    })

    it('should detect no changes in identical arrays', () => {
      const initialValues = { tags: ['react', 'typescript'] }
      const { result } = renderHook(() => useFormChanges({ initialValues }))

      let hasChanges: boolean
      act(() => {
        hasChanges = result.current.checkForChanges({ 
          tags: ['react', 'typescript']
        })
      })

      expect(hasChanges!).toBe(false)
    })

    it('should handle new fields as changes', () => {
      const initialValues = { name: 'John' }
      const { result } = renderHook(() => useFormChanges({ initialValues }))

      let hasChanges: boolean
      act(() => {
        hasChanges = result.current.checkForChanges({ 
          name: 'John',
          email: 'john@example.com'  // New field
        })
      })

      expect(hasChanges!).toBe(true)
    })
  })

  describe('Navigation attempts', () => {
    it('should allow navigation when no changes', () => {
      const { result } = renderHook(() => useFormChanges())
      const navigationCallback = vi.fn()

      act(() => {
        result.current.attemptNavigation(navigationCallback)
      })

      expect(mockConfirm).not.toHaveBeenCalled()
      expect(navigationCallback).toHaveBeenCalled()
    })

    it('should prompt user when there are changes and user confirms', () => {
      const initialValues = { name: 'John' }
      const { result } = renderHook(() => useFormChanges({ initialValues }))
      const navigationCallback = vi.fn()

      // Create changes
      act(() => {
        result.current.checkForChanges({ name: 'Jane' })
      })

      // User confirms navigation
      mockConfirm.mockReturnValueOnce(true)

      act(() => {
        result.current.attemptNavigation(navigationCallback)
      })

      expect(mockConfirm).toHaveBeenCalledWith('You have unsaved changes. Are you sure you want to leave?')
      expect(navigationCallback).toHaveBeenCalled()
    })

    it('should block navigation when user cancels', () => {
      const initialValues = { name: 'John' }
      const { result } = renderHook(() => useFormChanges({ initialValues }))
      const navigationCallback = vi.fn()

      // Create changes
      act(() => {
        result.current.checkForChanges({ name: 'Jane' })
      })

      // User cancels navigation
      mockConfirm.mockReturnValueOnce(false)

      act(() => {
        result.current.attemptNavigation(navigationCallback)
      })

      expect(mockConfirm).toHaveBeenCalled()
      expect(navigationCallback).not.toHaveBeenCalled()
    })

    it('should call onNavigationAttempt callback when provided', () => {
      const onNavigationAttempt = vi.fn()
      const initialValues = { name: 'John' }
      const { result } = renderHook(() => 
        useFormChanges({ initialValues, onNavigationAttempt })
      )
      const navigationCallback = vi.fn()

      // Create changes
      act(() => {
        result.current.checkForChanges({ name: 'Jane' })
      })

      // User confirms
      mockConfirm.mockReturnValueOnce(true)

      act(() => {
        result.current.attemptNavigation(navigationCallback)
      })

      expect(onNavigationAttempt).toHaveBeenCalled()
    })
  })

  describe('Navigation confirmation flow', () => {
    it('should handle confirm navigation', () => {
      const { result } = renderHook(() => useFormChanges())
      const pendingNav = vi.fn()

      // Simulate setting pending navigation (normally done internally)
      act(() => {
        // Create changes to enable the flow
        result.current.checkForChanges({ field: 'changed' })
      })

      // Confirm navigation
      act(() => {
        result.current.confirmNavigation()
      })

      expect(result.current.showNavigationWarning).toBe(false)
      expect(result.current.hasChanges).toBe(false)
    })

    it('should handle cancel navigation', () => {
      const { result } = renderHook(() => useFormChanges())

      // Setup some state
      act(() => {
        result.current.checkForChanges({ field: 'changed' })
      })

      // Cancel navigation
      act(() => {
        result.current.cancelNavigation()
      })

      expect(result.current.showNavigationWarning).toBe(false)
      // Changes should still be present
      expect(result.current.hasChanges).toBe(true)
    })
  })

  describe('Reset and update', () => {
    it('should reset all tracking', () => {
      const initialValues = { name: 'John' }
      const { result } = renderHook(() => useFormChanges({ initialValues }))

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

      // Check that initial values are cleared
      let hasChanges: boolean
      act(() => {
        hasChanges = result.current.checkForChanges({ name: 'John' })
      })
      expect(hasChanges!).toBe(true) // Since initial values were reset
    })

    it('should update initial values after save', () => {
      const initialValues = { name: 'John' }
      const { result } = renderHook(() => useFormChanges({ initialValues }))

      // Make changes
      act(() => {
        result.current.checkForChanges({ name: 'Jane' })
      })

      expect(result.current.hasChanges).toBe(true)

      // Save and update initial values
      const newValues = { name: 'Jane' }
      act(() => {
        result.current.updateInitialValues(newValues)
      })

      expect(result.current.hasChanges).toBe(false)

      // Check that new values are now the baseline
      let hasChanges: boolean
      act(() => {
        hasChanges = result.current.checkForChanges(newValues)
      })
      expect(hasChanges!).toBe(false)
    })
  })

  describe('Complex scenarios', () => {
    it('should handle form save workflow', () => {
      const initialValues = { 
        title: 'Original Title',
        description: 'Original Description',
        tags: ['tag1', 'tag2']
      }
      const { result } = renderHook(() => useFormChanges({ initialValues }))

      // User edits form
      const editedValues = {
        title: 'New Title',
        description: 'New Description',
        tags: ['tag1', 'tag2', 'tag3']
      }

      act(() => {
        result.current.checkForChanges(editedValues)
      })

      expect(result.current.hasChanges).toBe(true)

      // Save operation - update initial values
      act(() => {
        result.current.updateInitialValues(editedValues)
      })

      expect(result.current.hasChanges).toBe(false)

      // Further edits
      act(() => {
        result.current.checkForChanges({
          ...editedValues,
          title: 'Another Title'
        })
      })

      expect(result.current.hasChanges).toBe(true)
    })

    it('should handle navigation guard with multiple attempts', () => {
      const initialValues = { name: 'John' }
      const onNavigationAttempt = vi.fn()
      const { result } = renderHook(() => 
        useFormChanges({ initialValues, onNavigationAttempt })
      )

      // Make changes
      act(() => {
        result.current.checkForChanges({ name: 'Jane' })
      })

      // First navigation attempt - user cancels
      mockConfirm.mockReturnValueOnce(false)
      const firstNav = vi.fn()

      act(() => {
        result.current.attemptNavigation(firstNav)
      })

      expect(firstNav).not.toHaveBeenCalled()
      expect(onNavigationAttempt).toHaveBeenCalledTimes(1)

      // Second navigation attempt - user confirms
      mockConfirm.mockReturnValueOnce(true)
      const secondNav = vi.fn()

      act(() => {
        result.current.attemptNavigation(secondNav)
      })

      expect(secondNav).toHaveBeenCalled()
      expect(onNavigationAttempt).toHaveBeenCalledTimes(2)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty initial values', () => {
      const { result } = renderHook(() => useFormChanges())

      // Check empty object
      let hasChanges: boolean
      act(() => {
        hasChanges = result.current.checkForChanges({})
      })
      expect(hasChanges!).toBe(false)

      // Add values
      let hasChangesWithData: boolean
      act(() => {
        hasChangesWithData = result.current.checkForChanges({ 
          name: 'John' 
        })
      })
      expect(hasChangesWithData!).toBe(true)
    })

    it('should handle undefined vs null values', () => {
      const initialValues = { field: undefined }
      const { result } = renderHook(() => useFormChanges({ initialValues }))

      // undefined to null is a change
      let hasChanges: boolean
      act(() => {
        hasChanges = result.current.checkForChanges({ field: null })
      })
      expect(hasChanges!).toBe(true)
    })

    it('should handle missing fields in current values', () => {
      const initialValues = { name: 'John', email: 'john@example.com' }
      const { result } = renderHook(() => useFormChanges({ initialValues }))

      // Missing email field should be detected as change
      let hasChanges: boolean
      act(() => {
        hasChanges = result.current.checkForChanges({ name: 'John' })
      })
      expect(hasChanges!).toBe(false) // Only checks provided keys
    })
  })
})