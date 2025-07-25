import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Navigating to app...');
  await page.goto('http://localhost:1420');
  await page.waitForTimeout(3000);
  
  console.log('Taking screenshots of each page...');
  
  // 1. Course Seed Input
  await page.screenshot({ path: 'button-screenshots/1-course-seed.png', fullPage: true });
  
  // Fill form to enable button
  await page.fill('input[placeholder="Enter your course title"]', 'Test Course');
  await page.fill('textarea[placeholder*="List your course topics"]', 'Topic 1\nTopic 2\nTopic 3');
  await page.screenshot({ path: 'button-screenshots/1-course-seed-filled.png', fullPage: true });
  
  // 2. AI Prompt
  await page.click('button:has-text("Continue to AI Prompt")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'button-screenshots/2-ai-prompt.png', fullPage: true });
  
  // 3. JSON Import
  await page.click('button:has-text("Proceed to JSON Import")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'button-screenshots/3-json-import.png', fullPage: true });
  
  // 4. Media Enhancement
  await page.click('button:has-text("Skip to Media Enhancement")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'button-screenshots/4-media-enhancement.png', fullPage: true });
  
  // 5. Audio Narration
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'button-screenshots/5-audio-narration.png', fullPage: true });
  
  // 6. Activities Editor
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'button-screenshots/6-activities-editor.png', fullPage: true });
  
  // 7. SCORM Builder
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'button-screenshots/7-scorm-builder.png', fullPage: true });
  
  // 8. Settings Modal
  await page.click('button:has-text("Settings")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'button-screenshots/8-settings.png', fullPage: true });
  await page.click('button[aria-label="Close Settings"]');
  
  // 9. Help Page
  await page.click('button:has-text("Help")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'button-screenshots/9-help.png', fullPage: true });
  
  // 10. Open Dialog
  await page.click('button:has-text("Back to Course Builder")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Open")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'button-screenshots/10-open-dialog.png', fullPage: true });
  
  console.log('Screenshots saved to button-screenshots/');
  
  await browser.close();
})();