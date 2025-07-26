import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

Given('Tauri app is running with WebDriver', async function () {
  // This is handled by the BeforeAll hook in tauriHooks.ts
  // Just verify we have a page
  expect(this.page).toBeDefined()
})

When('I check the window title', async function () {
  // Wait for the page to be ready
  await this.page.waitForLoadState('domcontentloaded')
  this.title = await this.page.title()
})

Then('it should be {string}', async function (expectedTitle: string) {
  expect(this.title).toBe(expectedTitle)
})

Then('the app should be responsive', async function () {
  // Check if the React app is mounted
  const appMounted = await this.page.evaluate(() => {
    const root = document.querySelector('#root')
    return root && root.children.length > 0
  })
  
  expect(appMounted).toBeTruthy()
  
  // Check if we can see the main content
  const hasContent = await this.page.evaluate(() => {
    return document.body.textContent?.length > 0
  })
  
  expect(hasContent).toBeTruthy()
})