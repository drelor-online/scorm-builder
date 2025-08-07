/**
 * UI Navigation helper for visual automation testing
 * Provides methods to interact with the UI programmatically
 */
export class AutomationUINavigator {
  private highlightStyle = `
    outline: 3px solid #ff0000;
    outline-offset: 2px;
    transition: outline 0.3s ease;
  `
  
  private pointerElement: HTMLElement | null = null
  
  constructor(private options: {
    speed?: 'fast' | 'normal' | 'slow'
    highlight?: boolean
    showPointer?: boolean
  } = {}) {
    this.options = {
      speed: options.speed || 'normal',
      highlight: options.highlight ?? true,
      showPointer: options.showPointer ?? true
    }
    
    if (this.options.showPointer) {
      this.createPointer()
    }
  }
  
  private createPointer(): void {
    this.pointerElement = document.createElement('div')
    this.pointerElement.style.cssText = `
      position: fixed;
      width: 20px;
      height: 20px;
      background: radial-gradient(circle, #ff0000 30%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
      z-index: 99999;
      transition: all 0.3s ease;
      transform: translate(-50%, -50%);
      display: none;
    `
    document.body.appendChild(this.pointerElement)
  }
  
  async delay(ms?: number): Promise<void> {
    const delays = {
      fast: 100,
      normal: 300,
      slow: 800
    }
    const delayTime = ms || delays[this.options.speed || 'normal']
    return new Promise(resolve => setTimeout(resolve, delayTime))
  }
  
  private highlightElement(element: Element): void {
    if (!this.options.highlight) return
    
    const originalStyle = (element as HTMLElement).style.cssText;
    (element as HTMLElement).style.cssText += this.highlightStyle
    
    setTimeout(() => {
      (element as HTMLElement).style.cssText = originalStyle
    }, 1000)
  }
  
  private async movePointer(x: number, y: number): Promise<void> {
    if (!this.pointerElement || !this.options.showPointer) return
    
    this.pointerElement.style.display = 'block'
    this.pointerElement.style.left = `${x}px`
    this.pointerElement.style.top = `${y}px`
    
    await this.delay(200)
  }
  
