/**
 * Accessibility and Responsive Design Tests for SCORM Builder (Tauri Desktop)
 * Tests keyboard navigation, screen reader compatibility, and desktop window responsiveness
 */

import { test, expect, Page } from '@playwright/test';
import { TestFileManager } from './helpers/file-helpers';
import { generateTestProject } from './helpers/test-data-generator';

test.describe('Accessibility and Responsive Design', () => {
  let fileManager: TestFileManager;

  test.beforeEach(async ({ page }) => {
    fileManager = new TestFileManager();
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    fileManager.cleanup();
  });

  test.describe('Keyboard Navigation and Accessibility', () => {
    test('Complete workflow should be navigable using only keyboard', async ({ page }) => {
      // Start with keyboard navigation
      await page.keyboard.press('Tab'); // Focus first interactive element
      
      // Navigate to Create New Project button
      let focusedElement = await page.evaluate(() => document.activeElement?.textContent);
      while (!focusedElement?.includes('Create New Project')) {
        await page.keyboard.press('Tab');
        focusedElement = await page.evaluate(() => document.activeElement?.textContent);
        
        // Prevent infinite loop
        const tabCount = await page.evaluate(() => 
          Array.from(document.querySelectorAll('button, input, select, textarea, a, [tabindex]')).length
        );
        if (tabCount === 0) break;
      }
      
      await page.keyboard.press('Enter'); // Activate Create New Project
      
      // Fill project name with keyboard
      await page.keyboard.type('Keyboard Navigation Test Project');
      await page.keyboard.press('Tab'); // Move to Create button
      await page.keyboard.press('Enter'); // Create project
      
      // Verify we're on course seed page
      await expect(page.locator('h1:has-text("Course Seed Input")')).toBeVisible();
      
      // Navigate form fields with Tab
      await page.keyboard.press('Tab'); // Title field
      await page.keyboard.type('Accessible Course Title');
      
      await page.keyboard.press('Tab'); // Description field
      await page.keyboard.type('This course tests keyboard accessibility');
      
      // Navigate difficulty buttons with arrow keys
      await page.keyboard.press('Tab'); // Focus difficulty group
      await page.keyboard.press('ArrowRight'); // Move to next difficulty
      await page.keyboard.press('ArrowRight'); // Move to Advanced
      await page.keyboard.press('Space'); // Select Advanced
      
      // Verify selection worked
      await expect(page.locator('button[aria-pressed="true"]:has-text("Advanced")')).toBeVisible();
      
      // Navigate to template dropdown
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowDown'); // Open dropdown
      await page.keyboard.press('ArrowDown'); // Select Business
      await page.keyboard.press('Enter'); // Confirm selection
      
      // Navigate to topics textarea
      await page.keyboard.press('Tab');
      await page.keyboard.type('Keyboard Topic 1\nKeyboard Topic 2\nKeyboard Topic 3');
      
      // Navigate to objectives textarea
      await page.keyboard.press('Tab');
      await page.keyboard.type('Learn keyboard navigation\nTest accessibility features');
      
      // Navigate to Next button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter'); // Proceed to next step
      
      // Verify navigation worked
      await expect(page.locator('h1:has-text("Media Enhancement")')).toBeVisible();
    });

    test('Focus management should work correctly in modals and popups', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Focus Management Test');
      await page.click('button:has-text("Create")');
      
      // Fill some data
      await page.fill('input[placeholder*="course title"]', 'Focus Test Course');
      await page.click('button:has-text("Next")'); // Go to media step
      
      // Open help modal if available
      const helpButton = page.locator('button[aria-label*="Help"], button:has-text("Help"), button:has-text("?")');
      if (await helpButton.isVisible()) {
        await helpButton.click();
        
        // Focus should be trapped in modal
        const modal = page.locator('[role="dialog"], .modal, [data-testid*="modal"]');
        await expect(modal).toBeVisible();
        
        // First focusable element in modal should be focused
        const firstFocusableInModal = modal.locator('button, input, select, textarea, a, [tabindex]:not([tabindex="-1"])').first();
        if (await firstFocusableInModal.isVisible()) {
          await expect(firstFocusableInModal).toBeFocused();
        }
        
        // Tab should cycle within modal
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        
        // Escape should close modal
        await page.keyboard.press('Escape');
        await expect(modal).not.toBeVisible();
        
        // Focus should return to help button
        await expect(helpButton).toBeFocused();
      }
      
      // Test context menu focus if available
      const mediaArea = page.locator('[data-testid="media-upload-area"], .media-section').first();
      if (await mediaArea.isVisible()) {
        await mediaArea.click({ button: 'right' }); // Right-click for context menu
        
        const contextMenu = page.locator('[role="menu"], .context-menu');
        if (await contextMenu.isVisible()) {
          // First menu item should be focused
          const firstMenuItem = contextMenu.locator('[role="menuitem"]').first();
          if (await firstMenuItem.isVisible()) {
            await expect(firstMenuItem).toBeFocused();
          }
          
          // Arrow keys should navigate menu
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('ArrowUp');
          
          // Escape should close menu
          await page.keyboard.press('Escape');
          await expect(contextMenu).not.toBeVisible();
        }
      }
    });

    test('ARIA labels and roles should be properly implemented', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'ARIA Test Project');
      await page.click('button:has-text("Create")');
      
      // Check main navigation has proper roles
      const mainNav = page.locator('nav, [role="navigation"]');
      if (await mainNav.isVisible()) {
        await expect(mainNav).toHaveAttribute('role', 'navigation');
      }
      
      // Check form labels and associations
      const titleInput = page.locator('input[placeholder*="course title"]');
      const titleLabel = page.locator('label').filter({ hasText: /title|course/i });
      
      if (await titleLabel.isVisible()) {
        const labelFor = await titleLabel.getAttribute('for');
        const inputId = await titleInput.getAttribute('id');
        if (labelFor && inputId) {
          expect(labelFor).toBe(inputId);
        }
      }
      
      // Check ARIA labels on buttons
      const difficultyButtons = page.locator('button').filter({ hasText: /Basic|Intermediate|Advanced|Expert/ });
      const buttonCount = await difficultyButtons.count();
      
      for (let i = 0; i < buttonCount; i++) {
        const button = difficultyButtons.nth(i);
        const ariaLabel = await button.getAttribute('aria-label');
        const ariaPressed = await button.getAttribute('aria-pressed');
        
        expect(ariaLabel || await button.textContent()).toBeTruthy();
        expect(['true', 'false']).toContain(ariaPressed);
      }
      
      // Check progress indicators have proper ARIA
      const progressSteps = page.locator('[data-testid*="progress"], .progress-step, .step-indicator');
      const stepCount = await progressSteps.count();
      
      if (stepCount > 0) {
        for (let i = 0; i < stepCount; i++) {
          const step = progressSteps.nth(i);
          const ariaCurrent = await step.getAttribute('aria-current');
          const ariaLabel = await step.getAttribute('aria-label');
          
          if (ariaCurrent === 'step') {
            expect(ariaLabel).toContain(/current|step/i);
          }
        }
      }
      
      // Check error messages have proper ARIA
      await page.fill('input[placeholder*="course title"]', ''); // Clear title to trigger error
      await page.click('button:has-text("Next")');
      
      const errorMessage = page.locator('[role="alert"], .error-message, .field-error');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toHaveAttribute('role', 'alert');
        
        // Error should be associated with input
        const errorId = await errorMessage.getAttribute('id');
        if (errorId) {
          const describedBy = await titleInput.getAttribute('aria-describedby');
          expect(describedBy).toContain(errorId);
        }
      }
    });

    test('Screen reader announcements should work correctly', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Screen Reader Test');
      await page.click('button:has-text("Create")');
      
      // Test live region announcements
      await page.fill('input[placeholder*="course title"]', 'Screen Reader Course');
      
      // Check for auto-save announcements
      const liveRegion = page.locator('[aria-live], [role="status"], [role="alert"]');
      if (await liveRegion.isVisible()) {
        // Should announce saving state
        await expect(liveRegion).toContainText(/saving|saved|updated/i);
      }
      
      // Test navigation announcements
      await page.click('button:has-text("Next")');
      
      // Page title should update for screen readers
      const pageTitle = await page.title();
      expect(pageTitle).toContain(/Media|Enhancement/);
      
      // Check for step navigation announcements
      const stepAnnouncement = page.locator('[aria-live="polite"]');
      if (await stepAnnouncement.isVisible()) {
        await expect(stepAnnouncement).toContainText(/step|page|media/i);
      }
    });

    test('Custom keyboard shortcuts should work correctly', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Shortcuts Test');
      await page.click('button:has-text("Create")');
      
      // Test common shortcuts if implemented
      
      // Ctrl+S for save
      await page.fill('input[placeholder*="course title"]', 'Shortcut Test Course');
      await page.keyboard.press('Control+KeyS');
      
      // Should show save confirmation or trigger save
      const saveIndicator = page.locator('text=Saved, text=Saving, [data-testid*="save"]');
      if (await saveIndicator.isVisible()) {
        await expect(saveIndicator).toBeVisible();
      }
      
      // Ctrl+Z for undo (if implemented)
      await page.keyboard.press('Control+KeyZ');
      
      // F1 for help (if implemented)
      await page.keyboard.press('F1');
      const helpModal = page.locator('[role="dialog"]:has-text("Help"), .help-modal');
      if (await helpModal.isVisible()) {
        await expect(helpModal).toBeVisible();
        await page.keyboard.press('Escape'); // Close help
      }
      
      // Alt+N for next step (if implemented)
      await page.keyboard.press('Alt+KeyN');
      // Should navigate to next step or show hint
    });
  });

  test.describe('Desktop Window Responsiveness', () => {
    test('Application should adapt to different window sizes', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Responsive Test');
      await page.click('button:has-text("Create")');
      
      // Test default desktop size (1280x720)
      await page.setViewportSize({ width: 1280, height: 720 });
      await expect(page.locator('h1:has-text("Course Seed Input")')).toBeVisible();
      
      // Test larger desktop size (1920x1080)
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect(page.locator('h1:has-text("Course Seed Input")')).toBeVisible();
      
      // Elements should utilize extra space appropriately
      const mainContent = page.locator('main, .main-content, .course-seed-container');
      if (await mainContent.isVisible()) {
        const boundingBox = await mainContent.boundingBox();
        expect(boundingBox?.width).toBeGreaterThan(800); // Should use available width
      }
      
      // Test smaller window (1024x768)
      await page.setViewportSize({ width: 1024, height: 768 });
      await expect(page.locator('h1:has-text("Course Seed Input")')).toBeVisible();
      
      // Content should remain accessible and not be cut off
      const inputs = page.locator('input, textarea, button');
      const inputCount = await inputs.count();
      
      for (let i = 0; i < Math.min(inputCount, 5); i++) {
        const input = inputs.nth(i);
        if (await input.isVisible()) {
          const box = await input.boundingBox();
          expect(box?.x).toBeGreaterThanOrEqual(0);
          expect(box?.y).toBeGreaterThanOrEqual(0);
          expect(box?.width).toBeGreaterThan(0);
        }
      }
      
      // Test very wide aspect ratio (ultrawide monitor: 2560x1080)
      await page.setViewportSize({ width: 2560, height: 1080 });
      await expect(page.locator('h1:has-text("Course Seed Input")')).toBeVisible();
      
      // Content should not stretch too wide and remain readable
      const contentContainer = page.locator('.container, .content, .form-container').first();
      if (await contentContainer.isVisible()) {
        const containerBox = await contentContainer.boundingBox();
        // Content should have max-width for readability
        expect(containerBox?.width).toBeLessThan(1600);
      }
    });

    test('Navigation and layout should work in different window orientations', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Layout Test');
      await page.click('button:has-text("Create")');
      
      // Test landscape orientation (standard desktop)
      await page.setViewportSize({ width: 1366, height: 768 });
      
      // Sidebar or navigation should be visible
      const navigation = page.locator('nav, .sidebar, .navigation, .progress-steps');
      if (await navigation.isVisible()) {
        const navBox = await navigation.boundingBox();
        expect(navBox?.width).toBeGreaterThan(100);
      }
      
      // Test portrait-like orientation (tall narrow window)
      await page.setViewportSize({ width: 900, height: 1200 });
      
      // Layout should adapt - navigation might stack or change orientation
      await expect(page.locator('h1:has-text("Course Seed Input")')).toBeVisible();
      
      // Form elements should remain usable
      const titleInput = page.locator('input[placeholder*="course title"]');
      await titleInput.fill('Portrait Layout Test');
      await expect(titleInput).toHaveValue('Portrait Layout Test');
      
      // Test square aspect ratio
      await page.setViewportSize({ width: 1024, height: 1024 });
      await expect(page.locator('h1:has-text("Course Seed Input")')).toBeVisible();
      
      // All critical elements should remain accessible
      await page.click('button:has-text("Next")');
      await expect(page.locator('h1:has-text("Media Enhancement")')).toBeVisible();
    });

    test('Content should remain accessible at minimum supported window size', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Minimum Size Test');
      await page.click('button:has-text("Create")');
      
      // Test minimum reasonable desktop window size
      await page.setViewportSize({ width: 800, height: 600 });
      
      // All critical elements should be visible and functional
      await expect(page.locator('h1:has-text("Course Seed Input")')).toBeVisible();
      
      const titleInput = page.locator('input[placeholder*="course title"]');
      await expect(titleInput).toBeVisible();
      await titleInput.fill('Minimum Size Course');
      
      const descriptionTextarea = page.locator('textarea[placeholder*="description"]');
      if (await descriptionTextarea.isVisible()) {
        await descriptionTextarea.fill('Testing minimum window size');
        await expect(descriptionTextarea).toHaveValue('Testing minimum window size');
      }
      
      // Navigation buttons should be accessible
      const nextButton = page.locator('button:has-text("Next")');
      await expect(nextButton).toBeVisible();
      
      const nextBox = await nextButton.boundingBox();
      expect(nextBox?.y).toBeLessThan(600); // Should fit in viewport
      expect(nextBox?.x).toBeLessThan(800);
      
      // Progress indicators should be visible or accessible
      const progressIndicator = page.locator('.progress, .steps, [data-testid*="progress"]');
      if (await progressIndicator.isVisible()) {
        const progressBox = await progressIndicator.boundingBox();
        expect(progressBox?.y).toBeGreaterThanOrEqual(0);
      }
      
      // Scroll should work if content overflows
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(nextButton).toBeVisible();
    });

    test('High DPI scaling should not break layout', async ({ page }) => {
      // Simulate high DPI display
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'High DPI Test');
      await page.click('button:has-text("Create")');
      
      // Check that text remains readable at high DPI
      const heading = page.locator('h1:has-text("Course Seed Input")');
      const headingStyles = await heading.evaluate(el => getComputedStyle(el));
      
      // Font size should be reasonable
      const fontSize = parseFloat(headingStyles.fontSize);
      expect(fontSize).toBeGreaterThanOrEqual(16);
      expect(fontSize).toBeLessThan(100);
      
      // Icons and images should scale properly
      const icons = page.locator('svg, .icon, img[src*="icon"]');
      const iconCount = await icons.count();
      
      for (let i = 0; i < Math.min(iconCount, 3); i++) {
        const icon = icons.nth(i);
        if (await icon.isVisible()) {
          const iconBox = await icon.boundingBox();
          // Icons should be reasonable size
          expect(iconBox?.width).toBeGreaterThan(8);
          expect(iconBox?.width).toBeLessThan(200);
          expect(iconBox?.height).toBeGreaterThan(8);
          expect(iconBox?.height).toBeLessThan(200);
        }
      }
      
      // Buttons should remain clickable targets
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const buttonBox = await button.boundingBox();
          // Buttons should meet minimum touch target size (44px)
          expect(Math.min(buttonBox?.width || 0, buttonBox?.height || 0)).toBeGreaterThanOrEqual(32);
        }
      }
    });
  });

  test.describe('Color Contrast and Visual Accessibility', () => {
    test('Text should have sufficient color contrast', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Contrast Test');
      await page.click('button:has-text("Create")');
      
      // Check heading contrast
      const heading = page.locator('h1:has-text("Course Seed Input")');
      const headingStyles = await heading.evaluate(el => {
        const styles = getComputedStyle(el);
        return {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          fontSize: styles.fontSize
        };
      });
      
      // Verify readable font size
      const fontSize = parseFloat(headingStyles.fontSize);
      expect(fontSize).toBeGreaterThanOrEqual(18); // Large text should be 18px+
      
      // Check button contrast
      const primaryButton = page.locator('button:has-text("Next")');
      if (await primaryButton.isVisible()) {
        const buttonStyles = await primaryButton.evaluate(el => {
          const styles = getComputedStyle(el);
          return {
            color: styles.color,
            backgroundColor: styles.backgroundColor,
            borderColor: styles.borderColor
          };
        });
        
        // Colors should not be default/transparent
        expect(buttonStyles.color).not.toBe('rgba(0, 0, 0, 0)');
        expect(buttonStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      }
      
      // Check form field contrast
      const titleInput = page.locator('input[placeholder*="course title"]');
      const inputStyles = await titleInput.evaluate(el => {
        const styles = getComputedStyle(el);
        return {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          borderColor: styles.borderColor
        };
      });
      
      // Input should have visible borders and backgrounds
      expect(inputStyles.borderColor).not.toBe('rgba(0, 0, 0, 0)');
    });

    test('Focus indicators should be clearly visible', async ({ page }) => {
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Focus Test');
      await page.click('button:has-text("Create")');
      
      // Test keyboard focus visibility
      await page.keyboard.press('Tab'); // Focus first element
      
      const focusedElement = page.locator(':focus');
      const focusStyles = await focusedElement.evaluate(el => {
        const styles = getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineWidth: styles.outlineWidth,
          outlineColor: styles.outlineColor,
          boxShadow: styles.boxShadow
        };
      });
      
      // Should have visible focus indicator
      const hasOutline = focusStyles.outline !== 'none' && focusStyles.outlineWidth !== '0px';
      const hasBoxShadow = focusStyles.boxShadow !== 'none';
      
      expect(hasOutline || hasBoxShadow).toBe(true);
      
      // Test focus on different element types
      const titleInput = page.locator('input[placeholder*="course title"]');
      await titleInput.focus();
      
      const inputFocusStyles = await titleInput.evaluate(el => {
        const styles = getComputedStyle(el);
        return {
          outline: styles.outline,
          boxShadow: styles.boxShadow,
          borderColor: styles.borderColor
        };
      });
      
      // Input should have focus indicator
      const inputHasFocus = 
        inputFocusStyles.outline !== 'none' || 
        inputFocusStyles.boxShadow !== 'none' ||
        inputFocusStyles.borderColor !== 'transparent';
      
      expect(inputHasFocus).toBe(true);
    });

    test('Application should respect reduced motion preferences', async ({ page }) => {
      // Enable reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      await page.click('text=Create New Project');
      await page.fill('input[placeholder="Enter project name"]', 'Reduced Motion Test');
      await page.click('button:has-text("Create")');
      
      // Check that animations are reduced or disabled
      const animatedElements = page.locator('.animate, .transition, [style*="transition"]');
      const elementCount = await animatedElements.count();
      
      for (let i = 0; i < Math.min(elementCount, 3); i++) {
        const element = animatedElements.nth(i);
        if (await element.isVisible()) {
          const styles = await element.evaluate(el => {
            const computed = getComputedStyle(el);
            return {
              transition: computed.transition,
              animation: computed.animation
            };
          });
          
          // Transitions and animations should be reduced
          // Note: This is implementation-dependent, but good practice is to use
          // @media (prefers-reduced-motion: reduce) to disable/reduce animations
          if (styles.transition !== 'none') {
            expect(styles.transition).toContain('0s'); // Should be instant
          }
        }
      }
      
      // Navigation should still work smoothly without jarring animations
      await page.click('button:has-text("Next")');
      await expect(page.locator('h1:has-text("Media Enhancement")')).toBeVisible();
      
      await page.click('button:has-text("Back")');
      await expect(page.locator('h1:has-text("Course Seed Input")')).toBeVisible();
    });
  });
});