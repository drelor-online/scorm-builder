import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function completeWalkthrough() {
  const screenshotsDir = path.join(__dirname, 'screenshots-complete');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log(`📁 Screenshots directory: ${screenshotsDir}\n`);

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slower to ensure UI updates properly
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  let screenshotCount = 0;

  try {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');

    // Step 1: Course Seed Input
    console.log('📸 Step 1: Course Seed Input');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-course-seed-empty.png'),
      fullPage: true 
    });
    screenshotCount++;

    // Fill the form
    await page.fill('input[placeholder*="course title" i]', 'Complete Web Development Masterclass');
    await page.click('button:has-text("Medium")');
    await page.fill('textarea', 'HTML5 semantic elements, CSS3 flexbox and grid, JavaScript ES6+, React hooks and components, Node.js and Express, MongoDB database, RESTful API design, Authentication and security, Deployment strategies');
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02-course-seed-filled.png'),
      fullPage: true 
    });
    screenshotCount++;

    // Click Continue to AI Prompt
    console.log('📸 Step 2: AI Prompt Generator');
    await page.click('button:has-text("Continue to AI Prompt")');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '03-ai-prompt-initial.png'),
      fullPage: true 
    });
    screenshotCount++;

    // Fill AI Prompt fields if they exist
    const promptTextarea = await page.$('textarea[placeholder*="prompt" i], textarea[placeholder*="instruction" i], textarea');
    if (promptTextarea) {
      await promptTextarea.fill('Create a comprehensive web development course with practical exercises and real-world projects. Include modern best practices and industry standards.');
    }

    // Look for Generate or Continue button
    let nextButton = await page.$('button:has-text("Generate")') || 
                     await page.$('button:has-text("Continue")') || 
                     await page.$('button:has-text("Next")');
    
    if (nextButton) {
      await nextButton.click();
      await page.waitForTimeout(3000); // Wait for generation
      
      await page.screenshot({ 
        path: path.join(screenshotsDir, '04-ai-prompt-generated.png'),
        fullPage: true 
      });
      screenshotCount++;
    }

    // Step 3: Activities Editor
    console.log('📸 Step 3: Activities Editor');
    // Try multiple ways to navigate
    let step3 = await page.$('button:has-text("3")') || 
                await page.$('a:has-text("Activities")') ||
                await page.$('button:has-text("Activities")') ||
                await page.$('button:has-text("Continue")');
    
    if (step3) {
      await step3.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: path.join(screenshotsDir, '05-activities-editor.png'),
        fullPage: true 
      });
      screenshotCount++;

      // Try to add an activity
      const addActivityBtn = await page.$('button:has-text("Add Activity")') || 
                             await page.$('button:has-text("New Activity")');
      if (addActivityBtn) {
        await addActivityBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ 
          path: path.join(screenshotsDir, '06-add-activity-dialog.png'),
          fullPage: true 
        });
        screenshotCount++;
        await page.keyboard.press('Escape');
      }
    }

    // Step 4: JSON Import/Export
    console.log('📸 Step 4: JSON Import/Export');
    let step4 = await page.$('button:has-text("4")') || 
                await page.$('button:has-text("JSON")') ||
                await page.$('button:has-text("Import/Export")');
    
    if (step4) {
      await step4.click();
      await page.waitForTimeout(1500);
      
      await page.screenshot({ 
        path: path.join(screenshotsDir, '07-json-import-export.png'),
        fullPage: true 
      });
      screenshotCount++;
    }

    // Step 5: Media Enhancement
    console.log('📸 Step 5: Media Enhancement');
    let step5 = await page.$('button:has-text("5")') || 
                await page.$('button:has-text("Media")') ||
                await page.$('a:has-text("Media")');
    
    if (step5) {
      await step5.click();
      await page.waitForTimeout(1500);
      
      await page.screenshot({ 
        path: path.join(screenshotsDir, '08-media-enhancement.png'),
        fullPage: true 
      });
      screenshotCount++;

      // Try to interact with media options
      const uploadBtn = await page.$('button:has-text("Upload")') || 
                       await page.$('button:has-text("Add Media")');
      if (uploadBtn) {
        await uploadBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ 
          path: path.join(screenshotsDir, '09-media-upload-dialog.png'),
          fullPage: true 
        });
        screenshotCount++;
        await page.keyboard.press('Escape');
      }
    }

    // Step 6: Audio Narration
    console.log('📸 Step 6: Audio Narration');
    let step6 = await page.$('button:has-text("6")') || 
                await page.$('button:has-text("Audio")') ||
                await page.$('a:has-text("Audio")');
    
    if (step6) {
      await step6.click();
      await page.waitForTimeout(1500);
      
      await page.screenshot({ 
        path: path.join(screenshotsDir, '10-audio-narration.png'),
        fullPage: true 
      });
      screenshotCount++;

      // Look for voice selection
      const voiceSelect = await page.$('select[name*="voice" i]');
      if (voiceSelect) {
        await voiceSelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);
        await page.screenshot({ 
          path: path.join(screenshotsDir, '11-audio-voice-selected.png'),
          fullPage: true 
        });
        screenshotCount++;
      }
    }

    // Step 7: SCORM Package Builder
    console.log('📸 Step 7: SCORM Package Builder');
    let step7 = await page.$('button:has-text("7")') || 
                await page.$('button:has-text("SCORM")') ||
                await page.$('button:has-text("Package")') ||
                await page.$('a:has-text("Export")');
    
    if (step7) {
      await step7.click();
      await page.waitForTimeout(1500);
      
      await page.screenshot({ 
        path: path.join(screenshotsDir, '12-scorm-package-builder.png'),
        fullPage: true 
      });
      screenshotCount++;

      // Try to configure SCORM settings
      const scormVersionSelect = await page.$('select[name*="version" i]');
      if (scormVersionSelect) {
        await scormVersionSelect.selectOption('2004');
        await page.waitForTimeout(500);
      }

      await page.screenshot({ 
        path: path.join(screenshotsDir, '13-scorm-configured.png'),
        fullPage: true 
      });
      screenshotCount++;
    }

    // Navigate back to capture modals
    console.log('📸 Capturing modals and overlays');
    const homeStep = await page.$('button:has-text("1")');
    if (homeStep) {
      await homeStep.click();
      await page.waitForTimeout(1000);
    }

    // Settings Modal
    const settingsBtn = await page.$('button[aria-label="Application settings"]');
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '14-settings-modal.png'),
        fullPage: true 
      });
      screenshotCount++;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Help Modal
    const helpBtn = await page.$('button[aria-label="Help documentation"]');
    if (helpBtn) {
      await helpBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '15-help-modal.png'),
        fullPage: true 
      });
      screenshotCount++;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Open Project Dialog
    const openBtn = await page.$('button[aria-label="Open project"]');
    if (openBtn) {
      await openBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '16-open-project-dialog.png'),
        fullPage: true 
      });
      screenshotCount++;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Save Project Dialog
    const saveBtn = await page.$('button[aria-label="Save project"]');
    if (saveBtn) {
      await saveBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '17-save-project-dialog.png'),
        fullPage: true 
      });
      screenshotCount++;
      
      // Fill save form if it exists
      const projectNameInput = await page.$('input[placeholder*="project name" i]');
      if (projectNameInput) {
        await projectNameInput.fill('Web Development Course v1');
        await page.waitForTimeout(500);
        await page.screenshot({ 
          path: path.join(screenshotsDir, '18-save-project-filled.png'),
          fullPage: true 
        });
        screenshotCount++;
      }
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Preview Course
    const previewBtn = await page.$('button:has-text("Preview Course")');
    if (previewBtn) {
      await previewBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '19-course-preview.png'),
        fullPage: true 
      });
      screenshotCount++;
      
      // Navigate in preview if possible
      const nextSlideBtn = await page.$('button:has-text("Next")');
      if (nextSlideBtn) {
        await nextSlideBtn.click();
        await page.waitForTimeout(800);
        await page.screenshot({ 
          path: path.join(screenshotsDir, '20-course-preview-slide2.png'),
          fullPage: true 
        });
        screenshotCount++;
      }
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Template Manager
    const templateBtn = await page.$('button:has-text("Manage Templates")');
    if (templateBtn) {
      await templateBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '21-template-manager.png'),
        fullPage: true 
      });
      screenshotCount++;
    }

    // UI Components close-ups
    console.log('📸 Capturing UI component details');
    
    // Step progress indicator
    const stepProgress = await page.$('.step-progress');
    if (stepProgress) {
      const box = await stepProgress.boundingBox();
      if (box) {
        await page.screenshot({ 
          path: path.join(screenshotsDir, '22-step-progress-enhanced.png'),
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

    // Enhanced buttons
    const buttons = await page.$$('.btn');
    if (buttons.length > 2) {
      // Primary button hover
      await buttons[0].hover();
      await page.waitForTimeout(300);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '23-button-hover-primary.png'),
        fullPage: false,
        clip: await buttons[0].boundingBox()
      });
      screenshotCount++;
    }

    // Enhanced cards
    const cards = await page.$$('.card');
    if (cards.length > 0) {
      await cards[0].hover();
      await page.waitForTimeout(300);
      await page.screenshot({ 
        path: path.join(screenshotsDir, '24-card-hover-enhanced.png'),
        fullPage: false,
        clip: await cards[0].boundingBox()
      });
      screenshotCount++;
    }

    // Final full page screenshot
    await page.screenshot({ 
      path: path.join(screenshotsDir, '25-final-state.png'),
      fullPage: true 
    });
    screenshotCount++;

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
    console.error('Stack:', error.stack);
    
    // Take error screenshot
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'error-state.png'),
      fullPage: true 
    });
    
    // Log current URL and page title
    console.log('Current URL:', page.url());
    console.log('Page title:', await page.title());
  } finally {
    await browser.close();
  }
}

completeWalkthrough().catch(console.error);