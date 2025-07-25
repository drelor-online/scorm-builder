import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the app to be fully loaded
    await expect(page.locator('h1')).toContainText('SCORM Course Builder');
  });

  test('should match screenshot of main landing page', async ({ page }) => {
    // Wait for any animations to complete
    await page.waitForTimeout(1000);
    
    // Take screenshot and compare with baseline
    await expect(page).toHaveScreenshot('landing-page.png');
  });

  test('should match screenshot of Settings modal', async ({ page }) => {
    // Open settings modal
    await page.click('button:has-text("Settings")');
    
    // Wait for modal to be visible
    await expect(page.locator('.bg-white').filter({ hasText: 'Settings' })).toBeVisible();
    
    // Take screenshot of the modal
    await expect(page.locator('.fixed.inset-0')).toHaveScreenshot('settings-modal.png');
  });

  test('should match screenshot of Course Seed Input step', async ({ page }) => {
    // The landing page IS the Course Seed Input step
    await page.waitForTimeout(1000);
    
    // Take screenshot of the course seed input form
    await expect(page.locator('main')).toHaveScreenshot('course-seed-input.png');
  });

  test('should match screenshot of AI Prompt Generator step', async ({ page }) => {
    // Fill out course seed form
    await page.fill('#course-title', 'Test Course');
    await page.locator('#difficulty').fill('3');
    await page.fill('#custom-topics', 'Test Topic 1\nTest Topic 2');
    
    // Submit form to move to next step
    await page.click('button:has-text("Next")');
    
    // Wait for AI Prompt Generator to load
    await expect(page.locator('h2')).toContainText('AI Prompt Generator');
    
    // Take screenshot
    await expect(page.locator('main')).toHaveScreenshot('ai-prompt-generator.png');
  });

  test('should match screenshot of Media Enhancement Wizard - Images tab', async ({ page }) => {
    // Navigate through the steps to reach Media Enhancement
    await page.fill('#course-title', 'Test Course');
    await page.locator('#difficulty').fill('3');
    await page.fill('#custom-topics', 'Test Topic 1');
    await page.click('button:has-text("Next")'); // Go to AI Prompt
    
    await page.click('button:has-text("Next")'); // Go to JSON Import
    
    // Fill in valid JSON in the JSON Import step
    const validJson = JSON.stringify({
      topics: [{
        id: '1',
        title: 'Test Topic',
        content: 'Test content',
        bulletPoints: ['Point 1'],
        narration: [{ id: '1', text: 'Test narration', blockNumber: '0001' }],
        imageKeywords: ['test'],
        imagePrompts: ['Test prompt'],
        videoSearchTerms: ['test video'],
        duration: 10
      }],
      activities: [],
      quiz: { questions: [], passMark: 80 }
    });
    
    await page.fill('textarea', validJson);
    await page.click('button:has-text("Validate JSON")');
    await page.click('button:has-text("Next")'); // Go to Media Enhancement
    
    // Wait for Media Enhancement Wizard to load
    await expect(page.locator('h2')).toContainText('Media Enhancement');
    
    // Ensure we're on the Images tab (default)
    await expect(page.locator('button:has-text("📷 Images")')).toHaveClass(/border-brand-primary/);
    
    // Take screenshot of Images tab
    await expect(page.locator('main')).toHaveScreenshot('media-enhancement-images.png');
  });

  test('should match screenshot of Media Enhancement Wizard - Videos tab', async ({ page }) => {
    // Navigate to Media Enhancement step (same as previous test)
    await page.fill('#course-title', 'Test Course');
    await page.locator('#difficulty').fill('3');
    await page.fill('#custom-topics', 'Test Topic 1');
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    
    const validJson = JSON.stringify({
      topics: [{
        id: '1',
        title: 'Test Topic',
        content: 'Test content',
        bulletPoints: ['Point 1'],
        narration: [{ id: '1', text: 'Test narration', blockNumber: '0001' }],
        imageKeywords: ['test'],
        imagePrompts: ['Test prompt'],
        videoSearchTerms: ['test video'],
        duration: 10
      }],
      activities: [],
      quiz: { questions: [], passMark: 80 }
    });
    
    await page.fill('textarea', validJson);
    await page.click('button:has-text("Validate JSON")');
    await page.click('button:has-text("Next")');
    
    // Click on Videos tab
    await page.click('button:has-text("🎥 Videos")');
    
    // Wait for Videos tab content to load
    await expect(page.locator('.videos-tab')).toBeVisible();
    
    // Take screenshot of Videos tab
    await expect(page.locator('main')).toHaveScreenshot('media-enhancement-videos.png');
  });

  test('should match screenshot on mobile viewport', async ({ page, browserName }) => {
    // Only test mobile on Chromium to avoid duplicate tests
    test.skip(browserName !== 'chromium', 'Mobile test only on Chromium');
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to app
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Take mobile screenshot
    await expect(page).toHaveScreenshot('mobile-landing-page.png');
  });

  test('should match screenshot with Entrust Solutions branding', async ({ page }) => {
    // Verify branding elements are visible
    await expect(page.locator('img[alt="Entrust Solutions"]')).toBeVisible();
    await expect(page.locator('.brand-tagline')).toContainText('Empowering Learning Through Technology');
    
    // Take screenshot focusing on branded header
    await expect(page.locator('header.brand-header')).toHaveScreenshot('entrust-branding.png');
  });
});