import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

When('I navigate and check console', async function () {
  // Capture console messages
  const consoleLogs: string[] = []
  
  this.page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`
    consoleLogs.push(text)
    console.log('Browser console:', text)
  })
  
  // Navigate
  const url = this.baseUrl || 'http://localhost:1420'
  console.log(`🚀 Navigating to ${url}...`)
  await this.page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 10000
  })
  
  // Wait a bit for logs
  await this.page.waitForTimeout(2000)
  
  // Store logs
  this.consoleLogs = consoleLogs
})

Then('I log what happened', async function () {
  console.log('\n📋 Console logs captured:')
  this.consoleLogs?.forEach(log => console.log(log))
  
  // Check environment
  const env = await this.page.evaluate(() => {
    return {
      metaEnv: (window as any).import?.meta?.env || {},
      hasTauri: typeof window.__TAURI__ !== 'undefined',
      hasInvoke: typeof window.__TAURI__?.invoke === 'function'
    }
  })
  
  console.log('\n🔍 Environment state:', env)
  
  // Get visible text
  const text = await this.page.evaluate(() => document.body.innerText)
  console.log('\n📄 Page text:', text.substring(0, 200))
  
  // Take screenshot
  const screenshot = await this.page.screenshot()
  this.attach(screenshot, 'image/png')
  
  expect(true).toBe(true)
})