import React from 'react'
import './designSystem.css'
import './transitions.css'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'danger'
  size?: 'small' | 'medium' | 'large'
  fullWidth?: boolean
  icon?: React.ReactNode
  children: React.ReactNode
  loading?: boolean
}

const ButtonComponent: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  icon,
  children,
  className = '',
  disabled,
  loading,
  ...props
}) => {
  const classes = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth && 'btn-full-width',
    disabled && 'btn-disabled',
    'transition-all',
    'button-press',
    'hover-lift',
    'focus-ring',
    className
  ].filter(Boolean).join(' ')

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="btn-icon animate-spin">⏳</span>
          <span>Loading...</span>
        </>
      ) : (
        <>
          {icon && (
            <span className="btn-icon">
              {React.isValidElement(icon) ? icon : icon}
            </span>
          )}
          {children}
        </>
      )}
    </button>
  )
}

export const Button = React.memo(ButtonComponent)