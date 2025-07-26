import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

When('I navigate to the application with debug', async function () {
  console.log('🚀 Navigating to application...')
  
  const url = this.baseUrl || 'http://localhost:1420'
  
  // Check if mock is available before navigation
  await this.page.goto(url)
  
  // Wait for any loading
  await this.page.waitForTimeout(3000)
  
  // Take screenshot
  const screenshot = await this.page.screenshot({ fullPage: true })
  this.attach(screenshot, 'image/png')
  
  // Check what's on the page
  const pageContent = await this.page.content()
  console.log('Page title:', await this.page.title())
  console.log('Page URL:', this.page.url())
  
  // Check for mock Tauri
  const hasMock = await this.page.evaluate(() => {
    return {
      hasTauri: typeof window.__TAURI__ !== 'undefined',
      hasInvoke: typeof window.__TAURI__?.invoke === 'function',
      mode: import.meta?.env?.MODE
    }
  })
  
  console.log('Mock status:', hasMock)
  
  // Check for any visible text
  const visibleText = await this.page.evaluate(() => {
    return document.body.innerText
  })
  
  console.log('Visible text:', visibleText.substring(0, 200))
})

Then('I should see what loads', async function () {
  // Check if we see dashboard or seed input
  const isDashboard = await this.page.locator('text=My Projects').isVisible().catch(() => false)
  const isSeedInput = await this.page.locator('[data-testid="course-seed-input-form"]').isVisible().catch(() => false)
  const hasError = await this.page.locator('text=Storage Initialization Failed').isVisible().catch(() => false)
  
  console.log('Dashboard visible:', isDashboard)
  console.log('Seed input visible:', isSeedInput)
  console.log('Has error:', hasError)
  
  // Check console errors
  console.log('Console errors:', this.consoleErrors)
  
  expect(isDashboard || isSeedInput || hasError).toBeTruthy()
})