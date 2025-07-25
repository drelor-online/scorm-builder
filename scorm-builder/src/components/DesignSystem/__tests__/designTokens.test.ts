import { describe, it, expect } from 'vitest'
import { tokens } from '../designTokens'

describe('Design Tokens', () => {
  it('should have all color tokens defined', () => {
    // Primary colors
    expect(tokens.colors.primary.main).toBe('#3b82f6')
    expect(tokens.colors.primary.hover).toBe('#2563eb')
    expect(tokens.colors.primary.active).toBe('#1d4ed8')

    // Secondary colors
    expect(tokens.colors.secondary.main).toBe('transparent')
    expect(tokens.colors.secondary.hover).toBe('#3f3f46')
    expect(tokens.colors.secondary.active).toBe('#52525b')
    expect(tokens.colors.secondary.border).toBe('#52525b')
    expect(tokens.colors.secondary.text).toBe('#d4d4d8')

    // Tertiary colors
    expect(tokens.colors.tertiary.main).toBe('#52525b')
    expect(tokens.colors.tertiary.hover).toBe('#71717a')
    expect(tokens.colors.tertiary.active).toBe('#6b7280')

    // Success colors
    expect(tokens.colors.success.main).toBe('#16a34a')
    expect(tokens.colors.success.hover).toBe('#15803d')
    expect(tokens.colors.success.active).toBe('#14532d')

    // Danger colors
    expect(tokens.colors.danger.main).toBe('#dc2626')
    expect(tokens.colors.danger.hover).toBe('#b91c1c')
    expect(tokens.colors.danger.active).toBe('#991b1b')

    // Background colors
    expect(tokens.colors.background.primary).toBe('#09090b')
    expect(tokens.colors.background.secondary).toBe('#18181b')
    expect(tokens.colors.background.tertiary).toBe('#27272a')
    expect(tokens.colors.background.card).toBe('#18181b')

    // Text colors
    expect(tokens.colors.text.primary).toBe('#f4f4f5')
    expect(tokens.colors.text.secondary).toBe('#d4d4d8')
    expect(tokens.colors.text.tertiary).toBe('#a1a1aa')
    expect(tokens.colors.text.muted).toBe('#71717a')

    // Border colors
    expect(tokens.colors.border.default).toBe('#3f3f46')
    expect(tokens.colors.border.light).toBe('#27272a')
    expect(tokens.colors.border.dark).toBe('#52525b')

    // Gray scale
    expect(tokens.colors.gray).toBeDefined()
    expect(tokens.colors.gray[100]).toBe('#f4f4f5')
    expect(tokens.colors.gray[500]).toBe('#71717a')
    expect(tokens.colors.gray[900]).toBe('#18181b')
  })

  it('should have all spacing tokens defined', () => {
    expect(tokens.spacing.xs).toBe('0.25rem')
    expect(tokens.spacing.sm).toBe('0.5rem')
    expect(tokens.spacing.md).toBe('0.75rem')
    expect(tokens.spacing.lg).toBe('1rem')
    expect(tokens.spacing.xl).toBe('1.5rem')
    expect(tokens.spacing['2xl']).toBe('2rem')
    expect(tokens.spacing['3xl']).toBe('3rem')
    expect(tokens.spacing['4xl']).toBe('4rem')
  })

  it('should have all typography tokens defined', () => {
    // Font families
    expect(tokens.typography.fontFamily).toContain('-apple-system')
    expect(tokens.typography.fontFamilyMono).toContain('ui-monospace')

    // Font sizes
    expect(tokens.typography.fontSize.xs).toBe('0.75rem')
    expect(tokens.typography.fontSize.sm).toBe('0.875rem')
    expect(tokens.typography.fontSize.base).toBe('1rem')
    expect(tokens.typography.fontSize.lg).toBe('1.125rem')
    expect(tokens.typography.fontSize.xl).toBe('1.25rem')
    expect(tokens.typography.fontSize['2xl']).toBe('1.5rem')
    expect(tokens.typography.fontSize['3xl']).toBe('1.875rem')

    // Font weights
    expect(tokens.typography.fontWeight.normal).toBe(400)
    expect(tokens.typography.fontWeight.medium).toBe(500)
    expect(tokens.typography.fontWeight.semibold).toBe(600)
    expect(tokens.typography.fontWeight.bold).toBe(700)

    // Line heights
    expect(tokens.typography.lineHeight.tight).toBe(1.25)
    expect(tokens.typography.lineHeight.normal).toBe(1.5)
    expect(tokens.typography.lineHeight.relaxed).toBe(1.75)
  })

  it('should have all border radius tokens defined', () => {
    expect(tokens.borderRadius.none).toBe('0')
    expect(tokens.borderRadius.sm).toBe('0.25rem')
    expect(tokens.borderRadius.md).toBe('0.5rem')
    expect(tokens.borderRadius.lg).toBe('0.75rem')
    expect(tokens.borderRadius.xl).toBe('1rem')
    expect(tokens.borderRadius.full).toBe('9999px')
  })

  it('should have all shadow tokens defined', () => {
    expect(tokens.shadows.none).toBe('none')
    expect(tokens.shadows.sm).toContain('0 1px 2px')
    expect(tokens.shadows.md).toContain('0 4px 6px')
    expect(tokens.shadows.lg).toContain('0 10px 15px')
    expect(tokens.shadows.xl).toContain('0 20px 25px')
  })

  it('should have all transition tokens defined', () => {
    expect(tokens.transitions.fast).toBe('150ms ease-in-out')
    expect(tokens.transitions.normal).toBe('200ms ease-in-out')
    expect(tokens.transitions.slow).toBe('300ms ease-in-out')
  })

  it('should have all z-index tokens defined', () => {
    expect(tokens.zIndex.base).toBe(0)
    expect(tokens.zIndex.dropdown).toBe(1000)
    expect(tokens.zIndex.sticky).toBe(1020)
    expect(tokens.zIndex.fixed).toBe(1030)
    expect(tokens.zIndex.modalBackdrop).toBe(1040)
    expect(tokens.zIndex.modal).toBe(1050)
    expect(tokens.zIndex.popover).toBe(1060)
    expect(tokens.zIndex.tooltip).toBe(1070)
  })

  it('should have proper token structure', () => {
    // Verify the top-level structure
    expect(tokens).toHaveProperty('colors')
    expect(tokens).toHaveProperty('spacing')
    expect(tokens).toHaveProperty('typography')
    expect(tokens).toHaveProperty('borderRadius')
    expect(tokens).toHaveProperty('shadows')
    expect(tokens).toHaveProperty('transitions')
    expect(tokens).toHaveProperty('zIndex')
  })
})