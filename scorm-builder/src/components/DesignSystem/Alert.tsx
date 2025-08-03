import React from 'react'
import { tokens } from './designTokens'
import './transitions.css'

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error'
  children: React.ReactNode
  className?: string
}

export const Alert: React.FC<AlertProps> = ({ 
  variant = 'info', 
  children,
  className = ''
}) => {
  const variants = {
    info: {
      backgroundColor: tokens.colors.alert.info.background,
      borderColor: tokens.colors.alert.info.border,
      color: tokens.colors.alert.info.text
    },
    success: {
      backgroundColor: tokens.colors.alert.success.background,
      borderColor: tokens.colors.alert.success.border,
      color: tokens.colors.alert.success.text
    },
    warning: {
      backgroundColor: tokens.colors.alert.warning.background,
      borderColor: tokens.colors.alert.warning.border,
      color: tokens.colors.alert.warning.text
    },
    error: {
      backgroundColor: tokens.colors.alert.danger.background,
      borderColor: tokens.colors.alert.danger.border,
      color: tokens.colors.alert.danger.text
    }
  }

  const variantStyles = variants[variant]

  return (
    <div 
      role="alert"
      className={`alert alert-${variant} ${className} animate-fadeInDown notification-slide`}
      style={{
        padding: `${tokens.spacing.lg} ${tokens.spacing.xl}`,
        marginTop: tokens.spacing.lg,
        marginBottom: tokens.spacing.xl,
        borderRadius: tokens.borderRadius.md,
        border: `1px solid ${variantStyles.borderColor}`,
        backgroundColor: variantStyles.backgroundColor,
        color: variantStyles.color,
        fontSize: tokens.typography.fontSize.sm,
        lineHeight: tokens.typography.lineHeight.relaxed
      }}
    >
      {children}
    </div>
  )
}