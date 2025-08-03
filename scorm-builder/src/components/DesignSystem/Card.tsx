import React from 'react'
import './designSystem.css'
import './transitions.css'
import { type LucideIcon } from 'lucide-react'
import { Icon } from './Icons'

export interface CardProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  icon?: LucideIcon
  padding?: 'small' | 'medium' | 'large'
  noShadow?: boolean
  className?: string
  variant?: 'default' | 'dark' | 'glass'
  'data-testid'?: string
  style?: React.CSSProperties
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  role?: string
  'aria-label'?: string
  actions?: React.ReactNode
  interactive?: boolean
  onClick?: () => void
}

const CardComponent: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  icon,
  padding = 'medium',
  noShadow = false,
  className = '',
  variant = 'default',
  'data-testid': dataTestId,
  style,
  onMouseEnter,
  onMouseLeave,
  role,
  'aria-label': ariaLabel,
  actions,
  interactive = false,
  onClick
}) => {
  const isClickable = interactive || !!onClick
  
  const classes = [
    'card',
    isClickable && 'card-hover-lift',
    variant === 'dark' && 'card-dark',
    variant === 'glass' && 'card-glass',
    padding !== 'medium' && `card-padding-${padding}`,
    noShadow && 'card-no-shadow',
    isClickable && 'card-interactive',
    'transition-all',
    isClickable && 'hover-lift',
    isClickable && 'hover-glow',
    className
  ].filter(Boolean).join(' ')

  return (
    <div 
      className={classes} 
      data-testid={dataTestId} 
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      role={role || (isClickable ? 'button' : undefined)}
      aria-label={ariaLabel}
      tabIndex={isClickable ? 0 : undefined}
    >
      {(title || subtitle || icon || actions) && (
        <div className="card-header">
          <div className="card-header-content">
            {icon && (
              <div className="card-icon">
                <Icon icon={icon} size="lg" />
              </div>
            )}
            <div>
              {title && <h3 className="card-title">{title}</h3>}
              {subtitle && <p className="card-subtitle">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export const Card = React.memo(CardComponent)