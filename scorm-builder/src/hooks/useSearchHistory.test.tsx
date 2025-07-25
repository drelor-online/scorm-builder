import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSearchHistory } from './useSearchHistory'

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

describe('useSearchHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('should return empty history initially', () => {
    const { result } = renderHook(() => useSearchHistory('test-key'))
    
    expect(result.current.history).toEqual([])
  })

  it('should load history from localStorage', () => {
    const savedHistory = ['search1', 'search2', 'search3']
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedHistory))
    
    const { result } = renderHook(() => useSearchHistory('test-key'))
    
    expect(result.current.history).toEqual(savedHistory)
    expect(localStorageMock.getItem).toHaveBeenCalledWith('searchHistory:test-key')
  })

  it('should add search term to history', () => {
    const { result } = renderHook(() => useSearchHistory('test-key'))
    
    act(() => {
      result.current.addToHistory('new search')
    })
    
    expect(result.current.history).toEqual(['new search'])
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'searchHistory:test-key',
      JSON.stringify(['new search'])
    )
  })

  it('should not add duplicate search terms', () => {
    const { result } = renderHook(() => useSearchHistory('test-key'))
    
    act(() => {
      result.current.addToHistory('search term')
      result.current.addToHistory('search term')
    })
    
    expect(result.current.history).toEqual(['search term'])
  })

  it('should move existing term to front when searched again', () => {
    const savedHistory = ['old1', 'old2', 'old3']
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedHistory))
    
    const { result } = renderHook(() => useSearchHistory('test-key'))
    
    act(() => {
      result.current.addToHistory('old2')
    })
    
    expect(result.current.history).toEqual(['old2', 'old1', 'old3'])
  })

  it('should limit history size', () => {
    const { result } = renderHook(() => useSearchHistory('test-key', { maxItems: 3 }))
    
    act(() => {
      result.current.addToHistory('search1')
      result.current.addToHistory('search2')
      result.current.addToHistory('search3')
      result.current.addToHistory('search4')
    })
    
    expect(result.current.history).toEqual(['search4', 'search3', 'search2'])
  })

  it('should remove item from history', () => {
    const savedHistory = ['item1', 'item2', 'item3']
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedHistory))
    
    const { result } = renderHook(() => useSearchHistory('test-key'))
    
    act(() => {
      result.current.removeFromHistory('item2')
    })
    
    expect(result.current.history).toEqual(['item1', 'item3'])
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'searchHistory:test-key',
      JSON.stringify(['item1', 'item3'])
    )
  })

  it('should clear history', () => {
    const savedHistory = ['item1', 'item2', 'item3']
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedHistory))
    
    const { result } = renderHook(() => useSearchHistory('test-key'))
    
    act(() => {
      result.current.clearHistory()
    })
    
    expect(result.current.history).toEqual([])
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('searchHistory:test-key')
  })

  it('should filter history by search term', () => {
    const savedHistory = ['apple', 'banana', 'apricot', 'orange']
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedHistory))
    
    const { result } = renderHook(() => useSearchHistory('test-key'))
    
    const filtered = result.current.getFilteredHistory('ap')
    expect(filtered).toEqual(['apple', 'apricot'])
  })

  it('should handle empty search terms', () => {
    const { result } = renderHook(() => useSearchHistory('test-key'))
    
    act(() => {
      result.current.addToHistory('')
      result.current.addToHistory('   ')
    })
    
    expect(result.current.history).toEqual([])
  })

  it('should handle localStorage errors gracefully', () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    
    const { result } = renderHook(() => useSearchHistory('test-key'))
    
    // Should not throw when adding to history
    expect(() => {
      act(() => {
        result.current.addToHistory('test')
      })
    }).not.toThrow()
    
    // History should still be updated in memory
    expect(result.current.history).toEqual(['test'])
  })

  it('should handle corrupted localStorage data', () => {
    localStorageMock.getItem.mockReturnValue('invalid json')
    
    const { result } = renderHook(() => useSearchHistory('test-key'))
    
    // Should return empty history when data is corrupted
    expect(result.current.history).toEqual([])
  })

  it('should support case-insensitive filtering', () => {
    const savedHistory = ['Apple', 'banana', 'APRICOT']
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedHistory))
    
    const { result } = renderHook(() => useSearchHistory('test-key', {
      caseInsensitive: true
    }))
    
    const filtered = result.current.getFilteredHistory('AP')
    expect(filtered).toEqual(['Apple', 'APRICOT'])
  })
})