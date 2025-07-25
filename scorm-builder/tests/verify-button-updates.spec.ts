import { test, expect } from '@playwright/test'

test.describe('Verify Button Style Updates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
  })

  test('capture all pages with updated buttons', async ({ page }) => {
    // 1. Course Seed Input Page
    await page.screenshot({ path: 'screenshots/1-course-seed-buttons.png', fullPage: true })
    
    // Fill in required fields to enable Continue button
    await page.fill('input[placeholder="Enter course title"]', 'Test Course')
    await page.fill('textarea[placeholder="Enter topics, one per line..."]', 'Topic 1\nTopic 2\nTopic 3')
    
    await page.screenshot({ path: 'screenshots/1-course-seed-filled.png', fullPage: true })
    
    // 2. Continue to AI Prompt Generator
    await page.click('button:has-text("Continue to AI Prompt")')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'screenshots/2-ai-prompt-buttons.png', fullPage: true })
    
    // 3. Continue to JSON Import
    await page.click('button:has-text("Proceed to JSON Import")')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'screenshots/3-json-import-buttons.png', fullPage: true })
    
    // Test the paste button
    await page.click('button:has-text("Paste from Clipboard")')
    await page.waitForTimeout(500)
    
    // Add sample JSON
    await page.fill('textarea[placeholder="Paste your JSON here..."]', '{"title": "Test", "topics": []}')
    await page.screenshot({ path: 'screenshots/3-json-import-with-data.png', fullPage: true })
    
    // 4. Skip to Media Enhancement
    await page.click('button:has-text("Skip to Media Enhancement")')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'screenshots/4-media-enhancement-buttons.png', fullPage: true })
    
    // Test topic navigation
    if (await page.locator('button:has-text("Next Topic")').isEnabled()) {
      await page.click('button:has-text("Next Topic")')
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'screenshots/4-media-topic-navigation.png', fullPage: true })
    }
    
    // 5. Continue to Audio Narration
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'screenshots/5-audio-narration-buttons.png', fullPage: true })
    
    // 6. Continue to Activities Editor
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'screenshots/6-activities-editor-buttons.png', fullPage: true })
    
    // 7. Continue to SCORM Package Builder
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'screenshots/7-scorm-builder-buttons.png', fullPage: true })
    
    // 8. Test Settings Modal
    await page.click('button:has-text("Settings")')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'screenshots/8-settings-buttons.png', fullPage: true })
    
    // Close settings
    await page.click('button[aria-label="Close Settings"]')
    await page.waitForTimeout(500)
    
    // 9. Test Help Page
    await page.click('button:has-text("Help")')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'screenshots/9-help-page-buttons.png', fullPage: true })
    
    // Test help section expansion
    await page.click('[data-testid="section-button"]:first-of-type')
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'screenshots/9-help-expanded.png', fullPage: true })
    
    // 10. Test Open Project Dialog
    await page.click('button:has-text("Back to Course Builder")')
    await page.waitForTimeout(500)
    await page.click('button:has-text("Open")')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'screenshots/10-open-project-buttons.png', fullPage: true })
    
    // Close dialog
    await page.click('button:has-text("Cancel")')
    await page.waitForTimeout(500)
    
    // 11. Test Save functionality (triggers dialogs)
    await page.click('button:has-text("Save")')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'screenshots/11-save-dialog.png', fullPage: true })
  })

  test('verify button hover states', async ({ page }) => {
    // Test hover states on various buttons
    const primaryButton = page.locator('button:has-text("Continue to AI Prompt")').first()
    await primaryButton.hover()
    await page.screenshot({ path: 'screenshots/hover-primary-button.png', fullPage: true })
    
    // Test secondary button hover
    await page.click('button:has-text("Continue to AI Prompt")')
    await page.waitForTimeout(1000)
    const backButton = page.locator('button:has-text("Back")').first()
    await backButton.hover()
    await page.screenshot({ path: 'screenshots/hover-secondary-button.png', fullPage: true })
  })

  test('verify button disabled states', async ({ page }) => {
    // Check disabled state of Continue button when form is empty
    await page.fill('input[placeholder="Enter course title"]', '')
    await page.fill('textarea[placeholder="Enter topics, one per line..."]', '')
    await page.screenshot({ path: 'screenshots/disabled-continue-button.png', fullPage: true })
    
    // Check SCORM builder disabled state
    await page.fill('input[placeholder="Enter course title"]', 'Test')
    await page.fill('textarea[placeholder="Enter topics, one per line..."]', 'Topic 1')
    await page.click('button:has-text("Continue to AI Prompt")')
    await page.click('button:has-text("Proceed to JSON Import")')
    await page.click('button:has-text("Skip to Media Enhancement")')
    await page.click('button:has-text("Next")')
    await page.click('button:has-text("Next")')
    await page.click('button:has-text("Next")')
    
    // SCORM builder page - button should be disabled without title
    await page.screenshot({ path: 'screenshots/disabled-generate-button.png', fullPage: true })
  })
})