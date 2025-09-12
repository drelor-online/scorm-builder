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
  showNotifications?: boolean // Whether to show auto-save notifications (default true)
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
  minSaveInterval = 5000, // Default 5 seconds minimum between saves
  showNotifications = true // Default to showing notifications
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)
  const lastSaveTimeRef = useRef<number>(0) // Track last save time for debouncing
  const notifications = useNotifications()
  const currentNotificationRef = useRef<string | null>(null)
  
  // Race condition protection
  const savingPromiseRef = useRef<Promise<any> | null>(null)
  const pendingDataRef = useRef<T | null>(null)

  // Perform save operation with race condition protection
  const performSave = useCallback(async (dataToSave: T, skipDebounce = false) => {
    if (!mountedRef.current || disabled) return

    // Race condition protection: if a save is already in flight
    if (savingPromiseRef.current) {
      console.log('[useAutoSave] Save already in progress, queuing data for coalescing')
      // Store the latest data for coalescing
      pendingDataRef.current = dataToSave
      return
    }

    // Check if we should debounce this save
    const now = Date.now()
    const timeSinceLastSave = now - lastSaveTimeRef.current
    
    if (!skipDebounce && timeSinceLastSave < minSaveInterval) {
      console.log(`[useAutoSave] Debouncing save - only ${timeSinceLastSave}ms since last save (min: ${minSaveInterval}ms)`)
      return
    }

    try {
      setIsSaving(true)
      
      // Show autosave start notification only if enabled
      if (showNotifications) {
        currentNotificationRef.current = notifications.autoSaveStart()
      }
      
      // Create and store the save promise
      const savePromise = onSave(dataToSave)
      savingPromiseRef.current = savePromise
      
      await savePromise
      
      if (mountedRef.current) {
        const saveTime = new Date()
        setLastSaved(saveTime)
        lastSaveTimeRef.current = saveTime.getTime()
        
        // Show success notification only if enabled
        if (showNotifications) {
          notifications.autoSaveSuccess()
        }
        
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
        savingPromiseRef.current = null // Clear the save promise
        
        // Check if there's pending data to save (coalescing)
        if (pendingDataRef.current) {
          console.log('[useAutoSave] Processing queued save with latest data')
          const queuedData = pendingDataRef.current
          pendingDataRef.current = null
          
          // Schedule the queued save after a small delay to avoid immediate re-execution
          setTimeout(() => {
            performSave(queuedData, true)
          }, 100)
        }
      }
    }
  }, [onSave, onError, onConflict, disabled, minSaveInterval, notifications, showNotifications])

  // Force save immediately (bypasses debouncing but respects race condition protection)
  const forceSave = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    if (data !== null) {
      // If a save is in progress, wait for it to complete then save latest data
      if (savingPromiseRef.current) {
        console.log('[useAutoSave] Force save waiting for in-flight save to complete')
        try {
          await savingPromiseRef.current
        } catch {
          // Ignore errors from the previous save, we'll try with new data
        }
      }
      
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