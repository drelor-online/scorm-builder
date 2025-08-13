import { useState, useEffect, useRef, useCallback } from 'react'

interface UseAutoSaveOptions<T> {
  data: T
  onSave: (data: T) => Promise<any>
  delay?: number
  onError?: (error: Error) => void
  onConflict?: (conflict: { localData: T; serverData: T }) => void
  disabled?: boolean
  ignoredKeys?: string[] // Keys to ignore when detecting changes
  minSaveInterval?: number // Minimum milliseconds between saves (default 5000)
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
  disabled = false,
  ignoredKeys = [],
  minSaveInterval = 5000 // Default 5 seconds minimum between saves
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousDataRef = useRef<T>(data)
  const mountedRef = useRef(true)
  const lastSaveTimeRef = useRef<number>(0) // Track last save time for debouncing

  // Remove ignored keys from an object for comparison
  const removeIgnoredKeys = useCallback((obj: any, keysToIgnore: string[]): any => {
    if (!obj || typeof obj !== 'object' || keysToIgnore.length === 0) {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(item => removeIgnoredKeys(item, keysToIgnore))
    }

    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      // Check if this key should be ignored (support nested paths like 'metadata.lastModified')
      const shouldIgnore = keysToIgnore.some(ignoredKey => {
        if (ignoredKey.includes('.')) {
          // For nested paths, only ignore if this is the first part of the path
          return key === ignoredKey.split('.')[0]
        }
        return key === ignoredKey
      })

      if (!shouldIgnore) {
        // For nested objects, recursively remove ignored keys
        if (value && typeof value === 'object') {
          // Handle nested paths by removing the first part of the path
          const nestedIgnoredKeys = keysToIgnore
            .filter(ignoredKey => ignoredKey.startsWith(`${key}.`))
            .map(ignoredKey => ignoredKey.substring(key.length + 1))
          
          result[key] = removeIgnoredKeys(value, nestedIgnoredKeys)
        } else {
          result[key] = value
        }
      }
    }
    return result
  }, [])

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
      // Remove ignored keys before comparison
      const cleanOldData = removeIgnoredKeys(oldData, ignoredKeys)
      const cleanNewData = removeIgnoredKeys(newData, ignoredKeys)
      
      const oldStr = safeStringify(cleanOldData)
      const newStr = safeStringify(cleanNewData)
      const hasChanged = oldStr !== newStr
      
      // Debug logging can be enabled for troubleshooting (disabled by default)
      if (hasChanged && false) { // Set to true for debugging
        console.log('[useAutoSave] Data change detected', {
          ignoredKeys,
          oldDataKeys: oldData && typeof oldData === 'object' ? Object.keys(oldData) : 'not object',
          newDataKeys: newData && typeof newData === 'object' ? Object.keys(newData) : 'not object',
          cleanOldDataKeys: cleanOldData && typeof cleanOldData === 'object' ? Object.keys(cleanOldData) : 'not object',
          cleanNewDataKeys: cleanNewData && typeof cleanNewData === 'object' ? Object.keys(cleanNewData) : 'not object'
        })
        
        // Show a sample of what changed (first 200 chars)
        if (oldStr !== newStr) {
          console.log('[useAutoSave] String comparison preview:', {
            oldDataPreview: oldStr.substring(0, 200) + (oldStr.length > 200 ? '...' : ''),
            newDataPreview: newStr.substring(0, 200) + (newStr.length > 200 ? '...' : '')
          })
        }
      }
      
      return hasChanged
    } catch (error) {
      console.warn('[useAutoSave] Error comparing data:', error)
      return true // Assume changed if comparison fails
    }
  }, [removeIgnoredKeys, ignoredKeys])

  // Perform save operation with debouncing
  const performSave = useCallback(async (dataToSave: T, skipDebounce = false) => {
    if (!mountedRef.current || disabled) return

    // Check if we should debounce this save
    const now = Date.now()
    const timeSinceLastSave = now - lastSaveTimeRef.current
    
    if (!skipDebounce && timeSinceLastSave < minSaveInterval) {
      console.log(`[useAutoSave] Debouncing save - only ${timeSinceLastSave}ms since last save (min: ${minSaveInterval}ms)`)
      return
    }

    try {
      setIsSaving(true)
      await onSave(dataToSave)
      
      if (mountedRef.current) {
        const saveTime = new Date()
        setLastSaved(saveTime)
        lastSaveTimeRef.current = saveTime.getTime()
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
  }, [onSave, onError, onConflict, disabled, minSaveInterval])

  // Force save immediately (bypasses debouncing)
  const forceSave = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    await performSave(data, true) // Skip debounce for forced saves
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