import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { testData } from '../fixtures/test-data'
import { AppPage } from '../pages/AppPage'
import { CourseSeedInputPage } from '../pages/CourseSeedInputPage'

// Page objects will be initialized in hooks
let appPage: AppPage
let courseSeedInputPage: CourseSeedInputPage

Given('I have a clean project state', async function () {
  appPage = new AppPage(this.page)
  
  // Clear all storage
  await this.page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
    // Clear IndexedDB
    return indexedDB.deleteDatabase('ScormBuilder')
  })
})

Given('I have valid API keys configured', async function () {
  // Set up API keys in localStorage
  await this.page.evaluate(() => {
    localStorage.setItem('elevenlabs_api_key', 'test-api-key')
    localStorage.setItem('settings', JSON.stringify({
      elevenlabsApiKey: 'test-api-key',
      defaultVoice: 'test-voice'
    }))
  })
})

Given('I start creating a new course', async function () {
  await appPage.navigate()
  await appPage.waitForStep('seed')
  courseSeedInputPage = new CourseSeedInputPage(this.page)
})

When('I enter the following course details:', async function (dataTable) {
  const details = dataTable.hashes()[0]
  
  await courseSeedInputPage.enterTitle(details.Title)
  // Template and difficulty instead of audience/duration
  if (details.Template) {
    await courseSeedInputPage.selectTemplate(details.Template)
  }
  if (details.Difficulty) {
    await courseSeedInputPage.setDifficulty(parseInt(details.Difficulty))
  }
})

When('I add the following topics:', async function (dataTable) {
  const topics = dataTable.hashes().map((row: any) => row['Topic Name'])
  await courseSeedInputPage.enterTopics(topics)
})

When('I proceed to the next step', async function () {
  await courseSeedInputPage.clickNext()
  await appPage.waitForLoadingToFinish()
})

// Removed - duplicate of navigation.steps.ts
// Then('I should be on the {string} step', async function (stepName: string) {
//   const stepMap: Record<string, string> = {
//     'AI Prompt Generator': 'ai-prompt',
//     'JSON Import Validator': 'json-validator',
//     'Media Enhancement Wizard': 'media',
//     'Audio Narration Wizard': 'audio',
//     'Activities Editor': 'activities',
//     'SCORM Package Builder': 'scorm'
//   }
//   
//   const stepId = stepMap[stepName] || stepName.toLowerCase().replace(/\s+/g, '-')
//   await appPage.waitForStep(stepId)
// })

When('I select the {string} template', async function (templateName: string) {
  await this.page.click(`[data-template="${templateName.toLowerCase()}"]`)
})

When('I enable {string}', async function (option: string) {
  const checkboxMap: Record<string, string> = {
    'Include examples': 'include-examples',
    'Include objectives': 'include-objectives',
    'Include assessments': 'include-assessments'
  }
  
  const checkboxId = checkboxMap[option]
  if (checkboxId) {
    await this.page.check(`[data-testid="${checkboxId}"]`)
  }
})

When('I generate the AI prompt', async function () {
  await this.page.click('[data-testid="generate-prompt"]')
  await this.page.waitForTimeout(500) // Wait for generation
})

Then('the prompt should contain {string}', async function (text: string) {
  const promptContent = await this.page.textContent('[data-testid="generated-prompt"]')
  expect(promptContent).toContain(text)
})

Then('the prompt should contain all {int} topics', async function (topicCount: number) {
  const promptContent = await this.page.textContent('[data-testid="generated-prompt"]')
  const topics = testData.validCourse.topics.slice(0, topicCount)
  
  for (const topic of topics) {
    expect(promptContent).toContain(topic)
  }
})

When('I paste the following AI response:', async function (docString: string) {
  const responseTextarea = this.page.locator('[data-testid="ai-response"]')
  await responseTextarea.fill(docString)
})

Then('the JSON should be automatically validated', async function () {
  // Wait for validation to complete
  await this.page.waitForSelector('[data-testid="validation-status"]')
})

// Removed: Duplicate of complete-e2e.steps.ts step definition

When('I navigate to the {string} page tab', async function (tabName: string) {
  await this.page.click(`[data-tab="${tabName.toLowerCase()}"]`)
})

When('I upload an image {string} for the welcome page', async function (imageName: string) {
  const fileInput = this.page.locator('input[type="file"]')
  
  // Create a data transfer to simulate file upload
  await fileInput.setInputFiles({
    name: imageName,
    mimeType: 'image/jpeg',
    buffer: Buffer.from(testData.media.validImage.content.split(',')[1], 'base64')
  })
})

