import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { ReactNode } from 'react'
import { AutoSaveProvider, useAutoSaveState } from '../AutoSaveContext'

describe('AutoSaveContext', () => {
  describe('Context Provider', () => {
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
      
      // Should not throw, but return defaults
      expect(result.current.isSaving).toBe(false)
      expect(result.current.lastSaved).toBeNull()
      expect(result.current.hasUnsavedChanges).toBe(false)
    })
  })

  describe('State Updates', () => {
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

  describe('Complex State Scenarios', () => {
    it('should handle saving with unsaved changes', () => {
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

    it('should handle saved with no changes', () => {
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

    it('should handle multiple consumers', () => {
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
  })

  describe('Edge Cases', () => {
    it('should handle provider with no children', () => {
      const Component = () => (
        <AutoSaveProvider 
          isSaving={false} 
          lastSaved={null}
          hasUnsavedChanges={false}
        />
      )
      
      // Should not throw
      expect(() => Component()).not.toThrow()
    })

    it('should preserve date object reference', () => {
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

    it('should handle rapid state changes', () => {
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
  })
})