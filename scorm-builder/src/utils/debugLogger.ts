declare global {
  interface Window {
    __TAURI__?: {
      invoke: (cmd: string, args?: any) => Promise<any>
    }
    debugLogger: DebugLogger
    __debugLogStateChange?: (category: string, state: any) => void
  }
}

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug' | 'perf' | 'action'
  category: string
  message: string
  data?: any
  stack?: string
  duration?: number
}

interface PerformanceMetrics {
  renderTime: number
  memoryUsage: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
  componentCount: number
  domNodes: number
}

class DebugLogger {
  private logs: LogEntry[] = []
  private isEnabled: boolean = false
  private maxLogs: number = 1000
  private logToFile: boolean = false
  private performanceObserver?: PerformanceObserver
  private renderTimes: Map<string, number> = new Map()
  private componentMountCount: number = 0
  private stateHistory: any[] = []
  private userActions: any[] = []
  private networkRequests: Map<string, any> = new Map()
  private performanceMonitoringEnabled: boolean = false
  private performanceIntervals: NodeJS.Timeout[] = []
  
  constructor() {
    // Check if debug mode is enabled
    this.isEnabled = localStorage.getItem('debugMode') === 'true' || 
                    new URLSearchParams(window.location.search).has('debug')
    
    // Performance monitoring is opt-in only
    this.performanceMonitoringEnabled = localStorage.getItem('performanceMonitoring') === 'true'
    
    if (this.isEnabled) {
      this.setupDebugMode()
    }
  }
  
  private setupDebugMode() {
    // Override console methods
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn
    
    console.log = (...args) => {
      originalLog(...args)
      this.log('info', 'console', args.join(' '), args)
    }
    
    console.error = (...args) => {
      originalError(...args)
      this.log('error', 'console', args.join(' '), args)
    }
    
    console.warn = (...args) => {
      originalWarn(...args)
      this.log('warn', 'console', args.join(' '), args)
    }
    
    // Intercept Tauri invoke calls
    if (window.__TAURI__) {
      const originalInvoke = window.__TAURI__.invoke
      window.__TAURI__.invoke = async (cmd: string, args?: any) => {
        const startTime = performance.now()
        this.log('debug', 'tauri-invoke', `Calling: ${cmd}`, args)
        
        try {
          const result = await originalInvoke(cmd, args)
          const duration = performance.now() - startTime
          this.log('debug', 'tauri-result', `${cmd} completed in ${duration.toFixed(2)}ms`, result)
          return result
        } catch (error) {
          const duration = performance.now() - startTime
          this.log('error', 'tauri-error', `${cmd} failed after ${duration.toFixed(2)}ms`, error)
          throw error
        }
      }
    }
    
    // Log uncaught errors
    window.addEventListener('error', (event) => {
      this.log('error', 'uncaught', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      })
    })
    
