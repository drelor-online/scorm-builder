import { describe, it, expect, vi, beforeEach, afterEach, SpyInstance } from 'vitest'

describe('Error Monitor', () => {
  let consoleErrorSpy: SpyInstance
  let consoleWarnSpy: SpyInstance
  let consoleLogSpy: SpyInstance
  let errorEventListener: ((event: ErrorEvent) => void) | null = null
  let unhandledRejectionListener: ((event: Event) => void) | null = null
  let addEventListenerSpy: SpyInstance

  beforeEach(() => {
    // Mock console methods
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Mock window.addEventListener
    addEventListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'error') {
        errorEventListener = handler as (event: ErrorEvent) => void
      } else if (event === 'unhandledrejection') {
        unhandledRejectionListener = handler as (event: Event) => void
      }
    })

    // Clear the module cache to ensure fresh import
    vi.resetModules()
  })

  afterEach(() => {
    // Clear listeners
    errorEventListener = null
    unhandledRejectionListener = null

    // Restore all mocks
    vi.restoreAllMocks()
  })

  it('should initialize error monitoring and log initialization message', async () => {
    // Import the module to trigger initialization
    await import('../errorMonitor')

    // Check that initialization message was logged
    expect(consoleLogSpy).toHaveBeenCalledWith('🔍 Error monitoring initialized')
  })

  it('should register global error handler', async () => {
    await import('../errorMonitor')

    expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function))
  })

  it('should register unhandled rejection handler', async () => {
    await import('../errorMonitor')

    expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function))
  })

  it('should handle global errors and log them with details', async () => {
    await import('../errorMonitor')

    // Reset the mock to clear initialization calls
    consoleErrorSpy.mockClear()

    // Create a mock error event
    const mockError = new Error('Test error')
    const mockErrorEvent = new ErrorEvent('error', {
      message: 'Test error message',
      filename: 'test.js',
      lineno: 123,
      colno: 456,
      error: mockError
    })

    // Trigger the error handler
    if (errorEventListener) {
      errorEventListener(mockErrorEvent)
    }

    // The error handler should call the original console.error (which is now our enhanced version)
    // We need to check what the enhanced console.error does
    expect(consoleErrorSpy).toHaveBeenCalled()
    
    // Check that it was called with the expected structure
    const calls = consoleErrorSpy.mock.calls
    const lastCall = calls[calls.length - 1]
    
    // The enhanced console.error adds timestamp and emoji prefix
    expect(lastCall[0]).toBe('🚨 [ERROR]')
    expect(lastCall[1]).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) // ISO timestamp
    expect(lastCall[2]).toBe('Global error caught:')
    expect(lastCall[3]).toEqual({
      message: 'Test error message',
      filename: 'test.js',
      lineno: 123,
      colno: 456,
      error: mockError
    })
  })

  it('should handle unhandled promise rejections', async () => {
    await import('../errorMonitor')

    // Reset the mock to clear initialization calls
    consoleErrorSpy.mockClear()

    // Create a mock rejection event
    const mockReason = new Error('Promise rejection')
    
    // Create a custom event since PromiseRejectionEvent is not available in test environment
    const mockRejectionEvent = new Event('unhandledrejection') as any
    mockRejectionEvent.reason = mockReason

    // Trigger the rejection handler
    if (unhandledRejectionListener) {
      unhandledRejectionListener(mockRejectionEvent)
    }

    // Check that console.error was called
    expect(consoleErrorSpy).toHaveBeenCalled()
    
    const calls = consoleErrorSpy.mock.calls
    const lastCall = calls[calls.length - 1]
    
    expect(lastCall[0]).toBe('🚨 [ERROR]')
    expect(lastCall[1]).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) // ISO timestamp
    expect(lastCall[2]).toBe('Unhandled promise rejection:')
    expect(lastCall[3]).toBe(mockReason)
  })

  it('should enhance console.error with timestamp and emoji', async () => {
    // Import the module first
    await import('../errorMonitor')

    // Get a reference to the enhanced console.error
    const enhancedError = console.error

    // Clear previous calls
    consoleErrorSpy.mockClear()

    // Call the enhanced error directly
    enhancedError('Test error message', { detail: 'error detail' })

    // Verify the spy was called with enhanced format
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '🚨 [ERROR]',
      expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      'Test error message',
      { detail: 'error detail' }
    )
  })

  it('should enhance console.warn with timestamp and emoji', async () => {
    // Import the module first
    await import('../errorMonitor')

    // Get a reference to the enhanced console.warn
    const enhancedWarn = console.warn

    // Clear previous calls
    consoleWarnSpy.mockClear()

    // Call the enhanced warn directly
    enhancedWarn('Test warning message')

    // Verify the spy was called with enhanced format
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '⚠️ [WARN]',
      expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      'Test warning message'
    )
  })

  it('should preserve multiple arguments in enhanced console methods', async () => {
    await import('../errorMonitor')

    // Clear previous calls
    consoleErrorSpy.mockClear()
    consoleWarnSpy.mockClear()

    // Call with multiple arguments
    console.error('Error:', 'arg1', 'arg2', { key: 'value' })
    console.warn('Warning:', 123, true, ['array'])

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '🚨 [ERROR]',
      expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      'Error:',
      'arg1',
      'arg2',
      { key: 'value' }
    )

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '⚠️ [WARN]',
      expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      'Warning:',
      123,
      true,
      ['array']
    )
  })
})