import { Page } from '@playwright/test'

export class WaitHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for auto-save to complete with multiple strategies
   */
  async waitForAutoSave() {
    // Strategy 1: Wait for the debounce timeout (1 second) plus buffer
    await this.page.waitForTimeout(1500)
    
    // Strategy 2: Wait for any pending network requests to complete
    await this.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {
      // Ignore timeout - not all saves trigger network requests in mock
    })
    
    // Strategy 3: Check for save indicator if present
    const saveIndicator = this.page.locator('[data-testid="save-indicator"]')
    if (await saveIndicator.count() > 0) {
      // Wait for save indicator to show "Saved" or disappear
      await Promise.race([
        saveIndicator.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {}),
        this.page.waitForSelector('text=Saved', { timeout: 3000 }).catch(() => {})
      ])
    }
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation() {
    await Promise.all([
      this.page.waitForLoadState('domcontentloaded'),
      this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    ])
  }

  /**
   * Wait for form validation
   */
  async waitForFormValidation() {
    // Wait a moment for React to update validation state
    await this.page.waitForTimeout(100)
  }

  /**
   * Wait for step transition
   */
  async waitForStepTransition(expectedStep: string) {
    // Wait for URL to change or step indicator to update
    await Promise.race([
      this.page.waitForURL(`**/${expectedStep}`, { timeout: 5000 }),
      this.page.waitForSelector(`[data-current-step="${expectedStep}"]`, { timeout: 5000 }),
      this.page.waitForSelector(`text="${expectedStep}"`, { timeout: 5000 })
    ]).catch(() => {
      // If none of the above work, just wait a moment
      return this.page.waitForTimeout(2000)
    })
  }
}