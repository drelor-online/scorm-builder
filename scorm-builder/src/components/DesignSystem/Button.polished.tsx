import React, { useState, useRef, useEffect } from 'react'
import './designSystem.css'
import './button.polish.css'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'danger'
  size?: 'small' | 'medium' | 'large'
  fullWidth?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  loading?: boolean
  children: React.ReactNode
}

const ButtonComponent: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  icon,
  iconPosition = 'left',
  loading = false,
  children,
  className = '',
  disabled,
  onClick,
  onMouseDown,
  onKeyDown,
  ...props
}) => {
  const [isPressed, setIsPressed] = useState(false)
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([])
  const [isFocusVisible, setIsFocusVisible] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const rippleIdRef = useRef(0)

  const classes = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth && 'btn-full-width',
    (disabled || loading) && 'btn-disabled',
    isPressed && 'btn-pressed',
    isFocusVisible && 'btn-focus-visible',
    loading && 'btn-loading',
    className
  ].filter(Boolean).join(' ')

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading) return
    
    // Create ripple effect
    const button = buttonRef.current
    if (button) {
      const rect = button.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const id = rippleIdRef.current++
      
      setRipples(prev => [...prev, { x, y, id }])
      
      // Remove ripple after animation
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== id))
      }, 600)
    }
    
    onClick?.(e)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsPressed(true)
    setIsFocusVisible(false)
    onMouseDown?.(e)
  }

  const handleMouseUp = () => {
    setIsPressed(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setIsPressed(true)
    }
    setIsFocusVisible(true)
    onKeyDown?.(e)
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setIsPressed(false)
    }
  }

  const handleFocus = () => {
    // Only show focus ring if it wasn't triggered by mouse
    if (!isPressed) {
      setIsFocusVisible(true)
    }
  }

  const handleBlur = () => {
    setIsFocusVisible(false)
    setIsPressed(false)
  }

  useEffect(() => {
    const handleMouseUp = () => setIsPressed(false)
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const iconElement = icon && (
    <span className="btn-icon">{icon}</span>
  )

  const content = (
    <>
      {loading && (
        <span className="btn-spinner" role="status" aria-label="Loading">
          <span className="btn-spinner-dot" />
          <span className="btn-spinner-dot" />
          <span className="btn-spinner-dot" />
          <span className="sr-only">Loading...</span>
        </span>
      )}
      {iconPosition === 'left' && iconElement}
      <span className={loading ? 'btn-text-hidden' : 'btn-text'}>
        {children}
      </span>
      {iconPosition === 'right' && iconElement}
      {ripples.map(({ x, y, id }) => (
        <span
          key={id}
          className="btn-ripple"
          style={{
            left: x,
            top: y
          }}
        />
      ))}
    </>
  )

  return (
    <button
      ref={buttonRef}
      className={classes}
      disabled={disabled || loading}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    >
      {content}
    </button>
  )
}

export const Button = React.memo(ButtonComponent)