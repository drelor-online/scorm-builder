import React, { useEffect, useState } from 'react'
import { useAutoSaveState } from '../contexts/AutoSaveContext'
import styles from './AutoSaveBadge.module.css'

interface AutoSaveBadgeProps {
  className?: string
}

export const AutoSaveBadge: React.FC<AutoSaveBadgeProps> = ({ className }) => {
  const { isSaving, hasUnsavedChanges, lastSaved, isManualSave } = useAutoSaveState()
  const [, forceRender] = useState(0)

  // Show "All changes saved" briefly after saving completes
  const showSavedMessage = !hasUnsavedChanges && !isSaving && lastSaved && 
    (new Date().getTime() - lastSaved.getTime()) < 3000 // Show for 3 seconds after save

  // Force re-render to hide saved message after timeout
  useEffect(() => {
    if (showSavedMessage) {
      const timeout = setTimeout(() => {
        forceRender(prev => prev + 1)
      }, 3000)
      return () => clearTimeout(timeout)
    }
  }, [showSavedMessage])

  // Don't show badge if no unsaved changes, not saving, and not showing saved message
  if (!hasUnsavedChanges && !isSaving && !showSavedMessage) {
    return null
  }

  const getBadgeText = () => {
    if (isSaving) {
      return 'Saving...'
    }
    if (hasUnsavedChanges) {
      return 'Unsaved changes'
    }
    if (showSavedMessage) {
      return 'All changes saved'
    }
    return null
  }

  const getBadgeVariant = () => {
    if (isSaving) {
      return 'saving'
    }
    if (hasUnsavedChanges) {
      return 'unsaved'
    }
    if (showSavedMessage) {
      return 'saved'
    }
    return 'saved'
  }

  const badgeText = getBadgeText()
  if (!badgeText) return null

  return (
    <div 
      className={`${styles.autoSaveBadge} ${styles[`badge-${getBadgeVariant()}`]} ${className || ''}`}
      role="status"
      aria-live="polite"
      aria-label={badgeText}
    >
      {isSaving && (
        <div className={styles.spinner} aria-hidden="true">
          <div className={styles.spinnerIcon}></div>
        </div>
      )}
      <span className={styles.badgeText}>{badgeText}</span>
      {lastSaved && !isSaving && hasUnsavedChanges && (
        <span className={styles.lastSaved} title={`Last saved: ${lastSaved.toLocaleString()}`}>
          {formatRelativeTime(lastSaved)}
        </span>
      )}
    </div>
  )
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return 'just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes}m ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours}h ago`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days}d ago`
  }
}