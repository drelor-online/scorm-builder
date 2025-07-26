import { describe, it, expect } from 'vitest'
import * as constants from '../index'
import { COLORS } from '../colors'
import { SPACING, BREAKPOINTS, Z_INDEX, ANIMATION, BORDER_RADIUS, FONT_SIZE } from '../spacing'
import { DURATIONS } from '../durations'

describe('Constants index', () => {
  describe('Re-exports', () => {
    it('should re-export all color constants', () => {
      expect(constants.COLORS).toBeDefined()
      expect(constants.COLORS).toBe(COLORS)
      
      // Check specific color values
      expect(constants.COLORS.primary).toBe('#3b82f6')
      expect(constants.COLORS.success).toBe('#10b981')
    })

    it('should re-export all spacing constants', () => {
      expect(constants.SPACING).toBeDefined()
      expect(constants.SPACING).toBe(SPACING)
      
      expect(constants.BREAKPOINTS).toBeDefined()
      expect(constants.BREAKPOINTS).toBe(BREAKPOINTS)
      
      expect(constants.Z_INDEX).toBeDefined()
      expect(constants.Z_INDEX).toBe(Z_INDEX)
      
      expect(constants.ANIMATION).toBeDefined()
      expect(constants.ANIMATION).toBe(ANIMATION)
      
      expect(constants.BORDER_RADIUS).toBeDefined()
      expect(constants.BORDER_RADIUS).toBe(BORDER_RADIUS)
      
      expect(constants.FONT_SIZE).toBeDefined()
      expect(constants.FONT_SIZE).toBe(FONT_SIZE)
    })

    it('should re-export all duration constants', () => {
      expect(constants.DURATIONS).toBeDefined()
      expect(constants.DURATIONS).toBe(DURATIONS)
      
      // Check specific duration values
      expect(constants.DURATIONS.toastDuration).toBe(5000)
      expect(constants.DURATIONS.fadeIn).toBe(300)
    })
  })

  describe('Type exports', () => {
    it('should export color types', () => {
      // These type checks ensure the types are exported correctly
      type TestColorKey = constants.ColorKey
      type TestActivityColorKey = constants.ActivityColorKey
      type TestAlertColorKey = constants.AlertColorKey
      
      // Runtime checks to ensure types work correctly
      const colorKey: constants.ColorKey = 'primary'
      expect(constants.COLORS[colorKey]).toBeDefined()
    })

    it('should export spacing types', () => {
      // These type checks ensure the types are exported correctly
      type TestSpacingKey = constants.SpacingKey
      type TestBreakpointKey = constants.BreakpointKey
      
      // Runtime checks to ensure types work correctly
      const spacingKey: constants.SpacingKey = 'md'
      const breakpointKey: constants.BreakpointKey = 'lg'
      expect(constants.SPACING[spacingKey]).toBeDefined()
      expect(constants.BREAKPOINTS[breakpointKey]).toBeDefined()
    })

    it('should export duration types', () => {
      // These type checks ensure the types are exported correctly
      type TestDurationKey = constants.DurationKey
      
      // Runtime checks to ensure types work correctly
      const durationKey: constants.DurationKey = 'toastDuration'
      expect(constants.DURATIONS[durationKey]).toBeDefined()
    })
  })

  describe('No namespace pollution', () => {
    it('should only export expected constants', () => {
      const exportedKeys = Object.keys(constants)
      const expectedExports = [
        // From colors.ts
        'COLORS',
        // From spacing.ts
        'SPACING', 'BREAKPOINTS', 'Z_INDEX', 'ANIMATION', 'BORDER_RADIUS', 'FONT_SIZE',
        // From durations.ts
        'DURATIONS'
      ]
      
      // Check that we're not accidentally exporting more than expected
      expectedExports.forEach(key => {
        expect(exportedKeys).toContain(key)
      })
    })
  })

  describe('Usage patterns', () => {
    it('should allow destructuring imports', () => {
      const { COLORS, SPACING, DURATIONS } = constants
      
      expect(COLORS.primary).toBe('#3b82f6')
      expect(SPACING.md).toBe('0.75rem')
      expect(DURATIONS.fadeIn).toBe(300)
    })

    it('should allow accessing nested properties', () => {
      expect(constants.COLORS.activityColors['multiple-choice']).toBe('#3b82f6')
      expect(constants.COLORS.alertColors.success.bg).toBe('rgba(34, 197, 94, 0.1)')
    })

    it('should maintain referential equality', () => {
      // Importing from index should give same references as direct imports
      expect(constants.COLORS).toBe(COLORS)
      expect(constants.SPACING).toBe(SPACING)
      expect(constants.DURATIONS).toBe(DURATIONS)
    })
  })

  describe('Integration', () => {
    it('should provide constants for theming', () => {
      // Example of how constants might be used together for theming
      const buttonStyles = {
        backgroundColor: constants.COLORS.primary,
        padding: `${constants.SPACING.md} ${constants.SPACING.lg}`,
        borderRadius: constants.BORDER_RADIUS.md,
        fontSize: constants.FONT_SIZE.base,
        transition: `all ${constants.ANIMATION.normal} ease-in-out`
      }
      
      expect(buttonStyles.backgroundColor).toBe('#3b82f6')
      expect(buttonStyles.padding).toBe('0.75rem 1rem')
      expect(buttonStyles.borderRadius).toBe('0.5rem')
      expect(buttonStyles.fontSize).toBe('1rem')
      expect(buttonStyles.transition).toBe('all 200ms ease-in-out')
    })

    it('should provide constants for responsive design', () => {
      // Example media query usage
      const mediaQueries = {
        mobile: `@media (min-width: ${constants.BREAKPOINTS.sm})`,
        tablet: `@media (min-width: ${constants.BREAKPOINTS.md})`,
        desktop: `@media (min-width: ${constants.BREAKPOINTS.lg})`
      }
      
      expect(mediaQueries.mobile).toBe('@media (min-width: 640px)')
      expect(mediaQueries.tablet).toBe('@media (min-width: 768px)')
      expect(mediaQueries.desktop).toBe('@media (min-width: 1024px)')
    })

    it('should provide constants for animations', () => {
      // Example animation configuration
      const fadeInAnimation = {
        duration: constants.DURATIONS.fadeIn,
        animationSpeed: constants.ANIMATION.normal,
        opacity: { from: 0, to: 1 }
      }
      
      expect(fadeInAnimation.duration).toBe(300)
      expect(fadeInAnimation.animationSpeed).toBe('200ms')
    })
  })
})