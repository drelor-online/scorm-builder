import React, { useEffect, useRef } from 'react'
import { Button } from './DesignSystem/Button'
import styles from './UnsavedChangesDialog.module.css'

interface UnsavedChangesDialogProps {
  isOpen: boolean
  currentProjectName: string
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  currentProjectName,
  onSave,
  onDiscard,
  onCancel
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFocusableRef = useRef<HTMLButtonElement>(null)

  // Focus management
  useEffect(() => {
    if (isOpen && firstFocusableRef.current) {
      firstFocusableRef.current.focus()
    }
  }, [isOpen])

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel()
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div 
      className={styles.dialogOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-dialog-title"
    >
      <div className={styles.dialogContent} ref={dialogRef}>
        {/* Header */}
        <div className={styles.dialogHeader}>
          <h2 id="unsaved-dialog-title" className={styles.dialogTitle}>
            Unsaved Changes
          </h2>
        </div>

        {/* Content */}
        <div className={styles.dialogBody}>
          <p className={styles.dialogMessage}>
            You have unsaved changes in <span className={styles.projectName}>{currentProjectName}</span>.
          </p>
          <p className={styles.dialogMessage}>
            Would you like to save before opening a new project?
          </p>
        </div>

        {/* Actions */}
        <div className={styles.dialogFooter}>
          <div className={styles.buttonGroup}>
            <Button
              ref={firstFocusableRef}
              onClick={onCancel}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={onDiscard}
              variant="danger"
            >
              Discard Changes
            </Button>
            <Button
              onClick={onSave}
              variant="primary"
            >
              Save Project
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}