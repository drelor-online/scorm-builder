import React, { useState, useRef, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { COLORS, SPACING } from '../../constants'
import './designSystem.css'

export interface TooltipProps {
  children: React.ReactElement
  content: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  disabled?: boolean
  className?: string
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  delay = 0,
  disabled = false,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const tooltipId = useId()

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const spacing = 8

    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - spacing
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
        break
      case 'bottom':
        top = triggerRect.bottom + spacing
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
        break
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
        left = triggerRect.left - tooltipRect.width - spacing
        break
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
        left = triggerRect.right + spacing
        break
    }

    // Keep tooltip within viewport
    const padding = 8
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding))
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding))

    setCoords({ top, left })
  }

  const showTooltip = () => {
    if (disabled) return

    if (delay > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true)
      }, delay)
    } else {
      setIsVisible(true)
    }
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsVisible(false)
  }

  useEffect(() => {
    if (isVisible) {
      calculatePosition()
      window.addEventListener('scroll', calculatePosition, true)
      window.addEventListener('resize', calculatePosition)

      return () => {
        window.removeEventListener('scroll', calculatePosition, true)
        window.removeEventListener('resize', calculatePosition)
      }
    }
  }, [isVisible])

  useEffect(() => {
    const handleTouchOutside = (e: TouchEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        hideTooltip()
      }
    }

    if (isVisible) {
      document.addEventListener('touchstart', handleTouchOutside)
      return () => {
        document.removeEventListener('touchstart', handleTouchOutside)
      }
    }
  }, [isVisible])

  // Clone child element and add event handlers
  const childrenAsElement = children as React.ReactElement<any>
  const childProps = childrenAsElement.props || {}
  
  const child = React.cloneElement(childrenAsElement, {
    ref: triggerRef,
    onMouseEnter: (e: React.MouseEvent) => {
      childProps.onMouseEnter?.(e)
      showTooltip()
    },
    onMouseLeave: (e: React.MouseEvent) => {
      childProps.onMouseLeave?.(e)
      hideTooltip()
    },
    onFocus: (e: React.FocusEvent) => {
      childProps.onFocus?.(e)
      showTooltip()
    },
    onBlur: (e: React.FocusEvent) => {
      childProps.onBlur?.(e)
      hideTooltip()
    },
    onTouchStart: (e: React.TouchEvent) => {
      childProps.onTouchStart?.(e)
      showTooltip()
    },
    'aria-describedby': isVisible ? tooltipId : childProps['aria-describedby']
  })

  const tooltipElement = isVisible && createPortal(
    <div
      ref={tooltipRef}
      id={tooltipId}
      className={`tooltip tooltip-${position} ${className}`}
      role="tooltip"
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: 9999,
        pointerEvents: 'none',
        backgroundColor: COLORS.background,
        color: COLORS.text,
        padding: `${SPACING.xs} ${SPACING.sm}`,
        borderRadius: '4px',
        fontSize: '0.875rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        maxWidth: '250px',
        wordWrap: 'break-word',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 150ms ease-in-out',
        animation: 'fade-in 150ms ease-out'
      }}
    >
      {content}
    </div>,
    document.body
  )

  return (
    <>
      {child}
      {tooltipElement}
    </>
  )
}