import React from 'react'
import { commonButtons, getButtonStyle } from '../styles/buttonStyles'
import { tokens } from './DesignSystem/designTokens'

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
  if (!isOpen) return null

  return (
    <div className="dialog-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1001
    }}>
      <div className="dialog-content" style={{
        backgroundColor: '#18181b',
        borderRadius: '0.75rem',
        border: `1px solid ${tokens.colors.border.default}`,
        width: '90%',
        maxWidth: '500px',
        color: '#f4f4f5'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #3f3f46'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            margin: 0,
            color: '#fbbf24'
          }}>Unsaved Changes</h2>
        </div>

        {/* Content */}
        <div style={{
          padding: '2rem 1.5rem'
        }}>
          <p style={{
            fontSize: '1rem',
            lineHeight: 1.6,
            margin: '0 0 1rem 0'
          }}>
            You have unsaved changes in "{currentProjectName}".
          </p>
          <p style={{
            fontSize: '0.875rem',
            color: '#a1a1aa',
            margin: 0
          }}>
            Would you like to save before opening a new project?
          </p>
        </div>

        {/* Actions */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #3f3f46',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          <button
            onClick={onCancel}
            style={commonButtons.cancel}
          >
            Cancel
          </button>
          <button
            onClick={onDiscard}
            style={getButtonStyle('danger', 'medium', {
              backgroundColor: 'transparent',
              border: '1px solid #ef4444'
            })}
          >
            Discard Changes
          </button>
          <button
            onClick={onSave}
            style={commonButtons.submit}
          >
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  )
}