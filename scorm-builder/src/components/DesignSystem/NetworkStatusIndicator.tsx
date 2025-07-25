import React from 'react'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { COLORS, SPACING } from '../../constants'
import { tokens } from './designTokens'
import './designSystem.css'

export interface NetworkStatusIndicatorProps {
  className?: string
}

const NetworkStatusIndicatorComponent: React.FC<NetworkStatusIndicatorProps> = ({ 
  className = '' 
}) => {
  const { isOnline, lastOnline } = useNetworkStatus()

  if (isOnline) {
    return null
  }

  const formatLastOnlineTime = (date: Date | null): string => {
    if (!date) return ''
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    
    if (diffMinutes < 1) return 'just now'
    if (diffMinutes === 1) return '1 minute ago'
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`
    
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours === 1) return '1 hour ago'
    if (diffHours < 24) return `${diffHours} hours ago`
    
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return '1 day ago'
    return `${diffDays} days ago`
  }

  return (
    <div 
      className={`network-status-indicator offline ${className}`}
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: SPACING.md,
        right: SPACING.md,
        background: COLORS.error,
        color: 'white',
        padding: `${SPACING.sm} ${SPACING.md}`,
        borderRadius: tokens.borderRadius.sm,
        boxShadow: tokens.shadows.sm,
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.sm,
        fontSize: '0.875rem',
        fontWeight: 500,
        zIndex: 1000,
        animation: 'slide-in-top 200ms ease-out',
        transition: 'all 200ms ease-in-out'
      }}
    >
      <span 
        style={{
          width: SPACING.sm,
          height: SPACING.sm,
          borderRadius: '50%',
          background: 'white',
          opacity: 0.8
        }}
      />
      <span>No internet connection</span>
      {lastOnline && (
        <span style={{ opacity: 0.8 }}>
          Last online: {formatLastOnlineTime(lastOnline)}
        </span>
      )}
    </div>
  )
}

export const NetworkStatusIndicator = React.memo(NetworkStatusIndicatorComponent)