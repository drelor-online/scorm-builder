import { useState, useCallback } from 'react'

interface UseSearchHistoryOptions {
  maxItems?: number
  caseInsensitive?: boolean
}

interface UseSearchHistoryReturn {
  history: string[]
  addToHistory: (term: string) => void
  removeFromHistory: (term: string) => void
  clearHistory: () => void
  getFilteredHistory: (searchTerm: string) => string[]
}

// Helper to check if localStorage is available and accessible
const isLocalStorageAvailable = (): boolean => {
  try {
    const testKey = '__localStorage_test__'
    localStorage.setItem(testKey, 'test')
    localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

export function useSearchHistory(
  key: string,
  options: UseSearchHistoryOptions = {}
): UseSearchHistoryReturn {
  const { maxItems = 10, caseInsensitive = false } = options
  const storageKey = `searchHistory:${key}`
  const storageAvailable = isLocalStorageAvailable()

  const loadHistory = (): string[] => {
    if (!storageAvailable) {
      return []
    }
    
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          return parsed
        }
      }
    } catch (error) {
      // Silently fail to avoid console spam when storage is blocked
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.debug('Search history unavailable:', error)
      }
    }
    return []
  }

  const [history, setHistory] = useState<string[]>(loadHistory)

  const saveHistory = useCallback((newHistory: string[]) => {
    if (!storageAvailable) {
      return
    }
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(newHistory))
    } catch (error) {
      // Silently fail to avoid console spam
      if (process.env.NODE_ENV === 'development') {
        console.debug('Could not save search history:', error)
      }
    }
  }, [storageKey, storageAvailable])

  const addToHistory = useCallback((term: string) => {
    const trimmedTerm = term.trim()
    if (!trimmedTerm) return

    setHistory(prevHistory => {
      // Remove the term if it already exists
      const filtered = prevHistory.filter(item => item !== trimmedTerm)
      
      // Add the term to the beginning
      const newHistory = [trimmedTerm, ...filtered]
      
      // Limit the history size
      const limited = newHistory.slice(0, maxItems)
      
      // Save to localStorage
      saveHistory(limited)
      
      return limited
    })
  }, [maxItems, saveHistory])

  const removeFromHistory = useCallback((term: string) => {
    setHistory(prevHistory => {
      const newHistory = prevHistory.filter(item => item !== term)
      saveHistory(newHistory)
      return newHistory
    })
  }, [saveHistory])

  const clearHistory = useCallback(() => {
    setHistory([])
    
    if (!storageAvailable) {
      return
    }
    
    try {
      localStorage.removeItem(storageKey)
    } catch (error) {
      // Silently fail
      if (process.env.NODE_ENV === 'development') {
        console.debug('Could not clear search history:', error)
      }
    }
  }, [storageKey, storageAvailable])

  const getFilteredHistory = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return history

    return history.filter(item => {
      if (caseInsensitive) {
        return item.toLowerCase().includes(searchTerm.toLowerCase())
      }
      return item.includes(searchTerm)
    })
  }, [history, caseInsensitive])

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getFilteredHistory
  }
}