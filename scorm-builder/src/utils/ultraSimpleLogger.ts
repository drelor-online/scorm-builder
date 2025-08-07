/**
 * Ultra-simple logger that works everywhere
 * Writes to multiple places to ensure we get logs
 */

class UltraSimpleLogger {
  private logs: string[] = []
  private maxLogs = 1000
  
  constructor() {
    // Try to write a startup message everywhere
    this.writeEverywhere('LOGGER', 'UltraSimpleLogger initialized')
    
    // Load existing logs from localStorage
    try {
      const stored = localStorage.getItem('debug_logs')
      if (stored) {
        this.logs = JSON.parse(stored)
      }
    } catch (e) {
      // Ignore
    }
    
    // Make it globally accessible for debugging
    if (typeof window !== 'undefined') {
      (window as any).debugLogs = this.logs;
      (window as any).dumpLogs = () => this.dumpLogs();
      (window as any).clearLogs = () => this.clearLogs();
    }
  }
  
  private writeEverywhere(category: string, message: string, data?: any) {
    const timestamp = new Date().toISOString()
    const logLine = `[${timestamp}] [${category}] ${message}${data ? ' ' + JSON.stringify(data) : ''}`
    
    // 1. Add to memory
    this.logs.push(logLine)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
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
    
    // 3. Write to localStorage
    try {
      localStorage.setItem('debug_logs', JSON.stringify(this.logs))
      localStorage.setItem('last_debug_log', logLine)
    } catch (e) {
      // Ignore quota errors
    }
    
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
    this.writeEverywhere(category, message, data)
  }
  
  warn(category: string, message: string, data?: any) {
    this.writeEverywhere(category, `WARN: ${message}`, data)
  }
  
  error(category: string, message: string, data?: any) {
    this.writeEverywhere(category, `ERROR: ${message}`, data)
  }
  
  debug(category: string, message: string, data?: any) {
    this.writeEverywhere(category, `DEBUG: ${message}`, data)
  }
  
  // Utility methods
  dumpLogs(): string {
    const logText = this.logs.join('\n')
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
    this.logs = []
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
      logs: this.logs,
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
  }
}

if (typeof window !== 'undefined') {
  window.debugLogger = debugLogger
}