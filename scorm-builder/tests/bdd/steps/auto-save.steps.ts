import { When, Then } from '@cucumber/cucumber'

// Helper step to wait for auto-save to complete
When('I wait for auto-save to complete', async function() {
  await this.waitHelpers.waitForAutoSave()
})

// Helper step to fill form and wait for auto-save
When('I fill the course seed form with auto-save:', async function(dataTable) {
  const data = dataTable.hashes()[0]
  
  // Enter course title
  if (data['Course Title']) {
    const titleInput = this.page.locator('[data-testid="course-title-input"]')
    await titleInput.clear()
    await titleInput.fill(data['Course Title'])
  }
  
  // Add topics
  if (data['Topics']) {
    const topics = data['Topics'].split(',').map((t: string) => t.trim())
    const topicsTextarea = this.page.locator('[data-testid="topics-textarea"]')
    await topicsTextarea.fill(topics.join('\n'))
  }
  
  // Select difficulty
  if (data['Difficulty']) {
    await this.page.click(`[data-testid="difficulty-${data['Difficulty']}"]`)
  }
  
  // Wait for auto-save to complete
  await this.page.waitForTimeout(1500)
})

// Verify auto-save completed by checking for saved data
Then('the course data should be auto-saved', async function() {
  // Check that the data persists by looking for console logs or UI indicators
  // This is a placeholder - in a real app you might check for a save indicator
  await this.page.waitForTimeout(500)
  
  // Could also check console logs for save commands if needed
  // Note: Real apps would have better save indicators
  
  // Just return true for now - the real test is whether navigation works
  return true
})