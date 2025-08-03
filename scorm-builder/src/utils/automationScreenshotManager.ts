/**
 * Screenshot manager for automation testing
 * Captures, stores, and manages screenshots during automated test runs
 */
export class AutomationScreenshotManager {
  private screenshots: Map<string, {
    blob: Blob
    timestamp: number
    stepName: string
    metadata?: any
  }> = new Map()
  
  private maxScreenshots = 100
  private compressionQuality = 0.8
  
  constructor(private options: {
    maxScreenshots?: number
    compressionQuality?: number
    autoSave?: boolean
    savePath?: string
  } = {}) {
    if (options.maxScreenshots) {
      this.maxScreenshots = options.maxScreenshots
    }
    if (options.compressionQuality) {
      this.compressionQuality = options.compressionQuality
    }
  }
  
  /**
   * Capture a screenshot
   */
  async captureScreenshot(stepName: string, metadata?: any): Promise<string> {
    try {
      // Check if we've reached the max
      if (this.screenshots.size >= this.maxScreenshots) {
        this.removeOldestScreenshot()
      }
      
      const screenshotId = `screenshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Use html2canvas if available
      const blob = await this.takeScreenshot()
      
      // Store the screenshot
      this.screenshots.set(screenshotId, {
        blob,
        timestamp: Date.now(),
        stepName,
        metadata
      })
      
      // Auto-save if enabled
      if (this.options.autoSave && this.options.savePath) {
        await this.saveScreenshot(screenshotId)
      }
      
      return screenshotId
    } catch (error) {
      console.error('Failed to capture screenshot:', error)
      throw error
    }
  }
  
  /**
   * Take a screenshot using available methods
   */
  private async takeScreenshot(): Promise<Blob> {
    // Try html2canvas first
    if (typeof (window as any).html2canvas !== 'undefined') {
      const html2canvas = (window as any).html2canvas
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        scale: 1,
        logging: false,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight
      })
      
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob: Blob | null) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to create blob from canvas'))
            }
          },
          'image/jpeg',
          this.compressionQuality
        )
      })
    }
    
    // Fallback to basic canvas capture
    return this.basicCanvasCapture()
  }
  
  /**
   * Basic canvas capture fallback
   */
  private async basicCanvasCapture(): Promise<Blob> {
    const canvas = document.createElement('canvas')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const ctx = canvas.getContext('2d')!
    
    // Capture visible content
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Try to capture some DOM content
    this.drawDOMContent(ctx)
    
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create blob'))
          }
        },
        'image/jpeg',
        this.compressionQuality
      )
    })
  }
  
  /**
   * Draw DOM content to canvas (basic implementation)
   */
  private drawDOMContent(ctx: CanvasRenderingContext2D): void {
    // Draw basic page info
    ctx.fillStyle = '#000000'
    ctx.font = '16px Arial'
    ctx.fillText(`URL: ${window.location.href}`, 20, 30)
    ctx.fillText(`Time: ${new Date().toLocaleTimeString()}`, 20, 60)
    ctx.fillText(`Title: ${document.title}`, 20, 90)
    
    // Draw visible text content
    const textElements = document.querySelectorAll('h1, h2, h3, p, span, div')
    let y = 120
    
    textElements.forEach((element, index) => {
      if (index > 20) return // Limit to prevent overflow
      
      const rect = element.getBoundingClientRect()
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        const text = element.textContent?.trim() || ''
        if (text && text.length > 0) {
          ctx.fillText(text.substring(0, 80), rect.left, rect.top)
        }
      }
    })
  }
  
  /**
   * Get a screenshot by ID
   */
  getScreenshot(screenshotId: string): Blob | null {
    const screenshot = this.screenshots.get(screenshotId)
    return screenshot ? screenshot.blob : null
  }
  
  /**
   * Get all screenshots
   */
  getAllScreenshots(): Array<{
    id: string
    stepName: string
    timestamp: number
    metadata?: any
    blob?: Blob
    dataUrl?: string
  }> {
    return Array.from(this.screenshots.entries()).map(([id, data]) => ({
      id,
      stepName: data.stepName,
      timestamp: data.timestamp,
      metadata: data.metadata,
      blob: data.blob,
      dataUrl: undefined // Will be converted on demand
    }))
  }
  
  /**
   * Convert all screenshots to data URLs for display
   */
  async getAllScreenshotsWithDataUrls() {
    const screenshots = this.getAllScreenshots()
    const withDataUrls = await Promise.all(
      screenshots.map(async (screenshot) => {
        if (screenshot.blob) {
          const reader = new FileReader()
          const dataUrl = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(screenshot.blob)
          })
          return { ...screenshot, dataUrl }
        }
        return screenshot
      })
    )
    return withDataUrls
  }
  
  /**
   * Get screenshots for a specific step
   */
  getScreenshotsForStep(stepName: string): Array<{
    id: string
    timestamp: number
    metadata?: any
  }> {
    return Array.from(this.screenshots.entries())
      .filter(([_, data]) => data.stepName === stepName)
      .map(([id, data]) => ({
        id,
        timestamp: data.timestamp,
        metadata: data.metadata
      }))
  }
  
  /**
   * Remove oldest screenshot to make room
   */
  private removeOldestScreenshot(): void {
    let oldestId: string | null = null
    let oldestTime = Infinity
    
    for (const [id, data] of this.screenshots.entries()) {
      if (data.timestamp < oldestTime) {
        oldestTime = data.timestamp
        oldestId = id
      }
    }
    
    if (oldestId) {
      this.screenshots.delete(oldestId)
    }
  }
  
  /**
   * Save a screenshot to disk (if in Tauri environment)
   */
  private async saveScreenshot(screenshotId: string): Promise<void> {
    const screenshot = this.screenshots.get(screenshotId)
    if (!screenshot || !this.options.savePath) return
    
    try {
      // Check if we're in Tauri environment
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const { writeFile } = await import('@tauri-apps/plugin-fs')
        const arrayBuffer = await screenshot.blob.arrayBuffer()
        const fileName = `${screenshot.stepName.replace(/\s+/g, '-')}-${screenshot.timestamp}.jpg`
        const filePath = `${this.options.savePath}/${fileName}`
        
        await writeFile(filePath, new Uint8Array(arrayBuffer))
        console.log(`Screenshot saved: ${filePath}`)
      }
    } catch (error) {
      console.error('Failed to save screenshot:', error)
    }
  }
  
  /**
   * Create a screenshot report
   */
  async generateReport(): Promise<{
    totalScreenshots: number
    screenshots: Array<{
      id: string
      stepName: string
      timestamp: number
      timeAgo: string
      metadata?: any
    }>
    memoryUsage: number
  }> {
    const screenshots = this.getAllScreenshots()
    const now = Date.now()
    
    // Calculate approximate memory usage
    let memoryUsage = 0
    for (const [_, data] of this.screenshots.entries()) {
      memoryUsage += data.blob.size
    }
    
    return {
      totalScreenshots: screenshots.length,
      screenshots: screenshots.map(s => ({
        ...s,
        timeAgo: this.formatTimeAgo(now - s.timestamp)
      })),
      memoryUsage
    }
  }
  
  /**
   * Format time ago
   */
  private formatTimeAgo(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s ago`
    
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }
  
  /**
   * Create a data URL for a screenshot
   */
  async getScreenshotDataUrl(screenshotId: string): Promise<string | null> {
    const blob = this.getScreenshot(screenshotId)
    if (!blob) return null
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
  
  /**
   * Clear all screenshots
   */
  clearScreenshots(): void {
    this.screenshots.clear()
  }
  
  /**
   * Export all screenshots as a zip file
   */
  async exportScreenshots(): Promise<Blob> {
    // Dynamic import JSZip if available
    try {
      const JSZip = (window as any).JSZip
      if (!JSZip) {
        throw new Error('JSZip not available')
      }
      
      const zip = new JSZip()
      const screenshotsFolder = zip.folder('screenshots')
      
      for (const [id, data] of this.screenshots.entries()) {
        const fileName = `${data.stepName.replace(/\s+/g, '-')}-${data.timestamp}.jpg`
        screenshotsFolder?.file(fileName, data.blob)
      }
      
      // Add metadata
      const metadata = await this.generateReport()
      screenshotsFolder?.file('metadata.json', JSON.stringify(metadata, null, 2))
      
      return await zip.generateAsync({ type: 'blob' })
    } catch (error) {
      console.error('Failed to export screenshots:', error)
      // Fallback: return first screenshot
      const first = this.screenshots.values().next().value
      return first ? first.blob : new Blob(['No screenshots available'])
    }
  }
}

/**
 * Global instance for easy access
 */
export const screenshotManager = new AutomationScreenshotManager({
  maxScreenshots: 50,
  compressionQuality: 0.7,
  autoSave: false
})

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).screenshotManager = screenshotManager
}