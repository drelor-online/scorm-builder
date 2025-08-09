import React from 'react'
import { tokens } from './designTokens'
import './badge.css'

export interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'small' | 'medium' | 'large'
  type?: 'multiple-choice' | 'true-false' | 'fill-in-blank' | 'drag-and-drop' | 'scenario'
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
}

const BadgeComponent: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'medium',
  type,
  children,
  className = '',
  icon
}) => {
  // If type is specified, override variant
  const effectiveVariant = type ? 'activity' : variant
  
  const classes = [
    'badge',
    `badge-${effectiveVariant}`,
    `badge-${size}`,
    type && `badge-activity-${type}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <span className={classes}>
      {icon && <span className="badge-icon">{icon}</span>}
      <span className="badge-text">{children}</span>
    </span>
  )
}

export const Badge = React.memo(BadgeComponent)

// Pre-configured badges for common use cases
export const QuestionTypeBadge: React.FC<{ 
  type: 'multiple-choice' | 'true-false' | 'fill-in-blank' 
}> = ({ type }) => {
  const labels = {
    'multiple-choice': 'Multiple Choice',
    'true-false': 'True/False',
    'fill-in-blank': 'Fill in the Blank'
  }
  
  return (
    <Badge type={type} size="small">
      {labels[type]}
    </Badge>
  )
}

export const StatusBadge: React.FC<{ 
  status: 'active' | 'inactive' | 'pending' | 'completed' 
}> = ({ status }) => {
  const variants = {
    active: 'success',
    inactive: 'danger',
    pending: 'warning',
    completed: 'info'
  } as const
  
  const labels = {
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
    completed: 'Completed'
  }
  
  return (
    <Badge variant={variants[status]} size="small">
      {labels[status]}
    </Badge>
  )
}

export const CountBadge: React.FC<{ 
  count: number
  variant?: BadgeProps['variant']
}> = ({ count, variant = 'primary' }) => {
  return (
    <Badge variant={variant} size="small">
      {count}
    </Badge>
  )
}