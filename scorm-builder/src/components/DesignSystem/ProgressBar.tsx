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
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value = 0,
  max = 100,
  label,
  indeterminate = false,
  showTimeRemaining = false,
  startTime,
  className = ''
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

  const classes = [
    'progress-bar',
    indeterminate && 'progress-indeterminate',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className="progress-container">
      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : value}
        aria-valuemin={0}
        aria-valuemax={indeterminate ? undefined : max}
        aria-label={label}
        className={classes}
      >
        <div
          className="progress-fill"
          style={{ width: indeterminate ? undefined : `${percentage}%` }}
          data-testid="progress-fill"
        />
      </div>
      {showTimeRemaining && timeRemaining && (
        <div className="progress-time-remaining">{timeRemaining}</div>
      )}
    </div>
  )
}