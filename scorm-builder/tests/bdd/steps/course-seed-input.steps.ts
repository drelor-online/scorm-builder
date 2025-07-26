import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { CourseSeedInputPage } from '../pages/CourseSeedInputPage'
import { AppPage } from '../pages/AppPage'

let appPage: AppPage
let courseSeedInputPage: CourseSeedInputPage

Given('I am on the Course Seed Input step', async function () {
  appPage = new AppPage(this.page, this.baseUrl)
  courseSeedInputPage = new CourseSeedInputPage(this.page)
  await appPage.navigate()
  await appPage.waitForStep('seed')
})

Given('the application is in a clean state', async function () {
  await this.page.evaluate(() => {
    localStorage.clear()
    indexedDB.deleteDatabase('ScormBuilder')
  })
})

When('I enter {string} as the course title', async function (title: string) {
  // Initialize page object if not already done
  if (!courseSeedInputPage) {
    courseSeedInputPage = new CourseSeedInputPage(this.page)
  }
  await courseSeedInputPage.enterTitle(title)
})

When('I select {string} as the template', async function (template: string) {
  await courseSeedInputPage.selectTemplate(template)
})

When('I leave the course title empty', async function () {
  await courseSeedInputPage.clearTitle()
})

When('I clear all topics', async function () {
  await courseSeedInputPage.enterTopics('')
})

When('I set the difficulty level to {int}', async function (level: number) {
  await courseSeedInputPage.setDifficulty(level)
})

When('I add the topic {string}', async function (topic: string) {
  await courseSeedInputPage.addTopic(topic)
})

When('I try to add the topic {string} again', async function (topic: string) {
  await courseSeedInputPage.addTopic(topic)
})

When('I do not add any topics', async function () {
  // No action needed - just don't add topics
})

When('I click the Next button', { timeout: 10000 }, async function () {
  // If we're using the page object pattern
  if (courseSeedInputPage && typeof courseSeedInputPage.clickNext === 'function') {
    await courseSeedInputPage.clickNext()
  } else {
    // Direct implementation
    const nextButton = this.page.locator('[data-testid="next-button"]')
    
    // Wait for button to be visible and enabled
    await nextButton.waitFor({ state: 'visible', timeout: 5000 })
    await expect(nextButton).toBeEnabled({ timeout: 5000 })
    
    // Click without waiting for navigation
    await nextButton.click({ noWaitAfter: true })
    
    // Wait a bit for navigation to start
    await this.page.waitForTimeout(2000)
  }
})

When('I add template topics', async function () {
  await courseSeedInputPage.addTemplateTopics()
})

// Removed - duplicate in complete-e2e.steps.ts
// When('I click the {string} button', async function (buttonText: string) {
//   await courseSeedInputPage.clickButton(buttonText)
// })

When('I enter the following topics:', async function (dataTable) {
  const topics = dataTable.rows().map(row => row[0])
  await courseSeedInputPage.enterTopics(topics)
})

When('I enter valid course details', async function () {
  await courseSeedInputPage.enterTitle('Test Course')
  await courseSeedInputPage.enterTopics(['Introduction', 'Main Content', 'Summary'])
})

When('I add a valid topic', async function () {
  await courseSeedInputPage.addTopic('Test Topic')
})

When('I add {int} different topics', async function (count: number) {
  for (let i = 1; i <= count; i++) {
    await courseSeedInputPage.addTopic(`Topic ${i}`)
  }
})

When('I try to add another topic', async function () {
  await courseSeedInputPage.addTopic('Topic 21')
})

When('I enter a course title with {int} characters', async function (length: number) {
  const longTitle = 'a'.repeat(length)
  await courseSeedInputPage.enterTitle(longTitle)
})

When('I try to proceed to the next step', async function () {
  await courseSeedInputPage.clickNext()
})

When('I submit the course seed form', async function () {
  // Try submitting the form directly
  const form = this.page.locator('[data-testid="course-seed-input-form"]')
  const formExists = await form.count()
  
  if (formExists > 0) {
    // First try clicking the Next button
    const nextButton = this.page.locator('[data-testid="next-button"]')
    if (await nextButton.count() > 0) {
      await nextButton.click()
      
      // Wait for potential navigation
      await this.page.waitForTimeout(2000)
      
      // Check if we're still on the same page
      const stillOnSamePage = await this.page.locator('[data-testid="course-seed-input-form"]').count() > 0
    }
  }
})

When('I enter {int} topics', async function (count: number) {
  const topics = Array.from({ length: count }, (_, i) => `Topic ${i + 1}`)
  await courseSeedInputPage.enterTopics(topics)
})

When('I enter a topic with {int} characters', async function (length: number) {
  const longTopic = 'a'.repeat(length)
  await courseSeedInputPage.addTopic(longTopic)
})

// Removed - duplicate in complete-e2e.steps.ts

Then('I should proceed to the AI Prompt Generator step', async function () {
  await appPage.waitForStep('ai-prompt')
})

Then('the course data should be saved', async function () {
  const savedData = await this.page.evaluate(() => {
    return JSON.parse(localStorage.getItem('courseSeedData') || '{}')
  })
  expect(savedData.title).toBeTruthy()
  expect(savedData.audience).toBeTruthy()
  expect(savedData.topics).toHaveLength(1)
})

Then('I should see an error {string}', async function (errorMessage: string) {
  const errorElement = await courseSeedInputPage.getErrorMessage()
  expect(errorElement).toContain(errorMessage)
})

