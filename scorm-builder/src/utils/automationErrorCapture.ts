/**
 * Enhanced error capture functionality for automation debugging
 * Captures screenshots on errors and saves them to files with path logging
 */

export class AutomationErrorCapture {
  private screenshotDir: string
  
  constructor() {
    // Create a timestamp-based directory for this session's screenshots
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    this.screenshotDir = `automation-errors-${timestamp}`
  }
  
  /**
   * Capture error screenshot and save to file
   * Returns the file path for debugging
   */
  async captureErrorScreenshot(
    errorContext: string, 
    error: Error,
    navigator?: { takeScreenshot: (name: string) => Promise<Blob>, debugPageStructure: () => Promise<void> }
  ): Promise<string | null> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `error-${errorContext}-${timestamp}.png`
      
      console.error(`\n🚨 [ERROR SCREENSHOT] Capturing error state...`)
      console.error(`📍 Context: ${errorContext}`)
      console.error(`❌ Error: ${error.message}`)
      
      if (navigator) {
        // Take screenshot
        const blob = await navigator.takeScreenshot(`error-${errorContext}`)
        
        // Convert blob to base64 for easy saving (in a real app, save to file system)
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
        const base64 = await base64Promise
        
        // Log the file path (in a real Tauri app, this would save to disk)
        const filePath = `${this.screenshotDir}/${filename}`
        
        console.error(`📸 Screenshot saved to: ${filePath}`)
        console.error(`📋 Copy and paste this path to share the screenshot`)
        console.error(`🔍 Base64 preview (first 100 chars): ${base64.substring(0, 100)}...`)
        
        // Also capture page structure for additional debugging
        await navigator.debugPageStructure()
        
        // Store in localStorage for retrieval (temporary solution)
        try {
          localStorage.setItem(`automation-error-${timestamp}`, JSON.stringify({
            path: filePath,
            context: errorContext,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            screenshot: base64,
            url: window.location.href
          }))
          console.error(`💾 Error data stored in localStorage with key: automation-error-${timestamp}`)
        } catch (storageError) {
          console.error(`⚠️ Could not store error data:`, storageError)
        }
        
        return filePath
      } else {
        console.error(`⚠️ No navigator available for screenshot`)
        return null
      }
    } catch (captureError) {
      console.error(`❌ Failed to capture error screenshot:`, captureError)
      return null
    }
  }
  
  /**
   * Retrieve error screenshot from localStorage by timestamp
   */
  static retrieveErrorScreenshot(timestamp: string): any {
    try {
      const data = localStorage.getItem(`automation-error-${timestamp}`)
      if (data) {
        return JSON.parse(data)
      }
      return null
    } catch (error) {
      console.error('Failed to retrieve error screenshot:', error)
      return null
    }
  }
  
  /**
   * List all stored error screenshots
   */
  static listErrorScreenshots(): string[] {
    const errors: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('automation-error-')) {
        errors.push(key)
      }
    }
    return errors
  }
  
  /**
   * Clear old error screenshots from localStorage
   */
  static clearOldErrorScreenshots(keepLast: number = 5): void {
    const errors = AutomationErrorCapture.listErrorScreenshots()
    if (errors.length > keepLast) {
      // Sort by timestamp (newer first)
      errors.sort().reverse()
      
      // Remove old ones
      const toRemove = errors.slice(keepLast)
      toRemove.forEach(key => {
        localStorage.removeItem(key)
        console.log(`Removed old error screenshot: ${key}`)
      })
    }
  }
}

// Add helper function to window for easy access
if (typeof window !== 'undefined') {
  (window as any).getErrorScreenshot = (timestamp: string) => {
    const data = AutomationErrorCapture.retrieveErrorScreenshot(timestamp)
    if (data) {
      console.log('Error Context:', data.context)
      console.log('Error Message:', data.error)
      console.log('URL:', data.url)
      console.log('Timestamp:', data.timestamp)
      console.log('Screenshot Path:', data.path)
      console.log('To view screenshot, copy the base64 data below and paste in a new tab:')
      console.log(data.screenshot)
      return data
    } else {
      console.log('No error screenshot found for timestamp:', timestamp)
      console.log('Available error screenshots:')
      AutomationErrorCapture.listErrorScreenshots().forEach(key => console.log(`  - ${key}`))
      return null
    }
  }
  
  (window as any).listErrorScreenshots = () => {
    const errors = AutomationErrorCapture.listErrorScreenshots()
    console.log('Available error screenshots:')
    errors.forEach(key => {
      const data = AutomationErrorCapture.retrieveErrorScreenshot(key.replace('automation-error-', ''))
      if (data) {
        console.log(`  - ${key}: ${data.context} at ${data.timestamp}`)
      }
    })
    return errors
  }
  
  console.log('💡 Error screenshot helpers loaded:')
  console.log('   getErrorScreenshot(timestamp) - Retrieve a specific error screenshot')
  console.log('   listErrorScreenshots() - List all available error screenshots')
}

export default AutomationErrorCapture