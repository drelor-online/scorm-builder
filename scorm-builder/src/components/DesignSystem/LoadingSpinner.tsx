import React from 'react'
import { tokens } from './designTokens'
import './designSystem.css'

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  color?: string
  text?: string
  fullScreen?: boolean
  className?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = tokens.colors.primary[500],
  text,
  fullScreen = false,
  className = ''
}) => {
  const sizes = {
    small: '1rem',
    medium: '2rem',
    large: '3rem'
  }

  const spinner = (
    <div className={`loading-spinner-container ${className}`} style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: tokens.spacing.md
    }}>
      <div
        className="loading-spinner animate-spin"
        style={{
          width: sizes[size],
          height: sizes[size],
          border: `3px solid ${tokens.colors.background.quaternary}`,
          borderTopColor: color,
          borderRadius: '50%'
        }}
        role="status"
        aria-label="Loading"
      />
      {text && (
        <span style={{
          color: tokens.colors.text.secondary,
          fontSize: size === 'small' ? tokens.typography.fontSize.sm : tokens.typography.fontSize.base,
          marginTop: tokens.spacing.sm
        }}>
          {text}
        </span>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="loading-spinner-fullscreen" style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.colors.background.overlay,
        zIndex: tokens.zIndex.modal,
        backdropFilter: 'blur(4px)'
      }}>
        <div className="animate-fadeIn">
          {spinner}
        </div>
      </div>
    )
  }

  return spinner
}