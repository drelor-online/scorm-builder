import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '../ultraSimpleLogger'

describe('UltraSimpleLogger Production Safety', () => {
  let originalConsole: any
  
  beforeEach(() => {
    // Save original console methods
    originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug
    }
  })
  
  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log
    console.warn = originalConsole.warn
    console.error = originalConsole.error
    console.info = originalConsole.info
    console.debug = originalConsole.debug
  })
  
  it('should not crash when console methods are undefined (production build)', () => {
    // Simulate production build where console methods are stripped
    // @ts-ignore - intentionally making these undefined
    console.log = undefined
    // @ts-ignore
    console.warn = undefined
    // @ts-ignore
    console.error = undefined
    // @ts-ignore
    console.info = undefined
    // @ts-ignore
    console.debug = undefined
    
    // These should not throw errors
    expect(() => logger.log('test')).not.toThrow()
    expect(() => logger.warn('test')).not.toThrow()
    expect(() => logger.error('test')).not.toThrow()
    expect(() => logger.info('test')).not.toThrow()
    expect(() => logger.debug('test')).not.toThrow()
  })
  
  it('should have fallback logging mechanism when console is stripped', () => {
    // Create a mock for our fallback mechanism
    const fallbackLogs: any[] = []
    
    // @ts-ignore
    window.__debugLogs = fallbackLogs
    
    // Strip console methods
    // @ts-ignore
    console.log = undefined
    // @ts-ignore
    console.error = undefined
    
    // Log something
    logger.error('Test error message')
    
    // Should have some way to capture logs even without console
    // This might be through window.__debugLogs or similar
    expect(fallbackLogs.length).toBeGreaterThan(0)
    expect(fallbackLogs[0]).toContain('Test error message')
  })
  
  it('should work with terser pure_funcs optimization', () => {
    // Terser will replace these with undefined in production
    const mockConsole = {
      log: undefined as any,
      warn: undefined as any,
      error: undefined as any,
      info: undefined as any,
      debug: undefined as any
    }
    
    // Replace global console
    // @ts-ignore
    global.console = mockConsole
    
    // Should not throw
    expect(() => {
      logger.log('test message')
      logger.error('error message')
      logger.warn('warning message')
    }).not.toThrow()
  })
})