import { test, expect } from '@playwright/test';

test.describe('Comprehensive Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the app to be fully loaded
    await expect(page.locator('h1')).toContainText('Course Configuration');
  });

  test('Course Seed Input - Full page screenshot', async ({ page }) => {
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('course-seed-full-page.png', { 
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('Course Seed Input - Field alignment check', async ({ page }) => {
    // Focus on the form section with difficulty and template fields
    const formSection = page.locator('.form-section').first();
    await expect(formSection).toHaveScreenshot('field-alignment-section.png', {
      animations: 'disabled'
    });
  });

  test('Course Seed Input - Difficulty and Template fields', async ({ page }) => {
    // Capture just the two-column section
    const twoColumnSection = page.locator('div').filter({ 
      has: page.locator('label:has-text("Difficulty Level")') 
    }).first();
    
    await expect(twoColumnSection).toHaveScreenshot('difficulty-template-fields.png', {
      animations: 'disabled'
    });
  });

  test('Course Seed Input - With filled data', async ({ page }) => {
    // Fill form to see how it looks with data
    await page.fill('#course-title', 'Workplace Safety Training Program');
    
    // Click difficulty level 4
    await page.click('button:has-text("Hard")');
    
    // Select a template
    await page.selectOption('#template', 'Safety');
    
    // Add topics
    await page.fill('#custom-topics', `Introduction to workplace safety
Hazard identification and risk assessment
Personal protective equipment (PPE)
Emergency response procedures
Incident reporting and documentation
Safety culture and compliance`);
    
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('course-seed-filled.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('All workflow steps - visual consistency', async ({ page }) => {
    // Step 1: Course Seed Input
    await expect(page).toHaveScreenshot('step-1-course-seed.png');
    
    // Fill and move to next step
    await page.fill('#course-title', 'Test Course');
    await page.fill('#custom-topics', 'Topic 1\nTopic 2');
    await page.click('button:has-text("Continue to AI Prompt")');
    
    // Step 2: AI Prompt Generator
    await expect(page.locator('h1')).toContainText('AI Prompt Generator');
    await expect(page).toHaveScreenshot('step-2-ai-prompt.png');
    
    // Move to next step
    await page.click('button:has-text("Continue to JSON Import")');
    
    // Step 3: JSON Import
    await expect(page.locator('h1')).toContainText('JSON Course Import');
    await expect(page).toHaveScreenshot('step-3-json-import.png');
  });
  
  test('AI Prompt textarea overflow check', async ({ page }) => {
    // Navigate to AI Prompt page
    await page.fill('#course-title', 'Electrical Safety');
    await page.selectOption('#template', 'How-to Guide');
    await page.fill('#custom-topics', 'Topic 1\nTopic 2\nTopic 3');
    await page.click('button:has-text("Continue to AI Prompt")');
    
    // Wait for AI Prompt page
    await expect(page.locator('h1')).toContainText('AI Prompt Generator');
    await page.waitForTimeout(1000);
    
    // Take full page screenshot to check alignment
    await expect(page).toHaveScreenshot('ai-prompt-page-full.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });
  
  test('JSON Import page - UI improvements', async ({ page }) => {
    // Navigate to JSON Import page
    await page.fill('#course-title', 'Test Course');
    await page.fill('#custom-topics', 'Topic 1\nTopic 2');
    await page.click('button:has-text("Continue to AI Prompt")');
    await page.click('button:has-text("Next")');
    
    // Wait for JSON Import page
    await expect(page.locator('h1')).toContainText('JSON Import & Validation');
    await page.waitForTimeout(1000);
    
    // Take full page screenshot
    await expect(page).toHaveScreenshot('json-import-page-full.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('Mobile responsiveness - Course Seed Input', async ({ page }) => {
    const viewports = [
      { name: 'iphone-12', width: 390, height: 844 },
      { name: 'ipad-mini', width: 768, height: 1024 },
      { name: 'desktop-small', width: 1024, height: 768 },
      { name: 'desktop-large', width: 1920, height: 1080 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.reload();
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot(`responsive-${viewport.name}.png`, {
        fullPage: true,
        animations: 'disabled'
      });
    }
  });

  test('Save/Open functionality visual test', async ({ page }) => {
    // Click Save button
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(500);
    
    // Should show toast notification
    await expect(page).toHaveScreenshot('save-toast-notification.png');
    
    // Click Open button
    await page.click('button:has-text("Open")');
    await page.waitForTimeout(500);
    
    // Should show open dialog
    await expect(page.locator('[role="dialog"]')).toHaveScreenshot('open-project-dialog.png');
  });

  test('Settings modal visual test', async ({ page }) => {
    await page.click('button:has-text("Settings")');
    await page.waitForTimeout(500);
    
    const settingsModal = page.locator('div').filter({ 
      has: page.locator('text=API Configuration') 
    }).first();
    
    await expect(settingsModal).toHaveScreenshot('settings-modal-detailed.png');
  });

  test('Dark theme consistency', async ({ page }) => {
    // Check background colors
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    
    expect(bgColor).toBe('rgb(24, 24, 27)'); // #18181b in RGB
    
    // Check form field styling
    const inputBg = await page.locator('#course-title').evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    expect(inputBg).toBe('rgb(24, 24, 27)'); // #18181b in RGB
  });

  test('Field alignment measurements', async ({ page }) => {
    // Get exact positions of fields
    const difficultyBox = await page.locator('label:has-text("Difficulty Level")').boundingBox();
    const templateBox = await page.locator('label:has-text("Course Template")').boundingBox();
    
    if (difficultyBox && templateBox) {
      // Check if labels are at the same Y position (aligned horizontally)
      expect(Math.abs(difficultyBox.y - templateBox.y)).toBeLessThan(5);
      
      // Check if fields have equal widths
      const difficultySection = await page.locator('div').filter({ 
        has: page.locator('label:has-text("Difficulty Level")') 
      }).nth(1).boundingBox();
      
      const templateSection = await page.locator('div').filter({ 
        has: page.locator('label:has-text("Course Template")') 
      }).nth(1).boundingBox();
      
      if (difficultySection && templateSection) {
        // Log the actual measurements
        console.log('Difficulty section width:', difficultySection.width);
        console.log('Template section width:', templateSection.width);
        
        // They should be approximately equal (within 10px tolerance)
        expect(Math.abs(difficultySection.width - templateSection.width)).toBeLessThan(10);
      }
    }
  });
});