import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

// Back button navigation
When('I click the Back button', async function() {
  const backButton = this.page.locator('[data-testid="back-button"], button:has-text("← Back"), button:has-text("Back")')
  await expect(backButton.first()).toBeVisible({ timeout: 5000 })
  await backButton.first().click()
  await this.page.waitForTimeout(500)
})

// Create project and navigate to specific step
When('I create a project and navigate to step {int}', { timeout: 30000 }, async function(stepNumber: number) {
  // Click Create New Project if we're on the dashboard
  const createButton = this.page.locator('button:has-text("Create New Project")')
  if (await createButton.count() > 0) {
    await createButton.click()
    await this.page.waitForTimeout(1000)
    
    // Handle dialog
    await this.page.waitForSelector('.new-project-form', { timeout: 5000 })
    await this.page.fill('input[placeholder="Enter project name"]', 'Navigation Test')
    const dialogCreateButton = this.page.locator('.modal-actions button:has-text("Create")')
    await dialogCreateButton.click()
  }
  
  // Wait for Course Seed Input form
  await this.page.waitForSelector('[data-testid="course-seed-input-form"]', { timeout: 10000 })
  
  // Fill minimal course data
  await this.page.fill('[data-testid="course-title-input"]', 'Navigation Test Course')
  await this.page.fill('[data-testid="topics-textarea"]', 'Topic 1\nTopic 2')
  await this.waitHelpers.waitForAutoSave()
  
  // Navigate to desired step
  for (let i = 1; i < stepNumber; i++) {
    await this.page.click('[data-testid="next-button"]')
    await this.page.waitForTimeout(1000)
    
    // Handle skip buttons for steps that need them
    if (i === 2) { // AI Prompt step
      const skipButton = this.page.locator('button:has-text("Skip")')
      if (await skipButton.count() > 0) {
        await skipButton.first().click()
        await this.page.waitForTimeout(500)
      }
    }
  }
})

// Create project with minimal data
When('I create a project with minimal data', async function() {
  // Click Create New Project if we're on the dashboard
  const createButton = this.page.locator('button:has-text("Create New Project")')
  if (await createButton.count() > 0) {
    await createButton.click()
    await this.page.waitForTimeout(1000)
  }
  
  // Now we should be on Course Seed Input
  await this.page.waitForSelector('[data-testid="course-seed-input-form"]', { timeout: 10000 })
  
  // Fill minimal required data
  await this.page.fill('[data-testid="course-title-input"]', 'Minimal Course')
  await this.page.fill('[data-testid="topics-textarea"]', 'Topic 1')
  await this.waitHelpers.waitForAutoSave()
})

// Click on step indicator
When('I click on step indicator {string}', async function(stepNumber: string) {
  const stepIndicator = this.page.locator(`[data-testid="step-indicator-${stepNumber}"], [data-step="${stepNumber}"]`).first()
  await expect(stepIndicator).toBeVisible({ timeout: 5000 })
  await stepIndicator.click()
  await this.page.waitForTimeout(1000)
})

// Refresh the page
When('I refresh the page', async function() {
  await this.page.reload()
})

// Make changes to AI prompt
When('I make changes to the AI prompt', async function() {
  const promptTextarea = this.page.locator('textarea').first()
  const currentValue = await promptTextarea.inputValue()
  await promptTextarea.fill(currentValue + '\n\nAdditional instructions...')
})

// Click dashboard link
When('I click the dashboard link', async function() {
  const dashboardLink = this.page.locator('[data-testid="dashboard-link"], a:has-text("Dashboard"), button:has-text("Dashboard")')
  await dashboardLink.first().click()
  await this.page.waitForTimeout(1000)
})

// Edit content of module
When('I edit the content of module {int}', async function(moduleNumber: number) {
  const contentEditor = this.page.locator(`[data-testid="module-${moduleNumber}-content"], textarea`).first()
  await contentEditor.fill('Edited content for module ' + moduleNumber)
})

