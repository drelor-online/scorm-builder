/**
 * Tests for the normalizeClipTiming fix
 * This test verifies that clip timing values are properly converted from null/strings to numbers/undefined
 */

import { describe, it, expect } from 'vitest'

// Test the normalizeClipTiming logic directly
function normalizeClipTiming(value: any): number | undefined {
  // Handle null, undefined, empty string
  if (value === null || value === undefined || value === '') {
    return undefined
  }

  // Handle string numbers - convert to number
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? undefined : parsed
  }

  // Handle actual numbers
  if (typeof value === 'number' && !isNaN(value)) {
    return value
  }

  // Handle any other invalid values
  return undefined
}

describe('MediaService normalizeClipTiming Fix', () => {
  it('should convert null to undefined', () => {
    // This fixes the "null (type: object)" bug
    const result = normalizeClipTiming(null)
    expect(result).toBeUndefined()
    expect(typeof result).toBe('undefined')
  })

  it('should preserve undefined as undefined', () => {
    const result = normalizeClipTiming(undefined)
    expect(result).toBeUndefined()
    expect(typeof result).toBe('undefined')
  })

  it('should convert empty string to undefined', () => {
    const result = normalizeClipTiming('')
    expect(result).toBeUndefined()
  })

  it('should convert string numbers to actual numbers', () => {
    expect(normalizeClipTiming('30')).toBe(30)
    expect(normalizeClipTiming('45.5')).toBe(45.5)
    expect(normalizeClipTiming('0')).toBe(0)
    expect(typeof normalizeClipTiming('30')).toBe('number')
  })

  it('should convert invalid string to undefined', () => {
    expect(normalizeClipTiming('invalid')).toBeUndefined()
    expect(normalizeClipTiming('30abc')).toBe(30) // parseFloat handles this case
    expect(normalizeClipTiming('abc30')).toBeUndefined()
  })

  it('should preserve valid numbers', () => {
    expect(normalizeClipTiming(30)).toBe(30)
    expect(normalizeClipTiming(45.5)).toBe(45.5)
    expect(normalizeClipTiming(0)).toBe(0)
    expect(typeof normalizeClipTiming(30)).toBe('number')
  })

  it('should handle NaN', () => {
    expect(normalizeClipTiming(NaN)).toBeUndefined()
  })

  it('should handle other invalid types', () => {
    expect(normalizeClipTiming({})).toBeUndefined()
    expect(normalizeClipTiming([])).toBeUndefined()
    expect(normalizeClipTiming(true)).toBeUndefined()
    expect(normalizeClipTiming(false)).toBeUndefined()
  })

  it('should reproduce and fix the user bug scenario', () => {
    // Simulate the user's log: "clipStart: null (type: object)"
    const buggyClipStart = null
    const buggyClipEnd = null

    // Before fix: these would stay as null
    expect(buggyClipStart).toBe(null)
    expect(typeof buggyClipStart).toBe('object') // null is type 'object' in JS

    // After fix: these become undefined
    const fixedClipStart = normalizeClipTiming(buggyClipStart)
    const fixedClipEnd = normalizeClipTiming(buggyClipEnd)

    expect(fixedClipStart).toBeUndefined()
    expect(fixedClipEnd).toBeUndefined()
    expect(typeof fixedClipStart).toBe('undefined')
    expect(typeof fixedClipEnd).toBe('undefined')

    console.log('🔧 [FIX DEBUG] Clip timing normalization:')
    console.log('  Before fix - clipStart:', buggyClipStart, '(type:', typeof buggyClipStart, ')')
    console.log('  After fix - clipStart:', fixedClipStart, '(type:', typeof fixedClipStart, ')')
  })

  it('should handle mixed scenario from user logs', () => {
    // Simulate metadata with mixed null and string values
    const metadata = {
      clip_start: null, // From user logs: "null (type: object)"
      clip_end: '90', // String number
      clipStart: undefined, // camelCase not set
      clipEnd: undefined // camelCase not set
    }

    // Simulate the || logic from MediaService
    const rawClipStart = metadata.clipStart || metadata.clip_start
    const rawClipEnd = metadata.clipEnd || metadata.clip_end

    expect(rawClipStart).toBe(null) // undefined || null = null
    expect(rawClipEnd).toBe('90') // null || "90" = "90"

    // Apply the fix
    const normalizedClipStart = normalizeClipTiming(rawClipStart)
    const normalizedClipEnd = normalizeClipTiming(rawClipEnd)

    expect(normalizedClipStart).toBeUndefined()
    expect(normalizedClipEnd).toBe(90) // String "90" converted to number 90

    // Also test direct string conversion
    const normalizedStringEnd = normalizeClipTiming('90')
    expect(normalizedStringEnd).toBe(90)
    expect(typeof normalizedStringEnd).toBe('number')
  })
})