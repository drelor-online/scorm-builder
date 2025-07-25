// Consistent button styles for the application

export const buttonStyles = {
  // Base styles shared by all buttons
  base: {
    border: 'none',
    borderRadius: '0.5rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: '0.875rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    outline: 'none',
    textDecoration: 'none',
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
  },

  // Size variants
  sizes: {
    small: {
      padding: '0.5rem 1rem',
      fontSize: '0.75rem',
    },
    medium: {
      padding: '0.625rem 1.25rem',
      fontSize: '0.875rem',
    },
    large: {
      padding: '0.75rem 2rem',
      fontSize: '0.875rem',
    },
  },

  // Style variants
  variants: {
    primary: {
      backgroundColor: '#3b82f6',
      color: 'white',
      '&:hover': {
        backgroundColor: '#2563eb',
      },
      '&:disabled': {
        backgroundColor: '#6b7280',
        cursor: 'not-allowed',
        opacity: 0.6,
      },
    },
    secondary: {
      backgroundColor: 'transparent',
      color: '#d4d4d8',
      border: '1px solid #52525b',
      '&:hover': {
        backgroundColor: '#3f3f46',
        color: '#f4f4f5',
      },
    },
    tertiary: {
      backgroundColor: '#52525b',
      color: 'white',
      '&:hover': {
        backgroundColor: '#71717a',
      },
    },
    success: {
      backgroundColor: '#16a34a',
      color: 'white',
      '&:hover': {
        backgroundColor: '#15803d',
      },
    },
    danger: {
      backgroundColor: '#dc2626',
      color: 'white',
      '&:hover': {
        backgroundColor: '#b91c1c',
      },
    },
  },
}

// Helper function to combine button styles
export const getButtonStyle = (
  variant: keyof typeof buttonStyles.variants = 'primary',
  size: keyof typeof buttonStyles.sizes = 'medium',
  customStyles?: React.CSSProperties
): React.CSSProperties => {
  const variantStyle = buttonStyles.variants[variant]
  const sizeStyle = buttonStyles.sizes[size]
  
  // Extract hover and disabled states
  const { '&:hover': hover, '&:disabled': disabled, ...baseVariantStyle } = variantStyle as any
  
  return {
    ...buttonStyles.base,
    ...sizeStyle,
    ...baseVariantStyle,
    ...customStyles,
  }
}

// Common button combinations
export const commonButtons = {
  // Navigation buttons
  primaryAction: getButtonStyle('primary', 'large'),
  secondaryAction: getButtonStyle('secondary', 'medium'),
  
  // Form buttons
  submit: getButtonStyle('primary', 'medium'),
  cancel: getButtonStyle('secondary', 'medium'),
  
  // Utility buttons
  toolButton: getButtonStyle('tertiary', 'medium'),
  smallAction: getButtonStyle('tertiary', 'small'),
  
  // Header buttons
  headerButton: {
    ...getButtonStyle('secondary', 'medium'),
    backgroundColor: 'transparent',
    border: '1px solid #3f3f46',
    color: '#a1a1aa',
    padding: '0.5rem 1rem',
  },
}