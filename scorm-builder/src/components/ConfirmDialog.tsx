import React from 'react'
import { Button } from './DesignSystem/Button'
import { tokens } from './DesignSystem/designTokens'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null

  const getTitleColor = () => {
    switch (variant) {
      case 'danger':
        return tokens.colors.danger[500]
      case 'warning':
        return tokens.colors.warning[400]
      case 'info':
        return tokens.colors.info[500]
      default:
        return tokens.colors.text.primary
    }
  }

  const getButtonVariant = () => {
    switch (variant) {
      case 'danger':
        return 'danger'
      case 'warning':
        return 'primary'
      case 'info':
        return 'primary'
      default:
        return 'primary'
    }
  }

  return (
    <div 
      className="dialog-overlay" 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
      onClick={onCancel}
    >
      <div 
        className="dialog-content" 
        style={{
          backgroundColor: tokens.colors.background.secondary,
          borderRadius: tokens.borderRadius.lg,
          border: `1px solid ${tokens.colors.border.default}`,
          width: '90%',
          maxWidth: '500px',
          color: tokens.colors.text.primary,
          boxShadow: tokens.shadows.xl,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: tokens.spacing.xl,
          borderBottom: `1px solid ${tokens.colors.border.default}`
        }}>
          <h2 style={{
            fontSize: tokens.typography.fontSize.xl,
            fontWeight: 600,
            margin: 0,
            color: getTitleColor()
          }}>{title}</h2>
        </div>

        {/* Content */}
        <div style={{
          padding: `${tokens.spacing['2xl']} ${tokens.spacing.xl}`
        }}>
          <p style={{
            fontSize: tokens.typography.fontSize.base,
            lineHeight: 1.6,
            margin: 0,
            color: tokens.colors.text.primary
          }}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div style={{
          padding: `${tokens.spacing.lg} ${tokens.spacing.xl}`,
          borderTop: `1px solid ${tokens.colors.border.default}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: tokens.spacing.md
        }}>
          <Button
            variant="secondary"
            onClick={onCancel}
          >
            {cancelText}
          </Button>
          <Button
            variant={getButtonVariant() as any}
            onClick={onConfirm}
            data-testid="button-confirm"
          >
            {confirmText}
          </Button>
        </div>
      </div>

    </div>
  )
}