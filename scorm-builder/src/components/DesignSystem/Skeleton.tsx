import React from 'react'
import './skeleton.css'

export interface SkeletonProps {
  variant?: 'text' | 'rect' | 'circle'
  width?: string
  height?: string
  size?: string
  animation?: 'pulse' | 'shimmer'
  className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  size,
  animation = 'pulse',
  className = ''
}) => {
  const styles: React.CSSProperties = {}

  if (variant === 'circle' && size) {
    styles.width = size
    styles.height = size
  } else {
    if (width) styles.width = width
    if (height) styles.height = height
  }

  const classes = [
    'skeleton',
    `skeleton-${variant}`,
    `skeleton-${animation}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      style={styles}
      data-testid={`skeleton-${variant}`}
      aria-hidden="true"
    />
  )
}