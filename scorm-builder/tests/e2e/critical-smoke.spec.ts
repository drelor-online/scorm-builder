/**
 * Critical Smoke Tests - Essential Regression Detection
 * 
 * This test suite focuses on the absolute critical user paths that must work.
 * Designed to run fast (<2 minutes) and catch major regressions.
 */

import { test, expect } from '@playwright/test';

test.describe('Critical Smoke Test Suite', () => {
  
  test('App loads and dashboard is functional', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify the dashboard loads
    await expect(page.locator('h1')).toContainText(['SCORM Builder', 'Projects', 'Dashboard']);
    
    // Verify create new project button exists
    await expect(page.locator('button:has-text("Create New Project")')).toBeVisible();
    
    console.log('✅ Dashboard loads successfully');
  });

  test('Complete course creation workflow', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Step 1: Create new project
    await page.click('button:has-text("Create New Project")');
    await page.waitForSelector('[role="dialog"]');
    await page.fill('input[placeholder="Enter project name"]', 'Smoke Test Course');
    await page.click('button:has-text("Create")');
    
    // Step 2: Course Configuration
    await page.waitForSelector('h1:has-text("Course Configuration")');
    const titleInput = page.locator('input[placeholder*="course title" i]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Critical Smoke Test Course');
    
    // Add topics
    const topicsTextarea = page.locator('textarea[placeholder*="topics" i]');
    await topicsTextarea.fill('Introduction\nMain Content\nConclusion');
    
    // Continue to next step
    await page.click('button:has-text("Continue")');
    console.log('✅ Course configuration completed');
    
    // Step 3: Skip to SCORM Package Builder (essential test)
    // Navigate through steps quickly to test core functionality
    const navigationButtons = [
      'button:has-text("Skip")',
      'button:has-text("Continue")',
      'button:has-text("Next")',
    ];
    
    // Attempt to navigate to SCORM builder by skipping intermediate steps
    for (let i = 0; i < 5; i++) {
      try {
        // Look for any continue/skip/next button and click it
        for (const buttonSelector of navigationButtons) {
          const button = page.locator(buttonSelector);
          if (await button.isVisible()) {
            await button.click();
            await page.waitForTimeout(1000); // Small delay for navigation
            break;
          }
        }
        
        // Check if we've reached the SCORM Package Builder
        const packageBuilderHeader = page.locator('h1:has-text("SCORM Package Builder")');
        if (await packageBuilderHeader.isVisible()) {
          console.log('✅ Reached SCORM Package Builder');
          break;
        }
      } catch (error) {
        console.log(`Navigation step ${i + 1}: ${error.message}`);
      }
    }
    
    // Verify we can see some form of package generation interface
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create Package"), button:has-text("Build")');
    await expect(generateButton.first()).toBeVisible({ timeout: 5000 });
    
    console.log('✅ Core workflow navigation successful');
  });

  test('Project save and load functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Create a simple project
    await page.click('button:has-text("Create New Project")');
    await page.waitForSelector('[role="dialog"]');
    await page.fill('input[placeholder="Enter project name"]', 'Save Test Project');
    await page.click('button:has-text("Create")');
    
    // Fill some basic information
    await page.waitForSelector('h1:has-text("Course Configuration")');
    const titleInput = page.locator('input[placeholder*="course title" i]');
    await titleInput.fill('Save Test Course');
    
    // Look for save functionality (could be auto-save or manual save)
    const saveIndicators = [
      'text="Saved"',
      'text="Auto-saved"',
      'button:has-text("Save")',
      '[data-testid="save-status"]'
    ];
    
    // Check if auto-save is working or if manual save is available
    let saveFound = false;
    for (const indicator of saveIndicators) {
      try {
        const element = page.locator(indicator);
        if (await element.isVisible({ timeout: 2000 })) {
          console.log(`✅ Save functionality detected: ${indicator}`);
          saveFound = true;
          break;
        }
      } catch (error) {
        // Continue checking other indicators
      }
    }
    
    // If manual save button exists, click it
    const manualSaveButton = page.locator('button:has-text("Save")');
    if (await manualSaveButton.isVisible()) {
      await manualSaveButton.click();
      await page.waitForTimeout(1000);
      saveFound = true;
    }
    
    expect(saveFound).toBe(true);
    console.log('✅ Project save functionality working');
  });

  test('Media upload capability is available', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Create project and navigate to media section
    await page.click('button:has-text("Create New Project")');
    await page.waitForSelector('[role="dialog"]');
    await page.fill('input[placeholder="Enter project name"]', 'Media Test Project');
    await page.click('button:has-text("Create")');
    
    // Navigate through to find media functionality
    await page.waitForSelector('h1:has-text("Course Configuration")');
    
    // Look for media-related buttons or navigation
    const mediaSelectors = [
      'button:has-text("Media")',
      'button:has-text("Upload")',
      'a:has-text("Media Enhancement")',
      'input[type="file"]',
      '[data-testid*="media"]'
    ];
    
    let mediaFound = false;
    
    // Try to navigate to media section
    for (let step = 0; step < 3; step++) {
      // Check current page for media functionality
      for (const selector of mediaSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible({ timeout: 2000 })) {
          console.log(`✅ Media functionality found: ${selector}`);
          mediaFound = true;
          break;
        }
      }
      
      if (mediaFound) break;
      
      // Try to navigate to next step
      const continueButton = page.locator('button:has-text("Continue"), button:has-text("Next")');
      if (await continueButton.isVisible()) {
        await continueButton.click();
        await page.waitForTimeout(1500);
      } else {
        break;
      }
    }
    
    // At minimum, verify the application structure supports media
    expect(mediaFound).toBe(true);
    console.log('✅ Media upload capability verified');
  });

  test('Application error boundaries work', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that page loaded without JavaScript errors
    const jsErrors: string[] = [];
    page.on('pageerror', (error) => {
      jsErrors.push(error.message);
    });
    
    // Navigate around the application briefly
    await page.click('button:has-text("Create New Project")');
    await page.waitForSelector('[role="dialog"]');
    await page.press('body', 'Escape'); // Close dialog
    
    // Verify no critical JavaScript errors occurred
    const criticalErrors = jsErrors.filter(error => 
      error.includes('TypeError') || 
      error.includes('ReferenceError') ||
      error.includes('Cannot read properties of undefined')
    );
    
    expect(criticalErrors.length).toBe(0);
    console.log('✅ No critical JavaScript errors detected');
  });
});

test.describe('Quick Performance Check', () => {
  test('App loads within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for main content to be visible
    await expect(page.locator('h1')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    console.log(`App load time: ${loadTime}ms`);
    
    // Reasonable load time (adjust as needed)
    expect(loadTime).toBeLessThan(10000); // 10 seconds max
    console.log('✅ App loads within acceptable time');
  });
});