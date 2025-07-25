import { useState, useEffect, useCallback, useRef } from 'react'
import { useDebounce } from './useDebounce'

interface DraftData {
  data: any
  timestamp: number
}

interface UseDraftAutoRecoveryOptions {
  debounceMs?: number
  maxAge?: number // Maximum age of draft in milliseconds
}

interface UseDraftAutoRecoveryReturn<T> {
  draft: T
  updateDraft: (newDraft: T) => void
  clearDraft: () => void
  recoverDraft: () => void
  hasDraft: boolean
  isDirty: boolean
}

export function useDraftAutoRecovery<T>(
  key: string,
  initialValue: T,
  options: UseDraftAutoRecoveryOptions = {}
): UseDraftAutoRecoveryReturn<T> {
  const { debounceMs = 500, maxAge = 24 * 60 * 60 * 1000 } = options // 24 hours default
  const storageKey = `draft:${key}`
  
  // Load initial draft from localStorage
  const loadDraft = useCallback((): { draft: T; hasSavedDraft: boolean } => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const draftData: DraftData = JSON.parse(saved)
        const age = Date.now() - draftData.timestamp
        
        if (age < maxAge) {
          return { draft: draftData.data, hasSavedDraft: true }
        } else {
          // Remove expired draft
          localStorage.removeItem(storageKey)
        }
      }
    } catch (error) {
      console.error('Failed to load draft:', error)
    }
    
    return { draft: initialValue, hasSavedDraft: false }
  }, [storageKey, initialValue, maxAge])
  
  const initialData = loadDraft()
  const [draft, setDraft] = useState<T>(initialData.draft)
  const [hasDraft, setHasDraft] = useState(initialData.hasSavedDraft)
  const [isDirty, setIsDirty] = useState(false)
  const savedDraftRef = useRef<T | null>(initialData.hasSavedDraft ? initialData.draft : null)
  const isMountedRef = useRef(false)
  
  // Debounced draft value for saving
  const debouncedDraft = useDebounce(draft, debounceMs)
  
  // Track mounting
  useEffect(() => {
    isMountedRef.current = true
  }, [])
  
  // Save draft to localStorage when debounced value changes
  useEffect(() => {
    // Skip first render and only save when dirty and mounted
    if (isDirty && isMountedRef.current) {
      try {
        const draftData: DraftData = {
          data: debouncedDraft,
          timestamp: Date.now()
        }
        localStorage.setItem(storageKey, JSON.stringify(draftData))
        savedDraftRef.current = debouncedDraft
        setHasDraft(true)
      } catch (error) {
        console.error('Failed to save draft:', error)
      }
    }
  }, [debouncedDraft, storageKey, isDirty])
  
  const updateDraft = useCallback((newDraft: T) => {
    setDraft(newDraft)
    setIsDirty(true)
  }, [])
  
  const clearDraft = useCallback(() => {
    setDraft(initialValue)
    setIsDirty(false)
    setHasDraft(false)
    savedDraftRef.current = null
    
    try {
      localStorage.removeItem(storageKey)
    } catch (error) {
      console.error('Failed to clear draft:', error)
    }
  }, [initialValue, storageKey])
  
  const recoverDraft = useCallback(() => {
    if (savedDraftRef.current !== null) {
      setDraft(savedDraftRef.current)
      setIsDirty(false)
    }
  }, [])
  
  return {
    draft,
    updateDraft,
    clearDraft,
    recoverDraft,
    hasDraft,
    isDirty
  }
}