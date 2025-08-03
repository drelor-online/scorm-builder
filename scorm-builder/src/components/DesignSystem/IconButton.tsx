import React from 'react'
import { type LucideIcon } from 'lucide-react'
import { Icon } from './Icons'
import { tokens } from './designTokens'
import './transitions.css'

interface IconButtonProps {
  icon: LucideIcon
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  tooltip?: string
  className?: string
  ariaLabel?: string
  children?: React.ReactNode
}

const variantStyles = {
  primary: {
    background: tokens.colors.primary[500],
    hoverBackground: tokens.colors.primary[600],
    color: '#ffffff',
    border: 'none'
  },
  secondary: {
    background: tokens.colors.background.secondary,
    hoverBackground: tokens.colors.background.tertiary,
    color: tokens.colors.text.primary,
    border: `1px solid ${tokens.colors.border.default}`
  },
  ghost: {
    background: 'transparent',
    hoverBackground: tokens.colors.background.tertiary,
    color: tokens.colors.text.primary,
    border: 'none'
  },
  danger: {
    background: tokens.colors.danger[500],
    hoverBackground: tokens.colors.danger[600],
    color: '#ffffff',
    border: 'none'
  },
  success: {
    background: tokens.colors.success[500],
    hoverBackground: tokens.colors.success[600],
    color: '#ffffff',
    border: 'none'
  }
}

const sizeStyles = {
  sm: {
    padding: tokens.spacing.xs,
    fontSize: tokens.typography.fontSize.sm,
    iconSize: 'sm' as const,
    gap: tokens.spacing.xs,
    height: '32px'
  },
  md: {
    padding: tokens.spacing.sm,
    fontSize: tokens.typography.fontSize.base,
    iconSize: 'md' as const,
    gap: tokens.spacing.xs,
    height: '40px'
  },
  lg: {
    padding: tokens.spacing.md,
    fontSize: tokens.typography.fontSize.lg,
    iconSize: 'lg' as const,
    gap: tokens.spacing.sm,
    height: '48px'
  }
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  tooltip,
  className = '',
  ariaLabel,
  children
}) => {
  const variantStyle = variantStyles[variant]
  const sizeStyle = sizeStyles[size]
  
  const [isHovered, setIsHovered] = React.useState(false)
  
  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: children ? sizeStyle.gap : 0,
    padding: sizeStyle.padding,
    fontSize: sizeStyle.fontSize,
    fontWeight: tokens.typography.fontWeight.medium,
    height: sizeStyle.height,
    minWidth: sizeStyle.height,
    backgroundColor: variantStyle.background,
    color: variantStyle.color,
    border: variantStyle.border,
    borderRadius: tokens.borderRadius.md,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: `all ${tokens.transitions.normal}`,
    outline: 'none',
    position: 'relative',
    ...(isHovered && !disabled && {
      backgroundColor: variantStyle.hoverBackground,
      transform: 'translateY(-1px)',
      boxShadow: tokens.shadows.sm
    })
  }
  
  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => setIsHovered(false)
  
  return (
    <>
      <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        style={buttonStyle}
        className={`${className} transition-all button-press focus-ring`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        aria-label={ariaLabel || tooltip}
        title={tooltip}
      >
        <Icon icon={icon} size={sizeStyle.iconSize} />
        {children && <span>{children}</span>}
      </button>
      
      {tooltip && isHovered && !disabled && (
        <div
          className="animate-fadeInUp"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%) translateY(-8px)',
            backgroundColor: tokens.colors.background.tertiary,
            color: '#ffffff',
            padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
            borderRadius: tokens.borderRadius.sm,
            fontSize: tokens.typography.fontSize.xs,
            whiteSpace: 'nowrap',
            zIndex: tokens.zIndex.tooltip,
            pointerEvents: 'none',
            opacity: 0.9
          }}
        >
          {tooltip}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: `4px solid ${tokens.colors.background.tertiary}`
            }}
          />
        </div>
      )}
    </>
  )
}

// Export a memoized version for performance
export default React.memo(IconButton)