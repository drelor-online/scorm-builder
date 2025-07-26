import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

// Click Create button in new project dialog
When('I click the Create button in the new project dialog', async function () {
  // Wait for the button to be enabled
  const createButton = this.page.locator('.modal-actions button:has-text("Create")')
  
  // Wait for button to be enabled (project name must be entered)
  await expect(createButton).toBeEnabled({ timeout: 5000 })
  
  // Click the button
  await createButton.click()
  
  // Wait for dialog to close and navigation to happen
  await this.page.waitForTimeout(2000)
})

// Alternative step for general dialog button clicks
When('I click {string} button in the dialog', async function (buttonText: string) {
  // Find button in modal actions
  const button = this.page.locator(`.modal-actions button:has-text("${buttonText}")`)
  
  // Wait for button to be visible and enabled
  await button.waitFor({ state: 'visible' })
  
  if (buttonText === 'Create') {
    // For Create button, ensure it's enabled
    await expect(button).toBeEnabled()
  }
  
  await button.click()
  
  // Wait for action to complete
  await this.page.waitForTimeout(1000)
})

// Verify dialog is open
Then('the new project dialog should be open', async function () {
  const dialog = this.page.locator('.new-project-form')
  await expect(dialog).toBeVisible()
})

// Enter project name with better handling
When('I enter {string} in the project name input', async function (projectName: string) {
  // Wait for the input to be ready
  const input = this.page.locator('.new-project-form input[placeholder="Enter project name"]')
  await input.waitFor({ state: 'visible' })
  
  // Clear any existing value
  await input.clear()
  
  // Type the project name
  await input.fill(projectName)
  
  // Verify the value was entered
  const value = await input.inputValue()
  expect(value).toBe(projectName)
})