import React from 'react'
import { useAutoSaveState } from '../contexts/AutoSaveContext'
import styles from './AutoSaveBadge.module.css'

interface AutoSaveBadgeProps {
  className?: string
  isManualSaving?: boolean
}

export const AutoSaveBadge: React.FC<AutoSaveBadgeProps> = ({ className, isManualSaving }) => {
  const { isSaving, hasUnsavedChanges, lastSaved } = useAutoSaveState()

  // Don't show badge if no unsaved changes and not saving
  if (!hasUnsavedChanges && !isSaving) {
    return null
  }

  const getBadgeText = () => {
    if (isSaving) {
      return isManualSaving ? 'Saving...' : 'Auto-saving...'
    }
    if (hasUnsavedChanges) {
      return 'Unsaved changes'
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