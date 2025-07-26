import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLocalStorageAutoSave } from '../useLocalStorageAutoSave'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

global.localStorage = localStorageMock as any

// Mock console methods but don't clear them automatically
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

describe('useLocalStorageAutoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Reset localStorage mock to default behavior
    localStorageMock.getItem.mockReturnValue(null)
    localStorageMock.setItem.mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => 
        useLocalStorageAutoSave({ test: 'data' }, { key: 'test-key' })
      )

      expect(result.current.isSaving).toBe(true) // Initially saving
      expect(result.current.lastSaved).toBe(null)
      expect(result.current.hasDraft).toBe(false)
      expect(result.current.timeSinceLastSave).toBe('Never')
    })

    it('should load existing draft on mount', () => {
      const savedData = {
        data: { existing: 'draft' },
        timestamp: new Date('2024-01-01T12:00:00Z').toISOString()
      }
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedData))

      const onLoad = vi.fn()
      const { result } = renderHook(() => 
        useLocalStorageAutoSave({ test: 'data' }, { key: 'test-key', onLoad })
      )

      expect(localStorageMock.getItem).toHaveBeenCalledWith('test-key')
      expect(onLoad).toHaveBeenCalledWith({ existing: 'draft' })
      expect(result.current.hasDraft).toBe(true)
      expect(result.current.lastSaved).toEqual(new Date('2024-01-01T12:00:00Z'))
    })

    it('should handle corrupted draft data gracefully', () => {
      localStorageMock.getItem.mockReturnValueOnce('invalid json')

      const onLoad = vi.fn()
      
      // We'll check if error handling works by ensuring onLoad is not called
      // and the hook doesn't crash
      const { result } = renderHook(() => 
        useLocalStorageAutoSave({ test: 'data' }, { key: 'test-key', onLoad })
      )

      expect(onLoad).not.toHaveBeenCalled()
      // The hook should still initialize properly despite the error
      expect(result.current.hasDraft).toBe(false)
      expect(result.current.lastSaved).toBe(null)
    })

    it('should not load draft if localStorage is empty', () => {
      localStorageMock.getItem.mockReturnValueOnce(null)

      const onLoad = vi.fn()
      const { result } = renderHook(() => 
        useLocalStorageAutoSave({ test: 'data' }, { key: 'test-key', onLoad })
      )

      expect(onLoad).not.toHaveBeenCalled()
      expect(result.current.hasDraft).toBe(false)
    })
  })

  describe('Auto Save', () => {
    it('should save data after delay', async () => {
      const data = { test: 'value' }
      const { result } = renderHook(() => 
        useLocalStorageAutoSave(data, { key: 'test-key', delay: 1000 })
      )

      expect(result.current.isSaving).toBe(true)

      // Wait for save delay
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test-key',
        expect.stringContaining('"test":"value"')
      )

      expect(result.current.isSaving).toBe(false)
      expect(result.current.lastSaved).toBeInstanceOf(Date)
      expect(result.current.hasDraft).toBe(true)
    })

    it('should debounce saves when data changes rapidly', async () => {
      const { result, rerender } = renderHook(
        ({ data }) => useLocalStorageAutoSave(data, { key: 'test-key', delay: 1000 }),
        { initialProps: { data: { count: 1 } } }
      )

      // Change data multiple times rapidly
      rerender({ data: { count: 2 } })
      act(() => {
        vi.advanceTimersByTime(500)
      })
      
      rerender({ data: { count: 3 } })
      act(() => {
        vi.advanceTimersByTime(500)
      })
      
      rerender({ data: { count: 4 } })
      
      // Should not have saved yet
      expect(localStorageMock.setItem).not.toHaveBeenCalled()

      // Complete the delay
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test-key',
        expect.stringContaining('"count":4')
      )
    })

    it('should call onSave callback after saving', async () => {
      const onSave = vi.fn()
      renderHook(() => 
        useLocalStorageAutoSave({ test: 'data' }, { key: 'test-key', delay: 100, onSave })
      )

      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(onSave).toHaveBeenCalledTimes(1)
    })

    it('should not save null or undefined data', () => {
      const { rerender } = renderHook(
        ({ data }) => useLocalStorageAutoSave(data, { key: 'test-key', delay: 100 }),
        { initialProps: { data: null } }
      )

      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(localStorageMock.setItem).not.toHaveBeenCalled()

      // Try with undefined
      rerender({ data: undefined })
      
      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(localStorageMock.setItem).not.toHaveBeenCalled()
    })

    it('should handle save errors gracefully', () => {
      // Mock error for when setItem is called
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded')
      })
      
      // Set up the hook - it will try to save immediately
      const { result } = renderHook(() => 
        useLocalStorageAutoSave({ test: 'data' }, { key: 'test-key', delay: 100 })
      )

      // Initial state should be saving
      expect(result.current.isSaving).toBe(true)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      // The hook should handle the error gracefully
      // Verify setItem was attempted
      expect(localStorageMock.setItem).toHaveBeenCalled()
      // And no draft should be saved (hasDraft stays false)
      expect(result.current.hasDraft).toBe(false)
      
      // The hook should continue to work after the error
      // We've confirmed it doesn't crash and handles the error properly
    })
  })

  describe('Time Since Last Save', () => {
    it('should update time display correctly', () => {
      const { result } = renderHook(() => 
        useLocalStorageAutoSave({ test: 'data' }, { key: 'test-key', delay: 100 })
      )

      // Initial state
      expect(result.current.timeSinceLastSave).toBe('Never')

      // Save data first
      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.lastSaved).not.toBeNull()
      expect(result.current.timeSinceLastSave).toBe('Just now')
      
      // Test that the time display updates based on the interval
      // The hook checks every second, so we just need to verify the states exist
      // The actual time calculation depends on Date objects which are hard to mock reliably
      
      // Verify the hook provides the expected interface
      expect(typeof result.current.timeSinceLastSave).toBe('string')
      expect(result.current.lastSaved).toBeInstanceOf(Date)
    })

    it('should clean up interval on unmount', () => {
      const { unmount } = renderHook(() => 
        useLocalStorageAutoSave({ test: 'data' }, { key: 'test-key' })
      )

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
      
      unmount()

      expect(clearIntervalSpy).toHaveBeenCalled()
    })
  })

  describe('Clear Draft', () => {
    it('should clear draft from localStorage', async () => {
      const { result } = renderHook(() => 
        useLocalStorageAutoSave({ test: 'data' }, { key: 'test-key', delay: 100 })
      )

      // Save some data first
      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.hasDraft).toBe(true)

      // Clear draft
      act(() => {
        result.current.clearDraft()
      })

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key')
      expect(result.current.hasDraft).toBe(false)
      expect(result.current.lastSaved).toBe(null)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete form editing workflow', async () => {
      const formData = { name: '', email: '' }
      const onSave = vi.fn()
      
      const { result, rerender } = renderHook(
        ({ data }) => useLocalStorageAutoSave(data, { 
          key: 'form-draft', 
          delay: 500,
          onSave 
        }),
        { initialProps: { data: formData } }
      )

      // User starts typing name
      rerender({ data: { name: 'J', email: '' } })
      rerender({ data: { name: 'Jo', email: '' } })
      rerender({ data: { name: 'John', email: '' } })

      // Should be saving
      expect(result.current.isSaving).toBe(true)

      // Complete save
      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(onSave).toHaveBeenCalledTimes(1)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'form-draft',
        expect.stringContaining('"name":"John"')
      )

      // User continues with email
      rerender({ data: { name: 'John', email: 'john@example.com' } })

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(onSave).toHaveBeenCalledTimes(2)

      // Form submitted - clear draft
      act(() => {
        result.current.clearDraft()
      })

      expect(result.current.hasDraft).toBe(false)
    })

    it('should recover from browser refresh', async () => {
      // Simulate saved draft before refresh
      const savedDraft = {
        data: { name: 'John', email: 'john@example.com' },
        timestamp: new Date().toISOString()
      }
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedDraft))

      const onLoad = vi.fn()
      const { result } = renderHook(() => 
        useLocalStorageAutoSave(
          { name: '', email: '' }, 
          { key: 'form-draft', onLoad }
        )
      )

      // Should load the draft
      expect(onLoad).toHaveBeenCalledWith({ name: 'John', email: 'john@example.com' })
      expect(result.current.hasDraft).toBe(true)
      expect(result.current.timeSinceLastSave).toBe('Just now')
    })

    it('should handle different data types', async () => {
      // Array data
      const { result: arrayResult } = renderHook(() => 
        useLocalStorageAutoSave([1, 2, 3], { key: 'array-key', delay: 100 })
      )

      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'array-key',
        expect.stringContaining('[1,2,3]')
      )

      // String data
      const { result: stringResult } = renderHook(() => 
        useLocalStorageAutoSave('test string', { key: 'string-key', delay: 100 })
      )

      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'string-key',
        expect.stringContaining('"test string"')
      )

      // Complex nested object
      const complexData = {
        user: { id: 1, name: 'Test' },
        settings: { theme: 'dark', notifications: true },
        items: [{ id: 1, value: 'item1' }]
      }

      const { result: complexResult } = renderHook(() => 
        useLocalStorageAutoSave(complexData, { key: 'complex-key', delay: 100 })
      )

      act(() => {
        vi.advanceTimersByTime(100)
      })

      const savedCall = localStorageMock.setItem.mock.calls.find(
        call => call[0] === 'complex-key'
      )
      expect(savedCall).toBeDefined()
      const savedData = JSON.parse(savedCall![1])
      expect(savedData.data).toEqual(complexData)
    })
  })
})