Then('I should remain on the Course Seed Input step', async function () {
  await appPage.waitForStep('seed')
})

Then('the Next button should be enabled', async function () {
  // Initialize page object if not already done
  if (!courseSeedInputPage) {
    courseSeedInputPage = new CourseSeedInputPage(this.page)
  }
  
  // Wait a moment for React to update
  await this.page.waitForTimeout(500)
  
  // Debug the actual button state
  const nextButton = this.page.locator('[data-testid="next-button"]')
  const exists = await nextButton.count()
  
  if (exists > 0) {
    const isEnabled = await nextButton.isEnabled()
    const isDisabled = await nextButton.isDisabled()
    const disabledAttr = await nextButton.getAttribute('disabled')
    const ariaDisabled = await nextButton.getAttribute('aria-disabled')
    
    
    // Also check via page object
    const pageObjectEnabled = await courseSeedInputPage.isNextButtonEnabled()
    
    expect(isEnabled).toBe(true)
  } else {
    throw new Error('Next button not found on page')
  }
})

Then('I should see {int} topics in the list', async function (count: number) {
  const topics = await courseSeedInputPage.getTopicCount()
  expect(topics).toBe(count)
})

Then('I should see only {int} topic in the list', async function (count: number) {
  const topics = await courseSeedInputPage.getTopicCount()
  expect(topics).toBe(count)
})

Then('the topics should include {string} and {string}', async function (topic1: string, topic2: string) {
  const topics = await courseSeedInputPage.getTopics()
  expect(topics).toContain(topic1)
  expect(topics).toContain(topic2)
})

Then('the course title should be {string}', async function (expectedTitle: string) {
  const title = await courseSeedInputPage.getTitle()
  expect(title).toBe(expectedTitle)
})

Then('the selected template should be {string}', async function (expectedTemplate: string) {
  const template = await courseSeedInputPage.getSelectedTemplate()
  expect(template).toBe(expectedTemplate)
})

// Add topics to the course
When('I enter topics:', async function (dataTable) {
  const topics = dataTable.raw().flat()
  const topicsText = topics.join('\n')
  const topicsTextarea = this.page.locator('[data-testid="topics-textarea"]')
  await topicsTextarea.clear()
  await topicsTextarea.fill(topicsText)
})

// Verify number of topics entered
Then('I should have {int} topics entered', async function (expectedCount: number) {
  const topicsText = await this.page.locator('[data-testid="topics-textarea"]').inputValue()
  const topics = topicsText.split('\n').map(t => t.trim()).filter(t => t.length > 0)
  expect(topics.length).toBe(expectedCount)
})

// Select difficulty level
When('I select difficulty level {int}', async function (level: number) {
  await this.page.click(`[data-testid="difficulty-${level}"]`)
})

Then('the difficulty level should be {int}', async function (expectedLevel: number) {
  const difficulty = await courseSeedInputPage.getDifficulty()
  expect(difficulty).toBe(expectedLevel)
})

Then('I should see {int} predefined topics', async function (count: number) {
  const topics = await courseSeedInputPage.getTopicCount()
  expect(topics).toBe(count)
})

Then('the course title should be truncated to {int} characters', async function (maxLength: number) {
  const title = await courseSeedInputPage.getTitle()
  expect(title.length).toBe(maxLength)
})

Then('the Next button should be disabled', async function () {
  const isEnabled = await courseSeedInputPage.isNextButtonEnabled()
  expect(isEnabled).toBe(false)
})

Then('I should have {int} topics in total', async function (expectedCount: number) {
  const count = await courseSeedInputPage.getTopicCount()
  expect(count).toBe(expectedCount)
})

Then('I should see the auto-save indicator showing {string}', async function (status: string) {
  const saveStatus = await courseSeedInputPage.getAutoSaveStatus()
  expect(saveStatus).toBe(status)
})

Then('after save completes I should see {string}', async function (status: string) {
  await this.page.waitForTimeout(1000) // Wait for save to complete
  const saveStatus = await courseSeedInputPage.getAutoSaveStatus()
  expect(saveStatus).toBe(status)
})

Then('the form should pass validation', async function () {
  const isEnabled = await courseSeedInputPage.isNextButtonEnabled()
  expect(isEnabled).toBe(true)
})

Then('the course data should contain:', async function (dataTable) {
  const expectedData = dataTable.hashes()[0]
  const actualData = {
    title: await courseSeedInputPage.getTitle(),
    template: await courseSeedInputPage.getSelectedTemplate(),
    difficulty: (await courseSeedInputPage.getDifficulty()).toString(),
    topics: (await courseSeedInputPage.getTopicCount()).toString()
  }
  
  for (const [field, value] of Object.entries(expectedData)) {
    expect(actualData[field.toLowerCase()]).toBe(value)
  }
})

Then('the title input should have error styling', async function () {
  const titleInput = this.page.locator('[data-testid="course-title-input"]')
  const hasErrorClass = await titleInput.evaluate((el) => {
    return el.classList.contains('error') || 
           el.classList.contains('is-invalid') || 
           el.classList.contains('has-error')
  })
  expect(hasErrorClass).toBe(true)
})

Then('the title should be truncated to {int} characters', async function (maxLength: number) {
  const title = await courseSeedInputPage.getTitle()
  expect(title.length).toBeLessThanOrEqual(maxLength)
})