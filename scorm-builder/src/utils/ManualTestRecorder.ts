// @ts-nocheck
import html2canvas from 'html2canvas'

interface UserAction {
  id: string
  timestamp: number
  type: 'click' | 'input' | 'change' | 'navigation' | 'scroll' | 'focus' | 'blur' | 'screenshot' | 'note' | 'error'
  target?: {
    tagName: string
    id?: string
    className?: string
    testId?: string
    text?: string
    value?: any
    xpath?: string
  }
  data?: any
  screenshot?: string
  duration?: number
  pageTitle?: string
  url?: string
}

interface Screenshot {
  id: string
  timestamp: number
  dataUrl: string
  trigger: 'auto' | 'manual' | 'error'
  description: string
  pageTitle: string
  url: string
  linkedActionId?: string
}

interface RecordingOptions {
  autoScreenshot: boolean
  capturePerformance: boolean
  recordMouseMovements?: boolean
  annotationsEnabled: boolean
  screenshotQuality?: number
  maxScreenshots?: number
  allowProgrammaticStart?: boolean // Allow recording to start without user interaction
}

interface PerformanceMetric {
  timestamp: number
  metric: string
  value: number
  unit: string
}

interface Note {
  id: string
  timestamp: number
  content: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  tags: string[]
  associatedActionId?: string
}

interface ErrorRecord {
  timestamp: number
  message: string
  filename?: string
  lineno?: number
  colno?: number
  stack?: string
  screenshotId?: string
}

interface ConsoleLog {
  timestamp: number
  level: 'log' | 'warn' | 'error' | 'info' | 'debug'
  message: string
  args: any[]
  stack?: string
}

export interface TestSessionData {
  metadata: {
    sessionId: string
    startTime: number
    endTime: number
    duration: number
    url: string
    userAgent: string
  }
  actions: UserAction[]
  screenshots: {
    id: string
    timestamp: number
    trigger: string
    description: string
    filename: string
    pageTitle: string
    url: string
    linkedActionId?: string
  }[]
  notes: Note[]
  errors: ErrorRecord[]
  consoleLogs: ConsoleLog[]
  performance: PerformanceMetric[]
  summary: {
    totalActions: number
    actionsByType: Record<string, number>
    errorCount: number
    noteCount: number
    screenshotCount: number
    consoleLogCount: number
  }
}

export class ManualTestRecorder {
  private actions: UserAction[] = []
  private screenshots: Screenshot[] = []
  private notes: Note[] = []
  private errors: ErrorRecord[] = []
  private consoleLogs: ConsoleLog[] = []
  private performanceMetrics: PerformanceMetric[] = []
  private startTime: number = 0
  private endTime: number = 0
  private isRecording: boolean = false
  private options: RecordingOptions
  private lastActionTime: number = 0
  private currentPageStartTime: number = 0
  private overlay: HTMLDivElement | null = null
  private actionCounter: number = 0
  private screenshotCounter: number = 0
  private noteCounter: number = 0
  private observer: MutationObserver | null = null
  private sessionId: string = ''
  private originalConsole: {
    log: typeof console.log
    warn: typeof console.warn
    error: typeof console.error
    info: typeof console.info
    debug: typeof console.debug
  } | null = null
  
  constructor(options: Partial<RecordingOptions> = {}) {
    this.options = {
      autoScreenshot: true,
      capturePerformance: true,
      recordMouseMovements: false,
      annotationsEnabled: true,
      screenshotQuality: 0.8,
      maxScreenshots: 100,
      ...options
    }
  }
  
  async start(): Promise<void> {
    if (this.isRecording) {
      console.warn('Recording already in progress')
      return
    }
    
    this.isRecording = true
    this.startTime = Date.now()
    this.sessionId = `session-${this.startTime}`
    this.lastActionTime = this.startTime
    this.currentPageStartTime = this.startTime
    this.actions = []
    this.screenshots = []
    this.notes = []
    this.errors = []
    this.consoleLogs = []
    this.performanceMetrics = []
    this.actionCounter = 0
    this.screenshotCounter = 0
    this.noteCounter = 0
    
    // Intercept console methods to capture logs
    this.interceptConsole()
    
    console.log('🎬 Manual test recording started')
    
    // Create recording overlay
    this.createOverlay()
    
    // Attach event listeners
    this.attachEventListeners()
    
    // Start performance monitoring
    if (this.options.capturePerformance) {
      this.startPerformanceMonitoring()
    }
    
    // Start mutation observer for dynamic content
    this.startMutationObserver()
    
    // Take initial screenshot
    await this.captureScreenshot('auto', 'Recording started')
    
    // Record start action
    this.recordAction({
      type: 'navigation',
      data: { message: 'Recording session started' }
    })
  }
  
  stop(): void {
    if (!this.isRecording) {
      console.warn('No recording in progress')
      return
    }
    
    this.isRecording = false
    this.endTime = Date.now()
    
    // Restore original console methods
    this.restoreConsole()
    
    // Remove event listeners
    this.detachEventListeners()
    
    // Stop observers
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    
    // Remove overlay
    if (this.overlay) {
      this.overlay.remove()
      this.overlay = null
    }
    
    // Record end action
    this.recordAction({
      type: 'navigation',
      data: { message: 'Recording session ended' }
    })
    
    console.log('🎬 Recording stopped')
    console.log(`📊 Recorded ${this.actions.length} actions and ${this.screenshots.length} screenshots`)
    
    // Generate and download report
    this.generateReport()
  }
  
