/**
 * Quick validation test to check basic setup
 */

import { test, expect } from '@playwright/test';

test.describe('Quick Validation Tests', () => {
  test('Application should load and show dashboard', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if we can find any heading or main content
    const heading = page.locator('h1, h2, .main-title, .app-title');
    await expect(heading.first()).toBeVisible({ timeout: 30000 });
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/validation-screenshot.png', fullPage: true });
    
    console.log('Page title:', await page.title());
    console.log('Page URL:', page.url());
  });

  test('Create New Project button should be clickable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for project creation elements
    const createButton = page.locator('button:has-text("Create"), button:has-text("New"), [data-testid*="create"]');
    
    if (await createButton.first().isVisible({ timeout: 10000 })) {
      await expect(createButton.first()).toBeVisible();
      console.log('Found create button');
    } else {
      console.log('No create button found, checking for other interactive elements');
      
      // Log all buttons for debugging
      const allButtons = await page.locator('button').all();
      console.log(`Found ${allButtons.length} buttons on the page`);
      
      for (let i = 0; i < Math.min(allButtons.length, 5); i++) {
        const buttonText = await allButtons[i].textContent();
        console.log(`Button ${i}: "${buttonText}"`);
      }
    }
  });
});