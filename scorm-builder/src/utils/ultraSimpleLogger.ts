/**
 * Ultra-simple logger that works everywhere
 * Writes to multiple places to ensure we get logs
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

class UltraSimpleLogger {
  private _logs: string[] = []
  private maxLogs = 1000
  private logLevel: LogLevel = 'INFO' // Default to INFO, hiding DEBUG
  private localStorageBatch: string[] = []
  private localStorageTimer: NodeJS.Timeout | null = null
  private readonly BATCH_SIZE = 50
  private readonly BATCH_DELAY = 10000 // 10 seconds
  
  constructor() {
    // Load existing logs from localStorage - but limit to last 100 entries
    try {
      const stored = localStorage.getItem('debug_logs')
      if (stored) {
        const allLogs = JSON.parse(stored)
        // Only keep the last 100 logs to avoid flooding on startup
        this._logs = allLogs.slice(-100)
      }
    } catch {
      // Ignore
    }
    
    // Try to write a startup message everywhere
    this.writeEverywhere('LOGGER', 'UltraSimpleLogger initialized')
    
    // Make it globally accessible for debugging
    if (typeof window !== 'undefined') {
      (window as any).debugLogs = this._logs;
      (window as any).dumpLogs = () => this.dumpLogs();
      (window as any).clearLogs = () => this.clearLogs();
    }
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR']
    const currentLevelIndex = levels.indexOf(this.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex >= currentLevelIndex
  }
  
  setLogLevel(level: LogLevel) {
    this.logLevel = level
    console.log(`Log level set to: ${level}`)
  }
  
  private flushLocalStorageBatch() {
    if (this.localStorageBatch.length === 0) return
    
    try {
      // Write all logs to localStorage at once
      localStorage.setItem('debug_logs', JSON.stringify(this._logs))
      localStorage.setItem('last_debug_log', this.localStorageBatch[this.localStorageBatch.length - 1])
      this.localStorageBatch = []
    } catch {
      // Ignore quota errors
      this.localStorageBatch = [] // Clear batch to prevent memory leak
    }
    
    // Clear timer
    if (this.localStorageTimer) {
      clearTimeout(this.localStorageTimer)
      this.localStorageTimer = null
    }
  }
  
  private scheduleLocalStorageWrite() {
    // Clear existing timer
    if (this.localStorageTimer) {
      clearTimeout(this.localStorageTimer)
    }
    
    // Schedule batch write
    this.localStorageTimer = setTimeout(() => {
      this.flushLocalStorageBatch()
    }, this.BATCH_DELAY)
    
    // If batch is full, flush immediately
    if (this.localStorageBatch.length >= this.BATCH_SIZE) {
      this.flushLocalStorageBatch()
    }
  }
  
  private writeEverywhere(category: string, message: string, data?: any, level: LogLevel = 'INFO') {
    // Skip if below current log level
    if (!this.shouldLog(level)) {
      return
    }
    const timestamp = new Date().toISOString()
    const logLine = `[${timestamp}] [${category}] ${message}${data ? ' ' + JSON.stringify(data) : ''}`
    
    // 1. Add to memory
    this._logs.push(logLine)
    if (this._logs.length > this.maxLogs) {
      this._logs.shift()
    }
    
    // 2. Add to window.__debugLogs for production debugging
    if (typeof window !== 'undefined') {
      if (!window.__debugLogs) {
        window.__debugLogs = []
      }
      window.__debugLogs.push(logLine)
      if (window.__debugLogs.length > this.maxLogs) {
        window.__debugLogs.shift()
      }
    }
    
    // 3. Add to localStorage batch (write later)
    this.localStorageBatch.push(logLine)
    this.scheduleLocalStorageWrite()
    
    // 4. Write to console (if available)
    if (typeof console !== 'undefined' && console.log) {
      console.log(`%c${logLine}`, 'color: green')
    }
    
    // 5. Try to write to Tauri file
    if (window.__TAURI__?.invoke) {
      window.__TAURI__.invoke('append_to_log', { 
        content: logLine + '\n' 
      }).catch(() => {
        // Silently fail - we already have other methods
      })
    }
  }
  
  info(category: string, message: string, data?: any) {
    this.writeEverywhere(category, message, data, 'INFO')
  }
  
  warn(category: string, message: string, data?: any) {
    this.writeEverywhere(category, `WARN: ${message}`, data, 'WARN')
  }
  
  error(category: string, message: string, data?: any) {
    this.writeEverywhere(category, `ERROR: ${message}`, data, 'ERROR')
  }
  
  debug(category: string, message: string, data?: any) {
    this.writeEverywhere(category, `DEBUG: ${message}`, data, 'DEBUG')
  }
  
  // Utility methods
  dumpLogs(): string {
    const logText = this._logs.join('\n')
    if (typeof console !== 'undefined' && console.log) {
      console.log('=== DEBUG LOGS ===')
      console.log(logText)
      console.log('==================')
    }
    
    // Try to copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(logText).then(() => {
        if (typeof console !== 'undefined' && console.log) {
          console.log('Logs copied to clipboard!')
        }
      })
    }
    
    return logText
  }
  
  clearLogs() {
    this._logs = []
    this.localStorageBatch = []
    
    // Clear timer
    if (this.localStorageTimer) {
      clearTimeout(this.localStorageTimer)
      this.localStorageTimer = null
    }
    
    // Clear all log arrays
    if (typeof window !== 'undefined') {
      if (window.debugLogs) {
        window.debugLogs.length = 0
      }
      if (window.__debugLogs) {
        window.__debugLogs.length = 0
      }
    }
    
    localStorage.removeItem('debug_logs')
    localStorage.removeItem('last_debug_log')
    
    if (typeof console !== 'undefined' && console.log) {
      console.log('Logs cleared')
    }
  }
  
  // Compatibility with existing code
  isDebugMode() {
    return false // Disabled by default in production
  }
  
  createBugReport() {
    return {
      timestamp: new Date().toISOString(),
      logs: this._logs,
      localStorage: this.getLocalStorageSnapshot()
    }
  }
  
  private getLocalStorageSnapshot() {
    const snapshot: any = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && !key.includes('debug')) {
        const value = localStorage.getItem(key)
        snapshot[key] = value?.substring(0, 100)
      }
    }
    return snapshot
  }
  
  async writeToFile(entry: any): Promise<void> {
    this.writeEverywhere('FILE', 'writeToFile called', entry)
  }

  // Getter for testing access to private logs array
  get logs(): string[] {
    return [...this._logs] // Return a copy to prevent external mutation
  }
}

// Create and export immediately
export const debugLogger = new UltraSimpleLogger()

// Export a logger-compatible interface for existing code
export const logger = {
  log: (...args: any[]) => debugLogger.info('LOG', args.join(' ')),
  error: (...args: any[]) => debugLogger.error('ERROR', args.join(' ')),
  warn: (...args: any[]) => debugLogger.warn('WARN', args.join(' ')),
  debug: (...args: any[]) => debugLogger.debug('DEBUG', args.join(' ')),
  info: (...args: any[]) => debugLogger.info('INFO', args.join(' '))
}

// Add startup test
debugLogger.info('STARTUP', 'Page loaded', {
  url: window.location.href,
  host: window.location.hostname,
  protocol: window.location.protocol,
  hasTauri: !!window.__TAURI__
})

declare global {
  interface Window {
    __TAURI__?: {
      invoke: (cmd: string, args?: any) => Promise<any>
    }
    debugLogger: UltraSimpleLogger
    dumpLogs: () => string
    clearLogs: () => void
    debugLogs: string[]
    setLogLevel: (level: LogLevel) => void
  }
}

if (typeof window !== 'undefined') {
  window.debugLogger = debugLogger
  // Add convenience method to change log level from console
  window.setLogLevel = (level: LogLevel) => debugLogger.setLogLevel(level)
}