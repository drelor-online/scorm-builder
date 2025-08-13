import React, { useEffect, useRef } from 'react'
import { useNotifications } from '../contexts/NotificationContext'
import { X, CheckCircle, AlertTriangle, Info, AlertCircle, Loader } from 'lucide-react'
import styles from './NotificationPanel.module.css'

export const NotificationPanel: React.FC = () => {
  const { notifications, removeNotification } = useNotifications()
  const panelRef = useRef<HTMLDivElement>(null)

  // Focus management for error notifications
  useEffect(() => {
    const errorNotifications = notifications.filter(n => n.type === 'error')
    if (errorNotifications.length > 0) {
      // Find the most recent error notification element and focus it
      const recentErrorId = `notification-${errorNotifications[errorNotifications.length - 1].id}`
      const errorElement = document.getElementById(recentErrorId)
      if (errorElement) {
        errorElement.focus()
      }
    }
  }, [notifications])

  if (notifications.length === 0) {
    return null
  }

  // Get ARIA attributes for different notification types
  const getAriaAttributes = (type: string) => {
    switch (type) {
      case 'error':
      case 'warning':
        return {
          role: 'alert',
          'aria-live': 'assertive' as const,
          'aria-atomic': true
        }
      case 'success':
      case 'info':
        return {
          role: 'status', 
          'aria-live': 'polite' as const,
          'aria-atomic': true
        }
      case 'progress':
        return {
          role: 'status',
          'aria-live': 'polite' as const,
          'aria-atomic': false
        }
      default:
        return {
          role: 'status',
          'aria-live': 'polite' as const,
          'aria-atomic': true
        }
    }
  }

  // Handle keyboard events
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Dismiss the most recent notification
      const recentNotification = notifications.slice(-1)[0]
      if (recentNotification) {
        removeNotification(recentNotification.id)
      }
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={16} />
      case 'error':
        return <AlertCircle size={16} />
      case 'warning':
        return <AlertTriangle size={16} />
      case 'info':
        return <Info size={16} />
      case 'progress':
        return <Loader size={16} className={styles.spinning} />
      default:
        return null
    }
  }

  return (
    <div 
      ref={panelRef}
      className={styles.notificationPanel}
      role="region"
      aria-label="Notifications" 
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className={styles.notificationList}>
        {notifications.slice(-2).map((notification, index) => {
          const ariaAttrs = getAriaAttributes(notification.type)
          const notificationId = `notification-${notification.id}`
          const messageId = `message-${notification.id}`
          
          return (
            <div 
              key={notification.id}
              id={notificationId}
              className={`${styles.notification} ${styles[`notification-${notification.type}`]}`}
              tabIndex={notification.type === 'error' ? 0 : -1}
              {...ariaAttrs}
            >
              {/* Visually hidden text for screen readers */}
              <span className={styles.srOnly}>
                {notification.type === 'error' ? 'Error: ' :
                 notification.type === 'warning' ? 'Warning: ' :
                 notification.type === 'success' ? 'Success: ' :
                 notification.type === 'info' ? 'Info: ' :
                 notification.type === 'progress' ? 'Progress: ' : ''}
              </span>
              
              <div className={styles.notificationIcon} aria-hidden="true">
                {getIcon(notification.type)}
              </div>
              
              <div className={styles.notificationContent}>
                <div 
                  id={messageId}
                  className={styles.notificationMessage}
                >
                  {notification.message}
                </div>
                
                {notification.progress && (
                  <div 
                    className={styles.progressBar}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={notification.progress.total}
                    aria-valuenow={notification.progress.current}
                    aria-valuetext={`${notification.progress.current} of ${notification.progress.total}`}
                    aria-describedby={messageId}
                  >
                    <div 
                      className={styles.progressFill}
                      style={{ 
                        width: `${(notification.progress.current / notification.progress.total) * 100}%` 
                      }}
                    />
                  </div>
                )}
                
                {notification.action && (
                  <button
                    className={styles.actionButton}
                    onClick={() => {
                      notification.action!.onClick()
                      removeNotification(notification.id)
                    }}
                    aria-describedby={messageId}
                    tabIndex={0}
                  >
                    {notification.action.label}
                  </button>
                )}
              </div>
              
              <button
                className={styles.closeButton}
                onClick={() => removeNotification(notification.id)}
                aria-label="Dismiss notification"
                tabIndex={0}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}