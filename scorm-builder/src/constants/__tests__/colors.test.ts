import { describe, it, expect } from 'vitest'
import { COLORS, ColorKey, ActivityColorKey, AlertColorKey } from '../colors'

describe('COLORS constants', () => {
  describe('Color values', () => {
    it('should have all primary colors defined', () => {
      expect(COLORS.primary).toBe('#3b82f6')
      expect(COLORS.primaryHover).toBe('#2563eb')
      expect(COLORS.primaryDark).toBe('#1d4ed8')
    })

    it('should have all secondary colors defined', () => {
      expect(COLORS.secondary).toBe('#6b7280')
      expect(COLORS.secondaryHover).toBe('#4b5563')
    })

    it('should have all status colors defined', () => {
      expect(COLORS.success).toBe('#10b981')
      expect(COLORS.successDark).toBe('#059669')
      expect(COLORS.error).toBe('#ef4444')
      expect(COLORS.errorDark).toBe('#dc2626')
      expect(COLORS.warning).toBe('#f59e0b')
      expect(COLORS.warningDark).toBe('#d97706')
    })

    it('should have all background colors defined', () => {
      expect(COLORS.background).toBe('#18181b')
      expect(COLORS.backgroundLight).toBe('#27272a')
      expect(COLORS.backgroundLighter).toBe('#3f3f46')
      expect(COLORS.backgroundDark).toBe('#0a0a0b')
    })

    it('should have all text colors defined', () => {
      expect(COLORS.text).toBe('#e4e4e7')
      expect(COLORS.textMuted).toBe('#a1a1aa')
      expect(COLORS.textDark).toBe('#71717a')
    })

    it('should have all border colors defined', () => {
      expect(COLORS.border).toBe('#3f3f46')
      expect(COLORS.borderLight).toBe('#52525b')
    })
  })

  describe('Activity colors', () => {
    it('should have all activity type colors defined', () => {
      expect(COLORS.activityColors['multiple-choice']).toBe('#3b82f6')
      expect(COLORS.activityColors['true-false']).toBe('#8b5cf6')
      expect(COLORS.activityColors['fill-in-the-blank']).toBe('#10b981')
      expect(COLORS.activityColors['drag-and-drop']).toBe('#f59e0b')
      expect(COLORS.activityColors['scenario']).toBe('#ec4899')
    })

    it('should have exactly 5 activity types', () => {
      const activityTypes = Object.keys(COLORS.activityColors)
      expect(activityTypes).toHaveLength(5)
    })
  })

  describe('Alert colors', () => {
    it('should have all alert variants defined', () => {
      const alertTypes: AlertColorKey[] = ['info', 'warning', 'success', 'error']
      
      alertTypes.forEach(type => {
        expect(COLORS.alertColors[type]).toBeDefined()
        expect(COLORS.alertColors[type].bg).toBeDefined()
        expect(COLORS.alertColors[type].border).toBeDefined()
        expect(COLORS.alertColors[type].text).toBeDefined()
      })
    })

    it('should have correct info alert colors', () => {
      expect(COLORS.alertColors.info.bg).toBe('rgba(59, 130, 246, 0.1)')
      expect(COLORS.alertColors.info.border).toBe('rgba(59, 130, 246, 0.2)')
      expect(COLORS.alertColors.info.text).toBe('#93c5fd')
    })

    it('should have correct warning alert colors', () => {
      expect(COLORS.alertColors.warning.bg).toBe('rgba(251, 146, 60, 0.1)')
      expect(COLORS.alertColors.warning.border).toBe('rgba(251, 146, 60, 0.2)')
      expect(COLORS.alertColors.warning.text).toBe('#fdba74')
    })

    it('should have correct success alert colors', () => {
      expect(COLORS.alertColors.success.bg).toBe('rgba(34, 197, 94, 0.1)')
      expect(COLORS.alertColors.success.border).toBe('rgba(34, 197, 94, 0.2)')
      expect(COLORS.alertColors.success.text).toBe('#86efac')
    })

    it('should have correct error alert colors', () => {
      expect(COLORS.alertColors.error.bg).toBe('rgba(239, 68, 68, 0.1)')
      expect(COLORS.alertColors.error.border).toBe('rgba(239, 68, 68, 0.2)')
      expect(COLORS.alertColors.error.text).toBe('#fca5a5')
    })
  })

  describe('Type safety', () => {
    it('should export correct type definitions', () => {
      // Type checking - these should compile without errors
      const colorKey: ColorKey = 'primary'
      const activityKey: ActivityColorKey = 'multiple-choice'
      const alertKey: AlertColorKey = 'info'
      
      expect(COLORS[colorKey]).toBeDefined()
      expect(COLORS.activityColors[activityKey]).toBeDefined()
      expect(COLORS.alertColors[alertKey]).toBeDefined()
    })
  })

  describe('Color format validation', () => {
    it('should use valid hex colors for simple colors', () => {
      const hexColorRegex = /^#[0-9a-f]{6}$/i
      
      const simpleColors = [
        COLORS.primary, COLORS.primaryHover, COLORS.primaryDark,
        COLORS.secondary, COLORS.secondaryHover,
        COLORS.success, COLORS.successDark,
        COLORS.error, COLORS.errorDark,
        COLORS.warning, COLORS.warningDark,
        COLORS.background, COLORS.backgroundLight, 
        COLORS.backgroundLighter, COLORS.backgroundDark,
        COLORS.text, COLORS.textMuted, COLORS.textDark,
        COLORS.border, COLORS.borderLight
      ]
      
      simpleColors.forEach(color => {
        expect(color).toMatch(hexColorRegex)
      })
    })

    it('should use valid hex colors for activity colors', () => {
      const hexColorRegex = /^#[0-9a-f]{6}$/i
      
      Object.values(COLORS.activityColors).forEach(color => {
        expect(color).toMatch(hexColorRegex)
      })
    })

    it('should use valid rgba colors for alert backgrounds and borders', () => {
      const rgbaRegex = /^rgba\(\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*0\.\d+\)$/
      
      Object.values(COLORS.alertColors).forEach(alertColor => {
        expect(alertColor.bg).toMatch(rgbaRegex)
        expect(alertColor.border).toMatch(rgbaRegex)
      })
    })

    it('should use valid hex colors for alert text', () => {
      const hexColorRegex = /^#[0-9a-f]{6}$/i
      
      Object.values(COLORS.alertColors).forEach(alertColor => {
        expect(alertColor.text).toMatch(hexColorRegex)
      })
    })
  })

  describe('Color relationships', () => {
    it('should have darker hover states', () => {
      // Primary hover should be darker than primary
      expect(COLORS.primaryHover).not.toBe(COLORS.primary)
      expect(COLORS.primaryDark).not.toBe(COLORS.primaryHover)
      
      // Secondary hover should be darker than secondary
      expect(COLORS.secondaryHover).not.toBe(COLORS.secondary)
    })

    it('should have consistent alert opacity progression', () => {
      // Background should have lower opacity than border
      Object.values(COLORS.alertColors).forEach(alertColor => {
        const bgOpacity = parseFloat(alertColor.bg.match(/0\.\d+/)![0])
        const borderOpacity = parseFloat(alertColor.border.match(/0\.\d+/)![0])
        expect(bgOpacity).toBeLessThan(borderOpacity)
      })
    })
  })
})