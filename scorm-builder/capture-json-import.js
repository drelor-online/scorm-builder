import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Capturing JSON Import page...');
  
  // Navigate to app
  await page.goto('http://localhost:1420');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Fill form to proceed
  await page.fill('input[placeholder="Enter your course title"]', 'Test Course');
  await page.fill('textarea[placeholder*="List your course topics"]', 'Topic 1\nTopic 2\nTopic 3');
  
  // Click Next to go to JSON Import
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(2000);
  
  // Capture JSON Import page
  await page.screenshot({ path: 'button-screenshots/json-import-updated.png', fullPage: true });
  
  console.log('Screenshot saved to button-screenshots/json-import-updated.png');
  
  await browser.close();
})();