import { test, expect } from '@playwright/test';
import { TestFileManager } from './helpers/file-helpers';

test.describe('Visual Regression Tests - Enhanced for Tauri Desktop', () => {
  let fileManager: TestFileManager;

  test.beforeEach(async ({ page }) => {
    fileManager = new TestFileManager();
    
    // Navigate to the application
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
    
    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
        .cursor-blink, .blink {
          animation: none !important;
        }
      `
    });
    
    // Wait for the app to be fully loaded
    await expect(page.locator('h1')).toContainText('SCORM', { timeout: 10000 });
  });

  test.afterEach(async () => {
    fileManager.cleanup();
  });

  test.describe('Platform-Specific Desktop Screenshots', () => {
    test('Dashboard should render consistently across desktop platforms', async ({ page, browserName }) => {
      await page.waitForTimeout(1000);
      
      // Take platform-specific screenshot
      await expect(page).toHaveScreenshot(`dashboard-${browserName}-desktop.png`, {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('Project creation modal should be consistent', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.waitForSelector('input[placeholder="Enter project name"]', { state: 'visible' });
      
      await expect(page).toHaveScreenshot(`project-creation-modal-${browserName}.png`, {
        animations: 'disabled'
      });
    });
  });

  test.describe('Desktop Resolution Testing', () => {
    const desktopSizes = [
      { name: 'standard', width: 1280, height: 720 },
      { name: 'large', width: 1920, height: 1080 },
      { name: 'ultrawide', width: 2560, height: 1080 },
      { name: 'small', width: 1024, height: 768 }
    ];

    for (const size of desktopSizes) {
      test(`Course form should adapt to ${size.name} desktop resolution`, async ({ page, browserName }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        
        await page.click('text=Create New Project');
        await page.fill('input[placeholder="Enter project name"]', `Test ${size.name}`);
        await page.click('button:has-text("Create")');
        
        await page.fill('input[placeholder*="course title"]', 'Resolution Test Course');
        await page.waitForTimeout(500);
        
        await expect(page).toHaveScreenshot(`course-form-${size.name}-${browserName}.png`, {
          fullPage: true,
          animations: 'disabled'
        });
      });
    }
  });

  test.describe('Component-Level Visual Testing', () => {
    test('Course seed form components should render consistently', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Component Test');
      await page.click('button:has-text("Create")');
      
      // Test form with filled data
      await page.fill('input[placeholder*="course title"]', 'Component Visual Test');
      await page.fill('textarea[placeholder*="List your course topics"]', 'Component Topic 1\nComponent Topic 2');
      await page.click('button:has-text("Advanced")');
      
      const formContainer = page.locator('main').first();
      await expect(formContainer).toHaveScreenshot(`course-form-components-${browserName}.png`, {
        animations: 'disabled'
      });
    });

    test('Button states should be visually consistent', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Button Test');
      await page.click('button:has-text("Create")');
      
      // Focus on difficulty buttons
      const difficultySection = page.locator('.difficulty, [data-testid*="difficulty"]').first();
      if (await difficultySection.isVisible()) {
        await expect(difficultySection).toHaveScreenshot(`difficulty-buttons-${browserName}.png`, {
          animations: 'disabled'
        });
      }
    });

    test('Progress navigation should render properly', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Progress Test');
      await page.click('button:has-text("Create")');
      
      const progressComponent = page.locator('[data-testid*="progress"], .progress, .steps').first();
      if (await progressComponent.isVisible()) {
        await expect(progressComponent).toHaveScreenshot(`progress-navigation-${browserName}.png`, {
          animations: 'disabled'
        });
      }
    });
  });

  test.describe('Cross-Platform Theme Testing', () => {
    test('Application should render consistently in dark mode', async ({ page, browserName }) => {
      // Enable dark mode preference
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(500);
      
      await expect(page).toHaveScreenshot(`dashboard-dark-mode-${browserName}.png`, {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('High DPI scaling should not break layout', async ({ page, browserName }) => {
      // Simulate high DPI display
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'High DPI Test');
      await page.click('button:has-text("Create")');
      
      await page.fill('input[placeholder*="course title"]', 'High DPI Course');
      
      await expect(page).toHaveScreenshot(`course-form-high-dpi-${browserName}.png`, {
        fullPage: true,
        animations: 'disabled'
      });
    });
  });

  test.describe('Font and Text Rendering', () => {
    test('Text should render consistently across platforms', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Font Test');
      await page.click('button:has-text("Create")');
      
      // Test various text elements with special characters
      await page.fill('input[placeholder*="course title"]', 'Font Test Course with Special Characters: àáâãäåæç');
      await page.fill('textarea[placeholder*="brief description"]', 'Testing font rendering with symbols: !@#$%^&*()');
      await page.fill('textarea[placeholder*="List your course topics"]', 'Typography Topic 1\nTypography Topic 2\nTypography Topic 3');
      
      await page.waitForTimeout(1000);
      
      const textContainer = page.locator('main').first();
      await expect(textContainer).toHaveScreenshot(`font-rendering-${browserName}.png`, {
        animations: 'disabled'
      });
    });
  });

  test.describe('Media Enhancement Visual Testing', () => {
    test('Media upload interface should render consistently', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Media Visual Test');
      await page.click('button:has-text("Create")');
      
      await page.fill('input[placeholder*="course title"]', 'Media Test Course');
      await page.click('button:has-text("Next")');
      
      // Wait for media page to load
      await expect(page.locator('h1:has-text("Media Enhancement")')).toBeVisible();
      await page.waitForTimeout(1000);
      
      // Take screenshot of media enhancement page
      await expect(page).toHaveScreenshot(`media-enhancement-${browserName}.png`, {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('Media with uploaded content should display properly', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Media Content Test');
      await page.click('button:has-text("Create")');
      
      await page.fill('input[placeholder*="course title"]', 'Media Content Course');
      await page.click('button:has-text("Next")');
      
      // Try to upload a test image
      const testImage = fileManager.createImageFile('visual-media-test.jpg', 100);
      const imageInput = page.locator('input[type="file"][accept*="image"]').first();
      
      if (await imageInput.isVisible()) {
        await fileManager.uploadFile(page, 'input[type="file"][accept*="image"]', testImage);
        await page.waitForTimeout(3000);
        
        await expect(page).toHaveScreenshot(`media-with-content-${browserName}.png`, {
          fullPage: true,
          animations: 'disabled'
        });
      }
    });
  });

  test.describe('Error State Visual Testing', () => {
    test('Form validation errors should render consistently', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Error State Test');
      await page.click('button:has-text("Create")');
      
      // Try to proceed without filling required fields
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(1000);
      
      // Take screenshot of validation error state
      await expect(page).toHaveScreenshot(`form-validation-errors-${browserName}.png`, {
        animations: 'disabled'
      });
    });

    test('Loading states should be visually consistent', async ({ page, browserName }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Loading Test');
      await page.click('button:has-text("Create")');
      
      // Fill form and trigger auto-save
      await page.fill('input[placeholder*="course title"]', 'Loading Test Course');
      
      const saveIndicator = page.locator('.saving, [data-testid*="save"], text=Saving').first();
      if (await saveIndicator.isVisible({ timeout: 3000 })) {
        await expect(saveIndicator).toHaveScreenshot(`save-loading-state-${browserName}.png`, {
          animations: 'disabled'
        });
      }
    });
  });

  // Legacy test compatibility - keeping minimal mobile test for Tauri window testing
  test('Desktop window should adapt to different aspect ratios', async ({ page, browserName }) => {
    // Test narrow window (portrait-like for desktop)
    await page.setViewportSize({ width: 900, height: 1200 });
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot(`narrow-window-${browserName}.png`, {
      fullPage: true,
      animations: 'disabled'
    });
  });
});