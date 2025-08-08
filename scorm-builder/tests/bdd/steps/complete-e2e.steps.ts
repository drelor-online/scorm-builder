import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

// Background steps
Given('I have created a new project called {string}', async function (projectName: string) {
  // Click Create New Project button
  await this.page.click('button:has-text("Create New Project")')
  
  // Wait for dialog
  await this.page.waitForSelector('.new-project-form', { timeout: 5000 })
  
  // Enter project name
  await this.page.fill('input[placeholder="Enter project name"]', projectName)
  
  // Click Create button
  const createButton = this.page.locator('.modal-actions button:has-text("Create")')
  await createButton.click()
  
  // Wait for navigation to Course Seed Input
  await this.page.waitForSelector('[data-testid="course-seed-input-form"]', { timeout: 10000 })
})

// Course Seed Input steps
When('I select {string} as the template', async function (template: string) {
  await this.page.selectOption('[data-testid="template-select"]', { label: template })
})

When('I add the following topics:', async function (dataTable) {
  const topics = dataTable.hashes()
  for (const topic of topics) {
    await this.page.click('[data-testid="add-topic-button"]')
    const inputs = await this.page.locator('[data-testid="topic-input"]').all()
    const lastInput = inputs[inputs.length - 1]
    await lastInput.fill(topic['Topic Name'] || topic['name'])
  }
})

When('I set estimated time to {string} minutes', async function (minutes: string) {
  await this.page.fill('[data-testid="estimated-time-input"]', minutes)
})

When('I set the number of questions to {string}', async function (questions: string) {
  await this.page.fill('[data-testid="questions-input"]', questions)
})

Then('I should be on the JSON Import/Validator step', async function () {
  await expect(this.page.locator('[data-testid="json-import-form"]')).toBeVisible({ timeout: 10000 })
})

