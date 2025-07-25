export const COLORS = {
  // Primary colors
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  primaryDark: '#1d4ed8',
  
  // Secondary colors
  secondary: '#6b7280',
  secondaryHover: '#4b5563',
  
  // Success/Error/Warning
  success: '#10b981',
  successDark: '#059669',
  error: '#ef4444',
  errorDark: '#dc2626',
  warning: '#f59e0b',
  warningDark: '#d97706',
  
  // Neutral colors
  background: '#18181b',
  backgroundLight: '#27272a',
  backgroundLighter: '#3f3f46',
  backgroundDark: '#0a0a0b',
  
  text: '#e4e4e7',
  textMuted: '#a1a1aa',
  textDark: '#71717a',
  
  border: '#3f3f46',
  borderLight: '#52525b',
  
  // Activity type colors
  activityColors: {
    'multiple-choice': '#3b82f6',
    'true-false': '#8b5cf6',
    'fill-in-the-blank': '#10b981',
    'drag-and-drop': '#f59e0b',
    'scenario': '#ec4899'
  },
  
  // Alert colors
  alertColors: {
    info: {
      bg: 'rgba(59, 130, 246, 0.1)',
      border: 'rgba(59, 130, 246, 0.2)',
      text: '#93c5fd'
    },
    warning: {
      bg: 'rgba(251, 146, 60, 0.1)',
      border: 'rgba(251, 146, 60, 0.2)',
      text: '#fdba74'
    },
    success: {
      bg: 'rgba(34, 197, 94, 0.1)',
      border: 'rgba(34, 197, 94, 0.2)',
      text: '#86efac'
    },
    error: {
      bg: 'rgba(239, 68, 68, 0.1)',
      border: 'rgba(239, 68, 68, 0.2)',
      text: '#fca5a5'
    }
  }
} as const

export type ColorKey = keyof typeof COLORS
export type ActivityColorKey = keyof typeof COLORS.activityColors
export type AlertColorKey = keyof typeof COLORS.alertColors