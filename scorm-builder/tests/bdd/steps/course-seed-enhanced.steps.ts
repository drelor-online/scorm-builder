import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

// Background steps
Given('I have created a new project', async function () {
  // The app starts directly at Course Seed Input
  await this.page.waitForLoadState('domcontentloaded')
  await this.page.waitForTimeout(1000) // Give React time to render
  
  // Wait for the form to be visible
  const form = this.page.locator('[data-testid="course-seed-input-form"]')
  await form.waitFor({ state: 'visible', timeout: 10000 })
  
  // Fill in some basic data to simulate a "created" project
  await this.page.fill('[data-testid="course-title-input"]', 'Test Project')
  await this.page.fill('[data-testid="topics-textarea"]', 'Topic 1\nTopic 2')
})

// Removed - duplicate of ai-prompt-generator.steps.ts

// Validation scenarios
When('I leave the course title empty', async function () {
  const titleInput = this.page.locator('[data-testid="course-title-input"]')
  await titleInput.clear()
})

When('I add a topic {string}', async function (topicName: string) {
  // Topics are entered in a textarea, one per line
  const topicsTextarea = this.page.locator('[data-testid="topics-textarea"]')
  const currentTopics = await topicsTextarea.inputValue()
  const newTopics = currentTopics ? `${currentTopics}\n${topicName}` : topicName
  await topicsTextarea.fill(newTopics)
  await topicsTextarea.blur() // Trigger validation
})

// Removed - duplicate of complete-e2e.steps.ts

// Dynamic topics
// Removed - duplicate in course-seed-input.steps.ts

When('I remove topic {string}', async function (topicName: string) {
  const topicItem = this.page.locator(`[data-testid="topic-item"]:has-text("${topicName}")`)
  await topicItem.locator('[data-testid="remove-topic-button"]').click()
})

// Template selection
Then('I should see template topics populated', async function () {
  // Wait for template to populate
  await this.page.waitForTimeout(1000)
  const topics = await this.page.locator('[data-testid="topic-item"]').count()
  expect(topics).toBeGreaterThan(0)
})

Then('I should see at least {int} topics in the list', async function (minCount: number) {
  const topics = await this.page.locator('[data-testid="topic-item"]').count()
  expect(topics).toBeGreaterThanOrEqual(minCount)
})

// Settings validation
When('I set estimated time to {string} minutes', async function (minutes: string) {
  await this.page.fill('[data-testid="estimated-time-input"]', minutes)
})

When('I set the number of questions to {string}', async function (questions: string) {
  await this.page.fill('[data-testid="questions-input"]', questions)
})

// Removed - duplicate of complete-e2e.steps.ts

// Multiple step definitions for common actions
Given('the course seed contains:', async function (dataTable) {
  const data = dataTable.hashes()[0]
  
  if (data.Title) {
    await this.page.fill('[data-testid="course-title-input"]', data.Title)
  }
  
  if (data.Topics) {
    const topics = data.Topics.split(', ')
    for (const topic of topics) {
      await this.page.click('[data-testid="add-topic-button"]')
      const inputs = await this.page.locator('[data-testid="topic-input"]').all()
      const lastInput = inputs[inputs.length - 1]
      await lastInput.fill(topic)
    }
  }
  
  if (data.Duration) {
    const minutes = data.Duration.replace(' minutes', '')
    await this.page.fill('[data-testid="estimated-time-input"]', minutes)
  }
  
  if (data.Questions) {
    await this.page.fill('[data-testid="questions-input"]', data.Questions)
  }
})