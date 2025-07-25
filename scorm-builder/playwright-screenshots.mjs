import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeScreenshots() {
  // Create screenshots directory
  const screenshotsDir = path.join(__dirname, 'screenshots-output');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log(`Screenshots will be saved to: ${screenshotsDir}`);

  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // Start the dev server first
    console.log('Navigating to the app...');

    // Navigate to the app
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');

    // 1. Home page / Course Seed Input
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-home-course-seed-input.png'),
      fullPage: true 
    });

    // 2. Fill in course seed data
    await page.fill('input[placeholder*="course title"]', 'Introduction to Web Development');
    const mediumButton = await page.$('button:has-text("Medium")');
    if (mediumButton) await mediumButton.click();
    await page.fill('textarea', 'HTML, CSS, JavaScript, React, Node.js');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02-course-seed-filled.png'),
      fullPage: true 
    });

    // 3. Generate course (if button exists)
    const generateButton = await page.$('button:has-text("Generate Course")');
    if (generateButton) {
      await generateButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '03-course-generation.png'),
        fullPage: true 
      });
    }

    // 4. Try to navigate to different sections
    // Activities Editor
    const activitiesTab = await page.$('button:has-text("Activities")');
    if (activitiesTab) {
      await activitiesTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '04-activities-editor.png'),
        fullPage: true 
      });
    }

    // 5. Media Enhancement
    const mediaTab = await page.$('button:has-text("Media")');
    if (mediaTab) {
      await mediaTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '05-media-enhancement.png'),
        fullPage: true 
      });
    }

    // 6. Audio Narration
    const audioTab = await page.$('button:has-text("Audio")');
    if (audioTab) {
      await audioTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '06-audio-narration.png'),
        fullPage: true 
      });
    }

    // 7. Settings
    const settingsButton = await page.$('button[aria-label*="Settings"]');
    if (settingsButton) {
      await settingsButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '07-settings-modal.png'),
        fullPage: true 
      });
      
      // Close settings
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // 8. Help page
    const helpButton = await page.$('button[aria-label*="Help"]');
    if (helpButton) {
      await helpButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '08-help-modal.png'),
        fullPage: true 
      });
      
      // Close help
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // 9. Preview Course (if available)
    const previewButton = await page.$('button:has-text("Preview")');
    if (previewButton) {
      await previewButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '09-course-preview.png'),
        fullPage: true 
      });
      
      // Close preview
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // 10. Export/Build SCORM
    const exportTab = await page.$('button:has-text("Export")');
    if (exportTab) {
      await exportTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '10-export-scorm.png'),
        fullPage: true 
      });
    }

    // 11. Open Project dialog
    const openButton = await page.$('button:has-text("Open")');
    if (openButton) {
      await openButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '11-open-project-dialog.png'),
        fullPage: true 
      });
      
      // Close dialog
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // 12. Save button
    const saveButton = await page.$('button:has-text("Save")');
    if (saveButton) {
      await saveButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '12-save-dialog.png'),
        fullPage: true 
      });
    }

    console.log(`\nScreenshots saved successfully to:\n${screenshotsDir}`);
    console.log('\nScreenshots taken:');
    const files = fs.readdirSync(screenshotsDir);
    files.forEach(file => {
      if (file.endsWith('.png')) {
        console.log(`- ${file}`);
      }
    });

  } catch (error) {
    console.error('Error taking screenshots:', error);
  } finally {
    await browser.close();
  }
}

// Run the screenshot script
takeScreenshots().catch(console.error);