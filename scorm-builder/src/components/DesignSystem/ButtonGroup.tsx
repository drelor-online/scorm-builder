import React from 'react'
import './designSystem.css'

export interface ButtonGroupProps {
  children: React.ReactNode
  direction?: 'horizontal' | 'vertical'
  gap?: 'small' | 'medium' | 'large'
  align?: 'start' | 'center' | 'end'
  justify?: 'start' | 'center' | 'end' | 'space-between'
  wrap?: boolean
  className?: string
  style?: React.CSSProperties
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  direction = 'horizontal',
  gap = 'medium',
  align = 'center',
  justify,
  wrap = false,
  className = '',
  style
}) => {
  const classes = [
    'button-group',
    `button-group-${direction}`,
    `button-group-gap-${gap}`,
    `button-group-align-${align}`,
    justify && `button-group-justify-${justify}`,
    wrap && 'button-group-wrap',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  )
}