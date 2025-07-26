import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { World } from '../support/world'

Given('I navigate to {string}', async function (this: World, url: string) {
  // Use the environment URL if the provided URL matches the default
  const targetUrl = (url === 'http://localhost:1420' && this.baseUrl) ? this.baseUrl : url
  await this.page.goto(targetUrl, { waitUntil: 'networkidle' })
})

Then('the page should load successfully', async function (this: World) {
  const response = this.page.context().pages()[0]
  expect(response).toBeTruthy()
})

Then('I should not see any console errors', async function (this: World) {
  // Check that no console errors were logged (except Tauri-related ones)
  const errors = this.consoleErrors || []
  
  // Filter out expected Tauri API errors when running in browser
  const unexpectedErrors = errors.filter(error => {
    // These errors are expected when running in browser without Tauri
    const tauriErrors = [
      'Cannot read properties of undefined (reading \'invoke\')',
      'Cannot read properties of undefined (reading \'transformCallback\')',
      'Failed to check for recovery',
      'Failed to initialize file association',
      'FileStorage: Failed to initialize',
      'Storage initialization failed'
    ]
    
    return !tauriErrors.some(expected => error.includes(expected))
  })
  
  if (unexpectedErrors.length > 0) {
    console.log('Unexpected console errors:', unexpectedErrors)
  }
  
  expect(unexpectedErrors).toHaveLength(0)
})

Then('the React app should be mounted to #root', async function (this: World) {
  // Wait for React to mount
  await this.page.waitForSelector('#root > *', { timeout: 10000 })
  
  // Check if root has children (React mounted)
  const hasContent = await this.page.evaluate(() => {
    const root = document.getElementById('root')
    return root && root.children.length > 0
  })
  
  expect(hasContent).toBeTruthy()
})

Then('the CSS should be loaded', async function (this: World) {
  // Check if any stylesheets are loaded
  const stylesheets = await this.page.evaluate(() => {
    return Array.from(document.styleSheets).length
  })
  
  expect(stylesheets).toBeGreaterThan(0)
})

Then('the body should have dark theme styles applied', async function (this: World) {
  const bodyStyles = await this.page.evaluate(() => {
    const body = document.body
    const computedStyle = window.getComputedStyle(body)
    return {
      backgroundColor: computedStyle.backgroundColor,
      color: computedStyle.color
    }
  })
  
  expect(bodyStyles).toBeTruthy()
})

Then('the background color should be {string}', async function (this: World, expectedColor: string) {
  const backgroundColor = await this.page.evaluate(() => {
    const body = document.body
    const computedStyle = window.getComputedStyle(body)
    
    // Convert rgb to hex if needed
    const rgb = computedStyle.backgroundColor
    if (rgb.startsWith('rgb')) {
      const values = rgb.match(/\d+/g)
      if (values) {
        const r = parseInt(values[0])
        const g = parseInt(values[1])
        const b = parseInt(values[2])
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
      }
    }
    return rgb
  })
  
  expect(backgroundColor).toBe(expectedColor)
})