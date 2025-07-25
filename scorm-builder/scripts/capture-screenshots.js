import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create screenshots directory
const screenshotsDir = path.join(__dirname, '..', 'screenshots-audit');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // Navigate to the app
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');

    // Step 1: Course Seed Input
    console.log('Capturing Course Seed Input page...');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-course-seed-input.png'),
      fullPage: true 
    });

    // Fill in course details
    await page.fill('input[placeholder*="Enter your course title"]', 'Test Course for Screenshots');
    await page.click('text=Hard');
    await page.fill('textarea[placeholder*="List your course topics"]', 'Topic 1\nTopic 2\nTopic 3');
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-course-seed-input-filled.png'),
      fullPage: true 
    });

    // Check for preview button
    const previewButton = await page.locator('text=Preview Course').isVisible();
    console.log('Preview Course button on Course Seed Input:', previewButton);

    // Continue to next step
    await page.click('text=Continue to AI Prompt');
    await page.waitForLoadState('networkidle');

    // Step 2: AI Prompt Generator
    console.log('Capturing AI Prompt Generator page...');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02-ai-prompt-generator.png'),
      fullPage: true 
    });

    // Check for buttons that should NOT exist
    const undoRedoExists = await page.locator('text=/undo|redo/i').count() > 0;
    const resetExists = await page.locator('button:has-text("Reset")').count() > 0;
    const historyExists = await page.locator('text=/history/i').count() > 0;
    const saveTemplateExists = await page.locator('text=/save as template/i').count() > 0;
    
    console.log('AI Prompt Generator - Undo/Redo exists:', undoRedoExists);
    console.log('AI Prompt Generator - Reset exists:', resetExists);
    console.log('AI Prompt Generator - History exists:', historyExists);
    console.log('AI Prompt Generator - Save as Template exists:', saveTemplateExists);

    // Check for preview button
    const previewButton2 = await page.locator('text=Preview Course').isVisible();
    console.log('Preview Course button on AI Prompt Generator:', previewButton2);

    // Click next
    await page.click('text=Next →');
    await page.waitForLoadState('networkidle');

    // Step 3: JSON Import Validator
    console.log('Capturing JSON Import Validator page...');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '03-json-import-validator.png'),
      fullPage: true 
    });

    // Check for undo/redo (should not exist)
    const jsonUndoRedoExists = await page.locator('text=/undo|redo/i').count() > 0;
    console.log('JSON Import Validator - Undo/Redo exists:', jsonUndoRedoExists);

    // Check for Reset button (should exist)
    const jsonResetExists = await page.locator('button[title*="Clear all content"]').isVisible();
    console.log('JSON Import Validator - Reset button exists:', jsonResetExists);

    // Paste some sample JSON
    await page.fill('textarea[placeholder*="Paste your JSON data here"]', '{"welcomePage": {"content": "Test"}}');
    await page.waitForTimeout(1000);

    // Step 4: Test Template Editor
    console.log('Testing Template Editor...');
    
    // Go back to first page
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
    
    // Open template editor
    await page.click('text=Manage Templates');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '04-template-editor-modal.png'),
      fullPage: true 
    });

    // Check if modal is scrollable
    const modalBody = await page.locator('.modal-body');
    if (await modalBody.count() > 0) {
      const scrollHeight = await modalBody.evaluate(el => el.scrollHeight);
      const clientHeight = await modalBody.evaluate(el => el.clientHeight);
      console.log('Template Editor Modal - Scrollable:', scrollHeight > clientHeight);
    }

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Navigate through remaining steps to check preview buttons
    await page.fill('input[placeholder*="Enter your course title"]', 'Test Course');
    await page.click('text=Continue to AI Prompt');
    await page.waitForLoadState('networkidle');
    await page.click('text=Next →');
    await page.waitForLoadState('networkidle');
    
    // Add valid JSON to proceed
    const validJson = `{
      "welcomePage": {
        "id": "welcome",
        "title": "Welcome",
        "content": "<h2>Welcome</h2>",
        "narration": "Welcome narration"
      },
      "learningObjectivesPage": {
        "id": "objectives",
        "title": "Learning Objectives",
        "content": "<h2>Objectives</h2>",
        "narration": "Objectives narration"
      },
      "topics": [{
        "id": "topic1",
        "title": "Topic 1",
        "content": "<h2>Topic 1</h2>",
        "narration": "Topic narration"
      }],
      "assessment": {
        "questions": []
      }
    }`;
    
    await page.fill('textarea[placeholder*="Paste your JSON data here"]', validJson);
    await page.waitForTimeout(1000);
    await page.click('text=Next →');
    await page.waitForLoadState('networkidle');

    // Step 5: Media Enhancement (if we get there)
    if (await page.locator('text=/media enhancement/i').isVisible()) {
      console.log('Capturing Media Enhancement page...');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '05-media-enhancement.png'),
        fullPage: true 
      });
      
      const mediaPreviewButton = await page.locator('text=Preview Course').isVisible();
      console.log('Preview Course button on Media Enhancement:', mediaPreviewButton);
    }

    console.log('\n=== Summary ===');
    console.log('Screenshots saved to:', screenshotsDir);
    console.log('Please review the screenshots to verify all UX fixes are working correctly.');

  } catch (error) {
    console.error('Error during screenshot capture:', error);
  } finally {
    await browser.close();
  }
})();