// Try to navigate to dashboard
When('I try to navigate to the dashboard', async function() {
  const dashboardLink = this.page.locator('[data-testid="dashboard-link"], a:has-text("Dashboard"), button:has-text("Dashboard")')
  await dashboardLink.first().click()
  // Don't wait for navigation as we expect a dialog
})

// Press keyboard shortcut
When('I press {string}', async function(shortcut: string) {
  await this.page.keyboard.press(shortcut)
  await this.page.waitForTimeout(500)
})

// Navigate through all steps using skip buttons
When('I navigate through all steps using skip buttons', async function() {
  const steps = [
    { button: 'Skip AI Generation', waitFor: 'JSON Import' },
    { button: 'Skip JSON Import', waitFor: 'Course Content' },
    { button: 'Skip Content', waitFor: 'Audio Narration' },
    { button: 'Skip Narration', waitFor: 'Media' },
    { button: 'Skip Media', waitFor: 'Activities' },
    { button: 'Skip Activities', waitFor: 'Export' }
  ]
  
  for (const step of steps) {
    const skipButton = this.page.locator(`button:has-text("${step.button}"), button:has-text("Skip")`).first()
    if (await skipButton.count() > 0) {
      await skipButton.click()
      await this.page.waitForTimeout(1000)
    } else {
      // Try clicking Next if no skip button
      await this.page.click('[data-testid="next-button"]')
      await this.page.waitForTimeout(1000)
    }
  }
})

// Verify data persistence
Then('the course data should be preserved', async function() {
  // Check if course title is still there
  const titleInput = this.page.locator('[data-testid="course-title-input"]')
  if (await titleInput.count() > 0) {
    const titleValue = await titleInput.inputValue()
    expect(titleValue).toBeTruthy()
  } else {
    // Check if title is displayed elsewhere
    const titleDisplay = await this.page.locator('text=/Course:.*\\w+/').count()
    expect(titleDisplay).toBeGreaterThan(0)
  }
})

// See browser warning
Then('I should see a browser warning about unsaved changes', async function() {
  // This is handled by browser's beforeunload event
  // In tests, we can't easily verify this, so we'll check for our custom dialog
  const dialog = this.page.locator('[role="dialog"]:has-text("unsaved changes")')
  await expect(dialog).toBeVisible({ timeout: 5000 })
})

// See project in list
Then('I should see {string} in the project list', async function(projectName: string) {
  const projectItem = this.page.locator(`text="${projectName}"`)
  await expect(projectItem).toBeVisible({ timeout: 5000 })
})

// Click project to resume - removed duplicate, using the one from complete-e2e.steps.ts
// When('I click {string}', async function(text: string) {
//   await this.page.click(`text="${text}"`)
//   await this.page.waitForTimeout(1000)
// })

// Removed - duplicate of course-seed-input.steps.ts

// Confirmation dialog
Then('I should see a confirmation dialog {string}', async function(message: string) {
  const dialog = this.page.locator(`[role="dialog"]:has-text("${message}")`)
  await expect(dialog).toBeVisible({ timeout: 5000 })
})

// Removed - duplicate of basic-navigation.steps.ts

// Remain on step
Then('I should remain on the {string} step', async function(stepName: string) {
  await this.waitHelpers.waitForStepTransition(stepName.toLowerCase().replace(/\s+/g, '-'))
})

// Removed - duplicate of course-seed-input.steps.ts

// Remain on form
Then('I should remain on the Course Seed Input form', async function() {
  const form = this.page.locator('[data-testid="course-seed-input-form"]')
  await expect(form).toBeVisible()
})

// Project should be saved
Then('the project should be saved', async function() {
  // Look for save indicator or success message
  const saveIndicator = this.page.locator('[data-testid="save-indicator"]:has-text("Saved"), text="Project saved"')
  await expect(saveIndicator.first()).toBeVisible({ timeout: 5000 })
})

// All steps marked as completed
Then('all steps should be marked as completed', async function() {
  // Check step indicators for completed state
  for (let i = 1; i <= 7; i++) {
    const stepIndicator = this.page.locator(`[data-testid="step-indicator-${i}"][data-completed="true"], [data-step="${i}"].completed`)
    await expect(stepIndicator.first()).toBeVisible()
  }
})