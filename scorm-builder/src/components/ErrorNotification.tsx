import { useState, useEffect } from 'react'
import { generateNotificationId } from '../utils/idGenerator'

export interface ErrorMessage {
  id: string
  message: string
  type: 'error' | 'warning' | 'info' | 'success'
  action?: {
    label: string
    onClick: () => void
  }
}

let errorHandlers: Set<(error: ErrorMessage) => void> = new Set()

export function showError(message: string, action?: ErrorMessage['action']) {
  const error: ErrorMessage = {
    id: generateNotificationId(),
    message,
    type: 'error',
    action
  }
  errorHandlers.forEach(handler => handler(error))
}

export function showWarning(message: string, action?: ErrorMessage['action']) {
  const error: ErrorMessage = {
    id: generateNotificationId(),
    message,
    type: 'warning',
    action
  }
  errorHandlers.forEach(handler => handler(error))
}

export function showInfo(message: string, action?: ErrorMessage['action']) {
  const error: ErrorMessage = {
    id: generateNotificationId(),
    message,
    type: 'info',
    action
  }
  errorHandlers.forEach(handler => handler(error))
}

export function showSuccess(message: string, action?: ErrorMessage['action']) {
  const error: ErrorMessage = {
    id: generateNotificationId(),
    message,
    type: 'success',
    action
  }
  errorHandlers.forEach(handler => handler(error))
}

export function ErrorNotification() {
  const [errors, setErrors] = useState<ErrorMessage[]>([])
  
  useEffect(() => {
    const handler = (error: ErrorMessage) => {
      setErrors(prev => [...prev, error])
      
      // Auto-dismiss info and success messages after 5 seconds
      if (error.type === 'info' || error.type === 'success') {
        setTimeout(() => {
          setErrors(prev => prev.filter(e => e.id !== error.id))
        }, 5000)
      }
    }
    
    errorHandlers.add(handler)
    return () => {
      errorHandlers.delete(handler)
    }
  }, [])
  
  if (errors.length === 0) return null
  
  return (
    <div style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      maxWidth: '24rem'
    }}>
      {errors.map(error => (
        <div
          key={error.id}
          style={{
            backgroundColor: error.type === 'error' ? '#dc2626' : 
                           error.type === 'warning' ? '#f59e0b' : 
                           error.type === 'success' ? '#10b981' : '#3b82f6',
            color: 'white',
            padding: '0.75rem 1rem',
            borderRadius: '0.375rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>{error.message}</div>
            {error.action && (
              <button
                onClick={() => {
                  error.action!.onClick()
                  setErrors(prev => prev.filter(e => e.id !== error.id))
                }}
                style={{
                  marginTop: '0.25rem',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '0.25rem',
                  color: 'white',
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                {error.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => setErrors(prev => prev.filter(e => e.id !== error.id))}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.25rem',
              lineHeight: 1,
              opacity: 0.8
            }}
          >
            ×
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}