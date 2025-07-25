import React from 'react'
import './designSystem.css'

// Page Container - Constrains width and provides consistent padding
export interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, className = '' }) => {
  return (
    <div className={`page-container ${className}`.trim()}>
      {children}
    </div>
  )
}

// Section - Provides consistent spacing between page sections
export interface SectionProps {
  children: React.ReactNode
  title?: string
  spacing?: 'small' | 'medium' | 'large'
  className?: string
}

export const Section: React.FC<SectionProps> = ({ 
  children, 
  title, 
  spacing = 'medium',
  className = '' 
}) => {
  const classes = [
    'section',
    spacing !== 'medium' && `section-spacing-${spacing}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <section className={classes} role="region" aria-label={title}>
      {title && <h2 className="section-title">{title}</h2>}
      {children}
    </section>
  )
}

// Flex - Flexible box layout
export interface FlexProps {
  children: React.ReactNode
  direction?: 'row' | 'column'
  gap?: 'small' | 'medium' | 'large'
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around'
  wrap?: boolean
  className?: string
  style?: React.CSSProperties
}

export const Flex: React.FC<FlexProps> = ({
  children,
  direction = 'row',
  gap = 'medium',
  align,
  justify,
  wrap = false,
  className = '',
  style
}) => {
  const classes = [
    'flex',
    direction === 'column' && 'flex-column',
    `flex-gap-${gap}`,
    align && `flex-align-${align}`,
    justify && `flex-justify-${justify}`,
    wrap && 'flex-wrap',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  )
}

// Grid - CSS Grid layout
export interface GridProps {
  children: React.ReactNode
  cols?: number | { sm?: number; md?: number; lg?: number }
  gap?: 'small' | 'medium' | 'large'
  className?: string
}

export const Grid: React.FC<GridProps> = ({
  children,
  cols = 2,
  gap = 'medium',
  className = ''
}) => {
  const colClasses = typeof cols === 'number' 
    ? `grid-cols-${cols}`
    : Object.entries(cols)
        .map(([breakpoint, count]) => `grid-cols-${breakpoint}-${count}`)
        .join(' ')

  const classes = [
    'grid',
    colClasses,
    `grid-gap-${gap}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      {children}
    </div>
  )
}