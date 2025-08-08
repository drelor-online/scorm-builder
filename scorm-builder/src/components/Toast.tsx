import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './DesignSystem/IconButton'
import './DesignSystem/toast.css'

export interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  onClose: () => void
  duration?: number
}

export const Toast: React.FC<ToastProps> = ({ 
  message, 
  type, 
  onClose, 
  duration = 3000 
}) => {
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration])

  const handleClose = () => {
    setIsClosing(true)
    // Wait for animation to complete before calling onClose
    setTimeout(onClose, 200)
  }

  return (
    <div 
      className={`toast toast-${type} ${isClosing ? 'toast-fade-out' : 'animate-slideIn'}`}
      role="alert"
      aria-live="polite"
    >
      <span className="toast-message">{message}</span>
      <div className="toast-close">
        <IconButton
          icon={X}
          onClick={handleClose}
          variant="ghost"
          size="sm"
          ariaLabel="Dismiss notification"
          className="icon-button"
        />
      </div>
    </div>
  )
}