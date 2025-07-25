import React from 'react'
import { tokens } from './designTokens'

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
      backgroundColor: 'rgba(63, 63, 70, 0.5)',
      borderColor: tokens.colors.secondary.border,
      color: tokens.colors.gray[300]
    },
    success: {
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      borderColor: '#22c55e',
      color: '#86efac'
    },
    warning: {
      backgroundColor: 'rgba(251, 191, 36, 0.1)',
      borderColor: '#fbbf24',
      color: '#fde68a'
    },
    error: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderColor: '#ef4444',
      color: '#fca5a5'
    }
  }

  const variantStyles = variants[variant]

  return (
    <div 
      role="alert"
      className={`alert alert-${variant} ${className}`}
      style={{
        padding: tokens.spacing.lg,
        borderRadius: tokens.borderRadius.md,
        border: `1px solid ${variantStyles.borderColor}`,
        backgroundColor: variantStyles.backgroundColor,
        color: variantStyles.color,
        fontSize: tokens.typography.fontSize.sm
      }}
    >
      {children}
    </div>
  )
}