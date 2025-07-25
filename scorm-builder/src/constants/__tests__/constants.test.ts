import { describe, it, expect } from 'vitest'
import { COLORS } from '../colors'
import { DURATIONS } from '../durations'
import { SPACING, BREAKPOINTS, Z_INDEX, ANIMATION } from '../spacing'
import * as constants from '../index'

describe('Constants', () => {
  describe('COLORS', () => {
    it('should have primary colors defined', () => {
      expect(COLORS.primary).toBe('#3b82f6')
      expect(COLORS.primaryHover).toBe('#2563eb')
      expect(COLORS.primaryDark).toBe('#1d4ed8')
    })

    it('should have semantic colors defined', () => {
      expect(COLORS.success).toBe('#10b981')
      expect(COLORS.successDark).toBe('#059669')
      expect(COLORS.error).toBe('#ef4444')
      expect(COLORS.errorDark).toBe('#dc2626')
      expect(COLORS.warning).toBe('#f59e0b')
      expect(COLORS.warningDark).toBe('#d97706')
    })

    it('should have background and text colors', () => {
      expect(COLORS.background).toBe('#18181b')
      expect(COLORS.backgroundLight).toBe('#27272a')
      expect(COLORS.backgroundLighter).toBe('#3f3f46')
      expect(COLORS.text).toBe('#e4e4e7')
      expect(COLORS.textMuted).toBe('#a1a1aa')
    })

    it('should have activity colors defined', () => {
      expect(COLORS.activityColors).toBeDefined()
      expect(COLORS.activityColors['multiple-choice']).toBe('#3b82f6')
      expect(COLORS.activityColors['true-false']).toBe('#8b5cf6')
      expect(COLORS.activityColors['fill-in-the-blank']).toBe('#10b981')
    })

    it('should have alert colors with rgba values', () => {
      expect(COLORS.alertColors.info.bg).toMatch(/^rgba/)
      expect(COLORS.alertColors.warning.bg).toMatch(/^rgba/)
      expect(COLORS.alertColors.success.bg).toMatch(/^rgba/)
      expect(COLORS.alertColors.error.bg).toMatch(/^rgba/)
    })
  })

  describe('DURATIONS', () => {
    it('should have animation durations defined', () => {
      expect(DURATIONS.fadeIn).toBe(300)
      expect(DURATIONS.fadeOut).toBe(200)
      expect(DURATIONS.slideIn).toBe(300)
    })

    it('should have special durations', () => {
      expect(DURATIONS.autosaveInterval).toBe(30000) // 30 seconds
      expect(DURATIONS.toastDuration).toBe(5000) // 5 seconds
      expect(DURATIONS.searchDebounce).toBe(500)
      expect(DURATIONS.inputDebounce).toBe(300)
    })

    it('should have timeout values', () => {
      expect(DURATIONS.apiTimeout).toBe(30000) // 30 seconds
      expect(DURATIONS.fileUploadTimeout).toBe(60000) // 60 seconds
      expect(DURATIONS.minimumLoadingTime).toBe(500)
    })
  })

  describe('SPACING', () => {
    it('should have base spacing values', () => {
      expect(SPACING.xs).toBe('0.25rem')
      expect(SPACING.sm).toBe('0.5rem')
      expect(SPACING.md).toBe('0.75rem')
      expect(SPACING.lg).toBe('1rem')
      expect(SPACING.xl).toBe('1.5rem')
      expect(SPACING['2xl']).toBe('2rem')
      expect(SPACING['3xl']).toBe('3rem')
      expect(SPACING['4xl']).toBe('4rem')
    })
  })

  describe('Additional spacing constants', () => {
    it('should export BREAKPOINTS', () => {
      expect(BREAKPOINTS).toBeDefined()
      expect(BREAKPOINTS.sm).toBe('640px')
      expect(BREAKPOINTS.md).toBe('768px')
      expect(BREAKPOINTS.lg).toBe('1024px')
    })

    it('should export Z_INDEX', () => {
      expect(Z_INDEX).toBeDefined()
      expect(Z_INDEX.modal).toBe(50)
      expect(Z_INDEX.toast).toBe(1000)
    })

    it('should export ANIMATION timings', () => {
      expect(ANIMATION).toBeDefined()
      expect(ANIMATION.fast).toBe('150ms')
      expect(ANIMATION.normal).toBe('200ms')
      expect(ANIMATION.slow).toBe('300ms')
    })
  })

  describe('Index exports', () => {
    it('should re-export all constants', () => {
      expect(constants.COLORS).toBe(COLORS)
      expect(constants.SPACING).toBe(SPACING)
      expect(constants.DURATIONS).toBe(DURATIONS)
    })
  })
})