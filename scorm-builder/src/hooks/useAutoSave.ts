import { useState, useEffect, useRef, useCallback } from 'react'

interface UseAutoSaveOptions<T> {
  data: T
  onSave: (data: T) => Promise<any>
  delay?: number
  onError?: (error: Error) => void
  onConflict?: (conflict: { localData: T; serverData: T }) => void
  disabled?: boolean
}

interface UseAutoSaveResult {
  isSaving: boolean
  lastSaved: Date | null
  forceSave: () => Promise<void>
}

export function useAutoSave<T>({
  data,
  onSave,
  delay = 2000,
  onError,
  onConflict,
  disabled = false
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousDataRef = useRef<T>(data)
  const mountedRef = useRef(true)

  // Safe JSON stringify that handles circular references
  const safeStringify = (obj: any): string => {
    const seen = new WeakSet()
    return JSON.stringify(obj, (_key, value) => {
      if (value && typeof value === 'object') {
        if (seen.has(value)) {
          return '[Circular]'
        }
        seen.add(value)
      }
      return value
    })
  }

  // Check if data has changed
  const hasDataChanged = useCallback((oldData: T, newData: T): boolean => {
    try {
      return safeStringify(oldData) !== safeStringify(newData)
    } catch (error) {
      console.warn('[useAutoSave] Error comparing data:', error)
      return true // Assume changed if comparison fails
    }
  }, [])

  // Perform save operation
  const performSave = useCallback(async (dataToSave: T) => {
    if (!mountedRef.current || disabled) return

    try {
      setIsSaving(true)
      await onSave(dataToSave)
      
      if (mountedRef.current) {
        setLastSaved(new Date())
        previousDataRef.current = dataToSave
      }
    } catch (error: any) {
      if (!mountedRef.current) return

      if (error.type === 'CONFLICT' && onConflict) {
        onConflict({
          localData: dataToSave,
          serverData: error.serverData
        })
      } else if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)))
      }
    } finally {
      if (mountedRef.current) {
        setIsSaving(false)
      }
    }
  }, [onSave, onError, onConflict, disabled])

  // Force save immediately
  const forceSave = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    await performSave(data)
  }, [data, performSave])

  // Set up auto-save effect
  useEffect(() => {
    if (disabled) return

    // Check if data has changed
    if (!hasDataChanged(previousDataRef.current, data)) {
      return
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout for save
    timeoutRef.current = setTimeout(() => {
      performSave(data)
    }, delay)

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [data, delay, disabled, hasDataChanged, performSave])

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  return {
    isSaving,
    lastSaved,
    forceSave
  }
}