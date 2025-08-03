import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getColor,
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
  zIndex,
  cssVar,
  getTheme
} from '../designTokens'

// Mock console.warn
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

describe('designTokens utilities', () => {
  beforeEach(() => {
    consoleWarnSpy.mockClear()
  })

  describe('getColor', () => {
    it('should return color value for valid path', () => {
      const color = getColor('primary.500')
      expect(color).toBe('#3b82f6')
    })

    it('should return color value for nested path', () => {
      const color = getColor('background.primary')
      expect(color).toBe('#09090b')
    })

    it('should return fallback color for invalid path', () => {
      const color = getColor('invalid.path.here')
      expect(color).toBe('#000000')
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Color path "invalid.path.here" not found in design tokens'
      )
    })

    it('should handle empty path', () => {
      const color = getColor('')
      expect(color).toBe('#000000')
    })

    it('should handle single level path', () => {
      const color = getColor('white')
      expect(color).toBe('#000000')
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Color path "white" not found in design tokens'
      )
    })
  })

  describe('colors object', () => {
    it('should have primary colors', () => {
      expect(colors.primary).toBe('#3b82f6')
      expect(colors.primaryHover).toBe('#2563eb')
      expect(colors.primaryActive).toBe('#1d4ed8')
    })

    it('should have secondary colors', () => {
      expect(colors.secondary).toBe('#71717a')
      expect(colors.secondaryHover).toBe('#52525b')
      expect(colors.secondaryActive).toBe('#3f3f46')
    })

    it('should have success colors', () => {
      expect(colors.success).toBe('#22c55e')
      expect(colors.successHover).toBe('#16a34a')
      expect(colors.successActive).toBe('#15803d')
    })

    it('should have danger colors', () => {
      expect(colors.danger).toBe('#ef4444')
      expect(colors.dangerHover).toBe('#dc2626')
      expect(colors.dangerActive).toBe('#b91c1c')
    })

    it('should have warning colors', () => {
      expect(colors.warning).toBe('#f59e0b')
      expect(colors.warningHover).toBe('#d97706')
      expect(colors.warningActive).toBe('#b45309')
    })

    it('should have background colors', () => {
      expect(colors.bgPrimary).toBe('#09090b')
      expect(colors.bgSecondary).toBe('#18181b')
      expect(colors.bgTertiary).toBe('#27272a')
      expect(colors.bgQuaternary).toBe('#3f3f46')
      expect(colors.bgOverlay).toBe('rgba(0, 0, 0, 0.75)')
    })

    it('should have text colors', () => {
      expect(colors.textPrimary).toBe('#f4f4f5')
      expect(colors.textSecondary).toBe('#d4d4d8')
      expect(colors.textTertiary).toBe('#a1a1aa')
      expect(colors.textQuaternary).toBe('#71717a')
      expect(colors.textInverse).toBe('#09090b')
    })

    it('should have border colors', () => {
      expect(colors.borderLight).toBe('#27272a')
      expect(colors.borderDefault).toBe('#3f3f46')
      expect(colors.borderMedium).toBe('#52525b')
      expect(colors.borderDark).toBe('#71717a')
      expect(colors.borderFocus).toBe('#3b82f6')
    })
  })

  describe('exported token values', () => {
    it('should export spacing values', () => {
      expect(spacing).toBeDefined()
      expect(spacing.xs).toBe('0.25rem')
      expect(spacing.sm).toBe('0.5rem')
      expect(spacing.md).toBe('0.75rem')
      expect(spacing.lg).toBe('1rem')
      expect(spacing.xl).toBe('1.5rem')
    })

    it('should export typography values', () => {
      expect(typography).toBeDefined()
      expect(typography.fontSize.xs).toBe('0.75rem')
      expect(typography.fontSize.sm).toBe('0.875rem')
      expect(typography.fontSize.base).toBe('1rem')
      expect(typography.fontWeight.normal).toBe(400)
      expect(typography.fontWeight.medium).toBe(500)
      expect(typography.fontWeight.bold).toBe(700)
    })

    it('should export borderRadius values', () => {
      expect(borderRadius).toBeDefined()
      expect(borderRadius.none).toBe('0')
      expect(borderRadius.sm).toBe('0.25rem')
      expect(borderRadius.md).toBe('0.5rem')
      expect(borderRadius.lg).toBe('0.75rem')
      expect(borderRadius.full).toBe('9999px')
    })

    it('should export shadow values', () => {
      expect(shadows).toBeDefined()
      expect(shadows.none).toBe('none')
      expect(shadows.sm).toContain('0 1px 2px')
      expect(shadows.md).toContain('0 4px 6px')
      expect(shadows.lg).toContain('0 10px 15px')
    })

    it('should export transition values', () => {
      expect(transitions).toBeDefined()
      expect(transitions.fast).toBe('150ms ease-in-out')
      expect(transitions.normal).toBe('200ms ease-in-out')
      expect(transitions.slow).toBe('300ms ease-in-out')
    })

    it('should export zIndex values', () => {
      expect(zIndex).toBeDefined()
      expect(zIndex.dropdown).toBe(1000)
      expect(zIndex.sticky).toBe(1020)
      expect(zIndex.fixed).toBe(1030)
      expect(zIndex.modal).toBe(1050)
      expect(zIndex.tooltip).toBe(1070)
    })
  })

  describe('cssVar', () => {
    it('should return CSS variable format', () => {
      expect(cssVar('color-primary')).toBe('var(--color-primary)')
      expect(cssVar('spacing-md')).toBe('var(--spacing-md)')
    })

    it('should handle empty string', () => {
      expect(cssVar('')).toBe('var(--)')
    })
  })

  describe('getTheme', () => {
    it('should return complete theme object', () => {
      const theme = getTheme()
      
      expect(theme).toHaveProperty('colors')
      expect(theme).toHaveProperty('spacing')
      expect(theme).toHaveProperty('typography')
      expect(theme).toHaveProperty('borderRadius')
      expect(theme).toHaveProperty('shadows')
      expect(theme).toHaveProperty('transitions')
      expect(theme).toHaveProperty('zIndex')
      
      // Check that values match
      expect(theme.colors).toEqual(colors)
      expect(theme.spacing).toEqual(spacing)
      expect(theme.typography).toEqual(typography)
      expect(theme.borderRadius).toEqual(borderRadius)
      expect(theme.shadows).toEqual(shadows)
      expect(theme.transitions).toEqual(transitions)
      expect(theme.zIndex).toEqual(zIndex)
    })
  })

  describe('default export', () => {
    it('should export all utilities as default', async () => {
      const designTokens = await import('../designTokens')
      const defaultExport = designTokens.default
      
      expect(defaultExport).toHaveProperty('tokens')
      expect(defaultExport).toHaveProperty('getColor')
      expect(defaultExport).toHaveProperty('colors')
      expect(defaultExport).toHaveProperty('spacing')
      expect(defaultExport).toHaveProperty('typography')
      expect(defaultExport).toHaveProperty('borderRadius')
      expect(defaultExport).toHaveProperty('shadows')
      expect(defaultExport).toHaveProperty('transitions')
      expect(defaultExport).toHaveProperty('zIndex')
      expect(defaultExport).toHaveProperty('cssVar')
      expect(defaultExport).toHaveProperty('getTheme')
    })
  })
})