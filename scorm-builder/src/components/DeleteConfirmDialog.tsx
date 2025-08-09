import React, { useEffect, useRef } from 'react'
import { Button } from './DesignSystem/Button'
import styles from './DeleteConfirmDialog.module.css'

interface DeleteConfirmDialogProps {
  isOpen: boolean
  projectName: string
  onConfirm: () => void
  onCancel: () => void
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  projectName,
  onConfirm,
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
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-description"
    >
      <div 
        ref={dialogRef}
        className={styles.dialogContent}
        tabIndex={-1}
      >
        {/* Header */}
        <div className={styles.dialogHeader}>
          <h2 
            id="delete-dialog-title"
            className={styles.dialogTitle}
          >
            Delete Project
          </h2>
        </div>

        {/* Content */}
        <div className={styles.dialogBody}>
          <p 
            id="delete-dialog-description"
            className={styles.dialogMessage}
          >
            Are you sure you want to delete "{projectName}"?
          </p>
          <p className={styles.dialogWarning}>
            This action cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className={styles.dialogActions}>
          <Button
            ref={firstFocusableRef}
            onClick={onCancel}
            variant="secondary"
            size="medium"
            aria-label="Cancel deletion"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant="danger"
            size="medium"
            aria-label={`Delete project ${projectName}`}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}