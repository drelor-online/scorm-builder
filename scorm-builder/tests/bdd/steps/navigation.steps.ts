import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

// Improved Next button handler that doesn't timeout
When('I click Next and wait for navigation', async function() {
  const nextButton = this.page.locator('[data-testid="next-button"]')
  
  // Ensure button exists and is enabled
  await expect(nextButton).toBeVisible({ timeout: 5000 })
  await expect(nextButton).toBeEnabled({ timeout: 5000 })
  
  // Get current URL/step before clicking
  const currentUrl = this.page.url()
  
  // Click without waiting for navigation (to avoid timeout)
  await nextButton.click({ timeout: 5000 })
  
  // Wait for any of these conditions indicating navigation happened
  await Promise.race([
    // URL changed
    this.page.waitForURL(url => url !== currentUrl, { timeout: 5000 }).catch(() => {}),
    // Step indicator changed
    this.page.waitForSelector('[data-current-step]:not([data-current-step="seed"])', { timeout: 5000 }).catch(() => {}),
    // New content appeared
    this.page.waitForSelector('text="AI Prompt Generator"', { timeout: 5000 }).catch(() => {}),
    this.page.waitForSelector('text="JSON Import"', { timeout: 5000 }).catch(() => {}),
    // Or just wait a bit
    this.page.waitForTimeout(2000)
  ])
})

// Alternative Next button click that's more forgiving
When('I click Next without waiting', async function() {
  // Try multiple selectors
  const selectors = [
    '[data-testid="next-button"]',
    'button:has-text("Next →")',
    'button:has-text("Next")',
    'button >> text=/Next/i'
  ]
  
  let clicked = false
  for (const selector of selectors) {
    try {
      const button = this.page.locator(selector).first()
      if (await button.isVisible({ timeout: 1000 })) {
        await button.click({ timeout: 5000 })
        clicked = true
        break
      }
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!clicked) {
    throw new Error('Could not find Next button with any selector')
  }
  
  // Just wait a moment, don't wait for navigation
  await this.page.waitForTimeout(500)
})

// Check if we're on a specific step
Then('I should be on the {string} step', async function(stepName: string) {
  // Map step names to expected content
  const stepIndicators: Record<string, string[]> = {
    'AI Prompt Generator': ['AI Prompt Generator', 'Generate a comprehensive AI prompt'],
    'JSON Import': ['JSON Import', 'Import Validator', 'Paste your AI-generated JSON'],
    'Course Content Editor': ['Course Content Editor', 'Edit Course Content'],
    'Audio Narration': ['Audio Narration', 'Narration Wizard'],
    'Media Library': ['Media Library', 'Media Enhancement'],
    'Export SCORM': ['Export SCORM', 'SCORM Package Builder']
  }
  
  const indicators = stepIndicators[stepName]
  if (!indicators) {
    throw new Error(`Unknown step name: ${stepName}`)
  }
  
  // Wait for any of the indicators to appear
  let found = false
  for (const indicator of indicators) {
    try {
      await this.page.waitForSelector(`text="${indicator}"`, { timeout: 3000 })
      found = true
      break
    } catch (e) {
      // Try next indicator
    }
  }
  
  if (!found) {
    // Get current page content for debugging
    const bodyText = await this.page.locator('body').innerText()
    throw new Error(`Not on ${stepName} step. Current page content: ${bodyText.substring(0, 200)}...`)
  }
})