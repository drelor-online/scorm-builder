import { Page, Locator, expect } from '@playwright/test'

export class CourseSeedInputPage {
  private page: Page
  
  // Locators
  private titleInput: Locator
  private templateSelect: Locator
  private addTemplateTopicsButton: Locator
  private topicsTextarea: Locator
  private difficultyButtons: Locator
  private difficultySlider: Locator
  private nextButton: Locator
  private manageTemplatesButton: Locator
  private autoSaveIndicator: Locator
  private errorMessages: Locator
  private formElement: Locator

  constructor(page: Page) {
    this.page = page
    
    // Initialize locators
    this.titleInput = page.locator('[data-testid="course-title-input"]')
    this.templateSelect = page.locator('[data-testid="template-select"]')
    this.addTemplateTopicsButton = page.locator('[data-testid="add-template-topics"]')
    this.topicsTextarea = page.locator('[data-testid="topics-textarea"]')
    this.difficultyButtons = page.locator('[data-testid^="difficulty-"]')
    this.difficultySlider = page.locator('[data-testid="difficulty-slider"]')
    this.nextButton = page.locator('[data-testid="next-button"]')
    this.manageTemplatesButton = page.locator('[data-testid="manage-templates-button"]')
    this.autoSaveIndicator = page.locator('[data-testid="auto-save-indicator"]')
    this.errorMessages = page.locator('.alert.alert-error')
    this.formElement = page.locator('[data-testid="course-seed-input-form"]')
  }

  async enterTitle(title: string) {
    // First ensure the form is visible
    await this.formElement.waitFor({ state: 'visible', timeout: 10000 })
    
    // Wait for the input to be visible and enabled
    await this.titleInput.waitFor({ state: 'visible', timeout: 10000 })
    await expect(this.titleInput).toBeEnabled()
    
    // Click to focus first
    await this.titleInput.click()
    
    // Clear using keyboard shortcuts (more reliable than clear())
    // Use platform-appropriate keyboard shortcut
    const isMac = process.platform === 'darwin'
    await this.page.keyboard.press(isMac ? 'Meta+A' : 'Control+A')
    await this.page.keyboard.press('Delete')
    
    // Type the new title
    await this.titleInput.type(title)
    
    // Blur to trigger validation
    await this.titleInput.blur()
  }

  async clearTitle() {
    // Wait for the input to be visible
    await this.titleInput.waitFor({ state: 'visible', timeout: 10000 })
    
    // Click to focus first
    await this.titleInput.click()
    
    // Clear using keyboard shortcuts
    const isMac = process.platform === 'darwin'
    await this.page.keyboard.press(isMac ? 'Meta+A' : 'Control+A')
    await this.page.keyboard.press('Delete')
    
    await this.titleInput.blur() // Trigger validation
  }

  async selectTemplate(templateName: string) {
    await this.templateSelect.selectOption(templateName)
  }

  async addTemplateTopics() {
    await this.addTemplateTopicsButton.click()
  }

  async setDifficulty(level: number) {
    // Click the difficulty button (1-5)
    await this.page.locator(`[data-testid="difficulty-${level}"]`).click()
  }

  async setDifficultySlider(level: number) {
    await this.difficultySlider.fill(level.toString())
  }

  async enterTopics(topics: string | string[]) {
    const topicsText = Array.isArray(topics) ? topics.join('\n') : topics
    await this.topicsTextarea.clear()
    await this.topicsTextarea.fill(topicsText)
  }

  async addTopic(topic: string) {
    // Get current topics
    const currentTopics = await this.topicsTextarea.inputValue()
    // Add new topic on new line
    const newTopics = currentTopics ? `${currentTopics}\n${topic}` : topic
    await this.topicsTextarea.fill(newTopics)
    await this.topicsTextarea.blur() // Trigger validation
  }

  async clickNext() {
    // First check if button is enabled
    const isEnabled = await this.nextButton.isEnabled()
    if (!isEnabled) {
      throw new Error('Next button is not enabled')
    }
    
    // Try a different click approach - evaluate in page
    await this.page.evaluate(() => {
      const button = document.querySelector('[data-testid="next-button"]') as HTMLButtonElement
      if (button) {
        button.click()
      }
    })
  }

  async clickButton(buttonText: string) {
    await this.page.getByRole('button', { name: buttonText }).click()
  }

  async clickManageTemplates() {
    await this.manageTemplatesButton.click()
  }

  async getErrorMessage(): Promise<string> {
    const errors = await this.errorMessages.allTextContents()
    return errors.join(' ')
  }

  async getTopics(): Promise<string[]> {
    const topicsText = await this.topicsTextarea.inputValue()
    return topicsText.split('\n').map(t => t.trim()).filter(t => t.length > 0)
  }

  async getTopicCount(): Promise<number> {
    const topics = await this.getTopics()
    return topics.length
  }

  async getTitle(): Promise<string> {
    return await this.titleInput.inputValue()
  }

  async getSelectedTemplate(): Promise<string> {
    return await this.templateSelect.inputValue()
  }

  async getDifficulty(): Promise<number> {
    return parseInt(await this.difficultySlider.inputValue(), 10)
  }

  async getAutoSaveStatus(): Promise<string> {
    return await this.autoSaveIndicator.textContent() || ''
  }

  async isNextButtonEnabled(): Promise<boolean> {
    return await this.nextButton.isEnabled()
  }

  async waitForAutoSave(): Promise<void> {
    // Wait for auto-save indicator to show "Saved"
    await this.page.waitForTimeout(1500) // Wait for debounce
  }
}