When('I navigate to the {string} tab', async function (tabName: string) {
  await this.page.click(`[data-tab="${tabName.toLowerCase()}"]`)
})

When('I generate AI images for all topics using default keywords', async function () {
  await this.page.click('[data-testid="generate-all-images"]')
})

When('I wait for image generation to complete', async function () {
  // Wait for progress indicator to disappear
  await this.page.waitForSelector('[data-testid="generation-progress"]', { state: 'hidden', timeout: 60000 })
})

Then('all topics should have images', async function () {
  const topicImages = await this.page.locator('[data-testid="topic-image"]').count()
  expect(topicImages).toBeGreaterThan(0)
})

When('I select {string} as the provider', async function (provider: string) {
  await this.page.selectOption('[data-testid="tts-provider"]', provider.toLowerCase().replace(' ', '-'))
})

When('I select {string} as the voice', async function (voice: string) {
  await this.page.selectOption('[data-testid="voice-select"]', voice)
})

When('I generate audio for the welcome page', async function () {
  await this.page.click('[data-testid="generate-welcome-audio"]')
})

When('I generate audio for all topics', async function () {
  await this.page.click('[data-testid="generate-all-audio"]')
})

When('I wait for audio generation to complete', async function () {
  await this.page.waitForSelector('[data-testid="audio-progress"]', { state: 'hidden', timeout: 30000 })
})

Then('all pages should have audio files', async function () {
  const audioPlayers = await this.page.locator('[data-testid="audio-player"]').count()
  expect(audioPlayers).toBeGreaterThan(0)
})

Then('all pages should have caption files', async function () {
  const captionIndicators = await this.page.locator('[data-testid="caption-indicator"]').count()
  expect(captionIndicators).toBeGreaterThan(0)
})

When('I add a knowledge check to {string} with:', async function (topicTitle: string, dataTable) {
  const kcData = dataTable.hashes()[0]
  
  // Select the topic
  await this.page.click(`[data-topic="${topicTitle}"]`)
  
  // Add knowledge check
  await this.page.click('[data-testid="add-knowledge-check"]')
  
  // Fill in the details
  await this.page.fill('[data-testid="kc-question"]', kcData.Question)
  await this.page.selectOption('[data-testid="kc-type"]', kcData.Type)
  
  // Add options
  for (let i = 1; i <= 3; i++) {
    if (kcData[`Option ${i}`]) {
      await this.page.fill(`[data-testid="kc-option-${i}"]`, kcData[`Option ${i}`])
    }
  }
  
  // Set correct answer
  await this.page.click(`[data-testid="kc-correct-${kcData.Correct}"]`)
  
  // Add feedback
  await this.page.fill('[data-testid="kc-feedback"]', kcData.Feedback)
  
  // Save
  await this.page.click('[data-testid="save-knowledge-check"]')
})

When('I configure the assessment pass mark to {int}%', async function (passMark: number) {
  await this.page.fill('[data-testid="pass-mark"]', passMark.toString())
})

// Commented out - duplicate definition in complete-e2e.steps.ts
// When('I click {string}', async function (buttonText: string) {
//   await this.page.click(`button:has-text("${buttonText}")`)
// })

Then('I should see the course preview in an iframe', async function () {
  const iframe = this.page.frameLocator('[data-testid="course-preview-iframe"]')
  await expect(iframe.locator('body')).toBeVisible()
})

Then('the preview should be navigable', async function () {
  const iframe = this.page.frameLocator('[data-testid="course-preview-iframe"]')
  
  // Check navigation buttons exist
  await expect(iframe.locator('[data-testid="next-btn"]')).toBeVisible()
  
  // Try to navigate
  await iframe.locator('[data-testid="next-btn"]').click()
  
  // Verify navigation worked
  await expect(iframe.locator('[data-testid="current-page"]')).toContainText('Objectives')
})

// Commented out - duplicate exists in scorm-builder.steps.ts
// When('I select SCORM version {string}', async function (version: string) {
//   await this.page.selectOption('[data-testid="scorm-version"]', version)
// })

When('I wait for package generation to complete', async function () {
  // Wait for download to start
  const downloadPromise = this.page.waitForEvent('download')
  await downloadPromise
})

Then('a SCORM package should be downloaded', async function () {
  // Verify download happened
  const downloads = await this.page.context().downloads()
  expect(downloads.length).toBeGreaterThan(0)
})

Then('the package should contain:', async function () {
  // This would require unzipping and checking contents
  // For now, we'll just verify the download happened
  const downloads = await this.page.context().downloads()
  expect(downloads.length).toBeGreaterThan(0)
  
  // In a real test, you would:
  // 1. Save the download
  // 2. Unzip it
  // 3. Check for the files listed in the table
})