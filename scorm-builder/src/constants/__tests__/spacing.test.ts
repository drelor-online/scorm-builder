import { describe, it, expect } from 'vitest'
import { 
  SPACING, 
  BREAKPOINTS, 
  Z_INDEX, 
  ANIMATION, 
  BORDER_RADIUS, 
  FONT_SIZE,
  SpacingKey,
  BreakpointKey 
} from '../spacing'

describe('SPACING constants', () => {
  describe('Spacing values', () => {
    it('should have all spacing sizes defined', () => {
      expect(SPACING.xs).toBe('0.25rem')
      expect(SPACING.sm).toBe('0.5rem')
      expect(SPACING.md).toBe('0.75rem')
      expect(SPACING.lg).toBe('1rem')
      expect(SPACING.xl).toBe('1.5rem')
      expect(SPACING['2xl']).toBe('2rem')
      expect(SPACING['3xl']).toBe('3rem')
      expect(SPACING['4xl']).toBe('4rem')
    })

    it('should have progressive spacing scale', () => {
      const remValues = Object.values(SPACING).map(v => parseFloat(v))
      
      // Each value should be larger than the previous
      for (let i = 1; i < remValues.length; i++) {
        expect(remValues[i]).toBeGreaterThan(remValues[i - 1])
      }
    })

    it('should convert to correct pixel values', () => {
      // Assuming 1rem = 16px
      const expectedPixels = {
        xs: 4,    // 0.25 * 16
        sm: 8,    // 0.5 * 16
        md: 12,   // 0.75 * 16
        lg: 16,   // 1 * 16
        xl: 24,   // 1.5 * 16
        '2xl': 32, // 2 * 16
        '3xl': 48, // 3 * 16
        '4xl': 64  // 4 * 16
      }
      
      Object.entries(SPACING).forEach(([key, value]) => {
        const remValue = parseFloat(value)
        const pixelValue = remValue * 16
        expect(pixelValue).toBe(expectedPixels[key as SpacingKey])
      })
    })
  })

  describe('Breakpoints', () => {
    it('should have all breakpoint sizes defined', () => {
      expect(BREAKPOINTS.sm).toBe('640px')
      expect(BREAKPOINTS.md).toBe('768px')
      expect(BREAKPOINTS.lg).toBe('1024px')
      expect(BREAKPOINTS.xl).toBe('1280px')
      expect(BREAKPOINTS['2xl']).toBe('1536px')
    })

    it('should have progressive breakpoint scale', () => {
      const pixelValues = Object.values(BREAKPOINTS).map(v => parseInt(v))
      
      // Each breakpoint should be larger than the previous
      for (let i = 1; i < pixelValues.length; i++) {
        expect(pixelValues[i]).toBeGreaterThan(pixelValues[i - 1])
      }
    })

    it('should follow common responsive design patterns', () => {
      // Check that breakpoints align with common device sizes
      expect(parseInt(BREAKPOINTS.sm)).toBeGreaterThanOrEqual(640) // Mobile landscape
      expect(parseInt(BREAKPOINTS.md)).toBeGreaterThanOrEqual(768) // Tablet
      expect(parseInt(BREAKPOINTS.lg)).toBeGreaterThanOrEqual(1024) // Desktop
      expect(parseInt(BREAKPOINTS.xl)).toBeGreaterThanOrEqual(1280) // Large desktop
    })
  })

  describe('Z-Index values', () => {
    it('should have all z-index levels defined', () => {
      expect(Z_INDEX.dropdown).toBe(10)
      expect(Z_INDEX.modal).toBe(50)
      expect(Z_INDEX.popover).toBe(100)
      expect(Z_INDEX.tooltip).toBe(150)
      expect(Z_INDEX.toast).toBe(1000)
    })

    it('should have logical z-index hierarchy', () => {
      // Dropdown should be below modal
      expect(Z_INDEX.dropdown).toBeLessThan(Z_INDEX.modal)
      
      // Modal should be below popover
      expect(Z_INDEX.modal).toBeLessThan(Z_INDEX.popover)
      
      // Popover should be below tooltip
      expect(Z_INDEX.popover).toBeLessThan(Z_INDEX.tooltip)
      
      // Toast should be highest
      expect(Z_INDEX.toast).toBeGreaterThan(Z_INDEX.tooltip)
    })

    it('should have reasonable z-index values', () => {
      Object.values(Z_INDEX).forEach(zIndex => {
        expect(zIndex).toBeGreaterThan(0)
        expect(zIndex).toBeLessThanOrEqual(9999) // Avoid excessively high values
      })
    })
  })

  describe('Animation durations', () => {
    it('should have all animation speeds defined', () => {
      expect(ANIMATION.fast).toBe('150ms')
      expect(ANIMATION.normal).toBe('200ms')
      expect(ANIMATION.slow).toBe('300ms')
    })

    it('should have progressive animation scale', () => {
      const msValues = Object.values(ANIMATION).map(v => parseInt(v))
      
      expect(msValues[0]).toBeLessThan(msValues[1]) // fast < normal
      expect(msValues[1]).toBeLessThan(msValues[2]) // normal < slow
    })

    it('should have reasonable animation durations', () => {
      Object.values(ANIMATION).forEach(duration => {
        const ms = parseInt(duration)
        expect(ms).toBeGreaterThanOrEqual(100) // Not too fast
        expect(ms).toBeLessThanOrEqual(500) // Not too slow
      })
    })
  })

  describe('Border radius values', () => {
    it('should have all border radius sizes defined', () => {
      expect(BORDER_RADIUS.sm).toBe('0.25rem')
      expect(BORDER_RADIUS.md).toBe('0.5rem')
      expect(BORDER_RADIUS.lg).toBe('0.75rem')
      expect(BORDER_RADIUS.xl).toBe('1rem')
      expect(BORDER_RADIUS.full).toBe('9999px')
    })

    it('should have progressive radius scale', () => {
      const remValues = ['sm', 'md', 'lg', 'xl'].map(
        key => parseFloat(BORDER_RADIUS[key as keyof typeof BORDER_RADIUS])
      )
      
      // Each value should be larger than the previous
      for (let i = 1; i < remValues.length; i++) {
        expect(remValues[i]).toBeGreaterThan(remValues[i - 1])
      }
    })

    it('should have full radius for circular elements', () => {
      // Full radius should be very large to ensure circular shape
      expect(parseInt(BORDER_RADIUS.full)).toBeGreaterThan(1000)
    })
  })

  describe('Font size values', () => {
    it('should have all font sizes defined', () => {
      expect(FONT_SIZE.xs).toBe('0.75rem')
      expect(FONT_SIZE.sm).toBe('0.875rem')
      expect(FONT_SIZE.base).toBe('1rem')
      expect(FONT_SIZE.lg).toBe('1.125rem')
      expect(FONT_SIZE.xl).toBe('1.25rem')
      expect(FONT_SIZE['2xl']).toBe('1.5rem')
      expect(FONT_SIZE['3xl']).toBe('1.875rem')
      expect(FONT_SIZE['4xl']).toBe('2.25rem')
    })

    it('should have progressive font scale', () => {
      const remValues = Object.values(FONT_SIZE).map(v => parseFloat(v))
      
      // Each value should be larger than the previous
      for (let i = 1; i < remValues.length; i++) {
        expect(remValues[i]).toBeGreaterThan(remValues[i - 1])
      }
    })

    it('should have base font size of 1rem', () => {
      expect(FONT_SIZE.base).toBe('1rem')
      expect(parseFloat(FONT_SIZE.base)).toBe(1)
    })

    it('should convert to correct pixel values', () => {
      // Assuming 1rem = 16px
      const expectedPixels = {
        xs: 12,     // 0.75 * 16
        sm: 14,     // 0.875 * 16
        base: 16,   // 1 * 16
        lg: 18,     // 1.125 * 16
        xl: 20,     // 1.25 * 16
        '2xl': 24,  // 1.5 * 16
        '3xl': 30,  // 1.875 * 16
        '4xl': 36   // 2.25 * 16
      }
      
      Object.entries(FONT_SIZE).forEach(([key, value]) => {
        const remValue = parseFloat(value)
        const pixelValue = remValue * 16
        expect(pixelValue).toBeCloseTo(expectedPixels[key as keyof typeof FONT_SIZE])
      })
    })
  })

  describe('Type safety', () => {
    it('should export correct type definitions', () => {
      // Type checking - these should compile without errors
      const spacingKey: SpacingKey = 'md'
      const breakpointKey: BreakpointKey = 'lg'
      
      expect(SPACING[spacingKey]).toBeDefined()
      expect(BREAKPOINTS[breakpointKey]).toBeDefined()
    })
  })

  describe('Value format validation', () => {
    it('should use rem units for spacing', () => {
      Object.values(SPACING).forEach(value => {
        expect(value).toMatch(/^\d+(\.\d+)?rem$/)
      })
    })

    it('should use px units for breakpoints', () => {
      Object.values(BREAKPOINTS).forEach(value => {
        expect(value).toMatch(/^\d+px$/)
      })
    })

    it('should use ms units for animations', () => {
      Object.values(ANIMATION).forEach(value => {
        expect(value).toMatch(/^\d+ms$/)
      })
    })

    it('should use rem or px units for border radius', () => {
      Object.values(BORDER_RADIUS).forEach(value => {
        expect(value).toMatch(/^(\d+(\.\d+)?rem|\d+px)$/)
      })
    })

    it('should use rem units for font sizes', () => {
      Object.values(FONT_SIZE).forEach(value => {
        expect(value).toMatch(/^\d+(\.\d+)?rem$/)
      })
    })
  })
})