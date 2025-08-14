import { useState, useEffect, useRef, useCallback } from 'react'
import { useNotifications } from '../contexts/NotificationContext'

interface UseAutoSaveOptions<T> {
  data: T | null
  onSave: (data: T) => Promise<any>
  delay?: number
  onError?: (error: Error) => void
  onConflict?: (conflict: { localData: T; serverData: T }) => void
  disabled?: boolean
  isDirty: boolean
  onSaveComplete?: () => void
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
  isDirty,
  onSaveComplete,
  minSaveInterval = 5000 // Default 5 seconds minimum between saves
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)
  const lastSaveTimeRef = useRef<number>(0) // Track last save time for debouncing
  const notifications = useNotifications()
  const currentNotificationRef = useRef<string | null>(null)

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
      
      // Show autosave start notification
      currentNotificationRef.current = notifications.autoSaveStart()
      
      await onSave(dataToSave)
      
      if (mountedRef.current) {
        const saveTime = new Date()
        setLastSaved(saveTime)
        lastSaveTimeRef.current = saveTime.getTime()
        
        // Show success notification
        notifications.autoSaveSuccess()
        
        // Call onSaveComplete to reset dirty flag
        onSaveComplete?.()
      }
    } catch (error: any) {
      if (!mountedRef.current) return

      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (error.type === 'CONFLICT' && onConflict) {
        onConflict({
          localData: dataToSave,
          serverData: error.serverData
        })
      } else {
        // Show error notification with retry option
        notifications.autoSaveError(errorMessage, () => {
          // Retry save operation
          performSave(dataToSave, true)
        })
        
        // Also call the original error handler if provided
        if (onError) {
          onError(error instanceof Error ? error : new Error(errorMessage))
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsSaving(false)
        currentNotificationRef.current = null
      }
    }
  }, [onSave, onError, onConflict, disabled, minSaveInterval, notifications])

  // Force save immediately (bypasses debouncing)
  const forceSave = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (data !== null) {
      await performSave(data, true) // Skip debounce for forced saves
    }
  }, [data, performSave])

  // Set up auto-save effect based on isDirty flag
  useEffect(() => {
    // Only save if we have data, it's dirty, and not disabled
    if (disabled || !isDirty || !data) {
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
  }, [isDirty, data, delay, disabled, performSave])

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