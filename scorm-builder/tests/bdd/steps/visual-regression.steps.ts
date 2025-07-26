import { Given, When, Then } from '@cucumber/cucumber'
import { visualRegression } from '../support/visualRegression'
import { expect } from '@playwright/test'

// Capture a screenshot for visual regression
When('I capture screenshot {string} for visual regression', async function (name: string) {
  await visualRegression.captureScreenshot(this.page, name)
})

// Capture with options
When('I capture screenshot {string} with options:', async function (name: string, dataTable) {
  const options = dataTable.hashes()[0]
  const config: any = {}
  
  if (options.fullPage !== undefined) {
    config.fullPage = options.fullPage === 'true'
  }
  
  if (options.selector) {
    // Capture specific element
    const element = this.page.locator(options.selector)
    const box = await element.boundingBox()
    if (box) {
      config.clip = box
    }
  }
  
  if (options.mask) {
    config.mask = options.mask.split(',').map(selector => ({ selector: selector.trim() }))
  }
  
  await visualRegression.captureScreenshot(this.page, name, config)
})

// Compare with baseline
Then('the screenshot {string} should match the baseline', async function (name: string) {
  const result = await visualRegression.compareWithBaseline(name)
  
  if (!result.matched) {
    // Store result for report
    if (!this.visualRegressionResults) {
      this.visualRegressionResults = []
    }
    this.visualRegressionResults.push({
      name,
      matched: false,
      message: result.message
    })
    
    throw new Error(result.message)
  }
  
  // Store success result
  if (!this.visualRegressionResults) {
    this.visualRegressionResults = []
  }
  this.visualRegressionResults.push({
    name,
    matched: true,
    message: result.message
  })
})

// Update baseline
When('I update the baseline for {string}', async function (name: string) {
  await visualRegression.updateBaseline(name)
})

// Capture multiple elements
When('I capture visual regression screenshots for:', async function (dataTable) {
  const screenshots = dataTable.hashes()
  
  for (const screenshot of screenshots) {
    const options: any = {}
    
    if (screenshot.selector) {
      const element = this.page.locator(screenshot.selector)
      const box = await element.boundingBox()
      if (box) {
        options.clip = box
      }
    }
    
    await visualRegression.captureScreenshot(this.page, screenshot.name, options)
  }
})

// Compare multiple screenshots
Then('all visual regression screenshots should match baselines', async function () {
  const results = []
  
  // This would be populated by previous captures
  const screenshotNames = this.capturedScreenshots || []
  
  for (const name of screenshotNames) {
    const result = await visualRegression.compareWithBaseline(name)
    results.push({
      name,
      ...result
    })
  }
  
  // Generate report
  await visualRegression.generateReport(results)
  
  // Check if any failed
  const failures = results.filter(r => !r.matched)
  if (failures.length > 0) {
    throw new Error(`${failures.length} visual regression tests failed. See report for details.`)
  }
})

// Mask dynamic content
When('I capture screenshot {string} masking dynamic content', async function (name: string) {
  // Common dynamic selectors to mask
  const dynamicSelectors = [
    '[data-testid="timestamp"]',
    '[data-testid="date"]',
    '.timestamp',
    '.date',
    '[data-testid="autosave-indicator"]'
  ]
  
  const options = {
    mask: dynamicSelectors.map(selector => ({ selector }))
  }
  
  await visualRegression.captureScreenshot(this.page, name, options)
})

// Store captured screenshot names for batch comparison
When('I mark screenshot {string} for comparison', async function (name: string) {
  if (!this.capturedScreenshots) {
    this.capturedScreenshots = []
  }
  this.capturedScreenshots.push(name)
})

// Set viewport size
Given('I set the viewport to {int}x{int}', async function (width: number, height: number) {
  await this.page.setViewportSize({ width, height })
})

// Click outside element to trigger blur
When('I click outside the form', async function () {
  // Click on body to blur any focused element
  await this.page.locator('body').click({ position: { x: 10, y: 10 } })
})

// Click on specific input
When('I click the course title input', async function () {
  await this.page.click('[data-testid="course-title-input"]')
})