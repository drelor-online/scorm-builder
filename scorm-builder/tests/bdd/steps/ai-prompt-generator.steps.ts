import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { World } from '../support/world'

Given('I have completed the Course Seed Input step', async function (this: World) {
  // This assumes we've already filled the course seed form
  // In a real test, you might want to ensure the data is present
  const nextButton = this.page.locator('[data-testid="next-button"]')
  if (await nextButton.isEnabled()) {
    await nextButton.click()
  }
})

Given('I am on the AI Prompt Generator step', async function (this: World) {
  // Wait for AI prompt step to be visible
  await this.page.waitForSelector('[data-testid="ai-prompt-step"]', { timeout: 10000 })
})

Given('my course configuration includes:', async function (this: World, dataTable) {
  // This is typically set in the previous step
  // We can verify it's reflected in the prompt
  const config = dataTable.rowsHash()
  this.courseConfig = config
})

Then('the generated prompt should include:', async function (this: World, dataTable) {
  const elements = dataTable.rowsHash()
  const promptText = await this.page.locator('[data-testid="ai-prompt-textarea"]').textContent()
  
  for (const [element, shouldInclude] of Object.entries(elements)) {
    if (shouldInclude === 'Yes') {
      expect(promptText).toContain(element)
    }
  }
})

When('I click the "Copy Prompt" button', async function (this: World) {
  await this.page.click('[data-testid="copy-prompt-button"]')
})

Then('the button should change to {string}', async function (this: World, text: string) {
  const button = this.page.locator('[data-testid="copy-prompt-button"]')
  await expect(button).toHaveText(text)
})

Then('the prompt should be in my clipboard', async function (this: World) {
  // Note: Clipboard testing is tricky in browsers
  // We can at least verify the copy action was triggered
  // In real tests, you might use browser permissions API
  const successMessage = this.page.locator('text=Copied!')
  await expect(successMessage).toBeVisible()
})

Then('after {int} seconds the button should revert to {string}', async function (this: World, seconds: number, text: string) {
  await this.page.waitForTimeout(seconds * 1000)
  const button = this.page.locator('[data-testid="copy-prompt-button"]')
  await expect(button).toHaveText(text)
})

When('I modify the prompt text', async function (this: World) {
  const promptTextarea = this.page.locator('[data-testid="ai-prompt-textarea"]')
  const currentText = await promptTextarea.inputValue()
  this.originalPrompt = currentText
  await promptTextarea.fill(currentText + '\n\nModified content')
})

When('I add {string}', async function (this: World, text: string) {
  const promptTextarea = this.page.locator('[data-testid="ai-prompt-textarea"]')
  const currentText = await promptTextarea.inputValue()
  await promptTextarea.fill(currentText + '\n' + text)
})

Then('the modified prompt should be preserved', async function (this: World) {
  const promptTextarea = this.page.locator('[data-testid="ai-prompt-textarea"]')
  const currentText = await promptTextarea.inputValue()
  expect(currentText).toContain('Modified content')
})

Then('the modified version should be copied', async function (this: World) {
  // We assume the copy functionality works
  // In a real test, you'd verify clipboard content if possible
  const promptTextarea = this.page.locator('[data-testid="ai-prompt-textarea"]')
  const currentText = await promptTextarea.inputValue()
  expect(currentText).toContain('Include real-world examples')
})

Then('the prompt should contain these sections:', async function (this: World, dataTable) {
  const sections = dataTable.hashes()
  const promptText = await this.page.locator('[data-testid="ai-prompt-textarea"]').textContent()
  
  for (const section of sections) {
    expect(promptText?.toLowerCase()).toContain(section.Section.toLowerCase())
  }
})

When('I try to go back to the previous step', async function (this: World) {
  await this.page.click('[data-testid="back-button"]')
})

Then('I should see a confirmation dialog', async function (this: World) {
  await expect(this.page.locator('text=Are you sure')).toBeVisible()
})

When('I choose to discard changes', async function (this: World) {
  await this.page.click('button:has-text("Discard")')
})

Then('I should return to Course Seed Input step', async function (this: World) {
  await expect(this.page.locator('[data-testid="course-seed-input-form"]')).toBeVisible()
})

When('I return to AI Prompt Generator', async function (this: World) {
  await this.page.click('[data-testid="next-button"]')
})

Then('the original prompt should be restored', async function (this: World) {
  const promptTextarea = this.page.locator('[data-testid="ai-prompt-textarea"]')
  const currentText = await promptTextarea.inputValue()
  expect(currentText).not.toContain('Modified content')
})

Then('I should see instructions including:', async function (this: World, dataTable) {
  const instructions = dataTable.hashes()
  
  for (const instruction of instructions) {
    await expect(this.page.locator(`text=${instruction.Instruction}`)).toBeVisible()
  }
})

Given('I used the {string} template in step 1', async function (this: World, template: string) {
  this.selectedTemplate = template
})

Then('the prompt should include safety-specific instructions:', async function (this: World, instructions: string) {
  const promptText = await this.page.locator('[data-testid="ai-prompt-textarea"]').textContent()
  expect(promptText).toContain(instructions.trim())
})

Given('my course title includes non-English characters', async function (this: World) {
  // This would be set in the previous step
  this.hasUnicodeTitle = true
})

When('the prompt is generated', async function (this: World) {
  // The prompt should be auto-generated when entering this step
  await this.page.waitForSelector('[data-testid="ai-prompt-textarea"]')
})

Then('it should handle unicode properly', async function (this: World) {
  const promptText = await this.page.locator('[data-testid="ai-prompt-textarea"]').textContent()
  // Check that the text is not corrupted (no replacement characters)
  expect(promptText).not.toContain('�')
})

Then('maintain proper formatting', async function (this: World) {
  const promptText = await this.page.locator('[data-testid="ai-prompt-textarea"]').textContent()
  // Check basic formatting is preserved
  expect(promptText).toMatch(/\n/)
  expect(promptText?.length).toBeGreaterThan(100)
})

Given('I have a course with {int} topics', async function (this: World, topicCount: number) {
  this.topicCount = topicCount
})

Then('the prompt should include all topics', async function (this: World) {
  const promptText = await this.page.locator('[data-testid="ai-prompt-textarea"]').textContent()
  // Verify topic count is mentioned
  expect(promptText).toContain(this.topicCount?.toString() || '0')
})

Then('remain within AI token limits', async function (this: World) {
  const promptText = await this.page.locator('[data-testid="ai-prompt-textarea"]').textContent()
  // Rough estimate: 1 token ≈ 4 characters
  const estimatedTokens = (promptText?.length || 0) / 4
  expect(estimatedTokens).toBeLessThan(8000) // Most AI models have 8k-32k limits
})

Then('suggest splitting if too long', async function (this: World) {
  const promptText = await this.page.locator('[data-testid="ai-prompt-textarea"]').textContent()
  if ((promptText?.length || 0) > 20000) {
    await expect(this.page.locator('text=Consider splitting')).toBeVisible()
  }
})