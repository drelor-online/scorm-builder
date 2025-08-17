import React, { useState, useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { IconButton } from './DesignSystem/IconButton'
import { Icon } from './DesignSystem/Icons'
import styles from './StatusPanel.module.css'

export interface StatusMessage {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
  timestamp: number
  dismissed?: boolean
}

interface StatusPanelProps {
  messages: StatusMessage[]
  onDismiss: (messageId: string) => void
  onClearAll: () => void
  className?: string
}

const getIconForType = (type: StatusMessage['type']) => {
  switch (type) {
    case 'success': return CheckCircle
    case 'error': return AlertCircle
    case 'warning': return AlertTriangle
    case 'info': return Info
    default: return Info
  }
}

const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export const StatusPanel: React.FC<StatusPanelProps> = ({
  messages,
  onDismiss,
  onClearAll,
  className
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null)
  
  // Filter out dismissed messages and sort by timestamp (newest first)
  const visibleMessages = messages
    .filter(msg => !msg.dismissed)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5) // Show max 5 messages
  
  // Auto-hide after 30 seconds of no new messages
  useEffect(() => {
    if (visibleMessages.length > 0) {
      if (autoHideTimer) clearTimeout(autoHideTimer)
      
      const timer = setTimeout(() => {
        setIsCollapsed(true)
      }, 30000) // 30 seconds
      
      setAutoHideTimer(timer)
      
      return () => clearTimeout(timer)
    }
  }, [visibleMessages.length])
  
  // Don't render if no visible messages
  if (visibleMessages.length === 0) {
    return null
  }
  
  return (
    <div className={`${styles.statusPanel} ${isCollapsed ? styles.collapsed : ''} ${className || ''}`}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <Icon icon={Info} size="sm" />
          <span className={styles.title}>
            Recent Activity ({visibleMessages.length})
          </span>
        </div>
        <div className={styles.headerActions}>
          {visibleMessages.length > 1 && (
            <button
              className={styles.clearAllButton}
              onClick={onClearAll}
              title="Clear all messages"
            >
              Clear All
            </button>
          )}
          <IconButton
            icon={isCollapsed ? ChevronUp : ChevronDown}
            onClick={() => setIsCollapsed(!isCollapsed)}
            size="sm"
            variant="ghost"
            ariaLabel={isCollapsed ? 'Expand status panel' : 'Collapse status panel'}
          />
        </div>
      </div>
      
      {!isCollapsed && (
        <div className={styles.messageList}>
          {visibleMessages.map((message) => (
            <div key={message.id} className={`${styles.message} ${styles[`message-${message.type}`]}`}>
              <div className={styles.messageIcon}>
                <Icon icon={getIconForType(message.type)} size="sm" />
              </div>
              <div className={styles.messageContent}>
                <div className={styles.messageTitle}>{message.title}</div>
                <div className={styles.messageText}>{message.message}</div>
                <div className={styles.messageTime}>{formatTimeAgo(message.timestamp)}</div>
              </div>
              <IconButton
                icon={X}
                onClick={() => onDismiss(message.id)}
                size="sm"
                variant="ghost"
                ariaLabel="Dismiss message"
                className={styles.dismissButton}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default StatusPanel