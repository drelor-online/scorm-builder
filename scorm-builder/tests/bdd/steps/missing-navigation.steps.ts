import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

// Clean browser state
Given('I have a clean browser state', async function () {
  // Navigate to the page first to ensure we have access
  await this.page.goto(this.baseUrl || 'http://localhost:1420')
  
  try {
    // Clear any storage
    await this.page.evaluate(() => {
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch (e) {
        // Could not clear storage
      }
    })
  } catch (e) {
    // Storage clearing skipped
  }
  
  // Clear cookies
  await this.page.context().clearCookies()
})

// Clean project state (alternative step name)
Given('I have a clean project state', async function () {
  // Navigate to the page first to ensure we have access
  await this.page.goto(this.baseUrl || 'http://localhost:1420')
  
  try {
    // Clear any storage including project data
    await this.page.evaluate(() => {
      try {
        localStorage.clear()
        sessionStorage.clear()
        // Clear any mock project data
        window.__MOCK_PROJECT_DATA__ = undefined
        window.__MOCK_CURRENT_PROJECT_ID__ = undefined
        window.__MOCK_PROJECT_FILE_PATH__ = undefined
      } catch (e) {
        // Could not clear storage
      }
    })
  } catch (e) {
    // Storage clearing skipped
  }
  
  // Clear cookies
  await this.page.context().clearCookies()
})

// Application running
Given('the application is running at {string}', async function (url: string) {
  this.baseUrl = url
  await this.page.goto(url)
  await this.page.waitForLoadState('domcontentloaded')
})

// Completed steps
Given('I have completed steps {int} through {int}', { timeout: 30000 }, async function (startStep: number, endStep: number) {
  // Navigate to the app
  await this.page.goto(this.baseUrl || 'http://localhost:1420')
  await this.page.waitForLoadState('domcontentloaded')
  
  // Click Create New Project
  const createButton = this.page.locator('button:has-text("Create New Project")')
  await createButton.waitFor({ state: 'visible', timeout: 10000 })
  await createButton.click()
  await this.page.waitForTimeout(1000)
  
  // Fill Course Seed Input (step 1)
  await this.page.waitForSelector('[data-testid="course-seed-input-form"]', { timeout: 10000 })
  await this.page.fill('[data-testid="course-title-input"]', 'Test Course')
  await this.page.fill('[data-testid="topics-textarea"]', 'Topic 1\nTopic 2\nTopic 3')
  
  // Wait for auto-save
  await this.page.waitForTimeout(1500)
  
  // Navigate through steps
  for (let i = 1; i < endStep; i++) {
    const nextButton = this.page.locator('[data-testid="next-button"]')
    await nextButton.waitFor({ state: 'visible' })
    await nextButton.click()
    await this.page.waitForTimeout(1500)
    
    // Handle skip buttons for certain steps
    if (i === 1) { // After seed input, we're on AI Prompt
      const skipButton = this.page.locator('button:has-text("Skip")')
      if (await skipButton.count() > 0) {
        await skipButton.first().click()
        await this.page.waitForTimeout(1000)
      }
    } else if (i === 2) { // After AI Prompt, we're on JSON Import
      const skipButton = this.page.locator('button:has-text("Skip")')
      if (await skipButton.count() > 0) {
        await skipButton.first().click()
        await this.page.waitForTimeout(1000)
      }
    }
  }
})

// Click on step in progress indicator
When('I click on step {int} in the progress indicator', async function (stepNumber: number) {
  const stepIndicator = this.page.locator(`[data-testid="step-${stepNumber}"], [data-step="${stepNumber}"]`).first()
  await stepIndicator.click()
  await this.page.waitForTimeout(1000)
})

// Previous data preserved
Then('my previous data should be preserved', async function () {
  // Check that course title is still there
  const titleInput = this.page.locator('[data-testid="course-title-input"]')
  if (await titleInput.count() > 0) {
    const value = await titleInput.inputValue()
    expect(value).toBe('Test Course')
  }
})

// Validated JSON present
Then('the validated JSON should still be present', async function () {
  // Check for JSON content or validation status
  const jsonContent = this.page.locator('[data-testid="json-content"], [data-testid="json-textarea"]')
  await expect(jsonContent.first()).toBeVisible()
})

// Modified prompt
When('I modify the prompt', async function () {
  const promptTextarea = this.page.locator('textarea').first()
  const currentValue = await promptTextarea.inputValue()
  await promptTextarea.fill(currentValue + '\n\nAdditional instructions for testing.')
})

// Choose to discard changes
When('I choose to discard changes', async function () {
  // Find and click the discard button in the dialog
  await this.page.click('button:has-text("Discard")')
  await this.page.waitForTimeout(500)
})

// Return to previous step
When('I return to {string}', async function (stepName: string) {
  // Click next to go back to the step
  await this.page.click('[data-testid="next-button"]')
  await this.page.waitForTimeout(1000)
})

// Original prompt restored
Then('the original prompt should be restored', async function () {
  const promptTextarea = this.page.locator('textarea').first()
  const value = await promptTextarea.inputValue()
  // Check that the additional text we added is not there
  expect(value).not.toContain('Additional instructions for testing.')
})

// Removed - duplicate of complete-e2e.steps.ts

// Should see topics listed
Then('I should see the topics listed', async function () {
  // Check for topic display
  const topics = await this.page.locator('[data-testid="topic-item"], .topic-item').count()
  expect(topics).toBeGreaterThan(0)
})

// JSON validation starts automatically
Then('the JSON validation should start automatically', async function () {
  // Check for validation indicator
  await this.page.waitForSelector('[data-testid="validation-status"], text="Validating"', { timeout: 5000 })
})

// Course modules ready
Then('I should see course modules ready for editing', async function () {
  // Check for module tabs or content areas
  const modules = await this.page.locator('[data-testid^="module-"], .module-tab').count()
  expect(modules).toBeGreaterThan(0)
})

// Navigation disabled while generating
Then('navigation should be disabled while generating', async function () {
  // Check that navigation buttons are disabled
  const nextButton = this.page.locator('[data-testid="next-button"]')
  const backButton = this.page.locator('[data-testid="back-button"]')
  
  await expect(nextButton).toBeDisabled()
  await expect(backButton).toBeDisabled()
})

// Package generation complete
Then('the package generation should complete', async function () {
  // Wait for success message
  await this.page.waitForSelector('text="Package generated successfully"', { timeout: 30000 })
})

// Download dialog appears
Then('a download dialog should appear', async function () {
  // Check for download dialog or success message
  const downloadDialog = this.page.locator('[data-testid="download-dialog"], text="Download"')
  await expect(downloadDialog.first()).toBeVisible()
})

// Automatically skip to step
Then('I should automatically skip to the {string} step', async function (stepName: string) {
  // Verify we're on the expected step
  await this.waitHelpers.waitForStepTransition(stepName.toLowerCase().replace(/\s+/g, '-'))
})

// Continue to next step
When('I continue to the next step', async function () {
  await this.page.click('[data-testid="next-button"]')
  await this.page.waitForTimeout(1000)
})