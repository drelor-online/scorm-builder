import { When, Then } from '@cucumber/cucumber'
import { World } from '../support/world'
import fs from 'fs/promises'
import path from 'path'

// Helper function to capture debug info
async function captureDebugInfo(world: any, name: string) {
  if (!world.page) {
    throw new Error('Page not initialized')
  }

  try {
    // Create screenshots directory if it doesn't exist
    const screenshotsDir = path.join(process.cwd(), 'test-results', 'screenshots')
    await fs.mkdir(screenshotsDir, { recursive: true }).catch(() => {})
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 50)
    
    // Take screenshot
    const screenshotPath = path.join(screenshotsDir, `${timestamp}-${safeName}.png`)
    await world.page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    })
    console.log(`📸 Screenshot saved: ${screenshotPath}`)
    
    // Capture HTML
    const htmlPath = path.join(screenshotsDir, `${timestamp}-${safeName}.html`)
    const html = await world.page.content()
    await fs.writeFile(htmlPath, html)
    console.log(`📄 HTML saved: ${htmlPath}`)
    
    // Capture console logs if available
    if (world.consoleErrors && world.consoleErrors.length > 0) {
      const logsPath = path.join(screenshotsDir, `${timestamp}-${safeName}-console.txt`)
      const logs = world.consoleErrors.join('\n')
      await fs.writeFile(logsPath, logs)
      console.log(`📝 Console logs saved: ${logsPath}`)
    }
    
    // Capture page state
    const stateInfo = {
      url: world.page.url(),
      title: await world.page.title(),
      timestamp: new Date().toISOString(),
      viewport: world.page.viewportSize(),
      consoleErrors: world.consoleErrors || []
    }
    
    const statePath = path.join(screenshotsDir, `${timestamp}-${safeName}-state.json`)
    await fs.writeFile(statePath, JSON.stringify(stateInfo, null, 2))
    console.log(`📊 State info saved: ${statePath}`)
    
  } catch (error) {
    console.error('Failed to capture debug info:', error)
  }
}

When('I debug network errors', async function (this: World) {
  // Log all failed network requests
  const failedRequests: any[] = []
  
  this.page.on('requestfailed', request => {
    failedRequests.push({
      url: request.url(),
      failure: request.failure()
    })
  })
  
  // Wait a bit to capture any failures
  await this.page.waitForTimeout(2000)
  
  console.log('Failed requests:', failedRequests)
})

When('I wait for the storage error screen', async function (this: World) {
  await this.page.waitForSelector('text=Storage Initialization Failed', { timeout: 5000 })
})

// Removed - duplicate in complete-e2e.steps.ts
// When('I click the {string} button', async function (this: World, buttonText: string) {
//   await this.page.click(`button:has-text("${buttonText}")`)
//   await this.page.waitForTimeout(2000) // Wait for any effects
// })

Then('I should see what resources failed to load', async function (this: World) {
  // Get all network logs
  const failedResources = await this.page.evaluate(() => {
    const entries = performance.getEntriesByType('resource')
    return entries.filter((entry: any) => entry.responseStatus >= 400).map((entry: any) => ({
      name: entry.name,
      status: entry.responseStatus
    }))
  })
  
  console.log('Failed resources from performance API:', failedResources)
  
  // Also check for any CSS loading errors
  const cssLoadingErrors = await this.page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    return links.map(link => ({
      href: link.getAttribute('href'),
      loaded: (link as HTMLLinkElement).sheet !== null
    }))
  })
  
  console.log('CSS loading status:', cssLoadingErrors)
})

// Enhanced screenshot function using the helper
Then('I take a screenshot named {string}', async function (this: World, name: string) {
  await captureDebugInfo(this, name)
})

// Take a screenshot with current page info
When('I capture the current page state', async function () {
  const stepName = this.currentScenario?.pickle?.name || 'unknown-step'
  await captureDebugInfo(this, `debug-${stepName}`)
})

// Capture screenshot before a specific action
When('I take a screenshot before {string}', async function (action: string) {
  await captureDebugInfo(this, `before-${action}`)
})

// Capture screenshot after a specific action
When('I take a screenshot after {string}', async function (action: string) {
  await captureDebugInfo(this, `after-${action}`)
})

// Log current page selectors for debugging
When('I log all visible buttons', async function () {
  const buttons = await this.page.locator('button:visible, [role="button"]:visible').all()
  console.log(`Found ${buttons.length} visible buttons:`)
  
  for (let i = 0; i < buttons.length; i++) {
    try {
      const text = await buttons[i].innerText()
      const testId = await buttons[i].getAttribute('data-testid')
      const classes = await buttons[i].getAttribute('class')
      const disabled = await buttons[i].isDisabled()
      
      console.log(`  Button ${i + 1}:`)
      console.log(`    Text: "${text}"`)
      console.log(`    Test ID: ${testId || 'none'}`)
      console.log(`    Classes: ${classes || 'none'}`)
      console.log(`    Disabled: ${disabled}`)
    } catch (e) {
      console.log(`  Button ${i + 1}: Could not read properties`)
    }
  }
})

// Log all form inputs for debugging
When('I log all form inputs', async function () {
  const inputs = await this.page.locator('input:visible, textarea:visible, select:visible').all()
  console.log(`Found ${inputs.length} visible form inputs:`)
  
  for (let i = 0; i < inputs.length; i++) {
    try {
      const tagName = await inputs[i].evaluate(el => el.tagName.toLowerCase())
      const testId = await inputs[i].getAttribute('data-testid')
      const name = await inputs[i].getAttribute('name')
      const placeholder = await inputs[i].getAttribute('placeholder')
      const value = await inputs[i].inputValue()
      const type = await inputs[i].getAttribute('type')
      
      console.log(`  ${tagName} ${i + 1}:`)
      console.log(`    Test ID: ${testId || 'none'}`)
      console.log(`    Name: ${name || 'none'}`)
      console.log(`    Type: ${type || 'text'}`)
      console.log(`    Placeholder: ${placeholder || 'none'}`)
      console.log(`    Value: "${value}"`)
    } catch (e) {
      console.log(`  Input ${i + 1}: Could not read properties`)
    }
  }
})

// Check for JavaScript errors
Then('I should see no JavaScript errors', async function () {
  if (this.consoleErrors && this.consoleErrors.length > 0) {
    const errors = this.consoleErrors.join('\n')
    throw new Error(`Found ${this.consoleErrors.length} JavaScript errors:\n${errors}`)
  }
})

// Wait for and log network idle
When('I wait for network idle', async function () {
  console.log('Waiting for network idle...')
  try {
    await this.page.waitForLoadState('networkidle', { timeout: 10000 })
    console.log('✓ Network is idle')
  } catch (e) {
    console.log('⚠️ Network idle timeout - continuing anyway')
  }
})

// Debug auto-save functionality
When('I debug auto-save', async function () {
  console.log('Monitoring auto-save activity...')
  
  // Listen for save-related console logs
  const originalConsoleLog = console.log
  const saveLogs: string[] = []
  
  // Temporarily capture console logs
  console.log = (...args) => {
    const message = args.join(' ')
    if (message.includes('save') || message.includes('Save') || message.includes('SAVE')) {
      saveLogs.push(message)
    }
    originalConsoleLog(...args)
  }
  
  // Wait for auto-save delay
  await this.page.waitForTimeout(2000)
  
  // Restore console.log
  console.log = originalConsoleLog
  
  console.log('Auto-save logs captured:')
  saveLogs.forEach(log => console.log(`  - ${log}`))
})

// Export helper for use in other steps
export { captureDebugInfo }