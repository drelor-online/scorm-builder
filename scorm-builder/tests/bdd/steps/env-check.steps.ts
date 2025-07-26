import { When, Then } from '@cucumber/cucumber'

When('I check the environment setup', async function () {
  const url = this.baseUrl || 'http://localhost:1420'
  console.log('🔍 Testing with URL:', url)
  console.log('🔍 Environment BASE_URL:', process.env.BASE_URL)
  
  // Capture console logs during navigation
  const consoleLogs = []
  this.page.on('console', msg => {
    if (msg.type() === 'log') {
      consoleLogs.push(msg.text())
    }
  })
  
  // Navigate and inject mock immediately
  await this.page.goto(url, { waitUntil: 'domcontentloaded' })
  
  // Wait a bit for logs
  await this.page.waitForTimeout(1000)
  
  console.log('🔍 Console logs during load:')
  consoleLogs.forEach(log => console.log('  ', log))
})

Then('I log the environment state', async function () {
  // Check if mock Tauri was set up
  const tauriState = await this.page.evaluate(() => {
    return {
      hasTauri: typeof window.__TAURI__ !== 'undefined',
      hasInvoke: typeof window.__TAURI__?.invoke === 'function',
      windowKeys: Object.keys(window).filter(k => k.includes('TAURI'))
    }
  })
  
  console.log('🔍 Tauri state:', tauriState)
  
  // Take screenshot
  const screenshot = await this.page.screenshot()
  this.attach(screenshot, 'image/png')
})