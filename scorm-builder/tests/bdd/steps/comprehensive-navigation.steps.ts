import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

// Navigation button steps
When('I click the dashboard navigation button', async function () {
  // Try multiple selectors for the dashboard/home button
  const selectors = [
    '[data-testid="dashboard-button"]',
    '[data-testid="home-button"]',
    'button[aria-label="Go to dashboard"]',
    'a[href="/"]',
    '.nav-home'
  ]
  
  let clicked = false
  for (const selector of selectors) {
    try {
      const button = this.page.locator(selector).first()
      if (await button.count() > 0) {
        await button.click()
        clicked = true
        break
      }
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!clicked) {
    throw new Error('Could not find dashboard navigation button')
  }
})

// Confirmation dialog steps
Then('I should see a confirmation dialog {string}', async function (message: string) {
  const dialog = this.page.locator('[role="dialog"], .modal, .dialog').filter({ hasText: message })
  await expect(dialog).toBeVisible({ timeout: 5000 })
})

When('I click {string} in the dialog', async function (buttonText: string) {
  // Wait for dialog to be visible
  await this.page.waitForTimeout(500)
  
  // Find button in dialog
  const dialog = this.page.locator('[role="dialog"], .modal, .dialog').first()
  const button = dialog.locator(`button:has-text("${buttonText}")`)
  
  await expect(button).toBeVisible({ timeout: 5000 })
  await button.click()
})

Then('I should still be on the Course Seed Input form', async function () {
  await expect(this.page.locator('[data-testid="course-seed-input-form"]')).toBeVisible()
})

Then('I should be on the dashboard page', async function () {
  await expect(this.page.locator('[data-testid="dashboard"], h1:has-text("SCORM Builder Projects")')).toBeVisible({ timeout: 10000 })
})

// Step visibility checks
Then('I should see the JSON Import step', async function () {
  const selectors = [
    '[data-testid="json-import-form"]',
    'h2:has-text("JSON Import")',
    'text="Import Course Content"'
  ]
  
  let found = false
  for (const selector of selectors) {
    const element = this.page.locator(selector).first()
    if (await element.count() > 0) {
      found = true
      break
    }
  }
  
  expect(found).toBe(true)
})

Then('I should see the Media Enhancement step', async function () {
  const selectors = [
    '[data-testid="media-enhancement"]',
    'h2:has-text("Media Enhancement")',
    'text="Enhance Your Course with Media"'
  ]
  
  let found = false
  for (const selector of selectors) {
    const element = this.page.locator(selector).first()
    if (await element.count() > 0) {
      found = true
      break
    }
  }
  
  expect(found).toBe(true)
})

Then('I should see the Audio Narration step', async function () {
  const selectors = [
    '[data-testid="audio-narration"]',
    'h2:has-text("Audio Narration")',
    'text="Add Narration to Your Course"'
  ]
  
  let found = false
  for (const selector of selectors) {
    const element = this.page.locator(selector).first()
    if (await element.count() > 0) {
      found = true
      break
    }
  }
  
  expect(found).toBe(true)
})

Then('I should see the Activities step', async function () {
  const selectors = [
    '[data-testid="activities"]',
    'h2:has-text("Activities")',
    'h2:has-text("Interactive Activities")',
    'text="Create Course Activities"'
  ]
  
  let found = false
  for (const selector of selectors) {
    const element = this.page.locator(selector).first()
    if (await element.count() > 0) {
      found = true
      break
    }
  }
  
  expect(found).toBe(true)
})

Then('I should see the SCORM Export step', async function () {
  const selectors = [
    '[data-testid="scorm-export"]',
    'h2:has-text("SCORM Export")',
    'h2:has-text("Export SCORM Package")',
    'text="Export Your Course"'
  ]
  
  let found = false
  for (const selector of selectors) {
    const element = this.page.locator(selector).first()
    if (await element.count() > 0) {
      found = true
      break
    }
  }
  
  expect(found).toBe(true)
})

// Skip button steps
When('I click "Skip AI Generation"', async function () {
  const selectors = [
    'button:has-text("Skip AI Generation")',
    'button:has-text("Skip AI")',
    'button:has-text("Skip")',
    '[data-testid="skip-ai-button"]'
  ]
  
  let clicked = false
  for (const selector of selectors) {
    try {
      const button = this.page.locator(selector).first()
      if (await button.count() > 0 && await button.isVisible()) {
        await button.click()
        clicked = true
        break
      }
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!clicked) {
    throw new Error('Could not find Skip AI Generation button')
  }
})

When('I click "Skip JSON Import"', async function () {
  const selectors = [
    'button:has-text("Skip JSON Import")',
    'button:has-text("Skip JSON")',
    'button:has-text("Skip")',
    '[data-testid="skip-json-button"]'
  ]
  
  let clicked = false
  for (const selector of selectors) {
    try {
      const button = this.page.locator(selector).first()
      if (await button.count() > 0 && await button.isVisible()) {
        await button.click()
        clicked = true
        break
      }
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!clicked) {
    throw new Error('Could not find Skip JSON Import button')
  }
})

When('I click "Skip Media"', async function () {
  const selectors = [
    'button:has-text("Skip Media")',
    'button:has-text("Skip media")',
    'button:has-text("Skip")',
    '[data-testid="skip-media-button"]'
  ]
  
  let clicked = false
  for (const selector of selectors) {
    try {
      const button = this.page.locator(selector).first()
      if (await button.count() > 0 && await button.isVisible()) {
        await button.click()
        clicked = true
        break
      }
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!clicked) {
    throw new Error('Could not find Skip Media button')
  }
})

When('I click "Skip Narration"', async function () {
  const selectors = [
    'button:has-text("Skip Narration")',
    'button:has-text("Skip narration")',
    'button:has-text("Skip Audio")',
    'button:has-text("Skip")',
    '[data-testid="skip-narration-button"]'
  ]
  
  let clicked = false
  for (const selector of selectors) {
    try {
      const button = this.page.locator(selector).first()
      if (await button.count() > 0 && await button.isVisible()) {
        await button.click()
        clicked = true
        break
      }
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!clicked) {
    throw new Error('Could not find Skip Narration button')
  }
})

When('I click "Skip Activities"', async function () {
  const selectors = [
    'button:has-text("Skip Activities")',
    'button:has-text("Skip activities")',
    'button:has-text("Skip")',
    '[data-testid="skip-activities-button"]'
  ]
  
  let clicked = false
  for (const selector of selectors) {
    try {
      const button = this.page.locator(selector).first()
      if (await button.count() > 0 && await button.isVisible()) {
        await button.click()
        clicked = true
        break
      }
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!clicked) {
    throw new Error('Could not find Skip Activities button')
  }
})

// Error simulation
When('I trigger a mock save error', async function () {
  // Inject an error into the mock
  await this.page.evaluate(() => {
    window.__MOCK_NEXT_SAVE_ERROR__ = true
  })
  
  // Try to save
  const saveButton = this.page.locator('[data-testid="save-button"], button:has-text("Save")')
  if (await saveButton.count() > 0) {
    await saveButton.click()
  }
})

Then('I should see an error notification', async function () {
  const errorSelectors = [
    '[data-testid="error-notification"]',
    '.error-notification',
    '.toast-error',
    '[role="alert"]'
  ]
  
  let found = false
  for (const selector of errorSelectors) {
    const element = this.page.locator(selector).first()
    if (await element.count() > 0) {
      found = true
      break
    }
  }
  
  expect(found).toBe(true)
})

// Keyboard navigation
When('I press {string}', async function (keys: string) {
  await this.page.keyboard.press(keys)
  // Wait for navigation animation
  await this.page.waitForTimeout(500)
})

// Step indicator navigation
When('I click on step indicator {string}', async function (stepNumber: string) {
  const selectors = [
    `[data-testid="step-${stepNumber}"]`,
    `[data-testid="step-indicator-${stepNumber}"]`,
    `.step-indicator:nth-child(${stepNumber})`,
    `[aria-label="Step ${stepNumber}"]`
  ]
  
  let clicked = false
  for (const selector of selectors) {
    try {
      const indicator = this.page.locator(selector).first()
      if (await indicator.count() > 0) {
        await indicator.click()
        clicked = true
        break
      }
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!clicked) {
    throw new Error(`Could not find step indicator ${stepNumber}`)
  }
  
  // Wait for navigation
  await this.page.waitForTimeout(1000)
})

// Page refresh
When('I refresh the page', async function () {
  await this.page.reload()
  // Wait for page to load
  await this.page.waitForLoadState('domcontentloaded')
  await this.page.waitForTimeout(1000)
})

// Debug navigation (kept minimal for troubleshooting)
When('I click the Next button with debug', async function () {
  const nextButton = this.page.locator('[data-testid="next-button"]')
  const exists = await nextButton.count()
  
  if (exists > 0) {
    // Check if enabled
    const isEnabled = await nextButton.isEnabled()
    if (!isEnabled) {
      throw new Error('Next button is not enabled')
    }
    
    // Try to click
    await nextButton.click({ timeout: 5000 })
    
    // Wait a bit
    await this.page.waitForTimeout(2000)
  } else {
    throw new Error('Next button not found')
  }
})

Then('I should see one of these:', async function (dataTable) {
  const options = dataTable.rows().map(row => row[0])
  let found = false
  
  for (const text of options) {
    const element = this.page.locator(`text="${text}"`)
    if (await element.count() > 0) {
      found = true
      break
    }
  }
  
  if (!found) {
    throw new Error(`None of the expected texts found: ${options.join(', ')}`)
  }
})