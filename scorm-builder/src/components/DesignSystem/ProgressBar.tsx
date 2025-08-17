import React, { useMemo } from 'react'
import './progressBar.css'

export interface ProgressBarProps {
  value?: number
  max?: number
  label?: string
  indeterminate?: boolean
  showTimeRemaining?: boolean
  startTime?: number
  className?: string
  size?: 'small' | 'medium' | 'large'
  variant?: 'primary' | 'success' | 'warning' | 'danger'
  showPercentage?: boolean
  'data-testid'?: string
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value = 0,
  max = 100,
  label,
  indeterminate = false,
  showTimeRemaining = false,
  startTime,
  className = '',
  size = 'medium',
  variant = 'primary',
  showPercentage = false,
  'data-testid': dataTestId
}) => {
  const percentage = indeterminate ? 0 : (value / max) * 100

  const timeRemaining = useMemo(() => {
    if (!showTimeRemaining || !startTime || indeterminate || value === 0) {
      return null
    }

    const elapsed = Date.now() - startTime
    const rate = value / elapsed
    const remaining = (max - value) / rate
    
    // Convert to human readable format
    const seconds = Math.ceil(remaining / 1000)
    if (seconds < 60) {
      return `${seconds}s remaining`
    }
    const minutes = Math.ceil(seconds / 60)
    return `${minutes}m remaining`
  }, [value, max, startTime, showTimeRemaining, indeterminate])

  const containerClasses = [
    'progress-container',
    `progress-container-${size}`,
    className
  ].filter(Boolean).join(' ')
  
  const barClasses = [
    'progress-bar',
    `progress-bar-${size}`,
    indeterminate && 'progress-indeterminate'
  ].filter(Boolean).join(' ')
  
  const fillClasses = [
    'progress-fill',
    `progress-fill-${variant}`
  ].filter(Boolean).join(' ')

  return (
    <div className={containerClasses} data-testid={dataTestId}>
      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : value}
        aria-valuemin={0}
        aria-valuemax={indeterminate ? undefined : max}
        aria-label={label}
        className={barClasses}
      >
        <div
          className={fillClasses}
          style={{ width: indeterminate ? undefined : `${percentage}%` }}
          data-testid="progress-fill"
        />
      </div>
      {(label || showPercentage) && (
        <div className="progress-label">
          {label}
          {showPercentage && (label ? ` (${Math.round(percentage)}%)` : `${Math.round(percentage)}%`)}
        </div>
      )}
      {showTimeRemaining && timeRemaining && (
        <div className="progress-time-remaining">{timeRemaining}</div>
      )}
    </div>
  )
}