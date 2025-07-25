import { useState, useEffect, useCallback, useRef } from 'react'

interface UseLocalStorageAutoSaveOptions {
  key: string
  delay?: number
  onSave?: () => void
  onLoad?: (data: any) => void
}

interface AutoSaveState {
  isSaving: boolean
  lastSaved: Date | null
  hasDraft: boolean
  timeSinceLastSave: string
}

export function useLocalStorageAutoSave<T>(
  data: T,
  options: UseLocalStorageAutoSaveOptions
): AutoSaveState & { clearDraft: () => void } {
  const { key, delay = 1000, onSave, onLoad } = options
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [hasDraft, setHasDraft] = useState(false)
  const [timeSinceLastSave, setTimeSinceLastSave] = useState('Never')
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isFirstMount = useRef(true)

  // Load draft on mount
  useEffect(() => {
    if (!isFirstMount.current) return
    isFirstMount.current = false
    
    const savedData = localStorage.getItem(key)
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        if (onLoad) {
          onLoad(parsed.data)
        }
        setHasDraft(true)
        setLastSaved(new Date(parsed.timestamp))
      } catch (error) {
        console.error('Failed to load draft:', error)
      }
    }
  }, [key, onLoad])

  // Update time since last save
  useEffect(() => {
    const updateTime = () => {
      if (!lastSaved) {
        setTimeSinceLastSave('Never')
        return
      }

      const now = new Date()
      const diff = now.getTime() - lastSaved.getTime()
      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)

      if (seconds < 10) {
        setTimeSinceLastSave('Just now')
      } else if (seconds < 60) {
        setTimeSinceLastSave(`${seconds} seconds ago`)
      } else if (minutes < 60) {
        setTimeSinceLastSave(`${minutes} minute${minutes > 1 ? 's' : ''} ago`)
      } else {
        setTimeSinceLastSave(`${hours} hour${hours > 1 ? 's' : ''} ago`)
      }
    }

    updateTime()
    intervalRef.current = setInterval(updateTime, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [lastSaved])

  // Auto-save logic
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    // Don't save if data is null/undefined
    if (data === null || data === undefined) {
      return
    }

    setIsSaving(true)

    saveTimerRef.current = setTimeout(() => {
      try {
        const saveData = {
          data,
          timestamp: new Date().toISOString()
        }
        localStorage.setItem(key, JSON.stringify(saveData))
        setLastSaved(new Date())
        setHasDraft(true)
        if (onSave) {
          onSave()
        }
      } catch (error) {
        console.error('Failed to auto-save:', error)
      } finally {
        setIsSaving(false)
      }
    }, delay)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [data, key, delay, onSave])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(key)
    setHasDraft(false)
    setLastSaved(null)
  }, [key])

  return {
    isSaving,
    lastSaved,
    hasDraft,
    timeSinceLastSave,
    clearDraft
  }
}