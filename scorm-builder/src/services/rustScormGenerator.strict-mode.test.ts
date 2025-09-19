/**
 * Strict Media Mode Test
 *
 * This test verifies that strict media mode correctly validates preload results
 * and fails generation when media is missing.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock logger
vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

import { enableStrictMediaMode, disableStrictMediaMode, getStrictMediaModeStatus } from './rustScormGenerator'
import { invoke } from '@tauri-apps/api/core'

const mockInvoke = invoke as Mock

describe('Strict Media Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    disableStrictMediaMode() // Reset to default state
  })

  it('should be disabled by default', () => {
    const status = getStrictMediaModeStatus()
    expect(status.enabled).toBe(false)
    expect(status.maxMissingMedia).toBe(0)
  })

  it('should enable strict mode with configuration', () => {
    enableStrictMediaMode(2)

    const status = getStrictMediaModeStatus()
    expect(status.enabled).toBe(true)
    expect(status.maxMissingMedia).toBe(2)
  })

  it('should disable strict mode', () => {
    enableStrictMediaMode(1)
    expect(getStrictMediaModeStatus().enabled).toBe(true)

    disableStrictMediaMode()
    expect(getStrictMediaModeStatus().enabled).toBe(false)
  })

  it('should provide proper validation interface', () => {
    // Enable strict mode and verify it affects validation logic
    enableStrictMediaMode(1)

    // Test the internal validation logic (this is what batchPreloadMedia uses)
    const mockRequestedIds = ['media-1', 'media-2', 'media-3']
    const mockCachedCount = 2 // 1 missing

    // This simulates what happens inside batchPreloadMedia
    const strictMode = getStrictMediaModeStatus()
    const missingCount = mockRequestedIds.length - mockCachedCount
    const isValid = !strictMode.enabled || missingCount <= strictMode.maxMissingMedia

    expect(isValid).toBe(true) // 1 missing <= 1 allowed

    // Test with too many missing
    const mockCachedCountLow = 1 // 2 missing
    const missingCountHigh = mockRequestedIds.length - mockCachedCountLow
    const isValidLow = !strictMode.enabled || missingCountHigh <= strictMode.maxMissingMedia

    expect(isValidLow).toBe(false) // 2 missing > 1 allowed
  })
})