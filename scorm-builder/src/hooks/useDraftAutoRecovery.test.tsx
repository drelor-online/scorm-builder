import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDraftAutoRecovery } from './useDraftAutoRecovery'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
})

describe('useDraftAutoRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return initial draft state', () => {
    const { result } = renderHook(() => 
      useDraftAutoRecovery('test-key', { name: 'initial' })
    )
    
    expect(result.current.draft).toEqual({ name: 'initial' })
    expect(result.current.hasDraft).toBe(false)
    expect(result.current.isDirty).toBe(false)
  })

  it('should load existing draft from localStorage', () => {
    const savedDraft = { name: 'saved draft' }
    localStorageMock.getItem.mockReturnValue(JSON.stringify({
      data: savedDraft,
      timestamp: Date.now()
    }))
    
    const { result } = renderHook(() => 
      useDraftAutoRecovery('test-key', { name: 'initial' })
    )
    
    expect(result.current.draft).toEqual(savedDraft)
    expect(result.current.hasDraft).toBe(true)
    expect(result.current.isDirty).toBe(false)
  })

  it('should update draft and mark as dirty', async () => {
    const { result } = renderHook(() => 
      useDraftAutoRecovery('test-key', { name: 'initial' })
    )
    
    act(() => {
      result.current.updateDraft({ name: 'updated' })
    })
    
    expect(result.current.draft).toEqual({ name: 'updated' })
    expect(result.current.isDirty).toBe(true)
    
    // Should save to localStorage after debounce
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'draft:test-key',
        expect.stringContaining('"name":"updated"')
      )
    }, { timeout: 1000 })
  })

  it('should clear draft', () => {
    const { result } = renderHook(() => 
      useDraftAutoRecovery('test-key', { name: 'initial' })
    )
    
    act(() => {
      result.current.updateDraft({ name: 'updated' })
    })
    
    act(() => {
      result.current.clearDraft()
    })
    
    expect(result.current.draft).toEqual({ name: 'initial' })
    expect(result.current.isDirty).toBe(false)
    expect(result.current.hasDraft).toBe(false)
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('draft:test-key')
  })

  it('should recover draft', () => {
    const savedDraft = { name: 'saved draft' }
    localStorageMock.getItem.mockReturnValue(JSON.stringify({
      data: savedDraft,
      timestamp: Date.now()
    }))
    
    const { result } = renderHook(() => 
      useDraftAutoRecovery('test-key', { name: 'initial' })
    )
    
    // Initially shows saved draft
    expect(result.current.draft).toEqual(savedDraft)
    
    // Update to something else
    act(() => {
      result.current.updateDraft({ name: 'new value' })
    })
    
    // Recover the saved draft
    act(() => {
      result.current.recoverDraft()
    })
    
    expect(result.current.draft).toEqual(savedDraft)
  })

  it('should handle draft expiration', () => {
    const oldDraft = { name: 'old draft' }
    const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
    
    localStorageMock.getItem.mockReturnValue(JSON.stringify({
      data: oldDraft,
      timestamp: oldTimestamp
    }))
    
    const { result } = renderHook(() => 
      useDraftAutoRecovery('test-key', { name: 'initial' }, {
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      })
    )
    
    // Should not load expired draft
    expect(result.current.draft).toEqual({ name: 'initial' })
    expect(result.current.hasDraft).toBe(false)
  })

  it('should debounce saves', async () => {
    // Use unique key to avoid cross-test interference
    const uniqueKey = 'test-key-debounce'
    
    // Use real timers for this test since fake timers don't play well with hooks
    const { result } = renderHook(() => 
      useDraftAutoRecovery(uniqueKey, { name: 'initial' }, {
        debounceMs: 100 // Shorter delay for testing
      })
    )
    
    // Wait a bit for initial setup
    await waitFor(() => {
      // Wait for component to stabilize
    }, { timeout: 50 })
    
    // Clear any previous calls
    localStorageMock.setItem.mockClear()
    
    // Make multiple rapid updates
    act(() => {
      result.current.updateDraft({ name: 'update1' })
      result.current.updateDraft({ name: 'update2' })
      result.current.updateDraft({ name: 'update3' })
    })
    
    // Wait for debounce
    await waitFor(() => {
      // Check that the last update was saved
      const calls = localStorageMock.setItem.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall).toBeDefined()
      expect(lastCall[0]).toBe(`draft:${uniqueKey}`)
      expect(lastCall[1]).toContain('"name":"update3"')
    }, { timeout: 200 })
  })

  it('should handle localStorage errors gracefully', () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    
    const { result } = renderHook(() => 
      useDraftAutoRecovery('test-key', { name: 'initial' })
    )
    
    // Should not throw when updating
    expect(() => {
      act(() => {
        result.current.updateDraft({ name: 'updated' })
      })
    }).not.toThrow()
  })
})