  private createOverlay(): void {
    this.overlay = document.createElement('div')
    this.overlay.id = 'manual-test-recorder-overlay'
    this.overlay.innerHTML = `
      <div style="
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(239, 68, 68, 0.9);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 999999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        cursor: move;
        user-select: none;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        "></div>
        <span>Recording...</span>
        <span id="recorder-timer" style="font-weight: bold;">00:00</span>
        <span style="opacity: 0.7; font-size: 12px;">|</span>
        <span style="opacity: 0.7; font-size: 12px;">${this.actions.length} actions</span>
        <button id="recorder-screenshot" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        " title="Take Screenshot (Ctrl+Shift+S)">📸</button>
        <button id="recorder-note" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        " title="Add Note (Ctrl+Shift+N)">📝</button>
        <button id="recorder-stop" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">Stop</button>
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      </style>
    `
    
    document.body.appendChild(this.overlay)
    
    // Make overlay draggable
    this.makeOverlayDraggable()
    
    // Update timer
    this.updateTimer()
    
    // Attach overlay controls
    document.getElementById('recorder-screenshot')?.addEventListener('click', () => {
      this.captureScreenshot('manual', 'User-triggered screenshot')
    })
    
    document.getElementById('recorder-note')?.addEventListener('click', () => {
      this.addNote()
    })
    
    document.getElementById('recorder-stop')?.addEventListener('click', () => {
      this.stop()
    })
  }
  
