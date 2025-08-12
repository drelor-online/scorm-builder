import React, { useState, useEffect } from 'react'
import { useAutoSaveState } from '../contexts/AutoSaveContext'

// Spinner component for saving state
const Spinner = () => (
  <svg 
    width="14" 
    height="14" 
    viewBox="0 0 24 24" 
    style={{ 
      animation: 'spin 1s linear infinite',
      display: 'inline-block',
      marginRight: '6px',
      verticalAlign: 'middle'
    }}
  >
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <circle 
      cx="12" 
      cy="12" 
      r="10" 
      stroke="currentColor" 
      strokeWidth="3" 
      fill="none" 
      strokeDasharray="31.4 31.4"
      strokeLinecap="round"
    />
  </svg>
)

// Checkmark icon for saved state
const CheckIcon = () => (
  <svg 
    width="14" 
    height="14" 
    viewBox="0 0 24 24" 
    fill="none"
    style={{ 
      display: 'inline-block',
      marginRight: '6px',
      verticalAlign: 'middle'
    }}
  >
    <path 
      d="M20 6L9 17L4 12" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
)

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
  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'all 0.2s ease',
    border: '1px solid transparent'
  }

  if (isSaving) {
    return (
      <span style={{ 
        ...containerStyle,
        color: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.2)'
      }}>
        <Spinner />
        Saving...
      </span>
    )
  }
  
  if (hasDraft) {
    return (
      <span style={{ 
        ...containerStyle,
        color: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.2)'
      }}>
        <CheckIcon />
        Saved {timeSinceLastSave}
      </span>
    )
  }
  
  return (
    <span style={{ 
      ...containerStyle,
      color: '#6b7280',
      backgroundColor: 'rgba(107, 114, 128, 0.05)',
      border: '1px solid rgba(107, 114, 128, 0.1)'
    }}>
      No changes
    </span>
  )
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