    // Log unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.log('error', 'unhandled-promise', 'Unhandled promise rejection', {
        reason: event.reason
      })
    })
    
    // Log navigation
    window.addEventListener('popstate', () => {
      this.log('info', 'navigation', `Navigation to: ${window.location.pathname}`)
    })
    
    // Add debug panel
    this.createDebugPanel()
    
    // Setup additional monitoring
    if (this.performanceMonitoringEnabled) {
      this.setupPerformanceMonitoring()
    }
    this.setupNetworkMonitoring()
    this.setupUserActionRecording()
    this.setupStateMonitoring()
  }
  
  private setupPerformanceMonitoring() {
    // Monitor React component performance
    if ((window as any).React && (window as any).React.Profiler) {
      const originalProfiler = (window as any).React.Profiler
      ;(window as any).React.Profiler = (props: any) => {
        const onRender = (id: string, phase: string, actualDuration: number) => {
          this.log('perf', 'react-render', `Component ${id} ${phase}`, {
            component: id,
            phase,
            duration: actualDuration
          })
        }
        return originalProfiler({ ...props, onRender })
      }
    }
    
    // Monitor memory usage
    const memoryInterval = setInterval(() => {
      if ((performance as any).memory) {
        const memory = (performance as any).memory
        this.log('perf', 'memory', 'Memory snapshot', {
          usedJSHeapSize: (memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
          totalJSHeapSize: (memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
          jsHeapSizeLimit: (memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
        })
      }
    }, 30000) // Every 30 seconds
    this.performanceIntervals.push(memoryInterval)
    
    // Monitor DOM size
    const domInterval = setInterval(() => {
      const nodeCount = document.getElementsByTagName('*').length
      this.log('perf', 'dom', `DOM nodes: ${nodeCount}`, { count: nodeCount })
    }, 10000) // Every 10 seconds
    this.performanceIntervals.push(domInterval)
    
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) { // Tasks longer than 50ms
              this.log('perf', 'long-task', `Long task detected: ${entry.duration.toFixed(2)}ms`, {
                duration: entry.duration,
                startTime: entry.startTime,
                name: entry.name
              })
            }
          }
        })
        this.performanceObserver.observe({ entryTypes: ['longtask'] })
      } catch (e) {
        console.warn('Long task monitoring not supported')
      }
    }
  }
  
  private setupNetworkMonitoring() {
    // Intercept fetch
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const requestId = Date.now() + Math.random()
      const startTime = performance.now()
      const [resource, config] = args
      
      this.log('debug', 'network-request', `Fetch: ${resource}`, {
        url: resource,
        method: config?.method || 'GET',
        headers: config?.headers,
        requestId
      })
      
      this.networkRequests.set(requestId.toString(), {
        url: resource,
        startTime,
        method: config?.method || 'GET'
      })
      
      try {
        const response = await originalFetch(...args)
        const duration = performance.now() - startTime
        
        this.log('debug', 'network-response', `Response: ${resource}`, {
          url: resource,
          status: response.status,
          duration: duration.toFixed(2) + 'ms',
          requestId
        })
        
        this.networkRequests.delete(requestId.toString())
        return response
      } catch (error) {
        const duration = performance.now() - startTime
        
        this.log('error', 'network-error', `Failed: ${resource}`, {
          url: resource,
          error: error,
          duration: duration.toFixed(2) + 'ms',
          requestId
        })
        
        this.networkRequests.delete(requestId.toString())
        throw error
      }
    }
    
    // Extend XMLHttpRequest with custom properties
    interface ExtendedXMLHttpRequest extends XMLHttpRequest {
      _requestURL?: string
      _requestMethod?: string
    }
    
    // Monitor XMLHttpRequest
    const XHR = XMLHttpRequest.prototype
    const originalOpen = XHR.open
    const originalSend = XHR.send
    
    XHR.open = function(this: ExtendedXMLHttpRequest, method: string, url: string, ...args: any[]) {
      this._requestURL = url
      this._requestMethod = method
      return originalOpen.apply(this, [method, url, ...args] as any)
    }
    
    XHR.send = function(this: ExtendedXMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
      const requestId = Date.now() + Math.random()
      const startTime = performance.now()
      
      if (window.debugLogger) {
        window.debugLogger.log('debug', 'network-xhr', `XHR: ${this._requestMethod} ${this._requestURL}`, {
          url: this._requestURL,
          method: this._requestMethod,
          requestId
        })
      }
      
      this.addEventListener('load', function(this: ExtendedXMLHttpRequest) {
        const duration = performance.now() - startTime
        if (window.debugLogger) {
          window.debugLogger.log('debug', 'network-xhr-response', `XHR Complete: ${this._requestURL}`, {
            url: this._requestURL,
            status: this.status,
            duration: duration.toFixed(2) + 'ms',
            requestId
          })
        }
      })
      
      this.addEventListener('error', function(this: ExtendedXMLHttpRequest) {
        const duration = performance.now() - startTime
        if (window.debugLogger) {
          window.debugLogger.log('error', 'network-xhr-error', `XHR Failed: ${this._requestURL}`, {
            url: this._requestURL,
            duration: duration.toFixed(2) + 'ms',
            requestId
          })
        }
      })
      
      return originalSend.apply(this, [body])
    }
  }
  
  private setupUserActionRecording() {
    // Record clicks
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const action = {
        type: 'click',
        timestamp: Date.now(),
        target: {
          tagName: target.tagName,
          id: target.id,
          className: target.className,
          text: target.textContent?.substring(0, 50),
          path: this.getElementPath(target)
        },
        coordinates: { x: e.clientX, y: e.clientY }
      }
      
      this.userActions.push(action)
      this.log('action', 'user-click', `Clicked: ${target.tagName}${target.id ? '#' + target.id : ''}`, action)
      
      // Keep only last 100 actions
      if (this.userActions.length > 100) {
        this.userActions.shift()
      }
    }, true)
    
    // Record input changes
    document.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        const action = {
          type: 'input',
          timestamp: Date.now(),
          target: {
            tagName: target.tagName,
            id: target.id,
            name: target.name,
            type: target.type,
            value: target.type === 'password' ? '[REDACTED]' : target.value.substring(0, 50)
          }
        }
        
        this.log('action', 'user-input', `Input: ${target.name || target.id || target.type}`, action)
      }
    }, true)
    
    // Record key presses (only special keys)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab' || e.ctrlKey || e.metaKey) {
        const action = {
          type: 'keydown',
          timestamp: Date.now(),
          key: e.key,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey
        }
        
        this.log('action', 'user-key', `Key: ${e.key}`, action)
      }
    }, true)
  }
  
  private setupStateMonitoring() {
    // Monitor localStorage changes
    const originalSetItem = localStorage.setItem
    localStorage.setItem = (key: string, value: string) => {
      this.log('debug', 'storage', `localStorage.setItem: ${key}`, {
        key,
        value: value.substring(0, 100),
        size: value.length
      })
      return originalSetItem.call(localStorage, key, value)
    }
    
    // Monitor React Context changes (if using our PersistentStorageContext)
    // This is injected when components use the context
    ;(window as any).__debugLogStateChange = (category: string, state: any) => {
      this.stateHistory.push({
        timestamp: Date.now(),
        category,
        state: this.sanitizeData(state)
      })
      
      // Keep only last 50 state changes
      if (this.stateHistory.length > 50) {
        this.stateHistory.shift()
      }
      
      this.log('debug', 'state-change', `State updated: ${category}`, state)
    }
  }
  
  private getElementPath(element: HTMLElement): string {
    const path = []
    let current = element
    
    while (current && current.tagName !== 'HTML') {
      let selector = current.tagName.toLowerCase()
      if (current.id) {
        selector += '#' + current.id
      } else if (current.className) {
        selector += '.' + current.className.split(' ').join('.')
      }
      path.unshift(selector)
      current = current.parentElement!
    }
    
    return path.join(' > ')
  }
  
  private log(level: LogEntry['level'], category: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: data ? this.sanitizeData(data) : undefined,
      stack: level === 'error' ? new Error().stack : undefined
    }
    
    // Enforce max logs limit before pushing new entry
    while (this.logs.length >= this.maxLogs) {
      this.logs.shift()
    }
    
    this.logs.push(entry)
    
    // Update debug panel
    this.updateDebugPanel(entry)
    
    // Send to file if enabled
    if (this.logToFile && window.__TAURI__) {
      this.writeToFile(entry)
    }
  }
  
  private sanitizeData(data: any): any {
    try {
      // Remove circular references and large objects
      return JSON.parse(JSON.stringify(data, (_key, value) => {
        if (value instanceof Blob) return `[Blob: ${value.size} bytes]`
        if (value instanceof File) return `[File: ${value.name}]`
        if (value && typeof value === 'object' && Object.keys(value).length > 100) {
          return '[Large Object]'
        }
        return value
      }))
    } catch {
      return String(data)
    }
  }
  
  private createDebugPanel() {
    const panel = document.createElement('div')
    panel.id = 'debug-panel'
    panel.innerHTML = `
      <div style="
        position: fixed;
        bottom: 0;
        right: 0;
        width: 400px;
        height: 300px;
        background: rgba(0, 0, 0, 0.9);
        color: #fff;
        font-family: monospace;
        font-size: 12px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        border: 1px solid #333;
      ">
        <div style="
          padding: 5px;
          background: #222;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <span>Debug Logger</span>
          <div>
            <button id="debug-clear" style="margin-right: 5px;">Clear</button>
            <button id="debug-export">Export</button>
            <button id="debug-close">X</button>
          </div>
        </div>
        <div id="debug-filters" style="
          padding: 5px;
          background: #333;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        ">
          <label><input type="checkbox" checked data-level="info"> Info</label>
          <label><input type="checkbox" checked data-level="warn"> Warn</label>
          <label><input type="checkbox" checked data-level="error"> Error</label>
          <label><input type="checkbox" checked data-level="debug"> Debug</label>
          <label><input type="checkbox" checked data-level="perf"> Perf</label>
          <label><input type="checkbox" checked data-level="action"> Actions</label>
        </div>
        <div id="debug-logs" style="
          flex: 1;
          overflow-y: auto;
          padding: 5px;
          background: #111;
        "></div>
      </div>
    `
    
    document.body.appendChild(panel)
    
    // Event handlers
    document.getElementById('debug-close')?.addEventListener('click', () => {
      panel.style.display = 'none'
      // Stop performance monitoring when panel is closed
      if (this.performanceMonitoringEnabled) {
        this.disablePerformanceMonitoring()
      }
    })
    
    document.getElementById('debug-clear')?.addEventListener('click', () => {
      this.logs = []
      const logsDiv = document.getElementById('debug-logs')
      if (logsDiv) logsDiv.innerHTML = ''
    })
    
    document.getElementById('debug-export')?.addEventListener('click', () => {
      this.exportLogs()
    })
    
    // Filter handlers
    document.querySelectorAll('#debug-filters input').forEach(input => {
      input.addEventListener('change', () => this.filterLogs())
    })
  }
  
  private updateDebugPanel(entry: LogEntry) {
    const logsDiv = document.getElementById('debug-logs')
    if (!logsDiv) return
    
    const logEl = document.createElement('div')
    logEl.className = `log-${entry.level}`
    logEl.style.cssText = `
      padding: 2px 5px;
      border-bottom: 1px solid #222;
      color: ${this.getLevelColor(entry.level)};
    `
    
    logEl.innerHTML = `
      <div>
        <span style="color: #666">${entry.timestamp.split('T')[1].split('.')[0]}</span>
        <span style="color: #888">[${entry.category}]</span>
        ${entry.message}
      </div>
      ${entry.data ? `<pre style="margin: 2px 0; color: #aaa">${JSON.stringify(entry.data, null, 2)}</pre>` : ''}
    `
    
    logsDiv.appendChild(logEl)
    logsDiv.scrollTop = logsDiv.scrollHeight
  }
  
  private getLevelColor(level: LogEntry['level']): string {
    switch (level) {
      case 'error': return '#ff6b6b'
      case 'warn': return '#ffd93d'
      case 'info': return '#4ecdc4'
      case 'debug': return '#95e1d3'
      case 'perf': return '#f39c12'
      case 'action': return '#a29bfe'
    }
  }
  
  private filterLogs() {
    const enabledLevels = Array.from(document.querySelectorAll('#debug-filters input:checked'))
      .map(input => (input as HTMLInputElement).dataset.level)
    
    document.querySelectorAll('#debug-logs > div').forEach((logEl, index) => {
      const log = this.logs[index]
      if (log && enabledLevels.includes(log.level)) {
        (logEl as HTMLElement).style.display = 'block'
      } else {
        (logEl as HTMLElement).style.display = 'none'
      }
    })
  }
  
  private async exportLogs() {
    const logData = {
      exportDate: new Date().toISOString(),
      logs: this.logs
    }
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `debug-logs-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  private async writeToFile(entry: LogEntry) {
    try {
      // Write to a log file using Tauri
      if (window.__TAURI__) {
        await window.__TAURI__.invoke('append_to_log', {
          content: JSON.stringify(entry) + '\n'
        })
      }
    } catch (error) {
      console.error('Failed to write log to file:', error)
    }
  }
  
  // Public methods
  enable() {
    localStorage.setItem('debugMode', 'true')
    window.location.reload()
  }
  
  disable() {
    localStorage.removeItem('debugMode')
    window.location.reload()
  }
  
  isDebugMode() {
    return this.isEnabled
  }
  
  // Performance monitoring control
  enablePerformanceMonitoring() {
    if (!this.performanceMonitoringEnabled) {
      this.performanceMonitoringEnabled = true
      localStorage.setItem('performanceMonitoring', 'true')
      if (this.isEnabled) {
        this.setupPerformanceMonitoring()
      }
    }
  }
  
  disablePerformanceMonitoring() {
    if (this.performanceMonitoringEnabled) {
      this.performanceMonitoringEnabled = false
      localStorage.removeItem('performanceMonitoring')
      this.teardownPerformanceMonitoring()
    }
  }
  
  private teardownPerformanceMonitoring() {
    // Clear all performance monitoring intervals
    this.performanceIntervals.forEach(interval => clearInterval(interval))
    this.performanceIntervals = []
    
    // Disconnect performance observer
    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
      this.performanceObserver = undefined
    }
    
    // Clear render times
    this.renderTimes.clear()
  }
  
  // Get monitoring data
  getPerformanceMetrics(): PerformanceMetrics {
    const memory = (performance as any).memory || {}
    return {
      renderTime: Array.from(this.renderTimes.values()).reduce((a, b) => a + b, 0) / this.renderTimes.size || 0,
      memoryUsage: {
        usedJSHeapSize: memory.usedJSHeapSize || 0,
        totalJSHeapSize: memory.totalJSHeapSize || 0,
        jsHeapSizeLimit: memory.jsHeapSizeLimit || 0
      },
      componentCount: this.componentMountCount,
      domNodes: document.getElementsByTagName('*').length
    }
  }
  
  getUserActions(): any[] {
    return [...this.userActions]
  }
  
  getStateHistory(): any[] {
    return [...this.stateHistory]
  }
  
  getActivenetworkRequests(): any[] {
    return Array.from(this.networkRequests.values())
  }
  
  // Create a bug report
  createBugReport(): any {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      performance: this.getPerformanceMetrics(),
      recentLogs: this.logs.slice(-100),
      recentActions: this.userActions.slice(-50),
      recentStateChanges: this.stateHistory.slice(-20),
      activeNetworkRequests: this.getActivenetworkRequests(),
      errorCount: this.logs.filter(l => l.level === 'error').length,
      localStorage: this.getLocalStorageSnapshot()
    }
    
    return report
  }
  
  private getLocalStorageSnapshot(): any {
    const snapshot: any = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key)
        if (value) {
          snapshot[key] = value.length > 100 ? `[${value.length} chars]` : value
        }
      }
    }
    return snapshot
  }
  
  // Replay user actions (for debugging)
  replayActions(actions?: any[]): void {
    const actionsToReplay = actions || this.userActions
    console.log('Replaying', actionsToReplay.length, 'actions...')
    
    actionsToReplay.forEach((action, index) => {
      setTimeout(() => {
        console.log(`Action ${index + 1}:`, action)
        // Could add visual indicators here
      }, index * 1000)
    })
  }
}

export const debugLogger = new DebugLogger()

// Add to window for easy access
if (typeof window !== 'undefined') {
  (window as any).debugLogger = debugLogger
}