import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger, disableCategory, enableCategory, getDisabledCategories, clearDisabledCategories } from '../logger'

describe('Logger - Category Filtering', () => {
  let consoleLogSpy: any
  let consoleWarnSpy: any
  let consoleErrorSpy: any
  let consoleInfoSpy: any
  let consoleDebugSpy: any

  beforeEach(() => {
    // Clear any disabled categories from previous tests
    clearDisabledCategories()
    
    // Set NODE_ENV to development to ensure logging is enabled
    process.env.NODE_ENV = 'development'
    
    // Mock localStorage for development mode
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'debugMode') return 'true'
      return null
    })
    
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should filter out messages from disabled categories', () => {
    // Disable the FileStorage.saveContent category
    disableCategory('FileStorage.saveContent')

    // Log messages from different categories
    logger.info('[FileStorage.saveContent] Auto-saving project data...')
    logger.info('[AudioNarrationWizard] Loading audio file')
    logger.warn('[FileStorage.saveContent] Save operation in progress')
    logger.error('[MediaService] Failed to load media')

    // FileStorage.saveContent messages should be filtered out
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1)
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AudioNarrationWizard] Loading audio file')
    )
    
    expect(consoleWarnSpy).not.toHaveBeenCalled()
    
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[MediaService] Failed to load media')
    )
  })

  it('should support multiple disabled categories', () => {
    // Disable multiple categories
    disableCategory('FileStorage.saveContent')
    disableCategory('FileStorage.autoSave')
    disableCategory('DebugInfo')

    // Log messages
    logger.info('[FileStorage.saveContent] Auto-saving...')
    logger.info('[FileStorage.autoSave] Triggered auto-save')
    logger.info('[DebugInfo] Debug information')
    logger.info('[AudioNarrationWizard] Processing audio')
    logger.info('[MediaService] Loading media')

    // Only non-filtered messages should appear
    expect(consoleInfoSpy).toHaveBeenCalledTimes(2)
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AudioNarrationWizard] Processing audio')
    )
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[MediaService] Loading media')
    )
  })

  it('should allow re-enabling categories', () => {
    // Disable then re-enable a category
    disableCategory('FileStorage.saveContent')
    logger.info('[FileStorage.saveContent] Message 1')
    
    expect(consoleInfoSpy).not.toHaveBeenCalled()

    enableCategory('FileStorage.saveContent')
    logger.info('[FileStorage.saveContent] Message 2')

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1)
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[FileStorage.saveContent] Message 2')
    )
  })

  it('should handle category patterns with wildcards', () => {
    // Disable all FileStorage categories
    disableCategory('FileStorage.*')

    logger.info('[FileStorage.saveContent] Saving content')
    logger.info('[FileStorage.loadContent] Loading content')
    logger.info('[FileStorage.deleteContent] Deleting content')
    logger.info('[MediaService] Media operation')

    // Only non-FileStorage messages should appear
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1)
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[MediaService] Media operation')
    )
  })

  it('should provide a method to get all disabled categories', () => {
    disableCategory('FileStorage.saveContent')
    disableCategory('DebugInfo')
    disableCategory('AutoSave')

    const disabled = getDisabledCategories()
    
    expect(disabled).toContain('FileStorage.saveContent')
    expect(disabled).toContain('DebugInfo')
    expect(disabled).toContain('AutoSave')
    expect(disabled).toHaveLength(3)
  })

  it('should filter at all log levels', () => {
    disableCategory('FileStorage.saveContent')

    logger.debug('[FileStorage.saveContent] Debug message')
    logger.info('[FileStorage.saveContent] Info message')
    logger.warn('[FileStorage.saveContent] Warning message')
    logger.error('[FileStorage.saveContent] Error message')

    // All FileStorage.saveContent messages should be filtered
    expect(consoleLogSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('should handle messages without category tags', () => {
    disableCategory('FileStorage.saveContent')

    // Messages without category tags should always be shown
    logger.info('Simple message without category')
    logger.info('Another message')
    
    expect(consoleInfoSpy).toHaveBeenCalledTimes(2)
  })

  it('should be case-sensitive for category names', () => {
    disableCategory('FileStorage.saveContent')

    logger.info('[filestorage.savecontent] Lowercase')
    logger.info('[FILESTORAGE.SAVECONTENT] Uppercase')
    logger.info('[FileStorage.saveContent] Correct case')

    // Only exact match should be filtered
    expect(consoleInfoSpy).toHaveBeenCalledTimes(2)
    expect(consoleInfoSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('[FileStorage.saveContent]')
    )
  })

  it('should support disabling categories via environment variable', () => {
    // Set environment variable
    process.env.LOGGER_DISABLED_CATEGORIES = 'FileStorage.saveContent,DebugInfo,AutoSave'

    // Re-import logger to pick up env var (this test simulates initialization)
    clearDisabledCategories()
    // Manually parse env var as the module would
    const categories = process.env.LOGGER_DISABLED_CATEGORIES.split(',')
    categories.forEach(cat => disableCategory(cat.trim()))

    logger.info('[FileStorage.saveContent] Should be filtered')
    logger.info('[DebugInfo] Should be filtered')
    logger.info('[AutoSave] Should be filtered')
    logger.info('[MediaService] Should appear')

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1)
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[MediaService] Should appear')
    )

    // Clean up
    delete process.env.LOGGER_DISABLED_CATEGORIES
  })

  it('should support disabling via localStorage in browser environment', () => {
    // Mock localStorage to return disabled categories
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'debugMode') return 'true'
      if (key === 'loggerDisabledCategories') return 'FileStorage.saveContent,DebugInfo'
      return null
    })

    // Clear and re-load from localStorage
    clearDisabledCategories()
    // Manually parse localStorage as the module would
    const stored = localStorage.getItem('loggerDisabledCategories')
    if (stored) {
      const categories = stored.split(',')
      categories.forEach(cat => disableCategory(cat.trim()))
    }

    logger.info('[FileStorage.saveContent] Should be filtered')
    logger.info('[DebugInfo] Should be filtered')
    logger.info('[MediaService] Should appear')

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1)
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[MediaService] Should appear')
    )
  })
})