import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

When('I open the application URL', async function () {
  const url = this.baseUrl || 'http://localhost:1420'
  await this.page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
})

// Removed - duplicate of health-check.steps.ts

Then('I should see the main container', async function () {
  // Check for the root div or any main container
  const rootElement = this.page.locator('#root')
  await expect(rootElement).toBeVisible({ timeout: 5000 })
  
  // Check if there's any content
  const content = await rootElement.textContent()
  expect(content).not.toBe('')
})