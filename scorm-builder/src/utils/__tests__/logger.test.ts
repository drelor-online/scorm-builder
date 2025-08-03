import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '../logger'

describe('logger', () => {
  const originalEnv = process.env.NODE_ENV
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    debug: console.debug,
    info: console.info,
  }

  beforeEach(() => {
    // Mock console methods
    console.log = vi.fn()
    console.error = vi.fn()
    console.warn = vi.fn()
    console.debug = vi.fn()
    console.info = vi.fn()
    
    // Clear localStorage
    localStorage.clear()
  })

  afterEach(() => {
    // Restore console methods
    console.log = originalConsole.log
    console.error = originalConsole.error
    console.warn = originalConsole.warn
    console.debug = originalConsole.debug
    console.info = originalConsole.info
    
    // Restore environment
    process.env.NODE_ENV = originalEnv
  })

  describe('in development mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development'
      // Force re-evaluation of isDevelopment
      vi.resetModules()
    })

    it('should log messages in development', async () => {
      const { logger } = await import('../logger')
      logger.log('test message', { data: 'test' })
      expect(console.log).toHaveBeenCalledWith('test message', { data: 'test' })
    })

    it('should warn in development', async () => {
      const { logger } = await import('../logger')
      logger.warn('warning message')
      expect(console.warn).toHaveBeenCalledWith('warning message')
    })

    it('should debug in development', async () => {
      const { logger } = await import('../logger')
      logger.debug('debug message')
      expect(console.debug).toHaveBeenCalledWith('debug message')
    })

    it('should info in development', async () => {
      const { logger } = await import('../logger')
      logger.info('info message')
      expect(console.info).toHaveBeenCalledWith('info message')
    })
  })

  describe('in production mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
      vi.resetModules()
    })

    it('should not log messages in production', async () => {
      const { logger } = await import('../logger')
      logger.log('test message')
      expect(console.log).not.toHaveBeenCalled()
    })

    it('should always log errors', async () => {
      const { logger } = await import('../logger')
      logger.error('error message', new Error('test error'))
      expect(console.error).toHaveBeenCalledWith('error message', new Error('test error'))
    })

    it('should not warn in production', async () => {
      const { logger } = await import('../logger')
      logger.warn('warning message')
      expect(console.warn).not.toHaveBeenCalled()
    })
  })

  describe('with debug mode enabled', () => {
    it('should log when debugMode is enabled in localStorage', () => {
      // Since logger checks localStorage on each call, we can mock it
      localStorage.getItem = vi.fn(() => 'true')
      logger.log('debug enabled message')
      expect(console.log).toHaveBeenCalledWith('debug enabled message')
    })

    it('should warn when debugMode is enabled', () => {
      localStorage.getItem = vi.fn(() => 'true')
      logger.warn('debug warning')
      expect(console.warn).toHaveBeenCalledWith('debug warning')
    })
  })

  describe('with debug mode disabled', () => {
    it('should not log when debugMode is false', () => {
      process.env.NODE_ENV = 'production'
      localStorage.getItem = vi.fn(() => 'false')
      logger.log('should not appear')
      expect(console.log).not.toHaveBeenCalled()
    })
  })

  describe('multiple arguments', () => {
    it('should pass all arguments to console methods', async () => {
      process.env.NODE_ENV = 'development'
      vi.resetModules()
      const { logger } = await import('../logger')
      
      const obj = { key: 'value' }
      const arr = [1, 2, 3]
      
      logger.log('message', obj, arr, 123)
      expect(console.log).toHaveBeenCalledWith('message', obj, arr, 123)
      
      logger.error('error', obj, arr)
      expect(console.error).toHaveBeenCalledWith('error', obj, arr)
    })
  })
})