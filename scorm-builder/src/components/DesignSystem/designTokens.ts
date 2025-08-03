// Design tokens for consistent styling across the application
export const tokens = {
  // Colors - Single source of truth
  colors: {
    // Brand colors
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',  // Main
      600: '#2563eb',  // Hover
      700: '#1d4ed8',  // Active
      800: '#1e40af',
      900: '#1e3a8a',
    },
    secondary: {
      50: '#fafafa',
      100: '#f4f4f5',
      200: '#e4e4e7',
      300: '#d4d4d8',
      400: '#a1a1aa',
      500: '#71717a',  // Main
      600: '#52525b',  // Hover
      700: '#3f3f46',  // Active
      800: '#27272a',
      900: '#18181b',
    },
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',  // Main
      600: '#16a34a',  // Hover
      700: '#15803d',  // Active
      800: '#166534',
      900: '#14532d',
    },
    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',  // Main
      600: '#dc2626',  // Hover
      700: '#b91c1c',  // Active
      800: '#991b1b',
      900: '#7f1d1d',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',  // Main
      600: '#d97706',  // Hover
      700: '#b45309',  // Active
      800: '#92400e',
      900: '#78350f',
    },
    info: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',  // Main (same as primary)
      600: '#2563eb',  // Hover
      700: '#1d4ed8',  // Active
      800: '#1e40af',
      900: '#1e3a8a',
    },
    // Background colors
    background: {
      primary: '#09090b',      // Main app background
      secondary: '#18181b',    // Card backgrounds
      tertiary: '#27272a',     // Elevated surfaces
      quaternary: '#3f3f46',   // Hover states
      overlay: 'rgba(0, 0, 0, 0.75)',  // Modal overlays
    },
    // Text colors
    text: {
      primary: '#f4f4f5',      // Main text
      secondary: '#d4d4d8',    // Secondary text
      tertiary: '#a1a1aa',     // Muted text
      quaternary: '#71717a',   // Very muted text
      inverse: '#09090b',      // Text on light backgrounds
    },
    // Border colors
    border: {
      light: '#27272a',        // Subtle borders
      default: '#3f3f46',      // Default borders
      medium: '#52525b',       // Emphasized borders
      dark: '#71717a',         // Strong borders
      focus: '#3b82f6',        // Focus rings
    },
    // Special purpose colors
    activity: {
      'multiple-choice': '#3b82f6',
      'true-false': '#8b5cf6',
      'fill-in-the-blank': '#10b981',
      'drag-and-drop': '#f59e0b',
      'scenario': '#ec4899'
    },
    // Alert/notification colors with opacity
    alert: {
      info: {
        background: 'rgba(59, 130, 246, 0.1)',
        border: 'rgba(59, 130, 246, 0.2)',
        text: '#93c5fd'
      },
      success: {
        background: 'rgba(34, 197, 94, 0.15)',
        border: 'rgba(34, 197, 94, 0.3)',
        text: '#ffffff'  // White text for maximum contrast on green
      },
      warning: {
        background: 'rgba(245, 158, 11, 0.1)',
        border: 'rgba(245, 158, 11, 0.2)',
        text: '#fcd34d'
      },
      danger: {
        background: 'rgba(239, 68, 68, 0.1)',
        border: 'rgba(239, 68, 68, 0.2)',
        text: '#fca5a5'
      }
    }
  },
  
  // Spacing scale (4px base)
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '0.75rem',    // 12px
    lg: '1rem',       // 16px
    xl: '1.5rem',     // 24px
    '2xl': '2rem',    // 32px
    '3xl': '3rem',    // 48px
    '4xl': '4rem',    // 64px
  },
  
  // Typography
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontFamilyMono: 'ui-monospace, SFMono-Regular, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  
  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.25rem',   // 4px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    full: '9999px',
  },
  
  // Shadows
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  
  // Transitions
  transitions: {
    fast: '150ms ease-in-out',
    normal: '200ms ease-in-out',
    slow: '300ms ease-in-out',
  },
  
  // Z-index scale
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
}