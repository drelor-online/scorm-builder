import { Page, Locator } from '@playwright/test'

export class AppPage {
  private page: Page
  private baseUrl: string
  
  constructor(page: Page, baseUrl?: string) {
    this.page = page
    this.baseUrl = baseUrl || process.env.BASE_URL || 'http://localhost:1420'
  }

  async navigate() {
    await this.page.goto(this.baseUrl)
    await this.page.waitForLoadState('networkidle')
  }

  async waitForStep(stepName: string) {
    // Wait for the step to be visible
    switch(stepName) {
      case 'seed':
        await this.page.waitForSelector('[data-testid="course-seed-input-form"]')
        break
      case 'ai-prompt':
        await this.page.waitForSelector('[data-testid="ai-prompt-textarea"]')
        break
      case 'json':
        await this.page.waitForSelector('[data-testid="json-input-textarea"]')
        break
      default:
        await this.page.waitForTimeout(1000)
    }
  }

  async waitForLoadingToFinish() {
    // Wait for any loading indicators to disappear
    await this.page.waitForTimeout(500)
    // Could also wait for specific loading indicators if they exist
  }

  async getCurrentStep(): Promise<string> {
    // Check which step is currently active based on visible elements
    if (await this.page.locator('[data-testid="course-seed-input-form"]').isVisible()) {
      return 'seed'
    }
    if (await this.page.locator('[data-testid="ai-prompt-textarea"]').isVisible()) {
      return 'ai-prompt'
    }
    if (await this.page.locator('[data-testid="json-input-textarea"]').isVisible()) {
      return 'json'
    }
    return 'unknown'
  }
}
