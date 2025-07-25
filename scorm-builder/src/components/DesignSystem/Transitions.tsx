import React, { useState, useEffect, Children } from 'react'
import './transitions.css'

interface TransitionProps {
  show: boolean
  children: React.ReactNode
  duration?: number
  delay?: number
  exitBeforeEnter?: boolean
  onExited?: () => void
}

export const FadeIn: React.FC<TransitionProps> = ({
  show,
  children,
  duration = 300,
  delay = 0,
  onExited
}) => {
  const [isVisible, setIsVisible] = useState(show)
  const [isActive, setIsActive] = useState(show)

  useEffect(() => {
    if (show) {
      setIsVisible(true)
      // Force reflow to ensure transition works
      const timer = setTimeout(() => {
        setIsActive(true)
      }, 10)
      return () => clearTimeout(timer)
    } else {
      setIsActive(false)
      const timer = setTimeout(() => {
        setIsVisible(false)
        onExited?.()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [show, duration, onExited])

  if (!isVisible) return null

  return (
    <div
      className={`fade-in ${isActive ? 'fade-in-active' : ''}`}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  )
}

interface SlideInProps extends TransitionProps {
  direction?: 'left' | 'right' | 'top' | 'bottom'
}

export const SlideIn: React.FC<SlideInProps> = ({
  show,
  children,
  direction = 'left',
  duration = 300,
  delay = 0
}) => {
  const [isVisible, setIsVisible] = useState(show)
  const [isActive, setIsActive] = useState(show)

  useEffect(() => {
    if (show) {
      setIsVisible(true)
      const timer = setTimeout(() => {
        setIsActive(true)
      }, 10)
      return () => clearTimeout(timer)
    } else {
      setIsActive(false)
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [show, duration])

  if (!isVisible) return null

  return (
    <div
      className={`slide-in slide-in-${direction} ${isActive ? `slide-in-${direction}-active` : ''}`}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  )
}

interface ScaleInProps extends TransitionProps {
  origin?: string
}

export const ScaleIn: React.FC<ScaleInProps> = ({
  show,
  children,
  origin = 'center',
  duration = 300,
  delay = 0
}) => {
  const [isVisible, setIsVisible] = useState(show)
  const [isActive, setIsActive] = useState(show)

  useEffect(() => {
    if (show) {
      setIsVisible(true)
      const timer = setTimeout(() => {
        setIsActive(true)
      }, 10)
      return () => clearTimeout(timer)
    } else {
      setIsActive(false)
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [show, duration])

  if (!isVisible) return null

  const transformOrigin = origin.replace('-', ' ')

  return (
    <div
      className={`scale-in ${isActive ? 'scale-in-active' : ''}`}
      style={{
        transformOrigin,
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  )
}

interface StaggerChildrenProps {
  show: boolean
  children: React.ReactNode
  staggerDelay?: number
  animation?: 'fade' | 'slide-up' | 'slide-down' | 'scale'
  duration?: number
}

export const StaggerChildren: React.FC<StaggerChildrenProps> = ({
  show,
  children,
  staggerDelay = 50,
  animation = 'fade',
  duration = 300
}) => {
  const childArray = Children.toArray(children)

  return (
    <div className="stagger-container">
      {childArray.map((child, index) => {
        const delay = index * staggerDelay
        
        return (
          <div
            key={index}
            className={`stagger-item stagger-${animation} ${show ? 'stagger-active' : ''}`}
            style={{
              animationDelay: `${delay}ms`,
              animationDuration: `${duration}ms`
            }}
          >
            {child}
          </div>
        )
      })}
    </div>
  )
}