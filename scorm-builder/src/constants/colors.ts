import { tokens } from '../components/DesignSystem/designTokens'

// Re-export design token colors for backward compatibility
export const COLORS = {
  // Primary colors
  primary: tokens.colors.primary[500],
  primaryHover: tokens.colors.primary[600],
  primaryDark: tokens.colors.primary[700],
  
  // Secondary colors
  secondary: tokens.colors.secondary[500],
  secondaryHover: tokens.colors.secondary[600],
  
  // Success/Error/Warning
  success: tokens.colors.success[500],
  successDark: tokens.colors.success[700],
  error: tokens.colors.danger[500],
  errorDark: tokens.colors.danger[600],
  warning: tokens.colors.warning[500],
  warningDark: tokens.colors.warning[600],
  
  // Neutral colors
  background: tokens.colors.background.secondary,
  backgroundLight: tokens.colors.background.tertiary,
  backgroundLighter: tokens.colors.background.quaternary,
  backgroundDark: tokens.colors.background.primary,
  
  text: tokens.colors.text.primary,
  textMuted: tokens.colors.text.tertiary,
  textDark: tokens.colors.text.quaternary,
  
  border: tokens.colors.border.default,
  borderLight: tokens.colors.border.medium,
  
  // Activity type colors
  activityColors: tokens.colors.activity,
  
  // Alert colors
  alertColors: {
    info: tokens.colors.alert.info,
    warning: tokens.colors.alert.warning,
    success: tokens.colors.alert.success,
    error: tokens.colors.alert.danger
  }
} as const

export type ColorKey = keyof typeof COLORS
export type ActivityColorKey = keyof typeof COLORS.activityColors
export type AlertColorKey = keyof typeof COLORS.alertColors