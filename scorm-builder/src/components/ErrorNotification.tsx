import { useNotifications } from '../contexts/NotificationContext'
import { useEffect, useRef } from 'react'

export interface ErrorMessage {
  id: string
  message: string
  type: 'error' | 'warning' | 'info' | 'success'
  action?: {
    label: string
    onClick: () => void
  }
}

// Global notification functions that delegate to NotificationContext
let notificationAPI: {
  success: (message: string, action?: ErrorMessage['action']) => void
  error: (message: string, action?: ErrorMessage['action']) => void
  warning: (message: string, action?: ErrorMessage['action']) => void
  info: (message: string, action?: ErrorMessage['action']) => void
} | null = null

export function showError(message: string, action?: ErrorMessage['action']) {
  if (notificationAPI) {
    notificationAPI.error(message, action)
  }
}

export function showWarning(message: string, action?: ErrorMessage['action']) {
  if (notificationAPI) {
    notificationAPI.warning(message, action)
  }
}

export function showInfo(message: string, action?: ErrorMessage['action']) {
  if (notificationAPI) {
    notificationAPI.info(message, action)
  }
}

export function showSuccess(message: string, action?: ErrorMessage['action']) {
  if (notificationAPI) {
    notificationAPI.success(message, action)
  }
}

/**
 * ErrorNotification component that bridges global error functions with NotificationContext
 * This allows legacy code to continue using showError, showInfo, etc. while using the new notification system
 */
export function ErrorNotification() {
  const { success, error, warning, info } = useNotifications()
  const apiRef = useRef<typeof notificationAPI>(null)
  
  useEffect(() => {
    // Create the API wrapper
    apiRef.current = {
      success: (message: string, action?: ErrorMessage['action']) => {
        success(message)
      },
      error: (message: string, action?: ErrorMessage['action']) => {
        error(message, action)
      },
      warning: (message: string, action?: ErrorMessage['action']) => {
        warning(message)
      },
      info: (message: string, action?: ErrorMessage['action']) => {
        info(message)
      }
    }
    
    // Set the global API
    notificationAPI = apiRef.current
    
    return () => {
      // Clear the global API on unmount
      if (notificationAPI === apiRef.current) {
        notificationAPI = null
      }
    }
  }, [success, error, warning, info])
  
  // This component doesn't render anything - notifications are handled by NotificationPanel
  return null
}