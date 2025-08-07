import React, { useState, useEffect } from 'react'
import { useAutoSaveState } from '../contexts/AutoSaveContext'

// Simple inline AutoSaveIndicator component
const AutoSaveIndicator = ({ 
  isSaving, 
  hasDraft, 
  timeSinceLastSave 
}: { 
  isSaving: boolean; 
  hasDraft: boolean; 
  timeSinceLastSave: string 
}) => {
  if (isSaving) {
    return <span style={{ color: '#a1a1aa', fontSize: '0.875rem' }}>Saving...</span>
  }
  if (hasDraft) {
    return <span style={{ color: '#10b981', fontSize: '0.875rem' }}>Saved {timeSinceLastSave}</span>
  }
  return <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>No changes</span>
}

/**
 * Connected version of AutoSaveIndicator that uses the AutoSaveContext
 * This ensures all pages show the same autosave state from FileStorage
 */
export const AutoSaveIndicatorConnected: React.FC = () => {
  const { isSaving, lastSaved } = useAutoSaveState()
  const [timeSinceLastSave, setTimeSinceLastSave] = useState('Never')

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
        setTimeSinceLastSave('just now')
      } else if (seconds < 60) {
        setTimeSinceLastSave(`${seconds}s ago`)
      } else if (minutes < 60) {
        setTimeSinceLastSave(`${minutes}m ago`)
      } else {
        setTimeSinceLastSave(`${hours}h ago`)
      }
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [lastSaved])

  return (
    <AutoSaveIndicator
      isSaving={isSaving}
      hasDraft={lastSaved !== null}
      timeSinceLastSave={timeSinceLastSave}
    />
  )
}