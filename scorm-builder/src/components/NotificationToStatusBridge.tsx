import { useEffect, useRef } from 'react'
import { useNotifications } from '../contexts/NotificationContext'
import { StatusMessage } from './StatusPanel'

interface NotificationToStatusBridgeProps {
  onAddStatusMessage: (type: StatusMessage['type'], title: string, message: string) => void
}

/**
 * Bridge component that forwards notifications from NotificationContext to StatusPanel
 * This allows old-style showInfo/showError calls to appear in the StatusPanel instead of NotificationPanel
 */
export const NotificationToStatusBridge: React.FC<NotificationToStatusBridgeProps> = ({ 
  onAddStatusMessage 
}) => {
  const { notifications } = useNotifications()
  const processedIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Process any new notifications
    notifications.forEach(notification => {
      if (!processedIds.current.has(notification.id)) {
        // Mark as processed
        processedIds.current.add(notification.id)
        
        // Forward to StatusPanel
        let title = ''
        let statusType: StatusMessage['type'] = 'info'
        
        switch (notification.type) {
          case 'success':
            title = 'Success'
            statusType = 'success'
            break
          case 'error':
            title = 'Error'
            statusType = 'error'
            break
          case 'warning':
            title = 'Warning'
            statusType = 'warning'
            break
          case 'progress':
            title = 'Progress'
            statusType = 'info' // Map progress to info
            break
          case 'info':
          default:
            title = 'Info'
            statusType = 'info'
            break
        }
        
        onAddStatusMessage(statusType, title, notification.message)
      }
    })

    // Clean up processed IDs for notifications that no longer exist
    const currentIds = new Set(notifications.map(n => n.id))
    processedIds.current.forEach(id => {
      if (!currentIds.has(id)) {
        processedIds.current.delete(id)
      }
    })
  }, [notifications, onAddStatusMessage])

  // This component doesn't render anything
  return null
}