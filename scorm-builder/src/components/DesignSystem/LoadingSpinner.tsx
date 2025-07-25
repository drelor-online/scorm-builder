import React from 'react'
import { COLORS, SPACING } from '../../constants'
import './designSystem.css'

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  color?: string
  text?: string
  fullScreen?: boolean
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = COLORS.primary,
  text,
  fullScreen = false
}) => {
  const sizes = {
    small: '1rem',
    medium: '2rem',
    large: '3rem'
  }

  const spinner = (
    <div className="loading-spinner-container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: SPACING.md
    }}>
      <div
        className="loading-spinner"
        style={{
          width: sizes[size],
          height: sizes[size],
          border: `3px solid ${COLORS.backgroundLighter}`,
          borderTopColor: color,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
        role="status"
        aria-label="Loading"
      />
      {text && (
        <span style={{
          color: COLORS.textMuted,
          fontSize: size === 'small' ? '0.875rem' : '1rem'
        }}>
          {text}
        </span>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000
      }}>
        {spinner}
      </div>
    )
  }

  return spinner
}

// Add CSS animation for spinner
const spinnerStyles = `
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.textContent = spinnerStyles
  document.head.appendChild(styleElement)
}