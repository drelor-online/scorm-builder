import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { World } from '../support/world'

Given('I have completed the AI Prompt Generator step', async function (this: World) {
  // Assumes we're on AI prompt step and need to proceed
  const nextButton = this.page.locator('[data-testid="next-button"]')
  if (await nextButton.isVisible() && await nextButton.isEnabled()) {
    await nextButton.click()
  }
})

Given('I am on the JSON Import Validator step', async function (this: World) {
  await this.page.waitForSelector('[data-testid="json-validator-step"]', { timeout: 10000 })
})

When('I paste valid JSON with all required fields', async function (this: World) {
  const validJSON = {
    title: "Test Course",
    welcomePage: {
      title: "Welcome",
      content: "<h1>Welcome</h1>",
      narration: "Welcome to the course",
      duration: 2
    },
    learningObjectivesPage: {
      title: "Objectives",
      content: "<h2>Objectives</h2>",
      narration: "Learning objectives",
      duration: 2
    },
    topics: [{
      id: "topic-1",
      title: "Topic 1",
      content: "<h2>Topic 1</h2>",
      narration: "Topic 1 content",
      duration: 3,
      knowledgeCheck: {
        question: "Test question?",
        options: ["A", "B", "C"],
        correctAnswer: 0,
        feedback: {
          correct: "Correct!",
          incorrect: "Try again"
        }
      }
    }],
    assessment: {
      questions: [{
        question: "Final question?",
        options: ["A", "B", "C", "D"],
        correctAnswer: 1
      }]
    }
  }
  
  const jsonTextarea = this.page.locator('[data-testid="json-input-textarea"]')
  await jsonTextarea.fill(JSON.stringify(validJSON, null, 2))
})

When('I click "Validate JSON"', async function (this: World) {
  await this.page.click('[data-testid="validate-json-button"]')
})

Then('I should see "JSON is valid! ✓"', async function (this: World) {
  await expect(this.page.locator('text=JSON is valid!')).toBeVisible()
})

Then('the validation details should show:', async function (this: World, dataTable) {
  const checks = dataTable.hashes()
  
  for (const check of checks) {
    const checkElement = this.page.locator(`text=${check.Check}`)
    await expect(checkElement).toBeVisible()
    
    // Also verify the status icon/mark is shown
    const statusElement = checkElement.locator(`../*:has-text("${check.Status}")`)
    await expect(statusElement).toBeVisible()
  }
})

When('I paste JSON with syntax errors:', async function (this: World, jsonString: string) {
  const jsonTextarea = this.page.locator('[data-testid="json-input-textarea"]')
  await jsonTextarea.fill(jsonString)
})

// Removed: Duplicate of complete-e2e.steps.ts step definition

Then('the error should highlight line {int}', async function (this: World, lineNumber: number) {
  // Check if error message mentions the line number
  const errorElement = this.page.locator('[data-testid="json-error-message"]')
  const errorText = await errorElement.textContent()
  expect(errorText).toContain(`line ${lineNumber}`)
})

When('I paste JSON with smart quotes:', async function (this: World, jsonString: string) {
  const jsonTextarea = this.page.locator('[data-testid="json-input-textarea"]')
  await jsonTextarea.fill(jsonString)
})

Then('the validator should auto-fix the quotes', async function (this: World) {
  // Wait a moment for auto-fix to occur
  await this.page.waitForTimeout(500)
  
  const jsonTextarea = this.page.locator('[data-testid="json-input-textarea"]')
  const fixedJson = await jsonTextarea.inputValue()
  
  // Check that smart quotes are replaced with regular quotes
  expect(fixedJson).not.toContain('"')
  expect(fixedJson).not.toContain('"')
})

Then('show {string}', async function (this: World, message: string) {
  await expect(this.page.locator(`text=${message}`)).toBeVisible()
})

When('I paste JSON missing the assessment section', async function (this: World) {
  const incompleteJSON = {
    title: "Test Course",
    welcomePage: {
      title: "Welcome",
      content: "<h1>Welcome</h1>",
      narration: "Welcome to the course",
      duration: 2
    },
    learningObjectivesPage: {
      title: "Objectives",
      content: "<h2>Objectives</h2>",
      narration: "Learning objectives",
      duration: 2
    },
    topics: [{
      id: "topic-1",
      title: "Topic 1",
      content: "<h2>Topic 1</h2>",
      narration: "Topic 1 content",
      duration: 3
    }]
    // Missing assessment section
  }
  
  const jsonTextarea = this.page.locator('[data-testid="json-input-textarea"]')
  await jsonTextarea.fill(JSON.stringify(incompleteJSON, null, 2))
})

Then('I should see warnings:', async function (this: World, dataTable) {
  const warnings = dataTable.raw().flat()
  
  for (const warning of warnings) {
    await expect(this.page.locator(`text=${warning}`)).toBeVisible()
  }
})