  private makeOverlayDraggable(): void {
    if (!this.overlay) return
    
    const overlay = this.overlay.firstElementChild as HTMLElement
    let isDragging = false
    let startX: number, startY: number
    let initialX: number, initialY: number
    
    overlay.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return
      isDragging = true
      startX = e.clientX
      startY = e.clientY
      const rect = overlay.getBoundingClientRect()
      initialX = rect.left
      initialY = rect.top
      overlay.style.cursor = 'grabbing'
    })
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return
      const deltaX = e.clientX - startX
      const deltaY = e.clientY - startY
      overlay.style.right = 'auto'
      overlay.style.left = `${initialX + deltaX}px`
      overlay.style.top = `${initialY + deltaY}px`
    })
    
    document.addEventListener('mouseup', () => {
      isDragging = false
      overlay.style.cursor = 'move'
    })
  }
  
  private updateTimer(): void {
    if (!this.isRecording) return
    
    const elapsed = Date.now() - this.startTime
    const minutes = Math.floor(elapsed / 60000)
    const seconds = Math.floor((elapsed % 60000) / 1000)
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    
    const timerEl = document.getElementById('recorder-timer')
    if (timerEl) {
      timerEl.textContent = timeStr
    }
    
    // Update action count
    const overlay = this.overlay?.firstElementChild as HTMLElement
    if (overlay) {
      const spans = overlay.querySelectorAll('span')
      if (spans[3]) {
        spans[3].textContent = `${this.actions.length} actions`
      }
    }
    
    setTimeout(() => this.updateTimer(), 1000)
  }
  
  private attachEventListeners(): void {
    // Click events
    document.addEventListener('click', this.handleClick, true)
    
    // Input events
    document.addEventListener('input', this.handleInput, true)
    document.addEventListener('change', this.handleChange, true)
    
    // Focus events
    document.addEventListener('focus', this.handleFocus, true)
    document.addEventListener('blur', this.handleBlur, true)
    
    // Navigation events
    window.addEventListener('popstate', this.handleNavigation)
    
    // Scroll events (throttled)
    let scrollTimeout: NodeJS.Timeout
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => this.handleScroll(), 500)
    }, true)
    
    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyboard)
    
    // Error events
    window.addEventListener('error', this.handleError)
    window.addEventListener('unhandledrejection', this.handleRejection)
  }
  
  private detachEventListeners(): void {
    document.removeEventListener('click', this.handleClick, true)
    document.removeEventListener('input', this.handleInput, true)
    document.removeEventListener('change', this.handleChange, true)
    document.removeEventListener('focus', this.handleFocus, true)
    document.removeEventListener('blur', this.handleBlur, true)
    window.removeEventListener('popstate', this.handleNavigation)
    document.removeEventListener('scroll', this.handleScroll, true)
    document.removeEventListener('keydown', this.handleKeyboard)
    window.removeEventListener('error', this.handleError)
    window.removeEventListener('unhandledrejection', this.handleRejection)
  }
  
  private handleClick = async (e: MouseEvent): Promise<void> => {
    const target = e.target as HTMLElement
    
    // Skip if clicking on overlay
    if (target.closest('#manual-test-recorder-overlay')) return
    
    const action = this.recordAction({
      type: 'click',
      target: this.extractTargetInfo(target),
      data: {
        x: e.clientX,
        y: e.clientY,
        button: e.button
      }
    })
    
    // Auto-screenshot after clicks on important elements
    if (this.options.autoScreenshot && this.shouldAutoScreenshot(target)) {
      setTimeout(() => {
        this.captureScreenshot('auto', `After clicking: ${this.getElementDescription(target)}`, action.id)
      }, 500)
    }
  }
  
  private handleInput = (e: Event): void => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement
    
    this.recordAction({
      type: 'input',
      target: this.extractTargetInfo(target),
      data: {
        value: target.value,
        inputType: target.type || 'text'
      }
    })
  }
  
  private handleChange = (e: Event): void => {
    const target = e.target as HTMLInputElement | HTMLSelectElement
    
    this.recordAction({
      type: 'change',
      target: this.extractTargetInfo(target),
      data: {
        value: target.value,
        checked: (target as HTMLInputElement).checked
      }
    })
  }
  
  private handleFocus = (e: FocusEvent): void => {
    const target = e.target as HTMLElement
    
    // Only record focus on interactive elements
    if (this.isInteractiveElement(target)) {
      this.recordAction({
        type: 'focus',
        target: this.extractTargetInfo(target)
      })
    }
  }
  
  private handleBlur = (e: FocusEvent): void => {
    const target = e.target as HTMLElement
    
    // Only record blur on interactive elements
    if (this.isInteractiveElement(target)) {
      this.recordAction({
        type: 'blur',
        target: this.extractTargetInfo(target)
      })
    }
  }
  
  private handleScroll = (): void => {
    this.recordAction({
      type: 'scroll',
      data: {
        scrollX: window.scrollX,
        scrollY: window.scrollY
      }
    })
  }
  
  private handleNavigation = (): void => {
    this.recordAction({
      type: 'navigation',
      data: {
        url: window.location.href,
        title: document.title
      }
    })
    
    // Screenshot after navigation
    if (this.options.autoScreenshot) {
      setTimeout(() => {
        this.captureScreenshot('auto', `Navigated to: ${document.title}`)
      }, 1000)
    }
  }
  
  private handleKeyboard = (e: KeyboardEvent): void => {
    // Manual screenshot: Ctrl+Shift+S
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      e.preventDefault()
      this.captureScreenshot('manual', 'User-triggered screenshot')
    }
    
    // Add note: Ctrl+Shift+N
    if (e.ctrlKey && e.shiftKey && e.key === 'N') {
      e.preventDefault()
      this.addNote()
    }
    
    // Mark important: Ctrl+Shift+M
    if (e.ctrlKey && e.shiftKey && e.key === 'M') {
      e.preventDefault()
      this.markImportant()
    }
    
    // Stop recording: Ctrl+Shift+E
    if (e.ctrlKey && e.shiftKey && e.key === 'E') {
      e.preventDefault()
      this.stop()
    }
  }
  
  private handleError = async (e: ErrorEvent): Promise<void> => {
    const error: ErrorRecord = {
      timestamp: Date.now(),
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack
    }
    
    this.errors.push(error)
    
    this.recordAction({
      type: 'error',
      data: {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        stack: e.error?.stack
      }
    })
    
    // Screenshot on error
    const screenshot = await this.captureScreenshot('error', `Error: ${e.message}`)
    if (screenshot) {
      error.screenshotId = screenshot.id
    }
  }
  
  private handleRejection = (e: PromiseRejectionEvent): void => {
    this.recordAction({
      type: 'error',
      data: {
        message: 'Unhandled Promise Rejection',
        reason: e.reason
      }
    })
  }
  
  private interceptConsole(): void {
    // Store original console methods
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug
    }
    
    // Replace console methods with interceptors
    console.log = (...args: any[]) => {
      this.captureConsoleLog('log', args)
      this.originalConsole!.log(...args)
    }
    
    console.warn = (...args: any[]) => {
      this.captureConsoleLog('warn', args)
      this.originalConsole!.warn(...args)
    }
    
    console.error = (...args: any[]) => {
      this.captureConsoleLog('error', args)
      this.originalConsole!.error(...args)
    }
    
    console.info = (...args: any[]) => {
      this.captureConsoleLog('info', args)
      this.originalConsole!.info(...args)
    }
    
    console.debug = (...args: any[]) => {
      this.captureConsoleLog('debug', args)
      this.originalConsole!.debug(...args)
    }
  }
  
  private restoreConsole(): void {
    if (this.originalConsole) {
      console.log = this.originalConsole.log
      console.warn = this.originalConsole.warn
      console.error = this.originalConsole.error
      console.info = this.originalConsole.info
      console.debug = this.originalConsole.debug
      this.originalConsole = null
    }
  }
  
  private captureConsoleLog(level: 'log' | 'warn' | 'error' | 'info' | 'debug', args: any[]): void {
    if (!this.isRecording) return
    
    // Sanitize args to remove circular references and DOM elements
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          // Try to stringify to check for circular references
          JSON.stringify(arg)
          return arg // It's safe
        } catch {
          // Has circular reference or is too complex
          // Return a safe representation
          if (arg instanceof HTMLElement) {
            return {
              type: 'HTMLElement',
              tagName: arg.tagName,
              id: arg.id || undefined,
              className: arg.className || undefined,
              textContent: arg.textContent?.substring(0, 100) || undefined
            }
          }
          if (arg instanceof Node) {
            return {
              type: 'DOMNode',
              nodeType: arg.nodeType,
              nodeName: arg.nodeName
            }
          }
          if (arg.constructor) {
            return {
              type: arg.constructor.name,
              toString: String(arg)
            }
          }
          return { type: 'CircularObject', toString: String(arg) }
        }
      }
      return arg
    })
    
    const consoleLog: ConsoleLog = {
      timestamp: Date.now(),
      level,
      message: args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2)
          } catch {
            return String(arg)
          }
        }
        return String(arg)
      }).join(' '),
      args: sanitizedArgs, // Use sanitized args
      stack: level === 'error' ? new Error().stack : undefined
    }
    
    this.consoleLogs.push(consoleLog)
  }
  
  private startMutationObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Detect modal opens
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              if (node.classList.contains('modal') || node.getAttribute('role') === 'dialog') {
                this.captureScreenshot('auto', 'Modal opened')
              }
            }
          })
        }
      }
    })
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    })
  }
  
  private startPerformanceMonitoring(): void {
    // Monitor memory usage
    if ((performance as any).memory) {
      setInterval(() => {
        const memory = (performance as any).memory
        this.performanceMetrics.push({
          timestamp: Date.now(),
          metric: 'memory',
          value: memory.usedJSHeapSize,
          unit: 'bytes'
        })
      }, 5000)
    }
    
    // Monitor FPS
    let lastTime = performance.now()
    let frames = 0
    
    const measureFPS = () => {
      if (!this.isRecording) return
      
      frames++
      const currentTime = performance.now()
      
      if (currentTime >= lastTime + 1000) {
        this.performanceMetrics.push({
          timestamp: Date.now(),
          metric: 'fps',
          value: Math.round(frames * 1000 / (currentTime - lastTime)),
          unit: 'fps'
        })
        frames = 0
        lastTime = currentTime
      }
      
      requestAnimationFrame(measureFPS)
    }
    
    requestAnimationFrame(measureFPS)
  }
  
  private recordAction(action: Partial<UserAction>): UserAction {
    const fullAction: UserAction = {
      id: `action-${++this.actionCounter}`,
      timestamp: Date.now(),
      duration: Date.now() - this.lastActionTime,
      pageTitle: document.title,
      url: window.location.href,
      ...action
    } as UserAction
    
    this.actions.push(fullAction)
    this.lastActionTime = Date.now()
    
    console.log(`📝 Recorded ${fullAction.type}:`, fullAction)
    
    return fullAction
  }
  
  async captureScreenshot(trigger: 'auto' | 'manual' | 'error', description: string, linkedActionId?: string): Promise<Screenshot | null> {
    if (!this.isRecording) return null
    
    // Check screenshot limit
    if (this.options.maxScreenshots && this.screenshots.length >= this.options.maxScreenshots) {
      console.warn('Screenshot limit reached')
      return null
    }
    
    try {
      // Hide overlay temporarily
      if (this.overlay) {
        this.overlay.style.display = 'none'
      }
      
      // Capture screenshot
      const canvas = await html2canvas(document.body, {
        scale: this.options.screenshotQuality,
        logging: false,
        useCORS: true,
        allowTaint: true
      })
      
      const dataUrl = canvas.toDataURL('image/jpeg', this.options.screenshotQuality)
      
      const screenshot: Screenshot = {
        id: `screenshot-${++this.screenshotCounter}`,
        timestamp: Date.now(),
        dataUrl,
        trigger,
        description,
        pageTitle: document.title,
        url: window.location.href,
        linkedActionId
      }
      
      this.screenshots.push(screenshot)
      
      console.log(`📸 Screenshot captured: ${description}`)
      
      // Show overlay again
      if (this.overlay) {
        this.overlay.style.display = 'block'
      }
      
      // Visual feedback
      this.showScreenshotFeedback()
      
      return screenshot
      
    } catch (error) {
      console.error('Failed to capture screenshot:', error)
      return null
    }
  }
  
  private showScreenshotFeedback(): void {
    const flash = document.createElement('div')
    flash.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: white;
      opacity: 0.3;
      z-index: 999998;
      pointer-events: none;
      animation: flash 0.3s ease-out;
    `
    
    const style = document.createElement('style')
    style.textContent = `
      @keyframes flash {
        from { opacity: 0.3; }
        to { opacity: 0; }
      }
    `
    
    document.head.appendChild(style)
    document.body.appendChild(flash)
    
    setTimeout(() => {
      flash.remove()
      style.remove()
    }, 300)
  }
  
  private addNote(): void {
    const note = prompt('Add a note about the current state:')
    if (note) {
      this.addNoteWithData(note, 'info', [])
    }
  }
  
  addNoteWithData(content: string, severity: 'info' | 'warning' | 'error' | 'critical' = 'info', tags: string[] = []): void {
    const note: Note = {
      id: `note-${++this.noteCounter}`,
      timestamp: Date.now(),
      content,
      severity,
      tags
    }
    
    this.notes.push(note)
    
    const action = this.recordAction({
      type: 'note',
      data: { note: content, severity, tags }
    })
    
    note.associatedActionId = action.id
    
    // Take screenshot with the note
    this.captureScreenshot('manual', `Note: ${content}`, action.id)
  }
  
  private markImportant(): void {
    const lastAction = this.actions[this.actions.length - 1]
    if (lastAction) {
      lastAction.data = { ...lastAction.data, important: true }
      console.log('⭐ Marked as important:', lastAction)
      
      // Take screenshot of important moment
      this.captureScreenshot('manual', 'Marked as important', lastAction.id)
    }
  }
  
  private extractTargetInfo(element: HTMLElement): UserAction['target'] {
    return {
      tagName: element.tagName,
      id: element.id || undefined,
      className: element.className || undefined,
      testId: element.getAttribute('data-testid') || undefined,
      text: this.getElementText(element),
      value: (element as HTMLInputElement).value || undefined,
      xpath: this.getXPath(element)
    }
  }
  
  private getElementText(element: HTMLElement): string {
    // For buttons and links, get the visible text
    if (element.tagName === 'BUTTON' || element.tagName === 'A') {
      return element.textContent?.trim() || ''
    }
    
    // For inputs, use placeholder or label
    if (element.tagName === 'INPUT') {
      const input = element as HTMLInputElement
      return input.placeholder || this.getElementLabel(element) || ''
    }
    
    return element.textContent?.trim().substring(0, 50) || ''
  }
  
  private getElementLabel(element: HTMLElement): string {
    // Try to find associated label
    const id = element.id
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`)
      if (label) return label.textContent?.trim() || ''
    }
    
    // Check if element is inside a label
    const parentLabel = element.closest('label')
    if (parentLabel) {
      return parentLabel.textContent?.trim() || ''
    }
    
    return ''
  }
  
  private getElementDescription(element: HTMLElement): string {
    const testId = element.getAttribute('data-testid')
    if (testId) return `[${testId}]`
    
    const id = element.id
    if (id) return `#${id}`
    
    const text = this.getElementText(element)
    if (text) return text
    
    return element.tagName.toLowerCase()
  }
  
  private getXPath(element: HTMLElement): string {
    if (element.id) return `//*[@id="${element.id}"]`
    
    const paths: string[] = []
    let currentElement: HTMLElement | null = element
    
    while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
      let index = 0
      let sibling = currentElement.previousSibling
      
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === currentElement.nodeName) {
          index++
        }
        sibling = sibling.previousSibling
      }
      
      const tagName = currentElement.nodeName.toLowerCase()
      const pathIndex = index > 0 ? `[${index + 1}]` : ''
      paths.unshift(`${tagName}${pathIndex}`)
      
      currentElement = currentElement.parentElement
    }
    
    return `/${paths.join('/')}`
  }
  
  private shouldAutoScreenshot(element: HTMLElement): boolean {
    // Screenshot after clicking buttons
    if (element.tagName === 'BUTTON') return true
    
    // Screenshot after clicking links that change the page
    if (element.tagName === 'A') {
      const href = (element as HTMLAnchorElement).href
      return !!href && !href.startsWith('#')
    }
    
    // Screenshot after form submissions
    if ('type' in element && (element as HTMLInputElement).type === 'submit') return true
    
    // Screenshot after clicking navigation elements
    if (element.getAttribute('role') === 'navigation') return true
    if (element.classList.contains('nav')) return true
    
    return false
  }
  
  private isInteractiveElement(element: HTMLElement): boolean {
    const interactiveTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A']
    return interactiveTags.includes(element.tagName)
  }
  
  generateTextReport(): string {
    const metadata = {
      sessionId: this.sessionId,
      date: new Date(this.startTime).toLocaleDateString(),
      time: new Date(this.startTime).toLocaleTimeString(),
      duration: this.formatDuration(this.endTime - this.startTime)
    }
    
    // Sort notes by severity
    const sortedNotes = [...this.notes].sort((a, b) => {
      const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
    
    // Format notes with timestamps
    const notesSection = sortedNotes
      .map(note => {
        const time = new Date(note.timestamp).toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        })
        const tags = note.tags.length > 0 ? ` (${note.tags.join(', ')})` : ''
        return `[${time}] [${note.severity}] ${note.content}${tags}`
      })
      .join('\n')
    
    // Format errors
    const errorsSection = this.errors
      .map(error => {
        const time = new Date(error.timestamp).toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        })
        const location = error.filename ? ` at ${error.filename}:${error.lineno}:${error.colno}` : ''
        return `[${time}] ${error.message}${location}`
      })
      .join('\n')
    
    // Actions summary
    const actionTypes = this.getActionTypeSummary()
    const actionsSummary = Object.entries(actionTypes)
      .map(([type, count]) => `  ${type}: ${count}`)
      .join('\n')
    
    // Screenshots list
    const screenshotsList = this.screenshots
      .map(s => `  ${s.id}.jpg: ${s.description}`)
      .join('\n')
    
    return `TEST SESSION REPORT
==================
Session ID: ${metadata.sessionId}
Date: ${metadata.date}
Time: ${metadata.time}
Duration: ${metadata.duration}
URL: ${window.location.href}

USER NOTES:
-----------
${notesSection || '(No notes recorded)'}

ERRORS:
-------
${errorsSection || '(No errors recorded)'}

ACTIONS SUMMARY:
---------------
Total Actions: ${this.actions.length}
${actionsSummary}

SCREENSHOTS:
-----------
Total: ${this.screenshots.length}
${screenshotsList || '(No screenshots captured)'}

PERFORMANCE:
-----------
Metrics Collected: ${this.performanceMetrics.length}

END OF REPORT
=============`
  }
  
  generateMarkdownReport(): string {
    const metadata = {
      sessionId: this.sessionId,
      date: new Date(this.startTime).toLocaleDateString(),
      time: new Date(this.startTime).toLocaleTimeString(),
      duration: this.formatDuration(this.endTime - this.startTime)
    }
    
    // Group notes by severity
    const notesBySeverity: Record<string, Note[]> = {
      critical: [],
      error: [],
      warning: [],
      info: []
    }
    
    this.notes.forEach(note => {
      notesBySeverity[note.severity].push(note)
    })
    
    // Format notes sections
    let notesMarkdown = ''
    if (notesBySeverity.critical.length > 0) {
      notesMarkdown += '### Critical Issues\n'
      notesMarkdown += notesBySeverity.critical
        .map(n => `- **${n.content}** ${n.tags.length > 0 ? `\`[${n.tags.join(', ')}]\`` : ''}`)
        .join('\n') + '\n\n'
    }
    if (notesBySeverity.error.length > 0) {
      notesMarkdown += '### Errors\n'
      notesMarkdown += notesBySeverity.error
        .map(n => `- **${n.content}** ${n.tags.length > 0 ? `\`[${n.tags.join(', ')}]\`` : ''}`)
        .join('\n') + '\n\n'
    }
    if (notesBySeverity.warning.length > 0) {
      notesMarkdown += '### Warnings\n'
      notesMarkdown += notesBySeverity.warning
        .map(n => `- ${n.content} ${n.tags.length > 0 ? `\`[${n.tags.join(', ')}]\`` : ''}`)
        .join('\n') + '\n\n'
    }
    if (notesBySeverity.info.length > 0) {
      notesMarkdown += '### Information\n'
      notesMarkdown += notesBySeverity.info
        .map(n => `- ${n.content} ${n.tags.length > 0 ? `\`[${n.tags.join(', ')}]\`` : ''}`)
        .join('\n') + '\n\n'
    }
    
    // Actions table
    const actionTypes = this.getActionTypeSummary()
    const actionsTable = Object.entries(actionTypes)
      .map(([type, count]) => `| ${type} | ${count} |`)
      .join('\n')
    
    return `# Test Session Report

## Session Information
- **Session ID**: ${metadata.sessionId}
- **Date**: ${metadata.date}
- **Time**: ${metadata.time}
- **Duration**: ${metadata.duration}
- **URL**: ${window.location.href}

## User Notes
${notesMarkdown || 'No notes recorded during this session.'}

## Errors
${this.errors.length > 0 
  ? this.errors.map(e => `- \`${e.message}\` at ${e.filename || 'unknown'}:${e.lineno || 0}`).join('\n')
  : 'No errors occurred during this session.'}

## Actions Summary
**Total Actions**: ${this.actions.length}

| Action Type | Count |
|------------|-------|
${actionsTable}

## Screenshots
**Total Screenshots**: ${this.screenshots.length}

${this.screenshots.length > 0
  ? this.screenshots.map(s => `- \`${s.id}.jpg\`: ${s.description}`).join('\n')
  : 'No screenshots captured.'}

## Performance Metrics
**Metrics Collected**: ${this.performanceMetrics.length}

---
*Report generated on ${new Date().toLocaleString()}*`
  }
  
  generateJSONReport(): TestSessionData {
    const duration = this.endTime - this.startTime
    
    // Convert screenshots to lightweight format (no base64 data)
    const lightweightScreenshots = this.screenshots.map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      trigger: s.trigger,
      description: s.description,
      filename: `${s.id}.jpg`,
      pageTitle: s.pageTitle,
      url: s.url,
      linkedActionId: s.linkedActionId
    }))
    
    return {
      metadata: {
        sessionId: this.sessionId,
        startTime: this.startTime,
        endTime: this.endTime,
        duration,
        url: window.location.href,
        userAgent: navigator.userAgent
      },
      actions: this.actions,
      screenshots: lightweightScreenshots,
      notes: this.notes,
      errors: this.errors,
      consoleLogs: this.consoleLogs,
      performance: this.performanceMetrics,
      summary: {
        totalActions: this.actions.length,
        actionsByType: this.getActionTypeSummary(),
        errorCount: this.errors.length,
        noteCount: this.notes.length,
        screenshotCount: this.screenshots.length,
        consoleLogCount: this.consoleLogs.length
      }
    }
  }
  
  private generateReport(): void {
    const duration = this.endTime - this.startTime
    const reportData = {
      sessionId: this.sessionId,
      startTime: new Date(this.startTime).toISOString(),
      duration: duration,
      durationFormatted: this.formatDuration(duration),
      actions: this.actions,
      screenshots: this.screenshots,
      performanceMetrics: this.performanceMetrics,
      summary: {
        totalActions: this.actions.length,
        totalScreenshots: this.screenshots.length,
        actionTypes: this.getActionTypeSummary(),
        pagesVisited: this.getUniquePages(),
        errors: this.actions.filter(a => a.type === 'error').length
      }
    }
    
    const html = this.generateHTMLReport(reportData)
    
    // Download report
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `test-session-${reportData.sessionId}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    console.log('📊 Test report generated and downloaded')
    
    // Also generate and download JSON report
    this.downloadJSONReport()
  }
  
  private downloadJSONReport(): void {
    const jsonReport = this.generateJSONReport()
    const jsonString = JSON.stringify(jsonReport, null, 2)
    
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `test-session-${this.sessionId}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    console.log('📊 JSON report generated and downloaded')
  }
  
  private generateHTMLReport(data: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Manual Test Session Report - ${data.sessionId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f0f;
      color: #e0e0e0;
      line-height: 1.6;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    
    h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      color: white;
    }
    
    .session-info {
      display: flex;
      gap: 30px;
      margin-top: 20px;
      color: rgba(255,255,255,0.9);
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    
    .summary-card {
      background: #1a1a1a;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #333;
    }
    
    .summary-card h3 {
      color: #9ca3af;
      font-size: 0.9em;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .summary-card .value {
      font-size: 2em;
      font-weight: bold;
      color: #667eea;
    }
    
    .timeline {
      background: #1a1a1a;
      border-radius: 8px;
      padding: 20px;
      margin: 30px 0;
      border: 1px solid #333;
    }
    
    .timeline h2 {
      margin-bottom: 20px;
      color: #f3f4f6;
    }
    
    .timeline-item {
      display: flex;
      gap: 20px;
      padding: 15px;
      border-bottom: 1px solid #333;
      transition: background 0.2s;
    }
    
    .timeline-item:hover {
      background: rgba(102, 126, 234, 0.1);
    }
    
    .timeline-time {
      color: #6b7280;
      font-size: 0.9em;
      min-width: 80px;
    }
    
    .timeline-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    
    .timeline-content {
      flex: 1;
    }
    
    .timeline-title {
      font-weight: 600;
      margin-bottom: 5px;
    }
    
    .timeline-details {
      color: #9ca3af;
      font-size: 0.9em;
    }
    
    .timeline-screenshot {
      width: 80px;
      height: 60px;
      object-fit: cover;
      border-radius: 4px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    
    .timeline-screenshot:hover {
      transform: scale(1.05);
    }
    
    .icon-click { background: #3b82f6; }
    .icon-input { background: #10b981; }
    .icon-navigation { background: #8b5cf6; }
    .icon-error { background: #ef4444; }
    .icon-screenshot { background: #f59e0b; }
    .icon-note { background: #ec4899; }
    
    .screenshots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    
    .screenshot-card {
      background: #1a1a1a;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #333;
      transition: transform 0.2s;
    }
    
    .screenshot-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    
    .screenshot-image {
      width: 100%;
      height: 200px;
      object-fit: cover;
      cursor: pointer;
    }
    
    .screenshot-info {
      padding: 15px;
    }
    
    .screenshot-time {
      color: #6b7280;
      font-size: 0.9em;
    }
    
    .screenshot-description {
      margin-top: 5px;
      font-weight: 500;
    }
    
    .performance-chart {
      background: #1a1a1a;
      border-radius: 8px;
      padding: 20px;
      margin: 30px 0;
      border: 1px solid #333;
    }
    
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.9);
      z-index: 1000;
      justify-content: center;
      align-items: center;
    }
    
    .modal.active { display: flex; }
    
    .modal-content {
      max-width: 90%;
      max-height: 90%;
    }
    
    .modal-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    
    .modal-close {
      position: absolute;
      top: 20px;
      right: 40px;
      color: white;
      font-size: 40px;
      cursor: pointer;
      background: none;
      border: none;
    }
    
    .filter-bar {
      background: #1a1a1a;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    
    .filter-btn {
      padding: 8px 16px;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 6px;
      color: #e0e0e0;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .filter-btn:hover {
      background: #3a3a3a;
    }
    
    .filter-btn.active {
      background: #667eea;
      border-color: #667eea;
    }
    
    .important {
      border-left: 3px solid #f59e0b;
      background: rgba(245, 158, 11, 0.1);
    }
    
    .error-item {
      border-left: 3px solid #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎬 Manual Test Session Report</h1>
      <div class="session-info">
        <div>📅 ${new Date(data.startTime).toLocaleString()}</div>
        <div>⏱️ Duration: ${data.durationFormatted}</div>
        <div>🎯 ${data.summary.totalActions} Actions</div>
        <div>📸 ${data.summary.totalScreenshots} Screenshots</div>
        ${data.summary.errors > 0 ? `<div style="color: #ef4444;">⚠️ ${data.summary.errors} Errors</div>` : ''}
      </div>
    </div>
    
    <div class="summary">
      <div class="summary-card">
        <h3>Total Actions</h3>
        <div class="value">${data.summary.totalActions}</div>
      </div>
      <div class="summary-card">
        <h3>Pages Visited</h3>
        <div class="value">${data.summary.pagesVisited.length}</div>
      </div>
      <div class="summary-card">
        <h3>Screenshots</h3>
        <div class="value">${data.summary.totalScreenshots}</div>
      </div>
      <div class="summary-card">
        <h3>Test Duration</h3>
        <div class="value">${data.durationFormatted}</div>
      </div>
    </div>
    
    <div class="timeline">
      <h2>📊 Action Timeline</h2>
      <div class="filter-bar">
        <button class="filter-btn active" onclick="filterActions('all')">All</button>
        <button class="filter-btn" onclick="filterActions('click')">Clicks</button>
        <button class="filter-btn" onclick="filterActions('input')">Inputs</button>
        <button class="filter-btn" onclick="filterActions('navigation')">Navigation</button>
        <button class="filter-btn" onclick="filterActions('screenshot')">Screenshots</button>
        <button class="filter-btn" onclick="filterActions('error')">Errors</button>
      </div>
      <div id="timeline-items">
        ${this.generateTimelineHTML(data.actions, data.screenshots)}
      </div>
    </div>
    
    <div class="timeline">
      <h2>📸 Screenshots Gallery</h2>
      <div class="screenshots-grid">
        ${data.screenshots.map((s: Screenshot) => `
          <div class="screenshot-card">
            <img src="${s.dataUrl}" alt="${s.description}" class="screenshot-image" onclick="openModal('${s.dataUrl}')">
            <div class="screenshot-info">
              <div class="screenshot-time">${new Date(s.timestamp).toLocaleTimeString()}</div>
              <div class="screenshot-description">${s.description}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    
    ${data.performanceMetrics.length > 0 ? `
      <div class="performance-chart">
        <h2>⚡ Performance Metrics</h2>
        <canvas id="perfChart"></canvas>
      </div>
    ` : ''}
  </div>
  
  <div class="modal" id="modal" onclick="closeModal()">
    <button class="modal-close" onclick="closeModal()">&times;</button>
    <img id="modal-image" class="modal-image" src="">
  </div>
  
  <script>
    function openModal(src) {
      document.getElementById('modal').classList.add('active');
      document.getElementById('modal-image').src = src;
    }
    
    function closeModal() {
      document.getElementById('modal').classList.remove('active');
    }
    
    function filterActions(type) {
      const buttons = document.querySelectorAll('.filter-btn');
      buttons.forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      
      const items = document.querySelectorAll('.timeline-item');
      items.forEach(item => {
        if (type === 'all' || item.dataset.type === type) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    }
    
    // Smooth scroll to timeline items
    document.querySelectorAll('.timeline-item').forEach(item => {
      item.addEventListener('click', function() {
        this.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  </script>
</body>
</html>
    `
  }
  
  private generateTimelineHTML(actions: UserAction[], screenshots: Screenshot[]): string {
    const combined: any[] = [...actions]
    
    // Add screenshot entries to timeline
    screenshots.forEach(s => {
      if (!s.linkedActionId) {
        combined.push({
          id: s.id,
          timestamp: s.timestamp,
          type: 'screenshot',
          data: { description: s.description, dataUrl: s.dataUrl }
        })
      }
    })
    
    // Sort by timestamp
    combined.sort((a, b) => a.timestamp - b.timestamp)
    
    return combined.map(item => {
      const time = new Date(item.timestamp).toLocaleTimeString()
      const icon = this.getActionIcon(item.type)
      const iconClass = `icon-${item.type}`
      
      // Find linked screenshot
      const linkedScreenshot = screenshots.find(s => s.linkedActionId === item.id)
      
      return `
        <div class="timeline-item ${item.data?.important ? 'important' : ''} ${item.type === 'error' ? 'error-item' : ''}" data-type="${item.type}">
          <div class="timeline-time">${time}</div>
          <div class="timeline-icon ${iconClass}">${icon}</div>
          <div class="timeline-content">
            <div class="timeline-title">${this.getActionTitle(item)}</div>
            <div class="timeline-details">${this.getActionDetails(item)}</div>
          </div>
          ${linkedScreenshot ? `
            <img src="${linkedScreenshot.dataUrl}" class="timeline-screenshot" onclick="openModal('${linkedScreenshot.dataUrl}')" title="View screenshot">
          ` : ''}
        </div>
      `
    }).join('')
  }
  
  private getActionIcon(type: string): string {
    const icons: Record<string, string> = {
      click: '👆',
      input: '⌨️',
      change: '✏️',
      navigation: '🧭',
      scroll: '📜',
      focus: '🎯',
      blur: '👁️',
      screenshot: '📸',
      note: '📝',
      error: '❌'
    }
    return icons[type] || '•'
  }
  
  private getActionTitle(action: any): string {
    switch (action.type) {
      case 'click':
        return `Clicked ${action.target?.text || action.target?.tagName || 'element'}`
      case 'input':
        return `Typed in ${action.target?.text || action.target?.tagName || 'field'}`
      case 'navigation':
        return `Navigated to ${action.data?.title || 'page'}`
      case 'screenshot':
        return `Screenshot: ${action.data?.description || 'Manual capture'}`
      case 'error':
        return `Error: ${action.data?.message || 'Unknown error'}`
      case 'note':
        return `Note: ${action.data?.note || ''}`
      default:
        return action.type.charAt(0).toUpperCase() + action.type.slice(1)
    }
  }
  
  private getActionDetails(action: any): string {
    const details: string[] = []
    
    if (action.target?.testId) {
      details.push(`[${action.target.testId}]`)
    }
    
    if (action.target?.id) {
      details.push(`#${action.target.id}`)
    }
    
    if (action.data?.value) {
      details.push(`Value: "${action.data.value}"`)
    }
    
    if (action.pageTitle && action.type !== 'navigation') {
      details.push(`on ${action.pageTitle}`)
    }
    
    if (action.duration && action.duration > 100) {
      details.push(`(${(action.duration / 1000).toFixed(1)}s after previous)`)
    }
    
    return details.join(' · ') || action.target?.xpath || ''
  }
  
  private getActionTypeSummary(): Record<string, number> {
    const summary: Record<string, number> = {}
    this.actions.forEach(action => {
      summary[action.type] = (summary[action.type] || 0) + 1
    })
    return summary
  }
  
  private getUniquePages(): string[] {
    const pages = new Set<string>()
    this.actions.forEach(action => {
      if (action.pageTitle) {
        pages.add(action.pageTitle)
      }
    })
    return Array.from(pages)
  }
  
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }
}

// Create global instance and attach to window
let recorder: ManualTestRecorder | null = null

export function startRecording(options?: Partial<RecordingOptions>): void {
  if (recorder && recorder['isRecording']) {
    console.warn('Recording already in progress')
    return
  }
  
  // Check if this was called by user interaction
  const event = window.event as Event | undefined
  const isUserTriggered = event && event.isTrusted
  
  // Log how recording was triggered
  console.log('[ManualTestRecorder] Starting recording session...', {
    triggered: isUserTriggered ? 'user' : 'programmatic',
    caller: new Error().stack?.split('\n')[2] // Get caller info
  })
  
  // Add a safeguard: Only allow programmatic starts if explicitly allowed
  if (!isUserTriggered && !options?.allowProgrammaticStart) {
    console.warn('[ManualTestRecorder] Recording was triggered programmatically. To allow this, pass { allowProgrammaticStart: true } in options.')
    return
  }
  
  recorder = new ManualTestRecorder(options)
  recorder.start()
}

export function stopRecording(): void {
  if (recorder) {
    recorder.stop()
    recorder = null
  }
}

// Attach to window for easy console access
if (typeof window !== 'undefined') {
  try {
    (window as any).startRecording = startRecording;
    (window as any).stopRecording = stopRecording;
  } catch (e) {
    console.warn('Could not attach recorder functions to window:', e)
  }
  
  console.log(`
📹 Manual Test Recorder AVAILABLE (not recording yet)

To start recording:
  - Click the "Record Session" button in the UI, OR
  - Call startRecording() in the console
  
Commands:
  startRecording()     - Start recording your actions
  stopRecording()      - Stop and generate report
  
Keyboard shortcuts (when recording):
  Ctrl+Shift+S - Take screenshot
  Ctrl+Shift+N - Add note
  Ctrl+Shift+M - Mark as important
  Ctrl+Shift+E - End recording
  
Note: Recording will NOT start automatically.
  `)
}