// JSON Import steps
When('I click {string}', { timeout: 15000 }, async function (buttonText: string) {
  // First wait for page to be ready
  await this.page.waitForLoadState('domcontentloaded')
  
  // Remove the special handling - the button exists now
  
  // Add a small delay to ensure React has rendered
  await this.page.waitForTimeout(500)
  
  try {
    // Try multiple selectors
    const selectors = [
      `button:has-text("${buttonText}")`,
      `a:has-text("${buttonText}")`,
      `[role="button"]:has-text("${buttonText}")`,
      `div:has-text("${buttonText}")`,
      `span:has-text("${buttonText}")`
    ]
    
    let clicked = false
    for (const selector of selectors) {
      try {
        const elements = await this.page.locator(selector).all()
        for (const element of elements) {
          const isVisible = await element.isVisible()
          if (isVisible) {
            await element.click({ timeout: 5000 })
            clicked = true
            break
          }
        }
        if (clicked) break
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!clicked) {
      throw new Error(`Could not find clickable element with text "${buttonText}"`)
    }
    
    // Wait a moment after click
    await this.page.waitForTimeout(500)
  } catch (error) {
    // Log current page state for debugging
    const pageTitle = await this.page.title()
    const bodyText = await this.page.locator('body').innerText()
    // Error details are captured but not logged to reduce noise
    
    throw error
  }
})

Then('I should be on the AI Prompt Generator step', async function () {
  await expect(this.page.locator('[data-testid="ai-prompt-generator"]')).toBeVisible({ timeout: 10000 })
})

// AI Prompt Generator steps
When('I review the generated prompt', async function () {
  // Wait for prompt to be generated
  await this.page.waitForSelector('[data-testid="generated-prompt"]', { timeout: 10000 })
})

When('I click "Copy Prompt"', async function () {
  await this.page.click('[data-testid="copy-prompt-button"]')
})

Then('I should be on the Course Content Editor step', async function () {
  await expect(this.page.locator('[data-testid="content-editor"]')).toBeVisible({ timeout: 10000 })
})

// Content Editor steps
When('I paste the following content for module {string}:', async function (moduleName: string, docString: string) {
  // Select the module
  await this.page.click(`[data-testid="module-tab-${moduleName}"]`)
  
  // Paste content
  const editor = this.page.locator('[data-testid="content-editor-textarea"]')
  await editor.fill(docString)
})

When('I click "Save Module"', async function () {
  await this.page.click('[data-testid="save-module-button"]')
})

Then('I should be on the Audio Narration step', async function () {
  await expect(this.page.locator('[data-testid="audio-narration"]')).toBeVisible({ timeout: 10000 })
})

// Audio Narration steps
When('I select {string}', async function (option: string) {
  await this.page.click(`button:has-text("${option}")`)
})

Then('I should be on the Media Library step', async function () {
  await expect(this.page.locator('[data-testid="media-library"]')).toBeVisible({ timeout: 10000 })
})

// Media Library steps
When('I click "Skip media for now"', async function () {
  await this.page.click('[data-testid="skip-media-button"]')
})

Then('I should be on the Export SCORM step', async function () {
  await expect(this.page.locator('[data-testid="export-scorm"]')).toBeVisible({ timeout: 10000 })
})

// Export SCORM steps
When('I select {string} as the export format', async function (format: string) {
  await this.page.click(`input[value="${format}"]`)
})

When('I set the passing score to {string}', async function (score: string) {
  await this.page.fill('[data-testid="passing-score-input"]', score)
})

// Commented out - handled by generic "I click {string}" step
// When('I click "Generate SCORM Package"', async function () {
//   await this.page.click('[data-testid="generate-scorm-button"]')
// })

Then('I should see {string}', async function (message: string) {
  await expect(this.page.locator(`text="${message}"`)).toBeVisible({ timeout: 30000 })
})

Then('a SCORM package should be saved', async function () {
  // In mock mode, we just verify the success message
  // In real mode, we'd check for file download
  await expect(this.page.locator('text=Package saved')).toBeVisible({ timeout: 10000 })
})

// Quick workflow steps
When('I add a single topic {string}', async function (topicName: string) {
  await this.page.click('[data-testid="add-topic-button"]')
  await this.page.fill('[data-testid="topic-input"]', topicName)
})

// Removed - duplicate definition in basic-navigation.steps.ts

When('I skip through all optional steps', async function () {
  // Skip JSON Import
  await this.page.click('button:has-text("Skip JSON Import")')
  await this.page.waitForSelector('[data-testid="ai-prompt-generator"]')
  
  // Skip to next after AI Prompt
  await this.page.click('button:has-text("Next")')
  await this.page.waitForSelector('[data-testid="content-editor"]')
  
  // Skip content editing
  await this.page.click('button:has-text("Next")')
  await this.page.waitForSelector('[data-testid="audio-narration"]')
  
  // Skip narration
  await this.page.click('button:has-text("Skip narration")')
  await this.page.waitForSelector('[data-testid="media-library"]')
  
  // Skip media
  await this.page.click('button:has-text("Skip media")')
})

When('I reach the Export SCORM step', async function () {
  await this.page.waitForSelector('[data-testid="export-scorm"]', { timeout: 10000 })
})

// Additional step definitions for simple E2E
When('I enter basic content for the module', async function () {
  // Wait for editor to be ready
  await this.page.waitForSelector('[data-testid="content-editor"]', { timeout: 5000 })
  
  // Find the first module's content area
  const editor = this.page.locator('[data-testid="module-content-editor"]').first()
  await editor.fill('This is basic content for the introduction module.')
})

// Debug step
When('I debug the current page state', async function () {
  // Get page title
  const title = await this.page.title()
  console.log(`Page title: ${title}`)
  
  // Get current URL
  const url = this.page.url()
  console.log(`Current URL: ${url}`)
  
  // Look for form elements
  const formExists = await this.page.locator('[data-testid="course-seed-input-form"]').isVisible()
  console.log(`Course seed form visible: ${formExists}`)
  
  // Check for course title input
  const titleInputExists = await this.page.locator('[data-testid="course-title-input"]').isVisible()
  console.log(`Course title input visible: ${titleInputExists}`)
  
  // If title input doesn't exist, check for other inputs
  if (!titleInputExists) {
    const anyInput = await this.page.locator('input').count()
    console.log(`Number of input elements on page: ${anyInput}`)
    
    // List all inputs
    const inputs = await this.page.locator('input').all()
    for (let i = 0; i < inputs.length; i++) {
      const placeholder = await inputs[i].getAttribute('placeholder')
      const testId = await inputs[i].getAttribute('data-testid')
      const id = await inputs[i].getAttribute('id')
      const name = await inputs[i].getAttribute('name')
      console.log(`Input ${i}: placeholder="${placeholder}", data-testid="${testId}", id="${id}", name="${name}"`)
    }
  }
  
  // Get a snippet of the page content
  const bodyText = await this.page.locator('body').innerText()
  console.log(`Page content preview: ${bodyText.substring(0, 500)}...`)
  
  // Check console errors
  if (this.consoleErrors && this.consoleErrors.length > 0) {
    console.log('Console errors:', this.consoleErrors)
  }
})

When('I click "Skip narration for now"', async function () {
  await this.page.click('button:has-text("Skip narration")')
})

When('I click "Skip media for now"', async function () {
  await this.page.click('button:has-text("Skip media")')
})

Then('I should see "Generating SCORM package..."', async function () {
  await expect(this.page.locator('text="Generating SCORM package..."')).toBeVisible({ timeout: 5000 })
})

// Next button handler
When('I click the "Next" button', { timeout: 10000 }, async function () {
  // Wait a moment for form validation
  await this.page.waitForTimeout(500)
  
  // Debug the button state before clicking
  const nextButton = this.page.locator('[data-testid="next-button"]')
  const exists = await nextButton.count()
  
  if (exists > 0) {
    const isEnabled = await nextButton.isEnabled()
    // Check if button is enabled
    
    // Wait for button to be enabled
    await expect(nextButton).toBeEnabled({ timeout: 5000 })
    
    // Click the button without waiting for anything
    await nextButton.click({ noWaitAfter: true })
    
    // Just wait a moment - don't wait for navigation promises
    await this.page.waitForTimeout(1000)
  } else {
    // Try alternative selectors
    const altButton = this.page.locator('button:has-text("Next →"), button:has-text("Next")').first()
    if (await altButton.count() > 0) {
      await altButton.click({ noWaitAfter: true })
      await this.page.waitForTimeout(1000)
    } else {
      throw new Error('Next button not found with any selector')
    }
  }
})

// Removed - duplicate of wait.steps.ts

// Step waiting helpers
Then('I wait for the JSON Import step', async function () {
  await this.page.waitForSelector('[data-testid="json-import-form"]', { timeout: 10000 })
})

Then('I wait for the AI Prompt step', async function () {
  await this.page.waitForSelector('[data-testid="ai-prompt-generator"]', { timeout: 10000 })
})

Then('I wait for the Content Editor step', async function () {
  await this.page.waitForSelector('[data-testid="content-editor"]', { timeout: 10000 })
})

Then('I wait for the Audio Narration step', async function () {
  await this.page.waitForSelector('[data-testid="audio-narration"]', { timeout: 10000 })
})

Then('I wait for the Media Library step', async function () {
  await this.page.waitForSelector('[data-testid="media-library"]', { timeout: 10000 })
})

Then('I wait for the Export SCORM step', async function () {
  await this.page.waitForSelector('[data-testid="export-scorm"]', { timeout: 10000 })
})

// Content editor helpers
When('I add basic content to the first module', async function () {
  // Find the first content area
  const contentArea = this.page.locator('[data-testid="module-content-editor"], textarea').first()
  await contentArea.waitFor({ state: 'visible' })
  await contentArea.fill('This is test content for the module. It contains enough text to be valid.')
})

// Skip buttons
When('I click "Skip Narration"', async function () {
  await this.page.click('button:has-text("Skip Narration"), button:has-text("Skip narration")')
})

When('I click "Skip Media"', async function () {
  await this.page.click('button:has-text("Skip Media"), button:has-text("Skip media")')
})

// Export helpers
When('I select {string} format', async function (format: string) {
  await this.page.click(`label:has-text("${format}")`)
})

// Commented out duplicate - using the definition on line 171 instead
// Then('I should see {string}', async function (text: string) {
//   await expect(this.page.locator(`text="${text}"`)).toBeVisible({ timeout: 5000 })
// })

Then('I should eventually see {string}', async function (text: string) {
  await expect(this.page.locator(`text="${text}"`)).toBeVisible({ timeout: 30000 })
})

// Keyboard interaction
When('I press Tab', async function () {
  await this.page.keyboard.press('Tab')
})

// Skip buttons with various formats
When('I click "Skip AI Generation"', async function () {
  await this.page.click('button:has-text("Skip AI Generation"), button:has-text("Skip AI"), button:has-text("Skip")')
})

When('I click "Skip JSON Import"', async function () {
  await this.page.click('button:has-text("Skip JSON Import"), button:has-text("Skip JSON"), button:has-text("Skip")')
})

// Form visibility checks
Then('I should see the AI Prompt Generator form', async function () {
  // Look for multiple possible indicators
  const possibleSelectors = [
    'h2:has-text("AI Prompt Generator")',  // This should match the PageLayout title
    'text="AI Prompt Generator"',
    '[data-testid="ai-prompt-textarea"]',  // The actual textarea
    '[data-testid="copy-prompt-button"]',   // The copy button
    'text="Generate a comprehensive AI prompt"'  // Part of the description
  ]
  
  let found = false
  for (const selector of possibleSelectors) {
    try {
      const element = this.page.locator(selector)
      const count = await element.count()
      if (count > 0) {
        await expect(element.first()).toBeVisible({ timeout: 5000 })
        found = true
        // Found AI Prompt Generator form
        break
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  if (!found) {
    // Log the page content for debugging
    const bodyText = await this.page.locator('body').innerText()
    // Page content captured for debugging
    throw new Error('AI Prompt Generator form not found')
  }
})

Then('I should see the JSON Import form', async function () {
  await expect(this.page.locator('[data-testid="json-import-form"], [data-testid="json-validator"]')).toBeVisible({ timeout: 10000 })
})

Then('I should see the Course Content Editor', async function () {
  await expect(this.page.locator('[data-testid="course-content-editor"], [data-testid="content-editor"]')).toBeVisible({ timeout: 10000 })
})

Then('I should see the Audio Narration form', async function () {
  await expect(this.page.locator('[data-testid="audio-narration-form"], [data-testid="audio-narration"]')).toBeVisible({ timeout: 10000 })
})

Then('I should see the Media Library', async function () {
  await expect(this.page.locator('[data-testid="media-library-form"], [data-testid="media-library"]')).toBeVisible({ timeout: 10000 })
})

Then('I should see the Export SCORM form', async function () {
  await expect(this.page.locator('[data-testid="export-scorm-form"], [data-testid="export-scorm"]')).toBeVisible({ timeout: 10000 })
})

// Console log capturing
When('I capture console logs', async function () {
  // Clear existing console errors
  this.consoleErrors = []
  this.consoleLogs = []
  
  // Set up console log capturing
  this.page.on('console', msg => {
    const type = msg.type()
    const text = msg.text()
    
    if (type === 'error') {
      this.consoleErrors.push(text)
    }
    
    // Capture all logs
    if (!this.consoleLogs) {
      this.consoleLogs = []
    }
    this.consoleLogs.push({ type, text })
    
    // Log important messages immediately
    if (text.includes('IMPORTANT') || text.includes('save') || text.includes('navigate')) {
      console.log(`[${type}] ${text}`)
    }
  })
  
  console.log('Console log capturing enabled')
})

Then('I check console logs for errors', async function () {
  console.log('\n=== Console Logs ===')
  if (this.consoleLogs) {
    this.consoleLogs.forEach(log => {
      console.log(`[${log.type}] ${log.text}`)
    })
  }
  
  console.log('\n=== Console Errors ===')
  if (this.consoleErrors && this.consoleErrors.length > 0) {
    this.consoleErrors.forEach(error => {
      console.log(`ERROR: ${error}`)
    })
  } else {
    console.log('No console errors found')
  }
  
  // Check current page state
  const currentUrl = this.page.url()
  const pageTitle = await this.page.title()
  const bodyText = await this.page.locator('body').innerText()
  
  console.log('\n=== Page State ===')
  console.log(`URL: ${currentUrl}`)
  console.log(`Title: ${pageTitle}`)
  console.log(`Body preview: ${bodyText.substring(0, 200)}...`)
})

// Force navigation workaround
Then('I force navigation to AI Prompt Generator', async function () {
  // Wait for any pending operations
  await this.page.waitForTimeout(1000)
  
  // Look for AI Prompt indicators regardless of what else is on the page
  console.log('Looking for AI Prompt Generator elements...')
  
  const hasPromptTextarea = await this.page.locator('[data-testid="ai-prompt-textarea"]').count() > 0
  const hasPromptTitle = await this.page.locator('h2:has-text("AI Prompt Generator")').count() > 0
  const hasCopyButton = await this.page.locator('[data-testid="copy-prompt-button"]').count() > 0
  const hasSkipButton = await this.page.locator('button:has-text("Skip AI Generation")').count() > 0
  
  console.log('AI Prompt elements found:', {
    textarea: hasPromptTextarea,
    title: hasPromptTitle,
    copyButton: hasCopyButton,
    skipButton: hasSkipButton
  })
  
  // Get page content for debugging
  const bodyText = await this.page.locator('body').innerText()
  console.log('Page contains:', bodyText.substring(0, 300))
  
  if (hasPromptTextarea || hasPromptTitle || hasCopyButton) {
    console.log('AI Prompt Generator loaded successfully!')
    return
  }
  
  // Wait a bit more and check again
  await this.page.waitForTimeout(3000)
  
  const hasPromptAfterWait = await this.page.locator('[data-testid="ai-prompt-textarea"]').count() > 0
  if (hasPromptAfterWait) {
    console.log('AI Prompt Generator loaded after additional wait')
    return
  }
  
  throw new Error('Navigation to AI Prompt Generator failed - no AI prompt elements found')
})

// Debug form validation
When('I debug the form validation state', async function () {
  // Get title value
  const titleValue = await this.page.locator('[data-testid="course-title-input"]').inputValue()
  console.log(`Course title value: "${titleValue}"`)
  console.log(`Title trimmed length: ${titleValue.trim().length}`)
  
  // Get topics value
  const topicsValue = await this.page.locator('[data-testid="topics-textarea"]').inputValue()
  console.log(`Topics textarea value: "${topicsValue}"`)
  console.log(`Topics textarea length: ${topicsValue.length}`)
  
  // Split and check topics
  const topicsArray = topicsValue.split('\n').map(t => t.trim()).filter(t => t.length > 0)
  console.log(`Topics array:`, topicsArray)
  console.log(`Number of valid topics: ${topicsArray.length}`)
  
  // Check Next button state
  const nextButton = this.page.locator('[data-testid="next-button"]')
  const isEnabled = await nextButton.isEnabled()
  const isDisabled = await nextButton.isDisabled()
  console.log(`Next button enabled: ${isEnabled}`)
  console.log(`Next button disabled: ${isDisabled}`)
  
  // Check button attributes
  const disabledAttr = await nextButton.getAttribute('disabled')
  console.log(`Next button disabled attribute: ${disabledAttr}`)
  
  // Take a screenshot for visual debugging
  await this.page.screenshot({ path: 'test-debug-form-validation.png', fullPage: true })
  
  // Try to evaluate the isFormValid function directly
  const formValidResult = await this.page.evaluate(() => {
    // Try to access React component state
    const titleInput = document.querySelector('[data-testid="course-title-input"]') as HTMLInputElement
    const topicsTextarea = document.querySelector('[data-testid="topics-textarea"]') as HTMLTextAreaElement
    
    if (titleInput && topicsTextarea) {
      const hasTitle = titleInput.value.trim().length > 0
      const topicsArray = topicsTextarea.value
        .split('\n')
        .map(topic => topic.trim())
        .filter(topic => topic.length > 0)
      const hasTopics = topicsArray.length > 0
      
      return {
        titleValue: titleInput.value,
        hasTitle,
        topicsValue: topicsTextarea.value,
        topicsArray,
        hasTopics,
        isValid: hasTitle && hasTopics
      }
    }
    return null
  })
  
  console.log('Form validation result:', formValidResult)
})