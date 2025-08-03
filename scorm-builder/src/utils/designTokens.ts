import { tokens } from '../components/DesignSystem/designTokens'

/**
 * Utility functions to access design tokens in JavaScript/TypeScript
 */

// Type-safe color getter
export const getColor = (path: string): string => {
  const keys = path.split('.')
  let value: any = tokens.colors
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key]
    } else {
      console.warn(`Color path "${path}" not found in design tokens`)
      return '#000000'
    }
  }
  
  return typeof value === 'string' ? value : '#000000'
}

// Get specific color values
export const colors = {
  // Primary colors
  primary: tokens.colors.primary[500],
  primaryHover: tokens.colors.primary[600],
  primaryActive: tokens.colors.primary[700],
  
  // Secondary colors
  secondary: tokens.colors.secondary[500],
  secondaryHover: tokens.colors.secondary[600],
  secondaryActive: tokens.colors.secondary[700],
  
  // Success colors
  success: tokens.colors.success[500],
  successHover: tokens.colors.success[600],
  successActive: tokens.colors.success[700],
  
  // Danger colors
  danger: tokens.colors.danger[500],
  dangerHover: tokens.colors.danger[600],
  dangerActive: tokens.colors.danger[700],
  
  // Warning colors
  warning: tokens.colors.warning[500],
  warningHover: tokens.colors.warning[600],
  warningActive: tokens.colors.warning[700],
  
  // Background colors
  bgPrimary: tokens.colors.background.primary,
  bgSecondary: tokens.colors.background.secondary,
  bgTertiary: tokens.colors.background.tertiary,
  bgQuaternary: tokens.colors.background.quaternary,
  bgOverlay: tokens.colors.background.overlay,
  
  // Text colors
  textPrimary: tokens.colors.text.primary,
  textSecondary: tokens.colors.text.secondary,
  textTertiary: tokens.colors.text.tertiary,
  textQuaternary: tokens.colors.text.quaternary,
  textInverse: tokens.colors.text.inverse,
  
  // Border colors
  borderLight: tokens.colors.border.light,
  borderDefault: tokens.colors.border.default,
  borderMedium: tokens.colors.border.medium,
  borderDark: tokens.colors.border.dark,
  borderFocus: tokens.colors.border.focus,
}

// Spacing values
export const spacing = tokens.spacing

// Typography values
export const typography = tokens.typography

// Border radius values
export const borderRadius = tokens.borderRadius

// Shadow values
export const shadows = tokens.shadows

// Transition values
export const transitions = tokens.transitions

// Z-index values
export const zIndex = tokens.zIndex

// Utility to apply CSS variables to inline styles
export const cssVar = (name: string): string => {
  return `var(--${name})`
}

// Get a complete theme object for components
export const getTheme = () => ({
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
  zIndex,
})

export default {
  tokens,
  getColor,
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
  zIndex,
  cssVar,
  getTheme,
}