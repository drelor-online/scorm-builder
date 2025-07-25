import React from 'react'
import { commonButtons, getButtonStyle } from '../styles/buttonStyles'
import { tokens } from './DesignSystem/designTokens'

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
      zIndex: 1100 // Higher than modal (1050) to ensure it appears on top
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
            color: '#ef4444'
          }}>Delete Project</h2>
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
            Are you sure you want to delete "{projectName}"?
          </p>
          <p style={{
            fontSize: '0.875rem',
            color: '#a1a1aa',
            margin: 0
          }}>
            This action cannot be undone.
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
            onClick={onConfirm}
            style={getButtonStyle('danger', 'medium')}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}