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

export function useSearchHistory(
  key: string,
  options: UseSearchHistoryOptions = {}
): UseSearchHistoryReturn {
  const { maxItems = 10, caseInsensitive = false } = options
  const storageKey = `searchHistory:${key}`

  const loadHistory = (): string[] => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          return parsed
        }
      }
    } catch (error) {
      console.error('Failed to load search history:', error)
    }
    return []
  }

  const [history, setHistory] = useState<string[]>(loadHistory)

  const saveHistory = useCallback((newHistory: string[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newHistory))
    } catch (error) {
      console.error('Failed to save search history:', error)
    }
  }, [storageKey])

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
    try {
      localStorage.removeItem(storageKey)
    } catch (error) {
      console.error('Failed to clear search history:', error)
    }
  }, [storageKey])

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