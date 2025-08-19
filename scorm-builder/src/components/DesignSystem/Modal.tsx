import React, { useEffect, useRef, useState } from 'react'
import './designSystem.css'
import './modal.css'
import './transitions.css'
import { Icon } from './Icons'
import { X } from 'lucide-react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  showCloseButton?: boolean
  className?: string
  'data-testid'?: string
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  showCloseButton = true,
  className = '',
  'data-testid': dataTestId
}) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousActiveElementRef.current = document.activeElement as HTMLElement
      setShouldRender(true)
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        setIsVisible(true)
        // Focus the modal after it becomes visible
        setTimeout(() => {
          if (modalRef.current) {
            // Try to focus the first focusable element, fallback to the modal itself
            const focusableElements = modalRef.current.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
            if (focusableElements.length > 0) {
              (focusableElements[0] as HTMLElement).focus()
            } else {
              modalRef.current.focus()
            }
          }
        }, 50)
      })
    } else {
      setIsVisible(false)
      // Return focus to the previously focused element
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus()
        previousActiveElementRef.current = null
      }
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || !modalRef.current) return

      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key === 'Tab') {
        // Handle Tab key for focus trapping
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as NodeListOf<HTMLElement>

        if (focusableElements.length === 0) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          // Shift + Tab: if focused on first element, jump to last
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          // Tab: if focused on last element, jump to first
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!shouldRender) return null

  const sizeClasses = {
    small: 'modal-small',
    medium: '',
    large: 'modal-large',
    xlarge: 'modal-xlarge'
  }

  return (
    <div 
      className={`modal-backdrop ${isVisible ? 'modal-entering modal-backdrop-enter-active' : 'modal-exiting modal-backdrop-exit-active'}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        ref={modalRef}
        className={`modal-content ${sizeClasses[size]} ${isVisible ? 'modal-entering animate-scaleIn' : 'modal-exiting'} ${className}`}
        data-testid={dataTestId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        tabIndex={-1}
      >
        {(title || showCloseButton) && (
          <div className="modal-header">
            {title && (
              <h2 id="modal-title" className="modal-title">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                className="modal-close"
                onClick={onClose}
                aria-label="Close modal"
                type="button"
                data-testid="modal-close-button"
              >
                <Icon icon={X} size="md" />
              </button>
            )}
          </div>
        )}
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}