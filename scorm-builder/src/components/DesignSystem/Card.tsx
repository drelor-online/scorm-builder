import React from 'react'
import './designSystem.css'

export interface CardProps {
  children: React.ReactNode
  title?: string
  padding?: 'small' | 'medium' | 'large'
  noShadow?: boolean
  className?: string
  variant?: 'default' | 'dark'
  'data-testid'?: string
  style?: React.CSSProperties
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  role?: string
  'aria-label'?: string
}

const CardComponent: React.FC<CardProps> = ({
  children,
  title,
  padding = 'medium',
  noShadow = false,
  className = '',
  variant = 'default',
  'data-testid': dataTestId,
  style,
  onMouseEnter,
  onMouseLeave,
  role,
  'aria-label': ariaLabel
}) => {
  const classes = [
    'card',
    'card-hover-lift',
    variant === 'dark' && 'card-dark',
    padding !== 'medium' && `card-padding-${padding}`,
    noShadow && 'card-no-shadow',
    className
  ].filter(Boolean).join(' ')

  return (
    <div 
      className={classes} 
      data-testid={dataTestId} 
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role={role}
      aria-label={ariaLabel}
    >
      {title && <h3 className="card-title">{title}</h3>}
      {children}
    </div>
  )
}

export const Card = React.memo(CardComponent)