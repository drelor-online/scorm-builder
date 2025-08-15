import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

Given('I navigate to the application', async function () {
  const url = this.baseUrl || 'http://localhost:1420'
  
  try {
    await this.page.goto(url, { timeout: 10000 })
    await this.page.waitForLoadState('domcontentloaded')
    // Wait a bit for React to render
    await this.page.waitForTimeout(2000)
  } catch (error) {
    throw error
  }
})

Then('I should see the Dashboard', async function () {
  // Check for dashboard container
  const dashboard = await this.page.locator('.dashboard-container').isVisible()
  expect(dashboard).toBe(true)
})

Then('I should see {string} heading', async function (headingText: string) {
  const heading = await this.page.locator(`h1:has-text("${headingText}")`).isVisible()
  expect(heading).toBe(true)
})

Then('I should see {string} button', async function (buttonText: string) {
  const button = await this.page.locator(`button:has-text("${buttonText}")`).isVisible()
  expect(button).toBe(true)
})

Then('I should see a dialog with title {string}', async function (title: string) {
  // Wait for dialog to appear
  await this.page.waitForSelector('.modal-overlay, [role="dialog"]', { timeout: 5000 })
  
  // Check for title in dialog
  const dialogTitle = await this.page.locator(`h2:has-text("${title}"), h3:has-text("${title}")`).isVisible()
  expect(dialogTitle).toBe(true)
})

Then('I should see the Course Seed Input step', async function () {
  // Check for the form
  const form = this.page.locator('[data-testid="course-seed-input-form"]')
  await expect(form).toBeVisible({ timeout: 10000 })
})

Then('the form should have a course title input', async function () {
  const titleInput = this.page.locator('[data-testid="course-title-input"]')
  await expect(titleInput).toBeVisible()
})

// Removed - duplicate of course-seed-input.steps.ts

// Removed - duplicate definition in course-seed-input.steps.ts
// Then('the Next button should be enabled', async function () {
//   const nextButton = this.page.locator('[data-testid="next-button"]')
//   await expect(nextButton).toBeEnabled()
// })

// Removed - this is defined in course-seed-input.steps.ts

// Removed - duplicate definition above handles this

When('I enter {string} as the project name', async function (projectName: string) {
  // Wait for the dialog to appear
  await this.page.waitForSelector('.new-project-form', { timeout: 5000 })
  
  // Find the project name input
  const projectInput = this.page.locator('input[placeholder="Enter project name"]')
  await projectInput.waitFor({ state: 'visible' })
  await projectInput.fill(projectName)
})

When('I click {string} in the dialog', { timeout: 10000 }, async function (buttonText: string) {
  // Wait for the dialog buttons
  await this.page.waitForTimeout(500)
  
  // For other dialogs, use the original logic
  // Wait a moment for dialog to appear
  await this.page.waitForTimeout(1000)
  
  // Try to find any visible button with the text
  const button = this.page.locator(`button:has-text("${buttonText}")`).first()
  
  try {
    // Wait for button to be visible
    await button.waitFor({ state: 'visible', timeout: 5000 })
    await button.click()
  } catch (error) {
    // If that fails, try finding button in dialog containers
    const dialogSelectors = [
      '[role="dialog"]',
      '.modal-content',
      '.dialog-content',
      '.modal',
      '[data-testid="dialog"]',
      '.overlay-content'
    ]
    
    let clicked = false
    for (const selector of dialogSelectors) {
      try {
        const dialog = this.page.locator(selector)
        if (await dialog.count() > 0) {
          const dialogButton = dialog.locator(`button:has-text("${buttonText}")`)
          if (await dialogButton.count() > 0) {
            await dialogButton.first().click()
            clicked = true
            break
          }
        }
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!clicked) {
      // Last resort - click any visible button with the text
      const anyButton = this.page.locator(`text="${buttonText}"`).first()
      await anyButton.click()
    }
  }
})

// Removed duplicate - this is defined in course-seed-input.steps.ts

// Common missing steps
Given('I have a clean project state', async function () {
  // Reset application state
  await this.page.evaluate(() => {
    // Clear localStorage
    localStorage.clear()
    // Clear sessionStorage
    sessionStorage.clear()
  })
  
  // Navigate to fresh application
  const url = this.baseUrl || 'http://localhost:1420'
  await this.page.goto(url, { timeout: 10000 })
  await this.page.waitForLoadState('domcontentloaded')
  await this.page.waitForTimeout(1000)
})

Given('I have valid API keys configured', async function () {
  // Set up test API keys in localStorage or environment
  await this.page.evaluate(() => {
    localStorage.setItem('VITE_GOOGLE_IMAGE_API_KEY', 'test_api_key')
    localStorage.setItem('VITE_GOOGLE_CSE_ID', 'test_cse_id')
    localStorage.setItem('VITE_YOUTUBE_API_KEY', 'test_youtube_key')
  })
})