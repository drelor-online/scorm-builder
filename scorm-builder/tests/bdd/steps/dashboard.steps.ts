import { Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

Then('I should see the dashboard', async function () {
  // Wait for dashboard elements
  await this.page.waitForLoadState('domcontentloaded')
  
  // Check for dashboard indicators
  const dashboardTitle = this.page.locator('h1:has-text("SCORM Builder Projects")')
  await expect(dashboardTitle).toBeVisible({ timeout: 5000 })
  
  // Verify dashboard container
  const dashboard = this.page.locator('.dashboard-container')
  await expect(dashboard).toBeVisible()
})