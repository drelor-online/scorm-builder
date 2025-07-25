import React, { useEffect, useRef } from 'react'
import { LoadingSpinner } from './LoadingSpinner'
import './loadingOverlay.css'

export interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  children: React.ReactNode
  fadeIn?: boolean
  trapFocus?: boolean
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message = 'Loading...',
  children,
  fadeIn = false,
  trapFocus = false
}) => {
  const overlayRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (trapFocus && isLoading && overlayRef.current) {
      previousFocus.current = document.activeElement as HTMLElement
      const focusableElements = overlayRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      
      if (focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus()
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Tab' && focusableElements.length > 0) {
          const firstElement = focusableElements[0] as HTMLElement
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        if (previousFocus.current) {
          previousFocus.current.focus()
        }
      }
    }
  }, [isLoading, trapFocus])

  return (
    <div className="loading-overlay-container">
      {isLoading && (
        <div
          ref={overlayRef}
          className={`loading-overlay ${fadeIn ? 'loading-overlay-fade-in' : ''}`}
          data-testid="loading-overlay"
        >
          <div className="loading-overlay-content">
            <LoadingSpinner size="large" />
            <div role="status" aria-live="polite" className="loading-overlay-message">
              {message}
            </div>
            {/* Hidden button for focus trap */}
            {trapFocus && (
              <button
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                tabIndex={0}
                aria-hidden="true"
              />
            )}
          </div>
        </div>
      )}
      <div aria-hidden={isLoading ? 'true' : undefined}>
        {children}
      </div>
    </div>
  )
}