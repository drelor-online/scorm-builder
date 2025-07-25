import { test, expect } from '@playwright/test';

test.describe('Basic Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the app to be fully loaded
    await expect(page.locator('h1')).toContainText('SCORM Course Builder');
  });

  test('should match main landing page screenshot', async ({ page }) => {
    // Wait for any animations to complete
    await page.waitForTimeout(1000);
    
    // Take screenshot and compare with baseline
    await expect(page).toHaveScreenshot('main-landing-page.png');
  });

  test('should match Settings modal screenshot', async ({ page }) => {
    // Open settings modal
    await page.click('button:has-text("Settings")');
    
    // Wait for modal to be visible
    await expect(page.locator('.bg-white').filter({ hasText: 'Settings' })).toBeVisible();
    await page.waitForTimeout(500); // Wait for animation
    
    // Take screenshot of the modal
    await expect(page.locator('.fixed.inset-0')).toHaveScreenshot('settings-modal-full.png');
  });

  test('should match Course Seed Input form screenshot', async ({ page }) => {
    // The landing page IS the Course Seed Input step
    await page.waitForTimeout(1000);
    
    // Take screenshot of the main content area
    await expect(page.locator('main')).toHaveScreenshot('course-seed-form.png');
  });

  test('should match Entrust Solutions branding screenshot', async ({ page }) => {
    // Verify branding elements are visible
    await expect(page.locator('img[alt="Entrust Solutions"]')).toBeVisible();
    await expect(page.locator('.brand-tagline')).toContainText('Empowering Learning Through Technology');
    
    // Take screenshot of the header with branding
    await expect(page.locator('header.brand-header')).toHaveScreenshot('header-branding.png');
  });

  test('should match filled form screenshot', async ({ page }) => {
    // Fill out the form to show it in action
    await page.fill('#course-title', 'Safety Training Course');
    await page.locator('#difficulty').fill('4');
    await page.fill('#custom-topics', 'Workplace Safety\nHazard Identification\nEmergency Procedures\nPPE Usage');
    
    // Wait for form to settle
    await page.waitForTimeout(500);
    
    // Take screenshot of filled form
    await expect(page.locator('main')).toHaveScreenshot('filled-course-form.png');
  });

  test('should match mobile viewport screenshot', async ({ page, browserName }) => {
    // Only test mobile on Chromium to avoid duplicate tests
    test.skip(browserName !== 'chromium', 'Mobile test only on Chromium');
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to app (already there but viewport changed)
    await page.reload();
    await page.waitForTimeout(1000);
    
    // Take mobile screenshot
    await expect(page).toHaveScreenshot('mobile-main-page.png');
  });

  test('should match progress indicator screenshot', async ({ page }) => {
    // Focus on the progress indicator at the top
    await page.waitForTimeout(1000);
    
    // Take screenshot of progress indicator
    await expect(page.locator('.progress-indicator')).toHaveScreenshot('progress-indicator.png');
  });
});