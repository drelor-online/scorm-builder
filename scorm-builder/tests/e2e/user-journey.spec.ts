import { test, expect } from '@playwright/test'

test.describe('Core User Journey - SCORM Builder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test.describe('Complete SCORM Creation Flow', () => {
    test('should create a complete SCORM package from scratch', async ({ page }) => {
      // Step 1: Fill in course details
      await test.step('Fill course seed information', async () => {
        // Wait for the course seed input to be visible
        await expect(page.getByTestId('course-seed-input')).toBeVisible()
        
        // Fill in course title
        await page.getByLabel('Course Title').fill('Test E2E Course')
        
        // Fill in course description
        await page.getByLabel('Course Description').fill('This is a test course created by E2E tests')
        
        // Select difficulty
        await page.getByTestId('difficulty-slider').click()
        
        // Select template topics
        await page.getByLabel('Recommended Topics').click()
        await page.getByRole('option', { name: 'Safety Training' }).click()
        
        // Click continue button
        await page.getByRole('button', { name: 'Continue to AI Prompt' }).click()
      })

      // Step 2: Navigate through workflow
      await test.step('Navigate to AI Prompt Generator', async () => {
        // Wait for navigation
        await expect(page.getByTestId('workflow-progress')).toContainText('Step 2')
        await expect(page.getByTestId('ai-prompt-generator')).toBeVisible()
        
        // Verify content was generated
        await expect(page.getByTestId('generated-content')).not.toBeEmpty()
        
        // Click next
        await page.getByRole('button', { name: 'Next' }).click()
      })

      // Step 3: Media Enhancement
      await test.step('Add media to course', async () => {
        await expect(page.getByTestId('media-enhancement-wizard')).toBeVisible()
        
        // Add image to first topic
        await page.getByTestId('topic-0-add-media').click()
        await page.getByRole('button', { name: 'Upload Image' }).click()
        
        // Mock file upload
        const fileChooserPromise = page.waitForEvent('filechooser')
        await page.getByTestId('file-input').click()
        const fileChooser = await fileChooserPromise
        await fileChooser.setFiles('tests/fixtures/test-image.jpg')
        
        // Verify image was added
        await expect(page.getByTestId('topic-0-media-preview')).toBeVisible()
        
        // Click next
        await page.getByRole('button', { name: 'Next' }).click()
      })

      // Step 4: Audio Narration
      await test.step('Add audio narration', async () => {
        await expect(page.getByTestId('audio-narration-wizard')).toBeVisible()
        
        // Skip audio for now
        await page.getByRole('button', { name: 'Skip' }).click()
      })

      // Step 5: Activities Editor
      await test.step('Edit knowledge check questions', async () => {
        await expect(page.getByTestId('activities-editor')).toBeVisible()
        
        // Edit first question
        await page.getByTestId('question-0-edit').click()
        await page.getByLabel('Question Text').fill('What is the main safety rule?')
        
        // Save question
        await page.getByRole('button', { name: 'Save' }).click()
        
        // Click next
        await page.getByRole('button', { name: 'Next' }).click()
      })

      // Step 6: SCORM Package Builder
      await test.step('Build and download SCORM package', async () => {
        await expect(page.getByTestId('scorm-package-builder')).toBeVisible()
        
        // Select SCORM version
        await page.getByLabel('SCORM Version').selectOption('2004')
        
        // Set completion criteria
        await page.getByLabel('Passing Score').fill('80')
        
        // Build package
        const downloadPromise = page.waitForEvent('download')
        await page.getByRole('button', { name: 'Build SCORM Package' }).click()
        
        // Verify download
        const download = await downloadPromise
        expect(download.suggestedFilename()).toContain('.zip')
        expect(download.suggestedFilename()).toContain('Test E2E Course')
      })
    })
  })

  test.describe('Save and Load Functionality', () => {
    test('should save and load project correctly', async ({ page }) => {
      // Create a simple project
      await page.getByLabel('Course Title').fill('Save Test Course')
      await page.getByLabel('Course Description').fill('Testing save functionality')
      
      // Save project
      await page.getByRole('button', { name: 'Save' }).click()
      
      // Verify save confirmation
      await expect(page.getByTestId('toast-notification')).toContainText('Project saved')
      
      // Refresh page
      await page.reload()
      
      // Open saved project
      await page.getByRole('button', { name: 'Open' }).click()
      await expect(page.getByTestId('open-project-dialog')).toBeVisible()
      
      // Select the saved project
      await page.getByText('Save Test Course').click()
      await page.getByRole('button', { name: 'Open Project' }).click()
      
      // Verify project loaded correctly
      await expect(page.getByLabel('Course Title')).toHaveValue('Save Test Course')
      await expect(page.getByLabel('Course Description')).toHaveValue('Testing save functionality')
    })
  })

  test.describe('Preview Mode', () => {
    test('should preview course before building', async ({ page }) => {
      // Create basic course
      await page.getByLabel('Course Title').fill('Preview Test Course')
      await page.getByRole('button', { name: 'Generate Course' }).click()
      
      // Navigate to package builder
      await page.getByTestId('workflow-step-6').click()
      
      // Click preview
      await page.getByRole('button', { name: 'Preview Course' }).click()
      
      // Verify preview modal
      await expect(page.getByTestId('course-preview-modal')).toBeVisible()
      await expect(page.getByTestId('preview-iframe')).toBeVisible()
      
      // Verify course content in preview
      const previewFrame = page.frameLocator('[data-testid="preview-iframe"]')
      await expect(previewFrame.getByText('Preview Test Course')).toBeVisible()
      
      // Close preview
      await page.getByRole('button', { name: 'Close Preview' }).click()
      await expect(page.getByTestId('course-preview-modal')).not.toBeVisible()
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('should support keyboard shortcuts', async ({ page }) => {
      // Fill in required fields first
      const titleInput = page.getByLabel('Course Title')
      await titleInput.click()
      await titleInput.fill('Keyboard Test Course')
      
      // Verify the field was filled
      await expect(titleInput).toHaveValue('Keyboard Test Course')
      
      // Focus the form to ensure it's active
      await page.getByTestId('course-seed-input').click()
      
      // Test Ctrl+S for save
      await page.keyboard.press('Control+s')
      await expect(page.getByTestId('toast-notification')).toContainText('Project saved')
      
      // Test Ctrl+O for open
      await page.keyboard.press('Control+o')
      await expect(page.getByTestId('open-project-dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      
      // Test Tab navigation
      await page.keyboard.press('Tab')
      await expect(page.getByLabel('Course Title')).toBeFocused()
      
      // Test Enter to submit
      await page.getByLabel('Course Title').fill('Enter Test Course')
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('workflow-progress')).toContainText('Step 2')
    })
  })

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page, context }) => {
      // Simulate offline mode
      await context.setOffline(true)
      
      // Try to save
      await page.getByLabel('Course Title').fill('Offline Test')
      await page.getByRole('button', { name: 'Save' }).click()
      
      // Verify error message
      await expect(page.getByTestId('error-notification')).toContainText('Network error')
      
      // Go back online
      await context.setOffline(false)
      
      // Retry save
      await page.getByRole('button', { name: 'Retry' }).click()
      await expect(page.getByTestId('toast-notification')).toContainText('Project saved')
    })

    test('should validate required fields', async ({ page }) => {
      // Try to continue without title
      await page.getByRole('button', { name: 'Continue to AI Prompt' }).click()
      
      // Verify validation error
      await expect(page.getByText('Please enter a course title')).toBeVisible()
      
      // Fill title and try again
      await page.getByLabel('Course Title').fill('Valid Course')
      await page.getByRole('button', { name: 'Continue to AI Prompt' }).click()
      
      // Should proceed to next step
      await expect(page.getByTestId('workflow-progress')).toContainText('Step 2')
    })
  })
})