import React from 'react'
import { Button } from './Button'
import { Icon } from './Icons'
import { tokens } from './designTokens'
import './designSystem.css'
import { LucideIcon, FileX, AlertCircle, CheckCircle, Inbox } from 'lucide-react'

export interface EmptyStateProps {
  icon?: LucideIcon | React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  variant?: 'default' | 'error' | 'success' | 'info'
  size?: 'small' | 'medium' | 'large'
  className?: string
}

const EmptyStateComponent: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  size = 'medium',
  className = ''
}) => {
  // Default icons for variants
  const defaultIcons: Record<string, LucideIcon> = {
    default: Inbox,
    error: FileX,
    success: CheckCircle,
    info: AlertCircle
  }

  // Icon colors for variants
  const iconColors: Record<string, string> = {
    default: tokens.colors.secondary[400],
    error: tokens.colors.danger[500],
    success: tokens.colors.success[500],
    info: tokens.colors.info[500]
  }

  // Size configurations
  const sizeConfig = {
    small: {
      minHeight: '200px',
      iconSize: 'xl' as const,
      titleSize: '1rem',
      descSize: '0.75rem',
      padding: tokens.spacing.xl
    },
    medium: {
      minHeight: '300px',
      iconSize: 'xl' as const,
      titleSize: '1.25rem',
      descSize: '0.875rem',
      padding: tokens.spacing['2xl']
    },
    large: {
      minHeight: '400px',
      iconSize: 'xl' as const,
      titleSize: '1.5rem',
      descSize: '1rem',
      padding: tokens.spacing['3xl']
    }
  }

  const config = sizeConfig[size]
  const displayIcon = icon || defaultIcons[variant]
  const isLucideIcon = displayIcon && typeof displayIcon === 'function'

  return (
    <div 
      className={`empty-state empty-state-${variant} empty-state-${size} ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: config.padding,
        textAlign: 'center',
        minHeight: config.minHeight,
        backgroundColor: tokens.colors.background.secondary,
        borderRadius: tokens.borderRadius.lg,
        border: `1px solid ${tokens.colors.border.light}`
      }}
    >
      <div 
        className="empty-state-icon animate-fadeIn"
        style={{
          marginBottom: tokens.spacing.lg,
          color: iconColors[variant],
          opacity: 0.8
        }}
      >
        {isLucideIcon ? (
          <Icon icon={displayIcon as LucideIcon} size={config.iconSize} />
        ) : (
          displayIcon
        )}
      </div>
      
      <h3 
        className="empty-state-title"
        style={{
          fontSize: config.titleSize,
          fontWeight: 600,
          color: tokens.colors.text.primary,
          marginBottom: tokens.spacing.sm,
          margin: 0
        }}
      >
        {title}
      </h3>
      
      {description && (
        <p 
          className="empty-state-description"
          style={{
            fontSize: config.descSize,
            color: tokens.colors.text.secondary,
            marginBottom: tokens.spacing.xl,
            maxWidth: '400px',
            lineHeight: 1.6
          }}
        >
          {description}
        </p>
      )}
      
      {(action || secondaryAction) && (
        <div style={{ 
          display: 'flex', 
          gap: tokens.spacing.md,
          marginTop: tokens.spacing.md
        }}>
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || 'primary'}
              size={size === 'small' ? 'small' : 'medium'}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="secondary"
              size={size === 'small' ? 'small' : 'medium'}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export const EmptyState = React.memo(EmptyStateComponent)