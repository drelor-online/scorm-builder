import { useState, useEffect } from 'react'
import { generateNotificationId } from '../utils/idGenerator'
import { Icon } from './DesignSystem'
import { Check, AlertTriangle, Info } from 'lucide-react'

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
      top: '2rem',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      minWidth: '300px',
      maxWidth: '500px',
      pointerEvents: 'none'
    }}>
      {errors.map(error => (
        <div
          key={error.id}
          onClick={() => setErrors(prev => prev.filter(e => e.id !== error.id))}
          style={{
            backgroundColor: error.type === 'error' ? '#dc2626' : 
                           error.type === 'warning' ? '#f59e0b' : 
                           error.type === 'success' ? '#10b981' : '#3b82f6',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            animation: 'slideDown 0.3s ease-out',
            pointerEvents: 'auto',
            cursor: 'pointer',
            transition: 'opacity 0.2s ease-out'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          {/* Icon */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Icon 
              icon={error.type === 'success' ? Check : 
                    error.type === 'error' || error.type === 'warning' ? AlertTriangle : 
                    Info}
              size="md"
              color="white"
            />
          </div>
          
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>{error.message}</div>
            {error.action && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
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
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
              >
                {error.action.label}
              </button>
            )}
          </div>
          
          {/* Close hint */}
          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Click to dismiss</span>
        </div>
      ))}
      <style>{`
        @keyframes slideDown {
          from {
            transform: translate(-50%, -100%);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}