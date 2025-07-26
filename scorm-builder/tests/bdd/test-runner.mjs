import { chromium } from '@playwright/test'

async function runTest() {
  console.log('Starting browser...')
  const browser = await chromium.launch({ headless: false })
  
  console.log('Creating context...')
  const context = await browser.newContext()
  
  console.log('Creating page...')
  const page = await context.newPage()
  
  // Capture console messages
  page.on('console', msg => {
    console.log(`Browser ${msg.type()}: ${msg.text()}`)
  })
  
  page.on('pageerror', error => {
    console.log('Page error:', error.message)
  })
  
  // Capture failed requests
  page.on('requestfailed', request => {
    console.log('Failed request:', request.url(), '-', request.failure()?.errorText)
  })
  
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('Error response:', response.url(), '-', response.status())
    }
  })
  
  console.log('Navigating to app...')
  await page.goto('http://localhost:1420', {
    waitUntil: 'networkidle'
  })
  
  console.log('Waiting for React to mount...')
  // Wait for React to render something in the root div
  await page.waitForFunction(() => {
    const root = document.getElementById('root')
    return root && root.children.length > 0
  }, { timeout: 10000 })
  
  console.log('Waiting additional time...')
  await page.waitForTimeout(2000)
  
  console.log('Looking for form...')
  const form = page.locator('[data-testid="course-seed-input-form"]')
  const isVisible = await form.isVisible()
  console.log('Form visible:', isVisible)
  
  if (!isVisible) {
    console.log('Page content:', await page.content())
  }
  
  console.log('Closing browser...')
  await browser.close()
}

runTest().catch(console.error)