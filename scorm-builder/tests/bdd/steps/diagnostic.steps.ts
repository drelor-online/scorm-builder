import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

When('I navigate and wait for page load', async function () {
  console.log('🔍 Starting diagnostic navigation...')
  
  const url = this.baseUrl || 'http://localhost:1420'
  
  // Navigate to the page
  await this.page.goto(url, {
    waitUntil: 'networkidle',
    timeout: 30000
  })
  
  // Wait a bit more for React to render
  await this.page.waitForTimeout(5000)
  
  console.log('✅ Navigation complete')
})

Then('I take a screenshot', async function () {
  const screenshot = await this.page.screenshot({ 
    fullPage: true,
    path: 'tests/bdd/diagnostic-screenshot.png'
  })
  this.attach(screenshot, 'image/png')
  console.log('📸 Screenshot saved')
})

Then('I log the page state', async function () {
  // Get page title
  const title = await this.page.title()
  console.log('Page title:', title)
  
  // Check for mock Tauri
  const mockStatus = await this.page.evaluate(() => {
    return {
      hasTauri: typeof window.__TAURI__ !== 'undefined',
      hasInvoke: typeof window.__TAURI__?.invoke === 'function',
      mode: (window as any).import?.meta?.env?.MODE || 'unknown'
    }
  })
  console.log('Mock Tauri status:', mockStatus)
  
  // Get all visible text
  const visibleText = await this.page.evaluate(() => {
    return document.body.innerText || 'No text found'
  })
  console.log('Visible text on page:')
  console.log('---')
  console.log(visibleText.substring(0, 500))
  console.log('---')
  
  // Check for specific elements
  const elements = {
    root: await this.page.locator('#root').count(),
    dashboard: await this.page.locator('text=My Projects').count(),
    seedForm: await this.page.locator('[data-testid="course-seed-input-form"]').count(),
    errorDialog: await this.page.locator('text=Storage Initialization Failed').count(),
    anyButton: await this.page.locator('button').count(),
    anyInput: await this.page.locator('input').count(),
    anyForm: await this.page.locator('form').count()
  }
  console.log('Element counts:', elements)
  
  // Check for console errors
  console.log('Console errors:', this.consoleErrors?.length || 0)
  if (this.consoleErrors?.length > 0) {
    console.log('First few errors:', this.consoleErrors.slice(0, 3))
  }
  
  // Get page HTML structure
  const htmlStructure = await this.page.evaluate(() => {
    const root = document.getElementById('root')
    if (!root) return 'No root element found'
    
    // Get first few levels of DOM
    const getStructure = (el: Element, depth: number = 0): string => {
      if (depth > 3) return ''
      
      const indent = '  '.repeat(depth)
      const tag = el.tagName.toLowerCase()
      const id = el.id ? `#${el.id}` : ''
      const classes = el.className ? `.${el.className.split(' ').join('.')}` : ''
      const testId = el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : ''
      
      let result = `${indent}<${tag}${id}${classes}${testId}>\n`
      
      if (el.children.length > 0 && depth < 3) {
        for (let i = 0; i < Math.min(el.children.length, 5); i++) {
          result += getStructure(el.children[i], depth + 1)
        }
      }
      
      return result
    }
    
    return getStructure(root)
  })
  console.log('DOM Structure:')
  console.log(htmlStructure)
  
  // Log current URL
  console.log('Current URL:', this.page.url())
  
  // Check network activity
  const failedRequests: string[] = []
  this.page.on('requestfailed', request => {
    failedRequests.push(`${request.failure()?.errorText}: ${request.url()}`)
  })
  
  if (failedRequests.length > 0) {
    console.log('Failed requests:', failedRequests)
  }
  
  // Final assertion to make test pass
  expect(true).toBe(true)
})