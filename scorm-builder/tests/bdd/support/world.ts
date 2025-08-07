import { setWorldConstructor } from '@cucumber/cucumber'
import { Page } from '@playwright/test'

export interface World {
  page: Page
  consoleErrors?: string[]
  baseUrl?: string
  lastDownload?: any
  courseConfig?: Record<string, string>
  originalPrompt?: string
  selectedTemplate?: string
  hasUnicodeTitle?: boolean
  topicCount?: number
  selectedFileName?: string
  jsonValidated?: boolean
  navigateToStep?: (stepName: string) => Promise<void>
}

export { World as CustomWorld } // Keep alias for compatibility

setWorldConstructor(function(this: World) {
  this.consoleErrors = []
  
  // Add navigateToStep helper method
  this.navigateToStep = async (stepName: string) => {
    // Map step names to navigation actions
    const stepMapping: Record<string, string> = {
      'Course Seed Input': 'seed',
      'AI Prompt Generator': 'prompt',
      'JSON Import Validator': 'json',
      'Media Enhancement Wizard': 'media',
      'Audio Narration Wizard': 'audio',
      'Activities Editor': 'activities',
      'SCORM Package Builder': 'scorm'
    }
    
    const stepId = stepMapping[stepName]
    if (stepId) {
      // Click on the step button or navigate to it
      const stepButton = await this.page.locator(`[data-step="${stepId}"], button:has-text("${stepName}")`)
      if (await stepButton.isVisible()) {
        await stepButton.click()
      }
    }
    
    // Wait for the step to be visible
    await this.page.waitForSelector(`h2:has-text("${stepName}")`, { timeout: 10000 })
  }
})
