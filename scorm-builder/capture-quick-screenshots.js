import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Capturing screenshots of button updates...');
  
  // Navigate to app
  await page.goto('http://localhost:1420');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // 1. Course Seed Input - captured in test above
  
  // Fill form to proceed
  await page.fill('input[placeholder="Enter your course title"]', 'Test Course');
  await page.fill('textarea[placeholder*="List your course topics"]', 'Topic 1\nTopic 2\nTopic 3');
  
  // 2. Settings Modal
  await page.click('button:has-text("Settings")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'button-screenshots/settings-modal.png', fullPage: true });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  
  // 3. Help Page
  await page.click('button:has-text("Help")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'button-screenshots/help-page.png', fullPage: true });
  await page.click('button:has-text("Back to Course Builder")');
  await page.waitForTimeout(500);
  
  // 4. Open Dialog
  await page.click('button:has-text("Open")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'button-screenshots/open-dialog.png', fullPage: true });
  await page.click('button:has-text("Cancel")');
  await page.waitForTimeout(500);
  
  console.log('Screenshots saved to button-screenshots/');
  
  await browser.close();
})();