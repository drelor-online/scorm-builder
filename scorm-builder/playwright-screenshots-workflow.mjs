import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureWorkflowScreenshots() {
  const screenshotsDir = path.join(__dirname, 'screenshots-output');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log(`Screenshots will be saved to: ${screenshotsDir}\n`);

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');

    // 1. Initial Course Seed Input
    console.log('1. Capturing Course Seed Input page...');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-course-seed-input-empty.png'),
      fullPage: true 
    });

    // 2. Fill the form
    console.log('2. Filling course seed form...');
    await page.fill('input[placeholder*="course title" i]', 'Introduction to Web Development');
    await page.click('button:has-text("Medium")');
    await page.fill('textarea', 'HTML fundamentals, CSS styling and layouts, JavaScript programming, React framework, Node.js backend development, RESTful APIs, Database design');
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02-course-seed-input-filled.png'),
      fullPage: true 
    });

    // 3. Click Continue to AI Prompt
    console.log('3. Navigating to AI Prompt...');
    const continueBtn = await page.$('button:has-text("Continue to AI Prompt")');
    if (continueBtn) {
      await continueBtn.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: path.join(screenshotsDir, '03-ai-prompt-generator.png'),
        fullPage: true 
      });

      // Continue through the workflow
      const nextBtn = await page.$('button:has-text("Continue")') || await page.$('button:has-text("Next")');
      if (nextBtn) {
        await nextBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // 4. Activities Editor (if we reach it)
    console.log('4. Looking for Activities Editor...');
    await page.waitForTimeout(1000);
    const activitiesVisible = await page.$('text=Activities Editor') || await page.$('text=Activities');
    if (activitiesVisible) {
      await page.screenshot({ 
        path: path.join(screenshotsDir, '04-activities-editor.png'),
        fullPage: true 
      });
    }

    // 5. Media Enhancement (navigate via step numbers if available)
    console.log('5. Trying to navigate via step indicators...');
    const step5 = await page.$('button:has-text("5")');
    if (step5) {
      await step5.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '05-media-enhancement-wizard.png'),
        fullPage: true 
      });
    }

    // 6. Audio Narration
    const step6 = await page.$('button:has-text("6")');
    if (step6) {
      await step6.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '06-audio-narration-wizard.png'),
        fullPage: true 
      });
    }

    // 7. SCORM Package Builder
    const step7 = await page.$('button:has-text("7")');
    if (step7) {
      await step7.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '07-scorm-package-builder.png'),
        fullPage: true 
      });
    }

    // Go back to beginning for modal screenshots
    const step1 = await page.$('button:has-text("1")');
    if (step1) {
      await step1.click();
      await page.waitForTimeout(1000);
    }

    // 8. Settings Modal
    console.log('8. Opening Settings modal...');
    const settingsBtn = await page.$('button[aria-label="Application settings"]');
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '08-settings-modal.png'),
        fullPage: true 
      });
      await page.keyboard.press('Escape');
    }

    // 9. Help Modal
    console.log('9. Opening Help modal...');
    const helpBtn = await page.$('button[aria-label="Help documentation"]');
    if (helpBtn) {
      await helpBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '09-help-modal.png'),
        fullPage: true 
      });
      await page.keyboard.press('Escape');
    }

    // 10. Open Project Dialog
    console.log('10. Opening Open Project dialog...');
    const openBtn = await page.$('button[aria-label="Open project"]');
    if (openBtn) {
      await openBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '10-open-project-dialog.png'),
        fullPage: true 
      });
      await page.keyboard.press('Escape');
    }

    // 11. Save Project Dialog
    console.log('11. Opening Save dialog...');
    const saveBtn = await page.$('button[aria-label="Save project"]');
    if (saveBtn) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '11-save-project-dialog.png'),
        fullPage: true 
      });
      await page.keyboard.press('Escape');
    }

    // 12. Preview Course Modal
    console.log('12. Opening Course Preview...');
    const previewBtn = await page.$('button:has-text("Preview Course")');
    if (previewBtn) {
      await previewBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '12-course-preview-modal.png'),
        fullPage: true 
      });
      await page.keyboard.press('Escape');
    }

    // 13. Template Manager
    console.log('13. Opening Template Manager...');
    const templateBtn = await page.$('button:has-text("Manage Templates")');
    if (templateBtn) {
      await templateBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '13-template-manager.png'),
        fullPage: true 
      });
    }

    // 14. Take a screenshot showing the step progress indicator
    console.log('14. Capturing UI enhancements...');
    const stepProgress = await page.$('.step-progress');
    if (stepProgress) {
      await stepProgress.scrollIntoViewIfNeeded();
      await page.screenshot({ 
        path: path.join(screenshotsDir, '14-step-progress-indicator.png'),
        fullPage: false,
        clip: await stepProgress.boundingBox()
      });
    }

    // 15. Final full page screenshot
    console.log('15. Final full page screenshot...');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '15-final-full-page.png'),
      fullPage: true 
    });

    console.log(`\n✅ Screenshots saved successfully!\n`);
    console.log(`📁 Location: ${screenshotsDir}\n`);
    
    const files = fs.readdirSync(screenshotsDir);
    console.log('📸 Screenshots captured:');
    files.filter(f => f.endsWith('.png')).forEach(file => {
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

captureWorkflowScreenshots().catch(console.error);