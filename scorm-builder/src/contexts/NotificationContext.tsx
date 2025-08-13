import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { generateNotificationId } from '../utils/idGenerator'

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'progress'

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
  success: (message: string, duration?: number) => void
  error: (message: string, action?: Notification['action']) => void
  warning: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
  progress: (message: string, current: number, total: number) => string
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

  // Convenience methods
  const success = useCallback((message: string, duration = 5000) => {
    addNotification({ message, type: 'success', duration })
  }, [addNotification])

  const error = useCallback((message: string, action?: Notification['action']) => {
    addNotification({ message, type: 'error', action })
  }, [addNotification])

  const warning = useCallback((message: string, duration = 5000) => {
    addNotification({ message, type: 'warning', duration })
  }, [addNotification])

  const info = useCallback((message: string, duration = 5000) => {
    addNotification({ message, type: 'info', duration })
  }, [addNotification])

  const progress = useCallback((message: string, current: number, total: number) => {
    return addNotification({ 
      message, 
      type: 'progress', 
      progress: { current, total } 
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
    progress
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}