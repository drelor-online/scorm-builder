import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAutoSave } from '../useAutoSave'

describe('useAutoSave - Simple Tests', () => {
  it('should return the expected interface', () => {
    const mockOnSave = vi.fn()
    const { result } = renderHook(() => 
      useAutoSave({ 
        data: { test: 'data' }, 
        onSave: mockOnSave,
        delay: 1000 
      })
    )

    expect(result.current).toBeDefined()
    expect(result.current).toHaveProperty('isSaving')
    expect(result.current).toHaveProperty('lastSaved')
    expect(result.current).toHaveProperty('forceSave')
    expect(result.current.isSaving).toBe(false)
    expect(result.current.lastSaved).toBeNull()
    expect(typeof result.current.forceSave).toBe('function')
  })

  it('should handle disabled state', () => {
    const mockOnSave = vi.fn()
    const { result } = renderHook(() => 
      useAutoSave({ 
        data: { test: 'data' }, 
        onSave: mockOnSave,
        delay: 1000,
        disabled: true
      })
    )

    expect(result.current).toBeDefined()
    expect(result.current.isSaving).toBe(false)
  })
})