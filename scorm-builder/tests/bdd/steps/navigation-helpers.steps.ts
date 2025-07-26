import { When } from '@cucumber/cucumber'

// Helper to create a new project, handling both dialog and direct navigation scenarios
When('I create a new project named {string}', async function(projectName: string) {
  // The app starts directly at Course Seed Input, no Create New Project button
  await this.page.waitForSelector('[data-testid="course-seed-input-form"]', { timeout: 5000 })
  
  // Fill in the project name as the course title
  await this.page.fill('[data-testid="course-title-input"]', projectName)
  
  // Add some topics to make the form valid
  await this.page.fill('[data-testid="topics-textarea"]', 'Topic 1\nTopic 2')
  
  // Wait for auto-save
  await this.page.waitForTimeout(1500)
})