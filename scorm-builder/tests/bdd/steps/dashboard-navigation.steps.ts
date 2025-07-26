import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

Given('I am on the dashboard page', async function () {
  const url = this.baseUrl || 'http://localhost:1420'
  await this.page.goto(url)
  
  // Wait for dashboard to load
  await this.page.waitForLoadState('domcontentloaded')
  await this.page.waitForTimeout(1000) // Give React time to render
  
  // The app might show either the dashboard or go straight to Course Seed Input
  // Check which one we're on
  const dashboardExists = await this.page.locator('text=SCORM Builder Projects').count() > 0
  if (!dashboardExists) {
    // No dashboard found, already on Course Seed Input
  }
})

// Removed - this is already defined in common.steps.ts

Then('I should see the Course Seed Input form', async function () {
  // Wait for navigation to complete and form to appear
  await this.page.waitForLoadState('networkidle')
  await this.page.waitForTimeout(1000) // Give React time to render
  
  // Wait for the form to appear - use multiple possible selectors
  const formSelectors = [
    '[data-testid="course-seed-input-form"]',
    'form[aria-label="Course Seed Input"]',
    '.course-seed-input-form',
    'h2:has-text("Course Seed Input")'
  ]
  
  let formFound = false
  for (const selector of formSelectors) {
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 })
      formFound = true
      break
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!formFound) {
    // Log current page state for debugging
    const bodyText = await this.page.locator('body').innerText()
    // Page content captured for debugging
    throw new Error('Course Seed Input form not found')
  }
  
  // Verify form elements are visible
  const titleInput = await this.page.locator('[data-testid="course-title-input"]').isVisible()
  expect(titleInput).toBe(true)
})