  async waitForElement(selector: string, timeout: number = 10000): Promise<Element> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector)
      if (element) {
        return element
      }
      await this.delay(100)
    }
    
    throw new Error(`Element not found: ${selector}`)
  }
  
  async clickButton(selector: string): Promise<void> {
    const element = await this.waitForElement(selector)
    
    // Scroll into view if needed
    await this.scrollToElement(selector)
    
    // Get element position
    const rect = element.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    
    // Move pointer
    await this.movePointer(x, y)
    
    // Highlight
    this.highlightElement(element)
    
    // Click
    await this.delay()
    
    if (element instanceof HTMLElement) {
      element.click()
    } else {
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      })
      element.dispatchEvent(event)
    }
    
    await this.delay()
  }
  
  async fillInput(selector: string, value: string): Promise<void> {
    console.log(`[fillInput] Starting fillInput for selector: ${selector}`)
    console.log(`[fillInput] Value to fill: "${value}"`)
    console.log(`[fillInput] Value length: ${value.length}`)
    
    try {
      const element = await this.waitForElement(selector) as HTMLInputElement | HTMLTextAreaElement
      
      if (!element || (!('value' in element))) {
        throw new Error(`Element is not an input: ${selector}`)
      }
      
      // Log element type for debugging
      console.log(`[fillInput] Element type: ${element.tagName}, selector: ${selector}`)
      console.log(`[fillInput] Element found, current value: "${element.value}"`)
      
      // Scroll into view
      await this.scrollToElement(selector)
      
      // Get element position
      const rect = element.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      
      // Move pointer
      await this.movePointer(x, y)
      
      // Highlight
      this.highlightElement(element)
      
      // Focus
      element.focus()
      await this.delay(100)
      
      // Clear existing value by selecting all and deleting
      console.log('[fillInput] Attempting to clear existing value...')
      try {
        element.select()
        await this.delay(50)
        console.log('[fillInput] select() succeeded')
      } catch (selectError) {
        console.log('[fillInput] select() failed, using alternative method:', selectError)
        // Alternative: use setSelectionRange for textareas
        if (element instanceof HTMLTextAreaElement) {
          element.setSelectionRange(0, element.value.length)
          console.log('[fillInput] Used setSelectionRange for textarea')
        } else if (element instanceof HTMLInputElement && element.setSelectionRange) {
          element.setSelectionRange(0, element.value.length)
          console.log('[fillInput] Used setSelectionRange for input')
        }
      }
      
      // Dispatch keyboard events to clear
      console.log('[fillInput] Dispatching Delete key event...')
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', bubbles: true }))
      element.value = ''
      console.log('[fillInput] Cleared element value')
      
      // For React 18, we need to trigger the input event with proper event properties
      console.log('[fillInput] Getting native value setter...')
      let nativeInputValueSetter: ((value: string) => void) | undefined
      
      if (element instanceof HTMLInputElement) {
        nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set
        console.log('[fillInput] Got native setter for HTMLInputElement')
      } else if (element instanceof HTMLTextAreaElement) {
        nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set
        console.log('[fillInput] Got native setter for HTMLTextAreaElement')
      }
      
      console.log('[fillInput] Native value setter found:', !!nativeInputValueSetter)
      
      if (nativeInputValueSetter) {
        console.log('[fillInput] Calling native value setter to clear...')
        try {
          nativeInputValueSetter.call(element, '')
          console.log('[fillInput] Native value setter called successfully')
        } catch (setterError) {
          console.error('[fillInput] Error calling native setter:', setterError)
          console.log('[fillInput] Falling back to direct assignment')
          element.value = ''
        }
      } else {
        console.log('[fillInput] No native setter found, using direct assignment')
        element.value = ''
      }
      
      console.log('[fillInput] Dispatching input event...')
      element.dispatchEvent(new Event('input', { bubbles: true }))
      await this.delay(100)
      
      // For textareas with multiline content, set value directly to avoid newline character issues
      if (element instanceof HTMLTextAreaElement && value.includes('\n')) {
        console.log('[fillInput] Textarea with multiline content detected, setting value directly')
        console.log('[fillInput] Value to set:', value)
        console.log('[fillInput] nativeInputValueSetter available:', !!nativeInputValueSetter)
        
        if (nativeInputValueSetter) {
          console.log('[fillInput] Using nativeInputValueSetter for textarea')
          nativeInputValueSetter.call(element, value)
        } else {
          console.log('[fillInput] Falling back to direct value assignment')
          element.value = value
        }
        
        console.log('[fillInput] Current element value after setting:', element.value)
        
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
        await this.delay(200)
        
        console.log('[fillInput] Final element value after events:', element.value)
        
        // Skip the rest of the method for multiline textareas
        // Trigger final events and return
        element.dispatchEvent(new Event('change', { bubbles: true }))
        element.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
        await this.delay(100)
        
        // Re-focus for user visibility
        element.focus()
        
        await this.delay()
        
        // Verify the value was set
        console.log(`[fillInput] Final value: "${element.value}"`)
        return
      } else if (this.options.speed === 'slow') {
        // Type character by character for visual effect and proper React handling
      for (const char of value) {
        // Simulate actual typing with keyboard events
        if (char === '\n') {
          element.dispatchEvent(new KeyboardEvent('keydown', { 
            key: 'Enter', 
            code: 'Enter', 
            bubbles: true 
          }))
        } else {
          element.dispatchEvent(new KeyboardEvent('keydown', { 
            key: char, 
            code: `Key${char.toUpperCase()}`, 
            bubbles: true 
          }))
        }
        
        // Update value using native setter for React
        const currentValue = element.value
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(element, currentValue + char)
        } else {
          element.value = currentValue + char
        }
        
        // Dispatch input event
        element.dispatchEvent(new Event('input', { bubbles: true }))
        
        if (char === '\n') {
          element.dispatchEvent(new KeyboardEvent('keyup', { 
            key: 'Enter', 
            code: 'Enter', 
            bubbles: true 
          }))
        } else {
          element.dispatchEvent(new KeyboardEvent('keyup', { 
            key: char, 
            code: `Key${char.toUpperCase()}`, 
            bubbles: true 
          }))
        }
        
        await this.delay(50)
      }
      } else if (!(element instanceof HTMLTextAreaElement && value.includes('\n'))) {
        // Simulate typing all at once (but skip if we already handled textarea above)
        console.log('[fillInput] Simulating keydown events for non-multiline input...')
        for (const char of value) {
          // Special handling for newline characters (shouldn't happen here but just in case)
          if (char === '\n') {
            element.dispatchEvent(new KeyboardEvent('keydown', { 
              key: 'Enter', 
              code: 'Enter', 
              bubbles: true 
            }))
          } else {
            element.dispatchEvent(new KeyboardEvent('keydown', { 
              key: char, 
              code: `Key${char.toUpperCase()}`, 
              bubbles: true 
            }))
          }
        }
        
        // Set value using native setter for React
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(element, value)
        } else {
          element.value = value
        }
        
        // Dispatch input event
        element.dispatchEvent(new Event('input', { bubbles: true }))
        
        for (const char of value) {
          if (char === '\n') {
            element.dispatchEvent(new KeyboardEvent('keyup', { 
              key: 'Enter', 
              code: 'Enter', 
              bubbles: true 
            }))
          } else {
            element.dispatchEvent(new KeyboardEvent('keyup', { 
              key: char, 
              code: `Key${char.toUpperCase()}`, 
              bubbles: true 
            }))
          }
        }
      }
      
      // Trigger change event and blur to ensure all validations run
      element.dispatchEvent(new Event('change', { bubbles: true }))
      element.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
      await this.delay(100)
      
      // Re-focus for user visibility
      element.focus()
      
      await this.delay()
      
      // Verify the value was set
      console.log(`[fillInput] Final value: "${element.value}"`)
    } catch (error) {
      console.error(`[fillInput] Error filling input ${selector}:`)
      console.error(`[fillInput] Error message: ${error instanceof Error ? error.message : String(error)}`)
      console.error(`[fillInput] Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`)
      console.error(`[fillInput] Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
      console.error(`[fillInput] Full error object:`, error)
      throw error
    }
  }
  
  async selectDropdown(selector: string, value: string): Promise<void> {
    const element = await this.waitForElement(selector) as HTMLSelectElement
    
    if (!element || element.tagName !== 'SELECT') {
      throw new Error(`Element is not a select: ${selector}`)
    }
    
    // Scroll into view
    await this.scrollToElement(selector)
    
    // Get element position for pointer
    const rect = element.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    
    // Move pointer
    await this.movePointer(x, y)
    
    // Highlight
    this.highlightElement(element)
    
    // Focus the element first
    element.focus()
    await this.delay(100)
    
    // For React selects, we need to use the native setter
    const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      'value'
    )?.set
    
    if (nativeSelectValueSetter) {
      nativeSelectValueSetter.call(element, value)
    } else {
      element.value = value
    }
    
    // Dispatch all necessary events for React
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
    
    // Also trigger blur to ensure any validation runs
    element.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    await this.delay(100)
    
    // Re-focus for visibility
    element.focus()
    
    await this.delay()
  }
  
  async scrollToElement(selector: string): Promise<void> {
    const element = await this.waitForElement(selector)
    
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    })
    
    await this.delay(300)
  }
  
  async uploadFile(selector: string, file: File): Promise<void> {
    const element = await this.waitForElement(selector) as HTMLInputElement
    
    if (!element || element.type !== 'file') {
      throw new Error(`Element is not a file input: ${selector}`)
    }
    
    // Highlight
    this.highlightElement(element)
    
    // Create a DataTransfer object to simulate file selection
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    element.files = dataTransfer.files
    
    // Dispatch change event
    element.dispatchEvent(new Event('change', { bubbles: true }))
    
    await this.delay()
  }
  
  async takeScreenshot(stepName: string): Promise<Blob> {
    // Hide pointer temporarily
    if (this.pointerElement) {
      this.pointerElement.style.display = 'none'
    }
    
    await this.delay(100)
    
    // Use html2canvas if available, otherwise use basic canvas capture
    try {
      // Check if html2canvas is available
      const html2canvas = (window as any).html2canvas
      if (html2canvas) {
        const canvas = await html2canvas(document.body, {
          useCORS: true,
          allowTaint: true,
          scale: 1,
          logging: false
        })
        
        return new Promise((resolve) => {
          canvas.toBlob((blob: Blob) => resolve(blob), 'image/png')
        })
      }
    } catch (error) {
      console.warn('html2canvas not available, using basic screenshot', error)
    }
    
    // Fallback: Create a simple canvas capture
    const canvas = document.createElement('canvas')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const ctx = canvas.getContext('2d')!
    
    // Fill with white background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Add text to indicate screenshot
    ctx.fillStyle = 'black'
    ctx.font = '20px Arial'
    ctx.fillText(`Screenshot: ${stepName}`, 20, 40)
    ctx.fillText(`Time: ${new Date().toLocaleTimeString()}`, 20, 70)
    ctx.fillText(`URL: ${window.location.href}`, 20, 100)
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png')
    })
  }
  
  async waitForText(text: string, timeout: number = 10000): Promise<Element> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      const elements = Array.from(document.querySelectorAll('*'))
      const element = elements.find(el => 
        el.textContent && el.textContent.includes(text) &&
        el.children.length === 0 // Only leaf nodes
      )
      
      if (element) {
        return element
      }
      
      await this.delay(100)
    }
    
    throw new Error(`Text not found: ${text}`)
  }
  
  async hover(selector: string): Promise<void> {
    const element = await this.waitForElement(selector)
    
    // Get element position
    const rect = element.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    
    // Move pointer
    await this.movePointer(x, y)
    
    // Dispatch hover event
    element.dispatchEvent(new MouseEvent('mouseenter', {
      bubbles: true,
      cancelable: true,
      view: window
    }))
    
    await this.delay()
  }
  
  /**
   * Get the current page title from data-testid="page-title" or h1 tags
   */
  async getCurrentPageTitle(): Promise<string | null> {
    try {
      // First try data-testid
      const titleElement = await this.waitForElement('[data-testid="page-title"]', 1000)
      return titleElement.textContent || null
    } catch {
      // Fallback to h1 tags
      try {
        const h1 = await this.waitForElement('h1', 1000)
        return h1.textContent || null
      } catch {
        // Try h2 as another fallback
        try {
          const h2 = await this.waitForElement('h2', 1000)
          return h2.textContent || null
        } catch {
          return null
        }
      }
    }
  }
  
  /**
   * Wait for a specific page to load by title
   */
  async waitForPage(expectedTitle: string, timeout: number = 10000): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      const currentTitle = await this.getCurrentPageTitle()
      if (currentTitle && currentTitle.includes(expectedTitle)) {
        // Page loaded, wait a bit for React to finish rendering
        await this.delay(500)
        return
      }
      await this.delay(100)
    }
    
    // Timeout - capture current state for debugging
    const currentTitle = await this.getCurrentPageTitle()
    await this.takeScreenshot('page-not-found')
    throw new Error(`Page "${expectedTitle}" not found. Current page: "${currentTitle || 'unknown'}"`)
  }
  
  /**
   * Wait for modal to open
   */
  async waitForModalToOpen(timeout: number = 5000): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      // Check if any modal is visible
      const modals = document.querySelectorAll('[role="dialog"], .modal, [data-testid*="modal"], .modal-overlay')
      console.log(`[Modal Detection] Found ${modals.length} potential modals`)
      
      const visibleModal = Array.from(modals).find(modal => {
        const style = window.getComputedStyle(modal as HTMLElement)
        const rect = modal.getBoundingClientRect()
        const isVisible = style.display !== 'none' && 
                         style.visibility !== 'hidden' && 
                         style.opacity !== '0' &&
                         rect.width > 0 &&
                         rect.height > 0
        
        if (isVisible) {
          console.log('[Modal Detection] Found visible modal:', {
            element: modal.tagName,
            classes: modal.className,
            role: modal.getAttribute('role'),
            dimensions: `${rect.width}x${rect.height}`,
            content: (modal.textContent || '').substring(0, 100)
          })
        }
        
        return isVisible
      })
      
      if (visibleModal) {
        // Modal is visible, wait a bit for animation to complete
        await this.delay(300)
        return
      }
      
      await this.delay(100)
    }
    
    throw new Error('Modal did not open within timeout')
  }
  
  /**
   * Wait for modal to close
   */
  async waitForModalToClose(timeout: number = 10000): Promise<void> {
    const startTime = Date.now()
    console.log('[Modal Detection] Waiting for modal to close...')
    
    while (Date.now() - startTime < timeout) {
      // Check if any modal is visible
      const modals = document.querySelectorAll('[role="dialog"], .modal, [data-testid*="modal"], .modal-overlay')
      
      const visibleModal = Array.from(modals).find(modal => {
        const style = window.getComputedStyle(modal as HTMLElement)
        const rect = modal.getBoundingClientRect()
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               rect.width > 0 &&
               rect.height > 0
      })
      
      if (visibleModal) {
        // Check if there's a loading indicator
        const loadingIndicators = visibleModal.querySelectorAll('.spinner, .loading, [class*="loading"], [class*="spinner"]')
        if (loadingIndicators.length > 0) {
          console.log('[Modal Detection] Loading indicator found, waiting...')
        }
        
        // Log current modal state
        const inputField = visibleModal.querySelector('input[data-testid="project-name-input"]')
        console.log('[Modal Detection] Modal still visible:', {
          hasInput: !!inputField,
          inputValue: inputField ? (inputField as HTMLInputElement).value : 'N/A',
          modalText: (visibleModal.textContent || '').substring(0, 100)
        })
      } else {
        // No visible modals, we're done
        console.log('[Modal Detection] No visible modals found, modal closed successfully')
        await this.delay(300)
        return
      }
      
      await this.delay(500) // Check every 500ms
    }
    
    // Don't use Escape key as it cancels the operation
    console.log('[Modal Detection] Timeout waiting for modal to close')
    
    // Check one more time if there's an error message
    const errorElements = document.querySelectorAll('.error, .alert-error, [class*="error"]')
    if (errorElements.length > 0) {
      const errorText = Array.from(errorElements).map(el => el.textContent).join(', ')
      throw new Error(`Modal did not close - possible error: ${errorText}`)
    }
    
    throw new Error('Modal did not close within timeout')
  }
  
  /**
   * Check if a specific modal is open by its title
   */
  async isModalOpen(title: string): Promise<boolean> {
    const modals = document.querySelectorAll('[role="dialog"], .modal')
    for (const modal of Array.from(modals)) {
      const style = window.getComputedStyle(modal as HTMLElement)
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        const modalText = modal.textContent || ''
        if (modalText.includes(title)) {
          return true
        }
      }
    }
    return false
  }
  
  /**
   * Try to close modal using various methods
   */
  async tryCloseModal(): Promise<boolean> {
    // Try escape key
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))
    await this.delay(300)
    
    // Try clicking backdrop
    const backdrop = document.querySelector('.modal-backdrop, .modal-overlay, [class*="overlay"]')
    if (backdrop instanceof HTMLElement) {
      backdrop.click()
      await this.delay(300)
    }
    
    // Try clicking close button
    const closeButtons = document.querySelectorAll('[aria-label*="close"], [aria-label*="Close"], .modal-close, button[class*="close"]')
    for (const button of Array.from(closeButtons)) {
      if (button instanceof HTMLElement) {
        const rect = button.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          button.click()
          await this.delay(300)
          break
        }
      }
    }
    
    // Check if modal is still open
    const modals = document.querySelectorAll('[role="dialog"], .modal')
    const stillOpen = Array.from(modals).some(modal => {
      const style = window.getComputedStyle(modal as HTMLElement)
      return style.display !== 'none' && style.visibility !== 'hidden'
    })
    
    return !stillOpen
  }
  
  /**
   * Debug helper to log current page structure
   */
  async debugPageStructure(): Promise<void> {
    console.log('=== Current Page Structure ===')
    
    // Log page title
    const title = await this.getCurrentPageTitle()
    console.log('Page Title:', title || 'Not found')
    
    // Log current URL
    console.log('URL:', window.location.href)
    
    // Log visible buttons
    const buttons = document.querySelectorAll('button:not([disabled])')
    console.log('Visible Buttons:', Array.from(buttons).map(b => ({
      text: b.textContent?.trim(),
      testId: b.getAttribute('data-testid'),
      id: b.id
    })))
    
    // Log input fields
    const inputs = document.querySelectorAll('input, textarea, select')
    console.log('Input Fields:', Array.from(inputs).map(i => ({
      type: i.tagName.toLowerCase(),
      testId: i.getAttribute('data-testid'),
      id: i.id,
      placeholder: (i as HTMLInputElement).placeholder
    })))
    
    console.log('=== End Page Structure ===')
  }
  
  cleanup(): void {
    if (this.pointerElement) {
      this.pointerElement.remove()
      this.pointerElement = null
    }
  }

  // Alias methods for compatibility with fullWorkflowAutomation
  async click(selector: string): Promise<void> {
    return this.clickButton(selector)
  }

  async pressKey(key: string): Promise<void> {
    const activeElement = document.activeElement as HTMLElement
    if (!activeElement) return

    const event = new KeyboardEvent('keydown', {
      key,
      code: `Key${key.toUpperCase()}`,
      bubbles: true,
      cancelable: true
    })
    activeElement.dispatchEvent(event)
    
    await this.delay(50)
    
    activeElement.dispatchEvent(new KeyboardEvent('keyup', {
      key,
      code: `Key${key.toUpperCase()}`,
      bubbles: true,
      cancelable: true
    }))
  }

  async executeScript(script: () => void): Promise<void> {
    script()
    await this.delay(100)
  }

  async waitForModal(timeout: number = 5000): Promise<void> {
    return this.waitForModalToOpen(timeout)
  }
}