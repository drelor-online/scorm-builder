import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Simple AI UI Test', () => {
  test.beforeEach(async ({ page }) => {
    // Create test results directory
    const testResultsDir = path.join(process.cwd(), 'test-results', 'ai-analysis');
    const screenshotsDir = path.join(testResultsDir, 'screenshots', 'simple');
    
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('Basic app loading and screenshot capture', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the app to be loaded
    await page.waitForLoadState('networkidle');
    
    // Wait a bit more for any dynamic content
    await page.waitForTimeout(2000);
    
    // Try to find the main heading
    const heading = page.locator('h1');
    if (await heading.count() > 0) {
      console.log('Found heading:', await heading.first().textContent());
    }
    
    // Take a simple screenshot
    const screenshotPath = path.join(process.cwd(), 'test-results', 'ai-analysis', 'screenshots', 'simple', 'landing-page.png');
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: true 
    });
    
    console.log('Screenshot saved to:', screenshotPath);
    
    // Basic assertion
    await expect(page).toHaveURL(/localhost/);
  });

  test('Form interaction test', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Look for a course title input
    const titleInput = page.locator('input[placeholder*="course title"], #course-title, input[type="text"]').first();
    
    if (await titleInput.isVisible()) {
      await titleInput.fill('Test Course for AI Analysis');
      
      // Take screenshot after filling
      const screenshotPath = path.join(process.cwd(), 'test-results', 'ai-analysis', 'screenshots', 'simple', 'form-filled.png');
      await page.screenshot({ 
        path: screenshotPath, 
        fullPage: true 
      });
      
      console.log('Form filled screenshot saved to:', screenshotPath);
    } else {
      console.log('No title input found on the page');
    }
  });
});