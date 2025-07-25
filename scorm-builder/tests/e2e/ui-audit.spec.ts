import { test, expect } from '@playwright/test';

test.describe('UI Audit Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
  });

  test('capture all workflow pages', async ({ page }) => {
    // 1. Course Seed page
    await page.screenshot({ path: 'screenshots/audit/1-course-seed.png', fullPage: true });

    // Fill in course seed to move forward
    await page.fill('input[placeholder="Enter your course title"]', 'Test Course');
    
    // Select difficulty by clicking a button
    await page.click('button:has-text("Medium")');
    
    // Select template
    await page.selectOption('#course-template-select', 'Corporate');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/audit/1-course-seed-filled.png', fullPage: true });

    // Click Next to AI Prompt
    await page.click('button:has-text("Continue to AI Prompt")');
    await page.waitForTimeout(1000);

    // 2. AI Prompt page
    await page.screenshot({ path: 'screenshots/audit/2-ai-prompt.png', fullPage: true });
    
    // Click Next to JSON Import
    await page.click('[data-testid="next-button"]');
    await page.waitForTimeout(1000);

    // 3. JSON Import page
    await page.screenshot({ path: 'screenshots/audit/3-json-import.png', fullPage: true });

    // Skip JSON Import - click Next
    await page.click('[data-testid="next-button"]');
    await page.waitForTimeout(1000);

    // 4. Media Enhancement page
    await page.screenshot({ path: 'screenshots/audit/4-media-enhancement.png', fullPage: true });

    // Click Next to Audio Narration
    await page.click('[data-testid="next-button"]');
    await page.waitForTimeout(1000);

    // 5. Audio Narration page
    await page.screenshot({ path: 'screenshots/audit/5-audio-narration.png', fullPage: true });

    // Click Next to Activities Editor
    await page.click('[data-testid="next-button"]');
    await page.waitForTimeout(1000);

    // 6. Activities Editor page
    await page.screenshot({ path: 'screenshots/audit/6-activities-editor.png', fullPage: true });

    // Click Next to SCORM Package
    await page.click('[data-testid="next-button"]');
    await page.waitForTimeout(1000);

    // 7. SCORM Package Builder page
    await page.screenshot({ path: 'screenshots/audit/7-scorm-package.png', fullPage: true });
  });

  test('capture modal dialogs', async ({ page }) => {
    // Open Project dialog
    await page.click('[data-testid="open-button"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/audit/modal-open-project.png', fullPage: true });
    await page.keyboard.press('Escape');

    // Settings dialog
    await page.click('[data-testid="settings-button"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/audit/modal-settings.png', fullPage: true });
    await page.keyboard.press('Escape');

    // Help dialog
    await page.click('[data-testid="help-button"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/audit/modal-help.png', fullPage: true });
    await page.keyboard.press('Escape');

    // Template Editor dialog
    await page.fill('input[placeholder="Enter your course title"]', 'Test Course');
    const manageTemplatesButton = await page.$('button:has-text("Manage Templates")');
    if (manageTemplatesButton) {
      await manageTemplatesButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/audit/modal-template-editor.png', fullPage: true });
      
      // Try scrolling in the modal
      const modalContent = await page.$('.modal-content, [role="dialog"] > div');
      if (modalContent) {
        await modalContent.evaluate(el => el.scrollTop = el.scrollHeight);
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'screenshots/audit/modal-template-editor-scrolled.png', fullPage: true });
      }
    }
  });

  test('check button consistency across pages', async ({ page }) => {
    const pages = [
      { name: 'course-seed', setup: null },
      { name: 'ai-prompt', setup: async () => {
        await page.fill('input[placeholder="Enter your course title"]', 'Test Course');
        await page.click('button:has-text("Continue to AI Prompt")');
        await page.waitForTimeout(1000);
      }},
      { name: 'json-import', setup: async () => {
        await page.click('button:has-text("Next")');
        await page.waitForTimeout(1000);
      }},
      { name: 'media-enhancement', setup: async () => {
        await page.click('button:has-text("Next")');
        await page.waitForTimeout(1000);
      }},
      { name: 'audio-narration', setup: async () => {
        await page.click('button:has-text("Next")');
        await page.waitForTimeout(1000);
      }},
      { name: 'activities-editor', setup: async () => {
        await page.click('button:has-text("Next")');
        await page.waitForTimeout(1000);
      }},
      { name: 'scorm-package', setup: async () => {
        await page.click('button:has-text("Next")');
        await page.waitForTimeout(1000);
      }}
    ];

    for (let i = 0; i < pages.length; i++) {
      if (i > 0 && pages[i].setup) {
        await pages[i].setup();
      }

      // Take screenshot focusing on the top bar
      const header = await page.$('header, .page-header, .header-buttons');
      if (header) {
        await header.screenshot({ path: `screenshots/audit/topbar-${pages[i].name}.png` });
      }

      // Check for specific buttons
      const buttons = {
        'undo': await page.$('button:has-text("Undo")'),
        'redo': await page.$('button:has-text("Redo")'),
        'preview': await page.$('button:has-text("Preview Course"), button:has-text("Preview")'),
        'reset': await page.$('button:has-text("Reset")'),
        'history': await page.$('button:has-text("History")'),
        'save-template': await page.$('button:has-text("Save as Template")')
      };

      console.log(`Page ${pages[i].name} buttons:`, {
        undo: !!buttons.undo,
        redo: !!buttons.redo,
        preview: !!buttons.preview,
        reset: !!buttons.reset,
        history: !!buttons.history,
        saveTemplate: !!buttons['save-template']
      });
    }
  });
});