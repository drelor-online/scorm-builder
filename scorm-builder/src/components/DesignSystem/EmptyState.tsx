import React from 'react'
import { COLORS, SPACING } from '../../constants'
import { Button } from './Button'
import './designSystem.css'

export interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

const EmptyStateComponent: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div 
      className={`empty-state ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING['3xl'],
        textAlign: 'center',
        minHeight: '300px'
      }}
    >
      <div 
        className="empty-state-icon"
        style={{
          fontSize: '3rem',
          marginBottom: SPACING.lg,
          opacity: 0.5
        }}
      >
        {icon}
      </div>
      
      <h3 
        className="empty-state-title"
        style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          color: COLORS.text,
          marginBottom: SPACING.sm,
          margin: 0
        }}
      >
        {title}
      </h3>
      
      {description && (
        <p 
          className="empty-state-description"
          style={{
            fontSize: '0.875rem',
            color: COLORS.textMuted,
            marginBottom: SPACING.xl,
            maxWidth: '400px'
          }}
        >
          {description}
        </p>
      )}
      
      {action && (
        <Button
          onClick={action.onClick}
          variant="primary"
          size="medium"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}

export const EmptyState = React.memo(EmptyStateComponent)