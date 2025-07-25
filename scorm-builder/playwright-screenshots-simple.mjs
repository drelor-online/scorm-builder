import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureAvailableScreenshots() {
  const screenshotsDir = path.join(__dirname, 'screenshots-output');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log(`📁 Screenshots directory: ${screenshotsDir}\n`);

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  let screenshotCount = 0;

  try {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');

    // 1. Initial state
    console.log('Capturing initial page...');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-initial-page.png'),
      fullPage: true 
    });
    screenshotCount++;

    // 2. Fill course seed form
    console.log('Filling course seed form...');
    await page.fill('input[placeholder*="course title" i]', 'Introduction to Web Development');
    await page.click('button:has-text("Medium")');
    await page.fill('textarea', 'HTML, CSS, JavaScript, React, Node.js, Express, MongoDB, REST APIs');
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02-course-seed-filled.png'),
      fullPage: true 
    });
    screenshotCount++;

    // 3. All modals that can be opened from main screen
    console.log('Capturing modals...');
    
    // Settings
    try {
      await page.click('button[aria-label="Application settings"]');
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '03-settings-modal.png'),
        fullPage: true 
      });
      screenshotCount++;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } catch (e) {
      console.log('Settings modal not found');
    }

    // Help
    try {
      await page.click('button[aria-label="Help documentation"]');
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '04-help-modal.png'),
        fullPage: true 
      });
      screenshotCount++;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } catch (e) {
      console.log('Help modal not found');
    }

    // Open Project
    try {
      await page.click('button[aria-label="Open project"]');
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '05-open-project-dialog.png'),
        fullPage: true 
      });
      screenshotCount++;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } catch (e) {
      console.log('Open project dialog not found');
    }

    // Save Project
    try {
      await page.click('button[aria-label="Save project"]');
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '06-save-project-dialog.png'),
        fullPage: true 
      });
      screenshotCount++;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } catch (e) {
      console.log('Save project dialog not found');
    }

    // Preview Course
    try {
      const previewBtn = await page.$('button:has-text("Preview Course")');
      if (previewBtn) {
        await previewBtn.click();
        await page.waitForTimeout(800);
        await page.screenshot({ 
          path: path.join(screenshotsDir, '07-course-preview.png'),
          fullPage: true 
        });
        screenshotCount++;
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    } catch (e) {
      console.log('Preview button not found');
    }

    // Template Manager
    try {
      const templateBtn = await page.$('button:has-text("Manage Templates")');
      if (templateBtn) {
        await templateBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ 
          path: path.join(screenshotsDir, '08-template-manager.png'),
          fullPage: true 
        });
        screenshotCount++;
      }
    } catch (e) {
      console.log('Template manager not found');
    }

    // 4. Capture UI elements close-up
    console.log('Capturing UI elements...');

    // Step progress indicator
    const stepProgress = await page.$('.step-progress');
    if (stepProgress) {
      const box = await stepProgress.boundingBox();
      if (box) {
        await page.screenshot({ 
          path: path.join(screenshotsDir, '09-step-progress-indicator.png'),
          clip: {
            x: Math.max(0, box.x - 20),
            y: Math.max(0, box.y - 20),
            width: box.width + 40,
            height: box.height + 40
          }
        });
        screenshotCount++;
      }
    }

    // Buttons with hover
    const buttons = await page.$$('.btn');
    if (buttons.length > 0) {
      await buttons[0].hover();
      await page.waitForTimeout(200);
      const box = await buttons[0].boundingBox();
      if (box) {
        await page.screenshot({ 
          path: path.join(screenshotsDir, '10-button-hover-state.png'),
          clip: {
            x: Math.max(0, box.x - 20),
            y: Math.max(0, box.y - 20),
            width: box.width + 40,
            height: box.height + 40
          }
        });
        screenshotCount++;
      }
    }

    // Cards
    const cards = await page.$$('.card');
    if (cards.length > 0) {
      const box = await cards[0].boundingBox();
      if (box) {
        await page.screenshot({ 
          path: path.join(screenshotsDir, '11-card-component.png'),
          clip: {
            x: Math.max(0, box.x - 20),
            y: Math.max(0, box.y - 20),
            width: Math.min(box.width + 40, 800),
            height: Math.min(box.height + 40, 600)
          }
        });
        screenshotCount++;
      }
    }

    // Input fields with focus
    const inputs = await page.$$('input, textarea');
    if (inputs.length > 0) {
      await inputs[0].focus();
      await page.waitForTimeout(200);
      const box = await inputs[0].boundingBox();
      if (box) {
        await page.screenshot({ 
          path: path.join(screenshotsDir, '12-input-focus-state.png'),
          clip: {
            x: Math.max(0, box.x - 20),
            y: Math.max(0, box.y - 20),
            width: Math.min(box.width + 40, 600),
            height: box.height + 40
          }
        });
        screenshotCount++;
      }
    }

    console.log(`\n✅ Successfully captured ${screenshotCount} screenshots!\n`);
    console.log(`📁 Location: ${screenshotsDir}\n`);
    
    const files = fs.readdirSync(screenshotsDir);
    console.log('📸 Screenshots saved:');
    files.filter(f => f.endsWith('.png')).sort().forEach(file => {
      const stats = fs.statSync(path.join(screenshotsDir, file));
      const size = (stats.size / 1024).toFixed(1);
      console.log(`   - ${file} (${size} KB)`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'error-state.png'),
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
}

captureAvailableScreenshots().catch(console.error);