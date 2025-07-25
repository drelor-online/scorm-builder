const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

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
    console.log('Please ensure the dev server is running (npm run dev)');
    console.log('Waiting 3 seconds before starting...');
    await page.waitForTimeout(3000);

    // Navigate to the app
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // 1. Home page / Course Seed Input
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-home-course-seed-input.png'),
      fullPage: true 
    });

    // 2. Fill in course seed data
    await page.fill('input[placeholder*="course title"]', 'Introduction to Web Development');
    await page.click('text=Medium');
    await page.fill('textarea', 'HTML, CSS, JavaScript, React, Node.js');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02-course-seed-filled.png'),
      fullPage: true 
    });

    // 3. Generate course (if button exists)
    const generateButton = await page.$('text=Generate Course');
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
    const activitiesTab = await page.$('text=Activities');
    if (activitiesTab) {
      await activitiesTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '04-activities-editor.png'),
        fullPage: true 
      });
    }

    // 5. Media Enhancement
    const mediaTab = await page.$('text=Media');
    if (mediaTab) {
      await mediaTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '05-media-enhancement.png'),
        fullPage: true 
      });
    }

    // 6. Audio Narration
    const audioTab = await page.$('text=Audio');
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
      const closeButton = await page.$('button[aria-label="Close modal"]');
      if (closeButton) await closeButton.click();
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
      const closeButton = await page.$('button[aria-label="Close modal"]');
      if (closeButton) await closeButton.click();
    }

    // 9. Preview Course (if available)
    const previewButton = await page.$('text=Preview Course');
    if (previewButton) {
      await previewButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '09-course-preview.png'),
        fullPage: true 
      });
      
      // Close preview
      const closeButton = await page.$('button[aria-label="Close modal"]');
      if (closeButton) await closeButton.click();
    }

    // 10. Export/Build SCORM
    const exportTab = await page.$('text=Export');
    if (exportTab) {
      await exportTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '10-export-scorm.png'),
        fullPage: true 
      });
    }

    // 11. Open Project dialog
    const openButton = await page.$('text=Open');
    if (openButton) {
      await openButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '11-open-project-dialog.png'),
        fullPage: true 
      });
      
      // Close dialog
      const closeButton = await page.$('button[aria-label="Close modal"]');
      if (closeButton) await closeButton.click();
    }

    // 12. JSON Import
    const importButton = await page.$('text=Import JSON');
    if (importButton) {
      await importButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '12-json-import.png'),
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