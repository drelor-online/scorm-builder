import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { generateNotificationId } from '../utils/idGenerator'

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'progress'

// Notification duration constants (in milliseconds)
// Follow audit guidelines for consistent notification behavior
export const NOTIFICATION_DURATIONS = {
  SUCCESS_DURATION: 5000,      // Success: 5 seconds
  INFO_DURATION: 5000,         // Info: 5 seconds  
  WARNING_DURATION: 8000,      // Warning: 8 seconds (longer for important warnings)
  ERROR_DURATION: undefined,   // Error: no auto-dismiss (user must manually dismiss)
  PROGRESS_DURATION: undefined, // Progress: no auto-dismiss (dismisses when complete)
  AUTOSAVE_DURATION: 3000      // Autosave: 3 seconds (quick feedback)
} as const

export interface Notification {
  id: string
  message: string
  type: NotificationType
  duration?: number // Auto-dismiss after this many milliseconds
  action?: {
    label: string
    onClick: () => void
  }
  progress?: {
    current: number
    total: number
  }
  timestamp: number
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string
  removeNotification: (id: string) => void
  clearAll: () => void
  // Convenience methods
  success: (message: string, duration?: number | undefined) => void
  error: (message: string, action?: Notification['action']) => void
  warning: (message: string, duration?: number | undefined) => void
  info: (message: string, duration?: number | undefined) => void
  progress: (message: string, current: number, total: number) => string
  // Autosave-specific methods
  autoSaveStart: () => string
  autoSaveSuccess: () => void
  autoSaveError: (error: string, onRetry?: () => void) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = generateNotificationId()
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now()
    }

    setNotifications(prev => [...prev, newNotification])

    // Set up auto-dismiss timer if duration is specified
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        removeNotification(id)
      }, notification.duration)
      timersRef.current.set(id, timer)
    }

    return id
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    
    // Clear any associated timer
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    
    // Clear all timers
    timersRef.current.forEach(timer => clearTimeout(timer))
    timersRef.current.clear()
  }, [])

  // Convenience methods - follow audit guidelines for duration
  const success = useCallback((message: string, duration?: number | undefined) => {
    addNotification({ message, type: 'success', duration: duration ?? NOTIFICATION_DURATIONS.SUCCESS_DURATION })
  }, [addNotification])

  const error = useCallback((message: string, action?: Notification['action']) => {
    // Errors don't auto-dismiss - user must manually close them
    addNotification({ message, type: 'error', action, duration: NOTIFICATION_DURATIONS.ERROR_DURATION })
  }, [addNotification])

  const warning = useCallback((message: string, duration?: number | undefined) => {
    addNotification({ message, type: 'warning', duration: duration ?? NOTIFICATION_DURATIONS.WARNING_DURATION })
  }, [addNotification])

  const info = useCallback((message: string, duration?: number | undefined) => {
    addNotification({ message, type: 'info', duration: duration ?? NOTIFICATION_DURATIONS.INFO_DURATION })
  }, [addNotification])

  const progress = useCallback((message: string, current: number, total: number) => {
    return addNotification({ 
      message, 
      type: 'progress', 
      progress: { current, total },
      duration: NOTIFICATION_DURATIONS.PROGRESS_DURATION // No auto-dismiss
    })
  }, [addNotification])

  // Autosave-specific notification methods
  const autoSaveStart = useCallback(() => {
    return addNotification({
      message: 'Saving changes...',
      type: 'info',
      duration: NOTIFICATION_DURATIONS.AUTOSAVE_DURATION
    })
  }, [addNotification])

  const autoSaveSuccess = useCallback(() => {
    addNotification({
      message: 'Changes saved',
      type: 'success',
      duration: NOTIFICATION_DURATIONS.AUTOSAVE_DURATION
    })
  }, [addNotification])

  const autoSaveError = useCallback((error: string, onRetry?: () => void) => {
    addNotification({
      message: `Failed to save changes: ${error}`,
      type: 'error',
      action: onRetry ? {
        label: 'Retry',
        onClick: onRetry
      } : undefined,
      duration: NOTIFICATION_DURATIONS.ERROR_DURATION // No auto-dismiss for errors
    })
  }, [addNotification])

  const value: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info,
    progress,
    autoSaveStart,
    autoSaveSuccess,
    autoSaveError
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

// Usage guidelines for consistent notification behavior across the application
export const NOTIFICATION_USAGE_GUIDELINES = {
  success: [
    'File saved successfully', 
    'Project exported',
    'Audio generated successfully',
    'Media uploaded',
    'SCORM package created'
  ],
  warning: [
    'File size is large, may take time to process',
    'Some optional fields are empty',
    'API rate limit approaching',
    'Unsaved changes detected'
  ],
  error: [
    'Failed to save file',
    'Network connection lost', 
    'Invalid file format',
    'Required field missing',
    'Authentication failed'
  ],
  info: [
    'Processing started',
    'New version available',
    'Tip or helpful information',
    'Step completed successfully'
  ],
  progress: [
    'Uploading file...',
    'Generating SCORM package...',
    'Processing audio...',
    'Loading project...'
  ]
} as const