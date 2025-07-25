import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeAllScreenshots() {
  // Create screenshots directory
  const screenshotsDir = path.join(__dirname, 'screenshots-output');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log(`Screenshots will be saved to: ${screenshotsDir}`);

  // Launch browser
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100 // Slow down actions to ensure UI updates
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to the app...');
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');

    // 1. Home page / Course Seed Input
    console.log('Taking screenshot 1: Home page');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-home-course-seed-input.png'),
      fullPage: true 
    });

    // 2. Fill in course seed data
    console.log('Filling course seed form...');
    await page.fill('input[placeholder*="course title" i]', 'Introduction to Web Development');
    
    // Click Medium difficulty
    const difficultyButtons = await page.$$('button');
    for (const btn of difficultyButtons) {
      const text = await btn.innerText();
      if (text === 'Medium') {
        await btn.click();
        break;
      }
    }
    
    await page.fill('textarea', 'HTML basics, CSS styling, JavaScript programming, React framework, Node.js backend');
    
    console.log('Taking screenshot 2: Filled form');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02-course-seed-filled.png'),
      fullPage: true 
    });

    // 3. Generate course
    console.log('Generating course content...');
    const generateButton = await page.$('button:has-text("Generate Course")');
    if (generateButton) {
      await generateButton.click();
      // Wait for content to be generated
      await page.waitForTimeout(3000);
      
      console.log('Taking screenshot 3: Generated content');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '03-course-generated.png'),
        fullPage: true 
      });
    }

    // 4. Activities Editor
    console.log('Navigating to Activities Editor...');
    const activitiesLink = await page.$('a:has-text("Activities")') || await page.$('button:has-text("Activities")');
    if (activitiesLink) {
      await activitiesLink.click();
      await page.waitForTimeout(1000);
      
      console.log('Taking screenshot 4: Activities Editor');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '04-activities-editor.png'),
        fullPage: true 
      });
    }

    // 5. Media Enhancement Wizard
    console.log('Navigating to Media Enhancement...');
    const mediaLink = await page.$('a:has-text("Media")') || await page.$('button:has-text("Media")');
    if (mediaLink) {
      await mediaLink.click();
      await page.waitForTimeout(1000);
      
      console.log('Taking screenshot 5: Media Enhancement');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '05-media-enhancement.png'),
        fullPage: true 
      });
    }

    // 6. Audio Narration Wizard
    console.log('Navigating to Audio Narration...');
    const audioLink = await page.$('a:has-text("Audio")') || await page.$('button:has-text("Audio")');
    if (audioLink) {
      await audioLink.click();
      await page.waitForTimeout(1000);
      
      console.log('Taking screenshot 6: Audio Narration');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '06-audio-narration.png'),
        fullPage: true 
      });
    }

    // 7. SCORM Package Builder
    console.log('Navigating to SCORM Package Builder...');
    const scormLink = await page.$('a:has-text("SCORM")') || await page.$('button:has-text("SCORM")') || await page.$('a:has-text("Package")');
    if (scormLink) {
      await scormLink.click();
      await page.waitForTimeout(1000);
      
      console.log('Taking screenshot 7: SCORM Package Builder');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '07-scorm-package-builder.png'),
        fullPage: true 
      });
    }

    // Navigate back to home
    const homeLink = await page.$('a:has-text("Course Seed")') || await page.$('a:has-text("Home")');
    if (homeLink) {
      await homeLink.click();
      await page.waitForTimeout(1000);
    }

    // 8. Settings Modal
    console.log('Opening Settings...');
    const settingsButton = await page.$('button[aria-label*="Settings" i]') || await page.$('button:has-text("Settings")');
    if (settingsButton) {
      await settingsButton.click();
      await page.waitForTimeout(1000);
      
      console.log('Taking screenshot 8: Settings Modal');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '08-settings-modal.png'),
        fullPage: true 
      });
      
      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // 9. Help Modal
    console.log('Opening Help...');
    const helpButton = await page.$('button[aria-label*="Help" i]') || await page.$('button:has-text("Help")');
    if (helpButton) {
      await helpButton.click();
      await page.waitForTimeout(1000);
      
      console.log('Taking screenshot 9: Help Modal');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '09-help-modal.png'),
        fullPage: true 
      });
      
      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // 10. Open Project Dialog
    console.log('Opening Open Project dialog...');
    const openButton = await page.$('button:has-text("Open")');
    if (openButton) {
      await openButton.click();
      await page.waitForTimeout(1000);
      
      console.log('Taking screenshot 10: Open Project Dialog');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '10-open-project-dialog.png'),
        fullPage: true 
      });
      
      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // 11. Save Project Dialog
    console.log('Opening Save dialog...');
    const saveButton = await page.$('button:has-text("Save")');
    if (saveButton) {
      await saveButton.click();
      await page.waitForTimeout(1000);
      
      console.log('Taking screenshot 11: Save Dialog');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '11-save-dialog.png'),
        fullPage: true 
      });
      
      // Close if it's a modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // 12. Preview Course
    console.log('Opening Course Preview...');
    const previewButton = await page.$('button:has-text("Preview")');
    if (previewButton) {
      await previewButton.click();
      await page.waitForTimeout(1500);
      
      console.log('Taking screenshot 12: Course Preview');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '12-course-preview.png'),
        fullPage: true 
      });
      
      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // 13. JSON Import/Export
    console.log('Looking for JSON Import/Export...');
    const jsonImportButton = await page.$('button:has-text("Import JSON")') || await page.$('button:has-text("Import")');
    if (jsonImportButton) {
      await jsonImportButton.click();
      await page.waitForTimeout(1000);
      
      console.log('Taking screenshot 13: JSON Import');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '13-json-import.png'),
        fullPage: true 
      });
    }

    // 14. Try to capture any modals with enhanced UI
    console.log('Checking for any open modals...');
    const modalContent = await page.$('.modal-content');
    if (modalContent) {
      console.log('Taking screenshot 14: Modal with enhanced styling');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '14-modal-enhanced.png'),
        fullPage: true 
      });
    }

    // 15. Capture step progress if visible
    const stepProgress = await page.$('.step-progress');
    if (stepProgress) {
      console.log('Taking screenshot 15: Step Progress Indicator');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '15-step-progress.png'),
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
    // Try to take a screenshot of the current state even if there's an error
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'error-state.png'),
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
}

// Run the screenshot script
takeAllScreenshots().catch(console.error);