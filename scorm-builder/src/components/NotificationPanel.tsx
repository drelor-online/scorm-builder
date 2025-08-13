import React from 'react'
import { useNotifications } from '../contexts/NotificationContext'
import { X, CheckCircle, AlertTriangle, Info, AlertCircle, Loader } from 'lucide-react'
import styles from './NotificationPanel.module.css'

export const NotificationPanel: React.FC = () => {
  const { notifications, removeNotification } = useNotifications()

  if (notifications.length === 0) {
    return null
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
    <div className={styles.notificationPanel}>
      <div className={styles.notificationList}>
        {notifications.slice(-3).map(notification => (
          <div 
            key={notification.id}
            className={`${styles.notification} ${styles[`notification-${notification.type}`]}`}
          >
            <div className={styles.notificationIcon}>
              {getIcon(notification.type)}
            </div>
            <div className={styles.notificationContent}>
              <div className={styles.notificationMessage}>
                {notification.message}
              </div>
              {notification.progress && (
                <div className={styles.progressBar}>
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
                >
                  {notification.action.label}
                </button>
              )}
            </div>
            <button
              className={styles.closeButton}
              onClick={() => removeNotification(notification.id)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}