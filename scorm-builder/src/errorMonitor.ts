export function setupErrorMonitoring() {
  // Global error handler for unhandled errors
  window.addEventListener('error', (event) => {
    console.error('Global error caught:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    })
  })

  // Global promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)
  })

  // Enhanced console logging
  const originalConsoleError = console.error
  console.error = (...args) => {
    originalConsoleError('🚨 [ERROR]', new Date().toISOString(), ...args)
  }

  const originalConsoleWarn = console.warn
  console.warn = (...args) => {
    originalConsoleWarn('⚠️ [WARN]', new Date().toISOString(), ...args)
  }

  console.log('🔍 Error monitoring initialized')
}

// Initialize immediately when module loads
setupErrorMonitoring()
