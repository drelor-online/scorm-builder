import { describe, it, expect, vi } from 'vitest'
import { fixNavigationDuplicates } from '../fixNavigationDuplicates'

// Mock console.error
vi.spyOn(console, 'error').mockImplementation(() => {})

describe('fixNavigationDuplicates', () => {
  it('should throw error indicating deprecation', () => {
    expect(() => fixNavigationDuplicates()).toThrow(
      'The TypeScript SCORM generator has been removed. Use the Rust implementation.'
    )
  })
  
  it('should log deprecation warning to console.error', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error')
    
    try {
      fixNavigationDuplicates()
    } catch {
      // Expected to throw
    }
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'This script is deprecated - spaceEfficientScormGeneratorNavigation.ts has been removed'
    )
  })
})