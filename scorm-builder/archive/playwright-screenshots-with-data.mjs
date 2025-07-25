import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureAllScreenshots() {
  const screenshotsDir = path.join(__dirname, 'screenshots-output');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Read test data
  const testData = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-course-data.json'), 'utf8'));

  console.log(`Screenshots will be saved to: ${screenshotsDir}\n`);

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 200
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');

    // Inject the test data into localStorage to simulate a loaded project
    await page.evaluate((data) => {
      localStorage.setItem('scorm-builder-current-project', JSON.stringify(data));
      localStorage.setItem('scorm-builder-has-data', 'true');
    }, testData);

    // Reload to apply the data
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log('📸 Taking screenshots of all pages...\n');

    // 1. Course Seed Input (with data loaded)
    console.log('1. Course Seed Input page...');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-course-seed-input-loaded.png'),
      fullPage: true 
    });

    // 2. AI Prompt Generator
    console.log('2. Navigating to AI Prompt Generator...');
    const continueBtn = await page.$('button:has-text("Continue")') || await page.$('button:has-text("Next")');
    if (continueBtn) {
      await continueBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '02-ai-prompt-generator.png'),
        fullPage: true 
      });
    }

    // 3. Activities Editor (click step 3 or navigate)
    console.log('3. Activities Editor...');
    const step3 = await page.$('button:has-text("3")') || await page.$('text=Activities');
    if (step3) {
      await step3.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '03-activities-editor.png'),
        fullPage: true 
      });
    }

    // 4. JSON Import/Export (step 4)
    console.log('4. JSON Import/Export...');
    const step4 = await page.$('button:has-text("4")');
    if (step4) {
      await step4.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '04-json-import-export.png'),
        fullPage: true 
      });
    }

    // 5. Media Enhancement Wizard
    console.log('5. Media Enhancement Wizard...');
    const step5 = await page.$('button:has-text("5")');
    if (step5) {
      await step5.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '05-media-enhancement-wizard.png'),
        fullPage: true 
      });
    }

    // 6. Audio Narration Wizard
    console.log('6. Audio Narration Wizard...');
    const step6 = await page.$('button:has-text("6")');
    if (step6) {
      await step6.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '06-audio-narration-wizard.png'),
        fullPage: true 
      });
    }

    // 7. SCORM Package Builder
    console.log('7. SCORM Package Builder...');
    const step7 = await page.$('button:has-text("7")');
    if (step7) {
      await step7.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '07-scorm-package-builder.png'),
        fullPage: true 
      });
    }

    // Navigate back to step 1 for modal screenshots
    const step1 = await page.$('button:has-text("1")');
    if (step1) {
      await step1.click();
      await page.waitForTimeout(500);
    }

    // 8. Settings Modal
    console.log('8. Settings Modal...');
    await page.click('button[aria-label="Application settings"]');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '08-settings-modal.png'),
      fullPage: true 
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 9. Help Modal
    console.log('9. Help Modal...');
    await page.click('button[aria-label="Help documentation"]');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '09-help-modal.png'),
      fullPage: true 
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 10. Open Project Dialog
    console.log('10. Open Project Dialog...');
    await page.click('button[aria-label="Open project"]');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '10-open-project-dialog.png'),
      fullPage: true 
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 11. Save Project Dialog
    console.log('11. Save Project Dialog...');
    await page.click('button[aria-label="Save project"]');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '11-save-project-dialog.png'),
      fullPage: true 
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 12. Preview Course Modal
    console.log('12. Course Preview Modal...');
    const previewBtn = await page.$('button:has-text("Preview Course")');
    if (previewBtn) {
      await previewBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '12-course-preview-modal.png'),
        fullPage: true 
      });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 13. Template Manager
    console.log('13. Template Manager...');
    const templateBtn = await page.$('button:has-text("Manage Templates")');
    if (templateBtn) {
      await templateBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '13-template-manager.png'),
        fullPage: true 
      });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 14. Step Progress Indicator (close-up)
    console.log('14. Step Progress Indicator...');
    const stepProgress = await page.$('.step-progress');
    if (stepProgress) {
      const box = await stepProgress.boundingBox();
      if (box) {
        await page.screenshot({ 
          path: path.join(screenshotsDir, '14-step-progress-indicator.png'),
          clip: {
            x: box.x - 20,
            y: box.y - 20,
            width: box.width + 40,
            height: box.height + 40
          }
        });
      }
    }

    // 15. Button hover states demo
    console.log('15. UI Enhancement demos...');
    // Navigate to a page with buttons
    const buttons = await page.$$('.btn');
    if (buttons.length > 0) {
      await buttons[0].hover();
      await page.waitForTimeout(200);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '15-button-hover-state.png'),
        fullPage: true 
      });
    }

    // 16. Card with enhanced styling
    const cards = await page.$$('.card');
    if (cards.length > 0) {
      await cards[0].hover();
      await page.waitForTimeout(200);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '16-card-hover-state.png'),
        fullPage: true 
      });
    }

    console.log('\n✅ All screenshots captured successfully!\n');
    console.log(`📁 Location: ${screenshotsDir}\n`);
    
    const files = fs.readdirSync(screenshotsDir);
    console.log('📸 Screenshots saved:');
    files.filter(f => f.endsWith('.png')).sort().forEach(file => {
      console.log(`   - ${file}`);
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

captureAllScreenshots().catch(console.error);