When('I paste JSON with {string}', async function (this: World, issue: string) {
  let problematicJSON: any = {}
  
  switch (issue) {
    case 'empty topics array':
      problematicJSON = {
        title: "Test Course",
        topics: []
      }
      break
    case 'missing narration text':
      problematicJSON = {
        title: "Test Course",
        topics: [{
          id: "topic-1",
          title: "Topic 1",
          content: "<h2>Topic 1</h2>",
          // Missing narration
          duration: 3
        }]
      }
      break
    case 'invalid HTML in content':
      problematicJSON = {
        title: "Test Course",
        topics: [{
          id: "topic-1",
          title: "Topic 1",
          content: "<h2>Unclosed tag",
          narration: "Topic 1",
          duration: 3
        }]
      }
      break
    case 'missing knowledge checks':
      problematicJSON = {
        title: "Test Course",
        topics: [{
          id: "topic-1",
          title: "Topic 1",
          content: "<h2>Topic 1</h2>",
          narration: "Topic 1",
          duration: 3
          // Missing knowledgeCheck
        }]
      }
      break
  }
  
  const jsonTextarea = this.page.locator('[data-testid="json-input-textarea"]')
  await jsonTextarea.fill(JSON.stringify(problematicJSON, null, 2))
})

When('I click "Paste from Clipboard"', async function (this: World) {
  await this.page.click('[data-testid="paste-clipboard-button"]')
})

Then('the JSON should be pasted into the textarea', async function (this: World) {
  const jsonTextarea = this.page.locator('[data-testid="json-input-textarea"]')
  const content = await jsonTextarea.inputValue()
  expect(content.length).toBeGreaterThan(0)
})

When('I click "Choose File"', async function (this: World) {
  // Trigger file input
  const fileInput = this.page.locator('input[type="file"][accept=".json"]')
  await fileInput.setInputFiles('./tests/fixtures/course-content.json')
})

When('I select {string}', async function (this: World, fileName: string) {
  // File selection is handled in the previous step
  this.selectedFileName = fileName
})

Then('the file content should load in the textarea', async function (this: World) {
  const jsonTextarea = this.page.locator('[data-testid="json-input-textarea"]')
  await expect(jsonTextarea).not.toBeEmpty()
})

When('I drag a JSON file onto the textarea', async function (this: World) {
  // Simulate drag and drop
  const jsonTextarea = this.page.locator('[data-testid="json-input-textarea"]')
  
  // Create a data transfer
  await jsonTextarea.dispatchEvent('drop', {
    dataTransfer: {
      files: ['./tests/fixtures/course-content.json']
    }
  })
})

Then('the file should be loaded', async function (this: World) {
  const jsonTextarea = this.page.locator('[data-testid="json-input-textarea"]')
  await expect(jsonTextarea).not.toBeEmpty()
})

When('I paste valid JSON and validate it', async function (this: World) {
  await this.page.locator('[data-testid="json-input-textarea"]').fill(JSON.stringify({
    title: "Test Course",
    welcomePage: { title: "Welcome", content: "<h1>Welcome</h1>", narration: "Welcome", duration: 2 },
    learningObjectivesPage: { title: "Objectives", content: "<h2>Objectives</h2>", narration: "Objectives", duration: 2 },
    topics: Array(5).fill(null).map((_, i) => ({
      id: `topic-${i+1}`,
      title: `Topic ${i+1}`,
      content: `<h2>Topic ${i+1}</h2>`,
      narration: `Topic ${i+1} content`,
      duration: 3
    })),
    assessment: {
      questions: Array(8).fill(null).map((_, i) => ({
        question: `Question ${i+1}?`,
        options: ["A", "B", "C", "D"],
        correctAnswer: 0
      }))
    }
  }, null, 2))
  
  await this.page.click('[data-testid="validate-json-button"]')
})

Then('I should see a preview showing:', async function (this: World, dataTable) {
  const preview = dataTable.rowsHash()
  
  for (const [element, count] of Object.entries(preview)) {
    const previewElement = this.page.locator(`[data-testid="preview-${element.toLowerCase()}"]`)
    await expect(previewElement).toHaveText(count)
  }
})

Given('I have validated JSON successfully', async function (this: World) {
  // Assumes JSON is already validated
  this.jsonValidated = true
})

When('I click "Clear JSON"', async function (this: World) {
  await this.page.click('[data-testid="clear-json-button"]')
})

Then('I should see a confirmation dialog', async function (this: World) {
  await expect(this.page.locator('text=Are you sure')).toBeVisible()
})

When('I confirm clearing', async function (this: World) {
  await this.page.click('button:has-text("Confirm")')
})

Then('the textarea should be empty', async function (this: World) {
  const jsonTextarea = this.page.locator('[data-testid="json-input-textarea"]')
  await expect(jsonTextarea).toBeEmpty()
})

Then('the validation status should reset', async function (this: World) {
  const validationStatus = this.page.locator('[data-testid="validation-status"]')
  await expect(validationStatus).not.toHaveText('JSON is valid')
})