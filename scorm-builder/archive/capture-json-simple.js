import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to JSON Import page...');
  
  // Navigate directly to localhost with a URL that might trigger JSON Import
  await page.goto('http://localhost:1420');
  await page.waitForTimeout(3000);
  
  // Try to capture whatever is visible
  await page.screenshot({ 
    path: 'design-system-screenshots/json-import-current.png', 
    fullPage: true 
  });
  
  console.log('Screenshot saved!');
  
  await browser.close();
})();